import { getCurrentCustomer } from "@/lib/auth";
import { checkQuota } from "@/lib/usage";
import { getStore } from "@/lib/store";
import { currentMonthKey, formatNumber } from "@/lib/utils";
import { Card, Badge } from "@/components/ui";
import { PLAN_LIMITS } from "@/lib/config";

export default async function Overview() {
  const customer = (await getCurrentCustomer())!;
  const quota = await checkQuota(customer);
  const usage = await getStore().getUsage(customer.id, currentMonthKey());
  const pct = quota.unlimited ? 0 : Math.min(100, Math.round((quota.used / quota.limit) * 100));

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-1 text-2xl font-semibold">Overview</h1>
      <p className="mb-8 text-sm text-[var(--muted)]">Your workspace usage for {currentMonthKey()}.</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium text-[var(--muted)]">Plan</p>
          <p className="mt-1 text-xl font-semibold">{PLAN_LIMITS[customer.plan].label}</p>
          <div className="mt-2">
            <Badge tone="success">Active</Badge>
          </div>
        </Card>
        <Card>
          <p className="text-xs font-medium text-[var(--muted)]">Tokens used</p>
          <p className="mt-1 text-xl font-semibold">{formatNumber(quota.used)}</p>
          <p className="mt-2 text-xs text-[var(--muted)]">
            {quota.unlimited ? "Unlimited plan" : `of ${formatNumber(quota.limit)}`}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-[var(--muted)]">Requests</p>
          <p className="mt-1 text-xl font-semibold">{formatNumber(usage?.requests ?? 0)}</p>
          <p className="mt-2 text-xs text-[var(--muted)]">this month</p>
        </Card>
      </div>

      {!quota.unlimited && (
        <Card className="mt-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">Monthly token allowance</span>
            <span className="text-[var(--muted)]">{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background: pct > 90 ? "var(--danger)" : pct > 70 ? "var(--warning)" : "var(--accent)",
              }}
            />
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">
            {formatNumber(quota.remaining === Infinity ? 0 : quota.remaining)} tokens remaining. Contact Runook to
            upgrade.
          </p>
        </Card>
      )}
    </div>
  );
}
