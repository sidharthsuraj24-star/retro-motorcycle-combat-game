import { memo } from 'react';
import type { HudState } from '../game/types';

const segMask =
  'repeating-linear-gradient(90deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 7px, rgba(0,0,0,0.85) 7px, rgba(0,0,0,0.85) 9px)';

function Bar({
  value,
  color,
  glow,
  height = 14,
}: {
  value: number;
  color: string;
  glow: string;
  height?: number;
}) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-[3px] border border-black/70 bg-black/60"
      style={{ height }}
    >
      <div
        className="bar-fill h-full"
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          background: color,
          boxShadow: `0 0 10px ${glow}, inset 0 1px 0 rgba(255,255,255,0.35)`,
        }}
      />
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: segMask }} />
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[10px] font-semibold tracking-[0.18em] text-white/45">{label}</span>
      <span
        className="font-display text-[11px] tabular-nums"
        style={{ color: accent ?? '#e9e6f5', textShadow: '0 2px 0 rgba(0,0,0,0.8)' }}
      >
        {value}
      </span>
    </div>
  );
}

export const Hud = memo(function Hud({
  hud,
  onPause,
  paused,
  touch,
}: {
  hud: HudState;
  onPause: () => void;
  paused: boolean;
  touch: boolean;
}) {
  const hp = hud.health;
  const hpColor =
    hp > 60
      ? 'linear-gradient(180deg,#9dff8a,#36c45a)'
      : hp > 30
        ? 'linear-gradient(180deg,#ffdc6b,#f29b1d)'
        : 'linear-gradient(180deg,#ff8a7a,#e32718)';
  const hpGlow = hp > 60 ? 'rgba(80,230,120,.6)' : hp > 30 ? 'rgba(255,200,80,.6)' : 'rgba(255,70,50,.75)';

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none p-2 sm:p-3">
      {/* ---------------- top left: armor + heat */}
      <div className="absolute left-2 top-2 w-[42vw] max-w-[260px] sm:left-3 sm:top-3">
        <div className="hud-chip rounded-md px-2 py-1.5">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-display text-[8px] tracking-wider text-rash-orange">ARMOR</span>
            <span className="font-display text-[8px] tabular-nums text-white/70">{hp}%</span>
          </div>
          <Bar value={hp} color={hpColor} glow={hpGlow} />
          <div className="mt-1.5 flex items-center gap-1">
            <span className="text-[9px] font-semibold tracking-[0.2em] text-white/40">HEAT</span>
            <div className="flex gap-0.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={i < hud.wanted ? 'anim-pulse' : ''}
                  style={{
                    fontSize: 11,
                    lineHeight: '11px',
                    color: i < hud.wanted ? '#ff5a4d' : 'rgba(255,255,255,0.18)',
                    textShadow: i < hud.wanted ? '0 0 8px rgba(255,80,60,0.9)' : 'none',
                  }}
                >
                  ★
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- top right: score */}
      <div className="absolute right-2 top-2 w-[38vw] max-w-[220px] sm:right-3 sm:top-3">
        <div className="hud-chip rounded-md px-2 py-1.5">
          <div className="text-right">
            <div className="text-[9px] font-semibold tracking-[0.25em] text-white/45">SCORE</div>
            <div
              className="font-display text-[15px] leading-tight tabular-nums text-white sm:text-[18px]"
              style={{ textShadow: '0 0 10px rgba(255,160,70,.55), 0 3px 0 rgba(0,0,0,.8)' }}
            >
              {hud.score.toLocaleString('en-US')}
            </div>
          </div>
          <div className="mt-1 space-y-0.5">
            <Stat label="DIST" value={`${hud.distance.toLocaleString('en-US')} M`} accent="#6ff0ff" />
            <Stat label="K.O." value={`${hud.takedowns}`} accent="#ff8a3c" />
          </div>
        </div>
      </div>

      {/* ---------------- combo */}
      {hud.combo >= 2 && (
        <div className="absolute left-1/2 top-13 -translate-x-1/2 sm:top-14">
          <div
            key={hud.combo}
            className="anim-pop hud-chip rounded-md px-3 py-1 text-center"
            style={{ borderColor: 'rgba(255,170,70,0.65)' }}
          >
            <div
              className="font-display text-[13px] text-rash-orange"
              style={{ textShadow: '0 0 12px rgba(255,140,60,.9)' }}
            >
              x{hud.combo}
            </div>
            <div className="text-[8px] tracking-[0.22em] text-white/50">COMBO</div>
          </div>
        </div>
      )}

      {/* ---------------- off-road warning */}
      {hud.offroad && (
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2">
          <div
            className="anim-pulse font-display text-[11px] tracking-wider text-rash-ember sm:text-[14px]"
            style={{ textShadow: '0 0 14px rgba(255,60,40,.9), 0 2px 0 #000' }}
          >
            ◄ OFF ROAD ►
          </div>
        </div>
      )}

      {/* ---------------- bottom left: speed + nitro */}
      <div
        className="absolute left-2 w-[46vw] max-w-[250px] sm:left-3"
        style={{ bottom: touch ? 'calc(118px + env(safe-area-inset-bottom))' : 12 }}
      >
        <div className="hud-chip rounded-md px-2 py-1.5">
          <div className="flex items-end justify-between">
            <div className="flex items-baseline gap-1">
              <span
                className="font-display text-[20px] tabular-nums leading-none text-white sm:text-[26px]"
                style={{
                  textShadow: `0 0 ${8 + hud.speedPct * 16}px rgba(111,240,255,${0.3 + hud.speedPct * 0.6}), 0 3px 0 rgba(0,0,0,.85)`,
                }}
              >
                {hud.speedKph}
              </span>
              <span className="text-[10px] font-bold tracking-[0.2em] text-white/50">KM/H</span>
            </div>
          </div>
          <div className="mt-1">
            <Bar
              value={hud.speedPct * 100}
              color="linear-gradient(90deg,#6ff0ff,#4a7bff 60%,#a06bff)"
              glow="rgba(111,240,255,.55)"
              height={8}
            />
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="font-display text-[7px] tracking-wider text-rash-cyan">NITRO</span>
            <div className="flex-1">
              <Bar
                value={hud.boost}
                color="linear-gradient(90deg,#8dff6a,#2fd0a0)"
                glow="rgba(140,255,110,.5)"
                height={7}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- pause button */}
      <button
        onClick={onPause}
        className="pointer-events-auto absolute left-1/2 top-2 flex h-9 w-12 -translate-x-1/2 items-center justify-center rounded-md border-2 border-white/20 bg-black/55 text-white/80 active:scale-95 sm:top-3"
        aria-label={paused ? 'Resume' : 'Pause'}
      >
        <span className="font-display text-[10px]">{paused ? '▶' : 'II'}</span>
      </button>
    </div>
  );
});
