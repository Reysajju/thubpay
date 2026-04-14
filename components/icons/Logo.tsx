const GOLD = '#C5A059';

type LogoProps = {
  iconOnly?: boolean;
  iconSize?: number;
  className?: string;
};

/** Brand mark: gold emblem + THUB (slate) / PAY (gold) wordmark for dark UI. */
export default function Logo({
  iconOnly = false,
  iconSize = 36,
  className = ''
}: LogoProps) {
  return (
    <div className={`flex items-center gap-2 group shrink-0 ${className}`}>
      <div 
        className="relative overflow-hidden rounded-lg transition-transform group-hover:scale-105 duration-200"
        style={{ width: iconSize, height: iconSize }}
      >
        <img
          src="/thubpay-logo.png"
          alt="ThubPay Logo"
          className="w-full h-full object-contain"
        />
      </div>
      {!iconOnly && (
        <span className="font-bold tracking-tight select-none leading-none text-lg transition-colors group-hover:text-white">
          <span className="text-zinc-400">THUB</span>
          <span style={{ color: GOLD }}>PAY</span>
        </span>
      )}
    </div>
  );
}
