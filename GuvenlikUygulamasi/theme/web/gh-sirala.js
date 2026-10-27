// P29 Şube Belgeleri "Sırala" kutusu (tasarım): seçilen sıralamayı Data Grid 2 başlık sıralamasıyla uygular.
// risk = tablonun varsayılan sırası (Risk ↓, Uyum ↑; başlık sıralaması yok) · uyum oranı / şube kodu / şube adı = ilgili sütun artan.
// Yalnız seçim değiştiğinde uygular; sonra kullanıcı başlığa tıklayarak yine sıralayabilir.
(function () {
    var HEDEF = { "Sırala: uyum oranı": 3, "Sırala: şube kodu": 0, "Sırala: şube adı": 1, "Sırala: risk": -1 };
    var son = null;
    var bekleyen = null;

    function secim() {
        var kutu = document.querySelector(".gh-sirala .widget-combobox");
        if (!kutu) return null;
        var metin = kutu.querySelector(".widget-combobox-caption-text, .widget-combobox-input");
        var deger = metin ? (metin.textContent || metin.value || "").trim() : "";
        return deger in HEDEF ? deger : null;
    }

    function adim() {
        var grid = document.querySelector(".mx-name-dgSubeOzet");
        var deger = secim();
        if (!grid || !deger) { son = null; return; }
        if (deger !== son) { son = deger; bekleyen = deger; }
        if (!bekleyen) return;
        var basliklar = grid.querySelectorAll(".widget-datagrid-grid-head .th");
        var hedef = HEDEF[bekleyen];
        // Her adımda en çok bir tıklama: tablo yeniden çizildikten sonra durum tekrar okunur
        for (var i = 0; i < basliklar.length; i++) {
            var durum = basliklar[i].getAttribute("aria-sort") || "none";
            var tikla = basliklar[i].querySelector(".column-header.clickable");
            if (!tikla) continue;
            if (i === hedef ? durum !== "ascending" : durum !== "none") { tikla.click(); return; }
        }
        bekleyen = null;
    }

    setInterval(adim, 350);
})();
