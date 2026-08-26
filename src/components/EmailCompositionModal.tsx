'use client';

// ─────────────────────────────────────────────────────────────
// Phase 6 #20: Email Composition Modal
//
// Replaces raw `mailto:` links with an in-app modal that lets the
// user edit the subject + body before opening the email in their
// mail client. Drafts auto-save to localStorage so the user
// doesn't lose work if they close the modal.
//
// Props:
//   open, onOpenChange — standard dialog control
//   to, subject, body  — initial values (e.g. from lifecycle CTA)
//   templateKey        — localStorage key for draft persistence
//                        (e.g. "welcome-email" for the new-customer
//                         welcome template, so the user can edit
//                         the template once and reuse it)
//
// Behavior:
//   • Editable to / cc / subject / body fields
//   • Live preview of resulting mailto link
//   • "Open in mail app" button (window.location.href = mailto)
//   • "Copy to clipboard" button (copies body)
//   • Auto-saves draft to localStorage after 1s of inactivity
//   • "Reset to template" button clears the saved draft
// ─────────────────────────────────────────────────────────────

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Mail, Copy, Check, ExternalLink, RotateCcw, Save } from 'lucide-react';

export interface EmailCompositionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  to: string;
  subject: string;
  body: string;
  templateKey?: string;
  title?: string;
  description?: string;
}

interface Draft {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
}

const TEMPLATE_VARIABLES: Array<{ token: string; label: string }> = [
  { token: '{{customer_name}}', label: 'Customer name' },
  { token: '{{company}}', label: 'Company' },
  { token: '{{workspace_name}}', label: 'Workspace name' },
  { token: '{{invoice_link}}', label: 'Invoice link' },
];

export function EmailCompositionModal({
  open,
  onOpenChange,
  to,
  subject,
  body,
  templateKey,
  title = 'Compose email',
  description = 'Edit the message and open it in your default mail app.',
}: EmailCompositionModalProps) {
  const draftKey = templateKey ? `thubpay:draft:${templateKey}` : null;

  // Load persisted draft (if any) on open
  const [draft, setDraft] = React.useState<Draft>({
    to,
    cc: '',
    bcc: '',
    subject,
    body,
  });
  const [showCc, setShowCc] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [hasDraft, setHasDraft] = React.useState(false);

  // Reset draft when modal opens (so props + persisted draft are merged)
  React.useEffect(() => {
    if (!open) return;
    let persisted: Partial<Draft> | null = null;
    if (draftKey) {
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) {
          persisted = JSON.parse(raw);
          setHasDraft(true);
        } else {
          setHasDraft(false);
        }
      } catch {
        setHasDraft(false);
      }
    }
    setDraft({
      to: persisted?.to ?? to,
      cc: persisted?.cc ?? '',
      bcc: persisted?.bcc ?? '',
      subject: persisted?.subject ?? subject,
      body: persisted?.body ?? body,
    });
    setShowCc(Boolean(persisted?.cc) || Boolean(persisted?.bcc));
    setCopied(false);
    setSaved(false);
  }, [open]);

  // Auto-save to localStorage 1s after the last keystroke
  React.useEffect(() => {
    if (!open || !draftKey) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(draft));
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      } catch {
        // localStorage might be disabled (private mode) — silently ignore
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [draft, open, draftKey]);

  // Build the mailto URL
  const params = new URLSearchParams();
  if (draft.cc) params.set('cc', draft.cc);
  if (draft.bcc) params.set('bcc', draft.bcc);
  if (draft.subject) params.set('subject', draft.subject);
  if (draft.body) params.set('body', draft.body);
  const qs = params.toString();
  const mailtoHref = `mailto:${draft.to || ''}${qs ? `?${qs}` : ''}`;

  function handleOpenMailApp(e: React.MouseEvent) {
    e.preventDefault();
    // Use location.href so the browser opens the default mail client
    window.location.href = mailtoHref;
    onOpenChange(false);
  }

  async function handleCopyBody() {
    try {
      await navigator.clipboard.writeText(draft.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API might not be available in non-secure contexts
    }
  }

  function handleResetDraft() {
    if (!draftKey) return;
    try {
      localStorage.removeItem(draftKey);
    } catch {}
    setDraft({ to, cc: '', bcc: '', subject, body });
    setShowCc(false);
    setHasDraft(false);
  }

  function insertVariable(token: string) {
    setDraft((d) => ({ ...d, body: `${d.body}${token}` }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Mail className="w-3.5 h-3.5 text-emerald-400" />
            </span>
            <span className="text-white">{title}</span>
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* To */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider w-12 flex-shrink-0">
              To
            </label>
            <input
              type="email"
              value={draft.to}
              onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
              placeholder="customer@example.com"
              className="flex-1 px-3 py-1.5 rounded-lg bg-[#0a0a0b] border border-[#252529]/50 focus:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 text-sm text-white placeholder-zinc-600"
            />
            {!showCc ? (
              <button
                type="button"
                onClick={() => setShowCc(true)}
                className="text-[10px] font-bold text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1"
              >
                + Cc/Bcc
              </button>
            ) : null}
          </div>

          {/* CC / BCC */}
          {showCc ? (
            <>
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider w-12 flex-shrink-0">
                  Cc
                </label>
                <input
                  type="email"
                  value={draft.cc}
                  onChange={(e) => setDraft((d) => ({ ...d, cc: e.target.value }))}
                  placeholder="cc@example.com"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-[#0a0a0b] border border-[#252529]/50 focus:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 text-sm text-white placeholder-zinc-600"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider w-12 flex-shrink-0">
                  Bcc
                </label>
                <input
                  type="email"
                  value={draft.bcc}
                  onChange={(e) => setDraft((d) => ({ ...d, bcc: e.target.value }))}
                  placeholder="bcc@example.com"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-[#0a0a0b] border border-[#252529]/50 focus:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 text-sm text-white placeholder-zinc-600"
                />
              </div>
            </>
          ) : null}

          {/* Subject */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider w-12 flex-shrink-0">
              Subject
            </label>
            <input
              type="text"
              value={draft.subject}
              onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
              placeholder="Email subject"
              className="flex-1 px-3 py-1.5 rounded-lg bg-[#0a0a0b] border border-[#252529]/50 focus:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 text-sm text-white placeholder-zinc-600"
            />
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                Body
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.token}
                    type="button"
                    onClick={() => insertVariable(v.token)}
                    title={`Insert ${v.label}`}
                    className="text-[9px] font-mono text-zinc-400 bg-[#1a1a1f] hover:bg-[#222227] border border-[#252529] hover:border-emerald-500/30 px-1.5 py-0.5 rounded transition-colors"
                  >
                    {v.token}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={draft.body}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
              rows={8}
              placeholder="Email body…"
              className="w-full px-3 py-2 rounded-lg bg-[#0a0a0b] border border-[#252529]/50 focus:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 text-sm text-white placeholder-zinc-600 font-mono resize-y min-h-[160px] custom-scrollbar"
            />
          </div>

          {/* Live preview of mailto link */}
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
              Mailto preview
            </p>
            <pre className="text-[10px] text-zinc-400 bg-[#131316] rounded-lg p-2 overflow-x-auto custom-scrollbar font-mono break-all whitespace-pre-wrap">
              {mailtoHref.length > 240 ? mailtoHref.slice(0, 240) + '…' : mailtoHref}
            </pre>
          </div>

          {/* Auto-save indicator */}
          <div className="flex items-center justify-between text-[10px] text-zinc-600">
            <span className="flex items-center gap-1.5">
              {saved ? (
                <>
                  <Save className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400/80">Draft auto-saved</span>
                </>
              ) : hasDraft ? (
                <span>Draft loaded from previous edit</span>
              ) : (
                <span>Edits will auto-save to your browser</span>
              )}
            </span>
            {hasDraft ? (
              <button
                type="button"
                onClick={handleResetDraft}
                className="inline-flex items-center gap-1 text-zinc-500 hover:text-amber-400 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset to template
              </button>
            ) : null}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={handleCopyBody}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#2e2e33] bg-[#18181c] hover:border-[#3e3e44] hover:bg-[#1d1d22] text-zinc-200 text-xs font-semibold transition-all hover-lift"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy body
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleOpenMailApp}
            disabled={!draft.to.trim()}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15 hover:border-emerald-500/50 text-emerald-400 text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover-lift"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open in mail app
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EmailCompositionModal;
