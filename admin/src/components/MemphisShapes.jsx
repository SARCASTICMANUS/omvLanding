export function Squiggle({ className = "", color = "var(--memphis-pink)" }) {
  return (
    <svg
      className={className}
      width="120"
      height="20"
      viewBox="0 0 120 20"
      fill="none"
      aria-hidden="true"
      pointerEvents="none"
    >
      <path
        d="M5 10 Q15 2 25 10 T45 10 T65 10 T85 10 T105 10 T115 10"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function Zigzag({ className = "", color = "var(--memphis-ink)" }) {
  return (
    <svg
      className={className}
      width="200"
      height="12"
      viewBox="0 0 200 12"
      fill="none"
      aria-hidden="true"
      pointerEvents="none"
    >
      <polyline
        points="0,10 10,2 20,10 30,2 40,10 50,2 60,10 70,2 80,10 90,2 100,10 110,2 120,10 130,2 140,10 150,2 160,10 170,2 180,10 190,2 200,10"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function Triangle({ className = "", color = "var(--memphis-yellow)", size = 24 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      pointerEvents="none"
    >
      <polygon
        points="12,2 22,22 2,22"
        fill={color}
        stroke="var(--memphis-ink)"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/**
 * Status triangle indicator for tables.
 * - direction="right" (▶) = active / running
 * - direction="down"  (▼) = paused / stopped
 * - direction="left"  (◀) = error / blocked
 */
export function TriangleIndicator({ direction = "right", color = "var(--memphis-mint)", size = 12, className = "" }) {
  const rotation = { right: 0, down: 90, left: 180, up: 270 };
  const rot = rotation[direction] ?? 0;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      pointerEvents="none"
      style={{ transform: `rotate(${rot}deg)` }}
    >
      <polygon
        points="2,1 10,6 2,11"
        fill={color}
        stroke="var(--memphis-ink)"
        strokeWidth="1"
      />
    </svg>
  );
}

export function CircleOutline({ className = "", color = "var(--memphis-teal)", size = 20 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      pointerEvents="none"
    >
      <circle
        cx="10"
        cy="10"
        r="8"
        fill="none"
        stroke={color}
        strokeWidth="2"
      />
    </svg>
  );
}

export function PlusSign({ className = "", color = "var(--memphis-coral)", size = 18 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      pointerEvents="none"
    >
      <line x1="9" y1="2" x2="9" y2="16" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="2" y1="9" x2="16" y2="9" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Cross({ className = "", color = "var(--memphis-lime)", size = 16 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      pointerEvents="none"
    >
      <line x1="4" y1="4" x2="12" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="4" x2="4" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function DotCluster({ className = "" }) {
  return (
    <svg
      className={className}
      width="60"
      height="60"
      viewBox="0 0 60 60"
      fill="none"
      aria-hidden="true"
      pointerEvents="none"
    >
      <circle cx="10" cy="10" r="3" fill="var(--memphis-pink)" opacity="0.6" />
      <circle cx="30" cy="8" r="2" fill="var(--memphis-teal)" opacity="0.5" />
      <circle cx="50" cy="12" r="2.5" fill="var(--memphis-yellow)" opacity="0.5" />
      <circle cx="15" cy="30" r="2" fill="var(--memphis-coral)" opacity="0.4" />
      <circle cx="40" cy="28" r="3" fill="var(--memphis-mint)" opacity="0.5" />
      <circle cx="8" cy="50" r="2.5" fill="var(--memphis-purple)" opacity="0.4" />
      <circle cx="35" cy="48" r="2" fill="var(--memphis-pink)" opacity="0.3" />
      <circle cx="55" cy="45" r="3" fill="var(--memphis-lime)" opacity="0.4" />
    </svg>
  );
}

export default function MemphisShapes({ variant = "scattered" }) {
  if (variant === "scattered") {
    return (
      <>
        <Triangle className="absolute top-8 right-12 rotate-12 opacity-40" size={28} color="var(--memphis-yellow)" />
        <CircleOutline className="absolute bottom-16 left-8 opacity-30" size={22} color="var(--memphis-teal)" />
        <PlusSign className="absolute top-1/3 right-1/4 -rotate-12 opacity-25" size={20} color="var(--memphis-coral)" />
        <Cross className="absolute bottom-1/3 left-1/3 rotate-45 opacity-20" size={18} color="var(--memphis-mint)" />
      </>
    );
  }

  if (variant === "sidebar") {
    return (
      <>
        <Triangle className="absolute top-20 right-3 rotate-[25deg] opacity-15" size={20} color="var(--memphis-pink)" />
        <CircleOutline className="absolute top-40 left-4 opacity-10" size={16} color="var(--memphis-teal)" />
        <PlusSign className="absolute bottom-24 right-6 -rotate-[15deg] opacity-10" size={14} color="var(--memphis-yellow)" />
      </>
    );
  }

  if (variant === "empty") {
    return (
      <>
        <Triangle className="absolute top-6 left-8 rotate-[-10deg] opacity-20" size={32} color="var(--memphis-yellow)" />
        <CircleOutline className="absolute bottom-8 right-10 opacity-20" size={28} color="var(--memphis-teal)" />
        <DotCluster className="absolute top-4 right-4 opacity-25" />
      </>
    );
  }

  return null;
}
