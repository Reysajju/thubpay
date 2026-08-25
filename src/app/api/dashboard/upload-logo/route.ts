import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
  'image/gif',
]);

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/gif': 'gif',
};

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * POST /api/dashboard/upload-logo
 *
 * Accepts a multipart/form-data upload with a `file` field, writes the
 * file to /public/uploads/logos/{workspaceId}-{timestamp}.{ext}, and
 * updates `workspace.logoUrl`.
 *
 * Returns `{ success: true, logoUrl }` on success.
 */
export async function POST(req: NextRequest) {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { error: 'Expected multipart/form-data with a "file" field' },
        { status: 400 }
      );
    }

    const file = formData.get('file');
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided. Attach a "file" field to your upload.' },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Invalid file upload — "file" must be a File/Blob.' },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: 'Uploaded file is empty' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_FILE_BYTES / 1024 / 1024}MB)` },
        { status: 400 }
      );
    }

    const mimeType = file.type || '';
    if (!ALLOWED_MIME.has(mimeType)) {
      return NextResponse.json(
        {
          error: `Unsupported file type: "${mimeType || 'unknown'}". Allowed: ${Array.from(ALLOWED_MIME).join(', ')}`,
        },
        { status: 400 }
      );
    }

    const ext = MIME_TO_EXT[mimeType] || 'bin';
    const filename = `${ctx.context.workspaceId}-${Date.now()}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'logos');
    const filePath = path.join(uploadDir, filename);

    // Ensure the directory exists
    await fs.mkdir(uploadDir, { recursive: true });

    // Write the file
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));

    // Public URL (relative)
    const logoUrl = `/uploads/logos/${filename}`;

    // Persist the URL on the workspace
    await db.workspace.update({
      where: { id: ctx.context.workspaceId },
      data: { logoUrl },
    });

    return NextResponse.json({ success: true, logoUrl });
  } catch (error) {
    console.error('[api/dashboard/upload-logo] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
