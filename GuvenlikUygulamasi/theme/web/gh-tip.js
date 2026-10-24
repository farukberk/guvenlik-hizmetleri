// Grafik ipuçları: grafik öğesinin üstüne gelince (dokunmatikte dokununca) küçük baloncukta neye karşılık geldiği gösterilir.
// Bilgi sayfadaki etiket / sayı / açıklama metinlerinden okunur; modelde ek alan gerekmez.
// Dilim yüzdeleri 5'in katına yuvarlı sınıflardan gelir: toplam 20'nin altındaysa adet kesin hesaplanır, değilse yüzde gösterilir.
(function () {
    var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    var HEDEF = ".gh-ring, .gh-tb-col, .gh-as-col, .gh-as-ay, .gh-top-row, .gh-bolge-row:not(.gh-thead), .gh-bar-cell, .gh-bar, .gh-atama-bar";

    function yazi(e) { return e ? (e.textContent || "").replace(/\s+/g, " ").trim() : ""; }
    // Birden çok metin parçası (ör. "Ankara" + "4 şube") " · " ile ayrılır
    function parcali(e) {
        if (!e) return "";
        var p = [].slice.call(e.querySelectorAll("*")).filter(function (x) { return !x.childElementCount && yazi(x); }).map(yazi);
        return p.length > 1 ? p.join(" · ") : yazi(e);
    }
    function sinifSayi(e, on) {
        var m = e && String(e.className).match(new RegExp("\\b" + on + "(\\d+)\\b"));
        return m ? Number(m[1]) : 0;
    }
    function kartBasligi(e) {
        var k = e.closest(".gh-card");
        return k ? yazi(k.querySelector(".gh-card-title")) : "";
    }
    function renk(e) {
        var c = e ? getComputedStyle(e).backgroundColor : "";
        return c && c !== "rgba(0, 0, 0, 0)" ? c : "";
    }
    // Dilim yükseklik sınıfları (gh-sg-*, gh-ah-*) sütun içi pay ya da grafiğin en büyük sütununa göre ölçekli olabilir:
    // her dilim sütundaki dilimlerin toplamına oranlanır. Toplam 20'nin altındayken adet "en büyük kalan" ile yuvarlanır
    // (adetlerin toplamı sütun sayısına eşit kalır), değilse sütun içi yüzde gösterilir.
    function dilimDegerleri(n, paylar) {
        var top = paylar.reduce(function (t, p) { return t + p; }, 0);
        if (!top) return paylar.map(function () { return "0"; });
        if (!(n > 0 && n < 20)) return paylar.map(function (p) { return "%" + Math.round((p * 100) / top); });
        var ham = paylar.map(function (p) { return (n * p) / top; });
        var adet = ham.map(Math.floor);
        var kalan = n - adet.reduce(function (t, a) { return t + a; }, 0);
        ham.map(function (h, i) { return { i: i, k: h - adet[i] }; }).sort(function (a, b) { return b.k - a.k; })
            .slice(0, kalan).forEach(function (x) { adet[x.i]++; });
        return adet.map(String);
    }
    // Liste içindeki sıra → ay / yıl (son sütun = bitiş ayı)
    function ayBul(sutun, liste, bitis) {
        var lis = [].slice.call(liste.querySelectorAll(":scope > ul > li"));
        var li = sutun.closest("li");
        var i = lis.indexOf(li);
        if (!bitis || i < 0) return null;
        var geri = lis.length - 1 - i;
        var ay = bitis.ay - geri, yil = bitis.yil;
        while (ay < 0) { ay += 12; yil--; }
        return AYLAR[ay] + " " + yil;
    }
    function bitisAyi(kok) {
        var m = yazi(kok).match(/(\d{2})\.(\d{2})\.(\d{4})\s*[–-]\s*(\d{2})\.(\d{2})\.(\d{4})/);
        if (m) return { ay: Number(m[5]) - 1, yil: Number(m[6]) };
        var r = new RegExp("(" + AYLAR.join("|") + ")\\s+(\\d{4})\\s*[–-]\\s*(" + AYLAR.join("|") + ")\\s+(\\d{4})");
        var t = yazi(kok).match(r);
        if (t) return { ay: AYLAR.indexOf(t[3]), yil: Number(t[4]) };
        return null;
    }

    // ----- Grafik türlerine göre içerik: { baslik, alt, satirlar: [{ad, deger, renk, vurgu}], not }
    function halka(h, x, y) {
        var o = sinifSayi(h, "gh-ring-o-"), m = sinifSayi(h, "gh-ring-m-"), r = sinifSayi(h, "gh-ring-r-");
        var b = h.getBoundingClientRect();
        var aci = (Math.atan2(x - (b.left + b.width / 2), -(y - (b.top + b.height / 2))) * 180) / Math.PI;
        var p = ((aci + 360) % 360) / 3.6;
        var dilim = p < o ? 0 : p < o + m ? 1 : p < o + m + r ? 2 : 3;
        var kart = h.closest(".gh-card");
        var satirlar = [].slice.call(kart ? kart.querySelectorAll(".gh-res-row") : []).map(function (s, i) {
            return { ad: yazi(s.children[1]), deger: yazi(s.querySelector(".gh-res-n")) + " · " + yazi(s.querySelector(".gh-res-p")),
                renk: renk(s.querySelector(".gh-lg-dot")), vurgu: i === dilim };
        });
        var secili = satirlar[dilim];
        return { baslik: secili ? secili.ad : kartBasligi(h), alt: secili ? secili.deger.replace(" · ", " denetim · ") : "", satirlar: satirlar, not: kartBasligi(h) };
    }
    function yiginSutun(col, hedef) {
        // Denetim: aylık yığılmış sütun (olumlu / eksiklik / rapor bekleniyor)
        var n = Number(yazi(col.querySelector(".gh-tb-n"))) || 0;
        var liste = col.closest(".gh-tb-list");
        var ay = liste ? ayBul(col, liste, bitisAyi(document.querySelector(".region-content .gh-dbar-range"))) : null;
        var adlar = { "gh-seg-ok": "Olumlu", "gh-seg-miss": "Eksiklik tespit edildi", "gh-seg-rep": "Rapor bekleniyor" };
        var dilim = ["gh-seg-ok", "gh-seg-miss", "gh-seg-rep"].map(function (k) {
            var s = col.querySelector("." + k);
            return { ad: adlar[k], s: s, pay: sinifSayi(s, "gh-sg-"), vurgu: !!(s && hedef && hedef.closest("." + k) === s) };
        }).filter(function (d) { return d.s && d.pay > 0; });
        var degerler = dilimDegerleri(n, dilim.map(function (d) { return d.pay; }));
        var satirlar = dilim.map(function (d, i) { return { ad: d.ad, deger: degerler[i], renk: renk(d.s), vurgu: d.vurgu }; });
        return { baslik: ay || yazi(col.querySelector(".gh-tb-label")), alt: n ? n + " denetim" : "Denetim yok", satirlar: satirlar, not: kartBasligi(col) };
    }
    function alarmSutun(col, hedef) {
        var n = Number(yazi(col.querySelector(".gh-as-col-n"))) || 0;
        var kart = col.closest(".gh-card");
        var ad = function (k, yedek) {
            var d = kart && kart.querySelector(".gh-as-lg-" + k);
            return d ? yazi(d.parentElement) || yedek : yedek;
        };
        var dilim = [["k", "Kritik / geçmiş"], ["y", "Yaklaşıyor"]].map(function (p) {
            var s = col.querySelector(".gh-as-seg-" + p[0]);
            return { ad: ad(p[0], p[1]), s: s, pay: sinifSayi(s, "gh-ah-"), vurgu: !!s && hedef === s };
        }).filter(function (d) { return d.s && d.pay > 0; });
        var degerler = dilimDegerleri(n, dilim.map(function (d) { return d.pay; }));
        var satirlar = dilim.map(function (d, i) { return { ad: d.ad, deger: degerler[i], renk: renk(d.s), vurgu: d.vurgu }; });
        return { baslik: yazi(col.querySelector(".gh-as-col-l")), alt: n + " açık alarm", satirlar: satirlar, not: kartBasligi(col) };
    }
    function aySutun(col) {
        var n = yazi(col.querySelector(".gh-as-ay-n"));
        var liste = col.closest(".gh-as-aylar");
        var kart = col.closest(".gh-card");
        var ay = liste ? ayBul(col, liste, bitisAyi(kart && kart.querySelector(".gh-as-card-sub"))) : null;
        var bolum = col.closest(".gh-as-den-sec");
        return { baslik: ay || yazi(col.querySelector(".gh-as-ay-l")), alt: (n || "0") + " denetim", satirlar: [], not: bolum ? yazi(bolum.querySelector(".gh-as-sec")) : kartBasligi(col) };
    }
    function cubukSatir(row) {
        return { baslik: yazi(row.querySelector(".gh-top-l")) || yazi(row.firstElementChild), alt: kartBasligi(row) + ": " + yazi(row.querySelector(".gh-top-p")), satirlar: [], not: "" };
    }
    // Başlıklı satır (bölge tablosu, data grid): başlık adlarıyla hücre değerleri
    function basliklarla(row, basliklar, hucreler) {
        var baslik = "", satirlar = [];
        hucreler.forEach(function (h, i) {
            if (!h.offsetParent) return;
            var d = parcali(h);
            var b = basliklar[i] || "";
            if (!d) return;
            if (!baslik && /[A-Za-zÇĞİÖŞÜçğıöşü]{3}/.test(d) && !/^%/.test(d)) { baslik = d; return; }
            if (b) satirlar.push({ ad: b, deger: d });
        });
        return { baslik: baslik, alt: "", satirlar: satirlar, not: kartBasligi(row) };
    }
    function bolgeSatir(row) {
        var kart = row.closest(".gh-card");
        var bas = kart ? [].slice.call(kart.querySelectorAll(".gh-thead > *")).map(yazi) : [];
        return basliklarla(row, bas, [].slice.call(row.children));
    }
    function gridSatir(tr) {
        var grid = tr.closest(".widget-datagrid");
        var ilk = grid && grid.querySelector(".th");
        var bas = ilk ? [].slice.call(ilk.closest(".tr").children).map(function (t) {
            return yazi(t.querySelector(".column-header > span")); // textContent: büyük harf yalnız CSS ile
        }) : [];
        return basliklarla(tr, bas, [].slice.call(tr.children));
    }
    function icerik(h, hedef, x, y) {
        if (h.matches(".gh-ring")) return halka(h, x, y);
        if (h.matches(".gh-tb-col")) return yiginSutun(h, hedef);
        if (h.matches(".gh-as-col")) return alarmSutun(h, hedef);
        if (h.matches(".gh-as-ay")) return aySutun(h);
        if (h.matches(".gh-top-row")) return cubukSatir(h);
        if (h.matches(".gh-bolge-row")) return bolgeSatir(h);
        var tr = h.closest(".widget-datagrid .tr");
        if (tr) return gridSatir(tr);
        return cubukGenel(h);
    }
    // Etiketli çubuk (ör. Denetim türü: etiket + sayı + çubuk): çubuğun dışındaki en yakın metinler etiket ve değerdir
    function cubukGenel(bar) {
        var kap = bar.parentElement;
        while (kap && !kap.matches(".gh-card, .region-content")) {
            var metinler = [].slice.call(kap.querySelectorAll("*")).filter(function (x) {
                return !x.childElementCount && yazi(x) && !bar.contains(x);
            }).map(yazi);
            if (metinler.length) {
                var sayisal = function (m) { return /^[%\d]/.test(m); };
                var deger = metinler.filter(sayisal).join(" · ");
                var etiket = metinler.filter(function (m) { return !sayisal(m); })[0] || "";
                return { baslik: etiket || deger, alt: etiket ? deger : "", satirlar: [], not: kartBasligi(bar) };
            }
            kap = kap.parentElement;
        }
        return null;
    }

    // ----- Baloncuk
    var balon = null, aktif = null;
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function goster(v, x, y) {
        if (!v || !v.baslik) return gizle();
        if (!balon) {
            balon = document.createElement("div");
            balon.className = "gh-tip";
            balon.setAttribute("role", "tooltip");
            document.body.appendChild(balon);
        }
        var html = '<div class="gh-tip-t">' + esc(v.baslik) + "</div>";
        if (v.alt) html += '<div class="gh-tip-s">' + esc(v.alt) + "</div>";
        if (v.satirlar.length) {
            html += '<div class="gh-tip-rows">' + v.satirlar.map(function (s) {
                return '<div class="gh-tip-r' + (s.vurgu ? " is-on" : "") + '">' + (s.renk ? '<i style="background:' + esc(s.renk) + '"></i>' : "") +
                    "<span>" + esc(s.ad) + "</span><b>" + esc(s.deger) + "</b></div>";
            }).join("") + "</div>";
        }
        if (v.not && v.not !== v.baslik) html += '<div class="gh-tip-n">' + esc(v.not) + "</div>";
        if (balon.innerHTML !== html) balon.innerHTML = html;
        balon.classList.add("is-on");
        var b = balon.getBoundingClientRect(), g = window.innerWidth, yk = window.innerHeight;
        var lx = Math.min(Math.max(8, x - b.width / 2), g - b.width - 8);
        var ly = y - b.height - 14;
        balon.classList.toggle("is-alt", ly < 8);
        if (ly < 8) ly = Math.min(y + 18, yk - b.height - 8);
        balon.style.transform = "translate(" + Math.round(lx) + "px," + Math.round(ly) + "px)";
        balon.style.setProperty("--ok", Math.round(Math.min(Math.max(12, x - lx), b.width - 12)) + "px");
    }
    function gizle() {
        if (balon) balon.classList.remove("is-on");
        if (aktif) aktif.classList.remove("gh-tip-on");
        aktif = null;
    }
    function hedefBul(t) {
        var h = t && t.closest ? t.closest(HEDEF) : null;
        if (!h || !h.closest(".region-content, .modal-dialog")) return null;
        // Çubuk hücresi bir satırın içindeyse satır grafiği öncelikli
        var ust = h.parentElement && h.parentElement.closest(".gh-tb-col, .gh-as-col, .gh-top-row, .gh-bolge-row");
        return ust || h;
    }
    function izle(e) {
        var h = hedefBul(e.target);
        if (!h) return gizle();
        if (aktif !== h) {
            if (aktif) aktif.classList.remove("gh-tip-on");
            aktif = h;
            h.classList.add("gh-tip-on");
        }
        goster(icerik(h, e.target, e.clientX, e.clientY), e.clientX, e.clientY);
    }
    document.addEventListener("pointermove", function (e) { if (e.pointerType === "mouse") izle(e); }, { passive: true });
    document.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse") { if (hedefBul(e.target)) izle(e); else gizle(); } }, { passive: true });
    document.addEventListener("scroll", gizle, { passive: true, capture: true });
    window.addEventListener("blur", gizle);
})();
