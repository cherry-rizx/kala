import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/supabase/session";

// Dipanggil di setiap halaman admin, dekat dengan pengambilan data.
// Cek di layout saja tidak cukup: layout tidak dirender ulang saat navigasi
// dan tidak mencegah segmen page ikut dirender ke RSC payload.
export async function wajibAdmin() {
  await connection();

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.app_metadata?.role !== "admin") redirect("/booking");
  return user;
}
