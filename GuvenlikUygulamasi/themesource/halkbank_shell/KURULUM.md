# Halkbank_Shell · Kurulum kılavuzu

Halkbank_Shell, Mendix uygulamalarına İEA uygulamasındaki kurumsal **üst bar (header)** ve **sol menü (navigation)** görünümünü getirir.

Modülün getirdikleri:
- **Üst bar:** Halkbank logosu, uygulama adı ve alt satırı, gece/gündüz teması düğmesi.
- **Sol menü:** Profil (fotoğraf ya da baş harfler, ad, rol · birim), turuncu ikonlu menü öğeleri, bölüm başlıkları ve sayı rozetleri.
- **Menü davranışı:** Kenardaki düğmeyle simge şeridine daraltma; daraltılmışken menü adları ipucu olarak çıkar. Telefonda menü soldan kayarak açılır.
- **Tercihler:** Tema ve menü tercihi tarayıcıda saklanır.

Menü öğeleri projenin kendi **Navigation** menüsünden okunur; modülde menü tanımlanmaz.

## Gereksinimler

- Mendix 10 veya 11; sayfalar **Atlas_Default** layout'unu kullanıyor olmalı (Atlas Core).
- Proje `theme/web/index.html` dosyasını kullanıyor olmalı. Yoksa Studio Pro'da *App › Show App Directory* ile `theme/web` altında oluşturulabilir; Atlas'ın varsayılan index.html'i kopyalanır.

## 1. Modülü projeye ekleyin

**Kaynak projeden dışa aktarma** (modülün bulunduğu projede, Studio Pro'da):
1. App Explorer'da **Halkbank_Shell** modülüne sağ tıklayın.
2. **Export module package…** seçeneğini seçin ve `.mpk` dosyasını kaydedin.

**Hedef projeye alma** (yeni projede):
1. **App › Import module package…** seçeneğini seçin.
2. `.mpk` dosyasını seçin.
3. Studio Pro modülü, stil dosyalarını (`themesource/halkbank_shell`) ve fontları, logoyu, betiği (`public/resources/halkbank_shell`) projeye ekler.

## 2. index.html'e iki satır ekleyin

`theme/web/index.html` dosyasında, `<div id="root"></div>` satırından **sonra** ve `dist/index.js` satırından **önce** şunları ekleyin:

```html
<script src="halkbank-shell.config.js?{{cachebust}}"></script>
<script src="resources/halkbank_shell/halkbank-shell.js?{{cachebust}}"></script>
```

Türkçe büyük harf kuralı için `<body lang="tr">` kullanılması önerilir.

## 3. Ayar dosyasını oluşturun

`theme/web/halkbank-shell.config.js` adında bir dosya oluşturun. En kısa hâli:

```js
window.HalkbankShellConfig = {
    title: "Uygulamanın Adı",
    subtitle: "Halkbank · Kurumsal Uygulama",
    icons: {
        "Ana Sayfa": "house",
        "Raporlar": "chart-bar"
    }
};
```

| Ayar | Ne işe yarar | Varsayılan |
|---|---|---|
| `title`, `subtitle` | Üst bardaki uygulama adı ve alt satır | boş |
| `icons` | Menü başlığı → Phosphor ikon adı (`ph-` öneki olmadan). İkonlar: https://phosphoricons.com | — |
| `defaultIcon` | Listede olmayan menü öğelerinin ikonu | `circle` |
| `defaultTheme` | İlk açılıştaki tema: `"light"` ya da `"dark"` | `light` |
| `homeUrl` | Logoya tıklanınca gidilecek adres | `/` |
| `logo` | Farklı bir logo adresi | modülün Halkbank logosu |
| `userMicroflow` | Kullanıcı bilgisini döndüren microflow, ör. `"MyModule.SUB_Kabuk_Kullanici"`. String döndürür: `"Ad Soyad\|Rol\|Birim\|FotoğrafAdresi"` (fotoğraf isteğe bağlı). Verilmezse oturumdaki kullanıcı adı gösterilir. | — |
| `userParse` | Microflow'un döndürdüğü metni farklı biçimde çözmek için `function (metin) { return { name, role, unit, photo }; }` | `Ad\|Rol\|Birim\|Foto` |
| `themeStorageKey`, `navStorageKey` | Tercihlerin tarayıcıda saklandığı anahtarlar (eski bir kabuktan geçerken eski anahtarları vermek tercihleri korur) | `hs-theme`, `hs-nav-mini` |
| `texts` | Düğme metinleri: `themeToDark`, `themeToLight`, `collapse`, `expand` | Türkçe |

Gece teması `<html data-theme="dark">` ile açılır. Projenin kendi sayfa stilleri de bu özniteliğe göre koyu renk tanımlayabilir.

## 4. (İsteğe bağlı) Projeye özel ekler

Modül, proje betiklerinin kullanabileceği küçük bir API sunar (`window.HalkbankShell`):

```js
// kullanıcı bilgisini kendiniz verin (ör. kendi microflow çağrınızın sonucunda)
HalkbankShell.setUser({ name: "Selin Aydın", role: "Güvenlik Ofisi", unit: "Genel Müdürlük", photo: "/file?guid=..." });

// menü öğesine sayı rozeti (menü başlığıyla ya da CSS seçicisiyle); 0 rozeti gizler
HalkbankShell.setBadge("Alarmlar", 12);
HalkbankShell.setBadge("a.mx-name-navigationTree3-4", 3);

// üst bara öğe ekleme: sıra 1–3 marka ile boşluk arası (sol), 5–8 tema düğmesinden önce (sağ)
const zil = document.createElement("button");
zil.className = "hs-iconbtn";                         // modülün simge düğmesi görünümü
zil.setAttribute("data-hs-tip", "Bildirimler");       // modülün ipucu balonu
zil.innerHTML = '<i class="ph ph-bell"></i><span class="hs-badge">3</span>';
HalkbankShell.addTopbarItem(zil, 8);

// arama kutusu görünümü: <label class="hs-search"><i class="ph ph-magnifying-glass"></i><input type="search"></label>

HalkbankShell.on("theme", t => console.log("tema:", t));   // "ready" | "theme" | "nav"
```

Üst bar ve menü Mendix tarafından yeniden çizildiğinde modül öğeleri kendiliğinden geri ekler; proje öğelerini düzenli aralıklarla ya da `MutationObserver` ile kontrol edip yeniden eklemek gerekir (örnek: Güvenlik uygulamasındaki `theme/web/gh-bell.js`).

## 5. Uygulamayı yeniden başlatın

`theme/web` altındaki betikler önbelleğe alınır: değişikliklerin görünmesi için uygulamayı Studio Pro'dan yeniden başlatın ve tarayıcıyı yenileyin. Stil (SCSS) değişikliklerini Studio Pro çalışırken kendisi derler.

## Sorun giderme

- **Görünüm değişmedi:** `index.html`'deki iki satırı ve tarayıcı konsolunda `HalkbankShell` nesnesinin tanımlı olduğunu kontrol edin. Modülün stilleri yalnızca betik `<html>`'e `hs-on` sınıfını ekleyince devreye girer; betik yüklenmezse uygulama Atlas'ın kendi görünümünde kalır.
- **Menü ikonları daire:** `icons` içindeki başlık, menüdeki başlıkla birebir aynı olmalı (büyük/küçük harf önemsiz).
- **Eski kabuk stilleri karışıyor:** Projenin kendi SCSS'inde `.region-topbar`, `.region-sidebar` ya da `--topbar-bg`/`--sidebar-bg` tanımları varsa kaldırın.
- **Ana sayfa menüde vurgulanmıyor:** Mendix, uygulama açılışında gösterilen ana sayfayı menü öğesi olarak işaretlemez; menüden açılan sayfalar vurgulanır.
