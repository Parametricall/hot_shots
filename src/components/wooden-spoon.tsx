export function WoodenSpoon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="-15 -10 150 290"
      width={size}
      height={size * 2}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="ws-bowl" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d9a878" />
          <stop offset="50%" stopColor="#b8854a" />
          <stop offset="100%" stopColor="#8b5e2f" />
        </linearGradient>
        <linearGradient id="ws-inner" x1="30%" y1="20%" x2="70%" y2="90%">
          <stop offset="0%" stopColor="#8b5a2b" />
          <stop offset="100%" stopColor="#5c3a1a" />
        </linearGradient>
        <linearGradient id="ws-handle" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#a37044" />
          <stop offset="45%" stopColor="#c8926a" />
          <stop offset="100%" stopColor="#7a4e2a" />
        </linearGradient>
      </defs>
      <g transform={"rotate(-18 60 120)"}>
        <path
          d="M 52 108 L 52 260 L 68 260 L 68 108 Z"
          fill="url(#ws-handle)"
          stroke="#5c3a1a"
          strokeWidth="1"
        />
        <ellipse
          cx="60"
          cy="50"
          rx="40"
          ry="60"
          fill="url(#ws-bowl)"
          stroke="#5c3a1a"
          strokeWidth="1.5"
        />
        <ellipse cx="60" cy="47" rx="34" ry="50" fill="url(#ws-inner)" />
        <ellipse cx="45" cy="30" rx="12" ry="20" fill="#e8c398" opacity="0.4" />
      </g>
    </svg>
  );
}
