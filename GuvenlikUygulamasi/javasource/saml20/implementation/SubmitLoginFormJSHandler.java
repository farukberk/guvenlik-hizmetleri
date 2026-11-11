package saml20.implementation;

import com.mendix.core.Core;
import com.mendix.logging.ILogNode;
import org.opensaml.saml.common.SAMLException;
import saml20.implementation.common.Constants;
import saml20.implementation.common.HTTPUtils;

import java.io.IOException;

public class SubmitLoginFormJSHandler extends SAMLHandler {
    private static final ILogNode _logNode = Core.getLogger(Constants.LOGNODE);

    @Override
    public void handleRequest(SAMLRequestContext context) throws SAMLException {
     try{
         HTTPUtils.SubmitLoginForm(context.getResponse());
     } catch (IOException e) {
         _logNode.error("Unable to render Javascript", e);
     }
    }




}
