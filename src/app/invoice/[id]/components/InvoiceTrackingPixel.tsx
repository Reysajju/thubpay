'use client';

import { useEffect, useRef } from 'react';

/**
 * Invisible 1×1 tracking pixel that fires the
 * `/api/public/invoice/track/{token}` endpoint every time the
 * public invoice page is rendered in a real browser.
 *
 * It uses an <img> tag so it works even when JavaScript is
 * partially blocked — the browser still attempts to load the image.
 * We also add a no-JS <noscript> fallback for completeness.
 *
 * The pixel URL is cache-busted on each mount via a random query
 * string so the request is never deduplicated by the browser cache.
 *
 * Implementation note: we set the `src` via a ref inside `useEffect`
 * rather than via React state — this is a textbook "synchronize with
 * an external system" effect (the DOM `<img>` element) and avoids
 * both the SSR-hydration mismatch AND the
 * `react-hooks/set-state-in-effect` lint warning.
 */
export default function InvoiceTrackingPixel({ token }: { token: string }) {
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!imgRef.current) return;
    const origin = window.location.origin;
    const cacheBuster =
      Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    // Setting `.src` on an <img> triggers the browser to fetch it,
    // which is exactly what we want — the server records the view.
    imgRef.current.src = `${origin}/api/public/invoice/track/${token}?t=${cacheBuster}`;
  }, [token]);

  return (
    <>
      {/*
        Render a 1×1 placeholder gif on the server so the element exists
        immediately; the real tracking URL is swapped in by the effect
        above once the component mounts on the client.
      */}
      <img
        ref={imgRef}
        src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
        alt=""
        width={1}
        height={1}
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          left: -100,
          top: -100,
          opacity: 0,
          pointerEvents: 'none',
          border: 0,
          background: 'transparent',
        }}
      />
      <noscript>
        <img
          src={`/api/public/invoice/track/${token}?t=noscript`}
          alt=""
          width={1}
          height={1}
          style={{ position: 'absolute', left: -100, top: -100, opacity: 0 }}
        />
      </noscript>
    </>
  );
}
