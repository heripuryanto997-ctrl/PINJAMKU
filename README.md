# PINJAMKU — Google Apps Script + Vercel

Aplikasi pencatatan pinjaman dan angsuran dengan role administrator/anggota.

## Struktur
- `gas/Code.gs`: backend Apps Script dan API.
- `gas/appsscript.json`: manifest Apps Script.
- `index.html`: frontend responsif.
- `api/gas.js`: proxy Vercel ke Apps Script.
- `vercel.json`: konfigurasi routing.

## A. Siapkan Google Apps Script
1. Buka https://script.google.com/ lalu buat project baru bernama `PINJAMKU Backend`.
2. Salin isi `gas/Code.gs` ke file `Code.gs`.
3. Pada Project Settings, atur Time zone menjadi `Asia/Jakarta`.
4. Pilih fungsi `setupPinjamku` lalu klik Run. Berikan izin akses Google Sheets.
5. Buka Executions/Logs atau lihat hasil Logger untuk URL spreadsheet database yang dibuat.
6. Deploy > New deployment > Web app.
7. Execute as: **Me**. Who has access: **Anyone** (atau pilihan akses publik yang tersedia pada akun Anda).
8. Klik Deploy dan salin URL Web App yang berakhiran `/exec`.

## B. Siapkan GitHub dan Vercel
1. Buat repository GitHub baru, misalnya `pinjamku`.
2. Upload seluruh isi folder proyek ini (folder `gas` juga boleh disimpan sebagai arsip sumber).
3. Import repository ke Vercel.
4. Framework preset pilih **Other**. Build command dan output directory dikosongkan.
5. Di Vercel > Project > Settings > Environment Variables, tambahkan:
   - Name: `GAS_URL`
   - Value: URL Web App Apps Script `/exec`
   - Environment: Production, Preview, Development.
6. Deploy / Redeploy. Buka domain Vercel.

## C. Login awal
- Username administrator: `admin`
- Password awal: `admin123!`
- Segera buka menu Ganti Password setelah login.

Anggota yang dibuat admin memperoleh ID otomatis (AGTxxxxxxx). Password awal anggota adalah ID anggota, kecuali admin mengisi password sendiri saat menambahkan anggota. Sampaikan ID dan password kepada anggota secara pribadi.

## D. Aturan perhitungan
- Bunga flat total = pokok × (bunga bulanan / 100) × tenor.
- Total kewajiban = pokok + bunga total.
- Angsuran bulanan = total kewajiban / tenor.
- Tenor dibatasi 1–10 bulan.
- Admin dapat menyesuaikan nilai pembayaran aktual ketika mencatat angsuran.
- Satu nomor angsuran hanya dapat dicatat satu kali per pinjaman.
- Anggota hanya menerima data pinjaman, pembayaran, dan laporan miliknya dari backend.

## E. Catatan penting sebelum dipakai
- Uji aplikasi dengan akun percobaan terlebih dahulu.
- Jangan bagikan password admin.
- Spreadsheet database harus tetap dimiliki akun Google pengelola.
- Jika mengubah kode Apps Script setelah deploy, lakukan Deploy > Manage deployments > Edit > New version > Deploy.
- Apps Script web app dengan akses Anyone berarti endpoint dapat dijangkau publik; data tetap diperiksa melalui token sesi dan role pada backend.
- Cache sesi Apps Script dapat kedaluwarsa setelah sekitar 6 jam; pengguna harus login kembali.
- Backup spreadsheet secara berkala.

## F. Batasan versi awal
Versi awal ini sudah menyediakan CRUD anggota, pinjaman, pencatatan angsuran, laporan, pemasukan/pengeluaran, dashboard, dan ganti password. Pengeditan pinjaman yang sudah memiliki pembayaran sengaja diblokir untuk menjaga integritas transaksi. Penghapusan anggota yang memiliki riwayat pinjaman juga diblokir.
