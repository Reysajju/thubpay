import { createClient as createAdminClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface DisputeData {
  id: string;
  workspace_id: string;
  transaction_id?: string;
  gateway_slug: string;
  gateway_dispute_id?: string;
  amount_cents: number;
  currency: string;
  reason?: string;
  status: string;
  evidence_due_at?: string;
  resolved_at?: string;
  email?: string;
}

interface EvidenceFile {
  id: string;
  dispute_id: string;
  file_url: string;
  file_type: string;
  file_name: string;
  uploaded_at: string;
}

/**
 * Create a dispute record
 */
export async function createDispute(data: {
  workspaceId: string;
  transactionId?: string;
  gatewaySlug: string;
  gatewayDisputeId?: string;
  amountCents: number;
  currency: string;
  reason: string;
  email: string;
}): Promise<DisputeData> {
  const { data: dispute, error } = await admin
    .from('disputes')
    .insert({
      workspace_id: data.workspaceId,
      transaction_id: data.transactionId || null,
      gateway_slug: data.gatewaySlug,
      gateway_dispute_id: data.gatewayDisputeId || null,
      amount_cents: data.amountCents,
      currency: data.currency,
      reason: data.reason,
      status: 'needs_response',
      email: data.email
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create dispute: ${error.message}`);
  }

  // Notify workspace owner
  await admin
    .from('notifications')
    .insert({
      type: 'dispute_alert',
      title: 'New Dispute Alert',
      message: `A dispute has been filed for transaction amount ${data.amountCents / 100} ${data.currency}.`,
      channel: 'in_app',
      workspace_id: data.workspaceId,
      user_id: '', // Get from context
      metadata: { dispute_id: dispute.id, amount: data.amountCents }
    });

  return dispute as DisputeData;
}

/**
 * Get dispute by ID
 */
export async function getDispute(disputeId: string): Promise<DisputeData> {
  const { data: dispute } = await admin
    .from('disputes')
    .select('*')
    .eq('id', disputeId)
    .single();

  if (!dispute) {
    throw new Error('Dispute not found');
  }

  return dispute as DisputeData;
}

/**
 * Get disputes by workspace
 */
export async function getDisputesByWorkspace(workspaceId: string) {
  const { data: disputes } = await admin
    .from('disputes')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  return disputes || [];
}

/**
 * Upload evidence for a dispute
 */
export async function uploadDisputeEvidence(
  disputeId: string,
  fileData: {
    fileUrl: string;
    fileType: string;
    fileName: string;
  }
): Promise<EvidenceFile> {
  const { data: evidence, error } = await admin
    .from('dispute_evidence')
    .insert({
      dispute_id: disputeId,
      file_url: fileData.fileUrl,
      file_type: fileData.fileType,
      file_name: fileData.fileName,
      uploaded_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upload evidence: ${error.message}`);
  }

  return evidence as EvidenceFile;
}

/**
 * Get evidence files for a dispute
 */
export async function getDisputeEvidence(disputeId: string): Promise<EvidenceFile[]> {
  const { data: evidence } = await admin
    .from('dispute_evidence')
    .select('*')
    .eq('dispute_id', disputeId);

  return evidence || [];
}

/**
 * Update dispute status
 */
export async function updateDisputeStatus(
  disputeId: string,
  status: 'needs_response' | 'under_review' | 'won' | 'lost'
): Promise<void> {
  const updateData: any = { status };

  if (status === 'under_review') {
    updateData.resolved_at = new Date().toISOString();
  }

  const { error } = await admin
    .from('disputes')
    .update(updateData)
    .eq('id', disputeId);

  if (error) {
    throw new Error(`Failed to update dispute status: ${error.message}`);
  }

  // Update transaction status
  const { data: dispute } = await admin
    .from('disputes')
    .select('transaction_id')
    .eq('id', disputeId)
    .single();

  if (dispute?.transaction_id) {
    await admin
      .from('transactions')
      .update({
        status: status === 'won' ? 'refunded' : 'disputed',
        dispute_status: status
      })
      .eq('id', dispute.transaction_id);
  }
}

/**
 * Process Stripe dispute webhook
 */
export async function handleStripeDisputeEvent(event: Stripe.Event): Promise<void> {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16'
  });

  if (event.type === 'charge.dispute.created') {
    await handleDisputeCreated(event.data.object, event.id);
  } else if (event.type === 'charge.dispute.updated') {
    await handleDisputeUpdated(event.data.object, event.id);
  } else if (event.type === 'charge.dispute.closed') {
    await handleDisputeClosed(event.data.object, event.id);
  }
}

/**
 * Handle dispute created event
 */
async function handleDisputeCreated(dispute: Stripe.Dispute, eventId: string): Promise<void> {
  const { data: transaction } = await admin
    .from('transactions')
    .select('*, invoice_id')
    .eq('stripe_payment_intent', dispute.payment_intent)
    .single();

  if (!transaction) {
    console.error('Transaction not found for dispute');
    return;
  }

  await createDispute({
    workspaceId: transaction.workspace_id,
    transactionId: transaction.id,
    gatewaySlug: 'stripe',
    gatewayDisputeId: dispute.id,
    amountCents: Math.round(dispute.amount * 100),
    currency: 'usd',
    reason: dispute.reason,
    email: transaction.customer_email || ''
  });
}

/**
 * Handle dispute updated event
 */
async function handleDisputeUpdated(dispute: Stripe.Dispute, eventId: string): Promise<void> {
  const { data: disputeRecord } = await admin
    .from('disputes')
    .select('*')
    .eq('gateway_dispute_id', dispute.id)
    .single();

  if (!disputeRecord) {
    console.error('Dispute record not found');
    return;
  }

  // Update dispute with new information
  await admin
    .from('disputes')
    .update({
      reason: dispute.reason,
      status: 'under_review',
      evidence_due_at: new Date(dispute.evidence_due_by * 1000).toISOString()
    })
    .eq('id', disputeRecord.id);

  // Notify workspace owner
  await admin
    .from('notifications')
    .insert({
      type: 'dispute_updated',
      title: 'Dispute Status Updated',
      message: `Your dispute status has been updated to ${dispute.status}.`,
      channel: 'in_app',
      workspace_id: disputeRecord.workspace_id,
      user_id: '', // Get from context
      metadata: { dispute_id: disputeRecord.id }
    });
}

/**
 * Handle dispute closed event
 */
async function handleDisputeClosed(dispute: Stripe.Dispute, eventId: string): Promise<void> {
  const { data: disputeRecord } = await admin
    .from('disputes')
    .select('*')
    .eq('gateway_dispute_id', dispute.id)
    .single();

  if (!disputeRecord) {
    console.error('Dispute record not found');
    return;
  }

  await updateDisputeStatus(disputeRecord.id, dispute.status === 'won' ? 'won' : 'lost');

  // Notify workspace owner
  const statusText = dispute.status === 'won' ? 'won' : 'lost';
  await admin
    .from('notifications')
    .insert({
      type: 'dispute_resolved',
      title: `Dispute ${statusText.toUpperCase()}`,
      message: `Your dispute has been ${statusText}. Amount at stake: ${(dispute.amount / 100).toFixed(2)} USD.`,
      channel: 'in_app',
      workspace_id: disputeRecord.workspace_id,
      user_id: '', // Get from context
      metadata: {
        dispute_id: disputeRecord.id,
        amount: Math.round(dispute.amount * 100),
        status: statusText
      }
    });
}

/**
 * Submit dispute evidence to gateway
 */
export async function submitDisputeEvidenceToGateway(
  disputeId: string,
  evidenceFiles: EvidenceFile[]
): Promise<void> {
  const { data: dispute } = await admin
    .from('disputes')
    .select('gateway_dispute_id')
    .eq('id', disputeId)
    .single();

  if (!dispute) {
    throw new Error('Dispute not found');
  }

  // In production, this would upload files to gateway (e.g., Stripe)
  // For now, we'll just update the dispute status
  await updateDisputeStatus(disputeId, 'under_review');

  console.log(`Submitted evidence for dispute ${disputeId} to gateway ${dispute.gateway_dispute_id}`);
}

/**
 * Get dispute statistics for workspace
 */
export async function getDisputeStatistics(workspaceId: string): Promise<{
  total: number;
  needs_response: number;
  under_review: number;
  won: number;
  lost: number;
  total_at_stake: number;
}> {
  const { data: disputes } = await admin
    .from('disputes')
    .select('status, amount_cents')
    .eq('workspace_id', workspaceId);

  const stats = {
    total: disputes?.length || 0,
    needs_response: disputes?.filter((d) => d.status === 'needs_response').length || 0,
    under_review: disputes?.filter((d) => d.status === 'under_review').length || 0,
    won: disputes?.filter((d) => d.status === 'won').length || 0,
    lost: disputes?.filter((d) => d.status === 'lost').length || 0,
    total_at_stake: disputes?.reduce((sum, d) => sum + d.amount_cents, 0) || 0
  };

  return stats;
}

/**
 * Get overdue disputes
 */
export async function getOverdueDisputes(workspaceId: string): Promise<DisputeData[]> {
  const { data: disputes } = await admin
    .from('disputes')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'needs_response')
    .lt('evidence_due_at', new Date().toISOString());

  return disputes || [];
}

/**
 * Calculate dispute win rate
 */
export async function calculateDisputeWinRate(workspaceId: string): Promise<{
  total: number;
  won: number;
  lost: number;
  win_rate: number;
}> {
  const { data: disputes } = await admin
    .from('disputes')
    .select('status')
    .eq('workspace_id', workspaceId)
    .neq('status', 'needs_response');

  const total = disputes?.length || 0;
  const won = disputes?.filter((d) => d.status === 'won').length || 0;
  const lost = disputes?.filter((d) => d.status === 'lost').length || 0;
  const win_rate = total > 0 ? Math.round((won / total) * 100) : 0;

  return { total, won, lost, win_rate };
}