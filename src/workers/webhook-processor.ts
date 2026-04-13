import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';

// Redis connection
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Payment webhook processing queue
const webhookQueue = new Queue('webhooks', {
  connection: redisConnection
});

// Invoice generation queue
const invoiceQueue = new Queue('invoices', {
  connection: redisConnection
});

// Email sending queue
const emailQueue = new Queue('emails', {
  connection: redisConnection
});

// Retry queue for failed transactions
const retryQueue = new Queue('retries', {
  connection: redisConnection
});

/**
 * Webhook processor worker
 */
const webhookWorker = new Worker(
  'webhooks',
  async (job: Job) => {
    const { gateway, eventId, eventType, payload } = job.data;

    console.log(`Processing webhook event: ${eventType} from ${gateway}`);

    try {
      // Process webhook based on gateway
      if (gateway === 'stripe') {
        await processStripeWebhook(eventId, eventType, payload);
      } else if (gateway === 'paypal') {
        await processPayPalWebhook(eventId, eventType, payload);
      } else {
        // Generic webhook processing for other gateways
        await processGenericWebhook(gateway, eventType, payload);
      }

      // Update webhook job status
      const admin = getAdminClient();
      await (admin as any).from('webhook_jobs')
        .update({ status: 'completed' })
        .eq('gateway_slug', gateway)
        .eq('event_id', eventId);

      return { success: true };
    } catch (error) {
      console.error(`Error processing webhook ${eventType}:`, error);
      // Mark job as failed
      await job.fail(error);

      // Update webhook job status
      const admin = getAdminClient();
      await (admin as any).from('webhook_jobs')
        .update({ status: 'failed' })
        .eq('gateway_slug', gateway)
        .eq('event_id', eventId);

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5
  }
);

/**
 * Invoice processor worker
 */
const invoiceWorker = new Worker(
  'invoices',
  async (job: Job) => {
    const { invoiceId, type } = job.data;

    console.log(`Processing invoice: ${invoiceId} (${type})`);

    try {
      const admin = getAdminClient();

      if (type === 'send') {
        // Send invoice via email
        await sendInvoiceEmail(invoiceId);
        await (admin as any).from('invoices')
          .update({ status: 'sent' })
          .eq('id', invoiceId);
      } else if (type === 'generate_pdf') {
        // Generate invoice PDF
        await generateInvoicePDF(invoiceId);
        await (admin as any).from('invoice_line_items')
          .update({ pdf_generated: true })
          .eq('invoice_id', invoiceId);
      } else if (type === 'payment_link') {
        // Generate payment link
        const { data: invoice } = await (admin as any)
          .from('invoices')
          .select('*, clients(email)')
          .eq('id', invoiceId)
          .single();

        if (invoice) {
          const { data: paymentLink } = await (admin as any)
            .from('payment_links')
            .insert({
              invoice_id: invoiceId,
              amount_cents: invoice.amount_cents,
              currency: invoice.currency,
              description: invoice.notes || '',
              gateway_slug: invoice.gateway_slug
            })
            .select()
            .single();

          return { payment_link: paymentLink?.public_url };
        }
      }

      return { success: true };
    } catch (error) {
      console.error(`Error processing invoice ${invoiceId}:`, error);
      await job.fail(error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 3
  }
);

/**
 * Email processor worker
 */
const emailWorker = new Worker(
  'emails',
  async (job: Job) => {
    const { emailData } = job.data;

    console.log(`Sending email: ${emailData.to}`);

    try {
      // Here you would integrate with SendGrid, Resend, or AWS SES
      // For now, we'll just log it
      console.log('Email content:', emailData);

      // Mock email sending
      await new Promise(resolve => setTimeout(resolve, 1000));

      return { success: true };
    } catch (error) {
      console.error('Error sending email:', error);
      await job.fail(error);

      // Queue for retry
      await retryQueue.add('email_retry', {
        emailData,
        retryCount: (job.data.retryCount || 0) + 1
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      });

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 10
  }
);

/**
 * Retry processor worker
 */
const retryWorker = new Worker(
  'retries',
  async (job: Job) => {
    const { taskId, type, data, retryCount } = job.data;

    console.log(`Retrying task: ${type} (attempt ${retryCount + 1})`);

    try {
      // Implement retry logic based on task type
      switch (type) {
        case 'webhook':
          await processWebhookRetry(taskId, data);
          break;

        case 'payment':
          await processPaymentRetry(taskId, data);
          break;

        case 'email':
          // Already handled in email worker
          return { success: true };

        default:
          throw new Error(`Unknown retry type: ${type}`);
      }

      return { success: true };
    } catch (error) {
      console.error(`Error retrying task ${type}:`, error);

      // If this was the last attempt, mark as failed permanently
      if (retryCount >= 2) {
        await job.moveToFailed({ message: 'Max retries exceeded' });
        await markTaskFailedPermanently(taskId, type, error);
      } else {
        // Queue for another retry
        await retryQueue.add(type, {
          taskId,
          type,
          data,
          retryCount: retryCount + 1
        }, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 10000 // 10 second delay for exponential backoff
          }
        });
      }

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5
  }
);

/**
 * Helper functions
 */

function getAdminClient() {
  return {
    from: (table: string) => ({
      select: () => ({
        single: () => Promise.resolve({ data: null, error: null }),
        single: () => Promise.resolve({ data: null, error: null }),
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: null })
          })
        }),
        update: () => ({
          eq: () => ({ select: () => Promise.resolve({ data: null, error: null }) })
        })
      })
    })
  };
}

async function processStripeWebhook(
  eventId: string,
  eventType: string,
  payload: any
): Promise<void> {
  const admin = getAdminClient();

  // Process different Stripe event types
  switch (eventType) {
    case 'payment_intent.succeeded':
      await handlePaymentSucceeded(eventId, payload);
      break;

    case 'payment_intent.payment_failed':
      await handlePaymentFailed(eventId, payload);
      break;

    case 'charge.refunded':
      await handleRefund(eventId, payload);
      break;

    case 'invoice.paid':
      await handleInvoicePaid(eventId, payload);
      break;

    case 'payout.paid':
      await handlePayoutPaid(eventId, payload);
      break;

    default:
      console.log(`Unhandled Stripe event: ${eventType}`);
  }
}

async function processPayPalWebhook(
  eventId: string,
  eventType: string,
  payload: any
): Promise<void> {
  const admin = getAdminClient();

  switch (eventType) {
    case 'PAYMENT.CAPTURE.COMPLETED':
      await handlePaymentSucceeded(eventId, payload);
      break;

    case 'PAYMENT.CAPTURE.DENIED':
      await handlePaymentFailed(eventId, payload);
      break;

    case 'PAYMENT.CAPTURE.REFUNDED':
      await handleRefund(eventId, payload);
      break;

    default:
      console.log(`Unhandled PayPal event: ${eventType}`);
  }
}

async function processGenericWebhook(
  gateway: string,
  eventType: string,
  payload: any
): Promise<void> {
  console.log(`Processing generic webhook from ${gateway}: ${eventType}`);
  // Generic webhook handling logic would go here
}

async function handlePaymentSucceeded(eventId: string, payload: any): Promise<void> {
  const admin = getAdminClient();

  // Find the associated transaction from webhook payload
  const transactionId = payload.data?.object?.id || payload.resource?.id;

  if (!transactionId) {
    console.error('No transaction ID in webhook payload');
    return;
  }

  // Update transaction status
  await (admin as any).from('transactions')
    .update({
      status: 'succeeded',
      gateway_transaction_id: transactionId,
      completed_at: new Date().toISOString()
    })
    .eq('gateway_slug', payload.object?.object || 'stripe')
    .eq('payment_intent', transactionId);

  // Update invoice status if applicable
  const { data: transaction } = await (admin as any).from('transactions')
    .select('invoice_id, amount_cents')
    .eq('payment_intent', transactionId)
    .single();

  if (transaction?.invoice_id) {
    await (admin as any).from('invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        paid_via_gateway: payload.object?.object || 'stripe',
        gateway_transaction_id: transactionId
      })
      .eq('id', transaction.invoice_id);

    // Update client total spend
    await (admin as any).from('clients')
      .update({
        total_spend_cents: admin.sql`total_spend_cents + ${transaction.amount_cents}`
      })
      .eq('id', transaction.client_id);

    // Notify payer
    await sendPaymentConfirmationEmail(
      '',
      transaction.amount_cents / 100,
      'USD',
      transaction.invoice_id,
      'stripe'
    );
  }

  // Log transaction event
  await (admin as any).from('transaction_events')
    .insert({
      transaction_id: transactionId,
      workspace_id: '', // Would come from context
      event_type: 'payment_succeeded',
      payload: JSON.stringify(payload)
    });
}

async function handlePaymentFailed(eventId: string, payload: any): Promise<void> {
  const admin = getAdminClient();

  const transactionId = payload.data?.object?.id || payload.resource?.id;

  if (!transactionId) {
    console.error('No transaction ID in failed payment webhook');
    return;
  }

  // Update transaction status
  await (admin as any).from('transactions')
    .update({
      status: 'failed',
      gateway_transaction_id: transactionId
    })
    .eq('payment_intent', transactionId);

  // Send notification
  await sendPaymentFailedEmail(
    '',
    0,
    'USD',
    payload.data?.object?.last_payment_error?.message || 'Payment failed'
  );
}

async function handleRefund(eventId: string, payload: any): Promise<void> {
  const admin = getAdminClient();

  const refundId = payload.data?.object?.id || payload.resource?.id;

  if (!refundId) {
    console.error('No refund ID in refund webhook');
    return;
  }

  await (admin as any).from('transactions')
    .update({
      status: 'refunded',
      gateway_refund_id: refundId
    })
    .eq('refund_id', refundId);

  // Send refund confirmation
  const { data: transaction } = await (admin as any).from('transactions')
    .select('invoice_id, amount_cents')
    .eq('refund_id', refundId)
    .single();

  if (transaction?.invoice_id) {
    await sendRefundConfirmationEmail(
      '',
      transaction.amount_cents / 100,
      'USD',
      transaction.invoice_id
    );
  }
}

async function handleInvoicePaid(eventId: string, payload: any): Promise<void> {
  const admin = getAdminClient();

  const invoiceId = payload.data?.object?.id;

  if (!invoiceId) {
    console.error('No invoice ID in invoice webhook');
    return;
  }

  await (admin as any).from('invoices')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString()
    })
    .eq('id', invoiceId);
}

async function handlePayoutPaid(eventId: string, payload: any): Promise<void> {
  const admin = getAdminClient();

  const payoutId = payload.data?.object?.id;

  if (!payoutId) {
    console.error('No payout ID in payout webhook');
    return;
  }

  await (admin as any).from('payouts')
    .update({
      status: 'paid',
      processed_at: new Date().toISOString(),
      gateway_payout_id: payoutId
    })
    .eq('id', payoutId);
}

async function sendInvoiceEmail(invoiceId: string): Promise<void> {
  // Queue email sending
  await emailQueue.add('send_invoice', {
    emailData: {
      to: '',
      subject: `Invoice #${invoiceId}`,
      html: ''
    }
  });
}

async function generateInvoicePDF(invoiceId: string): Promise<void> {
  // In production, this would call a PDF generation service
  // For now, we'll just log it
  console.log(`Generating PDF for invoice ${invoiceId}`);
}

async function processWebhookRetry(taskId: string, data: any): Promise<void> {
  console.log(`Retrying webhook processing for ${taskId}`);
  // Implement webhook retry logic
}

async function processPaymentRetry(taskId: string, data: any): Promise<void> {
  console.log(`Retrying payment processing for ${taskId}`);
  // Implement payment retry logic
}

async function markTaskFailedPermanently(taskId: string, type: string, error: Error): Promise<void> {
  console.error(`Task ${taskId} of type ${type} failed permanently:`, error);
  // Log to failed jobs table
}

/**
 * Add webhook job to queue
 */
export async function enqueueWebhookJob(input: {
  gateway: string;
  eventId: string;
  eventType: string;
  payload: any;
}): Promise<void> {
  await webhookQueue.add(input.eventType, input);
}

/**
 * Add invoice job to queue
 */
export async function enqueueInvoiceJob(input: {
  invoiceId: string;
  type: 'send' | 'generate_pdf' | 'payment_link';
}): Promise<void> {
  await invoiceQueue.add(input.type, input);
}

/**
 * Add email to queue
 */
export async function enqueueEmailJob(emailData: any): Promise<void> {
  await emailQueue.add('send', { emailData });
}

/**
 * Add payment retry to queue
 */
export async function enqueuePaymentRetry(paymentData: any): Promise<void> {
  await retryQueue.add('payment', paymentData);
}

/**
 * Close connections gracefully
 */
export async function closeWorkers(): Promise<void> {
  await Promise.all([
    webhookWorker.close(),
    invoiceWorker.close(),
    emailWorker.close(),
    retryWorker.close(),
    webhookQueue.close(),
    invoiceQueue.close(),
    emailQueue.close(),
    retryQueue.close()
  ]);
}

// Handle process termination
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing workers...');
  await closeWorkers();
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing workers...');
  await closeWorkers();
});
