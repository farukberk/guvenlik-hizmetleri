// Halkbank_Shell ayarları · Güvenlik Hizmetleri uygulaması
// Ayrıntılar: themesource/halkbank_shell/KURULUM.md
window.HalkbankShellConfig = {
    title: "Güvenlik Hizmetleri",
    subtitle: "Güvenlik Hizmetleri Dpt.",
    defaultTheme: "light",
    // önceki kabukla aynı anahtarlar: kullanıcıların tema ve menü tercihleri korunur
    themeStorageKey: "gh-tema",
    navStorageKey: "gh-nav-mini",
    // Kullanıcı bilgisi ve menü rozetleri gh-shell.js'den (SUB_Kabuk_Bilgi) HalkbankShell.setUser / setBadge ile gelir.
    icons: {
        "Ana Sayfa": "house",
        "Birim Belgeleri": "files",
        "Alarmlar": "bell-ringing",
        "Denetim": "clipboard-text",
        "Talep Yönetimi": "seal-check",
        "Malzeme Yönetimi": "package",
        "Kıyafet / Teçhizat Taleplerim": "shopping-bag",
        "Kıyafet / Teçhizat Talepleri": "t-shirt",
        "Geçici Görevli Talepleri": "user-plus",
        "Bedenlerim": "ruler",
        "Raporlar": "chart-bar",
        // Ortak Veriler
        "Personeller": "users-three",
        "Departmanlar": "tree-structure",
        "Birimler": "buildings",
        "Unvanlar": "identification-badge",
        "Binalar": "building-office",
        "Pozisyon Unvanları": "briefcase",
        // Yönetim / Parametreler
        "Belge Türü ve Alarm Tanımları": "sliders-horizontal",
        "Birim–Belge Atamaları": "link-simple",
        "Manuel Birim Tanımları": "building-apartment",
        "Kıyafet Türü Tanımları": "coat-hanger",
        "Teçhizat Türü Tanımları": "toolbox",
        "Yetkilendirme": "shield-check",
        "Kullanıcı Hesapları": "user-gear",
        "Model Yansıtma": "cube",
        "Veritabanı Eşleme": "database",
        "Mail Ayarları": "envelope-simple",
        "Alarm Mail Ayarları": "envelope-open",
        "Gönderilen Mailler": "paper-plane-tilt"
    },
    // listede olmayan öğeler
    defaultIcon: "circle"
};
