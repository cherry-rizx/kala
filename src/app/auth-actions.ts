"use server";

import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/session";

export async function logout() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect("/login");
}
