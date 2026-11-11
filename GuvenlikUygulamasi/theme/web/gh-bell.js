// Üst çubukta bildirim zili: okunmamış sayısı (GuvenlikYonetimi.SUB_Bildirim_Okunmamis) ve bildirim merkezi (ACT_Bildirimler_Ac).
// Mendix layout'u model API'sinden düzenlenemediği için zil, oturum açıkken üst çubuğa istemci tarafında eklenir.
(function () {
    var MF_SAYI = "GuvenlikYonetimi.SUB_Bildirim_Okunmamis";
    var MF_AC = "GuvenlikYonetimi.ACT_Bildirimler_Ac";
    var sonSorgu = 0;
    function hazir() {
        return window.mx && mx.session && mx.data && typeof mx.data.action === "function" && !(mx.session.isGuest && mx.session.isGuest());
    }
    function zil() {
        var bar = document.querySelector(".region-topbar .topbar-content");
        if (!bar) return null;
        var b = bar.querySelector(".gh-bell");
        if (!b) {
            b = document.createElement("button");
            b.type = "button";
            b.className = "gh-bell hs-iconbtn";
            b.setAttribute("data-hs-tip", "Bildirimler");
            b.style.order = "8";
            b.setAttribute("aria-label", "Bildirimler");
            b.innerHTML = '<i class="ph ph-bell"></i><span class="gh-bell-n hs-badge" hidden></span>';
            b.addEventListener("click", function (e) {
                e.stopPropagation();
                mx.data.action({ params: { actionname: MF_AC }, callback: function () {}, error: function () {} });
            });
            bar.appendChild(b);
            yenile(true);
        }
        return b;
    }
    function yenile(zorla) {
        if (!hazir()) return;
        var simdi = Date.now();
        if (!zorla && simdi - sonSorgu < 4000) return;
        sonSorgu = simdi;
        var b = zil();
        if (!b) return;
        mx.data.action({
            params: { actionname: MF_SAYI },
            callback: function (n) {
                var v = Number(n) || 0, s = b.querySelector(".gh-bell-n");
                s.textContent = v > 99 ? "99+" : String(v);
                s.hidden = v === 0;
                b.classList.toggle("has-new", v > 0);
                b.setAttribute("data-hs-tip", v > 0 ? "Bildirimler · " + v + " yeni" : "Bildirimler");
            },
            error: function () {}
        });
    }
    setInterval(function () { if (hazir()) zil(); }, 1500);
    setInterval(function () { yenile(true); }, 60000);
    document.addEventListener("click", function () { setTimeout(function () { yenile(false); }, 1500); }, true);
})();
