# Panduan Instalasi BASIC — Backend Apps Script + Frontend GitHub Pages

Dokumen ini dipakai sebagai rujukan. Kita akan menjalaninya **satu langkah setiap kali** lewat
percakapan — tidak perlu mengerjakan semuanya sekaligus.

**Istilah singkat** (muncul nanti):
- **Repository (repo)** — folder proyek di GitHub, semacam Google Drive untuk kode.
- **Commit** — menyimpan perubahan beserta catatannya.
- **Push** — mengirim hasil commit dari komputer ke GitHub.
- **Personal Access Token** — "password khusus" GitHub untuk terminal. GitHub tidak lagi menerima
  password akun biasa saat `git push`.

---

# BAGIAN A — BACKEND (Google Apps Script)

## A1. Buat proyek & tempel kode

1. Buka [script.google.com](https://script.google.com) → **Proyek Baru**.
2. Ganti nama berkas `Code.gs` menjadi **`Kode`**, hapus isinya, lalu tempel seluruh isi `Kode.gs`.
3. Simpan (Ctrl+S).

> Proyek ini **tidak lagi** memerlukan berkas HTML apa pun. Seluruh tampilan sekarang ada di
> GitHub Pages. Apps Script murni menjadi penyedia data (JSON).

## A2. Jalankan setup otomatis — cukup SEKALI

1. Pada dropdown fungsi di toolbar, pilih **`setupAppEnvironment`** → klik **▶ Run**.
2. Saat diminta izin: **Review Permissions** → pilih akun Google Anda → **Advanced** →
   **Go to (nama proyek) (unsafe)** → **Allow**. Ini normal untuk skrip milik sendiri.
3. Buka **Execution log**. Catat yang muncul:
   - URL Spreadsheet `DB_BASIC` dan folder Drive `BASIC_App_Files`
   - **🔑 PIN ADMIN AKTIF** — dipakai untuk login ke panel admin
4. Fungsi ini aman dijalankan berulang kali — ia memeriksa dulu sebelum membuat, jadi tidak
   menduplikasi data.

> **PIN admin selama development: `112233`** (tetap, tidak berubah-ubah).
> PIN dikunci lewat konstanta `ADMIN_PIN_DEV` di bagian atas `Kode.gs`. Selama `KUNCI_PIN_DEV`
> masih `true`, menjalankan `setupAppEnvironment()` berapa kali pun akan selalu mengembalikan PIN
> ke nilai itu — jadi tidak ada lagi PIN acak yang berganti tiap setup.
>
> Lupa atau ragu PIN-nya berapa? Jalankan fungsi **`lihatPinAdmin`** dari dropdown fungsi di
> editor, lalu lihat Execution log. Fungsi itu membaca nilai yang benar-benar tersimpan.

## A3. Deploy sebagai Web App

1. **Deploy → New deployment** → pilih tipe **Web app**.
2. Isi:
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
3. **Deploy** → **salin URL** yang berakhiran `/exec`.

> **Kenapa "Anyone"?** Situs di GitHub Pages berjalan di domain berbeda, jadi API harus bisa
> diakses publik. Aksi admin tetap terlindungi: setiap perintah admin memeriksa token sesi di
> server, dan login PIN dibatasi 5 percobaan gagal per 15 menit.

## A4. Uji backend

Tempel URL `/exec` tadi di browser dan tambahkan `?action=ping`:

```
https://script.google.com/macros/s/XXXX/exec?action=ping
```

Kalau muncul teks JSON berisi `"success":true` dan nama aplikasi, backend sudah hidup. ✅

---

# BAGIAN B — FRONTEND (GitHub Pages)

## B1. Pasang Git

- **Windows:** unduh di [git-scm.com/download/win](https://git-scm.com/download/win), install dengan
  pengaturan bawaan. Setelah selesai, buka **PowerShell** atau **Git Bash** dari Start Menu.
- **Mac:** buka Terminal, ketik `git --version` — kalau belum ada, macOS menawarkan instalasi.
- **Linux:** `sudo apt install git`

Verifikasi:
```bash
git --version
```

## B2. Buat akun GitHub

Daftar di [github.com](https://github.com). Username yang dipilih akan menjadi bagian alamat situs
nanti (`username.github.io/nama-repo`), jadi pilih dengan sadar.

## B3. Setel identitas Git (sekali seumur hidup komputer itu)

```bash
git config --global user.name "Nama Anda"
git config --global user.email "email@akun-github-anda.com"
```

`user.name` bebas — hanya label di riwayat commit, bukan username GitHub.

## B4. Buat repository di GitHub

Di github.com: tombol **+** (kanan atas) → **New repository**
- **Repository name:** misalnya `basic-store`
- **Public** ← wajib, GitHub Pages gratis hanya untuk repo publik
- **JANGAN** centang *Add a README* / *.gitignore* / *license*

Klik **Create repository**, biarkan halaman instruksinya terbuka.

> Aman menjadikannya publik: berkas frontend tidak menyimpan kata sandi apa pun. PIN admin ada di
> Google Sheets, bukan di kode.

## B5. Isi GAS_URL — JANGAN DILEWATI

Ekstrak ZIP frontend. Buka berkas **`js/config.js`** dengan Notepad/TextEdit, ganti barisnya:

```js
const GAS_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
```

dengan URL `/exec` milik Anda dari langkah **A3**. Simpan.

> Kalau langkah ini dilewat, situs tetap terbuka tetapi katalog kosong dan muncul peringatan merah.

## B6. Masuk ke folder yang BENAR

Ini bagian yang paling sering keliru. Folder kerjanya adalah folder hasil ekstraksi ZIP —
yang **langsung berisi `index.html`**, bukan folder induk di atasnya.

```
basic-frontend\          ← ✅ DI SINI (ada index.html di dalamnya)
├── index.html
├── css\
├── js\
└── assets\
```

```bash
cd "C:\path\ke\basic-frontend"
```

> 💡 Cara cepat di Windows: buka folder itu di File Explorer, klik address bar, ketik `powershell`
> lalu Enter — terminal langsung terbuka di folder tersebut.

**Verifikasi sebelum lanjut:**

```powershell
dir
```
(atau `ls -la` di Mac/Linux/Git Bash)

Yang harus terlihat: `index.html`, folder `css`, `js`, `assets`.
Kalau yang muncul justru folder `basic-frontend` atau `backend`, Anda satu tingkat terlalu tinggi —
`cd basic-frontend` dulu.

⚠️ **Git tidak akan protes kalau folder Anda salah.** Semua perintah akan sukses, lalu situsnya 404
tanpa petunjuk apa pun. Karena itu langkah verifikasi ini wajib.

## B7. Push pertama

Jalankan satu per satu:

```bash
git init
```
```bash
git add .
```
> ⚠️ Ada **titik** di akhir — artinya "semua berkas di folder ini". Tanpa titik, tidak ada yang masuk.

```bash
git commit -m "Upload pertama BASIC"
```
```bash
git branch -M main
```
```bash
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
```
(ganti `USERNAME` dan `NAMA-REPO`)

```bash
git push -u origin main
```

Saat diminta:
- **Username:** username GitHub Anda
- **Password:** **Personal Access Token**, bukan password akun

> 💡 Ketika menempel token, **layar tidak menampilkan apa pun** — tidak ada bintang atau karakter.
> Itu normal, bukan tanda gagal. Tempel lalu tekan Enter.

Tanda berhasil: muncul `Writing objects: 100%` dan `* [new branch] main -> main`.

## B8. Membuat Personal Access Token (kalau diminta)

Kalau muncul `Password authentication is not supported`:

1. Buka [github.com/settings/tokens](https://github.com/settings/tokens)
2. **Generate new token** → **Generate new token (classic)**
3. Isi **Note** bebas (misal `git-push`), **Expiration** 90 hari
4. Centang scope **`repo`** ← wajib
5. **Generate token**, lalu **salin** token `ghp_...` (hanya tampil sekali — simpan di Notepad)
6. Ulangi `git push -u origin main`, tempel token sebagai password

Kalau terminal terasa terlalu merepotkan, alternatif visual: pasang
[GitHub Desktop](https://desktop.github.com) → **Add Local Repository** → pilih folder →
**Publish repository**.

## B9. Aktifkan GitHub Pages

1. Buka repo Anda di github.com. **Periksa dulu:** `index.html` harus terlihat di daftar paling
   atas, bersama folder `css`, `js`, `assets`. Kalau yang terlihat malah folder `basic-frontend`,
   berarti folder yang ter-push salah — lihat bagian Pemulihan di bawah.
2. **Settings** (tab kanan) → **Pages** (menu kiri)
3. Isi:

   | Kolom | Nilai |
   |---|---|
   | Source | **Deploy from a branch** |
   | Branch | **main** · **/ (root)** |

4. **Save**, tunggu 1–2 menit, refresh. Akan muncul:
   > Your site is live at `https://USERNAME.github.io/NAMA-REPO/`

## B10. Uji situs

Buka alamat tersebut. Periksa:

- [ ] Logo BASIC tampil di header
- [ ] Katalog produk muncul (bukan pesan merah)
- [ ] Klik satu produk → detail terbuka, alamatnya berubah jadi `#/produk/...`
- [ ] Tambah ke keranjang → ikon keranjang menampilkan angka
- [ ] Checkout sampai dapat nomor pesanan → cek Google Sheets, baris baru masuk
- [ ] Unggah bukti bayar → cek folder Drive `Bukti-Pembayaran`
- [ ] `#/admin` → login dengan email admin + PIN dari langkah A2
- [ ] Buka di layar HP — tata letak tetap rapi

---

# Cara update situs setelah ada perubahan

Dari folder frontend:
```bash
git add .
git commit -m "Deskripsi singkat perubahan"
git push
```
GitHub Pages membangun ulang dalam 1–2 menit. Kalau masih tampil versi lama, itu cache browser —
tekan **Ctrl+Shift+R** atau buka di jendela Incognito.

⚠️ Kalau yang diubah adalah **`Kode.gs`** (backend), jangan lupa di Apps Script:
**Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.**
Tanpa ini, perubahan backend tidak berlaku.

---

# Pemulihan: situs 404 padahal semua perintah berhasil

Gejala: halaman **404 — File not found**, tidak ada pesan error sama sekali, dan di repo GitHub yang
terlihat di root justru **folder** (bukan `index.html`).

Penyebabnya: `git init` dijalankan di folder induk, bukan di folder frontend.
Tidak perlu menghapus repo — cukup push ulang dari folder yang benar:

```powershell
cd "C:\path\ke\basic-frontend"
dir
```
Pastikan `index.html` terlihat. Lalu:

```powershell
git init
git add .
git commit -m "Fix: push dari folder frontend"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main --force
```

`--force` menimpa isi repo dengan versi lokal. Aman di sini karena isi lama memang strukturnya
salah — tapi perlu Anda ketahui apa yang sedang dilakukan, bukan sekadar menyalin perintah.

---

# Halaman Diagnostik — cek dulu sebelum menebak

Situs punya halaman bawaan untuk memeriksa sambungan ke backend:

```
https://USERNAME.github.io/NAMA-REPO/#/diagnostik
```

Bisa juga dibuka lewat tombol **Tes Koneksi Backend** di halaman login admin — sengaja diletakkan
di sana karena justru saat login gagal halaman ini paling dibutuhkan.

Halaman itu menguji GET dan POST secara terpisah, lalu menyimpulkan penyebabnya. Pola hasilnya
punya arti yang berbeda-beda:

| GET | POST | Artinya | Perbaikan |
|:---:|:----:|---|---|
| ✓ | ✓ | Backend sehat, versi cocok | Kalau login masih ditolak, periksa email & PIN — bukan koneksi |
| ✓ | ✓ | Versi backend lebih lama dari yang diharapkan | Deploy → Manage deployments → ✏️ → Version: **New version** |
| ✓ | ✗ | Deployment belum punya `doPost` — **ini penyebab 404 saat login** | Sama seperti di atas: buat **New version** |
| ✗ | ✗ | URL `/exec` sudah tidak berlaku | Salin URL aktif dari Manage deployments ke `js/config.js`, push ulang |
| ✗ | ✗ | Jawaban berupa HTML | Deployment masih kode era HtmlService — buat **New version** |

> ⚠️ Perbedaan yang sering menjebak: **"New deployment" membuat URL `/exec` BARU**, sementara
> **"Manage deployments → Edit → New version"** memperbarui kode di URL yang sama. Untuk pembaruan
> kode, hampir selalu yang Anda butuhkan adalah yang kedua.

Kalau backend sedang tidak bisa dihubungi, sekarang muncul **spanduk merah menetap** di bawah layar.
Sebelumnya kegagalan bisa tersembunyi karena katalog tetap tampil dari salinan di browser.

# Pengaturan Admin — Email Berwenang

Menu **Pengaturan Admin** di panel admin mengelola siapa saja yang boleh login. Datanya ada di sheet
`Admin` dan diperiksa di server saat login — bukan di browser.

Setiap email punya status **Aktif** atau **Nonaktif**. Email nonaktif tetap tercatat tetapi ditolak
saat login. Dua hal sengaja dikunci demi keamanan: Anda tidak bisa menonaktifkan atau menghapus akun
Anda sendiri, dan admin aktif terakhir tidak bisa dihilangkan — supaya tidak ada skenario di mana
semua orang terkunci di luar panel.

Semua admin memakai PIN yang sama (`AppConfig` → `adminPin`).

# Masalah umum lainnya

| Yang terlihat | Sebab | Solusi |
|---|---|---|
| Halaman tampil tapi katalog kosong + peringatan merah | `GAS_URL` belum diisi | Isi `js/config.js`, lalu `git add . && git commit -m "fix config" && git push` |
| "Tidak bisa terhubung ke server" | Web App belum di-deploy, atau akses bukan *Anyone* | Ulangi langkah A3 |
| "Jawaban server tidak dikenali" | URL `/exec` salah, atau backend diubah tanpa deploy versi baru | Cek URL; buat **New version** di Manage deployments |
| Halaman tanpa styling sama sekali | Berkas CSS/JS rata di root, folder `css/` `js/` hilang | Pastikan struktur folder utuh, push ulang |
| `fatal: not a git repository` | Belum `git init` / salah folder | `dir` dulu, pastikan lihat `index.html`, baru `git init` |
| `remote origin already exists` | Sudah pernah disambungkan | Lewati, atau `git remote set-url origin <url>` |
| `Updates were rejected...` | Repo GitHub sudah berisi berkas (README) | `git pull --rebase origin main` lalu `git push` |
| `LF will be replaced by CRLF` | Beda format baris Windows vs Linux | **Abaikan** — ini peringatan biasa, bukan error |
| Foto produk tidak muncul | Foto diunggah lewat panel admin? | Unggah lewat menu **Kelola Produk → Edit → Tambah Foto**, jangan tempel URL Drive manual |
| Login admin ditolak terus | PIN salah, atau email tidak ada di sheet `Admin` | Jalankan `lihatPinAdmin` di editor untuk melihat PIN yang benar-benar aktif; cek juga email Anda ada di sheet `Admin` |
| PIN terasa berubah-ubah | Versi lama mencetak PIN acak baru di log setiap kali setup dijalankan, padahal nilai itu tidak tersimpan | Sudah diperbaiki — PIN kini dikunci `112233` dan log membaca nilai yang benar-benar tersimpan |
| "Terlalu banyak percobaan gagal" | Proteksi brute-force aktif | Tunggu 15 menit, lalu coba lagi |

---

# Pengaturan toko (sewaktu-waktu)

Semua di spreadsheet **`DB_BASIC`**, sheet **`AppConfig`**:

| Key | Fungsi |
|---|---|
| `adminPin` | PIN login admin. Selama development nilainya dikunci `112233`. Untuk menggantinya, jalankan `gantiPinAdmin("pin-baru")` di editor — berlaku seketika |
| `ongkirDefault` | Ongkos kirim flat saat checkout |
| `banks` | Daftar rekening tujuan (format JSON) |
| `adminEmail` | Penerima notifikasi pesanan baru & bukti bayar |
| `waAdmin` | Nomor WhatsApp admin |

Menambah admin baru: tambahkan baris di sheet **`Admin`** (Email, Nama, CommunityID). Admin baru
memakai PIN yang sama.

## Sebelum toko dibuka untuk umum

PIN `112233` sengaja dipasang tetap agar nyaman dipakai selama pengembangan — tetapi nilainya
tertulis di dalam kode, jadi jangan dibawa ke produksi. Dua langkah saat siap rilis:

1. Di `Kode.gs` bagian atas, ubah `const KUNCI_PIN_DEV = true;` menjadi `false`.
2. Jalankan `gantiPinAdmin("pin-rahasia-anda")` sekali dari editor.

Setelah itu PIN tidak akan tersentuh lagi oleh `setupAppEnvironment()`, dan tidak ada PIN asli yang
tersimpan di dalam berkas kode.

---

# Catatan Kecepatan

Apa yang membuat aplikasi ini terasa cepat, dan apa yang wajar terjadi:

**Saat dibuka kedua kali dan seterusnya — katalog tampil seketika.**
Salinan katalog terakhir disimpan di browser pengunjung. Begitu situs dibuka, salinan itu langsung
digambar (tanpa menunggu jaringan sama sekali), lalu versi terbaru diambil diam-diam di latar
belakang dan layar hanya diperbarui kalau memang ada yang berubah. Efek sampingnya: kalau Anda baru
saja mengubah produk, pengunjung mungkin melihat versi lama selama sekejap sebelum layarnya
menyesuaikan. Ini disengaja — jauh lebih baik daripada menatap layar kosong.

**Kunjungan pertama tetap perlu menunggu Apps Script.** Panggilan pertama ke `/exec` harus melewati
pengalihan URL dan, kalau skrip lama tidak dipakai, proses "bangun tidur" (cold start). Ini bawaan
Apps Script dan tidak bisa dihilangkan sepenuhnya. Yang sudah dilakukan untuk menekannya:

- `setupAppEnvironment()` memasang trigger **`warmupCache` tiap 10 menit** yang menyiapkan data
  katalog lebih dulu, sehingga pengunjung jarang menjadi orang yang menanggung cache dingin.
- Seluruh data halaman depan diambil dalam **satu permintaan** (`?action=bootstrap`), bukan
  beberapa permintaan terpisah.
- Hasil rakitan katalog disimpan utuh di cache server, jadi permintaan yang kena cache tidak perlu
  membaca Google Sheets sama sekali.

**Angka yang wajar:** kunjungan pertama sekitar 1–3 detik sampai katalog terisi; kunjungan
berikutnya praktis langsung tampil. Kalau pembukaan pertama terasa jauh lebih lambat dari itu,
periksa dulu apakah trigger `warmupCache` benar-benar terpasang (di editor Apps Script → ikon jam
di sidebar kiri → daftar **Triggers**).

**Jangan hapus trigger `warmupCache`** kalau ingin situs tetap terasa ringan. Beban kuotanya kecil
(sekitar 7 menit waktu eksekusi per hari dari jatah 90 menit).
