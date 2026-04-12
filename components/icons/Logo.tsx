const Logo = ({ ...props }) => (
  <svg
    width="36"
    height="36"
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <defs>
      <linearGradient id="thubpay-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#7A5A2B" />
        <stop offset="100%" stopColor="#D4B27A" />
      </linearGradient>
    </defs>
    {/* Background circle */}
    <rect width="36" height="36" rx="10" fill="url(#thubpay-grad)" />
    {/* T letterform */}
    <text
      x="18"
      y="27"
      textAnchor="middle"
      fontFamily="'Inter', 'Helvetica Neue', sans-serif"
      fontWeight="800"
      fontSize="22"
      fill="white"
      letterSpacing="-1"
    >
      T
    </text>
    {/* Payment arc */}
    <path
      d="M8 28 Q18 34 28 28"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
      opacity="0.7"
    />
  </svg>
);

export default Logo;
