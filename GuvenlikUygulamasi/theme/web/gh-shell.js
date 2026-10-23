// Kabuk (prototip analiz.html ile aynı): üst çubukta arama + karanlık mod düğmesi + kullanıcı kartı, menüde sayı rozetleri ve "Menüyü daralt".
// Bilgiler GuvenlikYonetimi.SUB_Kabuk_Bilgi'den gelir: "AdSoyad|RolAdi|BirimMetni|AktifAlarm|OnayBekleyenTalep|RolKodu".
// Mendix layout'u model API'sinden düzenlenemediği için öğeler oturum açıkken istemci tarafında eklenir (bkz. gh-bell.js).
(function () {
    var MF_BILGI = "GuvenlikYonetimi.SUB_Kabuk_Bilgi";
    var MF_BELGE = "GuvenlikYonetimi.ACT_SubeBelgeleri_Ac";
    var bilgi = null, sonSorgu = 0;
    function hazir() {
        return window.mx && mx.session && mx.data && typeof mx.data.action === "function" && !(mx.session.isGuest && mx.session.isGuest());
    }
    function depo(k, v) {
        try {
            if (v === undefined) return window.localStorage.getItem(k);
            window.localStorage.setItem(k, v);
        } catch (e) {}
        return null;
    }
    function basHarf(ad) {
        var p = String(ad || "").trim().split(/\s+/).filter(Boolean);
        if (!p.length) return "";
        var s = p[0].charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : "");
        return s.toLocaleUpperCase("tr-TR");
    }
    function el(tag, cls, html) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html !== undefined) e.innerHTML = html;
        return e;
    }

    // ----- Tema (prototip: html[data-theme]; tercih tarayıcıda saklanır) -----
    function temaUygula(t) {
        document.documentElement.setAttribute("data-theme", t === "dark" ? "dark" : "light");
    }
    function temaDugmesi(b) {
        var koyu = document.documentElement.getAttribute("data-theme") === "dark";
        b.title = koyu ? "Aydınlık moda geç" : "Karanlık moda geç";
        b.setAttribute("aria-label", b.title);
    }

    // ----- Üst çubuk -----
    function aramaYap(metin) {
        metin = String(metin || "").trim();
        if (!metin) return;
        mx.data.action({ params: { actionname: MF_BELGE }, callback: function () {}, error: function () {} });
        var deneme = 0;
        var t = setInterval(function () {
            deneme++;
            var inp = document.querySelector(".gh-filter-bar input[placeholder='Şube adı veya kodu']");
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
    function ustCubuk() {
        var bar = document.querySelector(".region-topbar .topbar-content");
        if (!bar) return;
        var marka = bar.querySelector(":scope > .mx-layoutgrid");
        var logo = bar.querySelector(".navbar-brand .mx-image-viewer");
        if (logo && !logo.querySelector(".gh-brand")) {
            logo.appendChild(el("span", "gh-brand", '<span class="gh-brand-t">Güvenlik Hizmetleri</span><span class="gh-brand-s">Halkbank · Kurumsal Uygulama</span>'));
        }
        var ara = bar.querySelector(".gh-tb-search");
        if (!ara) {
            ara = el("div", "gh-tb-search");
            var inp = el("input");
            inp.type = "search";
            inp.placeholder = "Şube adı veya kodu ara…";
            inp.setAttribute("aria-label", "Şube ara");
            inp.addEventListener("keydown", function (e) {
                if (e.key === "Enter") {
                    aramaYap(inp.value);
                    inp.value = "";
                    inp.blur();
                }
            });
            ara.appendChild(inp);
        }
        var bosluk = bar.querySelector(".gh-tb-spacer") || el("div", "gh-tb-spacer");
        var tema = bar.querySelector(".gh-tb-theme");
        if (!tema) {
            tema = el("button", "gh-tb-theme");
            tema.type = "button";
            tema.addEventListener("click", function () {
                var t = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
                temaUygula(t);
                depo("gh-tema", t);
                temaDugmesi(tema);
            });
            temaDugmesi(tema);
        }
        var kart = bar.querySelector(".gh-tb-user");
        if (!kart) {
            kart = el("div", "gh-tb-user", '<span class="gh-tb-av"></span><span class="gh-tb-who"><span class="gh-tb-ad"></span><span class="gh-tb-rol"></span></span>');
        }
        // Sıra: marka · arama · boşluk · tema · zil · kullanıcı
        var sonra = marka ? marka.nextSibling : bar.firstChild;
        if (ara.previousSibling !== marka) bar.insertBefore(ara, sonra);
        if (bosluk.previousSibling !== ara) bar.insertBefore(bosluk, ara.nextSibling);
        if (tema.previousSibling !== bosluk) bar.insertBefore(tema, bosluk.nextSibling);
        if (bar.lastElementChild !== kart) bar.appendChild(kart);
        var rol = bilgi ? bilgi.rol : "";
        ara.hidden = rol === "SubeKullanicisi" || rol === "GuvenlikPersoneli";
        if (bilgi) {
            kart.querySelector(".gh-tb-av").textContent = basHarf(bilgi.ad);
            kart.querySelector(".gh-tb-ad").textContent = bilgi.ad;
            var alt = bilgi.rolAdi + (bilgi.birim ? " · " + bilgi.birim : "");
            kart.querySelector(".gh-tb-rol").textContent = alt;
            kart.title = bilgi.ad + " · " + alt;
        }
    }

    // ----- Menü -----
    function rozet(sinif, n) {
        var a = document.querySelector(".region-sidebar a." + sinif);
        if (!a) return;
        var s = a.querySelector(".gh-nav-n");
        if (!s) {
            s = el("span", "gh-nav-n");
            a.appendChild(s);
        }
        s.textContent = n > 99 ? "99+" : String(n);
        s.hidden = !(n > 0);
    }
    function menu() {
        var w = document.querySelector(".region-sidebar > .mx-scrollcontainer-wrapper");
        if (!w) return;
        if (!w.querySelector(".gh-nav-collapse")) {
            var b = el("button", "gh-nav-collapse");
            b.type = "button";
            b.addEventListener("click", function () {
                var mini = !document.documentElement.classList.contains("gh-nav-mini");
                document.documentElement.classList.toggle("gh-nav-mini", mini);
                depo("gh-nav-mini", mini ? "1" : "0");
                etiket(b);
            });
            w.appendChild(b);
            etiket(b);
        }
        // Daraltılmış menüde adlar ipucu olarak görünsün
        w.querySelectorAll(".mx-navigationtree a").forEach(function (a) {
            if (!a.title) a.title = (a.textContent || "").trim();
        });
        // "Yönetim / Parametreler" prototipteki gibi açık gelir; kullanıcı kapatırsa kapalı kalır
        var yonetim = w.querySelector("a.mx-name-navigationTree3-12");
        if (yonetim && !yonetim.ghDinle) {
            yonetim.ghDinle = true;
            yonetim.addEventListener("click", function (e) {
                if (!e.isTrusted) return;
                setTimeout(function () {
                    var kapali = yonetim.parentElement.classList.contains("mx-navigationtree-collapsed");
                    depo("gh-nav-yonetim-kapali", kapali ? "1" : "0");
                }, 50);
            });
        }
        if (yonetim && yonetim.parentElement.classList.contains("mx-navigationtree-collapsed") && depo("gh-nav-yonetim-kapali") !== "1") {
            yonetim.click();
        }
        if (bilgi) {
            rozet("mx-name-navigationTree3-2", bilgi.alarm);
            rozet("mx-name-navigationTree3-4", bilgi.talep);
        }
    }
    function etiket(b) {
        var mini = document.documentElement.classList.contains("gh-nav-mini");
        b.textContent = mini ? "Menüyü genişlet" : "Menüyü daralt";
        b.title = b.textContent;
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
                ustCubuk();
                menu();
                personelYonlendir();
            },
            error: function () {
                // Uygulama rolü olmayan kullanıcı (ör. yönetici): yalnız oturum adı
                var ad = mx.session.getUserName ? mx.session.getUserName() : "";
                bilgi = { ad: ad, rolAdi: "Yönetici", birim: "", alarm: 0, talep: 0, rol: "" };
                ustCubuk();
                menu();
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
        document.querySelectorAll(".widget-datagrid .td").forEach(function (td) {
            var bos = !(td.textContent || "").replace(/ /g, " ").trim() &&
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

    if (depo("gh-nav-mini") === "1") document.documentElement.classList.add("gh-nav-mini");
    temaUygula(depo("gh-tema"));
    setInterval(function () {
        if (!hazir()) return;
        ustCubuk();
        menu();
        if (!bilgi) yenile(true);
    }, 1500);
    setInterval(function () { yenile(true); }, 60000);
    document.addEventListener("click", function () { setTimeout(function () { yenile(false); }, 1500); }, true);
})();
