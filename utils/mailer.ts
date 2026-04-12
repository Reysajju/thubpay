import { getURL } from '@/utils/helpers';

export async function sendInvoiceEmail(params: {
  to: string;
  invoiceId: string;
  invoiceNumber: string;
  brandName: string;
  description?: string;
  totalCents: number;
  dueDateStr?: string;
  paymentUrl: string;
}) {
  const { to, invoiceNumber, brandName, description, totalCents, dueDateStr, paymentUrl } = params;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.BILLING_FROM_EMAIL || 'billing@thubpay.com';

  const amountStr = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(totalCents / 100);

  const dueStr = dueDateStr ? new Date(dueDateStr).toLocaleDateString() : 'Upon Receipt';

  if (!apiKey) return { sent: false, reason: 'missing_resend_api_key' as const };

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#1d1b24;max-width:600px;margin:0 auto;border:1px solid #e7e0d3;border-radius:16px;padding:32px;background:#fffdf8;">
      <h2 style="margin-top:0;font-size:24px;color:#1d1b24;">${brandName}</h2>
      <p style="font-size:16px;color:#4a4a4a;">You have a new invoice ready for payment.</p>
      
      <div style="background:#f7f4ef;border:1px solid #e7e0d3;border-radius:12px;padding:24px;margin:24px 0;">
        <p style="margin:0 0 8px 0;font-size:14px;color:#71717a;text-transform:uppercase;font-weight:600;letter-spacing:0.05em;">Invoice Details</p>
        <p style="margin:0 0 4px 0;font-size:18px;font-weight:700;">${amountStr}</p>
        <p style="margin:0 0 12px 0;font-size:14px;color:#4a4a4a;">Due: ${dueStr}</p>
        <p style="margin:0;font-size:14px;color:#4a4a4a;"><strong>#${invoiceNumber}</strong>${description ? ` &mdash; ${description}` : ''}</p>
      </div>

      <a href="${paymentUrl}" style="display:block;width:100%;text-align:center;padding:14px 24px;background:#7A5A2B;color:#ffffff;border-radius:12px;text-decoration:none;font-weight:600;font-size:16px;box-sizing:border-box;">
        Pay Invoice Now
      </a>

      <p style="margin-top:24px;font-size:13px;color:#71717a;text-align:center;">
        If the button does not work, copy and paste this URL into your browser:<br/>
        <a href="${paymentUrl}" style="color:#7A5A2B;">${paymentUrl}</a>
      </p>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Invoice ${invoiceNumber} from ${brandName}`,
      html
    })
  });

  return { sent: response.ok };
}

export async function sendPaidReceiptEmail(params: {
  to: string;
  invoiceNumber: string;
  brandName: string;
  amountPaidCents: number;
  paymentUrl: string;
}) {
  const { to, invoiceNumber, brandName, amountPaidCents, paymentUrl } = params;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.BILLING_FROM_EMAIL || 'billing@thubpay.com';

  const amountStr = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amountPaidCents / 100);

  if (!apiKey) return { sent: false, reason: 'missing_resend_api_key' as const };

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#1d1b24;max-width:600px;margin:0 auto;border:1px solid #e7e0d3;border-radius:16px;padding:32px;background:#fffdf8;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;background:#dcfce7;color:#166534;padding:8px 16px;border-radius:24px;font-weight:700;font-size:14px;letter-spacing:0.05em;text-transform:uppercase;">
          Payment Successful
        </div>
      </div>

      <h2 style="margin-top:0;font-size:24px;color:#1d1b24;text-align:center;">${brandName}</h2>
      <p style="font-size:16px;color:#4a4a4a;text-align:center;">Thank you! Your payment of <strong>${amountStr}</strong> has been received.</p>
      
      <div style="background:#f7f4ef;border:1px solid #e7e0d3;border-radius:12px;padding:24px;margin:24px 0;">
        <p style="margin:0 0 8px 0;font-size:14px;color:#71717a;text-transform:uppercase;font-weight:600;letter-spacing:0.05em;">Receipt Info</p>
        <p style="margin:0 0 4px 0;font-size:16px;">Invoice: <strong>#${invoiceNumber}</strong></p>
        <p style="margin:0 0 4px 0;font-size:16px;">Amount Paid: <strong>${amountStr}</strong></p>
        <p style="margin:0;font-size:16px;">Balance Due: <strong>$0.00</strong></p>
      </div>

      <p style="margin-top:24px;font-size:14px;color:#4a4a4a;text-align:center;">
        You can view your full receipt here:<br/>
        <a href="${paymentUrl}" style="color:#7A5A2B;">${paymentUrl}</a>
      </p>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Receipt for Invoice ${invoiceNumber} from ${brandName}`,
      html
    })
  });

  return { sent: response.ok };
}
