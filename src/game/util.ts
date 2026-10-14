// Math + color helpers for the pseudo-3D racer.

export const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeIn = (a: number, b: number, p: number) => a + (b - a) * Math.pow(p, 2);
export const easeOut = (a: number, b: number, p: number) => a + (b - a) * (1 - Math.pow(1 - p, 2));
export const easeInOut = (a: number, b: number, p: number) =>
  a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);

export function increase(start: number, inc: number, max: number) {
  let result = start + inc;
  while (result >= max) result -= max;
  while (result < 0) result += max;
  return result;
}

/** shortest signed difference on a looping track */
export function wrapDelta(delta: number, length: number) {
  let d = delta % length;
  if (d > length / 2) d -= length;
  if (d < -length / 2) d += length;
  return d;
}

export function overlap(x1: number, w1: number, x2: number, w2: number, percent = 1) {
  const half = percent / 2;
  const min1 = x1 - w1 * half;
  const max1 = x1 + w1 * half;
  const min2 = x2 - w2 * half;
  const max2 = x2 + w2 * half;
  return !(max1 < min2 || min1 > max2);
}

export function exponentialFog(distance: number, density: number) {
  return 1 / Math.pow(Math.E, distance * distance * density);
}

/** Deterministic tiny PRNG */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;
export const randRange = (rng: Rng, min: number, max: number) => min + rng() * (max - min);
export const randInt = (rng: Rng, min: number, max: number) => Math.floor(randRange(rng, min, max + 1));
export const pick = <T,>(rng: Rng, arr: T[]): T => arr[Math.floor(rng() * arr.length) % arr.length];

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export const css = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`;
export const cssA = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export function shade(c: RGB, amount: number): RGB {
  if (amount >= 0) return mixRgb(c, [255, 255, 255], amount);
  return mixRgb(c, [0, 0, 0], -amount);
}

export function formatNumber(n: number) {
  return Math.max(0, Math.floor(n)).toLocaleString('en-US');
}
