import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import AdminLoginForm from "@/components/admin-login-form";

export const dynamic = "force-dynamic";

export default async function AdminLogin() {
  if (await isAdmin()) redirect("/admin");
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] font-bold text-white">R</span>
          <span className="text-lg font-semibold">Runook RAG — Admin</span>
        </div>
        <div className="rounded-2xl border bg-[var(--surface)] p-6">
          <h1 className="mb-1 text-lg font-semibold">Staff sign in</h1>
          <p className="mb-5 text-sm text-[var(--muted)]">Back-office access for Runook staff.</p>
          <AdminLoginForm />
        </div>
      </div>
    </main>
  );
}
