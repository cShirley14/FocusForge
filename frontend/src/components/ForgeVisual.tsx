import { useMemo } from "react";

import type { Rarity } from "../lib/progression.js";

interface ForgeVisualProps {
  progress: number; // 1 = full time left, 0 = timer done
  state: "idle" | "focus" | "break";
  taskTitle: string | null;
  mode: "forge" | "daybreak";
  /** Tier of the currently planned session — sizes the workpiece. */
  rarity: Rarity;
}

/**
 * London-pattern anvil, drawn to correct proportions:
 *   wide face → narrow waist → flared foot (an hourglass profile, not a taper).
 *
 * Steel colour is mode-dependent because a cold anvil in daylight reads
 * blue-grey, while the same iron under live coals reads warm brown-grey.
 */
export function ForgeVisual({
  progress,
  state,
  taskTitle,
  mode,
  rarity,
}: ForgeVisualProps) {
  const heat = state === "focus" ? 1 - progress : 0;
  const isActive = state === "focus";
  const isNight = mode === "forge";

  // A longer commitment puts a visibly bigger billet on the anvil.
  const stock = {
    common: { w: 46, y: 221 },
    uncommon: { w: 68, y: 219 },
    rare: { w: 88, y: 217 },
    masterwork: { w: 108, y: 215 },
  }[rarity];

  /*
   * Steel palette shifts with the light source.
   *
   * Daylight values are deliberately *darker* than the night set. A solid iron
   * object lit from above reads darker than a light background — the earlier
   * light-mode palette topped out near the page colour, which flattened the
   * whole silhouette into the paper.
   */
  const steel = useMemo(
    () =>
      isNight
        ? { hi: "#a49a90", mid: "#847a72", lo: "#635b54", deep: "#443d38", line: "#332d29" }
        : { hi: "#7d8794", mid: "#616b78", lo: "#4a5460", deep: "#343c46", line: "#1e252e" },
    [isNight]
  );

  // Workpiece colour: cold iron at rest, then through the forging heats.
  const metalColor = useMemo(() => {
    if (!isActive) return isNight ? "#5a5048" : "#8d949c";
    if (heat < 0.3) return "#a44a1a";
    if (heat < 0.6) return "#e85d04";
    if (heat < 0.85) return "#ffba08";
    return "#fff3b0";
  }, [isActive, heat, isNight]);

  const glowStdDev = isActive ? 3 + heat * 10 : 0;

  // Banked coals at night; by day the forge is out until work starts.
  const fireOpacity = isActive ? 0.55 + heat * 0.45 : isNight ? 0.16 : 0;

  const emberCount = isActive ? 12 + Math.floor(heat * 18) : 0;

  return (
    <div className="forge-visual">
      {isActive && (
        <div className="embers" aria-hidden="true">
          {Array.from({ length: emberCount }).map((_, i) => (
            <span
              key={i}
              className="ember"
              style={{
                left: `${34 + Math.random() * 32}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* viewBox cropped to artwork bounds so the anvil fills the frame. */}
      <svg
        viewBox="80 148 222 212"
        className="forge-svg"
        role="img"
        aria-label={
          taskTitle
            ? `Anvil with ${taskTitle} being forged`
            : "Anvil, no task selected"
        }
      >
        <defs>
          <linearGradient id="ff-face" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={steel.hi} />
            <stop offset="45%" stopColor={steel.mid} />
            <stop offset="100%" stopColor={steel.lo} />
          </linearGradient>

          <linearGradient id="ff-body" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={steel.deep} />
            <stop offset="30%" stopColor={steel.mid} />
            <stop offset="62%" stopColor={steel.lo} />
            <stop offset="100%" stopColor={steel.deep} />
          </linearGradient>

          <linearGradient id="ff-horn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={steel.mid} />
            <stop offset="60%" stopColor={steel.lo} />
            <stop offset="100%" stopColor={steel.deep} />
          </linearGradient>

          <linearGradient id="ff-hammer-head" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={steel.hi} />
            <stop offset="50%" stopColor={steel.mid} />
            <stop offset="100%" stopColor={steel.deep} />
          </linearGradient>

          <linearGradient id="ff-haft" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6b4e1e" />
            <stop offset="35%" stopColor="#9c7526" />
            <stop offset="70%" stopColor="#7d5c1c" />
            <stop offset="100%" stopColor="#5c4216" />
          </linearGradient>

          <radialGradient id="ff-fire" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff7a3c" stopOpacity="0.95" />
            <stop offset="40%" stopColor="#ff5a1f" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ff4500" stopOpacity="0" />
          </radialGradient>

          {/* Heat shimmer on the fire only — never on the anvil itself. */}
          <filter id="ff-shimmer" x="-40%" y="-40%" width="180%" height="180%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.022"
              numOctaves="3"
              seed="3"
              result="noise"
            >
              {isActive && (
                <animate
                  attributeName="seed"
                  values="1;4;2;7;3;8;5;1"
                  dur="3.2s"
                  repeatCount="indefinite"
                />
              )}
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale={isActive ? 4 + heat * 10 : 0}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>

          <filter id="ff-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation={glowStdDev} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="ff-drop" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow
              dx="0"
              dy="5"
              stdDeviation="6"
              floodColor={isNight ? "#000" : "#2a3038"}
              floodOpacity={isNight ? 0.55 : 0.42}
            />
          </filter>

          {/* Contact shadow — grounds the base, strongest in daylight */}
          <radialGradient id="ff-contact" cx="50%" cy="50%" r="50%">
            <stop
              offset="0%"
              stopColor={isNight ? "#000" : "#3a4048"}
              stopOpacity={isNight ? 0.5 : 0.34}
            />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ── Forge fire under the anvil ── */}
        <g filter="url(#ff-shimmer)">
          <ellipse
            cx="200"
            cy="336"
            rx={62 + heat * 26}
            ry={20 + heat * 12}
            fill="url(#ff-fire)"
            opacity={fireOpacity}
            style={{ transition: "opacity 0.9s ease" }}
          />
        </g>

        {/* Contact shadow under the foot — sits below the anvil in paint order */}
        <ellipse cx="200" cy="345" rx="66" ry="9" fill="url(#ff-contact)" />

        {/* ── Anvil ── */}
        <g filter="url(#ff-drop)">
          {/*
            Body: shoulders sweep in from under the face to a narrow waist,
            then flare back out to a wide foot. This is the anvil silhouette.
          */}
          <path
            d="M162 248
               C162 259 186 263 186 273
               L186 299
               C186 309 152 313 148 322
               L148 334 Q148 342 156 342
               L244 342 Q252 342 252 334
               L252 322
               C248 313 214 309 214 299
               L214 273
               C214 263 238 259 238 248
               Z"
            fill="url(#ff-body)"
            stroke={steel.line}
            strokeWidth="1"
          />

          {/* Foot bevel — catches light along the top edge of the base */}
          <path
            d="M149 323 L251 323 L251 328 L149 328 Z"
            fill={steel.hi}
            opacity="0.16"
          />

          {/* Horn: true cone tapering to a rounded point, left of the face */}
          <path
            d="M152 231
               C133 232 112 235 97 238
               Q90 239.5 90 241
               Q90 242.5 97 244
               C112 246 133 248 152 249
               Z"
            fill="url(#ff-horn)"
            stroke={steel.line}
            strokeWidth="0.9"
          />

          {/* Heel: short step off the right end */}
          <path
            d="M274 233 L288 235 Q293 236.5 293 240 Q293 243.5 288 245 L274 247 Z"
            fill="url(#ff-horn)"
            stroke={steel.line}
            strokeWidth="0.9"
          />

          {/* Face: the flat working surface */}
          <path
            d="M150 229
               L272 229
               Q277 229 277 234
               L277 243
               Q277 248 272 248
               L150 248
               Z"
            fill="url(#ff-face)"
            stroke={steel.line}
            strokeWidth="1"
          />

          {/* Polished highlight along the face */}
          <path
            d="M154 231 L270 231 L270 234 L154 234 Z"
            fill="#fff"
            opacity={isNight ? 0.14 : 0.34}
          />

          {/* Hardy hole (square) and pritchel hole (round) */}
          <rect x="252" y="233" width="8" height="8" rx="1" fill={steel.line} opacity="0.85" />
          <circle cx="243" cy="237" r="2.6" fill={steel.line} opacity="0.85" />
        </g>

        {/* ── Workpiece on the face — width tracks the session tier ── */}
        <g filter={isActive ? "url(#ff-glow)" : undefined}>
          <rect
            x={212 - stock.w / 2}
            y={stock.y}
            width={stock.w}
            height={229 - stock.y}
            rx="5"
            fill={metalColor}
            style={{
              transition:
                "fill 1.2s ease, x 0.45s ease, width 0.45s ease, y 0.45s ease, height 0.45s ease",
            }}
          />
          {/* Top highlight */}
          <rect
            x={215 - stock.w / 2}
            y={stock.y + 2}
            width={Math.max(0, stock.w - 6)}
            height="2"
            rx="1"
            fill="#fff"
            opacity={isActive ? 0.3 : 0.16}
            style={{ transition: "x 0.45s ease, width 0.45s ease, y 0.45s ease" }}
          />
        </g>

        {/* ── Hammer ── */}
        <g>
          {isActive && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="0 236 214; -26 236 214; 0 236 214"
              keyTimes="0;0.45;1"
              dur="0.72s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.3 0 0.2 1; 0.4 0 0.3 1"
            />
          )}

          {/* Haft */}
          <rect x="231" y="176" width="9" height="40" rx="4" fill="url(#ff-haft)" />
          <line x1="234" y1="180" x2="234" y2="212" stroke="#000" strokeWidth="0.5" opacity="0.18" />

          {/* Head */}
          <path
            d="M214 160 L258 160 Q264 160 264 166 L264 174 Q264 180 258 180 L214 180 Q208 180 208 174 L208 166 Q208 160 214 160 Z"
            fill="url(#ff-hammer-head)"
            stroke={steel.line}
            strokeWidth="1"
          />
          {/* Striking face */}
          <rect x="209" y="163" width="4" height="14" rx="2" fill="#fff" opacity="0.22" />
          {/* Eye */}
          <ellipse cx="236" cy="170" rx="4" ry="6" fill={steel.line} opacity="0.5" />
        </g>

        {/* ── Sparks off the workpiece ── */}
        {isActive && (
          <g opacity={0.45 + heat * 0.55}>
            <circle cx="196" cy="214" r="1.6" fill="#ffd166">
              <animate attributeName="cy" values="214;190;176" dur="0.85s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0.5;0" dur="0.85s" repeatCount="indefinite" />
            </circle>
            <circle cx="222" cy="213" r="1.1" fill="#fff3b0">
              <animate attributeName="cy" values="213;188;172" dur="0.65s" repeatCount="indefinite" />
              <animate attributeName="cx" values="222;229;235" dur="0.65s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0.6;0" dur="0.65s" repeatCount="indefinite" />
            </circle>
            <circle cx="208" cy="215" r="1.3" fill="#ff8c42">
              <animate attributeName="cy" values="215;192;178" dur="1.05s" repeatCount="indefinite" />
              <animate attributeName="cx" values="208;200;193" dur="1.05s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0.4;0" dur="1.05s" repeatCount="indefinite" />
            </circle>
          </g>
        )}
      </svg>
    </div>
  );
}
