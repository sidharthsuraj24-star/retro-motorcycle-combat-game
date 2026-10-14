import type { ScoreEntry } from './types';

const KEY = 'roadfury.scores.v1';
const NAME_KEY = 'roadfury.name';
const MUTE_KEY = 'roadfury.muted';

export function loadScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScoreEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => typeof e?.score === 'number')
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  } catch {
    return [];
  }
}

export function saveScore(entry: ScoreEntry): ScoreEntry[] {
  const all = [...loadScores(), entry].sort((a, b) => b.score - a.score).slice(0, 8);
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
  return all;
}

export function isHighScore(score: number) {
  const all = loadScores();
  return score > 0 && (all.length < 8 || score > all[all.length - 1].score);
}

export function loadName() {
  try {
    return localStorage.getItem(NAME_KEY) || 'RSH';
  } catch {
    return 'RSH';
  }
}

export function saveName(n: string) {
  try {
    localStorage.setItem(NAME_KEY, n);
  } catch {
    /* ignore */
  }
}

export function loadMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveMuted(m: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, m ? '1' : '0');
  } catch {
    /* ignore */
  }
}
