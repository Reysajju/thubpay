export type GatewaySlug =
  | 'stripe'
  | 'paypal'
  | 'square'
  | 'braintree'
  | 'authorize_net'
  | 'adyen'
  | 'razorpay'
  | 'mollie'
  | 'checkout_com'
  | 'verifone';

export const SUPPORTED_GATEWAYS: GatewaySlug[] = [
  'stripe',
  'paypal',
  'square',
  'braintree',
  'authorize_net',
  'adyen',
  'razorpay',
  'mollie',
  'checkout_com',
  'verifone'
];

export const DEFAULT_GATEWAY: GatewaySlug = 'stripe';

export const HIGH_RISK_AMOUNT_MULTIPLIER = 3;
