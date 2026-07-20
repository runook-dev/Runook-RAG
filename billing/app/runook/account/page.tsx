import AccountView from "@/components/account-view";

export const dynamic = "force-dynamic";

// Customer-facing billing/usage page, opened same-origin from the product
// (rag.runook.com/runook/account?email=…) via the Caddy /runook/* route.
export default async function Account({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return <AccountView email={(email || "").toLowerCase()} />;
}
