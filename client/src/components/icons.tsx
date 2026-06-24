interface P {
  size?: number;
  className?: string;
}
const base = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className,
});

export const Target = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12" r="8" />
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
  </svg>
);

export const Wrench = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M14.5 5.5a3.5 3.5 0 0 1-4.6 4.6L5 15l4 4 4.9-4.9a3.5 3.5 0 0 0 4.6-4.6l-2 2-2-2 2-2z" />
  </svg>
);

export const Check = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const Shield = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M12 3 5 6v5c0 4 3 7 7 9 4-2 7-5 7-9V6z" />
  </svg>
);

export const Coins = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <ellipse cx="9" cy="7" rx="6" ry="3" />
    <path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7" />
    <path d="M15 11.5c2.8.4 6 1.6 6 3.5 0 1.7-2.7 3-6 3s-6-1.3-6-3" />
  </svg>
);

export const Receipt = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M5 3v18l2-1 2 1 2-1 2 1 2-1 2 1V3l-2 1-2-1-2 1-2-1-2 1z" />
    <line x1="8" y1="8" x2="16" y2="8" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

export const User = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </svg>
);

export const Plus = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const Trash = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </svg>
);

export const Move = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M12 2v20M2 12h20M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3" />
  </svg>
);

export const Rotate = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 3v5h-5" />
  </svg>
);

export const Scale = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M21 3h-7l7 7zM3 21h7l-7-7z" />
  </svg>
);

export const Copy = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <rect x="9" y="9" width="11" height="11" />
    <path d="M5 15V5a1 1 0 0 1 1-1h10" />
  </svg>
);

export const Undo = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M9 7 4 12l5 5" />
    <path d="M4 12h11a5 5 0 0 1 0 10h-1" />
  </svg>
);

export const Redo = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="m15 7 5 5-5 5" />
    <path d="M20 12H9a5 5 0 0 0 0 10h1" />
  </svg>
);

export const Play = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M6 4l14 8-14 8z" fill="currentColor" stroke="none" />
  </svg>
);

export const Save = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M5 3h11l3 3v15H5z" />
    <path d="M8 3v5h7V3M8 21v-7h8v7" />
  </svg>
);

export const Globe = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
  </svg>
);

export const X = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </svg>
);

export const Lock = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}>
    <rect x="5" y="11" width="14" height="9" rx="1" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
