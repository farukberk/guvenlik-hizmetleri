/*
 * Halkbank_Shell · kurumsal üst bar ve sol menü davranışı (sürüm 1.0)
 * Atlas_Default layout'unu kullanan sayfalarda çalışır; görünüm themesource/halkbank_shell/web/_shell.scss'tedir.
 *
 * Ayarlar, bu dosyadan ÖNCE yüklenen window.HalkbankShellConfig nesnesinden okunur (hepsi isteğe bağlı):
 *   title, subtitle         : üst bardaki uygulama adı ve alt satır
 *   logo                    : logo adresi (varsayılan: modülün Halkbank logosu)
 *   homeUrl                 : markaya tıklanınca gidilecek adres (varsayılan: "/")
 *   defaultTheme            : "light" | "dark" (varsayılan "light")
 *   themeStorageKey         : tema tercihinin saklandığı localStorage anahtarı (varsayılan "hs-theme")
 *   navStorageKey           : menü daraltma tercihinin anahtarı (varsayılan "hs-nav-mini")
 *   icons                   : { "Menü başlığı": "house", ... } Phosphor ikon adları (ph- öneki olmadan)
 *   defaultIcon             : eşleşmeyen menü öğeleri için ikon (varsayılan "circle")
 *   userMicroflow           : kullanıcı bilgisini döndüren microflow ("Modül.Ad"); dönen metin
 *                             userParse ile çözülür. Verilmezse oturumdaki kullanıcı adı kullanılır.
 *   userParse               : function(sonuc) -> { name, role, unit, photo }  (varsayılan: "Ad|Rol|Birim|FotoğrafURL")
 *   texts                   : düğme metinleri (themeToDark, themeToLight, collapse, expand)
 *
 * Projeler için API (window.HalkbankShell):
 *   setUser({ name, role, unit, photo })   profil bloğunu doldurur
 *   setBadge(menüBaşlığı | "a.css-seçici", sayı)   menü öğesine sayı rozeti koyar (0 = gizle)
 *   addTopbarItem(eleman, sıra)            üst bara öğe ekler (sıra: 1-3 marka ile boşluk arası, 5-8 sağ taraf)
 *   toggleTheme(), setTheme("light"|"dark"), toggleNav(), refresh()
 *   on("ready" | "theme" | "nav", fn)
 */
(function () {
    "use strict";
    var cfg = window.HalkbankShellConfig || {};
    var T = Object.assign({
        themeToDark: "Gece moduna geç",
        themeToLight: "Gündüz moduna geç",
        collapse: "Menüyü daralt",
        expand: "Menüyü genişlet"
    }, cfg.texts || {});
    var THEME_KEY = cfg.themeStorageKey || "hs-theme";
    var NAV_KEY = cfg.navStorageKey || "hs-nav-mini";
    var LOGO = cfg.logo || "/resources/halkbank_shell/images/halkbank-logo.svg";
    var root = document.documentElement;
    var user = null;
    var badges = {};
    var listeners = {};

    function store(k, v) {
        try {
            if (v === undefined) return window.localStorage.getItem(k);
            window.localStorage.setItem(k, v);
        } catch (e) { /* tarayıcı depolaması kapalı */ }
        return null;
    }
    function el(tag, cls, text) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text !== undefined) e.textContent = text;
        return e;
    }
    function emit(name, arg) {
        (listeners[name] || []).forEach(function (fn) { try { fn(arg); } catch (e) { console.error(e); } });
    }
    function initials(name) {
        var p = String(name || "").trim().split(/\s+/).filter(Boolean);
        if (!p.length) return "";
        return (p[0].charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : "")).toLocaleUpperCase("tr-TR");
    }
    function setText(n, v) {
        if (n && n.textContent !== v) n.textContent = v;
    }
    function norm(s) {
        return String(s || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("tr-TR");
    }

    // ---- tema ----
    function currentTheme() { return root.getAttribute("data-theme") === "dark" ? "dark" : "light"; }
    function setTheme(t) {
        root.setAttribute("data-theme", t === "dark" ? "dark" : "light");
        store(THEME_KEY, currentTheme());
        syncLabels();
        emit("theme", currentTheme());
    }
    function toggleTheme() { setTheme(currentTheme() === "dark" ? "light" : "dark"); }

    // ---- menü daraltma ----
    function isMini() { return root.classList.contains("hs-mini"); }
    function setMini(on) {
        root.classList.toggle("hs-mini", !!on);
        store(NAV_KEY, on ? "1" : "0");
        syncLabels();
        emit("nav", !!on);
    }
    function toggleNav() { setMini(!isMini()); }

    function syncLabels() {
        var tb = document.querySelector(".hs-theme");
        if (tb) {
            var dark = currentTheme() === "dark";
            tb.setAttribute("data-hs-tip", dark ? T.themeToLight : T.themeToDark);
            tb.setAttribute("aria-label", tb.getAttribute("data-hs-tip"));
            var i = tb.querySelector(".ph");
            if (i) i.className = "ph " + (dark ? "ph-sun" : "ph-moon");
        }
        var eb = document.querySelector(".hs-edge");
        if (eb) {
            eb.setAttribute("data-hs-tip", isMini() ? T.expand : T.collapse);
            eb.setAttribute("aria-label", eb.getAttribute("data-hs-tip"));
            eb.setAttribute("aria-pressed", isMini() ? "true" : "false");
        }
    }

    // ---- üst bar ----
    function topbar() {
        var tc = document.querySelector(".layout-atlas .region-topbar .topbar-content");
        if (!tc) return;
        if (!tc.querySelector(".hs-brand")) {
            var b = el("a", "hs-brand");
            b.href = cfg.homeUrl || "/";
            var img = el("img", "hs-brand-logo");
            img.src = LOGO;
            img.alt = "Halkbank";
            var tx = el("span", "hs-brand-text");
            tx.appendChild(el("span", "hs-brand-title", cfg.title || ""));
            if (cfg.subtitle) tx.appendChild(el("span", "hs-brand-sub", cfg.subtitle));
            b.appendChild(img);
            b.appendChild(el("span", "hs-brand-sep"));
            b.appendChild(tx);
            tc.insertBefore(b, tc.firstChild);
        }
        if (!tc.querySelector(".hs-spacer")) tc.appendChild(el("span", "hs-spacer"));
        if (!tc.querySelector(".hs-theme")) {
            var t = el("button", "hs-iconbtn hs-theme");
            t.type = "button";
            t.appendChild(el("i", "ph ph-moon"));
            t.addEventListener("click", toggleTheme);
            tc.appendChild(t);
        }
    }
    function addTopbarItem(node, order) {
        var tc = document.querySelector(".layout-atlas .region-topbar .topbar-content");
        if (!tc || !node) return false;
        if (order !== undefined) node.style.order = String(order);
        if (node.parentNode !== tc) tc.appendChild(node);
        return true;
    }

    // ---- sol menü ----
    function profile(wrap) {
        var me = wrap.querySelector(":scope > .hs-me");
        if (!me) {
            me = el("div", "hs-me");
            var ph = el("div", "hs-me-photo");
            var tx = el("div", "hs-me-text");
            tx.appendChild(el("span", "hs-me-name"));
            tx.appendChild(el("span", "hs-me-role"));
            me.appendChild(ph);
            me.appendChild(tx);
            wrap.insertBefore(me, wrap.firstChild);
        }
        if (!user) return;
        if (!me.classList.contains("hs-me-ready")) me.classList.add("hs-me-ready");
        var photo = me.querySelector(".hs-me-photo");
        var key = (user.photo || "") + "|" + (user.name || "");
        if (photo.getAttribute("data-k") !== key) {
            photo.setAttribute("data-k", key);
            photo.textContent = "";
            if (user.photo) {
                var img = el("img");
                img.src = user.photo;
                img.alt = "";
                img.onerror = function () { photo.textContent = initials(user.name); };
                photo.appendChild(img);
            } else {
                photo.textContent = initials(user.name);
            }
        }
        setText(me.querySelector(".hs-me-name"), user.name || "");
        var roleLine = [user.role, user.unit].filter(Boolean).join(" · ");
        setText(me.querySelector(".hs-me-role"), roleLine);
        photo.setAttribute("data-hs-tip", [user.name, roleLine].filter(Boolean).join(" · "));
    }
    function captionOf(a) {
        var t = a.querySelector(":scope > .hs-navtxt");
        if (t) return t.textContent;
        var s = "";
        a.childNodes.forEach(function (n) {
            if (n.nodeType === 3) s += n.textContent;
            else if (n.nodeType === 1 && !n.classList.contains("hs-badge") && !n.classList.contains("hs-navico") && !n.classList.contains("hs-caret") && !n.classList.contains("glyphicon")) s += n.textContent;
        });
        return s.replace(/\s+/g, " ").trim();
    }
    function iconFor(caption) {
        var map = cfg.icons || {};
        var n = norm(caption);
        for (var k in map) {
            if (Object.prototype.hasOwnProperty.call(map, k) && norm(k) === n) return map[k];
        }
        return cfg.defaultIcon || "circle";
    }
    function decorate(a) {
        var cap = captionOf(a);
        if (!cap) return;
        if (a.getAttribute("data-hs-cap") !== cap) {
            // metni tek bir span'a topla (daraltılmış menüde gizlenebilsin)
            var txt = a.querySelector(":scope > .hs-navtxt");
            if (!txt) {
                txt = el("span", "hs-navtxt");
                Array.prototype.slice.call(a.childNodes).forEach(function (n) {
                    if (n.nodeType === 3 || (n.nodeType === 1 && n.tagName === "SPAN" && !n.className)) {
                        txt.appendChild(n);
                    }
                });
                a.appendChild(txt);
            }
            setText(txt, cap);
            var ico = a.querySelector(":scope > .hs-navico");
            if (!ico) {
                ico = el("i", "hs-navico");
                a.insertBefore(ico, a.firstChild);
            }
            ico.className = "hs-navico ph ph-" + iconFor(cap);
            a.setAttribute("data-hs-cap", cap);
            a.setAttribute("data-hs-nav", "1");
            a.removeAttribute("title");
        }
        var li = a.parentElement;
        if (li && li.classList.contains("mx-navigationtree-has-items") && !a.querySelector(":scope > .hs-caret")) {
            a.appendChild(el("i", "hs-caret ph ph-caret-down"));
        }
        var b = badges[norm(cap)];
        applyBadge(a, b === undefined ? null : b);
    }
    function applyBadge(a, n) {
        var span = a.querySelector(":scope > .hs-badge");
        if (n === null) return;
        if (!span) {
            span = el("span", "hs-badge");
            a.appendChild(span);
        }
        var v = Number(n) || 0;
        setText(span, v > 99 ? "99+" : String(v));
        if (span.hidden !== (v <= 0)) span.hidden = v <= 0;
    }
    function setBadge(target, n) {
        if (typeof target === "string" && /^[.#a-z\[]/i.test(target) && /[.#\[]/.test(target)) {
            document.querySelectorAll(".layout-atlas .region-sidebar " + target).forEach(function (a) { applyBadge(a, n); });
            return;
        }
        badges[norm(target)] = n;
        sidebar();
    }
    function sidebar() {
        var wrap = document.querySelector(".layout-atlas .region-sidebar > .mx-scrollcontainer-wrapper");
        if (!wrap) return;
        profile(wrap);
        wrap.querySelectorAll(".mx-navigationtree li > a").forEach(decorate);
        if (!document.querySelector(".hs-edge")) {
            var e = el("button", "hs-edge");
            e.type = "button";
            e.appendChild(el("i", "ph ph-caret-left"));
            e.addEventListener("click", toggleNav);
            document.body.appendChild(e);
        }
    }

    // ---- ipucu balonu (yalnızca kabuk: menü öğeleri daraltılmışken, kabuk düğmeleri, profil) ----
    function tips() {
        var tip = el("div", "hs-tip");
        tip.setAttribute("role", "tooltip");
        document.body.appendChild(tip);
        var cur = null, timer = 0;
        function hide() { clearTimeout(timer); cur = null; tip.classList.remove("hs-tip-on"); }
        function text(t) {
            if (t.getAttribute("data-hs-nav")) return isMini() ? t.getAttribute("data-hs-cap") : "";
            return t.getAttribute("data-hs-tip") || "";
        }
        document.addEventListener("mouseover", function (ev) {
            var t = ev.target instanceof Element ? ev.target.closest("html.hs-on [data-hs-tip], html.hs-on .region-sidebar a[data-hs-nav]") : null;
            if (t === cur) return;
            hide();
            if (!t) return;
            var s = text(t);
            if (!s) return;
            cur = t;
            timer = setTimeout(function () {
                if (cur !== t || !document.body.contains(t)) return;
                tip.textContent = s;
                tip.classList.add("hs-tip-on");
                var r = t.getBoundingClientRect(), w = tip.getBoundingClientRect();
                var side = !!t.closest(".region-sidebar") || t.classList.contains("hs-edge");
                var top, left;
                if (side) {
                    top = r.top + r.height / 2 - w.height / 2;
                    left = r.right + 10;
                } else {
                    top = r.bottom + 8;
                    left = Math.min(r.left + r.width / 2 - w.width / 2, window.innerWidth - w.width - 6);
                }
                tip.style.top = Math.max(6, top) + "px";
                tip.style.left = Math.max(6, left) + "px";
            }, 250);
        }, true);
        document.addEventListener("mousedown", hide, true);
        window.addEventListener("scroll", hide, true);
    }

    // ---- kullanıcı bilgisi ----
    function defaultParse(s) {
        var p = String(s || "").split("|");
        return { name: p[0] || "", role: p[1] || "", unit: p[2] || "", photo: p[3] || "" };
    }
    function loadUser() {
        if (!window.mx || !mx.session) return false;
        if (mx.session.isGuest && mx.session.isGuest()) return true;
        if (!cfg.userMicroflow) {
            if (!user) {
                var u = mx.session.getUserName ? mx.session.getUserName() : "";
                setUser({ name: u });
            }
            return true;
        }
        if (!mx.data || typeof mx.data.action !== "function") return false;
        mx.data.action({
            params: { actionname: cfg.userMicroflow },
            callback: function (res) { setUser((cfg.userParse || defaultParse)(res)); },
            error: function () { if (!user) setUser({ name: mx.session.getUserName ? mx.session.getUserName() : "" }); }
        });
        return true;
    }
    function setUser(u) {
        user = Object.assign({}, user || {}, u || {});
        sidebar();
    }

    // ---- başlatma ----
    function refresh() {
        topbar();
        sidebar();
        syncLabels();
    }
    function boot() {
        root.classList.add("hs-on");
        var saved = store(THEME_KEY);
        root.setAttribute("data-theme", saved === "dark" || saved === "light" ? saved : (cfg.defaultTheme === "dark" ? "dark" : "light"));
        if (store(NAV_KEY) === "1") root.classList.add("hs-mini");
        tips();
        var pending = 0, userAsked = false;
        var mo = new MutationObserver(function () {
            if (pending) return;
            pending = setTimeout(function () {
                pending = 0;
                refresh();
                if (!userAsked && document.querySelector(".layout-atlas")) userAsked = loadUser();
            }, 60);
        });
        mo.observe(document.body, { childList: true, subtree: true });
        refresh();
        emit("ready");
    }

    window.HalkbankShell = {
        version: "1.0",
        config: cfg,
        setUser: setUser,
        setBadge: setBadge,
        addTopbarItem: addTopbarItem,
        setTheme: setTheme,
        toggleTheme: toggleTheme,
        toggleNav: toggleNav,
        refresh: refresh,
        on: function (name, fn) { (listeners[name] = listeners[name] || []).push(fn); if (name === "ready" && root.classList.contains("hs-on")) fn(); }
    };
    // tema, sayfa çizilmeden önce uygulansın (yanıp sönme olmasın)
    (function earlyTheme() {
        var saved = store(THEME_KEY);
        root.setAttribute("data-theme", saved === "dark" || saved === "light" ? saved : (cfg.defaultTheme === "dark" ? "dark" : "light"));
    })();
    if (document.body) boot();
    else document.addEventListener("DOMContentLoaded", boot);
})();
