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
