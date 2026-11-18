"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const [mode, setMode] = useState<"login" | "daftar">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pesan, setPesan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setPesan(null);

    try {
      const { data, error } =
        mode === "login"
          ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
          : await supabase.auth.signUp({ email: email.trim(), password });

      if (error) {
        setPesan(error.message);
        return;
      }

      if (!data.session || !data.user) {
        setPesan(
          mode === "daftar"
            ? "Akun dibuat, tetapi sesi belum aktif. Periksa email untuk menyelesaikan konfirmasi akun."
            : "Login belum menghasilkan sesi. Pastikan akun sudah dikonfirmasi, lalu coba lagi."
        );
        return;
      }

      const role = data.user.app_metadata?.role;
      window.location.assign(role === "admin" ? "/admin" : "/booking");
    } catch {
      setPesan("Tidak dapat menghubungi layanan login. Periksa koneksi, lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-2xl font-bold">
        {mode === "login" ? "Login" : "Daftar akun"}
      </h1>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded border p-2"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="rounded border p-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black p-2 text-white disabled:opacity-50"
        >
          {loading ? "Memproses..." : mode === "login" ? "Login" : "Daftar"}
        </button>
      </form>

      {pesan && <p className="mt-4 text-sm text-red-600">{pesan}</p>}

      <button
        type="button"
        onClick={() => setMode(mode === "login" ? "daftar" : "login")}
        className="mt-6 text-sm underline"
      >
        {mode === "login" ? "Belum punya akun? Daftar" : "Sudah punya akun? Login"}
      </button>
    </main>
  );
}
