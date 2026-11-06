insert into public.ketentuan (versi, isi)
values (
  '1.0',
  $ketentuan$
KETENTUAN SEWA ALAT PENDAKIAN KALA (versi 1.0)

1. Booking
Pelanggan wajib membayar uang booking sebesar Rp20.000 melalui pembayaran online sebelum batas waktu yang ditentukan. Booking yang belum dibayar sampai batas waktu akan dibatalkan secara otomatis.

2. Pembatalan dan refund
a. Pembatalan dilakukan paling lambat 7 hari (H-7) sebelum tanggal sewa: uang booking dikembalikan 100%.
b. Pembatalan dilakukan kurang dari H-7: uang booking tidak dikembalikan (hangus).

3. Kehadiran
Jika pelanggan tidak datang sesuai jadwal pengambilan alat, uang booking hangus.

4. Jaminan
Saat pengambilan alat, pelanggan wajib menyerahkan KTP, SIM, atau kartu pelajar. Dokumen ini ditahan sebagai jaminan sewa dan dikembalikan setelah alat dikembalikan dan seluruh denda (jika ada) sudah lunas.

5. Sisa pembayaran
Sisa biaya sewa dibayar di lokasi sesuai metode pembayaran yang tersedia.

6. Denda kerusakan dan kehilangan
a. Alat hilang atau rusak 100%: denda sebesar 100% dari harga barang.
b. Alat rusak sebagian: denda sebesar persentase kerusakan dikali harga barang. Contoh: kerusakan 50% dikenakan denda 50% dari harga barang.
c. Denda wajib dilunasi sebelum kartu jaminan dikembalikan. Penyewaan dianggap belum selesai selama denda belum lunas.

7. Pelunasan denda dan tindakan lanjutan
a. Jika denda belum dilunasi, pelanggan akan menerima peringatan tertulis.
b. Pelanggan yang tetap tidak melunasi denda setelah peringatan dapat ditangguhkan ke jalur hukum, sesuai kesepakatan yang disetujui saat booking.

8. Persetujuan
Dengan mencentang persetujuan saat mengirim booking, pelanggan dianggap telah membaca dan menyetujui seluruh ketentuan ini.
$ketentuan$
)
on conflict (versi) do nothing;