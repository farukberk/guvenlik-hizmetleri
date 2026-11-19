package guvenlikyonetimi.implementation;

import com.mendix.core.Core;
import com.mendix.externalinterface.connector.RequestHandler;
import com.mendix.m2ee.api.IMxRuntimeRequest;
import com.mendix.m2ee.api.IMxRuntimeResponse;
import com.mendix.systemwideinterfaces.core.ISession;
import com.mendix.systemwideinterfaces.core.IUser;

/**
 * Çalışılan birim değişince oturumu kapatmadan yeni kullanıcı rolleriyle devam etmek için:
 * mevcut oturumun kullanıcısıyla yeni bir oturum açar (Mendix rolleri oturum açılırken yükler),
 * eski oturumu kapatır, çerezleri yazar ve uygulamaya yönlendirir. Yol: /calisilan-birim/
 */
public class OturumYenileHandler extends RequestHandler {
	public static final String YOL = "calisilan-birim/";
	private static volatile boolean kayitli = false;

	public static synchronized void kaydet() {
		if (kayitli) return;
		Core.addRequestHandler(YOL, new OturumYenileHandler());
		kayitli = true;
		Core.getLogger("OturumYenile").info("Istek isleyicisi kaydedildi: /" + YOL);
	}

	@Override
	protected void processRequest(IMxRuntimeRequest request, IMxRuntimeResponse response, String path) throws Exception {
		try {
			ISession eski = this.getSessionFromRequest(request);
			if (eski != null) {
				// kullanıcı kendi bağlamında Account'un tüm alanlarını okuyamaz; sistem bağlamında ada göre bulunur
				IUser kullanici = Core.getUser(Core.createSystemContext(), eski.getUserName());
				if (kullanici != null && !kullanici.isAnonymous()) {
					ISession yeni = Core.initializeSession(kullanici, eski.getId().toString());
					Core.addMendixCookies(request, response, yeni, false);
				}
			}
		} catch (Exception e) {
			Core.getLogger("OturumYenile").error("HATA " + e.getClass().getName() + ": " + e.getMessage() + (e.getCause() != null ? " | NEDEN " + e.getCause() : ""));
			throw e;
		}
		response.setStatus(IMxRuntimeResponse.SEE_OTHER);
		response.addHeader("location", "/");
	}
}
