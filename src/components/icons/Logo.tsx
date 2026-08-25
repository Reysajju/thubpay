type LogoProps = {
  iconOnly?: boolean;
  iconSize?: number;
  className?: string;
  showBadge?: boolean;
};

export default function Logo({
  iconOnly = false,
  iconSize = 36,
  className = '',
  showBadge = false,
}: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 group shrink-0 ${className}`}>
      <div 
        className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#0a0a0c] via-[#091a13] to-[#04281e] p-1 border border-[#00F5A0]/30 flex items-center justify-center shadow-lg shadow-[#00F5A0]/15 group-hover:border-[#00F5A0]/60 transition-all"
        style={{ width: iconSize, height: iconSize }}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="logo-shield-g" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00F5A0" />
              <stop offset="50%" stopColor="#00D9F5" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="logo-shield-fill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00F5A0" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#002419" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <path
            d="M50 8 L86 22 L86 52 C86 73 70 90 50 96 C30 90 14 73 14 52 L14 22 Z"
            fill="url(#logo-shield-fill)"
            stroke="url(#logo-shield-g)"
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <path
            d="M30 35 L70 35 L62 45 L54 45 L54 80 L46 80 L46 45 L38 45 Z"
            fill="#FFFFFF"
          />
          <path
            d="M50 45 L50 78"
            stroke="#00F5A0"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      {!iconOnly && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold tracking-tight select-none leading-tight text-lg transition-colors group-hover:text-white">
              <span className="text-white">THUB</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00F5A0] to-[#00D9F5]">PAY</span>
            </span>
            {showBadge && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#00F5A0]/10 text-[#00F5A0] border border-[#00F5A0]/25 uppercase tracking-wider">
                Pro
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
