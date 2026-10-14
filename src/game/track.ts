import type { Segment, SegPoint } from './types';
import { easeIn, easeInOut, hexToRgb, mixRgb, pick, randRange, type Rng, type RGB } from './util';

export const SEGMENT_LENGTH = 200;
export const RUMBLE_LENGTH = 3;
export const ROAD_WIDTH = 2200;
export const LANES = 3;
export const DRAW_DISTANCE = 210;
export const CAMERA_HEIGHT = 1050;
export const FIELD_OF_VIEW = 100;
export const FOG_DENSITY = 4.2;
export const MAX_SPEED = SEGMENT_LENGTH * 49; // units / second
export const TOTAL_SEGMENTS = 2600;

const ROAD = {
  LENGTH: { NONE: 0, SHORT: 25, MEDIUM: 50, LONG: 100 },
  CURVE: { NONE: 0, EASY: 2, MEDIUM: 4.5, HARD: 7 },
  HILL: { NONE: 0, LOW: 20, MEDIUM: 40, HIGH: 62 },
};

function point(z: number, y: number): SegPoint {
  return {
    world: { x: 0, y, z },
    camera: { x: 0, y: 0, z: 0 },
    screen: { x: 0, y: 0, w: 0, scale: 0 },
  };
}

export function project(
  p: SegPoint,
  cameraX: number,
  cameraY: number,
  cameraZ: number,
  cameraDepth: number,
  width: number,
  height: number,
  roadWidth: number,
) {
  p.camera.x = p.world.x - cameraX;
  p.camera.y = p.world.y - cameraY;
  p.camera.z = p.world.z - cameraZ;
  if (p.camera.z < 1) p.camera.z = 1;
  p.screen.scale = cameraDepth / p.camera.z;
  p.screen.x = Math.round(width / 2 + (p.screen.scale * p.camera.x * width) / 2);
  p.screen.y = Math.round(height / 2 - (p.screen.scale * p.camera.y * height) / 2);
  p.screen.w = Math.round((p.screen.scale * roadWidth * width) / 2);
}

/* ------------------------------------------------------------- themes */

export interface Theme {
  name: string;
  skyTop: RGB;
  skyBot: RGB;
  sun: RGB;
  far: RGB;
  near: RGB;
  grassLight: RGB;
  grassDark: RGB;
  roadLight: RGB;
  roadDark: RGB;
  rumbleLight: RGB;
  rumbleDark: RGB;
  lane: RGB;
  fog: RGB;
  stars: number;
}

const T = (
  name: string,
  skyTop: string,
  skyBot: string,
  sun: string,
  far: string,
  near: string,
  grassLight: string,
  grassDark: string,
  roadLight: string,
  roadDark: string,
  rumbleLight: string,
  rumbleDark: string,
  lane: string,
  fog: string,
  stars: number,
): Theme => ({
  name,
  skyTop: hexToRgb(skyTop),
  skyBot: hexToRgb(skyBot),
  sun: hexToRgb(sun),
  far: hexToRgb(far),
  near: hexToRgb(near),
  grassLight: hexToRgb(grassLight),
  grassDark: hexToRgb(grassDark),
  roadLight: hexToRgb(roadLight),
  roadDark: hexToRgb(roadDark),
  rumbleLight: hexToRgb(rumbleLight),
  rumbleDark: hexToRgb(rumbleDark),
  lane: hexToRgb(lane),
  fog: hexToRgb(fog),
  stars,
});

export const THEMES: Theme[] = [
  T('DUSK HIGHWAY', '#2b1a4d', '#ff7a4d', '#ffd36e', '#3b2456', '#241639', '#2e6b46', '#255a3b',
    '#4a4f5e', '#44495a', '#e8e9ee', '#d14b3c', '#f2f3f7', '#ff9a63', 0),
  T('NEON CITY', '#060a24', '#1d2b6b', '#8be9ff', '#121a44', '#0a0f2c', '#1b2a52', '#162244',
    '#3b3f52', '#35394b', '#7df9ff', '#2a3570', '#d8f6ff', '#1d2b6b', 1),
  T('BADLANDS DAWN', '#1e2f6b', '#ffb36b', '#fff0a8', '#7a4a3a', '#5b3328', '#9b7b44', '#8a6c3b',
    '#5a5249', '#534c44', '#f6e7cf', '#c2502f', '#ffeec2', '#ffc98a', 0),
  T('MIDNIGHT PINES', '#040610', '#121a38', '#cfe4ff', '#0d1430', '#070b1e', '#143024', '#102a1f',
    '#33384a', '#2d3243', '#9fb8d8', '#394a7a', '#cfe0ff', '#121a38', 1),
];

export function blendThemes(a: Theme, b: Theme, t: number): Theme {
  const m = (k: keyof Theme) => mixRgb(a[k] as RGB, b[k] as RGB, t);
  return {
    name: t < 0.5 ? a.name : b.name,
    skyTop: m('skyTop'),
    skyBot: m('skyBot'),
    sun: m('sun'),
    far: m('far'),
    near: m('near'),
    grassLight: m('grassLight'),
    grassDark: m('grassDark'),
    roadLight: m('roadLight'),
    roadDark: m('roadDark'),
    rumbleLight: m('rumbleLight'),
    rumbleDark: m('rumbleDark'),
    lane: m('lane'),
    fog: m('fog'),
    stars: a.stars + (b.stars - a.stars) * t,
  };
}

/* -------------------------------------------------------------- builder */

export function buildTrack(rng: Rng): Segment[] {
  const segments: Segment[] = [];

  const lastY = () => (segments.length === 0 ? 0 : segments[segments.length - 1].p2.world.y);

  function addSegment(curve: number, y: number) {
    const n = segments.length;
    segments.push({
      index: n,
      p1: point(n * SEGMENT_LENGTH, lastY()),
      p2: point((n + 1) * SEGMENT_LENGTH, y),
      curve,
      sprites: [],
      ents: [],
      clip: 0,
      fog: 1,
      looped: false,
      dark: Math.floor(n / RUMBLE_LENGTH) % 2 === 0,
      lane: Math.floor(n / RUMBLE_LENGTH) % 2 === 0,
    });
  }

  function addRoad(enter: number, hold: number, leave: number, curve: number, y: number) {
    const startY = lastY();
    const endY = startY + y * SEGMENT_LENGTH;
    const total = enter + hold + leave;
    for (let n = 0; n < enter; n++) addSegment(easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total));
    for (let n = 0; n < hold; n++) addSegment(curve, easeInOut(startY, endY, (enter + n) / total));
    for (let n = 0; n < leave; n++)
      addSegment(easeInOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n) / total));
  }

  const L = ROAD.LENGTH;
  const C = ROAD.CURVE;
  const H = ROAD.HILL;

  // opening straight so the player can get a feel for the controls
  addRoad(40, 60, 40, 0, 0);

  while (segments.length < TOTAL_SEGMENTS - 160) {
    const roll = rng();
    const len = pick(rng, [L.SHORT, L.MEDIUM, L.MEDIUM, L.LONG]);
    const curve = pick(rng, [C.EASY, C.EASY, C.MEDIUM, C.MEDIUM, C.HARD]) * (rng() < 0.5 ? -1 : 1);
    const hill = pick(rng, [H.NONE, H.LOW, H.LOW, H.MEDIUM, H.HIGH]) * (rng() < 0.5 ? -1 : 1);
    if (roll < 0.22) {
      addRoad(len, len, len, 0, hill); // straight w/ hill
    } else if (roll < 0.5) {
      addRoad(len, len, len, curve, 0);
    } else if (roll < 0.78) {
      addRoad(len, len, len, curve, hill);
    } else {
      // s-curves
      addRoad(L.MEDIUM, L.MEDIUM, L.MEDIUM, -curve * 0.7, hill * 0.4);
      addRoad(L.MEDIUM, L.MEDIUM, L.MEDIUM, curve * 0.9, -hill * 0.4);
    }
  }

  // bring the loop back to y = 0 so the seam is invisible
  const startY = lastY();
  const tail = TOTAL_SEGMENTS - segments.length;
  for (let n = 0; n < tail; n++) addSegment(0, easeInOut(startY, 0, n / tail));

  addScenery(segments, rng);
  return segments;
}

const FOREST = ['pine', 'tree', 'pine', 'tree', 'rock'];
const DESERT = ['palm', 'rock', 'crate', 'barrel'];

export function addScenery(segments: Segment[], rng: Rng) {
  for (const s of segments) s.sprites.length = 0;

  for (let n = 60; n < segments.length - 20; n++) {
    const seg = segments[n];
    const biome = Math.floor((n / segments.length) * 4) % 2 === 0 ? FOREST : DESERT;

    // dense roadside vegetation
    if (rng() < 0.42) {
      const side = rng() < 0.5 ? -1 : 1;
      seg.sprites.push({ kind: pick(rng, biome), offset: side * randRange(rng, 1.35, 5.5) });
    }
    // hazards right on the shoulder (punishing but telegraphed)
    if (rng() < 0.032) {
      const side = rng() < 0.5 ? -1 : 1;
      seg.sprites.push({ kind: pick(rng, ['barrel', 'crate', 'sign', 'rock']), offset: side * randRange(rng, 1.06, 1.3) });
    }
    if (n % 46 === 0) {
      seg.sprites.push({ kind: 'lamp', offset: -1.18 });
      segments[Math.min(segments.length - 1, n + 23)].sprites.push({ kind: 'lamp', offset: 1.18 });
    }
    if (n % 137 === 0) seg.sprites.push({ kind: 'billboard', offset: rng() < 0.5 ? -1.9 : 1.9 });
    if (n % 83 === 0) seg.sprites.push({ kind: 'speedSign', offset: 1.22 });
  }
}

export function findSegment(segments: Segment[], z: number): Segment {
  const i = Math.floor(z / SEGMENT_LENGTH) % segments.length;
  return segments[((i % segments.length) + segments.length) % segments.length];
}
