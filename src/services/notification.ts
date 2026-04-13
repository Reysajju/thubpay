import { createClient as createAdminClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || '');

interface NotificationPayload {
  type: 'payment_succeeded' | 'payment_failed' | 'payment_refunded' | 'invoice_paid' | 'subscription_renewed' | 'subscription_canceled' | 'invoice_created' | 'invoice_overdue';
  title: string;
  message: string;
  channel: 'email' | 'in_app' | 'slack';
  templateId?: string;
  templateData?: Record<string, any>;
  workspaceId: string;
  userId?: string;
  metadata?: Record<string, any>;
}

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

/**
 * Send in-app notifications
 */
export async function sendInAppNotification(payload: Omit<NotificationPayload, 'channel'>): Promise<void> {
  const admin = getAdminClient();

  await admin
    .from('notifications')
    .insert({
      type: payload.type,
      title: payload.title,
      message: payload.message,
      channel: 'in_app',
      workspace_id: payload.workspaceId,
      user_id: payload.userId,
      metadata: payload.metadata
    });
}

/**
 * Send email notifications using Resend
 */
export async function sendEmailNotification(payload: Omit<NotificationPayload, 'channel'>): Promise<void> {
  try {
    const emailTemplateMap: Record<string, string> = {
      payment_succeeded: 'payment_confirmation',
      payment_failed: 'payment_failed',
      payment_refunded: 'refund_confirmation',
      invoice_paid: 'invoice_payment_received',
      subscription_renewed: 'subscription_renewed',
      subscription_canceled: 'subscription_canceled',
      invoice_created: 'new_invoice',
      invoice_overdue: 'invoice_overdue'
    };

    const templateId = payload.templateId || emailTemplateMap[payload.type];

    if (!templateId) {
      console.error('No template ID found for notification type:', payload.type);
      return;
    }

    // Get email template content
    const admin = getAdminClient();
    const { data: template } = await admin
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (!template) {
      console.error('Email template not found:', templateId);
      return;
    }

    // Replace template variables with actual data
    let htmlContent = template.html_content;
    let subject = template.subject;

    if (payload.templateData) {
      Object.entries(payload.templateData).forEach(([key, value]) => {
        htmlContent = htmlContent.replace(`{{${key}}}`, String(value));
        subject = subject.replace(`{{${key}}}`, String(value));
      });
    }

    // Get recipient email
    let toEmail = payload.templateData?.to_email || '';
    if (!toEmail) {
      console.error('No recipient email provided for notification:', payload.type);
      return;
    }

    // Get workspace branding for white-labeled emails
    const { data: workspace } = await admin
      .from('brands')
      .select('logo_url, company_name, website_url')
      .eq('workspace_id', payload.workspaceId)
      .single();

    if (workspace) {
      htmlContent = htmlContent.replace('{{company_logo}}', workspace.logo_url || '');
      htmlContent = htmlContent.replace('{{company_name}}', workspace.company_name);
      htmlContent = htmlContent.replace('{{company_website}}', workspace.website_url || '');
    }

    await resend.emails.send({
      from: `${process.env.EMAIL_FROM_NAME || 'ThubPay'} <${process.env.EMAIL_FROM || 'noreply@thubpay.com'}>`,
      to: toEmail,
      subject,
      html: htmlContent
    });
  } catch (error) {
    console.error('Error sending email notification:', error);
  }
}

/**
 * Send Slack notifications
 */
export async function sendSlackNotification(payload: Omit<NotificationPayload, 'channel'>): Promise<void> {
  try {
    const webhookUrl = payload.metadata?.slack_webhook_url;

    if (!webhookUrl) {
      console.error('No Slack webhook URL provided');
      return;
    }

    const message = {
      text: payload.title,
      attachments: [
        {
          color: getColorForNotificationType(payload.type),
          fields: [
            { title: 'Type', value: payload.type, short: true },
            { title: 'Message', value: payload.message, short: false },
            ...(payload.metadata?.amount ? [{ title: 'Amount', value: payload.metadata.amount, short: true }] : [])
          ]
        }
      ]
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
  } catch (error) {
    console.error('Error sending Slack notification:', error);
  }
}

/**
 * Get color for notification type
 */
function getColorForNotificationType(type: string): string {
  const colorMap: Record<string, string> = {
    payment_succeeded: '#10B981',
    payment_failed: '#EF4444',
    payment_refunded: '#F59E0B',
    invoice_paid: '#10B981',
    subscription_renewed: '#10B981',
    subscription_canceled: '#6B7280',
    invoice_created: '#3B82F6',
    invoice_overdue: '#EF4444'
  };
  return colorMap[type] || '#6B7280';
}

/**
 * Dispatch notification to appropriate channels
 */
export async function dispatchNotification(payload: NotificationPayload): Promise<void> {
  try {
    // Save notification to database
    await sendInAppNotification(payload);

    // Dispatch to other channels based on notification preferences
    const admin = getAdminClient();
    const { data: preferences } = await admin
      .from('notification_preferences')
      .select('*')
      .eq('workspace_id', payload.workspaceId)
      .eq('event_type', payload.type);

    if (preferences) {
      for (const pref of preferences) {
        if (pref.channel === 'email' && payload.type !== 'payment_succeeded') {
          await sendEmailNotification(payload);
        } else if (pref.channel === 'slack' && payload.type === 'payment_succeeded') {
          await sendSlackNotification(payload);
        }
      }
    }
  } catch (error) {
    console.error('Error dispatching notification:', error);
  }
}

/**
 * Send payment confirmation email
 */
export async function sendPaymentConfirmationEmail(
  email: string,
  amount: number,
  currency: string,
  invoiceId: string,
  gateway: string
): Promise<void> {
  await sendEmailNotification({
    type: 'payment_succeeded',
    title: 'Payment Received',
    message: `Your payment of ${currency} ${amount} has been received successfully.`,
    templateData: {
      to_email: email,
      amount,
      currency,
      invoice_id: invoiceId,
      gateway,
      payment_date: new Date().toISOString()
    },
    workspaceId: ''
  });
}

/**
 * Send payment failed notification
 */
export async function sendPaymentFailedEmail(
  email: string,
  amount: number,
  currency: string,
  reason: string
): Promise<void> {
  await sendEmailNotification({
    type: 'payment_failed',
    title: 'Payment Failed',
    message: 'We were unable to process your payment. Please try again or use a different payment method.',
    templateData: {
      to_email: email,
      amount,
      currency,
      reason,
      payment_date: new Date().toISOString()
    },
    workspaceId: ''
  });
}

/**
 * Send refund confirmation email
 */
export async function sendRefundConfirmationEmail(
  email: string,
  amount: number,
  currency: string,
  invoiceId: string
): Promise<void> {
  await sendEmailNotification({
    type: 'payment_refunded',
    title: 'Refund Processed',
    message: `A refund of ${currency} ${amount} has been processed for your invoice ${invoiceId}.`,
    templateData: {
      to_email: email,
      amount,
      currency,
      invoice_id: invoiceId,
      refund_date: new Date().toISOString()
    },
    workspaceId: ''
  });
}
