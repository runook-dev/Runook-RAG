// Runook plan badge shown next to the top-left logo. Real React component
// (not injected DOM), so it renders reliably. Trial/unmanaged users see an
// "Upgrade" call-to-action; paid users see their plan name. Clicking it opens
// the in-app Billing settings page.
import { useFetchUserInfo } from '@/hooks/use-user-setting-request';
import { Routes } from '@/routes';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

interface PlanInfo {
  plan?: string | null;
  label?: string | null;
}

export function RunookPlanBadge() {
  const { data } = useFetchUserInfo();
  const email = ((data as { email?: string })?.email || '').toLowerCase();
  const [info, setInfo] = useState<PlanInfo | null>(null);

  useEffect(() => {
    if (!email) return;
    fetch('/runook/plan?email=' + encodeURIComponent(email))
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => {});
  }, [email]);

  const isPaid = !!info && !!info.plan && info.plan !== 'trial';

  return (
    <Link
      to={`${Routes.UserSetting}/billing`}
      className="ml-1 hidden shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold text-white whitespace-nowrap sm:inline-flex"
      style={{
        background: isPaid ? 'rgba(255,255,255,0.14)' : 'linear-gradient(135deg,#2dd4ff,#0066ff)',
      }}
      title={isPaid ? 'Manage your plan' : 'Upgrade your plan'}
    >
      {isPaid ? `${info!.label} plan` : 'Upgrade'}
    </Link>
  );
}
