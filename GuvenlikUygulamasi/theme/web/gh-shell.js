// Güvenlik uygulamasının Halkbank_Shell kabuğuna bağlantısı ve sayfa yardımcıları.
// Üst bar ve sol menünün görünümü/davranışı Halkbank_Shell modülündedir (halkbank-shell.js + halkbank-shell.config.js).
// Bu dosya: kullanıcı bilgisi ve menü rozetleri (GuvenlikYonetimi.SUB_Kabuk_Bilgi: "AdSoyad|RolAdi|BirimMetni|AktifAlarm|OnayBekleyenTalep|RolKodu"),
// html'deki gh-rol-<Rol> sınıfı, üst bardaki şube araması, personel yönlendirmesi ve sayfa yardımcıları.
(function () {
    var MF_BILGI = "GuvenlikYonetimi.SUB_Kabuk_Bilgi";
    var MF_BELGE = "GuvenlikYonetimi.ACT_SubeBelgeleri_Ac";
    var bilgi = null, sonSorgu = 0;
    function hazir() {
        return window.mx && mx.session && mx.data && typeof mx.data.action === "function" && !(mx.session.isGuest && mx.session.isGuest());
    }
    function kabuk() {
        return window.HalkbankShell || null;
    }
    function el(tag, cls) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        return e;
    }

    // ----- Üst bar: şube araması (Enter → Şube Belgeleri açılır, filtre doldurulur) -----
    function aramaYap(metin) {
        metin = String(metin || "").trim();
        if (!metin) return;
        mx.data.action({ params: { actionname: MF_BELGE }, callback: function () {}, error: function () {} });
        var deneme = 0;
        var t = setInterval(function () {
            deneme++;
            var inp = document.querySelector(".gh-filter-bar input[placeholder='Birim adı veya kodu']");
            if (inp) {
                clearInterval(t);
                var set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
                set.call(inp, metin);
                inp.dispatchEvent(new Event("input", { bubbles: true }));
                inp.dispatchEvent(new Event("change", { bubbles: true }));
            } else if (deneme > 40) {
                clearInterval(t);
            }
        }, 150);
    }
    function arama() {
        var k = kabuk();
        var bar = document.querySelector(".region-topbar .topbar-content");
        if (!k || !bar) return;
        var ara = bar.querySelector(".gh-tb-search");
        if (!ara) {
            ara = el("label", "hs-search gh-tb-search");
            var ikon = el("i", "ph ph-magnifying-glass");
            var inp = el("input");
            inp.type = "search";
            inp.placeholder = "Birim adı veya kodu ara…";
            inp.setAttribute("aria-label", "Birim ara");
            inp.addEventListener("keydown", function (e) {
                if (e.key === "Enter") {
                    aramaYap(inp.value);
                    inp.value = "";
                    inp.blur();
                }
            });
            ara.appendChild(ikon);
            ara.appendChild(inp);
            k.addTopbarItem(ara, 1);
        }
        var rol = bilgi ? bilgi.rol : "";
        var gizli = rol === "SubeKullanicisi" || rol === "GuvenlikPersoneli";
        if (ara.hidden !== gizli) ara.hidden = gizli;
    }

    // ----- Kullanıcı bilgisi, rol sınıfı ve menü rozetleri -----
    function uygula() {
        var k = kabuk();
        if (!k || !bilgi) return;
        k.setUser({ name: bilgi.ad, role: bilgi.rolAdi, unit: bilgi.birim });
        k.setBadge("a.mx-name-navigationTree3-2", bilgi.alarm);
        k.setBadge("a.mx-name-navigationTree3-4", bilgi.talep);
        arama();
    }
    function yenile(zorla) {
        if (!hazir()) return;
        var simdi = Date.now();
        if (!zorla && simdi - sonSorgu < 4000) return;
        sonSorgu = simdi;
        mx.data.action({
            params: { actionname: MF_BILGI },
            callback: function (s) {
                var p = String(s || "").split("|");
                bilgi = { ad: p[0] || "", rolAdi: p[1] || "", birim: p[2] || "", alarm: Number(p[3]) || 0, talep: Number(p[4]) || 0, rol: p[5] || "" };
                var h = document.documentElement;
                h.className = h.className.replace(/\bgh-rol-\S+/g, "").trim();
                if (bilgi.rol) h.classList.add("gh-rol-" + bilgi.rol);
                if (oturumUyumsuzMu(bilgi.rol)) { oturumuYenile(); return; }
                uygula();
                personelYonlendir();
            },
            error: function () {
                // Uygulama rolü olmayan kullanıcı (ör. yönetici): yalnız oturum adı
                var ad = mx.session.getUserName ? mx.session.getUserName() : "";
                bilgi = { ad: ad, rolAdi: "Yönetici", birim: "", alarm: 0, talep: 0, rol: "" };
                uygula();
            }
        });
    }

    // ----- Yan panel (çekmece) dışına tıklanınca kapanır -----
    function enUstPencere() {
        var ust = null, z = -Infinity;
        document.querySelectorAll(".modal-dialog.mx-window").forEach(function (w) {
            if (!w.offsetWidth) return;
            var v = parseInt(window.getComputedStyle(w).zIndex, 10) || 0;
            if (v >= z) { z = v; ust = w; }
        });
        return ust;
    }
    document.addEventListener("mousedown", function (e) {
        if (e.button !== 0) return;
        var w = enUstPencere();
        if (!w || w.contains(e.target)) return;
        if (!w.querySelector(".gh-drawer, .gh-bl-drawer")) return;
        if (e.target.closest && e.target.closest(".widget-combobox-menu, .mx-calendar, .popover, .dropdown-menu, .mx-dialog, .modal-dialog, .gh-fp-overlay")) return;
        var kapat = w.querySelector(".gh-close, .modal-header .close");
        if (!kapat) return;
        e.preventDefault();
        e.stopPropagation();
        kapat.click();
    }, true);

    // Analiz §3.2: güvenlik personelinin anasayfası yok. Navigasyonun ana sayfası (model aracıyla değiştirilemiyor)
    // personeli Anasayfa'ya getirirse, rol bazlı yönlendiren ACT_Anasayfa_Ac çağrılır (personel → Kıyafet / Teçhizat Taleplerim).
    var sonYonlendirme = 0;
    function personelYonlendir() {
        if (!bilgi || bilgi.rol !== "GuvenlikPersoneli") return;
        if (!document.querySelector(".gh-as")) return;
        if (Date.now() - sonYonlendirme < 3000) return;
        sonYonlendirme = Date.now();
        mx.data.action({ params: { actionname: "GuvenlikYonetimi.ACT_Anasayfa_Ac" }, callback: function () {}, error: function () {} });
    }
    setInterval(function () { if (hazir()) personelYonlendir(); }, 800);

    // ----- Veri tabloları: boş değerli hücreler "—" gösterir (Mendix boş metni &nbsp; olarak çizer; CSS ayırt edemez) -----
    function bosHucreler() {
        // Ortak Veriler: simge olarak gösterilen satır düğmelerine ipucu (yazısı görünmüyor)
        document.querySelectorAll(".gh-ortak-kart .gh-row-actions .btn").forEach(function (b) {
            if (b.title) return;
            var yazi = (b.textContent || "").trim();
            if (yazi) { b.title = yazi; b.setAttribute("aria-label", yazi); }
        });
        document.querySelectorAll(".widget-datagrid .td").forEach(function (td) {
            var bos = !(td.textContent || "").replace(/ /g, " ").trim() &&
                !td.querySelector("button, a, input, select, img, svg, .gh-toggle, [class*='icon'], [class*='chevron'], [class*='knob'], [class*='bar']");
            if (td.classList.contains("gh-bos") !== bos) td.classList.toggle("gh-bos", bos);
        });
        // Dosya alanları: Mendix boşken "..." yazar → anlamlı metin (seçilen dosyanın adı aynen kalır)
        document.querySelectorAll(".mx-compound-control > input.form-control[readonly]").forEach(function (inp) {
            var fi = inp.parentElement.querySelector("input[type=file]");
            if (!fi) return;
            var bosMetin = inp.closest(".gh-rehber-upload") ? "Görsel seçmek için tıklayın · PNG veya JPG" : "Dosya seçilmedi";
            if (inp.value === "..." || inp.value === "") inp.value = bosMetin;
            inp.classList.toggle("gh-file-bos", inp.value === bosMetin);
        });
        // Satır sınırıyla kısaltılan metinlerin tamamı ipucunda görünsün
        document.querySelectorAll(".gh-clamp2").forEach(function (e) {
            var tam = (e.textContent || "").trim();
            if (e.scrollHeight > e.clientHeight + 1 && e.title !== tam) e.title = tam;
        });
    }
    var bosZamanlayici = null;
    new MutationObserver(function () {
        if (bosZamanlayici) return;
        bosZamanlayici = setTimeout(function () { bosZamanlayici = null; bosHucreler(); }, 250);
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

    // ----- Sol menü: ÇALIŞILAN BİRİM seçimi (P93) -----
    // Seçenekler GuvenlikYonetimi.DS_CalisilanBirim_Secenekler'den gelir (Güvenlik Ofisi: manuel birimler; Bölge: üst birim / birim kullanıcısı).
    // Seçim ACT_CalisilanBirim_Sec ile kaydedilir, yetki yeniden hesaplanır ve sayfa yenilenir.
    var secenekler = null, secenekSoruldu = false;
    var calisilanSec = null, seritSeciliIndeks = 0, seritBilgi = {};
    var YENILE_ANAHTAR = "gh-calisilan-yenile";
    // Mendix kullanıcı rolleri oturum açılırken yüklenir. /calisilan-birim/ istek işleyicisi (JA_OturumYenileKaydet ile kaydedilir)
    // aynı kullanıcıya yeni oturum açıp çerezleri yazar: çıkış yapılmadan yeni rollerle devam edilir. İşleyici yoksa eski yöntem (çıkış).
    function oturumuYenile() {
        try { sessionStorage.removeItem(YENILE_ANAHTAR); } catch (e) { }
        var cikis = function () { if (window.mx && typeof mx.logout === "function") mx.logout(); else window.location.reload(); };
        fetch("/calisilan-birim/", { method: "GET", credentials: "same-origin", redirect: "manual", cache: "no-store" })
            .then(function (r) { if (r.type === "opaqueredirect" || r.status === 303 || r.status === 302) window.location.replace("/"); else cikis(); })
            .catch(cikis);
    }
    // Manuel Birim Tanımları'ndaki "Birim olarak çalış" düğmesi: işlem bitince oturum rolü yetkiyle uyuşmuyorsa oturum yenilenir.
    document.addEventListener("click", function (e) {
        if (e.target instanceof Element && e.target.closest(".gh-btn-signin")) {
            try { sessionStorage.setItem(YENILE_ANAHTAR, String(Date.now())); } catch (er) { }
            setTimeout(function () { yenile(true); }, 2500);
        }
    }, true);
    function oturumUyumsuzMu(rol) {
        var zaman = 0;
        try { zaman = Number(sessionStorage.getItem(YENILE_ANAHTAR)) || 0; } catch (e) { }
        if (!zaman) return false;
        if (Date.now() - zaman > 30000) {
            try { sessionStorage.removeItem(YENILE_ANAHTAR); } catch (e) { }
            return false;
        }
        if (!rol || !mx.session.getUserRoleNames) return false;
        return mx.session.getUserRoleNames().indexOf(rol) < 0;
    }
    function calisilanSecenekleriAl() {
        if (secenekSoruldu) return;
        secenekSoruldu = true;
        mx.data.action({
            params: { actionname: "GuvenlikYonetimi.DS_CalisilanBirim_Secenekler" },
            callback: function (liste) {
                // NPE nesneleri istemci önbelleğinden atılabildiği için düz veri olarak saklanır
                secenekler = (liste || []).map(function (o) { return { etiket: o.get("Etiket") || "", kod: String(o.get("Kod")), secili: !!o.get("Secili") }; });
                calisilanBirim();
            },
            error: function () { secenekler = []; }
        });
    }
    function calisilanBirim() {
        var wrap = document.querySelector(".layout-atlas .region-sidebar > .mx-scrollcontainer-wrapper");
        if (!wrap) return;
        if (secenekler === null) { calisilanSecenekleriAl(); return; }
        var kutu = wrap.querySelector(":scope > .gh-calisilan");
        if (secenekler.length < 2) { if (kutu) kutu.remove(); return; }
        if (kutu) return;
        // Prototipteki "Secim" bileşeninin karşılığı (fx-actbox): etiket + düğme + açılır liste
        kutu = el("div", "gh-calisilan");
        var etiket = el("span", "gh-calisilan-etiket");
        etiket.lang = "tr";
        etiket.textContent = "Çalışılan birim";
        var dugme = el("button", "gh-sec-dugme");
        dugme.type = "button";
        dugme.setAttribute("aria-haspopup", "listbox");
        dugme.setAttribute("aria-expanded", "false");
        var ikon = el("i", "ph ph-user-switch gh-sec-ikon");
        var yazi = el("span", "gh-sec-yazi");
        var ok = el("i", "ph ph-caret-down gh-sec-ok");
        dugme.appendChild(ikon); dugme.appendChild(yazi); dugme.appendChild(ok);
        var seciliIndeks = Math.max(0, secenekler.findIndex(function (o) { return o.secili; }));
        var secilenAyarla = function (i) {
            var o = secenekler[i];
            yazi.textContent = o ? o.etiket : "Seçin";
            dugme.title = yazi.textContent;
            yazi.classList.toggle("is-bos", !o);
        };
        secilenAyarla(seciliIndeks);

        var acik = null; // { pop, q, hi, liste }
        var kapat = function () {
            if (!acik) return;
            acik.pop.remove();
            acik = null;
            dugme.classList.remove("is-open");
            dugme.setAttribute("aria-expanded", "false");
            document.removeEventListener("mousedown", disTik, true);
            window.removeEventListener("scroll", kaydir, true);
            window.removeEventListener("resize", kapat);
        };
        var disTik = function (e) { if (acik && !dugme.contains(e.target) && !acik.pop.contains(e.target)) kapat(); };
        var kaydir = function (e) { if (acik && !acik.pop.contains(e.target)) kapat(); };
        var sec = function (i) {
            kapat();
            if (i === seciliIndeks) return;
            seritSeciliIndeks = i;
            var o = secenekler[i];
            if (!o) return;
            seciliIndeks = i;
            secilenAyarla(i);
            dugme.disabled = true;
            kutu.classList.add("is-busy");
            var hata = function (e) {
                dugme.disabled = false;
                kutu.classList.remove("is-busy");
                if (window.mx && mx.ui && mx.ui.error) mx.ui.error("Çalışılan birim değiştirilemedi: " + (e && e.message ? e.message : ""));
            };
            // seçenekler tazelenir, seçilen koddaki nesneyle işlem yapılır
            mx.data.action({ params: { actionname: "GuvenlikYonetimi.DS_CalisilanBirim_Secenekler" }, error: hata, callback: function (taze) {
            var hedef = (taze || []).filter(function (x) { return String(x.get("Kod")) === o.kod; })[0];
            if (!hedef) { hata({ message: "seçenek bulunamadı" }); return; }
            mx.data.action({
                params: { actionname: "GuvenlikYonetimi.ACT_CalisilanBirim_Sec", applyto: "selection", guids: [hedef.getGuid()] },
                // Mendix kullanıcı rolleri oturum açılırken yüklenir: yeni rolün geçmesi için oturum yenilenir (SSO'da otomatik yeniden giriş).
                callback: function () { oturumuYenile(); },
                error: hata
            });
            } });
        };
        var listeyiCiz = function () {
            var q = (acik.q || "").toLocaleLowerCase("tr");
            acik.liste = secenekler.map(function (o, i) { return { i: i, l: o.etiket }; })
                .filter(function (x) { return !q || x.l.toLocaleLowerCase("tr").indexOf(q) >= 0; });
            var kap = acik.pop.querySelector(".gh-sec-liste");
            kap.textContent = "";
            acik.liste.forEach(function (x, k) {
                var b = el("button", "gh-sec-oge");
                b.type = "button";
                b.setAttribute("role", "option");
                if (k === acik.hi) b.classList.add("is-hi");
                if (x.i === seciliIndeks) { b.classList.add("is-on"); b.setAttribute("aria-selected", "true"); }
                var s = el("span"); s.textContent = x.l;
                var c = el("i", "ph ph-check");
                b.appendChild(s); b.appendChild(c);
                b.addEventListener("click", function () { sec(x.i); });
                b.addEventListener("mouseenter", function () { if (acik.hi !== k) { acik.hi = k; listeyiCiz(); } });
                kap.appendChild(b);
            });
            if (!acik.liste.length) { var y = el("div", "gh-sec-yok"); y.textContent = "Sonuç yok"; kap.appendChild(y); }
        };
        var tus = function (e) {
            if (e.key === "Escape") { kapat(); dugme.focus(); return; }
            if (!acik && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) { e.preventDefault(); ac(); return; }
            if (!acik) return;
            if (e.key === "ArrowDown") { e.preventDefault(); acik.hi = Math.min(acik.liste.length - 1, acik.hi + 1); listeyiCiz(); }
            else if (e.key === "ArrowUp") { e.preventDefault(); acik.hi = Math.max(0, acik.hi - 1); listeyiCiz(); }
            else if (e.key === "Enter") { e.preventDefault(); if (acik.liste[acik.hi]) sec(acik.liste[acik.hi].i); }
        };
        var ac = function () {
            if (dugme.disabled) return;
            var r = dugme.getBoundingClientRect();
            var alt = window.innerHeight - r.bottom, yukari = alt < 300 && r.top > alt;
            var yer = Math.max(120, (yukari ? r.top : alt) - 12);
            var pop = el("div", "gh-sec-pop");
            pop.setAttribute("role", "listbox");
            pop.style.left = Math.min(r.left, window.innerWidth - Math.max(r.width, 180) - 8) + "px";
            pop.style.minWidth = r.width + "px";
            pop.style.maxHeight = yer + "px";
            if (yukari) pop.style.bottom = (window.innerHeight - r.top + 4) + "px"; else pop.style.top = (r.bottom + 4) + "px";
            var aranabilir = secenekler.length > 8;
            if (aranabilir) {
                var ara = el("div", "gh-sec-ara");
                ara.appendChild(el("i", "ph ph-magnifying-glass"));
                var inp = el("input", "gh-sec-ara-input");
                inp.placeholder = "Ara";
                inp.addEventListener("input", function () { acik.q = inp.value; acik.hi = 0; listeyiCiz(); });
                inp.addEventListener("keydown", tus);
                ara.appendChild(inp);
                pop.appendChild(ara);
            }
            var liste = el("div", "gh-sec-liste");
            liste.style.maxHeight = Math.max(60, Math.min(280, yer - 56)) + "px";
            pop.appendChild(liste);
            document.body.appendChild(pop);
            acik = { pop: pop, q: "", hi: Math.max(0, seciliIndeks), liste: [] };
            dugme.classList.add("is-open");
            dugme.setAttribute("aria-expanded", "true");
            listeyiCiz();
            if (aranabilir) pop.querySelector("input").focus();
            document.addEventListener("mousedown", disTik, true);
            window.addEventListener("scroll", kaydir, true);
            window.addEventListener("resize", kapat);
        };
        calisilanSec = sec;
        seritSeciliIndeks = seciliIndeks;
        dugme.addEventListener("click", function () { if (acik) kapat(); else ac(); });
        dugme.addEventListener("keydown", tus);
        kutu.appendChild(etiket);
        kutu.appendChild(dugme);
        var me = wrap.querySelector(":scope > .hs-me");
        wrap.insertBefore(kutu, me ? me.nextSibling : wrap.firstChild);
    }

    // ----- Birim modunda her sayfanın üstünde turuncu bilgilendirme şeridi (prototip: acting / bolgeBirim) -----
    function birimSeridi() {
        var kap = document.querySelector(".region-content > .mx-scrollcontainer-wrapper");
        var mevcut = document.querySelector(".gh-act-serit");
        var o = secenekler && secenekler.length > 1 ? secenekler[seritSeciliIndeks] : null;
        if (!kap || !o || seritSeciliIndeks === 0) { if (mevcut) mevcut.remove(); return; }
        var goMu = secenekler[0].etiket === "Güvenlik Ofisi";
        var anahtar = (goMu ? "go:" : "bolge:") + o.kod;
        if (mevcut && mevcut.getAttribute("data-k") === anahtar && mevcut.parentElement === kap && kap.firstElementChild === mevcut) return;
        if (goMu && !seritBilgi[o.kod]) {
            seritBilgi[o.kod] = { yukleniyor: true };
            mx.data.get({
                xpath: "//GuvenlikYonetimi.LocalDepartment[DepartmentID = " + o.kod + "]",
                filter: { amount: 1 },
                callback: function (l) {
                    var d = l && l[0];
                    seritBilgi[o.kod] = { kod: d ? (d.get("MisCode") || "") : "", yer: d ? [d.get("Il"), d.get("Ilce")].filter(Boolean).join(" / ") : "" };
                    var eski = document.querySelector(".gh-act-serit");
                    if (eski) eski.remove();
                    birimSeridi();
                },
                error: function () { seritBilgi[o.kod] = { kod: "", yer: "" }; var eski = document.querySelector(".gh-act-serit"); if (eski) eski.remove(); birimSeridi(); }
            });
        }
        if (mevcut) mevcut.remove();
        var s = el("div", "gh-act-serit");
        s.setAttribute("role", "status");
        s.setAttribute("data-k", anahtar);
        s.appendChild(el("i", "ph ph-user-switch gh-act-ikon"));
        var metin = el("span", "gh-act-metin");
        var g = function (t) { var b = el("strong"); b.textContent = t; return b; };
        var dugme = el("button", "btn gh-act-don");
        dugme.type = "button";
        dugme.appendChild(el("i", "ph ph-arrow-u-up-left"));
        if (goMu) {
            var bi = seritBilgi[o.kod] || {};
            metin.appendChild(g(o.etiket));
            metin.appendChild(document.createTextNode(" adına "));
            metin.appendChild(g("Birim rolüyle"));
            metin.appendChild(document.createTextNode(" çalışıyorsunuz. Bu birim manuel tanımlıdır; birim kullanıcısı işlemlerini Güvenlik Ofisi yapar. "));
            var ek = el("span", "gh-act-ek");
            ek.textContent = [bi.kod || "", bi.yer || "Manuel birim"].filter(Boolean).join(" · ");
            metin.appendChild(ek);
            dugme.appendChild(document.createTextNode("Güvenlik Ofisi görünümüne dön"));
        } else {
            metin.appendChild(g(o.etiket.replace(/ - Birim Kullanıcısı$/, "")));
            metin.appendChild(document.createTextNode(" adına "));
            metin.appendChild(g("Birim Kullanıcısı"));
            metin.appendChild(document.createTextNode(" olarak çalışıyorsunuz. Belge yükleme, güncelleme ve denetim kaydı gibi birim işlemlerini yapabilirsiniz."));
            dugme.appendChild(document.createTextNode("Üst Birim Kullanıcısına dön"));
        }
        dugme.addEventListener("click", function () { if (calisilanSec) calisilanSec(0); });
        s.appendChild(metin);
        s.appendChild(dugme);
        kap.insertBefore(s, kap.firstChild);
    }
    new MutationObserver(function () { if (secenekler && seritSeciliIndeks) birimSeridi(); }).observe(document.body, { childList: true, subtree: false });

    setInterval(function () {
        if (!hazir()) return;
        if (!bilgi) yenile(true);
        else arama();
        calisilanBirim();
        birimSeridi();
    }, 1500);
    setInterval(function () { yenile(true); }, 60000);
    document.addEventListener("click", function () { setTimeout(function () { yenile(false); }, 1500); }, true);
})();

// P43 Prototip: geniş menüde de menü öğesinin üstüne gelince ad balonu (kabuğun .hs-tip görünümü).
// Daraltılmış menüde balonu Halkbank_Shell kendisi gösterir; burada yalnızca geniş menü ele alınır.
(function () {
    var tip = null, cur = null, timer = 0;
    function mini() { return document.documentElement.classList.contains("hs-mini"); }
    function hide() { clearTimeout(timer); cur = null; if (tip) tip.classList.remove("hs-tip-on"); }
    document.addEventListener("mouseover", function (ev) {
        var t = ev.target instanceof Element ? ev.target.closest("html.hs-on .region-sidebar .mx-navigationtree a[data-hs-nav]") : null;
        if (t && (mini() || t.parentElement.classList.contains("mx-navigationtree-has-items"))) t = null;
        if (t === cur) return;
        hide();
        if (!t) return;
        var s = t.getAttribute("data-hs-cap") || (t.textContent || "").replace(/\s+/g, " ").trim();
        if (!s) return;
        cur = t;
        timer = setTimeout(function () {
            if (cur !== t || !document.body.contains(t) || mini()) return;
            if (!tip) {
                tip = document.createElement("div");
                tip.className = "hs-tip gh-nav-tip";
                tip.setAttribute("role", "tooltip");
                document.body.appendChild(tip);
            }
            tip.textContent = s;
            tip.classList.add("hs-tip-on");
            var r = t.getBoundingClientRect(), w = tip.getBoundingClientRect();
            tip.style.top = Math.max(6, r.top + r.height / 2 - w.height / 2) + "px";
            tip.style.left = Math.max(6, Math.min(r.right + 10, window.innerWidth - w.width - 6)) + "px";
        }, 350);
    }, true);
    document.addEventListener("mousedown", hide, true);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("blur", hide);
})();
