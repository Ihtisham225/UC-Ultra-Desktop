import { LegalLayout } from "@/components/LegalLayout";

export default function Refunds() {
  return (
    <LegalLayout
      title="Refund Policy"
      description="UCU's 30-day money-back guarantee and how to request a refund."
      path="/refunds"
    >
      <p>
        We want you to be happy with UCU. We offer a <strong>30-day money-back guarantee</strong> on
        all paid subscriptions sold by Tech Town Swat.
      </p>

      <h2>Eligibility</h2>
      <ul>
        <li>You may request a full refund within <strong>30 days</strong> of your initial purchase or renewal date.</li>
        <li>Refunds apply to subscription fees received via EasyPaisa transfer to 03480152906 (Tech Town Swat).</li>
      </ul>

      <h2>How to request a refund</h2>
      <p>
        Payments are received via <strong>EasyPaisa</strong>. To request a refund, contact us via the
        <a href="/support"> Support</a> page with your order ID or the email used at checkout, and we will process
        the refund back to your EasyPaisa account within 5–10 business days.
      </p>

      <h2>After 30 days</h2>
      <p>
        Refunds requested after the 30-day window are considered on a case-by-case basis. Your
        subscription does not auto-renew — Pro access simply expires at the end of the period you paid for.
      </p>

      <h2>Cancelling your subscription</h2>
      <p>
        UCU Pro is sold as a one-time purchase per period (monthly or yearly). There is nothing to
        cancel — your Pro access automatically expires at the end of the period unless you purchase
        again.
      </p>

      <h2>Contact</h2>
      <p>
        Tech Town Swat — for help with a refund, reach us through the <a href="/support">Support</a> page.
      </p>
    </LegalLayout>
  );
}
