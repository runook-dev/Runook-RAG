/**
 * Terms of Service — startup-protective template. REVIEW WITH A LAWYER and fill
 * the placeholders in lib/legal.ts before commercial launch. Not legal advice.
 */
import { LegalShell, Section } from "@/components/legal-shell";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: `${LEGAL.productName} — Terms of Service` };

export default function Terms() {
  return (
    <LegalShell title="Terms of Service">
      <p>
        These Terms of Service (&quot;Terms&quot;) are a binding agreement between{" "}
        {LEGAL.legalEntity} (&quot;{LEGAL.productName}&quot;, &quot;we&quot;, &quot;us&quot;) and the
        individual or entity (&quot;you&quot;, &quot;Customer&quot;) that accesses or uses the{" "}
        {LEGAL.productName} service at {LEGAL.appUrl} and related sites (the &quot;Service&quot;). By
        creating an account, subscribing, or using the Service, you agree to these Terms. If you do
        not agree, do not use the Service.
      </p>

      <Section n={1} title="The Service">
        <p>
          {LEGAL.productName} provides a hosted retrieval-augmented generation (RAG) platform for
          uploading documents, building knowledge bases, and querying them with large language
          models. Features, limits, and plans are described on our pricing page and may change over
          time. You are responsible for configuring your own model provider/API keys where required.
        </p>
      </Section>

      <Section n={2} title="Accounts &amp; eligibility">
        <p>
          You must be at least 18 and able to form a binding contract. You are responsible for the
          security of your account credentials and for all activity under your account. Notify us
          promptly of any unauthorized use. One account may not be shared across separate
          organizations except through your paid seats.
        </p>
      </Section>

      <Section n={3} title="Acceptable use">
        <p>You agree not to, and not to permit anyone to:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>upload or process content you lack the rights to, or that is unlawful, infringing, or harmful;</li>
          <li>attempt to access other customers&apos; data, breach isolation, or probe/scan the Service;</li>
          <li>reverse engineer, resell, or provide the Service to third parties except your authorized users;</li>
          <li>use the Service to build a competing product, or in violation of any law or third-party rights;</li>
          <li>exceed plan limits through automated abuse, or overload the infrastructure.</li>
        </ul>
        <p>We may suspend or terminate accounts that violate this section, with or without notice.</p>
      </Section>

      <Section n={4} title="Fees, billing &amp; auto-renewal">
        <p>
          Paid plans are billed in advance on a recurring monthly basis through our payment
          processor (Stripe). <strong>Subscriptions renew automatically</strong> until cancelled.
          Prices are in USD and exclude taxes, which you are responsible for. You authorize us to
          charge your payment method for all fees. Fees are non-refundable except as stated in our{" "}
          <a href="/legal/refund" style={{ color: "var(--accent)" }}>Refund Policy</a>. We may
          change prices with notice effective at your next billing cycle. Overdue accounts may be
          suspended.
        </p>
      </Section>

      <Section n={5} title="Cancellation &amp; termination">
        <p>
          You may cancel anytime from the billing portal; cancellation takes effect at the end of
          the current billing cycle and you retain access until then. We may suspend or terminate
          the Service for breach, non-payment, or as required by law. Upon termination, your right
          to use the Service ends and we may delete your data after a reasonable period.
        </p>
      </Section>

      <Section n={6} title="Your content &amp; data">
        <p>
          You retain all ownership of the documents, data, and content you upload (&quot;Customer
          Content&quot;). You grant us a limited license to host, process, and transmit Customer
          Content solely to provide the Service. You are responsible for the legality of Customer
          Content and for having necessary rights and consents. Our handling of personal data is
          described in the{" "}
          <a href="/legal/privacy" style={{ color: "var(--accent)" }}>Privacy Policy</a>.
        </p>
      </Section>

      <Section n={7} title="Third-party services &amp; AI output">
        <p>
          The Service builds on third-party software and providers (including RAGFlow, cloud
          infrastructure, and the model provider you configure). We are not responsible for
          third-party services. AI-generated output may be inaccurate, incomplete, or offensive; you
          must evaluate output before relying on it, and you are solely responsible for your use of
          it. The Service is not intended for legal, medical, financial, or other professional advice.
        </p>
      </Section>

      <Section n={8} title="Intellectual property">
        <p>
          We and our licensors own all rights in the Service, including software, branding, and
          documentation. These Terms grant you a limited, non-exclusive, non-transferable right to
          use the Service during your subscription. No rights are granted except as expressly stated.
        </p>
      </Section>

      <Section n={9} title="Disclaimers">
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES
          OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING IMPLIED WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT
          WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT OUTPUT WILL
          BE ACCURATE.
        </p>
      </Section>

      <Section n={10} title="Limitation of liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, {LEGAL.legalEntity} WILL NOT BE LIABLE FOR ANY
          INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS,
          REVENUE, DATA, OR GOODWILL. OUR TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATING TO THE
          SERVICE WILL NOT EXCEED THE AMOUNTS YOU PAID US IN THE THREE (3) MONTHS PRECEDING THE EVENT
          GIVING RISE TO THE CLAIM.
        </p>
      </Section>

      <Section n={11} title="Indemnification">
        <p>
          You will defend, indemnify, and hold harmless {LEGAL.legalEntity} from any claims, losses,
          and expenses (including reasonable legal fees) arising from your Customer Content, your use
          of the Service, or your breach of these Terms.
        </p>
      </Section>

      <Section n={12} title="Governing law &amp; disputes">
        <p>
          These Terms are governed by the laws of {LEGAL.jurisdiction}, without regard to conflict of
          law rules. The courts located in {LEGAL.jurisdiction} will have exclusive jurisdiction,
          unless a binding arbitration clause is added upon legal review. [Confirm dispute-resolution
          mechanism with counsel.]
        </p>
      </Section>

      <Section n={13} title="Changes to these Terms">
        <p>
          We may update these Terms from time to time. Material changes will be notified via the
          Service or email. Continued use after changes take effect constitutes acceptance.
        </p>
      </Section>

      <Section n={14} title="Contact">
        <p>
          Questions about these Terms: <a href={`mailto:${LEGAL.legalEmail}`} style={{ color: "var(--accent)" }}>{LEGAL.legalEmail}</a>
          {" "}· {LEGAL.legalEntity}, {LEGAL.address}.
        </p>
      </Section>
    </LegalShell>
  );
}
