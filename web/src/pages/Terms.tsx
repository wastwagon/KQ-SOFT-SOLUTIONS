import { Link } from 'react-router-dom'
import LegalDocument, { LegalSection } from './LegalDocument'

/**
 * Public terms of service for KQ-SOFT BRS.
 */
export default function Terms() {
  return (
    <LegalDocument title="Terms of Service" updated="25 July 2026">
      <p>
        These Terms of Service (“Terms”) govern access to and use of the KQ-SOFT bank reconciliation
        platform (the “Service”) operated by KQ-SOFT Solutions. By creating an account or using the
        Service, you agree to these Terms.
      </p>

      <LegalSection title="1. The Service">
        <p>
          The Service helps organisations upload cash books and bank statements, map and match
          transactions, and produce bank reconciliation statements (BRS) and exports. Features vary
          by subscription plan. We may improve, change, or discontinue features with reasonable
          notice where practicable.
        </p>
      </LegalSection>

      <LegalSection title="2. Accounts and organisations">
        <ul className="list-disc space-y-2 pl-5">
          <li>You must provide accurate registration information and keep credentials confidential.</li>
          <li>
            Organisation admins are responsible for inviting members, assigning roles, and the data
            uploaded under their workspace.
          </li>
          <li>
            You must not attempt to access another organisation’s data, probe the Service for
            vulnerabilities without permission, or misuse API keys.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Acceptable use">
        <p>You may only upload data you are authorised to process. You must not upload malware,
          unlawful content, or data that infringes others’ rights. We may suspend accounts that
          abuse the Service, exceed fair-use limits, or threaten platform security.</p>
      </LegalSection>

      <LegalSection title="4. Customer data">
        <p>
          You (or your organisation) retain ownership of cash books, statements, and reports you
          upload or generate. You grant us a limited licence to process that data solely to provide
          the Service. See our{' '}
          <Link to="/privacy" className="font-medium text-primary-600 hover:underline">
            Privacy Policy
          </Link>{' '}
          for how we handle personal data.
        </p>
      </LegalSection>

      <LegalSection title="5. Subscriptions and billing">
        <p>
          Paid plans are billed in Ghana Cedis (GHS) via Paystack unless otherwise agreed. Limits
          (projects, transactions, users, features) follow your plan. Fees are generally
          non-refundable except where required by law or expressly stated. We may change prices with
          notice before the next billing period.
        </p>
      </LegalSection>

      <LegalSection title="6. Professional use disclaimer">
        <p>
          The Service assists reconciliation workflows; it does not replace professional judgement.
          Matching suggestions, OCR, and parsers can err. You are responsible for reviewing matches
          and reports before relying on them for audit, tax, or regulatory filings.
        </p>
      </LegalSection>

      <LegalSection title="7. Availability and support">
        <p>
          We aim for high availability but do not guarantee uninterrupted Service. Scheduled
          maintenance and force majeure events may cause downtime. Support is available at{' '}
          <a className="font-medium text-primary-600 hover:underline" href="mailto:info@kqsoftwaresolutions.com">
            info@kqsoftwaresolutions.com
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="8. Intellectual property">
        <p>
          The Service software, branding, and documentation are owned by KQ-SOFT or its licensors.
          You may not copy, reverse engineer, or resell the platform except as allowed by law or a
          written Firm/enterprise agreement.
        </p>
      </LegalSection>

      <LegalSection title="9. Limitation of liability">
        <p>
          To the fullest extent permitted by law, KQ-SOFT is not liable for indirect, incidental, or
          consequential damages, or for loss of profits, data, or goodwill arising from use of the
          Service. Our aggregate liability for any claim relating to the Service is limited to the
          fees you paid us for the Service in the three months before the claim.
        </p>
      </LegalSection>

      <LegalSection title="10. Termination">
        <p>
          You may stop using the Service at any time. We may suspend or terminate access for breach
          of these Terms or non-payment. Upon termination, your right to access the workspace ends;
          we may delete data according to our retention practices after a reasonable wind-down
          period.
        </p>
      </LegalSection>

      <LegalSection title="11. Governing law">
        <p>
          These Terms are governed by the laws of the Republic of Ghana. Disputes shall first be
          addressed in good faith; failing that, courts in Accra have exclusive jurisdiction,
          subject to mandatory consumer protections where applicable.
        </p>
      </LegalSection>

      <LegalSection title="12. Changes">
        <p>
          We may update these Terms by posting a revised version with a new “Last updated” date.
          Material changes will be communicated where practicable. Continued use after the effective
          date constitutes acceptance.
        </p>
      </LegalSection>
    </LegalDocument>
  )
}
