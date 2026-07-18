import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/auth";
import LoginForm from "@/components/login-form";
import { Logo } from "@/components/ui";

export default async function Home() {
  const customer = await getCurrentCustomer();
  if (customer) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
          <h1 className="mb-1 text-lg font-semibold">Sign in</h1>
          <p className="mb-6 text-sm text-[var(--muted)]">Access your private knowledge workspace.</p>
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-xs text-[var(--muted)]">
          Powered by Runook · Need an account? Contact your Runook representative.
        </p>
      </div>
    </main>
  );
}
