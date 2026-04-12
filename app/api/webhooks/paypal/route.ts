import { enqueueWebhookJob } from '@/src/services/webhook-queue';

export async function POST(req: Request) {
  const body = await req.text();
  const headers = req.headers;
  const transmissionId = headers.get('paypal-transmission-id');
  const eventType = headers.get('paypal-transmission-sig') ? 'paypal.event' : 'paypal.unknown';

  // Full PayPal signature verification requires cert URL + API verification call.
  // This route stores the raw event first for async verification/processing workers.
  if (!transmissionId) {
    return new Response('Missing PayPal transmission ID', { status: 400 });
  }

  await enqueueWebhookJob({
    gateway: 'paypal',
    eventId: transmissionId,
    eventType,
    payload: body
  });

  return new Response(JSON.stringify({ received: true }));
}
