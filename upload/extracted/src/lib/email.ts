import nodemailer from 'nodemailer';

/**
 * ═══════════════════════════════════════════════════════════════
 * ThubPay — Unified Email & Transactional Delivery Service
 * ═══════════════════════════════════════════════════════════════
 * Supports:
 * 1. Standard SMTP / Gmail App Password (SMTP_USER, SMTP_PASSWORD, etc.)
 * 2. Resend API (RESEND_API_KEY)
 * 3. Safe Simulation (Fallback for local dev when no credentials provided)
 */

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  attachments?: EmailAttachment[];
}

export interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
  simulated?: boolean;
}

const DEFAULT_FROM =
  process.env.EMAIL_FROM ||
  process.env.SMTP_USER ||
  process.env.EMAIL_USER ||
  'ThubPay <noreply@thubpay.com>';

// ── 1. Create Nodemailer SMTP Transporter if configured ─────────
function getSmtpTransporter() {
  const user = process.env.SMTP_USER || process.env.EMAIL_USER || process.env.EMAIL_SERVER_USER;
  const pass =
    process.env.SMTP_PASSWORD ||
    process.env.SMTP_PASS ||
    process.env.EMAIL_APP_PASSWORD ||
    process.env.EMAIL_SERVER_PASSWORD;

  if (!user || !pass) return null;

  const host =
    process.env.SMTP_HOST ||
    process.env.EMAIL_SERVER_HOST ||
    (user.includes('@gmail.com') ? 'smtp.gmail.com' : 'smtp.mailgun.org');

  const port = parseInt(process.env.SMTP_PORT || (host === 'smtp.gmail.com' ? '465' : '587'), 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  from = DEFAULT_FROM,
  attachments = [],
}: SendEmailOptions): Promise<EmailResult> {
  const recipients = Array.isArray(to) ? to : [to];

  // ── A. Nodemailer SMTP (e.g. Gmail App Password, Custom SMTP) ─
  const transporter = getSmtpTransporter();
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from,
        to: recipients.join(', '),
        subject,
        text,
        html: html || text,
        attachments: attachments.map((a) => ({
          filename: a.filename,
          content:
            typeof a.content === 'string'
              ? Buffer.from(a.content)
              : a.content,
          contentType: a.contentType,
        })),
      });

      return { success: true, id: info.messageId };
    } catch (smtpErr: any) {
      console.error('[email/smtp] Failed to send via SMTP:', smtpErr);
      return { success: false, error: smtpErr.message || 'SMTP delivery failed' };
    }
  }

  // ── B. Resend API ─────────────────────────────────────────────
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      // Resend accepts attachments as base64-encoded strings.
      const resendAttachments = attachments.map((a) => ({
        filename: a.filename,
        content:
          typeof a.content === 'string'
            ? Buffer.from(a.content).toString('base64')
            : a.content.toString('base64'),
        content_type: a.contentType || 'application/octet-stream',
      }));

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: recipients,
          subject,
          html: html || text,
          text,
          attachments: resendAttachments.length > 0 ? resendAttachments : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('[email/resend] Failed to send email:', data);
        return { success: false, error: data?.message || 'Failed to send email via Resend' };
      }

      return { success: true, id: data?.id };
    } catch (err: any) {
      console.error('[email/resend] Network error:', err);
      return { success: false, error: err.message };
    }
  }

  // ── C. Safe Fallback / Development Simulation ─────────────────
  console.log('──────────────────────────────────────────────────────────');
  console.log(`✉ [Simulated Email] To: ${recipients.join(', ')}`);
  console.log(`✉ Subject: ${subject}`);
  console.log(`✉ From: ${from}`);
  if (text) console.log(`✉ Text: ${text}`);
  if (attachments.length > 0) {
    console.log(
      `✉ Attachments: ${attachments.map((a) => `${a.filename} (${typeof a.content === 'string' ? a.content.length : a.content.length} bytes)`).join(', ')}`
    );
  }
  console.log('──────────────────────────────────────────────────────────');

  return {
    success: true,
    id: `sim-${Date.now()}`,
    simulated: true,
  };
}

/**
 * Helper: Send Invoice notification to client
 */
export async function sendInvoiceEmail({
  to,
  clientName,
  invoiceNumber,
  amountFormatted,
  paymentUrl,
  businessName,
}: {
  to: string;
  clientName?: string;
  invoiceNumber: string;
  amountFormatted: string;
  paymentUrl: string;
  businessName?: string;
}): Promise<EmailResult> {
  const brand = businessName || 'ThubPay';
  const subject = `Invoice ${invoiceNumber} from ${brand}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0b; color: #ffffff; padding: 32px; border-radius: 16px; border: 1px solid #252529;">
      <div style="margin-bottom: 24px;">
        <span style="font-size: 24px; font-weight: 800; color: #10B981;">${brand}</span>
      </div>
      <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #ffffff;">Hello ${clientName || 'Valued Customer'},</h2>
      <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6;">
        You have received invoice <strong>${invoiceNumber}</strong> for <strong>${amountFormatted}</strong>.
      </p>
      <div style="margin: 32px 0;">
        <a href="${paymentUrl}" style="background: linear-gradient(135deg, #10B981, #059669); color: #ffffff; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 12px; display: inline-block; font-size: 14px;">
          View & Pay Invoice →
        </a>
      </div>
      <p style="color: #71717a; font-size: 12px; margin-top: 32px; border-top: 1px solid #252529; padding-top: 16px;">
        Secured and dispatched by ThubPay.
      </p>
    </div>
  `;

  return sendEmail({
    to,
    subject,
    html,
    text: `Hello ${clientName || 'Customer'},\n\nInvoice ${invoiceNumber} for ${amountFormatted} is ready: ${paymentUrl}`,
  });
}

/**
 * Helper: Send Magic Link Login Email
 */
export async function sendMagicLinkEmail({
  to,
  magicLinkUrl,
}: {
  to: string;
  magicLinkUrl: string;
}): Promise<EmailResult> {
  const subject = `Your ThubPay Magic Login Link`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0b; color: #ffffff; padding: 32px; border-radius: 16px; border: 1px solid #252529;">
      <div style="margin-bottom: 24px;">
        <span style="font-size: 24px; font-weight: 800; color: #10B981;">ThubPay</span>
      </div>
      <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #ffffff;">Sign in to your account</h2>
      <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6;">
        Click the button below to sign in instantly to your ThubPay dashboard. This link expires in 15 minutes.
      </p>
      <div style="margin: 32px 0;">
        <a href="${magicLinkUrl}" style="background: linear-gradient(135deg, #10B981, #059669); color: #ffffff; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 12px; display: inline-block; font-size: 14px;">
          Instant Sign In →
        </a>
      </div>
      <p style="color: #71717a; font-size: 12px; margin-top: 32px; border-top: 1px solid #252529; padding-top: 16px;">
        If you didn't request this email, you can safely ignore it.
      </p>
    </div>
  `;

  return sendEmail({
    to,
    subject,
    html,
    text: `Sign in to ThubPay using this link: ${magicLinkUrl}`,
  });
}

/**
 * Helper: Send Payment Confirmation / Receipt
 *
 * If `pdfAttachment` (a Buffer) is provided, the PDF is attached directly
 * to the email so the customer has the receipt without needing to click
 * through to the web app.
 */
export async function sendReceiptEmail({
  to,
  clientName,
  invoiceNumber,
  amountFormatted,
  transactionId,
  receiptUrl,
  paymentMethod,
  merchantName,
  pdfAttachment,
}: {
  to: string;
  clientName?: string;
  invoiceNumber: string;
  amountFormatted: string;
  transactionId?: string;
  receiptUrl?: string;
  paymentMethod?: string;
  merchantName?: string;
  pdfAttachment?: { filename: string; content: Buffer };
}): Promise<EmailResult> {
  const subject = `Receipt for Invoice ${invoiceNumber} - Payment Confirmed`;
  const methodLabel =
    paymentMethod === 'paypal'
      ? 'PayPal'
      : paymentMethod === 'stripe'
        ? 'Stripe'
        : paymentMethod === 'apple_pay'
          ? 'Apple Pay'
          : paymentMethod === 'google_pay'
            ? 'Google Pay'
            : 'Credit / Debit Card';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0b; color: #ffffff; padding: 32px; border-radius: 16px; border: 1px solid #252529;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #252529;">
        <span style="font-size: 24px; font-weight: 800; color: #10B981;">ThubPay</span>
        <span style="font-size: 11px; font-weight: 600; color: #10B981; background: rgba(16,185,129,0.12); padding: 4px 10px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.05em;">Paid</span>
      </div>
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="width: 48px; height: 48px; margin: 0 auto 12px; background: rgba(16,185,129,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px;">✅</div>
        <h2 style="font-size: 22px; font-weight: 800; margin: 0 0 8px; color: #ffffff;">Payment Confirmed</h2>
        <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6; margin: 0;">
          Hi ${clientName || 'Valued Customer'}, we&apos;ve received your payment.
        </p>
      </div>
      <div style="background: rgba(255,255,255,0.03); border: 1px solid #252529; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <span style="color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Amount paid</span>
          <span style="color: #10B981; font-size: 24px; font-weight: 800;">${amountFormatted}</span>
        </div>
        <div style="border-top: 1px solid #252529; padding-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <p style="color: #71717a; font-size: 11px; margin: 0 0 2px; text-transform: uppercase; letter-spacing: 0.05em;">Invoice</p>
            <p style="color: #ffffff; font-size: 13px; font-weight: 600; margin: 0;">${invoiceNumber}</p>
          </div>
          <div>
            <p style="color: #71717a; font-size: 11px; margin: 0 0 2px; text-transform: uppercase; letter-spacing: 0.05em;">Method</p>
            <p style="color: #ffffff; font-size: 13px; font-weight: 600; margin: 0;">${methodLabel}</p>
          </div>
          ${transactionId ? `<div style="grid-column: span 2;"><p style="color: #71717a; font-size: 11px; margin: 0 0 2px; text-transform: uppercase; letter-spacing: 0.05em;">Transaction ID</p><p style="color: #a1a1aa; font-size: 12px; font-family: monospace; margin: 0; word-break: break-all;">${transactionId}</p></div>` : ''}
          ${merchantName ? `<div style="grid-column: span 2;"><p style="color: #71717a; font-size: 11px; margin: 0 0 2px; text-transform: uppercase; letter-spacing: 0.05em;">Paid to</p><p style="color: #ffffff; font-size: 13px; font-weight: 600; margin: 0;">${merchantName}</p></div>` : ''}
        </div>
      </div>
      ${
        pdfAttachment
          ? `<div style="text-align: center; margin: 24px 0; padding: 16px; background: rgba(16,185,129,0.06); border: 1px dashed rgba(16,185,129,0.3); border-radius: 12px;"><p style="margin: 0 0 8px; color: #10B981; font-size: 13px; font-weight: 600;">📎 Your PDF receipt is attached to this email</p><p style="margin: 0; color: #71717a; font-size: 11px;">Filename: ${pdfAttachment.filename}</p></div>`
          : ''
      }
      ${receiptUrl ? `<div style="text-align: center; margin: 24px 0;"><a href="${receiptUrl}" style="background: linear-gradient(135deg, #10B981, #059669); color: #ffffff; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 12px; display: inline-block; font-size: 14px;">View Receipt Online →</a></div>` : ''}
      <p style="color: #71717a; font-size: 12px; margin-top: 32px; border-top: 1px solid #252529; padding-top: 16px;">
        Thank you for your business! If you have any questions about this payment, reply to this email.
      </p>
    </div>
  `;

  return sendEmail({
    to,
    subject,
    html,
    text: `Payment of ${amountFormatted} confirmed for invoice ${invoiceNumber}.${transactionId ? `\nTransaction ID: ${transactionId}` : ''}${receiptUrl ? `\nView receipt: ${receiptUrl}` : ''}${pdfAttachment ? `\n\nYour PDF receipt (${pdfAttachment.filename}) is attached to this email.` : ''}`,
    attachments: pdfAttachment
      ? [
          {
            filename: pdfAttachment.filename,
            content: pdfAttachment.content,
            contentType: 'application/pdf',
          },
        ]
      : undefined,
  });
}

/**
 * Helper: Send Refund Notification Email
 *
 * Sent to the customer when a merchant processes a refund (full or
 * partial). Lets the customer know the refund has been issued and
 * when to expect the funds back in their account.
 */
export async function sendRefundEmail({
  to,
  clientName,
  invoiceNumber,
  amountFormatted,
  refundId,
  reason,
  isFullRefund,
  merchantName,
  receiptUrl,
  pdfAttachment,
}: {
  to: string;
  clientName?: string;
  invoiceNumber: string;
  amountFormatted: string;
  refundId?: string;
  reason?: string;
  isFullRefund?: boolean;
  merchantName?: string;
  receiptUrl?: string;
  pdfAttachment?: { filename: string; content: Buffer };
}): Promise<EmailResult> {
  const subject = isFullRefund
    ? `Refund processed for Invoice ${invoiceNumber}`
    : `Partial refund issued for Invoice ${invoiceNumber}`;
  const refundTypeLabel = isFullRefund ? 'Full refund' : 'Partial refund';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0b; color: #ffffff; padding: 32px; border-radius: 16px; border: 1px solid #252529;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #252529;">
        <span style="font-size: 24px; font-weight: 800; color: #10B981;">ThubPay</span>
        <span style="font-size: 11px; font-weight: 600; color: #f59e0b; background: rgba(245,158,11,0.12); padding: 4px 10px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.05em;">Refund</span>
      </div>
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="width: 48px; height: 48px; margin: 0 auto 12px; background: rgba(245,158,11,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px;">↩️</div>
        <h2 style="font-size: 22px; font-weight: 800; margin: 0 0 8px; color: #ffffff;">Refund Processed</h2>
        <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6; margin: 0;">
          Hi ${clientName || 'Valued Customer'}, a refund has been issued to your original payment method.
        </p>
      </div>
      <div style="background: rgba(255,255,255,0.03); border: 1px solid #252529; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <span style="color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Refund amount</span>
          <span style="color: #f59e0b; font-size: 24px; font-weight: 800;">${amountFormatted}</span>
        </div>
        <div style="border-top: 1px solid #252529; padding-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <p style="color: #71717a; font-size: 11px; margin: 0 0 2px; text-transform: uppercase; letter-spacing: 0.05em;">Invoice</p>
            <p style="color: #ffffff; font-size: 13px; font-weight: 600; margin: 0;">${invoiceNumber}</p>
          </div>
          <div>
            <p style="color: #71717a; font-size: 11px; margin: 0 0 2px; text-transform: uppercase; letter-spacing: 0.05em;">Refund type</p>
            <p style="color: #ffffff; font-size: 13px; font-weight: 600; margin: 0;">${refundTypeLabel}</p>
          </div>
          ${reason ? `<div style="grid-column: span 2;"><p style="color: #71717a; font-size: 11px; margin: 0 0 2px; text-transform: uppercase; letter-spacing: 0.05em;">Reason</p><p style="color: #a1a1aa; font-size: 12px; margin: 0;">${reason}</p></div>` : ''}
          ${refundId ? `<div style="grid-column: span 2;"><p style="color: #71717a; font-size: 11px; margin: 0 0 2px; text-transform: uppercase; letter-spacing: 0.05em;">Refund ID</p><p style="color: #a1a1aa; font-size: 12px; font-family: monospace; margin: 0; word-break: break-all;">${refundId}</p></div>` : ''}
          ${merchantName ? `<div style="grid-column: span 2;"><p style="color: #71717a; font-size: 11px; margin: 0 0 2px; text-transform: uppercase; letter-spacing: 0.05em;">Issued by</p><p style="color: #ffffff; font-size: 13px; font-weight: 600; margin: 0;">${merchantName}</p></div>` : ''}
        </div>
      </div>
      <div style="text-align: center; margin: 24px 0; padding: 16px; background: rgba(245,158,11,0.06); border: 1px dashed rgba(245,158,11,0.3); border-radius: 12px;">
        <p style="margin: 0 0 4px; color: #f59e0b; font-size: 13px; font-weight: 600;">⏱ Refunds typically appear in 5–10 business days</p>
        <p style="margin: 0; color: #71717a; font-size: 11px;">Depending on your bank, it may take longer for the funds to show in your account.</p>
      </div>
      ${
        pdfAttachment
          ? `<div style="text-align: center; margin: 24px 0; padding: 16px; background: rgba(16,185,129,0.06); border: 1px dashed rgba(16,185,129,0.3); border-radius: 12px;"><p style="margin: 0 0 8px; color: #10B981; font-size: 13px; font-weight: 600;">📎 Your credit note is attached to this email</p><p style="margin: 0; color: #71717a; font-size: 11px;">Filename: ${pdfAttachment.filename}</p></div>`
          : ''
      }
      ${receiptUrl ? `<div style="text-align: center; margin: 24px 0;"><a href="${receiptUrl}" style="background: linear-gradient(135deg, #10B981, #059669); color: #ffffff; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 12px; display: inline-block; font-size: 14px;">View Receipt Online →</a></div>` : ''}
      <p style="color: #71717a; font-size: 12px; margin-top: 32px; border-top: 1px solid #252529; padding-top: 16px;">
        If you have any questions about this refund, please contact the merchant directly.
      </p>
    </div>
  `;

  return sendEmail({
    to,
    subject,
    html,
    text: `${refundTypeLabel} of ${amountFormatted} processed for invoice ${invoiceNumber}.${reason ? `\nReason: ${reason}` : ''}${refundId ? `\nRefund ID: ${refundId}` : ''}${receiptUrl ? `\nView receipt: ${receiptUrl}` : ''}${pdfAttachment ? `\n\nYour credit note (${pdfAttachment.filename}) is attached to this email.` : ''}`,
    attachments: pdfAttachment
      ? [
          {
            filename: pdfAttachment.filename,
            content: pdfAttachment.content,
            contentType: 'application/pdf',
          },
        ]
      : undefined,
  });
}

/**
 * Helper: Send Invoice Voided / Cancelled Email
 *
 * Sent to the customer when a merchant voids an invoice. Lets the
 * customer know the payment link is no longer active so they don't
 * waste time trying to pay it.
 */
export async function sendInvoiceVoidedEmail({
  to,
  clientName,
  invoiceNumber,
  amountFormatted,
  merchantName,
  invoiceUrl,
  supportEmail,
}: {
  to: string;
  clientName?: string;
  invoiceNumber: string;
  amountFormatted: string;
  merchantName?: string;
  invoiceUrl?: string;
  supportEmail?: string;
}): Promise<EmailResult> {
  const subject = `Invoice ${invoiceNumber} has been cancelled`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0b; color: #ffffff; padding: 32px; border-radius: 16px; border: 1px solid #252529;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #252529;">
        <span style="font-size: 24px; font-weight: 800; color: #10B981;">ThubPay</span>
        <span style="font-size: 11px; font-weight: 600; color: #f59e0b; background: rgba(245,158,11,0.12); padding: 4px 10px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.05em;">Cancelled</span>
      </div>
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="width: 48px; height: 48px; margin: 0 auto 12px; background: rgba(245,158,11,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px;">✕</div>
        <h2 style="font-size: 22px; font-weight: 800; margin: 0 0 8px; color: #ffffff;">Invoice Cancelled</h2>
        <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6; margin: 0;">
          Hi ${clientName || 'Valued Customer'}, invoice <strong>${invoiceNumber}</strong> has been cancelled by the merchant.
        </p>
      </div>
      <div style="background: rgba(255,255,255,0.03); border: 1px solid #252529; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <p style="color: #71717a; font-size: 11px; margin: 0 0 2px; text-transform: uppercase; letter-spacing: 0.05em;">Invoice</p>
            <p style="color: #ffffff; font-size: 13px; font-weight: 600; margin: 0;">${invoiceNumber}</p>
          </div>
          <div>
            <p style="color: #71717a; font-size: 11px; margin: 0 0 2px; text-transform: uppercase; letter-spacing: 0.05em;">Original amount</p>
            <p style="color: #ffffff; font-size: 13px; font-weight: 600; margin: 0; text-decoration: line-through; text-decoration-color: rgba(245,158,11,0.5);">${amountFormatted}</p>
          </div>
          ${merchantName ? `<div style="grid-column: span 2;"><p style="color: #71717a; font-size: 11px; margin: 0 0 2px; text-transform: uppercase; letter-spacing: 0.05em;">Cancelled by</p><p style="color: #ffffff; font-size: 13px; font-weight: 600; margin: 0;">${merchantName}</p></div>` : ''}
        </div>
      </div>
      <div style="text-align: center; margin: 24px 0; padding: 16px; background: rgba(245,158,11,0.06); border: 1px dashed rgba(245,158,11,0.3); border-radius: 12px;">
        <p style="margin: 0 0 4px; color: #f59e0b; font-size: 13px; font-weight: 600;">The payment link is no longer active</p>
        <p style="margin: 0; color: #71717a; font-size: 11px;">If you already paid this invoice, this cancellation does not affect your payment. Please contact the merchant if you have questions.</p>
      </div>
      ${invoiceUrl ? `<div style="text-align: center; margin: 24px 0;"><a href="${invoiceUrl}" style="background: linear-gradient(135deg, #10B981, #059669); color: #ffffff; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 12px; display: inline-block; font-size: 14px;">View Invoice Details →</a></div>` : ''}
      <p style="color: #71717a; font-size: 12px; margin-top: 32px; border-top: 1px solid #252529; padding-top: 16px;">
        If you have any questions about this cancellation, please contact ${supportEmail || 'the merchant'} directly.
      </p>
    </div>
  `;

  return sendEmail({
    to,
    subject,
    html,
    text: `Invoice ${invoiceNumber} (originally ${amountFormatted}) has been cancelled by ${merchantName || 'the merchant'}. The payment link is no longer active.${invoiceUrl ? `\nView invoice: ${invoiceUrl}` : ''}`,
  });
}

