// P30 Şube seçici (prototip): şube açılır kutularının listesine arama kutusu, bölge çipleri, "Tüm şubeler" satırı,
// satırda şube kodu ve bölge, altta kısayol bilgisi eklenir. Seçim ve süzme Combo box'ın kendisinde kalır:
// arama kutusuna yazılan metin kutunun kendi girişine aktarılır, ok / Enter / Esc tuşları da oraya iletilir.
// Şube kodu ve bölge adı, istemcideki şube (Common_Unit) ve departman (Common_Department) kayıtlarından okunur.
(function () {
    var KUTULAR = ".gh-sube-git, .gh-al-sube, .gh-ty-sube, .gh-gc-sube, .gh-rp-sube, .gh-sube-degis";
    var bilgi = null; // şube adı → { kod, bolge }
    var bolgeler = []; // sıralı bölge adları
    var yukleniyor = false;
    var secilenBolge = {}; // kutu kimliği → seçili bölge çipi
    var kodAramasi = {}; // kutu kimliği → rakamla aranan şube kodu

    function al(xpath) {
        return new Promise(function (ok) {
            if (!window.mx || !mx.data || !mx.data.get) return ok([]);
            try {
                mx.data.get({ xpath: xpath, callback: function (o) { ok(o || []); }, error: function () { ok([]); } });
            } catch (e) { ok([]); }
        });
    }
    function kisaBolge(ad) {
        return (ad || "").replace(/\s*(Bölge Müdürlüğü|BÖLGE MÜDÜRLÜĞÜ|Bölge Koordinatörlüğü|BÖLGE KOORDİNATÖRLÜĞÜ)\s*$/, "").trim();
    }
    // Kurum modülü (Halkbank_LowCodeCommon) ya da geliştirme kopyası (LowCodeCommon): adlar çalışırken seçilir.
    // Şube sayılan birim türleri ve bölge türü kurum tanımına göre (ENUM_UnitKind / Common_Department.Kind).
    var SUBE_TURLERI = ["UYDUSB", "TICARI", "KURUMSAL", "YURTDISI", "KARMA", "SUBE"];
    // İlişki adları kayıtların kendisinden okunur (istemcide şema API'si yok)
    function adlar(mod, birimler, deptler) {
        var bul = function (nesneler, adaylar) {
            var ad = null;
            adaylar.forEach(function (a) { if (!ad && nesneler.some(function (o) { return o.has(mod + "." + a); })) ad = mod + "." + a; });
            return ad;
        };
        return {
            // birim ↔ departman (bire bir; iki taraftan da okunur)
            birimDept: bul(birimler.concat(deptler), ["Common_Unit_Common_Department", "Common_Department_Common_Unit"]),
            ust: bul(deptler, ["Child_Common_Department_Parent_Common_Department", "Common_Department_Parent"]),
        };
    }
    function yukle() {
        if (bilgi || yukleniyor) return;
        yukleniyor = true;
        // Var olmayan varlık sorgusu da boş liste döndüğü için kayıt dönen modül seçilir
        var mod = "Halkbank_LowCodeCommon";
        al("//" + mod + ".Common_Department").then(function (k) {
            if (!k.length) mod = "LowCodeCommon";
        }).then(function () {
            return al("//" + mod + ".Common_Department");
        }).then(function (deptler) {
            // P40: şube = departman (CategoryLVI 7/8/9), bölge = üst departmanlardan ilki CategoryLVI 6 ve TypeLVI 1 (Disiplin Etik ile aynı)
            var ustAd = adlar(mod, [], deptler).ust;
            var dep = {};
            deptler.forEach(function (d) { dep[d.getGuid()] = d; });
            var sayi = function (o, a) { return o && o.has(a) ? Number(o.get(a)) : NaN; };
            // Gerçek Halkbank verisi (Disiplin Etik): şube 9, uydu şube 11; IsBranch, Halkbank (FirmID 1), temsilcilik (FİNANS) hariç
            var subeMi = function (d) {
                var c = sayi(d, "CategoryLVI");
                // P67: Nakit Operasyon Merkezi (NOM) = CategoryLVI 10 ve TypeLVI 2 de birim sayılır
                // P70: Kambiyo Operasyon Merkezi (KOM) = CategoryLVI 8, TypeLVI 2 ve adında KOM; şube işaretli değil
                var kom = c === 8 && sayi(d, "TypeLVI") === 2 && /KOM/.test(String((d.has("Name") && d.get("Name")) || ""));
                if (!kom && c !== 9 && c !== 11 && !(c === 10 && sayi(d, "TypeLVI") === 2)) return false;
                if (!kom && d.has("IsBranch") && d.get("IsBranch") === false) return false;
                if (d.has("FirmID") && sayi(d, "FirmID") !== 1) return false;
                return !/^F[İI]NANS$/.test(String((d.has("Kind") && d.get("Kind")) || ""));
            };
            var bolgeMi = function (d) { return sayi(d, "CategoryLVI") === 6 && sayi(d, "TypeLVI") === 1; };
            var harita = {}, bolgeKod = {};
            deptler.forEach(function (d) {
                if (!subeMi(d) || (d.has("Status") && d.get("Status") === false)) return;
                var ust = ustAd && dep[d.get(ustAd)], adim = 0;
                while (ust && !bolgeMi(ust) && adim++ < 5) ust = dep[ust.get(ustAd)];
                var bolge = ust && bolgeMi(ust) ? kisaBolge(ust.get("Name")) : "";
                if (bolge) bolgeKod[bolge] = ust.get("MisCode") || "";
                harita[d.get("Name")] = { kod: d.get("MisCode") || "", bolge: bolge };
            });
            bolgeler = Object.keys(bolgeKod).sort(function (a, b) { return bolgeKod[a] < bolgeKod[b] ? -1 : 1; });
            bilgi = harita;
            yukleniyor = false;
            uygula();
        });
    }
    // P39 öncesi birim (Common_Unit) tabanlı yükleme; P40'tan beri kullanılmıyor
    function yukleBirim(mod) {
        Promise.all([al("//" + mod + ".Common_Unit"), al("//" + mod + ".Common_Department")]).then(function (s) {
            var A = adlar(mod, s[0], s[1]);
            var dep = {}, birimler = {}, birimDepti = {};
            s[1].forEach(function (d) { dep[d.getGuid()] = d; });
            s[0].forEach(function (u) { birimler[u.getGuid()] = u; });
            // ilişki hangi tarafta tutuluyorsa oradan eşle
            s[0].forEach(function (u) { var g = A.birimDept && u.has(A.birimDept) ? u.get(A.birimDept) : ""; if (g) birimDepti[u.getGuid()] = g; });
            var deptBirimi = {};
            s[1].forEach(function (d) { var g = A.birimDept && d.has(A.birimDept) ? d.get(A.birimDept) : ""; if (g) { deptBirimi[d.getGuid()] = g; birimDepti[g] = birimDepti[g] || d.getGuid(); } });
            Object.keys(birimDepti).forEach(function (b) { deptBirimi[birimDepti[b]] = deptBirimi[birimDepti[b]] || b; });
            var harita = {}, bolgeKod = {};
            // P39: tür birimde (ENUM_UnitKind) ya da departmanda (Kind metni) olabilir; Türkçe harfli yazım da kabul
            var tur = function (o) {
                return String((o && o.has("Kind") && o.get("Kind")) || "").toLocaleUpperCase("tr")
                    .replace(/İ/g, "I").replace(/Ş/g, "S").replace(/Ç/g, "C").replace(/Ğ/g, "G").replace(/Ü/g, "U").replace(/Ö/g, "O");
            };
            s[0].forEach(function (u) {
                var d = dep[birimDepti[u.getGuid()]];
                if (SUBE_TURLERI.indexOf(tur(u)) < 0 && SUBE_TURLERI.indexOf(tur(d)) < 0) return;
                var ust = d && A.ust && dep[d.get(A.ust)];
                var ustBirim = ust && birimler[deptBirimi[ust.getGuid()]];
                var bolge = ust && (tur(ust) === "SERBOLGE" || tur(ustBirim) === "SERBOLGE") ? kisaBolge(ust.get("Name")) : "";
                if (bolge) bolgeKod[bolge] = ust.get("MisCode") || "";
                harita[u.get("Name")] = { kod: u.get("MisCode") || "", bolge: bolge };
            });
            bolgeler = Object.keys(bolgeKod).sort(function (a, b) { return bolgeKod[a] < bolgeKod[b] ? -1 : 1; });
            bilgi = harita;
            yukleniyor = false;
            uygula();
        });
    }

    function girisiAyarla(giris, deger) {
        var ayarla = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        ayarla.call(giris, deger);
        giris.dispatchEvent(new Event("input", { bubbles: true }));
    }
    function el(etiket, sinif, metin) {
        var e = document.createElement(etiket);
        if (sinif) e.className = sinif;
        if (metin) e.textContent = metin;
        return e;
    }

    function basligiKur(kutu, liste) {
        var giris = kutu.querySelector(".widget-combobox-input");
        var anahtar = giris ? giris.id : "";
        var bas = el("li", "gh-ss-bas");
        bas.setAttribute("role", "presentation");
        var ara = el("div", "gh-ss-ara");
        var aramaGirisi = el("input", "gh-ss-giris");
        aramaGirisi.type = "text";
        aramaGirisi.placeholder = "Birim adı, kodu veya il";
        aramaGirisi.setAttribute("aria-label", "Birim ara");
        ara.appendChild(aramaGirisi);
        bas.appendChild(ara);
        var cipler = el("div", "gh-ss-cipler");
        ["Tümü"].concat(bolgeler).forEach(function (b) {
            var c = el("button", "gh-ss-cip", b);
            c.type = "button";
            c.setAttribute("data-bolge", b);
            c.addEventListener("mousedown", function (e) { e.preventDefault(); });
            c.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                secilenBolge[anahtar] = b === "Tümü" ? "" : b;
                uygula();
            });
            cipler.appendChild(c);
        });
        bas.appendChild(cipler);
        aramaGirisi.addEventListener("input", function () {
            if (giris) girisiAyarla(giris, aramaGirisi.value);
        });
        aramaGirisi.addEventListener("keydown", function (e) {
            if (!giris || ["ArrowDown", "ArrowUp", "Enter", "Escape", "Tab"].indexOf(e.key) < 0) return;
            e.preventDefault();
            giris.dispatchEvent(new KeyboardEvent("keydown", { key: e.key, code: e.code, keyCode: e.keyCode, which: e.keyCode, bubbles: true, cancelable: true }));
            if (e.key === "Escape" || e.key === "Enter") giris.focus();
        });
        liste.insertBefore(bas, liste.firstChild);

        // "Tüm şubeler": seçimi temizler (temizlenebilir kutularda)
        var tum = el("li", "gh-ss-tum");
        tum.setAttribute("role", "presentation");
        tum.appendChild(el("span", "gh-ss-tum-ad", "Tüm birimler"));
        tum.appendChild(el("span", "gh-ss-tum-sayi"));
        tum.addEventListener("mousedown", function (e) { e.preventDefault(); });
        tum.addEventListener("click", function (e) {
            e.preventDefault();
            var temizle = kutu.querySelector(".widget-combobox-clear-button");
            if (temizle) temizle.click();
            if (giris) {
                giris.focus();
                giris.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, which: 27, bubbles: true }));
            }
        });
        liste.insertBefore(tum, bas.nextSibling);

        var alt = el("li", "gh-ss-alt");
        alt.setAttribute("role", "presentation");
        alt.appendChild(el("span", "gh-ss-alt-sayi"));
        alt.appendChild(el("span", "gh-ss-alt-tus", "↑↓ gezin · Enter seç"));
        liste.appendChild(alt);
    }

    function uygula() {
        document.querySelectorAll(KUTULAR).forEach(function (sarici) {
            var kutu = sarici.querySelector(".widget-combobox");
            if (!kutu) return;
            var menu = kutu.querySelector(".widget-combobox-menu");
            var liste = menu && menu.querySelector(".widget-combobox-menu-list");
            if (!liste) return;
            if (!menu.classList.contains("gh-ss-menu")) menu.classList.add("gh-ss-menu");
            if (menu.classList.contains("widget-combobox-menu-hidden")) {
                // kapanınca arama ve çip sıfırlanır
                var g0 = liste.querySelector(".gh-ss-giris");
                if (g0 && g0.value) g0.value = "";
                var k0 = kutu.querySelector(".widget-combobox-input");
                if (k0) kodAramasi[k0.id] = "";
                return;
            }
            if (!bilgi) { yukle(); return; }
            if (!liste.querySelector(".gh-ss-bas")) basligiKur(kutu, liste);
            // Sağ kenardaki kutularda pencere ekrandan taşmasın: taşan kadar sola kaydır
            var onceki = parseFloat(menu.style.getPropertyValue("--gh-ss-kay")) || 0;
            var sag = menu.getBoundingClientRect().right - onceki;
            var kay = Math.min(0, document.documentElement.clientWidth - 16 - sag);
            if (kay !== onceki) menu.style.setProperty("--gh-ss-kay", kay + "px");
            // React yeni öğe eklerse alt bilgi en sonda kalsın
            var alt = liste.querySelector(".gh-ss-alt");
            if (alt && alt !== liste.lastElementChild) liste.appendChild(alt);

            var giris = kutu.querySelector(".widget-combobox-input");
            var anahtar = giris ? giris.id : "";
            var bolge = secilenBolge[anahtar] || "";
            var aramaGirisi = liste.querySelector(".gh-ss-giris");
            var kodQ = kodAramasi[anahtar] || "";
            if (giris && aramaGirisi && document.activeElement !== aramaGirisi && aramaGirisi.value !== giris.value) aramaGirisi.value = giris.value;
            liste.querySelectorAll(".gh-ss-cip").forEach(function (c) {
                var aktif = (c.getAttribute("data-bolge") === "Tümü" && !bolge) || c.getAttribute("data-bolge") === bolge;
                c.classList.toggle("is-active", aktif);
            });
            var suzgec = !!(bolge || kodQ);
            if (menu.classList.contains("gh-ss-suzgec") !== suzgec) menu.classList.toggle("gh-ss-suzgec", suzgec);
            var gorunen = 0;
            liste.querySelectorAll(".widget-combobox-item").forEach(function (li) {
                var yazi = li.querySelector(".widget-combobox-caption-text");
                var ad = yazi ? yazi.textContent.trim() : "";
                var kodlu = /^(\d{3,5})\s*·\s*(.+)$/.exec(ad);
                var b = bilgi[kodlu ? kodlu[2] : ad] || {};
                var kod = kodlu ? "" : b.kod || "";
                if (li.getAttribute("data-kod") !== kod) li.setAttribute("data-kod", kod);
                if (li.getAttribute("data-bolge") !== (b.bolge || "")) li.setAttribute("data-bolge", b.bolge || "");
                var tamKod = kodlu ? kodlu[1] : b.kod || "";
                var gizli = (!!bolge && b.bolge !== bolge) || (!!kodQ && tamKod.indexOf(kodQ) !== 0);
                if (gizli) li.setAttribute("data-gh-gizli", "");
                else { li.removeAttribute("data-gh-gizli"); gorunen++; }
                if ((gizli || !suzgec) && li.hasAttribute("data-gh-vurgu")) li.removeAttribute("data-gh-vurgu");
            });
            var sayi = gorunen.toLocaleString("tr-TR") + " birim";
            var ts = liste.querySelector(".gh-ss-tum-sayi");
            if (ts && ts.textContent !== sayi) ts.textContent = sayi;
            var as = liste.querySelector(".gh-ss-alt-sayi");
            var asMetin = sayi + " · yazarak arayın";
            if (as && as.textContent !== asMetin) as.textContent = asMetin;
            var tum = liste.querySelector(".gh-ss-tum");
            if (tum) tum.hidden = !kutu.querySelector(".widget-combobox-clear-button") && !sarici.querySelector(".widget-combobox-placeholder-empty");
        });
    }

    // ------------------------------------------------------------------------------------------------
    // Diğer tüm açılır kutular (prototip sade liste): filtre kutularında en üstte "Tümü" satırı (kutunun boş metni,
    // seçimi temizler), seçili satırda tik, 8'den çok seçenekte arama kutusu; bölge adları kısa ("Ankara Bölge
    // Müdürlüğü" → "Ankara"). Tetikleyici genişliği listenin en küçük genişliği olur.
    var bosMetin = {}; // kutu kimliği → boşken görünen metin ("Tüm bölgeler")
    function kisalt(kok) {
        kok.querySelectorAll(".widget-combobox-caption-text").forEach(function (s) {
            var t = s.textContent;
            if (/\sBölge Müdürlüğü\s*$/.test(t)) s.textContent = kisaBolge(t);
        });
    }
    function genel() {
        document.querySelectorAll(".widget-combobox").forEach(function (kutu) {
            if (kutu.closest(KUTULAR)) return;
            var giris = kutu.querySelector(".widget-combobox-input");
            var anahtar = giris ? giris.id : "";
            var bos = kutu.querySelector(".widget-combobox-placeholder-empty .widget-combobox-caption-text");
            if (bos && anahtar && bos.textContent.trim()) bosMetin[anahtar] = bos.textContent.trim();
            var tetik = kutu.querySelector(".widget-combobox-input-container");
            if (tetik) kisalt(tetik);
            var menu = kutu.querySelector(".widget-combobox-menu");
            var liste = menu && menu.querySelector(".widget-combobox-menu-list");
            if (!liste) return;
            if (!menu.classList.contains("gh-sl-menu")) menu.classList.add("gh-sl-menu");
            // Liste açıkken kutu seçili değerin uzun adını gösterir; yazılmadıysa kısa adı göster
            var uzun = !!giris && !menu.classList.contains("widget-combobox-menu-hidden") && /\sBölge Müdürlüğü\s*$/.test(giris.value);
            if (kutu.classList.contains("gh-sl-kisa") !== uzun) kutu.classList.toggle("gh-sl-kisa", uzun);
            if (menu.classList.contains("widget-combobox-menu-hidden")) {
                var g0 = liste.querySelector(".gh-ss-giris");
                if (g0 && g0.value) g0.value = "";
                return;
            }
            var gw = tetik ? Math.round(tetik.getBoundingClientRect().width) + "px" : "";
            if (gw && menu.style.getPropertyValue("--gh-tetik") !== gw) menu.style.setProperty("--gh-tetik", gw);
            kisalt(liste);
            var ogeler = [].slice.call(liste.querySelectorAll(".widget-combobox-item"));
            var filtrede = !!kutu.closest(".gh-filter-select, .gh-filter-bar, .gh-atama-bolge, .gh-rp-bar");
            var tumMetin = bosMetin[anahtar] || "";
            var ilk = ogeler[0] && ogeler[0].textContent.trim();
            // "Tümü" satırı: yalnız filtrelerde, kutunun boş metni bir seçenek değilse
            var tum = liste.querySelector(".gh-sl-tum");
            var tumGerek = filtrede && tumMetin && ilk !== tumMetin && !ogeler.some(function (li) { return li.textContent.trim() === tumMetin; });
            if (tumGerek && !tum) {
                tum = el("li", "gh-sl-tum");
                tum.setAttribute("role", "presentation");
                tum.addEventListener("mousedown", function (e) { e.preventDefault(); });
                tum.addEventListener("click", function (e) {
                    e.preventDefault();
                    var temizle = kutu.querySelector(".widget-combobox-clear-button");
                    if (temizle) temizle.click();
                    if (giris) {
                        giris.focus();
                        giris.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, which: 27, bubbles: true }));
                    }
                });
                liste.insertBefore(tum, liste.firstChild);
            }
            if (tum) {
                tum.hidden = !tumGerek;
                if (tum.textContent !== tumMetin) tum.textContent = tumMetin;
                var bosMu = !!kutu.querySelector(".widget-combobox-placeholder-empty");
                if (tum.classList.contains("is-secili") !== bosMu) tum.classList.toggle("is-secili", bosMu);
            }
            // Arama: çok seçenekte (kutunun kendi aramasına aktarılır)
            if (ogeler.length > 8 && !liste.querySelector(".gh-sl-ara")) {
                var ara = el("li", "gh-sl-ara gh-ss-ara");
                ara.setAttribute("role", "presentation");
                var ag = el("input", "gh-ss-giris");
                ag.type = "text";
                ag.placeholder = "Ara";
                ag.setAttribute("aria-label", "Ara");
                ag.addEventListener("input", function () { if (giris) girisiAyarla(giris, ag.value); });
                ag.addEventListener("keydown", function (e) {
                    if (!giris || ["ArrowDown", "ArrowUp", "Enter", "Escape", "Tab"].indexOf(e.key) < 0) return;
                    e.preventDefault();
                    giris.dispatchEvent(new KeyboardEvent("keydown", { key: e.key, code: e.code, keyCode: e.keyCode, which: e.keyCode, bubbles: true, cancelable: true }));
                });
                ara.appendChild(ag);
                liste.insertBefore(ara, liste.firstChild);
            }
            var araG = liste.querySelector(".gh-sl-ara .gh-ss-giris");
            if (araG && giris && document.activeElement !== araG && araG.value !== giris.value) araG.value = giris.value;
        });
    }

    // Rakamla arama: şube koduna göre listede süzülür. Kutunun kendi araması yalnız şube adına baktığı için
    // rakamlı giriş kutuya (React) iletilmez; boşalınca ya da harf girilince normal arama sürer.
    window.addEventListener("input", function (e) {
        var g = e.target;
        if (!g.classList || !g.classList.contains("widget-combobox-input") || !g.closest(KUTULAR)) return;
        var q = g.value.trim();
        kodAramasi[g.id] = /^\d+$/.test(q) ? q : "";
        if (kodAramasi[g.id]) {
            e.stopImmediatePropagation();
            uygula();
        }
    }, true);

    // Bölge çipi ya da kod araması varken kutunun kendi vurgusu gizli satırlara da gider: ok / Enter görünen satırlarda yürütülür
    window.addEventListener("keydown", function (e) {
        var g = e.target;
        if (["ArrowDown", "ArrowUp", "Enter"].indexOf(e.key) < 0 || !g.classList || !g.classList.contains("widget-combobox-input")) return;
        var sarici = g.closest(KUTULAR);
        if (!sarici || (!secilenBolge[g.id] && !kodAramasi[g.id])) return;
        var menu = sarici.querySelector(".gh-ss-menu");
        if (!menu || menu.classList.contains("widget-combobox-menu-hidden")) return;
        var satirlar = [].filter.call(menu.querySelectorAll(".widget-combobox-item"), function (li) { return !li.hasAttribute("data-gh-gizli") && li.querySelector(".widget-combobox-caption-text"); });
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!satirlar.length) return;
        var i = satirlar.findIndex(function (li) { return li.hasAttribute("data-gh-vurgu"); });
        if (e.key === "Enter") {
            (satirlar[i < 0 ? 0 : i]).click();
            return;
        }
        var j = i < 0 ? 0 : (i + (e.key === "ArrowDown" ? 1 : -1) + satirlar.length) % satirlar.length;
        satirlar.forEach(function (li, k) { if (k === j) li.setAttribute("data-gh-vurgu", ""); else li.removeAttribute("data-gh-vurgu"); });
        satirlar[j].scrollIntoView({ block: "nearest" });
    }, true);

    var bekleyen = null;
    new MutationObserver(function () {
        if (bekleyen) return;
        bekleyen = setTimeout(function () { bekleyen = null; uygula(); genel(); }, 30);
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
})();
