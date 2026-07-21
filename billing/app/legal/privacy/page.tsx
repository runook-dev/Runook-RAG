/**
 * Privacy Policy — template. REVIEW WITH A LAWYER and fill placeholders in
 * lib/legal.ts before commercial launch. Not legal advice.
 */
import { LegalShell, Section } from "@/components/legal-shell";
import { LEGAL, SUBPROCESSORS } from "@/lib/legal";

export const metadata = { title: `${LEGAL.productName} — Privacy Policy` };

export default function Privacy() {
  return (
    <LegalShell title="Privacy Policy">
      <p>
        This Privacy Policy explains how {LEGAL.legalEntity} (&quot;{LEGAL.productName}&quot;) collects,
        uses, and protects information when you use the Service at {LEGAL.appUrl}. We act as a
        processor of the documents you upload (&quot;Customer Content&quot;) and as a controller of
        account and billing information.
      </p>

      <Section n={1} title="Information we collect">
        <ul className="list-disc space-y-1 pl-6">
          <li><strong>Account data:</strong> name, email, authentication identifiers (including via Google sign-in).</li>
          <li><strong>Billing data:</strong> subscription plan and payment metadata handled by Stripe (we do not store full card numbers).</li>
          <li><strong>Customer Content:</strong> documents, knowledge bases, queries, and chats you create.</li>
          <li><strong>Usage &amp; technical data:</strong> logs, IP address, device/browser info, and usage metrics for security and operations.</li>
        </ul>
      </Section>

      <Section n={2} title="How we use information">
        <ul className="list-disc space-y-1 pl-6">
          <li>to provide, secure, and operate the Service;</li>
          <li>to process subscriptions, billing, and enforce plan limits;</li>
          <li>to communicate with you (service, support, and transactional emails);</li>
          <li>to detect abuse, comply with law, and protect our rights.</li>
        </ul>
        <p>We do not sell your personal information, and we do not use Customer Content to train our own models.</p>
      </Section>

      <Section n={3} title="Service providers (subprocessors)">
        <p>We share data with the following providers only as needed to run the Service:</p>
        <ul className="list-disc space-y-1 pl-6">
          {SUBPROCESSORS.map(([name, purpose]) => (
            <li key={name}><strong>{name}:</strong> {purpose}.</li>
          ))}
        </ul>
        <p>
          Note: the AI model provider is one you configure with your own key; your queries and
          retrieved context are sent to that provider under their terms.
        </p>
      </Section>

      <Section n={4} title="Data retention">
        <p>
          We retain account and billing data for as long as your account is active and as required
          for legal/accounting purposes. Customer Content is retained until you delete it or a
          reasonable period after account termination, after which it is deleted from active systems
          (backups expire on a rolling schedule).
        </p>
      </Section>

      <Section n={5} title="Security">
        <p>
          We use industry-standard measures including encryption in transit (HTTPS), access controls,
          tenant isolation, encrypted secret storage, and regular backups. No method of transmission
          or storage is 100% secure; we cannot guarantee absolute security.
        </p>
      </Section>

      <Section n={6} title="International transfers">
        <p>
          The Service is hosted in the United States. If you access it from other regions, you
          consent to the transfer and processing of your data in the US, subject to appropriate
          safeguards where required.
        </p>
      </Section>

      <Section n={7} title="Your rights">
        <p>
          Depending on your location (e.g. GDPR/UK GDPR, CCPA/CPRA), you may have rights to access,
          correct, delete, or export your personal data, and to object to or restrict certain
          processing. To exercise these, contact{" "}
          <a href={`mailto:${LEGAL.privacyEmail}`} style={{ color: "var(--accent)" }}>{LEGAL.privacyEmail}</a>.
          For Customer Content, you can also manage/delete data directly in the product.
        </p>
      </Section>

      <Section n={8} title="Cookies">
        <p>
          We use strictly necessary cookies/local storage for authentication and session management.
          We do not use advertising cookies. [If analytics are added later, disclose here.]
        </p>
      </Section>

      <Section n={9} title="Children">
        <p>The Service is not directed to children under 16, and we do not knowingly collect their data.</p>
      </Section>

      <Section n={10} title="Changes &amp; contact">
        <p>
          We may update this Policy; material changes will be notified. Questions or requests:{" "}
          <a href={`mailto:${LEGAL.privacyEmail}`} style={{ color: "var(--accent)" }}>{LEGAL.privacyEmail}</a>
          {" "}· {LEGAL.legalEntity}, {LEGAL.address}.
        </p>
      </Section>
    </LegalShell>
  );
}
