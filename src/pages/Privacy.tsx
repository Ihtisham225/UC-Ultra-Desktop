import { LegalLayout } from "@/components/LegalLayout";

export default function Privacy() {
  return (
    <LegalLayout
      title="Privacy Notice"
      description="How Tech Town Swat collects, uses, and protects your personal data on UCU."
      path="/privacy"
    >
      <p>
        This Privacy Notice explains how <strong>Tech Town Swat</strong> ("we", "us") collects, uses,
        and shares personal data when you use UCU (the "Service"). We act as the data controller for
        personal data processed in connection with the Service.
      </p>

      <h2>1. Data we collect</h2>
      <ul>
        <li><strong>Account data:</strong> name, email, username, password (hashed).</li>
        <li><strong>Shop and business data:</strong> shop name, products, inventory, sales, customers, staff records you create.</li>
        <li><strong>Support data:</strong> messages and attachments you send us.</li>
        <li><strong>Usage and device data:</strong> IP address, browser type, device identifiers, log/telemetry data.</li>
        <li><strong>Cookies:</strong> essential cookies for authentication and preferences.</li>
      </ul>

      <h2>2. How we use your data</h2>
      <ul>
        <li>Create and manage your account (contract performance).</li>
        <li>Provide, maintain, and improve the Service (legitimate interests, contract performance).</li>
        <li>Receive subscription payments via EasyPaisa manual transfer (contract performance, legal obligation).</li>
        <li>Provide customer support (contract performance, legitimate interests).</li>
        <li>Prevent fraud and abuse and maintain security (legitimate interests, legal obligation).</li>
        <li>Comply with legal obligations.</li>
      </ul>

      <h2>3. Who we share data with</h2>
      <ul>
        <li><strong>Service providers / subprocessors</strong> — hosting, database, analytics, email and support tooling, strictly to operate the Service.</li>
        <li><strong>EasyPaisa</strong> — used by you to send subscription payments to our account 03480152906.</li>
        <li><strong>Professional advisers</strong> — legal, accounting, and similar advisers under duties of confidentiality.</li>
        <li><strong>Authorities</strong> — when required by law or to protect rights, safety, and property.</li>
      </ul>
      <p>We do not sell your personal data.</p>

      <h2>4. International transfers</h2>
      <p>
        Your data may be processed in countries outside your own, including by our subprocessors and
        EasyPaisa transfers within Pakistan. Where required we rely on appropriate safeguards such as Standard Contractual Clauses.
      </p>

      <h2>5. Data retention</h2>
      <p>
        We keep personal data for as long as your account is active and for a reasonable period
        afterwards to comply with legal, accounting, or reporting requirements. When no longer needed
        we delete or anonymise it.
      </p>

      <h2>6. Your rights</h2>
      <p>Depending on your jurisdiction you may have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you;</li>
        <li>Request correction or deletion;</li>
        <li>Restrict or object to certain processing;</li>
        <li>Request portability of your data;</li>
        <li>Withdraw consent where processing is based on consent;</li>
        <li>Lodge a complaint with your local data protection authority.</li>
      </ul>
      <p>To exercise these rights, contact us via the <a href="/support">Support</a> page.</p>

      <h2>7. Security</h2>
      <p>
        We implement appropriate technical and organisational measures, including encryption in
        transit, access controls, and database row-level security, to protect your data. No system is
        completely secure and we cannot guarantee absolute security.
      </p>

      <h2>8. Cookies</h2>
      <p>
        We use essential cookies to keep you signed in and to remember preferences (such as language
        and theme). You can manage cookies through your browser settings; disabling essential cookies
        may impair the Service.
      </p>

      <h2>9. Children</h2>
      <p>
        The Service is not directed to children under 13 (or the equivalent minimum age in your
        jurisdiction). We do not knowingly collect personal data from children.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update this Notice from time to time. Material changes will be communicated through
        the Service or by email.
      </p>

      <h2>11. Contact</h2>
      <p>
        Tech Town Swat — contact us via the <a href="/support">Support</a> page for any privacy
        questions or requests.
      </p>
    </LegalLayout>
  );
}
