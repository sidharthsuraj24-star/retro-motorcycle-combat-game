export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface SegPoint {
  world: Vec3;
  camera: Vec3;
  screen: { x: number; y: number; w: number; scale: number };
}

export interface RoadSprite {
  kind: string;
  offset: number;
}

export interface Segment {
  index: number;
  p1: SegPoint;
  p2: SegPoint;
  curve: number;
  sprites: RoadSprite[];
  ents: Entity[];
  clip: number;
  fog: number;
  looped: boolean;
  dark: boolean; // alternating tarmac shade
  lane: boolean; // dashed lane marker on this segment
}

export type EntityKind = 'traffic' | 'enemy' | 'pickup';

export interface BaseEntity {
  kind: EntityKind;
  z: number;
  x: number;
  alive: boolean;
}

export interface Traffic extends BaseEntity {
  kind: 'traffic';
  speed: number;
  dir: 1 | -1; // 1 = same direction, -1 = oncoming
  body: 'car' | 'van' | 'truck';
  colorIdx: number;
  drift: number;
  passed: boolean;
}

export type EnemyState = 'ride' | 'wind' | 'punch' | 'stun' | 'crash';

export interface Enemy extends BaseEntity {
  kind: 'enemy';
  id: number;
  type: 'gang' | 'cop';
  colorIdx: number;
  speed: number;
  vx: number;
  health: number;
  maxHealth: number;
  state: EnemyState;
  timer: number;
  cooldown: number;
  side: number;
  hitFlash: number;
  lean: number;
  punchSide: 1 | -1;
  crashRot: number;
  crashTime: number;
  bob: number;
  aggression: number;
}

export interface Pickup extends BaseEntity {
  kind: 'pickup';
  type: 'repair' | 'nitro';
  phase: number;
}

export type Entity = Traffic | Enemy | Pickup;

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  kind: 'spark' | 'smoke' | 'debris' | 'dust';
}

export interface Popup {
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
  size: number;
}

export interface HudState {
  speedKph: number;
  speedPct: number;
  health: number;
  score: number;
  distance: number;
  takedowns: number;
  combo: number;
  boost: number;
  wanted: number;
  offroad: boolean;
}

export interface RunResult {
  score: number;
  distance: number;
  takedowns: number;
  bestCombo: number;
  time: number;
  cause: string;
}

export interface ScoreEntry {
  name: string;
  score: number;
  distance: number;
  takedowns: number;
  date: number;
}
