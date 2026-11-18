"use server";

import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/session";

type ModeLogin = "login" | "daftar";
type HasilLogin = { ok: false; error: string };

export async function masuk(emailInput: string, password: string, mode: ModeLogin): Promise<HasilLogin> {
  const email = typeof emailInput === "string" ? emailInput.trim() : "";
  if (!email || typeof password !== "string" || password.length < 6) {
    return { ok: false, error: "Email atau password tidak valid." };
  }

  const supabase = await createSessionClient();
  const { data, error } = mode === "login"
    ? await supabase.auth.signInWithPassword({ email, password })
    : await supabase.auth.signUp({ email, password });

  if (error) return { ok: false, error: error.message };
  if (!data.user || !data.session) {
    return {
      ok: false,
      error: mode === "daftar"
        ? "Akun dibuat, tetapi sesi belum aktif. Periksa email untuk menyelesaikan konfirmasi akun."
        : "Login berhasil diproses tetapi sesi tidak terbentuk. Periksa konfigurasi autentikasi Supabase.",
    };
  }

  const role = data.user.app_metadata?.role;
  redirect(role === "admin" ? "/admin" : "/booking");
}
