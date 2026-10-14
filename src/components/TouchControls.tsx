import { useRef, useState, type PointerEvent as RPointerEvent } from 'react';

function Pad({
  label,
  sub,
  onDown,
  onUp,
  size = 66,
  tone = 'default',
}: {
  label: string;
  sub?: string;
  onDown: () => void;
  onUp?: () => void;
  size?: number;
  tone?: 'default' | 'gas' | 'hit' | 'nos';
}) {
  const [active, setActive] = useState(false);
  const idRef = useRef<number | null>(null);

  const down = (e: RPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    idRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    setActive(true);
    onDown();
  };
  const up = (e: RPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (idRef.current !== null) {
      try {
        e.currentTarget.releasePointerCapture(idRef.current);
      } catch {
        /* noop */
      }
      idRef.current = null;
    }
    setActive(false);
    onUp?.();
  };

  const toneStyle =
    tone === 'gas'
      ? { borderColor: 'rgba(140,255,120,0.55)', color: '#d9ffd0' }
      : tone === 'hit'
        ? { borderColor: 'rgba(255,150,70,0.6)', color: '#ffe0c0' }
        : tone === 'nos'
          ? { borderColor: 'rgba(110,240,255,0.55)', color: '#cdf8ff' }
          : {};

  return (
    <div
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={up}
      className={`touch-pad flex select-none items-center justify-center rounded-full ${active ? 'active' : ''}`}
      style={{ width: size, height: size, ...toneStyle }}
    >
      <div className="text-center leading-none">
        <div className="font-display" style={{ fontSize: size > 70 ? 13 : 11 }}>
          {label}
        </div>
        {sub && <div className="mt-1 text-[8px] tracking-[0.18em] opacity-70">{sub}</div>}
      </div>
    </div>
  );
}

export function TouchControls({
  setInput,
  attack,
}: {
  setInput: (k: 'left' | 'right' | 'up' | 'down' | 'boost', v: boolean) => void;
  attack: () => void;
}) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-end justify-between px-3"
      style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}
    >
      <div className="pointer-events-auto flex items-end gap-3">
        <Pad label="◄" onDown={() => setInput('left', true)} onUp={() => setInput('left', false)} size={72} />
        <Pad label="►" onDown={() => setInput('right', true)} onUp={() => setInput('right', false)} size={72} />
      </div>
      <div className="pointer-events-auto flex items-end gap-3">
        <Pad label="NOS" onDown={() => setInput('boost', true)} onUp={() => setInput('boost', false)} size={56} tone="nos" />
        <Pad label="HIT" sub="MELEE" onDown={attack} size={72} tone="hit" />
        <Pad label="GAS" onDown={() => setInput('up', true)} onUp={() => setInput('up', false)} size={86} tone="gas" />
      </div>
    </div>
  );
}
