// Sıkıştırmasız (store) ZIP: dosyalar zaten sıkıştırılmış (PDF, PNG, JPG) olduğundan ek kütüphane gerekmez.
// Türkçe dosya adları için UTF-8 bayrağı (bit 11) açıktır.
export interface ZipGirdi {
    ad: string;
    veri: Uint8Array;
}

let tablo: Uint32Array | undefined;
function crc32(b: Uint8Array): number {
    if (!tablo) {
        tablo = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            tablo[i] = c >>> 0;
        }
    }
    let crc = 0xffffffff;
    for (let i = 0; i < b.length; i++) crc = tablo[(crc ^ b[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

function dosZamani(d: Date): [number, number] {
    const saat = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
    const tarih = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return [saat, tarih];
}

export function zipOlustur(girdiler: ZipGirdi[]): Blob {
    const kodla = new TextEncoder();
    const [saat, tarih] = dosZamani(new Date());
    const parcalar: Uint8Array[] = [];
    const merkez: Uint8Array[] = [];
    let konum = 0;
    for (const g of girdiler) {
        const ad = kodla.encode(g.ad);
        const crc = crc32(g.veri);
        const yerel = new Uint8Array(30 + ad.length);
        const y = new DataView(yerel.buffer);
        y.setUint32(0, 0x04034b50, true);
        y.setUint16(4, 20, true);
        y.setUint16(6, 0x0800, true);
        y.setUint16(8, 0, true);
        y.setUint16(10, saat, true);
        y.setUint16(12, tarih, true);
        y.setUint32(14, crc, true);
        y.setUint32(18, g.veri.length, true);
        y.setUint32(22, g.veri.length, true);
        y.setUint16(26, ad.length, true);
        yerel.set(ad, 30);
        const kayit = new Uint8Array(46 + ad.length);
        const m = new DataView(kayit.buffer);
        m.setUint32(0, 0x02014b50, true);
        m.setUint16(4, 20, true);
        m.setUint16(6, 20, true);
        m.setUint16(8, 0x0800, true);
        m.setUint16(10, 0, true);
        m.setUint16(12, saat, true);
        m.setUint16(14, tarih, true);
        m.setUint32(16, crc, true);
        m.setUint32(20, g.veri.length, true);
        m.setUint32(24, g.veri.length, true);
        m.setUint16(28, ad.length, true);
        m.setUint32(42, konum, true);
        kayit.set(ad, 46);
        parcalar.push(yerel, g.veri);
        merkez.push(kayit);
        konum += yerel.length + g.veri.length;
    }
    const merkezBoyut = merkez.reduce((t, c) => t + c.length, 0);
    const son = new Uint8Array(22);
    const s = new DataView(son.buffer);
    s.setUint32(0, 0x06054b50, true);
    s.setUint16(8, girdiler.length, true);
    s.setUint16(10, girdiler.length, true);
    s.setUint32(12, merkezBoyut, true);
    s.setUint32(16, konum, true);
    return new Blob([...parcalar, ...merkez, son] as BlobPart[], { type: "application/zip" });
}
