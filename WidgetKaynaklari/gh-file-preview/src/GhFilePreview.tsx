// GH Dosya Önizleme: FileDocument listesindeki PDF ve görselleri sayfa içinde ve uygulama içi tam ekranda gösterir.
// Mendix dosyaları "indir" başlığıyla gönderdiği için içerik oturumla çekilir ve tarayıcı içi geçici adresle (blob URL) gösterilir.
// Toplu indirme: liste tarayıcıda sıkıştırmasız ZIP'e konur (sunucu tarafı gerekmez). Görünüm temadaki .gh-fp-* sınıflarındadır.
import { ReactElement, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Big from "big.js";
import { ObjectItem } from "mendix";
import { GhFilePreviewContainerProps } from "../typings/GhFilePreviewProps";
import { zipOlustur, ZipGirdi } from "./zip";

type Tur = "pdf" | "gorsel" | "desteklenmiyor";
interface Yuklenen {
    durum: "yukleniyor" | "hazir" | "bos" | "hata" | "bozuk";
    url?: string;
    tur?: Tur;
    boyut?: number;
    blob?: Blob;
}

const GORSEL = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"];

function uzantisi(ad: string): string {
    const i = ad.lastIndexOf(".");
    return i > 0 ? ad.slice(i + 1).toLowerCase() : "";
}

function turBul(ad: string, mime: string): Tur {
    const uzanti = uzantisi(ad);
    if (mime === "application/pdf" || uzanti === "pdf") return "pdf";
    if (mime.startsWith("image/") || GORSEL.indexOf(uzanti) >= 0) return "gorsel";
    return "desteklenmiyor";
}

function boyutMetni(b?: number): string {
    if (!b) return "";
    if (b < 1024 * 1024) return Math.max(1, Math.round(b / 1024)) + " KB";
    return (b / (1024 * 1024)).toFixed(1).replace(".", ",") + " MB";
}

const temizAd = (s: string): string => s.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();

function blobIndir(blob: Blob | string, ad: string): void {
    const url = typeof blob === "string" ? blob : URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ad;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (typeof blob !== "string") setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function GhFilePreview(props: GhFilePreviewContainerProps): ReactElement {
    const { files, nameAttr, caption, subCaption, display, height, openIndex, onView, onDownload, zipName, bulkLabel, onBulkDownload } = props;
    const items: ObjectItem[] = files.status === "available" && files.items ? files.items : [];
    const n = items.length;
    const [sira, setSira] = useState(0);
    const [tamEkran, setTamEkran] = useState(false);
    const [buyuk, setBuyuk] = useState(false);
    const [kayitlar, setKayitlar] = useState<Record<string, Yuklenen>>({});
    const [toplu, setToplu] = useState<{ tamam: number; toplam: number } | null>(null);
    const [bildirim, setBildirim] = useState("");
    const gorulen = useRef<Record<string, boolean>>({});
    const istekler = useRef<Record<string, Promise<Yuklenen> | undefined>>({});
    const adresler = useRef<string[]>([]);

    // Dışarıdan açma (Denetim Modu): openIndex > 0 → tam ekran o sırada
    const acikSira = openIndex && openIndex.status === "available" && openIndex.value ? Number(openIndex.value) : 0;
    useEffect(() => {
        if (acikSira > 0 && n > 0) {
            setSira(Math.min(acikSira, n) - 1);
            setTamEkran(true);
        }
    }, [acikSira, n]);
    useEffect(() => {
        if (sira > 0 && sira >= n) setSira(Math.max(0, n - 1));
    }, [n, sira]);
    useEffect(() => setBuyuk(false), [sira, tamEkran]);
    useEffect(() => {
        if (!bildirim) return;
        const z = setTimeout(() => setBildirim(""), 4500);
        return () => clearTimeout(z);
    }, [bildirim]);

    const kapat = useCallback(() => {
        setTamEkran(false);
        if (openIndex && openIndex.status === "available" && !openIndex.readOnly && Number(openIndex.value || 0) !== 0) {
            openIndex.setValue(new Big(0));
        }
    }, [openIndex]);

    const adi = (it: ObjectItem): string => nameAttr.get(it).value || "";
    const item = n > 0 ? items[Math.min(sira, n - 1)] : undefined;
    const ad = item ? adi(item) : "";
    const baslik = item ? (caption && caption.get(item).value) || ad || "Dosya" : "";
    const altBaslik = item && subCaption ? subCaption.get(item).value || "" : "";
    const kayit = item ? kayitlar[item.id] : undefined;
    const gorunur = display === "inline" || tamEkran;

    // İçerik her dosya için bir kez çekilir; önizleme ve toplu indirme aynı isteği paylaşır
    const getir = useCallback((it: ObjectItem): Promise<Yuklenen> => {
        const id = it.id;
        const onceki = istekler.current[id];
        if (onceki) return onceki;
        const dosyaAdi = adi(it);
        setKayitlar(k => ({ ...k, [id]: { durum: "yukleniyor" } }));
        const p: Promise<Yuklenen> = fetch("/file?guid=" + encodeURIComponent(id) + "&target=internal", { credentials: "same-origin" })
            .then(r => {
                // Mendix içeriği olmayan dosyada 560 ("could not be found") ya da 404 döner → "içerik yok"
                if (r.status === 404 || r.status === 560) return null;
                return r.ok ? r.blob() : Promise.reject(new Error(String(r.status)));
            })
            .then(async (blob): Promise<Yuklenen> => {
                if (!blob || !blob.size) return { durum: "bos" };
                const tur = turBul(dosyaAdi, blob.type || "");
                // Geçerli PDF "%PDF" ile başlar, sonunda "%%EOF" bulunur; değilse tarayıcının ham hatası yerine kendi mesajımız
                if (tur === "pdf") {
                    const bas = await blob.slice(0, 5).text();
                    const son = await blob.slice(Math.max(0, blob.size - 2048)).text();
                    if (bas.indexOf("%PDF") !== 0 || son.indexOf("%%EOF") < 0) return { durum: "bozuk", boyut: blob.size, blob };
                }
                const tipli = tur === "pdf" ? new Blob([blob], { type: "application/pdf" }) : blob;
                const url = URL.createObjectURL(tipli);
                adresler.current.push(url);
                return { durum: "hazir", url, tur, boyut: blob.size, blob: tipli };
            })
            .catch((): Yuklenen => {
                delete istekler.current[id];
                return { durum: "hata" };
            })
            .then(y => {
                setKayitlar(k => ({ ...k, [id]: y }));
                return y;
            });
        istekler.current[id] = p;
        return p;
    }, [nameAttr]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (item && gorunur) getir(item);
    }, [item && item.id, gorunur]); // eslint-disable-line react-hooks/exhaustive-deps

    // Görüntüleme kaydı (dosya başına bir kez)
    useEffect(() => {
        if (!item || !kayit || kayit.durum !== "hazir" || gorulen.current[item.id]) return;
        gorulen.current[item.id] = true;
        const eylem = onView && onView.get(item);
        if (eylem && eylem.canExecute) eylem.execute();
    }, [item && item.id, kayit && kayit.durum]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => () => adresler.current.forEach(u => URL.revokeObjectURL(u)), []);

    const git = useCallback((d: number) => {
        if (n < 2) return;
        setSira(s => (s + d + n) % n);
    }, [n]);

    const indir = useCallback(() => {
        if (!item) return;
        const eylem = onDownload && onDownload.get(item);
        if (eylem) {
            if (eylem.canExecute) eylem.execute();
            return;
        }
        if (kayit && kayit.url) blobIndir(kayit.url, ad || "dosya");
        else if (kayit && kayit.blob) blobIndir(kayit.blob, ad || "dosya");
    }, [item, onDownload, kayit, ad]);

    // Toplu indirme: ZIP içindeki ad = başlık (uzantısı yoksa dosya uzantısı eklenir); aynı adlar numaralanır
    const topluIndir = useCallback(async () => {
        if (toplu || !n) return;
        const liste = items.slice();
        setToplu({ tamam: 0, toplam: liste.length });
        const girdiler: ZipGirdi[] = [];
        const kullanilan: Record<string, number> = {};
        let bos = 0;
        for (let i = 0; i < liste.length; i++) {
            const it = liste[i];
            const y = await getir(it);
            setToplu({ tamam: i + 1, toplam: liste.length });
            if (!y.blob) {
                bos++;
                continue;
            }
            const dosyaAdi = adi(it);
            const uz = uzantisi(dosyaAdi);
            const bas = temizAd((caption && caption.get(it).value) || dosyaAdi || "dosya");
            let girdiAdi = uz && !bas.toLowerCase().endsWith("." + uz) ? bas + "." + uz : bas;
            const anahtar = girdiAdi.toLowerCase();
            kullanilan[anahtar] = (kullanilan[anahtar] || 0) + 1;
            if (kullanilan[anahtar] > 1) {
                const nokta = girdiAdi.lastIndexOf(".");
                girdiAdi = nokta > 0 ? `${girdiAdi.slice(0, nokta)} (${kullanilan[anahtar]})${girdiAdi.slice(nokta)}` : `${girdiAdi} (${kullanilan[anahtar]})`;
            }
            girdiler.push({ ad: girdiAdi, veri: new Uint8Array(await y.blob.arrayBuffer()) });
        }
        setToplu(null);
        if (!girdiler.length) {
            setBildirim("İndirilecek dosya içeriği bulunamadı.");
            return;
        }
        const zipAdi = temizAd((zipName && zipName.value) || "") || "dosyalar";
        blobIndir(zipOlustur(girdiler), zipAdi + ".zip");
        setBildirim(bos ? `${girdiler.length} dosya indirildi; ${bos} dosyanın içeriği yok.` : `${girdiler.length} dosya ZIP olarak indirildi.`);
        if (onBulkDownload && onBulkDownload.canExecute) onBulkDownload.execute();
    }, [toplu, n, items, getir, caption, zipName, onBulkDownload]); // eslint-disable-line react-hooks/exhaustive-deps

    // Klavye (tam ekran): ← → gezinme, Home/End ilk/son, İ indir, T tümünü indir, Esc kapatır (alttaki yan paneli kapatmaz)
    useEffect(() => {
        if (!tamEkran) return;
        const tus = (e: KeyboardEvent): void => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const hedef = e.target as HTMLElement | null;
            if (hedef && /^(INPUT|TEXTAREA|SELECT)$/.test(hedef.tagName)) return;
            const k = e.key;
            let islendi = true;
            if (k === "Escape") {
                e.stopPropagation();
                kapat();
            } else if (k === "ArrowRight") git(1);
            else if (k === "ArrowLeft") git(-1);
            else if (k === "Home") setSira(0);
            else if (k === "End") setSira(Math.max(0, n - 1));
            else if (k === "i" || k === "I" || k === "İ" || k === "ı") indir();
            else if ((k === "t" || k === "T") && n > 1) topluIndir();
            else islendi = false;
            if (islendi) e.preventDefault();
        };
        window.addEventListener("keydown", tus, true);
        return () => window.removeEventListener("keydown", tus, true);
    }, [tamEkran, kapat, git, indir, topluIndir, n]);

    const ikon = (cls: string): ReactElement => <span className={"ph " + cls} aria-hidden="true" />;
    const dugme = (etiket: string, cls: string, fn: () => void, sadeceIkon?: boolean, ekCls?: string, ipucu?: string, kapali?: boolean): ReactElement => (
        <button type="button" className={"btn gh-fp-btn " + (ekCls || "") + (sadeceIkon ? " gh-fp-icon" : "")} onClick={fn}
            title={ipucu || etiket} aria-label={etiket} disabled={kapali}>
            {ikon(cls)}
            {sadeceIkon ? null : <span>{etiket}</span>}
        </button>
    );
    const topluEtiket = toplu ? `Hazırlanıyor… ${toplu.tamam} / ${toplu.toplam}` : `${bulkLabel || "Tümünü indir"} (${n})`;
    const topluDugme = (sadeceIkon: boolean, ekCls: string): ReactElement =>
        dugme(topluEtiket, toplu ? "ph-circle-notch gh-fp-donen" : "ph-file-zip", topluIndir, sadeceIkon, "gh-fp-bulk " + ekCls,
            (bulkLabel || "Tümünü indir") + " · ZIP" + (tamEkran ? " (T)" : ""), !n || !!toplu);
    const gezinme = n > 1 ? (
        <div className="gh-fp-nav">
            {dugme("Önceki", "ph-caret-left", () => git(-1), true, "", tamEkran ? "Önceki (←)" : "Önceki")}
            <span className="gh-fp-count">{sira + 1} / {n}</span>
            {dugme("Sonraki", "ph-caret-right", () => git(1), true, "", tamEkran ? "Sonraki (→)" : "Sonraki")}
        </div>
    ) : null;

    const icerik = (tam: boolean): ReactElement => {
        if (files.status === "loading" && !n) return <div className="gh-fp-msg">Yükleniyor…</div>;
        if (!item) return <div className="gh-fp-msg">Gösterilecek dosya yok.</div>;
        if (!kayit || kayit.durum === "yukleniyor") return <div className="gh-fp-msg"><span className="gh-fp-spin" />Önizleme hazırlanıyor…</div>;
        if (kayit.durum === "bos") return <div className="gh-fp-msg">{ikon("ph-file-dashed")}Bu dosyanın içeriği yok (örnek kayıt).</div>;
        if (kayit.durum === "bozuk") return <div className="gh-fp-msg">{ikon("ph-file-x")}Dosya açılamadı (bozuk ya da geçersiz PDF); indirerek kontrol edebilirsiniz.</div>;
        if (kayit.durum === "hata") return <div className="gh-fp-msg">{ikon("ph-warning-circle")}Dosya yüklenemedi.</div>;
        if (kayit.tur === "pdf") return <iframe className="gh-fp-frame" src={kayit.url + (tam ? "#view=FitH" : "#view=FitH&toolbar=0")} title={baslik} />;
        if (kayit.tur === "gorsel")
            return (
                <div className={"gh-fp-imgwrap" + (buyuk ? " is-buyuk" : "")}>
                    <img className="gh-fp-img" src={kayit.url} alt={baslik} onClick={() => setBuyuk(b => !b)}
                        title={buyuk ? "Ekrana sığdır" : "Gerçek boyut"} />
                </div>
            );
        return <div className="gh-fp-msg">{ikon("ph-file")}Bu dosya türü önizlenemiyor; indirerek açabilirsiniz.</div>;
    };

    const katman = tamEkran
        ? createPortal(
              <div className="gh-fp-overlay" role="dialog" aria-modal="true" aria-label={baslik} onMouseDown={e => { if (e.target === e.currentTarget) kapat(); }}>
                  <div className="gh-fp-panel">
                      <div className="gh-fp-bar">
                          <div className="gh-fp-title">
                              <span className="gh-fp-name">{baslik}</span>
                              <span className="gh-fp-sub">{[altBaslik, boyutMetni(kayit && kayit.boyut)].filter(Boolean).join(" · ")}</span>
                          </div>
                          {gezinme}
                          {n > 1 ? topluDugme(true, "") : null}
                          {dugme("İndir", "ph-download-simple", indir, false, "gh-btn-dl-text", "İndir (İ)")}
                          {dugme("Kapat", "ph-x", kapat, true, "gh-close", "Kapat (Esc)")}
                      </div>
                      <div className="gh-fp-body">{icerik(true)}</div>
                      <div className="gh-fp-keys" aria-hidden="true">
                          {n > 1 ? <span><kbd>←</kbd><kbd>→</kbd> gezin</span> : null}
                          <span><kbd>İ</kbd> indir</span>
                          {n > 1 ? <span><kbd>T</kbd> tümünü indir</span> : null}
                          <span><kbd>Esc</kbd> kapat</span>
                      </div>
                  </div>
              </div>,
              document.body
          )
        : null;
    const tost = bildirim ? createPortal(<div className="gh-fp-toast" role="status">{bildirim}</div>, document.body) : null;

    if (display === "overlay") return <div className={"gh-fp gh-fp-hidden " + (props.class || "")}>{katman}{tost}</div>;
    if (display === "button")
        return (
            <div className={"gh-fp-bulkwrap " + (props.class || "")} style={props.style}>
                {topluDugme(false, "gh-fp-bulk-only")}
                {katman}
                {tost}
            </div>
        );

    return (
        <div className={"gh-fp " + (props.class || "")} style={props.style}>
            <div className="gh-fp-head">
                <div className="gh-fp-title">
                    <span className="gh-fp-name">{baslik || "Önizleme"}</span>
                    {altBaslik ? <span className="gh-fp-sub">{altBaslik}</span> : null}
                </div>
                {gezinme}
            </div>
            <div className="gh-fp-view" style={{ height: height || "420px" }}>{icerik(false)}</div>
            {item ? (
                <div className="gh-fp-actions">
                    {dugme("Tam ekran", "ph-arrows-out", () => setTamEkran(true), false, "gh-btn-full")}
                    {dugme("İndir", "ph-download-simple", indir, false, "gh-btn-dl-text")}
                    {n > 1 ? topluDugme(false, "") : null}
                </div>
            ) : null}
            {katman}
            {tost}
        </div>
    );
}
