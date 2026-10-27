// Kıyafet / teçhizat simgeleri: tür adını gösteren öğelere adındaki anahtar kelimeye göre data-mz="<simge>" yazılır;
// çizim temada ([data-mz]::before, main.scss "P26 · Kıyafet / teçhizat simgeleri"). Modelde ek alan gerekmez; yeni türler adından eşleşir.
(function () {
    // Sıra önemli: daha özel kelime önce (ör. "çelik yelek" → yelek, "gömlek (makam)" → gömlek)
    var KURALLAR = [
        ["yelek", /yelek/],
        ["takim", /takım elbise|takim elbise|ceket takım/],
        ["uniforma", /üniforma|uniforma|tulum/],
        ["kaban", /kaban|palto|pardesü/],
        ["mont", /mont|parka|ceket|yağmurluk/],
        ["kazak", /kazak|hırka|sweat|polar/],
        ["tisort", /tişört|t-shirt|tshirt/],
        ["gomlek", /gömlek/],
        ["pantolon", /pantolon|etek/],
        ["ayakkabi", /ayakkabı|(^|\s)bot(\s|$)|postal|çizme/],
        ["kask", /kask|baret/],
        ["kep", /(^|\s)kep(\s|$)|şapka|bere/],
        ["palaska", /palaska/],
        ["kemer", /kemer/],
        ["jop", /(^|\s)jop|(^|\s)cop(\s|$)|tonfa/],
        ["kelepce", /kelepçe/],
        ["telsiz", /telsiz/],
        ["fener", /fener/],
        ["silah", /silah|tabanca|kılıf|şarjör|fişeklik/],
        ["biber", /biber gaz|sprey|gaz spreyi/],
        ["duduk", /düdük/],
        ["kamera", /kamera/],
        ["durbun", /dürbün/],
        ["ilkyardim", /ilk ?yardım|sağlık çantası/],
        ["kimlik", /kimlik|yaka kartı|rozet|arma|kart(ı)?(\s|$)/],
        ["dedektor", /dedektör|detektör|el arama/],
        ["yangin", /yangın|söndürücü/],
        ["megafon", /megafon/],
        ["eldiven", /eldiven/],
        ["gozluk", /gözlük/],
        ["kulaklik", /kulaklık|mikrofon/],
        ["canta", /çanta|sırt/],
        ["corap", /çorap/],
        ["atki", /atkı|boyunluk|bere-atkı/],
        ["kravat", /kravat|papyon/],
        ["semsiye", /şemsiye/],
        ["anahtar", /anahtar|kilit/],
        ["pil", /pil(\s|$)|batarya|şarj/],
        ["saat", /saat/],
        ["koni", /koni|bariyer|şerit/],
        ["alet", /alet|takım çantası|tamir/],
    ];
    // Tür adını gösteren öğeler: [ad seçicisi, boyut, simgenin yazılacağı öğe (yoksa adın kendisi)].
    // Satırda sabit bir simge kutusu varsa (gh-pl-icon, gh-item-icon, gh-req-icon) simge oraya yazılır.
    var satirSimgesi = function (satir, kutu) { return function (e) { var s = e.closest(satir); return s && s.querySelector(kutu); }; };
    var HEDEFLER = [
        [".gh-cat-card .gh-cat-name", "lg"],
        [".mx-name-dgKiyafet .tr > .td:first-child .td-text", "sm"],
        // P29: Teçhizat Türü Tanımları tablosunda simge yok (tasarım)
        [".gh-ty-urun", "sm"],
        [".gh-pl-name > .mx-text:last-child", "kutu", satirSimgesi(".gh-pl-name", ".gh-pl-icon")],
        [".gh-item-row .gh-cell-stack > .gh-cell-strong:first-child", "kutu", satirSimgesi(".gh-item-row", ".gh-item-icon")],
        // tek kalemli talep: başlık ürün adıdır; çok kalemlide genel talep simgesi kalır
        [".gh-req-main > .gh-cell-strong:first-child", "kutu", function (e) {
            var s = e.closest(".gh-req-row");
            var kutu = s && s.querySelector(".gh-req-icon");
            return kutu && !kutu.classList.contains("is-multi") ? kutu : null;
        }],
        [".gh-bd-name", "sm"],
        [".gh-cart-row .gh-cell-strong", "sm"],
        [".gh-ty-row .gh-cell-stack > .gh-cell-strong:first-child", "sm"],
    ];
    function simgeBul(ad, varsayilan) {
        var k = (ad || "").toLocaleLowerCase("tr");
        for (var i = 0; i < KURALLAR.length; i++) if (KURALLAR[i][1].test(k)) return KURALLAR[i][0];
        return varsayilan;
    }
    // Öğenin kıyafet bağlamında olup olmadığı: kıyafet türü tablosu, Bedenlerim, ya da katalogda "Kıyafet" sekmesi açık
    function kiyafetMi(e) {
        if (e.closest(".mx-name-dgKiyafet") || e.matches(".gh-bd-name")) return true;
        if (e.closest(".gh-cat-card")) {
            var sekme = document.querySelector(".region-content .gh-tab.is-active, .modal-dialog .gh-tab.is-active");
            return !!sekme && /kıyafet/i.test(sekme.textContent || "");
        }
        return false;
    }
    function uygula() {
        HEDEFLER.forEach(function (h) {
            document.querySelectorAll(h[0]).forEach(function (e) {
                var ad = (e.textContent || "").trim();
                if (!ad) return;
                // Tanınmayan ad: kıyafet olduğu bilinen yerde askı, diğer her yerde ortak "teçhizat" simgesi (alet çantası)
                var s = simgeBul(ad, kiyafetMi(e) ? "kiyafet" : "diger");
                var hedef = h[2] ? h[2](e) : e;
                if (!hedef) return;
                if (hedef.getAttribute("data-mz") !== s) hedef.setAttribute("data-mz", s);
                if (hedef.getAttribute("data-mz-boyut") !== h[1]) hedef.setAttribute("data-mz-boyut", h[1]);
            });
        });
    }
    var bekleyen = null;
    new MutationObserver(function () {
        if (bekleyen) return;
        bekleyen = setTimeout(function () { bekleyen = null; uygula(); }, 200);
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    window.ghMalzemeSimge = simgeBul; // test ve hata ayıklama için
})();
