"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
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

    const { data, error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (error) {
      setPesan(error.message);
      return;
    }

    const role = data.user?.app_metadata?.role;
    router.push(role === "admin" ? "/admin" : "/booking");
    router.refresh();
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