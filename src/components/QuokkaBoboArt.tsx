import React, { useId } from 'react';

const FUR = '#C99661';
const INK = '#171210';
const BOBO_WHITE = '#FFFFFF';
const BOBO_SHADE = '#EAE6DC';
const WOOD_STOOL = '#785634';
const CHEER_CREAM = '#F7CE6A';
const PIN_RED = '#C83D33';
const MAP_CREAM = '#FAF8F3';

function CrayonFilterDef({ id, scale = 1.9 }: { id: string; scale?: number }) {
  return (
    <defs>
      <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.62" numOctaves="4" seed="7" result="noise" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="noise"
          scale={Math.min(2.1, scale)}
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </defs>
  );
}

/** Gold-standard Quokka: touching crown ears, bumpy caramel silhouette, mouthless chunky nose */
function QuokkaBody({ filterId, withMap = false }: { filterId: string; withMap?: boolean }) {
  return (
    <g>
      <g filter={`url(#${filterId})`}>
        <path
          d="M -1 -34
             C -8 -47, -27 -43, -23 -26
             C -34 -17, -36 2, -30 14
             C -34 28, -24 42, -8 44
             C -4 45, 4 45, 8 44
             C 24 42, 34 28, 30 14
             C 36 2, 34 -17, 23 -26
             C 27 -43, 8 -47, 1 -34 Z"
          fill={FUR}
        />
        <circle cx="-5.6" cy="-15" r="2.3" fill={INK} />
        <circle cx="5.6" cy="-15" r="2.3" fill={INK} />
        <ellipse cx="0" cy="-5" rx="5.4" ry="6.3" fill={INK} />
        {/* splayed flat feet */}
        <path d="M -20 40 L -10 46 L -13 50 L -24 44 Z" fill={INK} />
        <path d="M 20 40 L 10 46 L 13 50 L 24 44 Z" fill={INK} />
      </g>
      {withMap && (
        <g filter={`url(#${filterId})`}>
          <path d="M -17 12 L -6 8 L 6 12 L 17 8 L 17 30 L 6 34 L -6 30 L -17 34 Z" fill={MAP_CREAM} />
          <path d="M -13 20 Q -4 15 4 22 T 14 19" fill="none" stroke="#F2CA62" strokeWidth="2" strokeLinecap="round" />
          <path d="M -11 27 Q -2 24 8 28" fill="none" stroke="#1E3158" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M 6 11 C 6 7, 12 7, 12 11 C 12 14, 9 17, 9 18 C 9 17, 6 14, 6 11 Z" fill={PIN_RED} />
          <circle cx="-16" cy="22" r="3.2" fill={INK} />
          <circle cx="16" cy="22" r="3.2" fill={INK} />
        </g>
      )}
    </g>
  );
}

function BoboBody({ filterId, withCup = false, onStool = true }: { filterId: string; withCup?: boolean; onStool?: boolean }) {
  return (
    <g>
      {onStool && (
        <g filter={`url(#${filterId})`}>
          <rect x="-22" y="30" width="44" height="6" rx="3" fill={WOOD_STOOL} />
          <rect x="-17" y="35" width="5" height="14" rx="2" fill={WOOD_STOOL} />
          <rect x="12" y="35" width="5" height="14" rx="2" fill={WOOD_STOOL} />
        </g>
      )}
      <g filter={`url(#${filterId})`}>
        <path
          d="M -12 -21 C -22 -28, -27 -18, -21 -8 C -26 2, -25 22, -14 29 C -9 32, -4 27, 0 27 C 4 27, 9 32, 14 29 C 25 22, 26 2, 21 -8 C 27 -18, 22 -28, 12 -21 C 5 -22, -5 -22, -12 -21 Z"
          fill={BOBO_SHADE}
          transform="translate(1.2, 1.5)"
        />
        <path
          d="M -12 -21 C -22 -28, -27 -18, -21 -8 C -26 2, -25 22, -14 29 C -9 32, -4 27, 0 27 C 4 27, 9 32, 14 29 C 25 22, 26 2, 21 -8 C 27 -18, 22 -28, 12 -21 C 5 -22, -5 -22, -12 -21 Z"
          fill={BOBO_WHITE}
        />
        <ellipse cx="-19" cy="7" rx="6.5" ry="4.8" transform="rotate(18 -19 7)" fill={BOBO_WHITE} />
        <ellipse cx="19" cy="4" rx="6.5" ry="4.8" transform="rotate(-28 19 4)" fill={BOBO_WHITE} />
        <circle cx="-4.5" cy="-9.5" r="1.9" fill={INK} />
        <circle cx="4.5" cy="-9.5" r="1.9" fill={INK} />
        <path
          d="M 0 -5.2 L 0 -1.5 M -5.2 -1.6 Q -2.6 2.1 0 -1.6 Q 2.6 2.1 5.2 -1.6"
          fill="none"
          stroke={INK}
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {withCup && (
          <g transform="translate(22, -4)">
            <path d="M -5 -6 L 5 -6 L 4 10 L -4 10 Z" fill="#EAE6DC" />
            <path d="M -4.2 0 L 4.2 0 L 3.6 9.5 L -3.6 9.5 Z" fill="#5C3F2D" />
            <rect x="-5.5" y="-8" width="11" height="2.6" rx="1.2" fill={MAP_CREAM} />
            <rect x="0.5" y="-16" width="1.8" height="9" rx="0.9" fill="#F2CA62" />
          </g>
        )}
      </g>
    </g>
  );
}

function MarshBody({ filterId }: { filterId: string }) {
  return (
    <g>
      <rect x="-8" y="-6.5" width="16" height="13" rx="4" fill={BOBO_WHITE} filter={`url(#${filterId})`} />
      <circle cx="-2.6" cy="-1" r="1.1" fill={INK} />
      <circle cx="2.6" cy="-1" r="1.1" fill={INK} />
      <path d="M-1.8 2 Q0 3.6 1.8 2" fill="none" stroke={INK} strokeWidth="1.1" strokeLinecap="round" />
    </g>
  );
}

export const HeroBanner: React.FC<{ className?: string; small?: boolean }> = ({ className = '', small = false }) => (
  <div
    className={`overflow-hidden rounded-[1.6rem] border border-[#DDD7C9] bg-[#DEDCD3] shadow-card select-none ${className}`}
    aria-hidden="true"
  >
    <img
      src={small ? './assets/hero-bobo-pocket-sm.webp?v=1' : './assets/hero-bobo-pocket.webp?v=1'}
      alt=""
      loading="eager"
      decoding="async"
      className="w-full h-full object-cover object-[center_62%]"
    />
  </div>
);

export const QuokkaMapBadge: React.FC<{ className?: string; bounce?: boolean }> = ({ className = 'w-16 h-16', bounce = false }) => {
  const id = `q-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="-44 -56 88 112" className={`${className} ${bounce ? 'quokka-bounce' : ''}`} aria-hidden="true">
      <CrayonFilterDef id={id} />
      <QuokkaBody filterId={id} withMap />
    </svg>
  );
};

export const BoboCupBadge: React.FC<{ className?: string }> = ({ className = 'w-16 h-16' }) => {
  const id = `b-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="-36 -34 72 86" className={className} aria-hidden="true">
      <CrayonFilterDef id={id} />
      <BoboBody filterId={id} withCup />
    </svg>
  );
};

export const MarshBadge: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => {
  const id = `m-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="-10 -9 20 18" className={className} aria-hidden="true">
      <CrayonFilterDef id={id} scale={1.2} />
      <MarshBody filterId={id} />
    </svg>
  );
};

/** Duo on the oat stage for empty states / random picker */
export const DuoStage: React.FC<{ className?: string; cheer?: boolean }> = ({ className = 'w-56 h-32', cheer = false }) => {
  const id = `d-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 220 120" className={className} aria-hidden="true">
      <CrayonFilterDef id={id} />
      <rect x="0" y="0" width="220" height="120" rx="22" fill="#DEDCD3" />
      <g transform="translate(70, 62) scale(0.92)">
        <QuokkaBody filterId={id} withMap />
      </g>
      <g transform="translate(150, 66) scale(0.95)">
        <BoboBody filterId={id} withCup />
      </g>
      <g transform="translate(196, 100)">
        <MarshBody filterId={id} />
      </g>
      {cheer && (
        <g stroke={CHEER_CREAM} strokeWidth="2.4" strokeLinecap="round">
          <line x1="22" y1="28" x2="14" y2="20" />
          <line x1="30" y1="18" x2="26" y2="8" />
          <line x1="190" y1="24" x2="198" y2="16" />
          <line x1="200" y1="36" x2="210" y2="34" />
        </g>
      )}
    </svg>
  );
};
