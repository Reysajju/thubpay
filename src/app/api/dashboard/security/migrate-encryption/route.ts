import { NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { db } from '@/lib/db';
import { isLegacyEncryption, migrateToAES } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

/**
 * POST /api/dashboard/security/migrate-encryption
 *
 * Migrates all legacy XOR-encrypted gateway secrets to AES-256-GCM.
 * This is a one-time migration that should be run after deploying the
 * crypto upgrade. Secrets already using v2 (AES-256-GCM) are skipped.
 *
 * Returns a summary of migrated/skipped secrets.
 */
export async function POST() {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    // Find all gateway credentials with encrypted secrets
    const gateways = await db.gatewayCredential.findMany({
      where: { workspaceId: ctx.context.workspaceId, secretKeyEnc: { not: null } },
      select: { id: true, label: true, gatewaySlug: true, secretKeyEnc: true },
    });

    let migrated = 0;
    let skipped = 0;
    let failed = 0;
    const details: { label: string; gateway: string; status: 'migrated' | 'skipped' | 'failed' }[] = [];

    for (const gw of gateways) {
      if (!gw.secretKeyEnc) {
        skipped++;
        continue;
      }

      if (!isLegacyEncryption(gw.secretKeyEnc)) {
        // Already AES-256-GCM
        skipped++;
        details.push({ label: gw.label, gateway: gw.gatewaySlug, status: 'skipped' });
        continue;
      }

      // Migrate to AES-256-GCM
      const newEncrypted = migrateToAES(gw.secretKeyEnc);
      if (newEncrypted === null) {
        failed++;
        details.push({ label: gw.label, gateway: gw.gatewaySlug, status: 'failed' });
        continue;
      }

      await db.gatewayCredential.update({
        where: { id: gw.id },
        data: { secretKeyEnc: newEncrypted },
      });

      migrated++;
      details.push({ label: gw.label, gateway: gw.gatewaySlug, status: 'migrated' });
    }

    // Create an audit notification
    await db.notification.create({
      data: {
        workspaceId: ctx.context.workspaceId,
        title: 'Encryption upgraded',
        body: `${migrated} gateway secret${migrated !== 1 ? 's' : ''} migrated to AES-256-GCM. ${skipped} already encrypted.`,
        type: 'success',
      },
    });

    return NextResponse.json({
      success: true,
      summary: {
        total: gateways.length,
        migrated,
        skipped,
        failed,
      },
      details,
    });
  } catch (error) {
    console.error('[api/security/migrate-encryption] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
