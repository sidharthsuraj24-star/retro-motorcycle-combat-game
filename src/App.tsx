import { useCallback, useEffect, useRef, useState } from 'react';
import { Engine } from './game/engine';
import { audio } from './game/audio';
import { isHighScore, loadMuted, loadName, loadScores, saveMuted, saveName, saveScore } from './game/storage';
import type { HudState, RunResult, ScoreEntry } from './game/types';
import { Hud } from './components/Hud';
import { TouchControls } from './components/TouchControls';
import { GameOverScreen, PauseScreen, StartScreen } from './components/Screens';

type Phase = 'menu' | 'playing' | 'paused' | 'gameover';

const EMPTY_HUD: HudState = {
  speedKph: 0,
  speedPct: 0,
  health: 100,
  score: 0,
  distance: 0,
  takedowns: 0,
  combo: 0,
  boost: 100,
  wanted: 0,
  offroad: false,
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<Engine | null>(null);

  const [phase, setPhase] = useState<Phase>('menu');
  const [hud, setHud] = useState<HudState>(EMPTY_HUD);
  const [result, setResult] = useState<RunResult | null>(null);
  const [scores, setScores] = useState<ScoreEntry[]>(() => loadScores());
  const [qualifies, setQualifies] = useState(false);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState(() => loadName());
  const [muted, setMuted] = useState(() => loadMuted());
  const [touch, setTouch] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  );

  // mirror state for stable event handlers
  const ref = useRef({ phase, result, qualifies, saved, name });
  ref.current = { phase, result, qualifies, saved, name };
  const touchRef = useRef(touch);
  touchRef.current = touch;

  /* ------------------------------------------------------------- engine */

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const engine = new Engine(canvas, {
      onHud: (h) => setHud(h),
      onGameOver: (r) => {
        setResult(r);
        setQualifies(isHighScore(r.score));
        setSaved(false);
        setPhase('gameover');
      },
    });
    engineRef.current = engine;
    engine.start();
    audio.setMuted(loadMuted());

    const ro = new ResizeObserver(() => engine.resize());
    ro.observe(wrap);
    const onOrient = () => window.setTimeout(() => engine.resize(), 180);
    window.addEventListener('orientationchange', onOrient);
    return () => {
      ro.disconnect();
      window.removeEventListener('orientationchange', onOrient);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  /* ------------------------------------------------------------ actions */

  const persist = useCallback(() => {
    const s = ref.current;
    if (s.result && s.qualifies && !s.saved) {
      const next = saveScore({
        name: (s.name || 'RSH').toUpperCase().slice(0, 3) || 'RSH',
        score: s.result.score,
        distance: s.result.distance,
        takedowns: s.result.takedowns,
        date: Date.now(),
      });
      saveName(s.name || 'RSH');
      setScores(next);
      setSaved(true);
      return next;
    }
    return undefined;
  }, []);

  const startGame = useCallback(() => {
    persist();
    audio.resume();
    const e = engineRef.current;
    if (!e) return;
    e.touchHints = touchRef.current;
    e.startRun();
    e.setPaused(false);
    setHud(EMPTY_HUD);
    setResult(null);
    setPhase('playing');
  }, [persist]);

  const toMenu = useCallback(() => {
    persist();
    const e = engineRef.current;
    if (!e) return;
    e.setPaused(false);
    e.toAttract();
    setScores(loadScores());
    setPhase('menu');
  }, [persist]);

  const togglePause = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    setPhase((p) => {
      if (p === 'playing') {
        e.setPaused(true);
        audio.ui();
        return 'paused';
      }
      if (p === 'paused') {
        e.setPaused(false);
        audio.ui();
        return 'playing';
      }
      return p;
    });
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      audio.resume();
      audio.setMuted(next);
      saveMuted(next);
      return next;
    });
  }, []);

  const setInput = useCallback((k: 'left' | 'right' | 'up' | 'down' | 'boost', v: boolean) => {
    const e = engineRef.current;
    if (e) e.input[k] = v;
  }, []);

  const doAttack = useCallback(() => {
    engineRef.current?.attack();
  }, []);

  /* ---------------------------------------------------------- keyboard */

  useEffect(() => {
    const down = (ev: KeyboardEvent) => {
      const e = engineRef.current;
      if (!e) return;
      const p = ref.current.phase;
      const code = ev.code;
      if (
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(code)
      ) {
        ev.preventDefault();
      }
      if (ev.repeat) return;
      switch (code) {
        case 'ArrowLeft':
        case 'KeyA':
          e.input.left = true;
          break;
        case 'ArrowRight':
        case 'KeyD':
          e.input.right = true;
          break;
        case 'ArrowUp':
        case 'KeyW':
          e.input.up = true;
          break;
        case 'ArrowDown':
        case 'KeyS':
          e.input.down = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          e.input.boost = true;
          break;
        case 'Space':
          if (p === 'playing') e.attack();
          else if (p === 'menu') startGame();
          else if (p === 'gameover') startGame();
          break;
        case 'Enter':
        case 'NumpadEnter':
          if (p === 'menu' || p === 'gameover') startGame();
          else if (p === 'paused') togglePause();
          break;
        case 'KeyP':
        case 'Escape':
          if (p === 'playing' || p === 'paused') togglePause();
          break;
        case 'KeyR':
          if (p === 'playing' || p === 'gameover' || p === 'paused') startGame();
          break;
        case 'KeyM':
          toggleMute();
          break;
      }
    };
    const up = (ev: KeyboardEvent) => {
      const e = engineRef.current;
      if (!e) return;
      switch (ev.code) {
        case 'ArrowLeft':
        case 'KeyA':
          e.input.left = false;
          break;
        case 'ArrowRight':
        case 'KeyD':
          e.input.right = false;
          break;
        case 'ArrowUp':
        case 'KeyW':
          e.input.up = false;
          break;
        case 'ArrowDown':
        case 'KeyS':
          e.input.down = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          e.input.boost = false;
          break;
      }
    };
    const blur = () => {
      const e = engineRef.current;
      if (!e) return;
      e.input.left = e.input.right = e.input.up = e.input.down = e.input.boost = false;
      if (ref.current.phase === 'playing') togglePause();
    };
    const onTouch = () => setTouch(true);
    const onVisibility = () => {
      if (document.hidden) blur();
    };

    window.addEventListener('keydown', down, { passive: false });
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    window.addEventListener('touchstart', onTouch, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      window.removeEventListener('touchstart', onTouch);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [startGame, togglePause, toggleMute]);

  /* -------------------------------------------------------------- view */

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#06040c]">
      <div ref={wrapRef} className="scanlines crt relative h-full w-full overflow-hidden">
        <canvas ref={canvasRef} className="h-full w-full" />

        {(phase === 'playing' || phase === 'paused') && (
          <Hud hud={hud} onPause={togglePause} paused={phase === 'paused'} touch={touch} />
        )}

        {touch && phase === 'playing' && <TouchControls setInput={setInput} attack={doAttack} />}

        {phase === 'menu' && (
          <StartScreen onStart={startGame} scores={scores} muted={muted} onToggleMute={toggleMute} touch={touch} />
        )}

        {phase === 'paused' && (
          <PauseScreen
            onResume={togglePause}
            onRestart={startGame}
            onQuit={toMenu}
            muted={muted}
            onToggleMute={toggleMute}
          />
        )}

        {phase === 'gameover' && result && (
          <GameOverScreen
            result={result}
            scores={scores}
            qualifies={qualifies}
            name={name}
            onNameChange={setName}
            onSave={() => persist()}
            saved={saved}
            onRestart={startGame}
            onMenu={toMenu}
          />
        )}
      </div>
    </div>
  );
}
