/**
 * Refund Policy — startup-protective template (no mid-cycle refunds). REVIEW
 * WITH A LAWYER and check consumer-protection law in your customers' regions
 * (e.g. EU/UK 14-day withdrawal rights). Not legal advice.
 */
import { LegalShell, Section } from "@/components/legal-shell";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: `${LEGAL.productName} — Refund Policy` };

export default function Refund() {
  return (
    <LegalShell title="Refund Policy">
      <p>
        This Refund Policy applies to paid subscriptions to {LEGAL.productName}, operated by{" "}
        {LEGAL.legalEntity}. It should be read together with our{" "}
        <a href="/legal/terms" style={{ color: "var(--accent)" }}>Terms of Service</a>.
      </p>

      <Section n={1} title="Subscriptions are billed in advance">
        <p>
          Plans are billed monthly in advance and renew automatically. Charges pay for access to the
          Service during the upcoming billing period.
        </p>
      </Section>

      <Section n={2} title="No refunds for partial periods">
        <p>
          Except where required by law, fees are non-refundable and we do not provide refunds or
          credits for partial billing periods, unused capacity, or downgrades taking effect mid-cycle.
          When you cancel, your plan remains active until the end of the current period and is not
          renewed thereafter.
        </p>
      </Section>

      <Section n={3} title="How to cancel">
        <p>
          You can cancel anytime from the in-product billing portal. Cancellation stops future
          renewals; no further charges are made after the current period ends.
        </p>
      </Section>

      <Section n={4} title="Exceptions &amp; statutory rights">
        <p>
          Nothing in this policy limits rights you may have under applicable consumer-protection law
          (for example, statutory withdrawal/cooling-off rights in the EU/UK). We may, at our sole
          discretion, issue a refund in cases such as duplicate charges or verified billing errors.
        </p>
      </Section>

      <Section n={5} title="Requesting a refund">
        <p>
          To request a refund under an exception above, contact{" "}
          <a href={`mailto:${LEGAL.contactEmail}`} style={{ color: "var(--accent)" }}>{LEGAL.contactEmail}</a>
          {" "}within 14 days of the charge with your account email and details. Approved refunds are
          returned to the original payment method within 5–10 business days.
        </p>
      </Section>
    </LegalShell>
  );
}
