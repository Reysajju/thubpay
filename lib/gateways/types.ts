/**
 * ThubPay — Payment Gateway Abstraction Types
 * Defines the contract every gateway adapter must implement.
 * Per instructions.docx §2.1
 */

export type GatewayName =
  | 'stripe'
  | 'paypal'
  | 'square'
  | 'adyen'
  | 'razorpay'
  | 'authorize_net'
  | 'mollie'
  | 'twocheckout'
  | 'klarna';

export type BillingInterval = 'day' | 'week' | 'month' | 'year';

export interface CustomerParams {
  email: string;
  name: string;
  metadata?: Record<string, string>;
}

export interface GatewayCustomer {
  id: string;
  gateway: GatewayName;
  email: string;
  name: string;
  raw: unknown; // raw gateway response
}

export interface PaymentMethodParams {
  /** Gateway-specific token from client-side SDK (never raw card data) */
  token: string;
  customerId: string;
  setAsDefault?: boolean;
}

export interface GatewayPaymentMethod {
  id: string;
  gateway: GatewayName;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
}

export interface SubscriptionParams {
  customerId: string;
  priceId: string;
  paymentMethodId?: string;
  trialDays?: number;
  metadata?: Record<string, string>;
}

export interface GatewaySubscription {
  id: string;
  gateway: GatewayName;
  customerId: string;
  status:
    | 'active'
    | 'trialing'
    | 'past_due'
    | 'canceled'
    | 'unpaid'
    | 'paused';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  raw: unknown;
}

export interface RefundParams {
  transactionId: string;
  amount?: number; // in cents; omit for full refund
  reason?: string;
}

export interface GatewayRefund {
  id: string;
  gateway: GatewayName;
  transactionId: string;
  amount: number;
  status: 'pending' | 'succeeded' | 'failed';
}

export interface WebhookEvent {
  gateway: GatewayName;
  eventType: string;
  /** Normalised payload — gateway-specific fields stripped */
  payload: Record<string, unknown>;
  rawBody: string;
  signature: string;
}

export interface GatewayWebhookResult {
  eventId: string;
  eventType: string;
  processed: boolean;
}

/**
 * PaymentGateway — the interface every adapter must fulfil.
 * Business logic should only ever depend on this interface,
 * never on a concrete adapter class.
 */
export interface PaymentGateway {
  readonly name: GatewayName;

  /** Create or retrieve a customer in the gateway */
  createCustomer(params: CustomerParams): Promise<GatewayCustomer>;
  getCustomer(customerId: string): Promise<GatewayCustomer>;
  deleteCustomer(customerId: string): Promise<void>;

  /** Payment methods */
  attachPaymentMethod(
    params: PaymentMethodParams
  ): Promise<GatewayPaymentMethod>;
  listPaymentMethods(customerId: string): Promise<GatewayPaymentMethod[]>;
  detachPaymentMethod(paymentMethodId: string): Promise<void>;

  /** Subscriptions */
  createSubscription(
    params: SubscriptionParams
  ): Promise<GatewaySubscription>;
  getSubscription(subscriptionId: string): Promise<GatewaySubscription>;
  cancelSubscription(
    subscriptionId: string,
    immediately?: boolean
  ): Promise<GatewaySubscription>;
  updateSubscription(
    subscriptionId: string,
    params: Partial<SubscriptionParams>
  ): Promise<GatewaySubscription>;

  /** Refunds */
  createRefund(params: RefundParams): Promise<GatewayRefund>;

  /** Webhooks — verify signature + normalise event */
  handleWebhook(event: WebhookEvent): Promise<GatewayWebhookResult>;
}
