'use client';

import { useState } from 'react';
import SetTargetModal from './SetTargetModal';
import { Target } from 'lucide-react';

export default function MonthlyTargetWidget({
  currentRevenueCents,
  targetCents
}: {
  currentRevenueCents: number;
  targetCents?: number;
}) {
  const [showModal, setShowModal] = useState(false);

  const hasTarget = typeof targetCents === 'number' && targetCents > 0;
  const progressPercent = hasTarget ? Math.min((currentRevenueCents / targetCents) * 100, 100) : 0;

  const toUsd = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format((cents || 0) / 100);
  };

  return (
    <>
      <div className="glass-card rounded-2xl p-3 sm:p-5 min-w-0 flex flex-col justify-center cursor-pointer hover:border-thubpay-gold/30 transition-all group" onClick={() => setShowModal(true)}>
        <div className="flex justify-between items-start mb-2">
          <p className="text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider leading-tight flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-zinc-400 group-hover:text-thubpay-gold transition-colors" />
            Monthly Goal
          </p>
          <span className="text-[10px] text-thubpay-gold/80 font-bold bg-thubpay-gold/10 px-1.5 py-0.5 rounded transition-all group-hover:bg-thubpay-gold/20">Edit</span>
        </div>
        
        {hasTarget ? (
          <div>
            <div className="flex items-end gap-2 mb-1.5">
              <span className="text-xl sm:text-2xl font-bold text-white leading-none">{toUsd(currentRevenueCents)}</span>
              <span className="text-xs text-zinc-500 font-medium mb-0.5">/ {toUsd(targetCents)}</span>
            </div>
            
            {/* Progress Bar Track */}
            <div className="h-1.5 w-full bg-thubpay-elevated rounded-full overflow-hidden">
              <div 
                className="h-full bg-thubpay-gold transition-all duration-1000 ease-out relative"
                style={{ width: `${progressPercent}%` }}
              >
                <div className="absolute top-0 right-0 bottom-0 w-8 bg-white/20 -skew-x-12 blur-[1px] animate-shimmer" />
              </div>
            </div>
            <p className="text-[10px] text-zinc-500 mt-1.5 text-right font-medium">{progressPercent.toFixed(1)}% Reached</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-2 h-full">
            <span className="text-sm font-semibold text-zinc-400 group-hover:text-zinc-200 transition-colors">+ Set numeric Goal</span>
          </div>
        )}
      </div>

      <SetTargetModal 
        open={showModal} 
        onClose={() => setShowModal(false)} 
        currentValue={targetCents} 
      />
    </>
  );
}
