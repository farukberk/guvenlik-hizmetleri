package saml20.implementation.security;

import com.mendix.core.Core;
import com.mendix.core.CoreException;
import com.mendix.externalinterface.connector.RequestHandler;
import com.mendix.logging.ILogNode;
import com.mendix.m2ee.api.IMxRuntimeRequest;
import com.mendix.m2ee.api.IMxRuntimeResponse;
import com.mendix.systemwideinterfaces.core.IContext;
import com.mendix.systemwideinterfaces.core.IMendixObject;
import com.mendix.systemwideinterfaces.core.ISession;
import com.mendix.systemwideinterfaces.core.IUser;
import org.opensaml.saml.common.SAMLException;
import saml20.implementation.SAMLFeedbackException;
import saml20.implementation.SAMLRequestContext;
import saml20.implementation.SAMLRequestHandler;
import saml20.implementation.common.Constants;
import saml20.implementation.common.Constants.SAMLAction;
import saml20.implementation.common.HTTPUtils;
import saml20.implementation.common.SAMLUtil;
import saml20.implementation.provisioning.UserProvisioningHelper;
import saml20.implementation.wrapper.MxSAMLAssertion;
import saml20.proxies.SAMLRequest;
import saml20.proxies.SAMLSession;
import saml20.proxies.SSOConfiguration;
import system.proxies.TokenInformation;
import system.proxies.User;

import javax.servlet.http.HttpServletResponse;
import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.UUID;

public class SessionManager {

	private static ILogNode _logNode = Core.getLogger(Constants.LOGNODE);

	public class Configuration {

		private final boolean useCustomUserProvisioning;
		private final boolean useCustomAfterSigninLogic;
		
		// Changes are customVerifyMicroflow, customProvisioningMicroflow, customAfterSigninMicroflow
		private final String customEvaluateInSessionAuthNMicroflow;
		private final String customProvisioningMicroflow;
		private final String customAfterSigninMicroflow;
		private final boolean enableMobileAuthToken;
		protected boolean allowDelegatedAuthentication;

		@SuppressWarnings("serial")
		public Configuration( boolean useUserProvisioning,
							 boolean useCustomAfterSigninLogic, String customProvisioningMicroflow, String customAfterSigninMicroflow, String customEvaluateInSessionAuthNMicroflow, boolean allowDelegatedAuthentication, boolean enableMobileAuthToken ) {

			this.useCustomUserProvisioning = useUserProvisioning;
			this.useCustomAfterSigninLogic = useCustomAfterSigninLogic;
			this.customProvisioningMicroflow = customProvisioningMicroflow;
			this.customAfterSigninMicroflow = customAfterSigninMicroflow;
			this.customEvaluateInSessionAuthNMicroflow = customEvaluateInSessionAuthNMicroflow;
			this.enableMobileAuthToken = enableMobileAuthToken;

			this.allowDelegatedAuthentication = allowDelegatedAuthentication;
		}
	}

	private HashMap<String, Configuration> configurationSet = new HashMap<String, Configuration>();

	private static SessionManager _instance = null;

	public static SessionManager getInstance( IContext context ) throws SAMLException {
		if ( _instance == null )
			_instance = new SessionManager(context);

		return _instance;
	}

	private SessionManager( IContext context ) throws SAMLException {
		init(context, null);
	}

	public SessionManager init( IContext context, List<IMendixObject> ssoConfigurationList ) throws SAMLException {


			boolean useCustomUserProvisioning = false,
					useCustomAfterSignIn = false,
					enableDelegatedAuth = false,
					enableMobileAuthToken = false;
			String customProvisioningMicroflow = null,
					customAfterSigninMicroflow = null,
					customEvaluateInSessionAuthNMicroflow = null;

			if ( ssoConfigurationList != null ) {
				for( IMendixObject ssoConfigObj : ssoConfigurationList ) {
					String entityId = SAMLUtil.getEntityIdForConfig(context, ssoConfigObj);
					if ( entityId != null ) {
						SSOConfiguration ssoConfig = SSOConfiguration.initialize(context, ssoConfigObj);

						customProvisioningMicroflow = ssoConfig.getCustomUserProvisioningMicroflow();
						customAfterSigninMicroflow = ssoConfig.getCustomAfterSigninMicroflow();
						customEvaluateInSessionAuthNMicroflow = ssoConfig.getCustomEvaluateInSessionAuthenticationMicroflow();
						useCustomUserProvisioning = ssoConfig.getUseCustomLogicForProvisioning();
						useCustomAfterSignIn = ssoConfig.getUseCustomAfterSigninLogic();
						enableDelegatedAuth = ssoConfig.getEnableDelegatedAuthentication();
						enableMobileAuthToken = ssoConfig.getEnableMobileAuthToken();

						this.configurationSet.put(entityId, new Configuration(useCustomUserProvisioning, useCustomAfterSignIn,
								customProvisioningMicroflow, customAfterSigninMicroflow, customEvaluateInSessionAuthNMicroflow, enableDelegatedAuth, enableMobileAuthToken));
					}
				}
			}
		return this;
	}

	/**
	 * this method can be used to initialize an XAS session when the username is known and verified.
	 *
	 * @param entityId
	 * @param samlContext
	 * @param samlSession
	 * @param correspondingSAMLRequest
	 * @param entityAlias
	 * @param relayState
	 * @throws Exception
	 */
	public void createSession( String entityId, SAMLRequestContext samlContext, SAMLSessionInfo samlSession, SAMLRequest correspondingSAMLRequest, String entityAlias, String relayState ) throws Exception {
		IMxRuntimeResponse response = samlContext.getResponse();

		try {
			_logNode.debug("Initializing new session for user '" + samlSession.getIUser().getName() + "'");

			Configuration config = this.configurationSet.get(entityId);

			IContext context = samlContext.getIContext();

			IMendixObject currentSession = null, newSession = null, currentUser = null, newUser = null;
			if( config.useCustomAfterSigninLogic && samlContext.getCurrentSession() != null ) {
				currentSession = samlContext.getCurrentSession().getMendixObject();
				currentUser = samlContext.getCurrentSession().getUser(context).getMendixObject();
			}

			String previousSessionID = null;
			if (samlContext.getCurrentSession() != null) {
				previousSessionID = samlContext.getCurrentSession().getId().toString();
			};

			ISession session = Core.initializeSession(samlSession.getIUser(), previousSessionID);

			if( config.useCustomAfterSigninLogic ) {
				newSession = session.getMendixObject();
				newUser = session.getUser(context).getMendixObject();

				IContext mxContext = Core.createSystemContext();
				if (config.customAfterSigninMicroflow != null && !config.customAfterSigninMicroflow.isEmpty()) {
					Core.microflowCall(config.customAfterSigninMicroflow)
							.inTransaction(true)
							.withParam("PreviousSession", (currentSession == null ? null : system.proxies.Session.initialize(mxContext, currentSession).getMendixObject()))
							.withParam("PreviousUser", (currentUser == null ? null : User.initialize(mxContext, currentUser).getMendixObject()))
							.withParam("NewSession", system.proxies.Session.initialize(mxContext, newSession).getMendixObject())
							.withParam("NewUser", User.initialize(mxContext, newUser).getMendixObject())
							.withParam("SamlRequest", correspondingSAMLRequest.getMendixObject())
							.execute(mxContext);
				} else {
					saml20.proxies.microflows.Microflows.customAfterSigninLogic(Core.createSystemContext(),
							(currentSession == null ? null : system.proxies.Session.initialize(mxContext, currentSession)), system.proxies.Session.initialize(mxContext, newSession),
							(currentUser == null ? null : User.initialize(mxContext, currentUser)), User.initialize(mxContext, newUser), correspondingSAMLRequest );
				}
			}

			/**
			 * create cookies and redirect: String key, String value, String path, String domain, int expiry
			 */
			Core.addMendixCookies(samlContext.getRequest(),response,session,config.enableMobileAuthToken);
			// Sanitize CSRF token to prevent CRLF injection
			String csrfToken = session.getCsrfToken();
			String sanitizedToken = (csrfToken == null) ? null : csrfToken.replaceAll("[\r\n]", "");
			response.addHeader(RequestHandler.CSRF_TOKEN_HEADER, sanitizedToken);

			// Third variable of addCookie is "Path" (based on source code) and setting this to "/" caused double
			// quotation marks to be added in the cloud (Linux?).
			// setting it to File.pathSeparator didn't resolve the issue in the Cloud. Removing the slash altogether did
			// resolve the issue.
			// -- JPU, 20150624
			String originURI = Constants._getInstance().SSO_PATH + SAMLAction.login + "?" + URLEncoder.encode(entityAlias, StandardCharsets.UTF_8);
			response.addCookie("originURI",  originURI, "", "", Constants.COOKIE_SECONDS_PER_YEAR,true);

			createSAMLSession(session,samlSession,samlContext);
			redirectUser(relayState, response);
		}
		catch( Exception e ) {
			response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
			throw new Exception("Single Sign On unable to create new session: " + e.getMessage(), e);
		}
	}

	private void redirectUser(String relayState, IMxRuntimeResponse response) throws UnsupportedEncodingException {
		// Determine where to redirect the user (either home/landing page or continuation URL)
		String redirectTo = Constants._getInstance().getSP_URI() + Constants.getLandingPage();
		String continuation = SAMLUtil.getContinuationFromRelayState(relayState);
		if (continuation != null && !continuation.isEmpty()) {
			if (saml20.proxies.constants.Constants.getDisableDecoding_Deeplink_URL()) {
				redirectTo = Constants._getInstance().getSP_URI() + continuation;
			} else {
				redirectTo = Constants._getInstance().getSP_URI() + URLDecoder.decode(continuation, StandardCharsets.UTF_8);
			}

		}

		HTTPUtils.redirect(response, redirectTo);
	}

	
	// Executing customVerifyMicroflow
	public void executeVerifyMicroflow( String entityId, SAMLRequestContext samlContext, SAMLSessionInfo samlSession, SAMLRequest correspondingSAMLRequest, String relayState ) throws Exception {
		IMxRuntimeResponse response = samlContext.getResponse();

		try {
			IUser iUser = samlSession.getIUser();
			_logNode.debug("Executing verify microflow for user '" + iUser.getName() + "'");

			Configuration config = this.configurationSet.get(entityId);
			IContext context = samlContext.getIContext();
			IMendixObject currentSession = null;
			IMendixObject currentUser = null;
			if (samlContext.getCurrentSession() != null) {
				currentSession = samlContext.getCurrentSession().getMendixObject();
				currentUser = samlContext.getCurrentSession().getUser(context).getMendixObject();
			}
			IContext mxContext = Core.createSystemContext();
			if (config.customEvaluateInSessionAuthNMicroflow != null && !config.customEvaluateInSessionAuthNMicroflow.equals("")) {
				Core.microflowCall(config.customEvaluateInSessionAuthNMicroflow)
						.inTransaction(true)
						.withParam("ExistingSession", (currentSession == null ? null : system.proxies.Session.initialize(mxContext, currentSession).getMendixObject()))
						.withParam("ExistingUser", (currentUser == null ? null : User.initialize(mxContext, currentUser).getMendixObject()))
						.withParam("NewUser", iUser.getMendixObject())
						.withParam("SamlRequest", correspondingSAMLRequest.getMendixObject())
						.execute(mxContext);
			} else {
				_logNode.warn("Verify attempted, but no custom verify microflow is configured in the application constants");
			}

			redirectUser(relayState, response);
		}
		catch( Exception e ) {
			response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
			throw new Exception("Single Sign On unable to create new session: " + e.getMessage(), e);
		}
	}
	public SAMLSessionInfo createSAMLSessionInfo(String entityId, String principalValue, HashMap<String, Object> assertionAttributes, SSOConfiguration ssoConfig, MxSAMLAssertion mxSAMLAssertion,SAMLRequestContext samlContext ) throws Exception {
		Configuration config = this.configurationSet.get(entityId);
		if (config == null) {
			_logNode.debug("No valid SSO Configuration could be found for the provided Entity ID: " + entityId);
			throw new SAMLFeedbackException("No valid SSO Configuration could be found for the provided Entity ID.")
					.addFeedbackMessage(Constants.ERROR_MESSAGE_NO_CONFIGURATION);
		}
		IContext mxContext = Core.createSystemContext();
		UserProvisioningHelper userProvisioningHelper = new UserProvisioningHelper();
		User mxUser = userProvisioningHelper.updateUser(mxContext,assertionAttributes, ssoConfig);
		String userName = mxUser.getName();
		IUser newUser = Core.getUser(mxContext, userName);
		SAMLSessionInfo samlSessionInfo = new SAMLSessionInfo(mxSAMLAssertion, entityId, config, newUser);
		try {
			// custom login functionality


			if (config.useCustomUserProvisioning) {
				_logNode.trace(" Executing custom logic functionality for user p:'" + principalValue + "'/u:'" + userName + "'");
				UUID sessionId = UUID.randomUUID();
				IMendixObject samlSessionObject = Core.instantiate(mxContext, SAMLSession.entityName);
				samlSessionObject.setValue(mxContext, SAMLSession.MemberNames.SessionID.toString(), sessionId.toString());
				samlSessionObject.setValue(mxContext, SAMLSession.MemberNames.Username.toString(), userName);
				samlSessionInfo.setSAMLSessionID(sessionId.toString());
				try {
					userProvisioningHelper.executeCustomProvisioningMicroFlow(mxContext, config.customProvisioningMicroflow, samlSessionObject, mxUser, assertionAttributes, ssoConfig);
				} catch (SAMLFeedbackException fe) {
					throw fe;
				} catch (Exception e) {
					throw new SAMLException("Exception occured while executing the customLoginLogic Microflow, the error was: " + e.getMessage(), e);
				}
			}

			// Get the user again, with the latest values from the just executed microflow
			samlSessionInfo.setUserRecord(Core.getUser(mxContext, userName));

			if (ssoConfig.getEnableDelegatedAuthentication(mxContext)) {
				String delAuthURL = ssoConfig.getDelegatedAuthenticationURL(mxContext);
				if (delAuthURL != null && !delAuthURL.trim().isEmpty()) {
					samlContext.setSamlSessionInfo(samlSessionInfo);
					SAMLRequestHandler.getInstance(mxContext).requestDelegatedAuthentication(samlContext, delAuthURL);
				}else
					_logNode.error("Invalid SSO configuration(" + ssoConfig.getAlias() + ") - Delegated authentication is enabled, but no URL has been specified.");
			}
		} catch (Exception e) {
			samlSessionInfo.releaseLock();
			// BJHL 2016-12-05 removed retain/release, which was introduced as a fix in r90 on 2014-07-31
			throw e;
		}

		_logNode.trace(" Finished evaluating user with name: p:'" + principalValue + "'/u:'" + newUser.getName() + "'");
		return samlSessionInfo;
	}

	public void logOut( ISession session ) {
		if ( session == null )
			return;

		Core.logout(session);
	}

	public ISession getSessionFromRequest( IMxRuntimeRequest request ) throws CoreException {
		String sessionId = getSamlSessionID(request);
		if ( sessionId == null )
			return null;

		UUID curUUID = UUID.fromString(sessionId);
		ISession session = Core.getSessionById(curUUID);

		if ( session == null || !session.isInteractive() )
			return null;

		return session;
	}

	// This method returns initially logged in IDP as part of In-Session Authentication
	public String getInitiallyLoggedInIdp(IContext context,ISession currentSession)	{
		if(currentSession!=null) {
			return 	SAMLUtil.getEntityId(context,currentSession.getId().toString());
		}
		return null;
	}

	private String getSamlSessionID(IMxRuntimeRequest request)  {
		return request.getCookie(Core.getConfiguration().getSessionIdCookieName(), true);
	}

	private void createSAMLSession(ISession session,SAMLSessionInfo samlSessionInfo,SAMLRequestContext samlContext) throws CoreException {
		IMendixObject samlSessionObj = Core.instantiate(samlContext.getIContext(), SAMLSession.entityName);
		SAMLSession samlSession = SAMLSession.initialize(samlContext.getIContext(),samlSessionObj);
		samlSession.setSessionID(samlSessionInfo.getSamlSessionID());
		samlSession.setUsername(session.getUserName());
		samlSession.setEntityId(samlSessionInfo.getEntityId());
		samlSession.setSAMLSession_Session(SAMLUtil.getSession(samlContext.getIContext(),session.getId().toString()));
		samlSession.setSessionIndex(samlSessionInfo.getSessionIndex());
		samlSession.setNameID(samlSessionInfo.getNameIDValue() );
		samlSession.setNameFormat(samlSessionInfo.getFormat());
		samlSession.commit();
	}

}