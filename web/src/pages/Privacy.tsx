import LegalDocument, { LegalSection } from './LegalDocument'

/**
 * Public privacy policy for KQ-SOFT BRS (bank reconciliation SaaS).
 * Contact for data requests: info@kqsoftwaresolutions.com
 */
export default function Privacy() {
  return (
    <LegalDocument title="Privacy Policy" updated="25 July 2026">
      <p>
        This Privacy Policy explains how KQ-SOFT Solutions (“KQ-SOFT”, “we”, “us”) collects, uses,
        and protects personal and financial data when you use our bank reconciliation platform at
        kqsoftwaresolutions.com and related services (the “Service”).
      </p>

      <LegalSection title="1. Who we are">
        <p>
          KQ-SOFT Solutions operates a Ghana-focused bank reconciliation SaaS for accounting firms
          and finance teams. For privacy questions or data requests, email{' '}
          <a className="font-medium text-primary-600 hover:underline" href="mailto:info@kqsoftwaresolutions.com">
            info@kqsoftwaresolutions.com
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="2. Data we collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Account data:</strong> name, email, password (hashed), organisation membership,
            and role.
          </li>
          <li>
            <strong>Billing data:</strong> subscription plan, payment status, and Paystack
            transaction references. Card details are handled by Paystack — we do not store full card
            numbers.
          </li>
          <li>
            <strong>Reconciliation data:</strong> cash books, bank statements, mappings, matches,
            reports, attachments, and related audit logs you upload or create in the Service.
          </li>
          <li>
            <strong>Technical data:</strong> IP address, browser/user agent, and request logs needed
            for security and operations.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. How we use data">
        <p>We use data to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Provide, secure, and improve the Service (parsing, matching, reporting, support)</li>
          <li>Authenticate users, enforce roles, and maintain an audit trail</li>
          <li>Process subscriptions and send transactional email (e.g. password reset)</li>
          <li>Detect abuse, investigate incidents, and meet legal obligations</li>
        </ul>
        <p>We do not sell your personal or client financial data.</p>
      </LegalSection>

      <LegalSection title="4. Sharing">
        <p>We share data only with:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Processors</strong> that help us run the Service (e.g. hosting, email delivery,
            payment processing via Paystack), under contractual obligations
          </li>
          <li>
            <strong>Authorities</strong> when required by applicable law or valid legal process
          </li>
          <li>
            <strong>Your organisation’s admins</strong>, who control member access and workspace
            data
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Retention">
        <p>
          We retain account and reconciliation data for as long as your organisation’s subscription
          is active and as needed for legal, accounting, and security purposes. Platform admins may
          configure a retention period (default seven years) after which eligible completed projects
          and associated upload files may be permanently deleted. You may request deletion of your
          account by contacting us; organisation-owned client files may remain until the organisation
          admin removes them or retention applies.
        </p>
      </LegalSection>

      <LegalSection title="6. Security">
        <p>
          We use industry-standard measures including encrypted transport (HTTPS), hashed passwords,
          role-based access, and audit logging. No method of transmission or storage is completely
          secure; please use strong passwords and limit admin access.
        </p>
      </LegalSection>

      <LegalSection title="7. Your rights">
        <p>
          Depending on applicable law, you may request access, correction, or deletion of personal
          data we hold about you, or object to certain processing. Organisation workspace data is
          controlled by your organisation’s administrators. Contact us at the email above; we will
          respond within a reasonable time.
        </p>
      </LegalSection>

      <LegalSection title="8. International transfers">
        <p>
          Infrastructure may be hosted outside Ghana. By using the Service you acknowledge that data
          may be processed in other jurisdictions with appropriate safeguards where required.
        </p>
      </LegalSection>

      <LegalSection title="9. Changes">
        <p>
          We may update this policy from time to time. The “Last updated” date at the top will
          change when we do. Continued use after changes constitutes acceptance of the updated
          policy.
        </p>
      </LegalSection>
    </LegalDocument>
  )
}
