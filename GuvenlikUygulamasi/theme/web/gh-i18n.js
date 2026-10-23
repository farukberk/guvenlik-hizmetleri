// Halkbank Güvenlik Hizmetleri — pluggable widget'ların koda gömülü (ayarlanamayan) İngilizce metinlerini Türkçeleştirir.
// Mendix çevirisiyle değiştirilebilen metinler (sistem metinleri, widget özellikleri) burada DEĞİL, modelde Türkçedir.
(function () {
    var exact = {
        "Go to first page": "İlk sayfa",
        "Go to previous page": "Önceki sayfa",
        "Go to next page": "Sonraki sayfa",
        "Go to last page": "Son sayfa",
        "Select filter type": "Filtre türünü seç",
        "No options selected.": "Seçim yapılmadı.",
        "Load more": "Daha fazla göster",
        "Clear selection": "Seçimi temizle",
        "Remove value": "Değeri kaldır"
    };
    var patterns = [
        [/^(\d[\d.,]*) to (\d[\d.,]*) of (\d[\d.,]*)$/, "$1–$2 / $3"],
        [/^(\d[\d.,]*) to (\d[\d.,]*)$/, "$1–$2"],
        [/^sort (.+)$/, "$1 sırala"],
        [/^Page (\d+) of (\d+)$/, "Sayfa $1 / $2"]
    ];
    // Başka metinle aynı düğümde birleşen ifadeler (ör. ekran okuyucu canlı bölgeleri)
    var inline = [
        ["No options selected.", "Seçim yapılmadı."],
        ["Currently showing", "Gösterilen"]
    ];
    function tr(s) {
        if (!s) return s;
        for (var k = 0; k < inline.length; k++) {
            if (s.indexOf(inline[k][0]) !== -1) s = s.split(inline[k][0]).join(inline[k][1]);
        }
        var t = s.trim();
        if (exact.hasOwnProperty(t)) return s.replace(t, exact[t]);
        for (var i = 0; i < patterns.length; i++) {
            if (patterns[i][0].test(t)) return s.replace(t, t.replace(patterns[i][0], patterns[i][1]));
        }
        return s;
    }
    var ATTRS = ["aria-label", "title", "placeholder"];
    function fixNode(node) {
        if (node.nodeType === 3) {
            var v = node.nodeValue, n = tr(v);
            if (n !== v) node.nodeValue = n;
            return;
        }
        if (node.nodeType !== 1) return;
        for (var a = 0; a < ATTRS.length; a++) {
            var av = node.getAttribute(ATTRS[a]);
            if (av) { var an = tr(av); if (an !== av) node.setAttribute(ATTRS[a], an); }
        }
        var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
        var cur;
        while ((cur = walker.nextNode())) {
            if (cur.nodeType === 3) { var cv = cur.nodeValue, cn = tr(cv); if (cn !== cv) cur.nodeValue = cn; }
            else for (var b = 0; b < ATTRS.length; b++) { var x = cur.getAttribute(ATTRS[b]); if (x) { var y = tr(x); if (y !== x) cur.setAttribute(ATTRS[b], y); } }
        }
    }
    function start() {
        fixNode(document.body);
        new MutationObserver(function (list) {
            for (var i = 0; i < list.length; i++) {
                var m = list[i];
                if (m.type === "characterData") fixNode(m.target);
                else if (m.type === "attributes") fixNode(m.target);
                else for (var j = 0; j < m.addedNodes.length; j++) fixNode(m.addedNodes[j]);
            }
        }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    }
    if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
