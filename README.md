# Kas Kelas — ringkasan proyek (untuk AI / pengembang yang menerima zip ini)

Terakhir diperbarui: 20 Oktober 2026. Bahasa antarmuka dan komentar kode: Bahasa Indonesia.
Pemilik proyek: siswa pengelola kas kelas (Firebase project `kas-kelas-smansa`). Pengguna menulis dalam Bahasa Indonesia.

## 1. Apa ini
Sistem pencatatan kas kelas dengan tiga bagian yang berbagi satu database Firebase:
1. **Aplikasi Android** ("Kas Kelas", paket `com.kaskelas.app`, versi 3.4) — Capacitor 6, satu file `www/index.html`.
2. **Website portal** (folder ini) — satu file `index.html` (+ `firestore.rules`).
3. **Bot Telegram** — Cloudflare Worker `telegram-worker.js`, satu bot untuk banyak ruang/kelas.

Isi zip yang biasanya dikirim bersama:
- Zip web: folder `kas-kelas-website/` (file di bawah).
- Zip/repo APK: `kas-kelas-app-update` (GitHub `BaksoTumpah/kas-kelas-app-update`, branch `main`). Struktur: `www/index.html` (aplikasi),
  `www/jszip.min.js`, `www/nada/` (nada notifikasi), `android/` (proyek native), `capacitor.config.json`, `package.json`,
  `assets/` (ikon), `.github/workflows/build-apk.yml`.

## 2. File di folder website
| File | Fungsi |
|---|---|
| `index.html` | Website portal lengkap (HTML+CSS+JS vanilla, ~3900 baris). Konfigurasi di bagian atas script (Firebase, `DRIVE_API_KEY`, `TG_RELAY_URL`, `TG_RELAY_KEY`). |
| `firestore.rules` | Aturan keamanan Firestore (ditempel manual di Firebase Console -> Firestore -> Rules). |
| `telegram-worker.js` | Kode Cloudflare Worker untuk bot Telegram (ditempel manual di dashboard Cloudflare). |
| `PANDUAN_KONFIGURASI.txt` | Langkah konfigurasi manual setelah update terbaru (Rules, website, Worker, APK, backup otomatis). Panduan lama sudah dikerjakan dan dihapus. |

## 3. Arsitektur dan data
- **Gaya kode:** vanilla JS satu file per aplikasi, tanpa framework/bundler. Aplikasi dan website berbagi banyak logika (disalin, bukan modul bersama).
  Perubahan fitur biasanya harus dibuat di KEDUA `index.html` bila relevan.
- **Firebase Firestore + Anonymous Auth.** Dokumen utama:
  - `tokens/{TOKEN}`: peran (`editor` = Admin, `viewer` = User/lihat saja) dan `roomId`.
  - `kas/{room}`: field `state` (data kas, lihat di bawah).
  - `website/{room}` (+ subkoleksi `gallery`, `photos`, `comments`, `albums`): konten portal.
  - `members/{uid}` = token yang dipakai uid itu (dasar hak tulis: fungsi `isMemberOf`/`isEditorOf` di `firestore.rules`).
  - `config/app` (versi terbaru, tautan unduh APK), `config/dev` (developer), `sessions`, `logs`, `blocks`, `backups`.
- **Bentuk `state`:** `students[{short,long,...,pendingChange}]`; `months[mk]={dates,checks:{idx:{day:{on,checkedAt}}},value,weekdays,holiday}`;
  `expenses[mk]=[{date,desc,amount}]`; `manualIncome[mk]=[{name,date,amount}]`; `appTitle`. `mk` berformat `YYYY-MM`.
- **Peran:** Admin (token editor), User (token viewer, hanya melihat), Developer (login username+token lewat konsol developer, tersembunyi).
  Shortcut rahasia ke login developer: ketuk 5x cepat judul layar login, header menu aplikasi, atau teks versi di Tentang.
- **Bot Telegram (`telegram-worker.js`):** KV binding `KV`; Cron `0 23 * * *`.
  Secret: `BOT_TOKEN`, `SECRET`, `FIREBASE_API_KEY`; opsional `G_CLIENT_ID`, `G_CLIENT_SECRET`, `G_REFRESH_TOKEN` (backup ke Drive).
  Alur: `/start` -> token admin -> perintah per ruang. Perintah: `/tagih /cek /lunas /saldo /hariini /bulanini /pengeluaran /rekap /backup /tunggakan10 /kembalian /bayar /catat /pengumuman /laporan /komentar /online /jadwal /pengingat /logout /bantuan`.
  Perintah yang mengubah data (`/bayar`, `/catat`, `/pengumuman`) meminta konfirmasi `/ya` atau `/batal` (kunci KV `pend:<chat>`, TTL 300 dtk).
  Penulisan ke Firestore lewat REST PATCH dengan `updateMask` dan `updateTime` (anti tabrakan), memakai uid anonim yang didaftarkan di `members/{uid}`.
  Endpoint relay `{k,r,t}` dipakai website/aplikasi untuk mengirim notifikasi ke chat admin (kunci = `SECRET`, sengaja ada di kode klien; BOT_TOKEN tidak pernah di klien).
  `/setup?key=SECRET` memasang webhook dan menu perintah.
- **Backup:** xlsx dibuat tangan (builder OOXML + JSZip di aplikasi, `zipStore`+CRC32 di Worker), satu sheet per bulan plus sheet "Rekap" di akhir.
  `/backup` mengirim ke Telegram dan mengunggah ke Drive (OAuth refresh token, scope `drive.file`, folder "Backup Kas Kelas (nama kelas)", dikonversi ke Google Sheet).
  Aplikasi punya `driveBackupNow` dengan folder yang sama (client OAuth Web yang sama dengan Google Sign-In).
- **Kunci aplikasi (v3.4, hanya aplikasi):** plugin native `KasLock` (`android/.../KasLockPlugin.java`): sidik jari (BiometricPrompt, BIOMETRIC_WEAK),
  NFC tag (format NDEF teks `KASKELAS:<token>`), token manual (diverifikasi otomatis, mendukung tempel dari clipboard). Opsi face unlock SENGAJA dihapus
  (tidak didukung konsisten oleh HP). Kunci hanya menyembunyikan UI; data tidak dienkripsi.
- **Notifikasi pengingat tagih kas:** `@capacitor/local-notifications`, dijadwalkan lokal 4 minggu ke depan (`knPlan`/`knReschedule`), butuh izin alarm tepat waktu (`USE_EXACT_ALARM` ada di manifest).

## 4. Build dan rilis
- **APK:** GitHub Actions `.github/workflows/build-apk.yml` jalan otomatis saat push ke `main` yang mengubah `www/**`, `android/**`, `assets/**`, `capacitor.config.json`, `package.json`.
  Langkah: `npm install`, `cap sync`, naikkan `versionCode = run_number + 100`, `assembleDebug`, unggah artifact `kas-kelas-apk` -> `app-debug.apk`.
- **Penandatanganan:** kunci tetap dari secret GitHub `DEBUG_KEYSTORE_BASE64` (keystore debug: alias `androiddebugkey`, password `android`), dipasang ke `~/.android/debug.keystore`;
  `build.gradle` memakainya untuk `signingConfigs.debug`. SHA-1 tetap: `AF:70:D7:24:07:EB:9D:DF:91:27:14:84:E0:D8:59:46:08:51:F4:9E` (didaftarkan di Google Cloud untuk login Google).
  Workflow GAGAL dengan pesan jelas bila secret bukan keystore valid. Jangan ubah secret itu, kecuali ingin SHA-1 baru (butuh uninstall + daftar ulang).
- **Website:** upload `index.html` ke hosting; `firestore.rules` dan `telegram-worker.js` ditempel manual (Firebase Console / Cloudflare).
- Versi aplikasi: konstanta `KT_VERSION` di `www/index.html`; versi terbaru diumumkan lewat `config/app` (konsol developer).

## 5. Aturan kerja pemilik (penting untuk AI)
- **Jangan push ke GitHub otomatis.** Tunggu konfirmasi eksplisit ("push ke github") kecuali pemilik bilang "langsung push".
- Untuk tiap fitur/perubahan baru: beri simulasi (artifact) aplikasi dan website dengan token demo untuk uji coba; setelah pemilik setuju, push file final tanpa uji ulang.
- Saat push: kirim juga zip website dan jelaskan file mana yang harus diganti beserta langkah manual yang detail, bertahap.
- Pemilik tidak memakai terminal; beri langkah klik demi klik. Jangan pernah meminta BOT_TOKEN, G_CLIENT_SECRET, G_REFRESH_TOKEN, atau file keystore.
- Sandbox tanpa Android SDK: Java hanya bisa dicek sintaksnya, bukan dikompilasi penuh; jangan klaim fitur native sudah teruji di HP asli bila belum.

## 5b. Catatan teknis penting
- **Tema/mode kunci developer** disimpan di `config/app` (`themeAll`, `modeAll`); semua perangkat mendengarkan dokumen itu (`ktWatchConfig`).
  Pendengar sekarang dipasang ulang otomatis bila error (dulu error dibuang diam-diam) dan ada polling cadangan tiap 45 dtk (`ktPollConfig`).
  Jika tema tetap tidak berubah di perangkat lain, penyebab paling mungkin: `firestore.rules` terbaru belum dipublikasikan (aturan `config/app` harus mengizinkan `get` untuk semua perangkat yang tidak diblokir).
- **Tabel centang (aplikasi):** kolom No dan Nama bersifat sticky; sel sticky diberi `z-index:3` supaya kotak centang (centang digambar dengan `::after` posisi absolut) yang digeser ke kiri tersembunyi di bawah kolom nama.

- **Menu aplikasi (hamburger):** "Pengingat Tagih Kas" dan "Kunci Aplikasi" kini berada di dalam "Pengaturan Aplikasi" (token User hanya melihat Kunci Aplikasi); "Cek Versi" ada di halaman Tentang;
  item "Website" membuka alamat tetap `https://kaskelas.web.app/` (kolom URL website dihapus; `state.websiteUrl` tidak dipakai lagi). Emoji di menu sengaja dihapus (gaya tanpa emoji).
- **Multi-kelas:** tiap kelas = satu ruang (`roomId`) dengan token Admin/User sendiri, dibuat developer lewat konsol developer. Data (`kas/{room}`, `website/{room}`), tema/mode kelas, dan tautan bot Telegram (per chat per token admin) terpisah per kelas.
  Yang bersifat global dan hanya dikendalikan developer: `config/app` (mode perbaikan, versi APK, kunci tema/mode semua kelas), hosting website, Firebase project/kuota, dan Cloudflare Worker.

- **Request token custom:** layar login aplikasi punya tautan "Request Token Custom ke Developer" (form: nama lengkap, kelas, absen, sekolah, dan no. WA, semuanya wajib).
  Disimpan di Firestore `tokenRequests/{uid}_{timestamp}` (create oleh siapa saja yang tidak diblokir, baca/ubah/hapus hanya developer; aturan di `firestore.rules`, WAJIB dipublikasikan ulang).
  Konsol developer (aplikasi dan website) punya fitur "Request Token" (daftar, Hubungi WA, tandai selesai, hapus) dan popup saat login bila ada request baru.

- **Bot Telegram KEDUA (developer):** di Worker yang sama; secret `DEV_BOT_TOKEN`; webhook `<worker>/dev` (didaftarkan oleh `/setup`). Alur `/start` -> kirim `username token` developer
  (diverifikasi lewat Firebase Auth `dev@kaskelas.dev`, kata sandi `username:token`, cocok dengan `config/dev.uid`) -> aktif. Hanya refresh token disimpan di KV (`dchat:<chat>`, daftar `devchats`).
  Perintah: `/request`, `/selesai <no>`, `/status`, `/bantuan`, `/logout`. Relay `{k, d:true, r?, t}` dari aplikasi/website (`tgDev`) meneruskan semua kabar (sama dengan `TG_EVENTS` + request token + kelas baru) ke semua chat developer, diawali nama kelas. Bot pertama (admin kelas) tidak diubah.

## 6. Status terakhir (20 Okt 2026)
- Sudah ter-push (commit terakhir `1d1a48d`): kunci aplikasi (sidik jari, NFC, token + tempel), hapus face unlock, perbaikan popup pengingat, format kembalian `0,5k`,
  penjadwalan pengingat lebih andal, kunci tanda tangan tetap + pengecekan secret, shortcut rahasia developer, perbaikan penerimaan tema/mode kunci developer, perbaikan centang menimpa kolom nama.
- Konfigurasi yang masih perlu dikerjakan pemilik: lihat `PANDUAN_KONFIGURASI.txt` (publikasi `firestore.rules`, deploy website, perbarui kode Worker, pasang APK, aktifkan backup otomatis).
- Diketahui: update APK hanya bisa menimpa jika aplikasi terpasang ditandatangani kunci tetap yang baru; pemasangan pertama dengan kunci ini wajib uninstall sekali.

## Riwayat Perubahan, Backup Otomatis, Notifikasi Developer (v3.5)
- **Persetujuan perubahan keuangan**: perubahan dari WEBSITE (tambah pemasukan/pengeluaran, Lunas, ubah/tambah/hapus tunggakan, hitung ulang) TIDAK langsung menulis data. Website menulis dokumen `status:'pending'` ke `kas/{room}/changes/{id}` (`submitChange()`). Aplikasi (editor) mendengarkan (`chgWatch`), memunculkan popup, dan menu **Riwayat Perubahan** punya tombol Konfirmasi/Tolak (`chgConfirm/chgReject/chgApply`). Baru setelah Konfirmasi data ditulis. Perubahan dari aplikasi & bot dicatat `applied` (log saja).
- Efek Konfirmasi: Lunas pada tanggal terjadwal = mencentang siswa itu di tabel aplikasi; "Tambah tunggakan" pada tanggal yang sudah tercentang = menghapus centangnya. Ini hanya ditegakkan di sisi klien (aturan Firestore tidak membedakan website vs aplikasi).
- **Backup otomatis**: aplikasi menyimpan `state.autoBackup={on,days}` dan mendaftarkannya ke Worker (relay field `ab` -> KV `ab:<room>`). Cron 07:00 WITA menjalankan `runAutoBackups`: unggah ke Drive `Backup Kas Kelas (nama)/Backup Otomatis`, lalu hapus file backup otomatis sebelumnya (hanya nama berawalan `Kas Kelas (Backup Otomatis)`; backup manual tak tersentuh).
- **Notifikasi developer**: hasil backup otomatis, gagal backup/cron/bot, perubahan menunggu konfirmasi, dan pengingat harian request token belum diproses.
- Aturan baru di `firestore.rules`: `kas/{roomId}/changes/{cid}`.
- **Kas Kegiatan** (v3.5): `state.kegiatan=[{id,name,target,iuran,closed,entries:[{id,type:'in'|'out',date,name,amount,si,nm}]}]` di `kas/{room}.state`. Dikelola di aplikasi (menu Kas Kegiatan, fungsi `kg*`), ditampilkan baca-saja di website (`renderKegiatanWeb`). Terpisah dari kas rutin; belum ikut file backup .xlsx.
- **Akun Google per kelas untuk backup server** (v3.5): login Google di aplikasi (`driveSignIn`, `forceCodeForRefreshToken:true`) menghasilkan `serverAuthCode`; aplikasi mengirimnya + token Admin ke Worker (relay field `gl`, `glHandle`), Worker menukarnya jadi refresh token dan menyimpannya di KV `gt:<room>`. `gToken(env, roomId)` memakai akun kelas itu untuk backup otomatis dan /backup Telegram; kelas yang belum tersambung memakai akun global `G_REFRESH_TOKEN` (kelas yang sudah tersambung tidak pernah jatuh ke akun global). `G_CLIENT_ID`/`G_CLIENT_SECRET` HARUS Web client yang sama dengan `serverClientId` di `capacitor.config.json`. Belum diuji di perangkat sungguhan; scope `drive.file`.
- **Bot developer diperluas** (v3.5): `/kelas /cari /info /kirim /backup /jadwal /status /ping /log /perbaikan /versi /hidup /mati /notif /uji` (`devCommand` di worker). `/hidup` `/mati` = notifikasi anggota LOGIN saja (`login_ok`, atau teks berawalan "✅ Login berhasil" untuk klien lama); notifikasi penting lain selalu masuk. Bot admin juga punya `/hidup` `/mati` (field `login` pada KV `chat:<id>`, default hidup).
- **Keandalan notifikasi developer**: `sendRetry` (429 retry_after, 5xx), antrean KV `dq` untuk pesan yang gagal terkirim (`flushDevQueue` jalan tiap relay masuk dan tiap cron), `devAccess` tidak lagi memutus chat saat gangguan sementara, pembatas laju di memori (`overLimit`; login 40/10 mnt, penting 300/10 mnt) agar tidak memakai jatah tulis KV. Tugas harian cron dijalankan sekali per hari (penanda KV `daily:<tgl>`, mulai 07.00 WITA) sehingga aman bila ditambah cron `*/5 * * * *` untuk pengiriman ulang lebih cepat.
- Relay kini membawa field `y` (jenis kabar) dari aplikasi/website.


## Pembaruan keamanan (v3.5)
- Bot developer: `/storage` (`/penyimpanan`) menampilkan ukuran data tiap kelas terhadap batas 1 MB per dokumen Firestore.
- Relay memakai `RELAY_KEY` terpisah dari `SECRET` (opsional secret Worker `RELAY_KEY`; `RELAY_LEGACY=off` menutup SECRET lama setelah semua APK diperbarui).
- Pendaftaran jadwal backup otomatis (`ab`) wajib membawa token admin.
- Antrean backup otomatis (`abq`) dengan 3x percobaan ulang; cron opsional `*/5 * * * *` untuk pengiriman ulang lebih cepat.
- Validasi data perubahan (`chgValidate`), escape HTML pada semua teks pengguna, peringatan ukuran data (80%/95%), simpan otomatis saat aplikasi disembunyikan dan setelah Konfirmasi.
- Backup `.xlsx` memuat sheet Kegiatan. `KT_VERSION` = 3.5.
- Cadangkan keystore APK di tempat aman.

## Versi 3.7
- Jam backup otomatis dapat dipilih per kelas (bawaan 15:00 WITA): relay `ab:{t,on,days,hour}` -> KV `ab:<room>`. Pemeriksaan tiap jam (`abh:<tgl>-<jam>`), penanda per kelas `abd:<room>`. Wajib Cron Trigger `0 * * * *` (atau `*/5 * * * *`).
- Mode Demo di aplikasi (`startDemo`, token `DEMOADMN`/`DEMOUSER`): data contoh di memori, `KT_DEMO` memblokir penyimpanan lokal, Firebase, Telegram, relay.
- Hapus pemasukan manual/pengeluaran satu per satu dengan konfirmasi (`delEntry`).
- Logo bawaan = ikon celengan (aplikasi `logo.png`, website data URI).
- Akun Google dipulihkan otomatis (`driveRestore`, `plugin.refresh`) sampai `driveSignOut`.
- `versionName` APK ikut `KT_VERSION` (workflow build-apk.yml).

## Versi 3.8
- Worker: `/perubahan`, `/yes [n|semua]`, `/no [n|semua]` menerapkan/menolak perubahan website (`kas/<room>/changes` status pending) dengan aturan sama seperti aplikasi (`chgBadText`, `applyChange`, klaim `setChangeStatus` memakai prasyarat updateTime). Tanpa perubahan website, `/yes` `/no` bekerja seperti `/ya` `/batal`. Notifikasi `change` ke admin kini memuat petunjuk /yes /no.
- Aplikasi: tombol ubah (pensil) pemasukan manual/pengeluaran (keterangan, jumlah, tanggal, jam `time`), hapus di dalam dialog ubah. Website tetap hanya menambah lewat antrean konfirmasi.
- Link "Coba Mode Demo" dipindah ke bawah Request Token, ukuran kecil.

## Versi 3.9
- Tarif per tanggal: `months[mk].rates={hari:nominal}` (hanya tanggal yang beda dari `value`) dan `ranges=[{from,to,amount,wd}]` (untuk diedit ulang). Semua hitungan memakai `rateOf(m,hari)` di aplikasi, website, dan Worker (tunggakan, pemasukan, kembalian, centang lewat bot/konfirmasi, backup). Bulan tanpa `rates` berperilaku seperti sebelumnya.
- UI: Menu Nilai & Jadwal Checklist > Tarif berbeda per tanggal (`rngApply`). Mengganti/menghapus kolom tanggal ikut memindah/menghapus tarifnya.

## Versi 3.9.1
- Pengingat tagih kas (notifikasi aplikasi `knIsCollectionDay` dan pengingat harian Worker `isTagihDay`) kini HANYA mengikuti tanggal kolom centang yang ada di bulan itu (dan bukan hari libur). Pola hari mingguan (`weekdays`) tidak lagi dipakai sebagai cadangan; bulan tanpa kolom tanggal tidak punya pengingat.

## Versi 3.9.2
- Kolom tanggal diberi warna per kelompok tarif (`rateGroups`, `rateColorMap`, palet 6 warna) di aplikasi dan di tabel Data Kas website, lengkap dengan keterangan warna (nominal + rentang tanggal). Hanya muncul bila satu bulan punya lebih dari satu tarif; hari libur tetap merah.

## Versi 3.9.3
- Semua kolom nominal diberi label dan petunjuk yang jelas (Nominal kas per kotak checklist, Jumlah pemasukan/pengeluaran/tunggakan) beserta contoh isian, di aplikasi dan website.

## Versi 3.9.4 (belum dirilis)
- Worker: `backupTick(env, via, force)` dipanggil dari `scheduled` dan (cadangan, maks. tiap 5 menit) dari `fetch` lewat `ctx.waitUntil`; `cron:last` kini `{at, via}`; `abl:<room>` mencatat backup otomatis terakhir; `/jadwal` developer menampilkan diagnosis cron.
- Aplikasi: Bersihkan Riwayat (`chgClearHistory`), Hapus Semua Data Kecuali Siswa (`openWipe`; opsi "Tanpa Terkecuali" dihapus, gunakan Reset Semua Data, konfirmasi 2x + ketik token Admin, `wipeDo` juga mengosongkan data website dan riwayat perubahan).

- Backup otomatis: `enqueueAutoBackups` tanpa penanda per jam; `qUpdate` + klaim percobaan sebelum `autoBackupRoom`; `abs:<room>` status terakhir; penghapusan file lama berdasarkan urutan nama/ID; developer `/cekbackup`.
- Backup `.xlsx` (aplikasi `buildWorkbook` dan Worker `kasXlsx`) memuat sheet tersembunyi `_DATA` (JSON lengkap, dipecah per 30.000 karakter, non-ASCII di-escape). Aplikasi: `readBackupData`, `restorePicked`, `restoreDo` (konfirmasi + ketik token).
- Menu token User: `updateReadOnlyUI` menyembunyikan `mi-tgbot`, `mi-appsettings`, `mi-history`, `mi-siswaH`; `mi-website` tampil.
- Bot: `/datasiswa` (admin dan developer) memakai `siswaList`.
- Jadwal backup otomatis kini `{on,days,hour,min}` (app `abCfg`, input `type=time`; Worker `abHM`); notifikasi admin per percobaan gagal.
- Fitur 3.9.7 (belum dirilis): `PdfDoc`/`buildReportPDF`/`exportPDF` (PDF tulis-tangan tanpa pustaka), `stuRowShow` (cari/filter), `waOpen`, `proofUploadFile`/`proofLink` (app) & `webProofUpload`/`renderKasDetail`/`kasPrint` (web), `myName` (`kk_myname`), Worker `proofUpload` (relay `{proof}`), `birthdayList`, `lowBalanceCheck` (`lb:`/`lbw:`), `payHistory`, `/undo` (KV `undo:<room>`), PWA (`manifest.webmanifest`, `sw.js`).
- Popup `glGate`/`modal-glwarn`: admin tanpa akun Google tersambung (status server `linked:false`) diperingatkan; snooze 6 jam (`kk_glsnooze`).
- Deploy Worker otomatis: `.github/workflows/deploy-worker.yml` (API upload + keep_bindings) dari `worker/telegram-worker.js` di repo aplikasi; butuh secret CLOUDFLARE_API_TOKEN & CLOUDFLARE_ACCOUNT_ID.
- Backup otomatis: dilewati hanya bila sudah ada backup berhasil SETELAH jam jadwal hari ini (abl.at >= jadwal); penanda abd = tanggal@jam:menit, jadi mengganti jam ke lebih siang menjalankan backup lagi.
- Bot developer `/kirim`: pemisah `|` (`/kirim XI IPS 2 | pesan`), tetap menerima `/kirim <kelas> <pesan>`.

## Versi 3.9.8
- Tutup buku bulanan: `state.closedMonths={'YYYY-MM':{at,by}}`; aplikasi (guardClosed/isClosed), validasi perubahan web/bot (chgValidate, chgBadText), `/bayar` dan `/catat` di Worker menolak bulan tertutup; website memblokir tambah data; PDF diberi cap.
- Kategori pengeluaran: `state.expCats` (template bawaan), field `cat` pada `expenses[mk][]`; modal kelola kategori, rekap per kategori (app, PDF, WA, `/kategori`), `/catat ... #kategori`, website pilih kategori.
- Impor siswa dari .xlsx/.csv (modal `impstu`, parser header otomatis, serial tanggal Excel, NISN dipad 10 digit, mode gabung/ganti) + unduh contoh `contoh-data-siswa.xlsx`.
- Ekspor data siswa (.xlsx) di menu Siswa (`exportStudents`), format sama dengan impor. Developer: `config/app.loginOff={absen,nisn}` diatur lewat kartu "Opsi Login" (`dvRenderLoginOpt`); layar login website memakai `loginOffApply()` (overlay + `inert`, peringatan lewat `loginOffWarn()`, guard juga di `doLogin`).
- Lapor ke developer: koleksi `adminReports/{uid}_{ts}` {msg,who,kelas,roomId,src:'app'|'web'|'bot',status,createdAt,ver} (rules: create oleh perangkat, read/update/delete hanya developer). Klien `reportSend()` (app & web) + relay Telegram developer; bot admin `/lapor`, bot developer `/laporan` & `/selesailapor`; panel developer kartu "Laporan Admin" (`dvRenderReports`).


## Asisten AI (4.0.0)
Menu "Asisten AI" (aplikasi) menjawab pertanyaan cara pakai. Alur: aplikasi POST `{k, ai:{t:token, q, h}}` ke Worker; Worker memeriksa `tokens/<TOKEN>` (admin atau user), batas harian KV `aiq:<room>:<tanggal>` (default 25), lalu memanggil `env.AI.run` (Workers AI, binding `AI`) dengan prompt sistem `AI_SYSTEM` (panduan aplikasi). Tanpa binding, Worker membalas pesan ramah. deploy-worker.yml menambahkan binding AI, dan jatuh ke deploy tanpa binding bila ditolak. Perbarui `AI_SYSTEM` setiap ada fitur baru.

## Integrasi Tugas (tugas + jadwal)
Aplikasi Tugas (TaskReminder, v1.2.0) menyinkronkan tugas dan jadwal lewat endpoint relay `ns` di Worker: POST `{k, ns:{t:token, tasks, lessons, del:{tasks,lessons}}}` -> `{ok, role, tasks, lessons, del}`. `nsSync` memakai `fsUpdate` ke `website/{room}` (field `tugas`, `tugasDel`, `schedule`, `scheduleDel`); token editor menggabung (LWW per id dengan `u`, tombstone 60 hari), token user hanya membaca. Id jadwal lama tanpa id dibuat stabil dengan `nsHashId`. Website: kartu Tugas di Beranda, bagian Tugas di halaman Jadwal (admin: tambah/centang/hapus), jadwal punya kolom ruang dan hari Minggu. Bot: `/tugas`. Perbarui `AI_SYSTEM` bila fitur berubah.

## Token ketiga: Admin Kelas (staff)
`tokens/<TOKEN>.role` kini `'editor'|'viewer'|'staff'`. `staff` hanya dibuat developer (panel dv: `dvAddStaffToken`, kolom `#dvCSt`; editor tidak bisa membuatnya: rules token create hanya editor/viewer; `peers` tidak memuat staff; `ktRegisterPeer` menolak staff). Klien website: `isStaff()` (editor atau staff) untuk pengumuman, jadwal, tugas, galeri/album, kontak; `isAdmin()` tetap editor-only untuk keuangan, siswa, token, tema; elemen `.adm-only` disembunyikan bagi staff. APK: `isReadOnly()` = bukan editor, `roleLabel()` 'Admin Kelas'. Rules: `isStaffOf(room)` dipakai untuk `albums`; `sessions.kind` menerima 'staff'; `kas/*` tetap `isEditorOf`. Worker: `nsSync` mengizinkan staff menulis tugas/jadwal; `verifyAdmin` tetap editor-only. Aplikasi Tugas: role `staff` diperlakukan seperti editor (`Sync.readOnly`).

## Asisten AI developer (bebas topik)
Konsol Developer punya tombol 🤖 (`dvAiOpen/dvAiSend`) yang memanggil relay `ai:{dev:<Firebase ID token>, q, h, s}`. Worker `verifyDevIdToken` memeriksa token lewat `accounts:lookup` dan email `dev@kaskelas.dev`; bila valid memakai `AI_SYSTEM_DEV` (tanpa kunci topik, batas 1000/hari). Admin/Admin Kelas/Anggota tetap memakai `AI_SYSTEM` + penjaga topik; `AI_TOPIC_LOCK=off` membebaskan semuanya (bawaan sekarang terkunci).

## Animasi menu samping (APK, perombakan kelancaran)
Penyebab patah sebelumnya: `box-shadow` besar ikut dianimasikan (repaint tiap frame), overlay memakai `display:none` + animasi, dan render tampilan/modal berat berjalan di frame yang sama dengan animasi tutup menu. Sekarang: hanya `transform`/`opacity` yang dianimasikan (lapisan GPU, `will-change`), bayangan tetap, menu/overlay disembunyikan lewat `visibility`, kurva iOS `cubic-bezier(.32,.72,0,1)`, item menu muncul bertahap (`menuIn`), geser ke kiri untuk menutup (mengikuti jari; IIFE setelah `toggleMenu`), dan `menuDefer()` menunda `openView`/`openModal` ±150 ms bila menu sedang terbuka. Bayangan `.bnav` dikecilkan (satu `drop-shadow` 14px).

## Navigasi bawah (APK): bulatan pemilih bergeser
Bulatan hijau tidak lagi "muncul" (animasi pop) di menu baru, tetapi bergeser halus dari menu lama ke menu terpilih. `slideTo()` (IIFE navigasi bawah) menganimasikan variabel CSS `--nx` lewat requestAnimationFrame (ease-out, 320-520 ms) sehingga bulatan dan lekukan bilah bergerak bersama; ikon di dalam bulatan memudar lalu berganti. Pertama kali tampil / `prefers-reduced-motion`: langsung di tempat.

## Gerak ala iPhone (APK)
`--ease` kini kurva iOS `cubic-bezier(.32,.72,0,1)`. Bulatan navbar memakai simulasi pegas (kekakuan 260, redaman 24). Jendela modal: muncul `popIn` .46s, tutup dengan animasi keluar (`closeModal` menambah kelas `closing` 210 ms, `openModal` membatalkannya). Halaman masuk `rise` .42s. Tekan tombol: skala .96 cepat lalu kembali. Menu samping: lempar ke kiri (kecepatan > .5 px/ms) menutup walau belum jauh.
