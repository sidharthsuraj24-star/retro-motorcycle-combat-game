import type { RunResult, ScoreEntry } from '../game/types';

function Overlay({ children, dim = 'rgba(6,4,12,0.72)' }: { children: React.ReactNode; dim?: string }) {
  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto p-3"
      style={{ background: dim, backdropFilter: 'blur(3px)' }}
    >
      {children}
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-w-[22px] items-center justify-center rounded border border-white/25 bg-white/10 px-1.5 py-0.5 font-display text-[8px] text-white/90">
      {children}
    </span>
  );
}

export function ScoreTable({ scores, highlight }: { scores: ScoreEntry[]; highlight?: number }) {
  return (
    <div className="w-full">
      <div className="mb-1 flex items-center gap-2">
        <span className="font-display text-[9px] tracking-wider text-rash-cyan">TOP RIDERS</span>
        <div className="h-px flex-1 bg-gradient-to-r from-rash-cyan/50 to-transparent" />
      </div>
      {scores.length === 0 ? (
        <div className="py-2 text-center text-[11px] tracking-widest text-white/35">NO RECORDS — BE THE FIRST</div>
      ) : (
        <ol className="space-y-0.5">
          {scores.slice(0, 5).map((s, i) => {
            const hot = highlight !== undefined && s.score === highlight;
            return (
              <li
                key={`${s.date}-${i}`}
                className={`flex items-center gap-2 rounded px-1.5 py-0.5 text-[12px] tabular-nums ${
                  hot ? 'bg-rash-orange/20 ring-1 ring-rash-orange/50' : i % 2 ? 'bg-white/[0.03]' : ''
                }`}
              >
                <span className="w-4 font-display text-[8px] text-white/40">{i + 1}</span>
                <span className="w-12 font-display text-[9px] text-rash-orange">{s.name}</span>
                <span className="flex-1 text-right font-semibold text-white">{s.score.toLocaleString('en-US')}</span>
                <span className="w-16 text-right text-[10px] text-white/45">{s.distance.toLocaleString('en-US')}m</span>
                <span className="w-9 text-right text-[10px] text-white/45">{s.takedowns} KO</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ menu */

export function StartScreen({
  onStart,
  scores,
  muted,
  onToggleMute,
  touch,
}: {
  onStart: () => void;
  scores: ScoreEntry[];
  muted: boolean;
  onToggleMute: () => void;
  touch: boolean;
}) {
  return (
    <Overlay dim="linear-gradient(180deg, rgba(6,4,12,0.55) 0%, rgba(6,4,12,0.88) 70%)">
      <div className="anim-pop panel w-full max-w-[560px] rounded-lg p-4 sm:p-5">
        <div className="text-center">
          <div className="font-display text-[9px] tracking-[0.35em] text-rash-cyan neon-cyan">ARCADE · 1997 · PSEUDO-3D</div>
          <h1 className="title-glow anim-flicker mt-2 font-display text-[26px] leading-[1.15] text-rash-orange sm:text-[38px]">
            ROAD FURY
          </h1>
          <div className="mt-1 font-display text-[11px] tracking-[0.2em] text-white/85 sm:text-[14px]">JAILBREAK RUN</div>
          <div className="mt-2 overflow-hidden border-y border-white/10 py-1">
            <div className="marquee-track text-[11px] tracking-[0.25em] text-white/45">
              {'OUTRUN THE PACK · SWING THE NIGHTSTICK · DON’T GET BUSTED · '.repeat(2)}
            </div>
          </div>
        </div>

        <button onClick={onStart} className="btn btn-primary anim-sheen mt-4 w-full overflow-hidden rounded py-3 text-[14px]">
          {touch ? 'TAP TO RIDE' : 'START ENGINE'}
        </button>

        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-white/70">
          <div className="flex items-center gap-1.5">
            <Key>←</Key>
            <Key>→</Key>
            <span className="text-white/45">STEER</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Key>↑</Key>
            <Key>W</Key>
            <span className="text-white/45">THROTTLE</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Key>SPC</Key>
            <span className="text-white/45">NIGHTSTICK</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Key>SHF</Key>
            <span className="text-white/45">NITRO</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Key>↓</Key>
            <Key>S</Key>
            <span className="text-white/45">BRAKE</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Key>P</Key>
            <Key>ESC</Key>
            <span className="text-white/45">PAUSE</span>
          </div>
        </div>

        <div className="mt-3 rounded border border-white/10 bg-black/30 p-2">
          <ScoreTable scores={scores} />
        </div>

        <div className="mt-3 flex items-center justify-between text-[10px] text-white/35">
          <span className="tracking-[0.2em]">RIDE · FIGHT · SURVIVE</span>
          <button onClick={onToggleMute} className="btn btn-ghost rounded px-2 py-1 text-[8px]">
            {muted ? '🔇 SOUND OFF' : '🔊 SOUND ON'}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

/* ----------------------------------------------------------------- pause */

export function PauseScreen({
  onResume,
  onRestart,
  onQuit,
  muted,
  onToggleMute,
}: {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  muted: boolean;
  onToggleMute: () => void;
}) {
  return (
    <Overlay>
      <div className="anim-pop panel w-full max-w-[340px] rounded-lg p-5 text-center">
        <h2 className="font-display text-[20px] text-rash-cyan neon-cyan">PAUSED</h2>
        <p className="mt-1 text-[11px] tracking-[0.2em] text-white/40">ENGINE IDLING</p>
        <div className="mt-4 space-y-2">
          <button onClick={onResume} className="btn btn-primary w-full rounded py-2.5 text-[12px]">
            RESUME
          </button>
          <button onClick={onRestart} className="btn btn-ghost w-full rounded py-2 text-[10px]">
            RESTART RUN
          </button>
          <button onClick={onQuit} className="btn btn-ghost w-full rounded py-2 text-[10px]">
            QUIT TO TITLE
          </button>
          <button onClick={onToggleMute} className="btn btn-ghost w-full rounded py-2 text-[8px]">
            {muted ? '🔇 SOUND OFF' : '🔊 SOUND ON'}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

/* ------------------------------------------------------------- game over */

export function GameOverScreen({
  result,
  scores,
  qualifies,
  name,
  onNameChange,
  onSave,
  saved,
  onRestart,
  onMenu,
}: {
  result: RunResult;
  scores: ScoreEntry[];
  qualifies: boolean;
  name: string;
  onNameChange: (n: string) => void;
  onSave: () => void;
  saved: boolean;
  onRestart: () => void;
  onMenu: () => void;
}) {
  const stats: [string, string][] = [
    ['DISTANCE', `${result.distance.toLocaleString('en-US')} M`],
    ['TAKEDOWNS', `${result.takedowns}`],
    ['BEST COMBO', `x${result.bestCombo}`],
    ['TIME', `${result.time.toFixed(1)}s`],
  ];
  return (
    <Overlay dim="radial-gradient(circle at 50% 35%, rgba(90,10,10,0.55), rgba(6,4,12,0.92) 70%)">
      <div className="anim-pop panel w-full max-w-[460px] rounded-lg p-4 sm:p-5">
        <div className="text-center">
          <h2
            className="font-display text-[26px] text-rash-ember sm:text-[32px]"
            style={{ textShadow: '0 0 14px rgba(255,60,40,.8), 0 4px 0 #4a0a05' }}
          >
            BUSTED
          </h2>
          <p className="mt-1 text-[11px] tracking-[0.22em] text-white/50">{result.cause || 'YOU WENT DOWN HARD'}</p>
        </div>

        <div className="mt-3 rounded border border-white/10 bg-black/40 p-3 text-center">
          <div className="text-[9px] tracking-[0.3em] text-white/40">FINAL SCORE</div>
          <div
            className="font-display text-[28px] tabular-nums text-white sm:text-[34px]"
            style={{ textShadow: '0 0 16px rgba(255,150,60,.6), 0 4px 0 rgba(0,0,0,.8)' }}
          >
            {result.score.toLocaleString('en-US')}
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {stats.map(([k, v]) => (
            <div key={k} className="rounded border border-white/10 bg-white/[0.04] px-2 py-1.5">
              <div className="text-[9px] tracking-[0.2em] text-white/40">{k}</div>
              <div className="font-display text-[11px] text-rash-orange">{v}</div>
            </div>
          ))}
        </div>

        {qualifies && !saved && (
          <div className="mt-3 flex items-center gap-2 rounded border border-rash-orange/40 bg-rash-orange/10 p-2">
            <span className="font-display text-[8px] text-rash-orange">NEW RECORD!</span>
            <input
              value={name}
              onChange={(e) => onNameChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3))}
              maxLength={3}
              className="w-16 rounded border border-white/20 bg-black/50 px-2 py-1 text-center font-display text-[12px] tracking-widest text-white outline-none focus:border-rash-orange"
            />
            <button onClick={onSave} className="btn btn-primary flex-1 rounded py-1.5 text-[9px]">
              SAVE
            </button>
          </div>
        )}

        <div className="mt-3 rounded border border-white/10 bg-black/30 p-2">
          <ScoreTable scores={scores} highlight={saved ? result.score : undefined} />
        </div>

        <div className="mt-3 flex gap-2">
          <button onClick={onRestart} className="btn btn-primary flex-1 rounded py-2.5 text-[12px]">
            RIDE AGAIN
          </button>
          <button onClick={onMenu} className="btn btn-ghost rounded px-4 py-2.5 text-[10px]">
            TITLE
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] tracking-[0.2em] text-white/30">PRESS ENTER TO RESTART</p>
      </div>
    </Overlay>
  );
}
