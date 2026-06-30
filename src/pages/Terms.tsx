import { LegalLayout } from "@/components/LegalLayout";

export default function Terms() {
  return (
    <LegalLayout
      title="Terms of Service"
      description="The terms governing your use of UCU, operated by Tech Town Swat."
      path="/terms"
    >
      <p>
        These Terms of Service ("Terms") govern your access to and use of UCU (the "Service"),
        provided by <strong>Tech Town Swat</strong> ("we", "us", "our"). By creating an account or
        using the Service you agree to these Terms.
      </p>

      <h2>1. The Service</h2>
      <p>
        UCU is a point-of-sale and shop management platform that lets you manage products,
        inventory, sales, customers, staff, and related operations.
      </p>

      <h2>2. Eligibility and accounts</h2>
      <ul>
        <li>You must be of legal age to enter into a binding contract and, if signing up on behalf of an organization, have authority to bind it.</li>
        <li>You are responsible for maintaining the confidentiality of your credentials and for all activity under your account.</li>
        <li>You agree to provide accurate information and keep it up to date.</li>
      </ul>

      <h2>3. Acceptable use</h2>
      <p>You must not misuse the Service. In particular, you agree not to:</p>
      <ul>
        <li>Use the Service for unlawful, fraudulent, or deceptive purposes;</li>
        <li>Infringe intellectual property or privacy rights of others;</li>
        <li>Upload malware, probe, scan, or attempt to breach security or authentication measures;</li>
        <li>Scrape, reverse engineer, resell, or redistribute the Service;</li>
        <li>Send spam or unsolicited messages through the Service.</li>
      </ul>

      <h2>4. Intellectual property</h2>
      <p>
        We retain all right, title, and interest in the Service, including software, documentation,
        branding, and underlying technology. We grant you a limited, non-exclusive, non-transferable
        right to use the Service within your chosen plan. You retain ownership of the content and data
        you submit and grant us a limited license to host and process it solely to provide the Service.
      </p>

      <h2>5. Payments, subscriptions and billing</h2>
      <p>
        Paid plans are billed in USD manually via <strong>EasyPaisa</strong> (account 03480152906, Tech Town Swat). UCU Pro is
        sold as a one-time charge per period (monthly or yearly). Access ends automatically at the end
        of the paid period unless you purchase again. Pricing and applicable taxes are shown at
        checkout.
      </p>

      <h2>6. Payment processor</h2>
      <p>
        Payments are made via <strong>EasyPaisa</strong> manual transfer to 03480152906 (Tech Town Swat). The admin
        handles card data, fraud screening, and settlement on our behalf. We do not store full card
        numbers on our servers.
      </p>

      <h2>7. Refunds</h2>
      <p>
        See our <a href="/refunds">Refund Policy</a>. Refund requests are handled by Tech Town Swat and processed back via EasyPaisa transfer.
      </p>

      <h2>8. Service availability and warranties</h2>
      <p>
        The Service is provided "as is" and "as available". We do not guarantee uninterrupted or
        error-free operation. To the fullest extent permitted by law we disclaim all implied
        warranties, including merchantability and fitness for a particular purpose.
      </p>

      <h2>9. Liability</h2>
      <p>
        To the maximum extent permitted by law, our aggregate liability arising out of or relating to
        the Service shall not exceed the fees you paid to us in the twelve (12) months preceding the
        event giving rise to the claim. We are not liable for indirect, incidental, consequential,
        special, or punitive damages, including loss of profits, data, or goodwill. Nothing in these
        Terms limits liability that cannot be excluded by law.
      </p>

      <h2>10. Suspension and termination</h2>
      <p>
        We may suspend or terminate your access for material breach of these Terms, non-payment,
        security or fraud risk, or repeated or serious policy violations. Upon termination you may
        export your data within a reasonable period, after which it may be deleted.
      </p>

      <h2>11. Changes</h2>
      <p>
        We may update these Terms from time to time. Continued use of the Service after changes take
        effect constitutes acceptance of the updated Terms.
      </p>

      <h2>12. Governing law</h2>
      <p>
        These Terms are governed by the laws of Pakistan, without regard to conflict of laws
        principles. Disputes shall be resolved in the courts of Swat, Pakistan, unless required
        otherwise by mandatory local law.
      </p>

      <h2>13. Contact</h2>
      <p>
        Tech Town Swat — questions about these Terms can be sent via the <a href="/support">Support</a> page.
      </p>
    </LegalLayout>
  );
}
