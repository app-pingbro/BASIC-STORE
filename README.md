# BASIC — Bali Screen Printing Community

Frontend toko online merchandise komunitas sablon Bali.

- **Frontend** (folder ini): HTML/CSS/JS vanilla → di-hosting di GitHub Pages
- **Backend**: Google Apps Script sebagai REST API (berkas `Kode.gs`, dipasang terpisah)
- **Database**: Google Sheets · **Berkas**: Google Drive

---

## Struktur folder

```
.
├── index.html          ← halaman utama (WAJIB ada di root repo)
├── css/
│   └── style.css       ← seluruh gaya visual (brutalist / screen-print)
├── js/
│   ├── config.js       ← ⚠️ ISI GAS_URL DI SINI sebelum deploy
│   ├── ui.js           ← toast, modal, format, kompresi gambar
│   ├── api.js          ← komunikasi fetch ke Apps Script
│   ├── store.js        ← state aplikasi & keranjang belanja
│   ├── pages-shop.js   ← halaman pembeli
│   ├── pages-admin.js  ← panel admin
│   └── app.js          ← router & inisialisasi
├── assets/
│   ├── logo/           ← logo BASIC (ganti berkas di sini bila logo diperbarui)
│   └── favicon/        ← favicon hasil turunan logo
└── PANDUAN-INSTALASI.md
```

## Sebelum deploy

Buka `js/config.js`, isi `GAS_URL` dengan URL `/exec` dari Web App Apps Script Anda:

```js
const GAS_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
```

Tanpa ini, situs tetap tampil tetapi katalog kosong dan muncul peringatan merah.

## Mengganti logo di kemudian hari

Semua tampilan logo mengambil berkas dari `assets/logo/`. Untuk mengganti logo:

1. Timpa berkas di `assets/logo/` dengan nama yang sama (`basic-logo-128.png`, `basic-logo-256.png`, `basic-logo-512.png`, `basic-logo.png`).
2. Timpa juga berkas di `assets/favicon/` bila ingin favicon ikut berubah.
3. `git add . && git commit -m "Ganti logo" && git push`

Tidak ada satu pun logo yang digambar lewat kode — semuanya berkas gambar, jadi bentuk aslinya tidak pernah berubah.

## Halaman yang tersedia

| Alamat | Isi |
|---|---|
| `#/katalog` | Katalog produk (reguler & pre-order) |
| `#/produk/<id>` | Detail produk — bisa dibagikan sebagai tautan |
| `#/keranjang` | Keranjang belanja |
| `#/checkout` | Checkout 3 langkah |
| `#/konfirmasi` | Nomor pesanan, rekening, unggah bukti bayar |
| `#/status` | Lacak pesanan dengan nomor pesanan |
| `#/admin` | Login admin (email + PIN) |
| `#/admin/dashboard` | Ringkasan penjualan & grafik |
| `#/admin/produk` | Kelola produk & stok |
| `#/admin/po` | Kelola periode pre-order |
| `#/admin/pesanan` | Verifikasi pembayaran & status pesanan |

## Menjalankan di komputer sendiri (opsional)

```bash
python3 -m http.server 8000
```
lalu buka `http://localhost:8000`. Membuka `index.html` langsung lewat klik ganda juga bisa,
tetapi memakai server lokal lebih mendekati kondisi asli.
