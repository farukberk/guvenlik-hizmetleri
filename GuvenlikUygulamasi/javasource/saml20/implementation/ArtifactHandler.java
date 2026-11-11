package saml20.implementation;

import com.mendix.core.Core;
import com.mendix.core.CoreException;
import com.mendix.logging.ILogNode;
import com.mendix.m2ee.api.IMxRuntimeRequest;
import org.opensaml.core.xml.XMLObject;
import org.opensaml.saml.common.SAMLException;
import org.opensaml.saml.saml2.core.Attribute;
import org.opensaml.saml.saml2.core.AttributeStatement;
import org.opensaml.saml.saml2.core.NameID;
import org.opensaml.security.credential.Credential;
import saml20.implementation.common.Constants;
import saml20.implementation.common.SAMLUtil;
import saml20.implementation.delegation.ArtifactResolver;
import saml20.implementation.metadata.IdpMetadata.Metadata;
import saml20.implementation.provisioning.UserProvisioningHelper;
import saml20.implementation.security.SAMLSessionInfo;
import saml20.implementation.wrapper.MxSAMLAssertion;
import saml20.implementation.wrapper.MxSAMLResponse;
import saml20.proxies.*;

import java.util.HashMap;
import java.util.List;

public class ArtifactHandler extends SAMLHandler {
    private static final ILogNode _logNode = Core.getLogger(Constants.LOGNODE);

    @Override
    public void handleRequest(SAMLRequestContext context) throws SAMLException {
        printTraceInfo(context);
        MxSAMLResponse response = ArtifactResolver.getResponse(context);
        handleSAMLResponse(context, response);
    }

    private void handleSAMLResponse(SAMLRequestContext samlContext, MxSAMLResponse response) throws SAMLException {
        SAMLRequest correspondingSAMLRequest = null;
        SSOConfiguration ssoConfig = samlContext.getSSOConfiguration();
        String userPrincipal = null;
        String assertionId = null;
        try {
            IMxRuntimeRequest request = samlContext.getRequest();

            String relayState = request.getParameter(Constants.SAML_RELAYSTATE);
            if ( _logNode.isDebugEnabled() )
                _logNode.debug("RelayState..:" + relayState);

            String requestID = SAMLUtil.getRequestIDFromRelayState(relayState);
            correspondingSAMLRequest = SAMLUtil.retrieveCorrespondingRequestFromDB(samlContext.getIContext(), requestID);

            String entityId = sanitizeInput(response.getOriginalIdpEntityId());
            Metadata metadata = samlContext.getIdpMetadata().getMetadata(entityId);
            String entityAlias = sanitizeInput(metadata.getAlias(samlContext.getIContext()));

            //SAMLRequest has already received a response.
            if (correspondingSAMLRequest != null && YesNo.Yes.equals(correspondingSAMLRequest.gethasResponse())) {
                throw new SAMLFeedbackException("Request has already received a response")
                        .addFeedbackMessage(Constants.ERROR_MESSAGE_SIGNIN_FAILED)
                        .setStatus(javax.servlet.http.HttpServletResponse.SC_CONFLICT);
            } else if(correspondingSAMLRequest == null && SAMLUtil.hasAlreadyResponseProcessed(samlContext.getIContext(),response.getResponse().getID())){
                throw new SAMLFeedbackException("Request has already received a response")
                        .addFeedbackMessage(Constants.ERROR_MESSAGE_SIGNIN_FAILED)
                        .setStatus(javax.servlet.http.HttpServletResponse.SC_CONFLICT);
            }
            String spAssertionConsumerURL = samlContext.getSpMetadata().getAssertionConsumerServiceLocation(0);
            response.validateResponseCodeAndDestination(spAssertionConsumerURL);
            // getAssertion() decrypts assertions and adds the decrypted form to the message, invalidating the signature.
            // We check the message signature first to prevent this problem
            if (response.hasSignature()) {
             if(!response.validateMessageSignature(metadata)){
                 throw new SAMLFeedbackException("The response is not signed correctly" + " ID:[" + response.getResponse().getID() + "]")
                         .addFeedbackMessage(Constants.ERROR_MESSAGE_SIGNIN_FAILED)
                         .setStatus(javax.servlet.http.HttpServletResponse.SC_UNAUTHORIZED);
             }
            }

            // get the assertion node, this also decrypts if encrypted
            MxSAMLAssertion assertion = response.getAssertion(samlContext.getCredential());

            //  if assertions are signed, check the signature
            if (assertion.hasSignature()) {
                if(!response.validateAssertionSignature(assertion, metadata)){
                    throw new SAMLFeedbackException("The assertion is not signed correctly")
                            .addFeedbackMessage(Constants.ERROR_MESSAGE_SIGNIN_FAILED)
                            .setStatus(javax.servlet.http.HttpServletResponse.SC_UNAUTHORIZED);
                }
            }
            response.getResponse().getAssertions().add(assertion.getAssertion());
            String spEntityID = samlContext.getSpMetadata().getEntityID();
            //String spAssertionConsumerURL = samlContext.getSpMetadata().getAssertionConsumerServiceLocation(0);

            //  Assertion ID must be unique (prevent assertion replay attacks)
             assertionId = assertion.getAssertion().getID();
            if (SAMLUtil.hasAlreadyAssertionProcessed(samlContext.getIContext(), assertionId)) {
                throw new SAMLFeedbackException("Assertion ID has already been processed. Replay attack detected. AssertionID:[" + assertionId + "]")
                        .addFeedbackMessage(Constants.ERROR_MESSAGE_SIGNIN_FAILED)
                        .setStatus(javax.servlet.http.HttpServletResponse.SC_CONFLICT);
            }

            //  Validate InResponseTo and enforce IdP-initiated SSO policy
            boolean allowIdpInitiated = ssoConfig.getAllowIdpInitiatedAuthentication();
            response.validateAssertionEmptyAndResponseToIsSame(
                requestID != null ? Constants.RELAYSTATE_SEPARATOR + requestID : null,
                allowIdpInitiated
            );

            // Validate assertion conditions (timestamps, audience, recipient)
            assertion.validateAssertion(spEntityID, spAssertionConsumerURL);


            // check if at least something was signed
                if (!response.hasSignature() && !assertion.hasSignature()) {
                    throw new SAMLFeedbackException("The message is not signed correctly, either the full message or the assertions must be signed")
                            .addFeedbackMessage(Constants.ERROR_MESSAGE_SIGNIN_FAILED)
                            .setStatus(javax.servlet.http.HttpServletResponse.SC_UNAUTHORIZED);
                }
            

            /*
             * The corresponding SAMLRequest is retrieved based on the RelayState. According to the SAML spec, the IdP
             * is required to answer all requests with an identical RelayState value as in the original request.
             *
             * We do however allow to override this, if it is configured in the SSOConfig we allow the IdP to start by
             * sending an Artifact
             */
            if (correspondingSAMLRequest == null && !ssoConfig.getAllowIdpInitiatedAuthentication()) {
                String errorMessage = "No request found with ID '" + requestID + "'";
                SAMLUtil.createLogLine(errorMessage, SSOLogResult.Failed);
                throw new SAMLFeedbackException("Nothing was returned for the requested ID.")
                        .addFeedbackMessage(Constants.ERROR_MESSAGE_SIGNIN_FAILED)
                        .setStatus(javax.servlet.http.HttpServletResponse.SC_BAD_REQUEST);
            } else {
                try {
                    samlContext.getIContext().startTransaction();

                    // Ensure SAMLRequest exists and mark assertion as processed
                    correspondingSAMLRequest = ensureAndMarkSAMLRequest(samlContext, correspondingSAMLRequest,
                            ssoConfig, assertionId);

                    HashMap<String, Object> assertionAttributes = null;
                    try {
                        assertionAttributes = retrieveAssertionAttributes(assertion,samlContext.getCredential());
                        assertionAttributes.put(UserProvisioningHelper.UseNameID,SAMLUtil.getNameIDValue(assertion));
                    } catch (Exception e2) {
                        throw new SAMLFeedbackException("Unable to retrieve the assertion attributes, " + e2.getMessage(), e2)
                                .addFeedbackMessage(Constants.ERROR_MESSAGE_SIGNIN_FAILED)
                                .setStatus(javax.servlet.http.HttpServletResponse.SC_BAD_REQUEST);
                    }
                    userPrincipal = new UserProvisioningHelper().getPrincipalValue(samlContext.getIContext(),assertionAttributes,ssoConfig);
                    if (userPrincipal == null) {
                        // should not happen since either user principal is set, or one of many other exceptions has been thrown.
                        String errorMessage = "No user principal found.";
                        SAMLUtil.createLogLine(errorMessage, SSOLogResult.Failed);
                        throw new SAMLFeedbackException("No user principal found.")
                                .addFeedbackMessage(Constants.ERROR_MESSAGE_SIGNIN_FAILED)
                                .setStatus(javax.servlet.http.HttpServletResponse.SC_BAD_REQUEST);
                    }

                    // now we create a session
                    try {
                        SAMLSessionInfo samlSession = samlContext.getSessionManager().createSAMLSessionInfo(entityId, userPrincipal, assertionAttributes, ssoConfig, assertion,samlContext);
                        if (samlSession != null) {
                            if (samlSession.getIUser().isActive()) {

                                if (samlSession.getIUser().getUserRoleNames().isEmpty()) {
                                    String errorMessage = "No user roles found for the provided user '" + samlSession.getIUser().getName() + "'";
                                    SAMLUtil.createLogLine(errorMessage, SSOLogResult.Failed);
                                    throw new SAMLFeedbackException("No user roles found for the provided user.")
                                            .addFeedbackMessage("Your account has not been configured to access this application.")
                                            .setStatus(javax.servlet.http.HttpServletResponse.SC_FORBIDDEN);
                                } else {
                                    String action = SAMLUtil.getActionFromRelayState(relayState);
                                    if (action != null && action.equals(Constants.RELAYSTATE_VERIFY)) {
                                        // if verify action, then do not sign in user but execute custom verify microflow
                                        samlContext.getSessionManager().executeVerifyMicroflow(entityId, samlContext, samlSession, correspondingSAMLRequest,  relayState);
                                        SAMLUtil.createLogLine("Successful verification on: " + samlSession.getIUser().getName(), SSOLogResult.Success);
                                    } else {
                                        // default behaviour is to sign in the user
                                        samlContext.getSessionManager().createSession(entityId, samlContext, samlSession, correspondingSAMLRequest, entityAlias, relayState);
                                        SAMLUtil.createLogLine("Successful sign on: " + samlSession.getIUser().getName(), SSOLogResult.Success);
                                    }
                                }
                            } else {
                                SAMLUtil.createLogLine("Inactive account: '" + samlSession.getIUser().getName() + "'", SSOLogResult.Failed);
                                throw new SAMLFeedbackException("Your account is not active.")
                                        .addFeedbackMessage("Your account is not active.")
                                        .setStatus(javax.servlet.http.HttpServletResponse.SC_FORBIDDEN);
                            }
                        } else {
                            String errorMessage = "User lookup of '" + userPrincipal + "' failed, this user principal does not exist in the Mx database.";
                            SAMLUtil.createLogLine(errorMessage, SSOLogResult.Failed);
                            throw new SAMLFeedbackException("User lookup failed.")
                                    .addFeedbackMessage("The authentication was successful, but there is no account available in this application.")
                                    .setStatus(javax.servlet.http.HttpServletResponse.SC_FORBIDDEN);
                        }

                    } catch (SAMLFeedbackException e) {
                        throw e;
                    } catch (Exception e) {
                        SAMLFeedbackException samlFeedbackException =  getSAMLFeedbackException(e.getCause());
                        if(samlFeedbackException != null){
                            throw samlFeedbackException;
                        }
                        String errorMessage = "Could not create a session for the provided user principal '" + userPrincipal + "': " + e.getMessage();
                        SAMLUtil.createLogLine(errorMessage, SSOLogResult.Failed);
                        throw new SAMLFeedbackException("Could not create a session for the provided user principal.", e).addFeedbackMessage(Constants.ERROR_MESSAGE_SIGNIN_FAILED);
                    }

                    samlContext.getIContext().endTransaction();
                } catch (Exception e) {
                    if (samlContext.getIContext().isInTransaction())
                        samlContext.getIContext().rollbackTransaction();

                    throw new SAMLFeedbackException("Could not create a session for the provided user principal.", e).addFeedbackMessage(Constants.ERROR_MESSAGE_SIGNIN_FAILED);
                }
            }
        } finally {
            SAMLUtil.logSAMLResponseMessage(samlContext, correspondingSAMLRequest, response.getResponse(), userPrincipal, ssoConfig.getMendixObject());
        }
    }

    /**
     * Ensures a SAMLRequest exists and marks it as processed with the assertion ID.
     * Creates a new SAMLRequest if one doesn't exist (IdP-initiated flow).
     *
     * @param samlContext The SAML request context
     * @param samlRequest The existing SAMLRequest, or null to create a new one
     * @param ssoConfig The SSO configuration
     * @param assertionId The assertion ID to mark as processed
     * @return The SAMLRequest (existing or newly created)
     * @throws CoreException if database operation fails
     */
    private SAMLRequest ensureAndMarkSAMLRequest(SAMLRequestContext samlContext, SAMLRequest samlRequest,
                                                  SSOConfiguration ssoConfig,
                                                  String assertionId) throws CoreException {
        // Create SAMLRequest immediately if it doesn't exist (IdP-initiated flow)
        if (samlRequest == null) {
            samlRequest = new SAMLRequest(samlContext.getIContext());
            samlRequest.setSAMLRequest_SSOConfiguration(samlContext.getIContext(), ssoConfig);
            _logNode.debug("Created SAMLRequest for IdP-initiated authentication");
        }
        // Mark request as having received a response and store assertion ID
        samlRequest.sethasResponse(YesNo.Yes);

        if (assertionId != null && !assertionId.isBlank()) {
            samlRequest.setAssertionId(assertionId);
            _logNode.debug("Assertion ID stored in SAMLRequest: " + assertionId);
        }

        samlRequest.commit();

        return samlRequest;
    }

    private String sanitizeInput(String relayState) {
        if (relayState == null) {
            return null;
        }
        return relayState.replaceAll("[\r\n]", "").trim();
    }

    public HashMap<String, Object> retrieveAssertionAttributes(MxSAMLAssertion mxSAMLAssertion, Credential credential) throws CoreException {
        HashMap<String, Object> hashmap = new HashMap<String, Object>();

        List<AttributeStatement> attributeStatements = mxSAMLAssertion.getAssertion().getAttributeStatements();

        for (int i = 0; i < attributeStatements.size(); i++) {
            List<Attribute> attributes = attributeStatements.get(i).getAttributes();
            // TODO it is also possible to only encrypt attributes and not the full assertion
            // element. Do we want to support encrypted attributes?
            // attributeStatements.get(0).getEncryptedAttributes();


            for (int x = 0; x < attributes.size(); x++) {
                String strAttributeName = attributes.get(x).getDOM().getAttribute("Name");

                List<XMLObject> attributeValues = attributes.get(x).getAttributeValues();

                for (int y = 0; y < attributeValues.size(); y++) {
                    String strAttributeValue = attributeValues.get(y).getDOM().getTextContent();

                    // Replace attribute name key value pair, when value contains EncryptedID element with the NameID
                    NameID nameID = OpenSAMLUtils.getNameIdFromEncryptedID(attributeValues.get(y), credential);
                    if (nameID != null) {
                        strAttributeName = nameID.getNameQualifier();
                        strAttributeValue = nameID.getValue();
                        _logNode.info("getNameIdFromEncryptedID= " + strAttributeName + " : " + strAttributeValue);
                    }

                    if (hashmap.containsKey(strAttributeName)) {
                        Object value = hashmap.get(strAttributeName);
                        String[] valueArr = null;
                        if (value instanceof String) {
                            valueArr = new String[2];
                            valueArr[0] = (String) value;
                            valueArr[1] = (String) strAttributeValue;

                            hashmap.put(strAttributeName, valueArr);
                        } else if (value instanceof String[]) {
                            valueArr = new String[((String[]) value).length + 1];
                            for (int j = 0; j < ((String[]) value).length; j++)
                                valueArr[j] = ((String[]) value)[j];

                            valueArr[((String[]) value).length] = (String) strAttributeValue;

                            hashmap.put(strAttributeName, valueArr);
                        } else {
                            _logNode.error("Unexpected value " + value + " for key: " + strAttributeName);
                        }
                    } else {
                        hashmap.put(strAttributeName, strAttributeValue);
                    }
                }
            }
        }

        return hashmap;
    }

    private SAMLFeedbackException getSAMLFeedbackException(Throwable cause) {
        if (cause != null) {
            if(cause instanceof SAMLFeedbackException){
                return (SAMLFeedbackException) cause;
            }
            return getSAMLFeedbackException(cause.getCause());
        } else {
            return null;
        }
    }
}
