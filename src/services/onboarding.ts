import { createClient as createAdminClient } from '@supabase/supabase-js';

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export type OnboardingStep =
  | 'add_client'
  | 'create_invoice'
  | 'create_payment_link'
  | 'connect_gateway'
  | 'customize_brand';

export interface OnboardingStepData {
  id: string;
  workspace_id: string;
  step_name: OnboardingStep;
  is_completed: boolean;
  completed_at?: string;
  created_at: string;
}

/**
 * Complete an onboarding step
 */
export async function completeOnboardingStep(
  workspaceId: string,
  stepName: OnboardingStep
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await admin
    .from('onboarding_steps')
    .upsert({
      workspace_id: workspaceId,
      step_name: stepName,
      is_completed: true,
      completed_at: now
    }, {
      onConflict: 'workspace_id,step_name'
    });

  if (error) {
    console.error('Failed to complete onboarding step:', error);
    throw error;
  }

  // Check if all steps are complete
  await checkOnboardingComplete(workspaceId);
}

/**
 * Get onboarding steps for workspace
 */
export async function getOnboardingSteps(workspaceId: string): Promise<OnboardingStepData[]> {
  const { data, error } = await admin
    .from('onboarding_steps')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch onboarding steps:', error);
    return [];
  }

  return data || [];
}

/**
 * Get next onboarding step
 */
export async function getNextOnboardingStep(workspaceId: string): Promise<OnboardingStep | null> {
  const { data: allSteps } = await admin
    .from('onboarding_steps')
    .select('*')
    .eq('workspace_id', workspaceId);

  if (!allSteps || allSteps.length === 0) {
    return 'add_client';
  }

  const completedSteps = allSteps
    .filter(step => step.is_completed)
    .map(step => step.step_name);

  const requiredSteps: OnboardingStep[] = [
    'add_client',
    'create_invoice',
    'create_payment_link',
    'connect_gateway',
    'customize_brand'
  ];

  // Find the first uncompleted required step
  for (const step of requiredSteps) {
    if (!completedSteps.includes(step)) {
      return step;
    }
  }

  return null; // All steps complete
}

/**
 * Check if onboarding is complete
 */
export async function checkOnboardingComplete(workspaceId: string): Promise<boolean> {
  const { data: steps } = await getOnboardingSteps(workspaceId);

  if (!steps || steps.length === 0) {
    return false;
  }

  const allStepsComplete = steps.length > 0 &&
    steps.every(step => step.is_completed);

  if (allStepsComplete) {
    await admin
      .from('workspaces')
      .update({ onboarding_completed: true })
      .eq('id', workspaceId);
  }

  return allStepsComplete;
}

/**
 * Get onboarding progress percentage
 */
export async function getOnboardingProgress(workspaceId: string): Promise<number> {
  const { data: steps } = await getOnboardingSteps(workspaceId);

  if (!steps || steps.length === 0) {
    return 0;
  }

  const completedCount = steps.filter(step => step.is_completed).length;
  const percentage = Math.round((completedCount / steps.length) * 100);

  return percentage;
}

/**
 * Reset onboarding progress
 */
export async function resetOnboardingProgress(workspaceId: string): Promise<void> {
  const { error } = await admin
    .from('onboarding_steps')
    .update({ is_completed: false, completed_at: null })
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('Failed to reset onboarding progress:', error);
    throw error;
  }
}

/**
 * Get onboarding step description
 */
export function getOnboardingStepDescription(stepName: OnboardingStep): string {
  const descriptions: Record<OnboardingStep, string> = {
    add_client: 'Add your first client to the system',
    create_invoice: 'Create and send your first invoice',
    create_payment_link: 'Generate a payment link for faster payments',
    connect_gateway: 'Connect a payment gateway',
    customize_brand: 'Customize your payment portal branding'
  };

  return descriptions[stepName];
}

/**
 * Get onboarding step instructions
 */
export function getOnboardingStepInstructions(stepName: OnboardingStep): string[] {
  const instructions: Record<OnboardingStep, string[]> = {
    add_client: [
      'Navigate to the Clients section',
      'Click "Add Client"',
      'Enter client details (name, email, address)',
      'Save the client'
    ],
    create_invoice: [
      'Go to the Invoices section',
      'Click "Create Invoice"',
      'Select a client',
      'Add line items with descriptions and amounts',
      'Set due date and save'
    ],
    create_payment_link: [
      'In the Invoices section',
      'Click "Generate Payment Link"',
      'Copy and share the link with your client'
    ],
    connect_gateway: [
      'Go to Settings → Payment Gateways',
      'Click "Add Gateway"',
      'Select your gateway (Stripe, PayPal, etc.)',
      'Enter your API credentials',
      'Test the connection'
    ],
    customize_brand: [
      'Go to Settings → Branding',
      'Upload your logo',
      'Customize colors',
      'Add support email and website'
    ]
  };

  return instructions[stepName];
}

/**
 * Initialize onboarding steps for workspace
 */
export async function initializeOnboardingSteps(workspaceId: string): Promise<void> {
  const { error } = await admin
    .from('onboarding_steps')
    .insert([
      { workspace_id: workspaceId, step_name: 'add_client', is_completed: false },
      { workspace_id: workspaceId, step_name: 'create_invoice', is_completed: false },
      { workspace_id: workspaceId, step_name: 'create_payment_link', is_completed: false },
      { workspace_id: workspaceId, step_name: 'connect_gateway', is_completed: false },
      { workspace_id: workspaceId, step_name: 'customize_brand', is_completed: false }
    ]);

  if (error) {
    console.error('Failed to initialize onboarding steps:', error);
    throw error;
  }
}

/**
 * Skip onboarding step
 */
export async function skipOnboardingStep(
  workspaceId: string,
  stepName: OnboardingStep
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await admin
    .from('onboarding_steps')
    .update({
      is_completed: true,
      completed_at: now
    })
    .eq('workspace_id', workspaceId)
    .eq('step_name', stepName);

  if (error) {
    console.error('Failed to skip onboarding step:', error);
    throw error;
  }

  // Check if all steps are complete
  await checkOnboardingComplete(workspaceId);
}

/**
 * Get onboarding configuration
 */
export function getOnboardingConfiguration(): {
  steps: Array<{
    name: OnboardingStep;
    description: string;
    order: number;
  }>;
} {
  return {
    steps: [
      { name: 'add_client', description: getOnboardingStepDescription('add_client'), order: 1 },
      { name: 'create_invoice', description: getOnboardingStepDescription('create_invoice'), order: 2 },
      { name: 'create_payment_link', description: getOnboardingStepDescription('create_payment_link'), order: 3 },
      { name: 'connect_gateway', description: getOnboardingStepDescription('connect_gateway'), order: 4 },
      { name: 'customize_brand', description: getOnboardingStepDescription('customize_brand'), order: 5 }
    ]
  };
}