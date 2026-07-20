export default function Success() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--accent)" }}>
        <span className="text-2xl text-white">✓</span>
      </div>
      <h1 className="text-2xl font-semibold">You&apos;re subscribed</h1>
      <p className="mt-3 text-[var(--muted)]">
        We&apos;re setting up your workspace. You&apos;ll receive your login details by email shortly. You can sign in at{" "}
        <a href="https://rag.runook.com/login" style={{ color: "var(--accent)" }}>
          rag.runook.com
        </a>{" "}
        — including &quot;Sign in with Google&quot;.
      </p>
    </main>
  );
}
