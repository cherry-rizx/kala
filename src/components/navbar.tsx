import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="flex items-center justify-between border-b px-8 py-4">
      <Link href="/" className="text-xl font-bold">KALA</Link>
      <div className="flex gap-6 text-sm">
        <Link href="/booking" className="hover:underline">Booking</Link>
        <Link href="/admin" className="hover:underline">Admin</Link>
        <Link href="/riwayat" className="hover:underline">Riwayat</Link>
      </div>
    </nav>
  );
}