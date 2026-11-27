import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { logout } from "@/app/auth-actions";

// Membaca cookie sesi membuat komponen ini dinamis. Dengan cacheComponents,
// akses itu harus berada di dalam <Suspense> agar route lain tetap bisa
// diprerender (termasuk /_not-found).
async function MenuNavbar() {
  // Tandai render ini sebagai request-time. Tanpa ini, prerender (termasuk
  // partial prefetch yang sudah punya cookie) ikut menjalankan getUser(),
  // yang memanggil Date.now() di dalam Supabase dan memicu error
  // "blocking-prerender-current-time".
  await connection();
  const user = await getCurrentUser();
  const isAdmin = user?.app_metadata?.role === "admin";

  if (!user) {
    return (
      <>
        <Link href="/booking" className="hover:underline">Booking</Link>
        <Link href="/login" className="hover:underline">Login</Link>
      </>
    );
  }

  return (
    <>
      {isAdmin ? (
        <>
          <Link href="/admin" className="hover:underline">Booking</Link>
          <Link href="/admin/alat" className="hover:underline">Alat</Link>
          <Link href="/admin/denda" className="hover:underline">Denda</Link>
        </>
      ) : (
        <>
          <Link href="/booking" className="hover:underline">Booking</Link>
          <Link href="/riwayat" className="hover:underline">Riwayat</Link>
        </>
      )}
      <form action={logout}>
        <button type="submit" className="text-gray-600 hover:underline" title={user.email ?? undefined}>
          Logout
        </button>
      </form>
    </>
  );
}

export default function Navbar() {
  return (
    <nav aria-label="Navigasi utama" className="flex items-center justify-between border-b px-8 py-4">
      <Link href="/" className="text-xl font-bold">KALA</Link>
      <div className="flex items-center gap-6 text-sm">
        <Suspense fallback={null}>
          <MenuNavbar />
        </Suspense>
      </div>
    </nav>
  );
}
