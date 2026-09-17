/**
 * ============================================================
 * BASIC — State aplikasi & keranjang belanja
 * ============================================================
 *
 * Keranjang memakai pola Optimistic UI: setiap perubahan langsung
 * tersimpan ke localStorage dan UI diperbarui seketika (0ms),
 * tanpa menunggu server. Stok baru divalidasi ulang secara
 * otoritatif oleh server saat checkout (dengan LockService).
 */

const AppState = {
  katalog: [],            // cache katalog di sisi klien → filter & navigasi instan
  hero: [],               // slide hero dari backend (kosong = pakai hero teks bawaan)
  katalogSegar: false,    // true = sudah diambil dari server pada sesi ini
                          // false = isinya dari cache browser, masih perlu disegarkan
  config: { ongkir: 15000, banks: [], waAdmin: '' },
  filterKategori: 'Semua',
  currentProduk: null,
  selectedVarian: null,
  qty: 1,
  adminToken: null,       // sesi admin, hanya di memori (hilang saat refresh = lebih aman)
  adminInfo: null,
  lastOrder: null,        // hasil checkout terakhir → dipakai halaman konfirmasi
  charts: {}
};

class ShoppingCart {
  constructor() {
    this.items = this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem('basic_cart');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  save() {
    try {
      localStorage.setItem('basic_cart', JSON.stringify(this.items));
    } catch (e) {
      // localStorage bisa penuh / diblokir (mode privat) — keranjang tetap
      // berfungsi di memori selama tab terbuka.
    }
    this.updateBadge();
  }

  key(produkId, varianId) {
    return produkId + '::' + (varianId || 'po');
  }

  add(item) {
    const k = this.key(item.produkId, item.varianId);
    const ada = this.items.find(i => this.key(i.produkId, i.varianId) === k);
    if (ada) ada.jumlah += item.jumlah;
    else this.items.push(item);
    this.save();
  }

  updateQty(produkId, varianId, jumlah) {
    const it = this.items.find(i => this.key(i.produkId, i.varianId) === this.key(produkId, varianId));
    if (!it) return;
    if (jumlah < 1) return this.remove(produkId, varianId);
    it.jumlah = jumlah;
    this.save();
    renderKeranjang();
  }

  remove(produkId, varianId) {
    this.items = this.items.filter(i => this.key(i.produkId, i.varianId) !== this.key(produkId, varianId));
    this.save();
    renderKeranjang();
  }

  clear() {
    this.items = [];
    this.save();
  }

  count() { return this.items.reduce((s, i) => s + i.jumlah, 0); }
  total() { return this.items.reduce((s, i) => s + i.harga * i.jumlah, 0); }

  updateBadge() {
    const badge = document.getElementById('cartBadge');
    if (!badge) return;
    const c = this.count();
    badge.hidden = c === 0;
    badge.textContent = c;
  }
}

const cart = new ShoppingCart();

/**
 * Cache katalog di browser — inti dari "buka langsung tampil".
 *
 * Memanggil Apps Script selalu butuh 0,5–3 detik (redirect /exec + cold start).
 * Menunggu itu setiap kali situs dibuka membuat aplikasi terasa lambat, padahal
 * katalog jarang berubah. Polanya: tampilkan salinan terakhir SEKETIKA, lalu
 * ambil versi terbaru diam-diam di latar belakang dan perbarui layar hanya
 * kalau memang ada yang berubah.
 */
const KatalogCache = {
  KEY: 'basic_katalog_v2',
  MAX_AGE: 24 * 60 * 60 * 1000, // salinan lebih tua dari sehari dianggap terlalu basi

  read() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || !Array.isArray(obj.katalog)) return null;
      if (Date.now() - (obj.ts || 0) > this.MAX_AGE) return null;
      return obj;
    } catch (e) {
      return null;
    }
  },

  write(katalog, config, hero) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify({
        katalog: katalog, config: config, hero: hero || [], ts: Date.now()
      }));
    } catch (e) {
      // Kuota localStorage penuh / mode privat — bukan masalah, hanya
      // kehilangan keuntungan tampil instan pada kunjungan berikutnya.
    }
  },

  clear() {
    try { localStorage.removeItem(this.KEY); } catch (e) {}
  }
};

/** Draft data pembeli agar tidak hilang saat berpindah langkah checkout. */
const Draft = {
  load() {
    try { return JSON.parse(localStorage.getItem('basic_checkout_draft') || '{}'); }
    catch (e) { return {}; }
  },
  save(obj) {
    try { localStorage.setItem('basic_checkout_draft', JSON.stringify(obj)); } catch (e) {}
  },
  clear() {
    try { localStorage.removeItem('basic_checkout_draft'); } catch (e) {}
  }
};
