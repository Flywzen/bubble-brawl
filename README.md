# Bubble Brawl

Game multiplayer realtime: sabun kartun saling dorong sampai jatuh dari wastafel. 2-8 pemain, 3 ronde, skor 3/1/0 poin, ada rematch.

## Isi repo
| Folder/file | Fungsi |
|---|---|
| `1-backend/` | server Node + WebSocket (fisika, room, skor). Dideploy ke **Render**. |
| `2-frontend/` | `index.html` + `config.js` (alamat server). Dideploy ke **Netlify**. |
| `netlify.toml` | untuk Netlify yang terhubung ke repo ini: `publish = "2-frontend"`. |

Frontend dan backend dipasang di dua layanan berbeda, jadi game tidak jalan hanya dengan hosting statis.

## Jalankan lokal (satu layanan, tanpa Netlify)
```
cd 1-backend
npm ci
mkdir public            # Windows: md public
cp ../2-frontend/index.html public/index.html     # Windows: copy ..\2-frontend\index.html public\
npm start               # buka http://localhost:3000 di dua tab/jendela
```
Tes otomatis backend: `npm test` (di `1-backend`; `test.js` = alur game, `test-faucet.js` = aturan faucet).

## Deploy singkat
1. **Render:** New -> Web Service -> repo ini. Root Directory `1-backend`, Build `npm ci`, Start `npm start`, plan Free, region Singapore, Health Check Path `/health`. Salin URL-nya.
2. **Frontend:** isi URL Render di `2-frontend/config.js` (`window.BRAWL_SERVER = "https://...onrender.com"`), lalu seret folder `2-frontend` ke https://app.netlify.com/drop (atau hubungkan repo ini ke Netlify; `netlify.toml` sudah mengatur folder publish).

## Aturan faucet
Di arena wastafel, faucet menyemprot (peringatan garis putih 1,2 dtk, semprotan 1,5 dtk, mulai detik ke-8, ulang tiap 10 dtk) **hanya sebelum air mulai menyusut** (detik ke-15). Begitu shrinking mulai, faucet mati dan gush yang sedang berjalan dibatalkan. Diuji di `test-faucet.js`.

## Hasil pengujian (apa adanya)
Pemeriksaan otomatis (WebSocket, tanpa browser): `npm test` lolos semua (27 pengecekan).

Pengujian browser (Chromium headless, dua konteks terpisah, frontend dan backend di port berbeda): buat room, join lewat link undangan, gerak keyboard, tombol DASH sentuh, joystick sentuh, 3 ronde (skor 9-0), layar akhir, rematch, putus-sambung otomatis, host keluar di UI. Lolos pada run-run terpisah; satu run penuh berulang kali terhenti karena Chromium headless di lingkungan uji crash, bukan karena game.

Belum diuji / batasan:
- Dua orang di perangkat berbeda lewat internet pada URL publik.
- Tampilan layar HP sungguhan saat bermain.
- Reload halaman penuh (pemulihan sesi dari sessionStorage).
- Render Free tidur setelah 15 menit tanpa trafik (bangun sekitar 1 menit); room di memori hilang saat server tidur/restart.

## Catatan bug
**Bug 1 (blocker, ada sejak v5): tombol Create/Join tidak bisa diklik.** Kartu lobi kosong menutupi kartu Home saat pertama dibuka karena `#lobby` tidak punya atribut `hidden`. Diperbaiki: `<div id="lobby" class="scr" hidden>`. Tes ulang: room berhasil dibuat dan alur 3 ronde lengkap lolos.
