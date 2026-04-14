'use client';

import { useRef, useState, useTransition } from 'react';
import { createBrand } from '../actions';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AddBrandModal({ open, onClose }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [gradientFrom, setGradientFrom] = useState('#C5A059');
  const [gradientTo, setGradientTo] = useState('#0A6C7B');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  if (!open) return null;

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Local preview
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload to /api/upload-brand-logo
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/dashboard/upload-logo', { method: 'POST', body: fd });
      if (res.ok) {
        const { url } = await res.json();
        setLogoUrl(url);
      }
    } catch {
      // keep local preview, skip cloud url
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('gradient_from', gradientFrom);
    fd.set('gradient_to', gradientTo);
    fd.set('logo_url', logoUrl);
    startTransition(async () => {
      await createBrand(fd);
      setSuccess(true);
      formRef.current?.reset();
      setLogoPreview(null);
      setLogoUrl('');
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 900);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg bg-thubpay-surface rounded-2xl shadow-2xl border border-thubpay-border overflow-hidden animate-slideUp">
        {/* Header — live gradient preview */}
        <div
          className="px-6 py-5 transition-all duration-300"
          style={{ background: `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)` }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Brand logo"
                  className="w-12 h-12 rounded-xl object-cover border-2 border-white/30"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-black/20 flex items-center justify-center text-white text-xl font-bold">
                  B
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold text-white">Add New Brand</h2>
                <p className="text-white/75 text-sm mt-0.5">Customize your brand identity</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center text-white hover:bg-black/30 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Brand Name */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-wide">
              Brand Name *
            </label>
            <input
              name="name"
              required
              placeholder="My Awesome Brand"
              className="w-full px-3.5 py-2.5 rounded-xl border border-thubpay-border bg-thubpay-elevated text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-thubpay-gold/40 transition"
            />
          </div>

          {/* Website */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-wide">
              Website
            </label>
            <input
              name="website"
              type="url"
              placeholder="https://mybrand.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-thubpay-border bg-thubpay-elevated text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-thubpay-gold/40 transition"
            />
          </div>

          {/* Gradient Colors */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wide">
              Brand Color Gradient
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-xs text-zinc-400 mb-1">From</p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={gradientFrom}
                    onChange={(e) => setGradientFrom(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-thubpay-border cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={gradientFrom}
                    onChange={(e) => setGradientFrom(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-thubpay-border bg-thubpay-elevated text-zinc-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-thubpay-gold/40"
                  />
                </div>
              </div>
              <div
                className="w-16 h-10 rounded-xl flex-shrink-0 shadow-inner"
                style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
              />
              <div className="flex-1">
                <p className="text-xs text-zinc-400 mb-1">To</p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={gradientTo}
                    onChange={(e) => setGradientTo(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-thubpay-border cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={gradientTo}
                    onChange={(e) => setGradientTo(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-thubpay-border bg-thubpay-elevated text-zinc-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-thubpay-gold/40"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Logo Upload */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-wide">
              Brand Logo
            </label>
            <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-thubpay-border rounded-xl cursor-pointer hover:border-thubpay-gold/50 transition group">
              {logoPreview ? (
                <img src={logoPreview} alt="Preview" className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-thubpay-elevated flex items-center justify-center text-zinc-500 group-hover:border-thubpay-gold/40 border border-thubpay-border transition text-lg">
                  🖼️
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-300">
                  {uploading ? 'Uploading...' : logoPreview ? 'Change logo' : 'Upload logo'}
                </p>
                <p className="text-xs text-zinc-400">PNG, JPG, SVG, WebP — any format</p>
              </div>
              {uploading && (
                <span className="w-5 h-5 border-2 border-zinc-300 border-t-thubpay-gold rounded-full animate-spin" />
              )}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleLogoChange}
              />
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-thubpay-border text-zinc-300 text-sm font-semibold hover:bg-thubpay-elevated transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || uploading}
              className="flex-1 py-2.5 rounded-xl text-[#111] text-sm font-semibold disabled:opacity-60 transition flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)` }}
            >
              {isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-[#111]/30 border-t-[#111] rounded-full animate-spin" />
                  Saving...
                </>
              ) : success ? (
                '✓ Brand Saved!'
              ) : (
                'Save Brand'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
