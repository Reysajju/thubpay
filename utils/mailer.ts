import nodemailer from 'nodemailer';
import { getURL } from '@/utils/helpers';

// ── SMTP Transport (Gmail) ───────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // true for 465, false for 587 (STARTTLS)
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

function getFromAddress(): string {
  const name = process.env.SMTP_FROM_NAME || 'ThubPay';
  const email = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@thubpay.com';
  return `"${name}" <${email}>`;
}

// ── Generic send helper ──────────────────────────────────────

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<{ sent: boolean; error?: string }> {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    console.error('[Mailer] SMTP_USER or SMTP_PASS not configured in .env');
    return { sent: false, error: 'missing_smtp_credentials' };
  }

  try {
    const info = await transporter.sendMail({
      from: params.from || getFromAddress(),
      to: params.to,
      subject: params.subject,
      html: params.html
    });
    console.log(`[Mailer] Email sent to ${params.to} — messageId: ${info.messageId}`);
    return { sent: true };
  } catch (err: any) {
    console.error(`[Mailer] Failed to send email to ${params.to}:`, err.message);
    return { sent: false, error: err.message };
  }
}

// ── Invoice dispatch email ───────────────────────────────────

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

  const amountStr = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(totalCents / 100);

  const dueStr = dueDateStr ? new Date(dueDateStr).toLocaleDateString() : 'Upon Receipt';

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

  return sendEmail({
    to,
    subject: `Invoice ${invoiceNumber} from ${brandName}`,
    html
  });
}

// ── Payment receipt email ────────────────────────────────────

export async function sendPaidReceiptEmail(params: {
  to: string;
  invoiceNumber: string;
  brandName: string;
  amountPaidCents: number;
  paymentUrl: string;
}) {
  const { to, invoiceNumber, brandName, amountPaidCents, paymentUrl } = params;

  const amountStr = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amountPaidCents / 100);

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

  return sendEmail({
    to,
    subject: `Receipt for Invoice ${invoiceNumber} from ${brandName}`,
    html
  });
}
