import type {
  Entity,
  Enemy,
  EnemyState,
  HudState,
  Particle,
  Pickup,
  Popup,
  RunResult,
  Segment,
  Traffic,
  Vec3,
} from './types';
import { audio } from './audio';
import {
  CAMERA_HEIGHT,
  DRAW_DISTANCE,
  FIELD_OF_VIEW,
  FOG_DENSITY,
  LANES,
  MAX_SPEED,
  ROAD_WIDTH,
  RUMBLE_LENGTH,
  SEGMENT_LENGTH,
  THEMES,
  addScenery,
  blendThemes,
  buildTrack,
  findSegment,
  project,
  type Theme,
} from './track';
import { makeRng, randRange, type Rng } from './util';

/* ------------------------------------------------------------- constants */

const PLAYER_WIDTH = 0.45;
const PLAYER_LENGTH = 0.8;
const PLAYER_Z_OFFSET = -12; // camera follows slightly behind the bike
const PLAYER_SPEED = SEGMENT_LENGTH * 2.5;
const MAX_PLAYER_SPEED = MAX_SPEED;
const MIN_PLAYER_SPEED = SEGMENT_LENGTH * 0.5;
const ACCEL = SEGMENT_LENGTH * 0.0008;
const BRAKE = SEGMENT_LENGTH * 0.0018;
const DECEL = SEGMENT_LENGTH * 0.0004;
const OFFROAD_DECEL = SEGMENT_LENGTH * 0.0012;
const OFFROAD_LIMIT = SEGMENT_LENGTH * 0.85;
const CENTRIFUGAL = 0.3;
const ROAD_EDGE_MARGIN = 0.1;
const MAX_WANTED = 5;
const WANTED_DECAY = 0.0008;
const WANTED_KILL = 0.35;
const WANTED_HIT = 0.08;

const LANE_WIDTH = ROAD_WIDTH / LANES;
const LANE_MARKINGS_W = ROAD_WIDTH * 0.04;
const LANE_MARKINGS_L = SEGMENT_LENGTH * 2;

const BIKE_W = 0.38;
const BIKE_H = 0.52;
const BIKE_D = 0.7;

/* ------------------------------------------------------------- sprite defs */

interface SpriteDef {
  w: number;
  h: number;
  xOffset: number;
  yOffset: number;
  draw: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, colorIdx: number) => void;
}

const COLORS = {
  bike: ['#ff8a3c', '#ff6b1a', '#e4431d', '#ff4d2d'],
  gang: ['#c42870', '#a01a58', '#e85a9f', '#8c1d40'],
  cop: ['#1d2b6b', '#060a24', '#0a0f2c', '#121a38'],
  traffic: ['#2a3570', '#1a224c', '#35394b', '#4a4f5e', '#1d2b6b', '#2d3243'],
  pickup: ['#8dff6a', '#6ff0ff'],
};

const BIKE_COLORS = COLORS.bike;

const spriteDefs: Record<string, SpriteDef> = {
  // Bike
  bike: { w: 1, h: 1, xOffset: 0, yOffset: 0, draw: drawBike },
  // Traffic
  car: { w: 1.2, h: 0.8, xOffset: 0, yOffset: 0, draw: drawCar },
  van: { w: 1.5, h: 1.1, xOffset: 0, yOffset: 0, draw: drawVan },
  truck: { w: 2.0, h: 1.4, xOffset: 0, yOffset: 0, draw: drawTruck },
  // Enemies
  gang: { w: 0.9, h: 1.2, xOffset: 0, yOffset: 0, draw: drawGang },
  cop: { w: 0.9, h: 1.2, xOffset: 0, yOffset: 0, draw: drawCop },
  // Scenery
  palm: { w: 0.8, h: 1.8, xOffset: 0, yOffset: 0, draw: drawPalm },
  pine: { w: 1.0, h: 2.2, xOffset: 0, yOffset: 0, draw: drawPine },
  tree: { w: 1.2, h: 2.0, xOffset: 0, yOffset: 0, draw: drawTree },
  rock: { w: 0.6, h: 0.6, xOffset: 0, yOffset: 0, draw: drawRock },
  crate: { w: 0.5, h: 0.5, xOffset: 0, yOffset: 0, draw: drawCrate },
  barrel: { w: 0.5, h: 0.6, xOffset: 0, yOffset: 0, draw: drawBarrel },
  sign: { w: 0.4, h: 0.6, xOffset: 0, yOffset: 0, draw: drawSign },
  lamp: { w: 0.25, h: 2.0, xOffset: 0, yOffset: 0, draw: drawLamp },
  billboard: { w: 2.0, h: 1.2, xOffset: 0, yOffset: 0, draw: drawBillboard },
  speedSign: { w: 0.6, h: 0.6, xOffset: 0, yOffset: 0, draw: drawSpeedSign },
  // Pickups
  repair: { w: 0.6, h: 0.6, xOffset: 0, yOffset: 0, draw: drawRepair },
  nitro: { w: 0.6, h: 0.6, xOffset: 0, yOffset: 0, draw: drawNitro },
};

function drawBike(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, colorIdx: number) {
  const c = BIKE_COLORS[colorIdx % BIKE_COLORS.length];
  ctx.fillStyle = c;
  ctx.strokeStyle = shadeHex(c, -0.3);
  ctx.lineWidth = w * 0.03;
  // Body
  ctx.fillRect(x - w * 0.4, y - h * 0.3, w * 0.8, h * 0.4);
  ctx.strokeRect(x - w * 0.4, y - h * 0.3, w * 0.8, h * 0.4);
  // Front
  ctx.fillRect(x + w * 0.3, y - h * 0.4, w * 0.2, h * 0.3);
  // Seat area
  ctx.fillStyle = shadeHex(c, -0.2);
  ctx.fillRect(x - w * 0.15, y - h * 0.2, w * 0.3, h * 0.15);
}

function drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, colorIdx: number) {
  const c = COLORS.traffic[colorIdx % COLORS.traffic.length];
  ctx.fillStyle = c;
  ctx.strokeStyle = shadeHex(c, -0.3);
  ctx.lineWidth = w * 0.02;
  // Body
  ctx.fillRect(x - w * 0.5, y - h * 0.4, w, h * 0.5);
  ctx.strokeRect(x - w * 0.5, y - h * 0.4, w, h * 0.5);
  // Roof
  ctx.fillStyle = shadeHex(c, 0.1);
  ctx.fillRect(x - w * 0.35, y - h * 0.5, w * 0.7, h * 0.2);
  // Windows
  ctx.fillStyle = 'rgba(100,150,200,0.3)';
  ctx.fillRect(x - w * 0.3, y - h * 0.45, w * 0.2, h * 0.3);
  ctx.fillRect(x + w * 0.1, y - h * 0.45, w * 0.2, h * 0.3);
}

function drawVan(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, colorIdx: number) {
  const c = COLORS.traffic[colorIdx % COLORS.traffic.length];
  ctx.fillStyle = c;
  ctx.strokeStyle = shadeHex(c, -0.3);
  ctx.lineWidth = w * 0.02;
  // Body - taller
  ctx.fillRect(x - w * 0.5, y - h * 0.5, w, h * 0.6);
  ctx.strokeRect(x - w * 0.5, y - h * 0.5, w, h * 0.6);
  // Roof
  ctx.fillStyle = shadeHex(c, 0.1);
  ctx.fillRect(x - w * 0.4, y - h * 0.6, w * 0.8, h * 0.15);
}

function drawTruck(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, colorIdx: number) {
  const c = COLORS.traffic[colorIdx % COLORS.traffic.length];
  ctx.fillStyle = c;
  ctx.strokeStyle = shadeHex(c, -0.3);
  ctx.lineWidth = w * 0.025;
  // Cab
  ctx.fillRect(x - w * 0.25, y - h * 0.4, w * 0.5, h * 0.45);
  ctx.strokeRect(x - w * 0.25, y - h * 0.4, w * 0.5, h * 0.45);
  // Trailer
  ctx.fillStyle = shadeHex(c, -0.1);
  ctx.fillRect(x + w * 0.25, y - h * 0.4, w * 0.75, h * 0.5);
  ctx.strokeRect(x + w * 0.25, y - h * 0.4, w * 0.75, h * 0.5);
  // Wheels
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(x - w * 0.2, y + h * 0.05, w * 0.08, h * 0.1);
  ctx.fillRect(x + w * 0.15, y + h * 0.05, w * 0.08, h * 0.1);
  ctx.fillRect(x + w * 0.55, y + h * 0.1, w * 0.1, h * 0.15);
  ctx.fillRect(x + w * 0.9, y + h * 0.1, w * 0.1, h * 0.15);
}

function drawGang(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, colorIdx: number) {
  const c = COLORS.gang[colorIdx % COLORS.gang.length];
  ctx.fillStyle = c;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = w * 0.02;
  // Body
  ctx.fillRect(x - w * 0.4, y - h * 0.5, w * 0.8, h * 0.6);
  ctx.strokeRect(x - w * 0.4, y - h * 0.5, w * 0.8, h * 0.6);
  // Head
  ctx.fillStyle = shadeHex(c, 0.2);
  ctx.beginPath();
  ctx.arc(x, y - h * 0.6, w * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Mask/helmet
  ctx.fillStyle = '#000';
  ctx.fillRect(x - w * 0.12, y - h * 0.55, w * 0.24, h * 0.12);
}

function drawCop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, colorIdx: number) {
  const c = COLORS.cop[colorIdx % COLORS.cop.length];
  ctx.fillStyle = c;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = w * 0.02;
  // Uniform
  ctx.fillRect(x - w * 0.4, y - h * 0.5, w * 0.8, h * 0.6);
  ctx.strokeRect(x - w * 0.4, y - h * 0.5, w * 0.8, h * 0.6);
  // Hat
  ctx.fillStyle = shadeHex(c, 0.3);
  ctx.fillRect(x - w * 0.2, y - h * 0.62, w * 0.4, h * 0.1);
  // Badge
  ctx.fillStyle = '#ffd700';
  ctx.fillRect(x - w * 0.05, y - h * 0.45, w * 0.1, h * 0.08);
}

function drawPalm(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#4a6b3a';
  // Trunk
  ctx.fillRect(x - w * 0.05, y - h * 0.4, w * 0.1, h * 0.8);
  // Leaves
  ctx.fillStyle = '#5ab84a';
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const len = h * 0.4;
    ctx.beginPath();
    ctx.moveTo(x, y - h * 0.4);
    ctx.lineTo(x + Math.cos(angle) * len, y - h * 0.4 + Math.sin(angle) * len);
    ctx.lineTo(x + Math.cos(angle + 0.2) * len * 0.8, y - h * 0.4 + Math.sin(angle + 0.2) * len * 0.8);
    ctx.closePath();
    ctx.fill();
  }
}

function drawPine(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#3a5a2a';
  // Trunk
  ctx.fillRect(x - w * 0.05, y - h * 0.3, w * 0.1, h * 0.7);
  // Foliage
  ctx.fillStyle = '#2a4a1a';
  ctx.beginPath();
  ctx.moveTo(x, y - h * 0.5);
  ctx.lineTo(x - w * 0.4, y - h * 0.1);
  ctx.lineTo(x + w * 0.4, y - h * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y - h * 0.3);
  ctx.lineTo(x - w * 0.3, y + h * 0.1);
  ctx.lineTo(x + w * 0.3, y + h * 0.1);
  ctx.closePath();
  ctx.fill();
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#5a3a1a';
  // Trunk
  ctx.fillRect(x - w * 0.05, y - h * 0.3, w * 0.1, h * 0.6);
  // Canopy
  ctx.fillStyle = '#3a6a2a';
  ctx.beginPath();
  ctx.arc(x, y - h * 0.4, w * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#4a4a4a';
  ctx.beginPath();
  ctx.arc(x, y, w * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6a6a6a';
  ctx.beginPath();
  ctx.arc(x - w * 0.08, y - h * 0.08, w * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

function drawCrate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(x - w * 0.5, y - h * 0.5, w, h);
  ctx.strokeStyle = '#8a6a3a';
  ctx.lineWidth = w * 0.03;
  ctx.strokeRect(x - w * 0.5, y - h * 0.5, w, h);
  // Slats
  ctx.strokeStyle = '#3a2a1a';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.4, y - h * 0.5);
  ctx.lineTo(x - w * 0.4, y + h * 0.5);
  ctx.moveTo(x + w * 0.4, y - h * 0.5);
  ctx.lineTo(x + w * 0.4, y + h * 0.5);
  ctx.moveTo(x, y - h * 0.5);
  ctx.lineTo(x, y + h * 0.5);
  ctx.stroke();
}

function drawBarrel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#3a2a1a';
  ctx.beginPath();
  ctx.arc(x, y, w * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5a4a2a';
  ctx.lineWidth = w * 0.03;
  ctx.beginPath();
  ctx.arc(x, y, w * 0.25, 0, Math.PI * 2);
  ctx.stroke();
  // Metal bands
  ctx.strokeStyle = '#8a6a3a';
  ctx.beginPath();
  ctx.arc(x, y, w * 0.25, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y - h * 0.15, w * 0.25, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y + h * 0.15, w * 0.25, 0, Math.PI * 2);
  ctx.stroke();
}

function drawSign(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#ff4d2d';
  ctx.fillRect(x - w * 0.5, y - h * 0.3, w, h * 0.15);
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - w * 0.45, y - h * 0.25, w * 0.9, h * 0.25);
  ctx.fillStyle = '#000';
  ctx.font = `${h * 0.18}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('X', x, y - h * 0.05);
}

function drawLamp(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#3a3a3a';
  // Pole
  ctx.fillRect(x - w * 0.125, y - h * 0.5, w * 0.25, h);
  // Light
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.arc(x, y - h * 0.5, w * 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawBillboard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(x - w * 0.5, y - h * 0.5, w, h);
  ctx.fillStyle = '#000';
  ctx.font = `${h * 0.3}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('AD', x, y);
}

function drawSpeedSign(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#ff4d2d';
  ctx.beginPath();
  ctx.arc(x, y, w * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x, y, w * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.font = `${h * 0.3}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('100', x, y);
}

function drawRepair(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#8dff6a';
  ctx.beginPath();
  ctx.arc(x, y, w * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = w * 0.04;
  ctx.beginPath();
  ctx.arc(x, y, w * 0.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = `${h * 0.4}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+', x, y);
}

function drawNitro(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#6ff0ff';
  ctx.beginPath();
  ctx.arc(x, y, w * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = w * 0.04;
  ctx.beginPath();
  ctx.arc(x, y, w * 0.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = `${h * 0.4}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', x, y);
}

function shadeHex(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const shade = (c: number) => Math.round(clamp(c + amount * 255, 0, 255));
  return `#${((shade(r) << 16) | (shade(g) << 8) | shade(b)).toString(16).padStart(6, '0')}`;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/* ------------------------------------------------------------- engine */

export interface EngineOptions {
  onHud: (h: HudState) => void;
  onGameOver: (r: RunResult) => void;
}

export class Engine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null = null;
  options: EngineOptions;

  // Dimensions
  width = 0;
  height = 0;
  halfWidth = 0;
  halfHeight = 0;
  cameraDepth = 0;
  roadWidth = ROAD_WIDTH;

  // Game state
  segments: Segment[] = [];
  playerZ = 0;
  playerX = 0;
  playerY = 0;
  playerSpeed = 0;
  playerTargetSpeed = PLAYER_SPEED;
  playerPos = 0; // 0 = left edge, 1 = right edge, 0.5 = center
  playerLane = 1; // 0, 1, 2
  playerW = PLAYER_WIDTH;
  playerH = 0.6;
  playerD = PLAYER_LENGTH;
  playerLean = 0;
  playerLeanTarget = 0;
  playerBoost = 100;
  playerHealth = 100;
  playerMaxHealth = 100;
  playerScore = 0;
  playerDistance = 0;
  playerTakedowns = 0;
  playerCombo = 0;
  playerBestCombo = 0;
  playerWanted = 0;
  playerOffroad = false;
  playerInvuln = 0;
  playerAttackCooldown = 0;
  playerBoosting = false;
  playerBoostActive = false;

  // Input
  input = {
    left: false,
    right: false,
    up: false,
    down: false,
    boost: false,
  };

  // Entities
  entities: Entity[] = [];
  nextEnemyId = 1;
  entitySpawnTimer = 0;
  entitySpawnInterval = 2000;

  // Particles
  particles: Particle[] = [];

  // Popups
  popups: Popup[] = [];

  // Track
  track: Segment[] = [];
  rng: Rng;
  themeIdx = 0;
  themes: Theme[] = THEMES;
  currentTheme: Theme;
  nextTheme: Theme;
  themeProgress = 0;
  themeChangeTimer = 0;

  // Camera
  cameraX = 0;
  cameraY = CAMERA_HEIGHT;
  cameraZ = 0;
  cameraAngle = 0;

  // State
  running = false;
  paused = false;
  gameOver = false;
  attractMode = true;
  attractTime = 0;
  attractCameraZ = 0;

  // Touch hints
  touchHints = false;

  // Timing
  lastTime = 0;
  deltaTime = 0;
  totalTime = 0;
  frameCount = 0;

  // Animation
  skyOffset = 0;
  hillOffset = 0;

  constructor(canvas: HTMLCanvasElement, options: EngineOptions) {
    this.canvas = canvas;
    this.options = options;
    this.ctx = canvas.getContext('2d');
    this.rng = makeRng(42);
    this.currentTheme = THEMES[0];
    this.nextTheme = THEMES[1];
    this.resize();
    this.reset();
  }

  reset() {
    this.playerZ = 0;
    this.playerX = 0;
    this.playerY = 0;
    this.playerSpeed = 0;
    this.playerTargetSpeed = PLAYER_SPEED;
    this.playerPos = 0.5;
    this.playerLane = 1;
    this.playerLean = 0;
    this.playerLeanTarget = 0;
    this.playerBoost = 100;
    this.playerHealth = 100;
    this.playerMaxHealth = 100;
    this.playerScore = 0;
    this.playerDistance = 0;
    this.playerTakedowns = 0;
    this.playerCombo = 0;
    this.playerBestCombo = 0;
    this.playerWanted = 0;
    this.playerOffroad = false;
    this.playerInvuln = 0;
    this.playerAttackCooldown = 0;
    this.playerBoosting = false;
    this.playerBoostActive = false;
    this.cameraX = 0;
    this.cameraY = CAMERA_HEIGHT;
    this.cameraZ = 0;
    this.cameraAngle = 0;
    this.entities = [];
    this.particles = [];
    this.popups = [];
    this.nextEnemyId = 1;
    this.entitySpawnTimer = 0;
    this.entitySpawnInterval = 2000;
    this.running = false;
    this.paused = false;
    this.gameOver = false;
    this.attractMode = true;
    this.attractTime = 0;
    this.attractCameraZ = 0;
    this.totalTime = 0;
    this.frameCount = 0;
    this.themeIdx = 0;
    this.currentTheme = THEMES[0];
    this.nextTheme = THEMES[1];
    this.themeProgress = 0;
    this.themeChangeTimer = 0;
    this.rng = makeRng(Date.now());
    this.track = buildTrack(this.rng);
    this.segments = this.track;
    audio.start();
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this.gameLoop();
  }

  destroy() {
    this.running = false;
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width * dpr;
    this.height = rect.height * dpr;
    this.halfWidth = this.width / 2;
    this.halfHeight = this.height / 2;
    this.cameraDepth = 1 / Math.tan((FIELD_OF_VIEW * Math.PI) / 180 / 2);
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
      this.ctx.imageSmoothingEnabled = false;
    }
  }

  setPaused(p: boolean) {
    this.paused = p;
    if (!p) {
      this.lastTime = performance.now();
    }
  }

  startRun() {
    this.reset();
    this.attractMode = false;
    this.running = true;
    this.gameOver = false;
    this.playerSpeed = PLAYER_SPEED * 0.3;
    this.playerTargetSpeed = PLAYER_SPEED;
    audio.start();
  }

  toAttract() {
    this.attractMode = true;
    this.attractTime = 0;
    this.attractCameraZ = 0;
    this.reset();
  }

  attack() {
    if (this.paused || this.gameOver || this.attractMode) return;
    if (this.playerAttackCooldown > 0) return;
    if (this.playerBoosting) return;

    this.playerAttackCooldown = 400; // ms
    audio.swing();

    const attackRange = 1.5;
    const attackWidth = 0.8;

    for (const e of this.entities) {
      if (!e.alive) continue;
      if (e.kind !== 'enemy') continue;

      const dz = e.z - (this.playerZ + PLAYER_Z_OFFSET);
      if (Math.abs(dz) > SEGMENT_LENGTH * 1.5) continue;

      const dx = e.x - this.playerX;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < attackRange && Math.abs(dx) < attackWidth) {
        const enemy = e as Enemy;
        // Swing attack
        enemy.health -= 25;
        enemy.hitFlash = 8;
        if (enemy.health <= 0) {
          this.killEnemy(enemy, 'knockout');
        } else {
          enemy.state = 'stun';
          enemy.timer = 60;
          enemy.vx = (enemy.x > this.playerX ? -1 : 1) * 0.05;
        }
        break; // Only hit one enemy per swing
      }
    }
  }

  killEnemy(enemy: Enemy, cause: 'knockout' | 'crash' | 'offroad') {
    enemy.alive = false;
    enemy.state = 'crash';
    enemy.crashTime = 60;
    enemy.crashRot = 0;

    this.playerTakedowns++;
    this.playerCombo++;
    if (this.playerCombo > this.playerBestCombo) {
      this.playerBestCombo = this.playerCombo;
    }

    // Score
    const score = Math.floor(100 * (1 + this.playerCombo * 0.5) * (cause === 'knockout' ? 1.5 : 1));
    this.playerScore += score;

    // Popup
    this.popups.push({
      x: enemy.x,
      y: enemy.z / SEGMENT_LENGTH,
      vy: -0.02,
      life: 60,
      maxLife: 60,
      text: `+${score}`,
      color: '#ffd700',
      size: 1,
    });

    // Wanted level
    if (enemy.type === 'cop') {
      this.playerWanted = Math.min(MAX_WANTED, this.playerWanted + WANTED_KILL);
    }

    // Particles
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        x: enemy.x,
        y: enemy.z / SEGMENT_LENGTH,
        vx: (Math.random() - 0.5) * 0.1,
        vy: (Math.random() - 0.5) * 0.1 - 0.05,
        life: 30 + Math.random() * 20,
        maxLife: 50,
        size: 0.02 + Math.random() * 0.03,
        color: enemy.type === 'cop' ? '#6ff0ff' : '#ff8a3c',
        gravity: 0.002,
        kind: 'spark',
      });
    }

    audio.knockout();
  }

  spawnEntity() {
    if (this.entities.length > 40) return;
    if (this.playerZ < SEGMENT_LENGTH * 10) return; // Don't spawn too early

    const z = this.playerZ + SEGMENT_LENGTH * (8 + Math.random() * 15);
    const seg = findSegment(this.track, z);
    const segPct = (z % SEGMENT_LENGTH) / SEGMENT_LENGTH;
    const curve = seg.curve;

    // Determine lane
    const lanes = [0.25, 0.5, 0.75];
    let lane = Math.floor(Math.random() * 3);

    // Check if lane is occupied
    for (const e of this.entities) {
      if (e.z < z - SEGMENT_LENGTH * 2 || e.z > z + SEGMENT_LENGTH * 2) continue;
      const eLane = Math.floor((e.x + 1) / 2 * 3);
      if (eLane === lane && Math.abs(e.z - z) < SEGMENT_LENGTH * 3) {
        lane = (lane + 1 + Math.floor(Math.random() * 2)) % 3;
      }
    }

    const x = lanes[lane] * 2 - 1; // Convert to -1..1 range

    // Decide entity type
    const roll = Math.random();
    const wantedFactor = this.playerWanted / MAX_WANTED;

    let kind: Entity['kind'];
    if (roll < 0.05 + wantedFactor * 0.03) {
      kind = 'pickup';
    } else if (roll < 0.25 + wantedFactor * 0.3) {
      kind = 'enemy';
    } else {
      kind = 'traffic';
    }

    if (kind === 'traffic') {
      const dir = Math.random() < 0.3 ? -1 : 1; // Mostly same direction
      const body = ['car', 'van', 'truck'][Math.floor(Math.random() * 3)];
      const traffic: Traffic = {
        kind: 'traffic',
        z,
        x,
        alive: true,
        speed: (0.5 + Math.random() * 0.5) * PLAYER_SPEED * dir,
        dir: dir as 1 | -1,
        body,
        colorIdx: Math.floor(Math.random() * COLORS.traffic.length),
        drift: 0,
        passed: false,
      };
      this.entities.push(traffic);
    } else if (kind === 'enemy') {
      const type = Math.random() < 0.5 + wantedFactor * 0.5 ? 'cop' : 'gang';
      const enemy: Enemy = {
        kind: 'enemy',
        z,
        x,
        alive: true,
        id: this.nextEnemyId++,
        type,
        colorIdx: Math.floor(Math.random() * COLORS[type].length),
        speed: (0.7 + Math.random() * 0.4) * PLAYER_SPEED,
        vx: 0,
        health: type === 'cop' ? 80 : 60,
        maxHealth: type === 'cop' ? 80 : 60,
        state: 'ride',
        timer: 0,
        cooldown: 0,
        side: Math.random() < 0.5 ? -1 : 1,
        hitFlash: 0,
        lean: 0,
        punchSide: Math.random() < 0.5 ? 1 : -1,
        crashRot: 0,
        crashTime: 0,
        bob: Math.random() * Math.PI * 2,
        aggression: 0.3 + Math.random() * 0.7,
      };
      this.entities.push(enemy);
    } else if (kind === 'pickup') {
      const type = Math.random() < 0.7 ? 'repair' : 'nitro';
      const pickup: Pickup = {
        kind: 'pickup',
        z,
        x,
        alive: true,
        type,
        phase: 0,
      };
      this.entities.push(pickup);
    }
  }

  update(delta: number) {
    if (this.paused || this.attractMode) {
      if (this.attractMode) {
        this.attractTime += delta;
        this.attractCameraZ = Math.sin(this.attractTime * 0.001) * SEGMENT_LENGTH * 2;
        this.cameraZ = this.attractCameraZ;
      }
      return;
    }

    if (this.gameOver) return;

    this.totalTime += delta;
    this.playerDistance = this.playerZ / SEGMENT_LENGTH;

    // Theme transitions
    this.themeChangeTimer += delta;
    if (this.themeChangeTimer > 30000) {
      this.themeChangeTimer = 0;
      this.themeIdx = (this.themeIdx + 1) % THEMES.length;
      this.currentTheme = THEMES[this.themeIdx];
      this.nextTheme = THEMES[(this.themeIdx + 1) % THEMES.length];
    }
    this.themeProgress = this.themeChangeTimer / 30000;

    // Spawn entities
    this.entitySpawnTimer += delta;
    if (this.entitySpawnTimer > this.entitySpawnInterval) {
      this.entitySpawnTimer = 0;
      this.entitySpawnInterval = 1500 + Math.random() * 3000;
      this.spawnEntity();
    }

    // Update player position based on lane
    const targetPos = this.playerLane / 2; // 0, 0.5, 1
    this.playerPos = this.playerPos * 0.9 + targetPos * 0.1;
    this.playerX = (this.playerPos - 0.5) * 2; // -1 to 1

    // Handle input
    if (this.input.left) {
      this.playerLane = Math.max(0, this.playerLane - delta * 0.003);
      this.playerLeanTarget = -0.15;
    } else if (this.input.right) {
      this.playerLane = Math.min(2, this.playerLane + delta * 0.003);
      this.playerLeanTarget = 0.15;
    } else {
      this.playerLeanTarget = 0;
    }

    this.playerLean = this.playerLean * 0.9 + this.playerLeanTarget * 0.1;

    // Boost
    if (this.input.boost && this.playerBoost > 0 && !this.playerBoosting) {
      this.playerBoosting = true;
      this.playerBoostActive = true;
      audio.boost();
    }

    if (!this.input.boost) {
      this.playerBoosting = false;
    }

    if (this.playerBoosting && this.playerBoost > 0) {
      this.playerBoost -= delta * 0.15;
      if (this.playerBoost <= 0) {
        this.playerBoost = 0;
        this.playerBoosting = false;
      }
    } else if (this.playerBoost < 100) {
      this.playerBoost += delta * 0.05;
    }

    if (this.playerBoosting) {
      this.playerTargetSpeed = MAX_PLAYER_SPEED;
    } else if (this.input.up) {
      this.playerTargetSpeed = Math.min(MAX_PLAYER_SPEED, this.playerTargetSpeed + ACCEL * delta);
    } else if (this.input.down) {
      this.playerTargetSpeed = Math.max(MIN_PLAYER_SPEED * 0.5, this.playerTargetSpeed - BRAKE * delta);
    } else {
      this.playerTargetSpeed = Math.max(MIN_PLAYER_SPEED, this.playerTargetSpeed - DECEL * delta);
    }

    // Speed cap based on wanted level
    const wantedSpeedCap = MAX_PLAYER_SPEED * (1 - this.playerWanted * 0.1);
    this.playerTargetSpeed = Math.min(this.playerTargetSpeed, wantedSpeedCap);

    // Apply speed
    this.playerSpeed = this.playerSpeed * 0.95 + this.playerTargetSpeed * 0.05;

    // Move player
    const speedFactor = this.playerSpeed / PLAYER_SPEED;
    this.playerZ += this.playerSpeed * delta * 0.001;

    // Camera follows player
    this.cameraZ = this.playerZ - PLAYER_Z_OFFSET;

    // Handle road curvature
    const seg = findSegment(this.track, this.playerZ);
    const curve = seg.curve;
    const cameraOffset = curve * this.playerX * 0.5;
    this.cameraX = -cameraOffset;

    // Update entities
    for (const e of this.entities) {
      if (!e.alive) continue;

      if (e.kind === 'traffic') {
        const traffic = e as Traffic;
        traffic.z -= traffic.speed * delta * 0.001;
        traffic.drift += traffic.speed * delta * 0.0001 * traffic.side;
        traffic.x = (traffic.lane ? traffic.lane * 2 - 1 : 0) + traffic.drift;

        // Check if passed player
        if (traffic.z < this.playerZ - PLAYER_Z_OFFSET && !traffic.passed) {
          traffic.passed = true;
          if (traffic.dir === 1) {
            // Overtaking
            this.playerScore += 10;
          }
        }

        // Despawn
        if (traffic.z < this.playerZ - SEGMENT_LENGTH * 15) {
          traffic.alive = false;
        }
      } else if (e.kind === 'enemy') {
        const enemy = e as Enemy;
        const dz = enemy.z - this.playerZ;

        // AI: Chase player
        if (enemy.state === 'ride') {
          const targetLane = Math.floor((this.playerX + 1) / 2 * 3);
          const lanePos = (targetLane / 2) * 2 - 1;
          const dx = lanePos - enemy.x;

          enemy.vx = dx * enemy.aggression * 0.0005;
          enemy.x += enemy.vx * delta;
          enemy.x = Math.max(-1.8, Math.min(1.8, enemy.x));

          // Attack decision
          enemy.cooldown -= delta;
          if (enemy.cooldown <= 0 && Math.abs(dz) < SEGMENT_LENGTH * 2 && Math.abs(enemy.x - this.playerX) < 0.8) {
            enemy.state = 'wind';
            enemy.timer = 40;
            enemy.cooldown = 2000 + Math.random() * 2000;
          }

          // Bob animation
          enemy.bob += delta * 0.003;
          enemy.lean = Math.sin(enemy.bob) * 0.02;
        } else if (enemy.state === 'wind') {
          enemy.timer -= delta;
          enemy.lean = enemy.punchSide * (1 - enemy.timer / 40) * 0.3;
          if (enemy.timer <= 0) {
            enemy.state = 'punch';
            enemy.timer = 20;
          }
        } else if (enemy.state === 'punch') {
          enemy.timer -= delta;
          if (enemy.timer <= 0) {
            enemy.state = 'ride';
          }
        } else if (enemy.state === 'stun') {
          enemy.timer -= delta;
          enemy.x += enemy.vx * delta * 0.001;
          enemy.vx *= 0.98;
          if (enemy.timer <= 0) {
            enemy.state = 'ride';
          }
        }

        // Move forward
        enemy.z -= enemy.speed * delta * 0.001;

        // Hit flash
        if (enemy.hitFlash > 0) {
          enemy.hitFlash -= delta * 0.001;
        }

        // Despawn
        if (enemy.z < this.playerZ - SEGMENT_LENGTH * 15) {
          enemy.alive = false;
        }

        // Crash state
        if (enemy.state === 'crash') {
          enemy.crashTime -= delta * 0.001;
          enemy.crashRot += 0.1;
          if (enemy.crashTime <= 0) {
            enemy.alive = false;
          }
        }
      } else if (e.kind === 'pickup') {
        const pickup = e as Pickup;
        pickup.z -= this.playerSpeed * 0.5 * delta * 0.001;
        pickup.phase += delta * 0.002;

        // Check collision with player
        const dz = pickup.z - (this.playerZ + PLAYER_Z_OFFSET);
        const dx = pickup.x - this.playerX;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < 1.5) {
          pickup.alive = false;
          if (pickup.type === 'repair') {
            this.playerHealth = Math.min(100, this.playerHealth + 30);
            audio.pickup();
            this.popups.push({
              x: this.playerX,
              y: this.playerZ / SEGMENT_LENGTH,
              vy: -0.02,
              life: 40,
              maxLife: 40,
              text: 'REPAIR',
              color: '#8dff6a',
              size: 0.8,
            });
          } else if (pickup.type === 'nitro') {
            this.playerBoost = Math.min(100, this.playerBoost + 30);
            audio.pickup();
            this.popups.push({
              x: this.playerX,
              y: this.playerZ / SEGMENT_LENGTH,
              vy: -0.02,
              life: 40,
              maxLife: 40,
              text: 'NITRO',
              color: '#6ff0ff',
              size: 0.8,
            });
          }
        }

        // Despawn
        if (pickup.z < this.playerZ - SEGMENT_LENGTH * 10) {
          pickup.alive = false;
        }
      }
    }

    // Check collisions
    this.checkCollisions();

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * delta * 0.001;
      p.y += p.vy * delta * 0.001;
      p.vy += p.gravity * delta * 0.001;
      p.life -= delta * 0.001;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update popups
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.y += p.vy * delta * 0.001;
      p.life -= delta * 0.001;

      if (p.life <= 0) {
        this.popups.splice(i, 1);
      }
    }

    // Update invulnerability
    if (this.playerInvuln > 0) {
      this.playerInvuln -= delta;
    }

    // Update attack cooldown
    if (this.playerAttackCooldown > 0) {
      this.playerAttackCooldown -= delta;
    }

    // Decay combo
    if (this.playerCombo > 0 && this.totalTime - this.lastComboTime > 2000) {
      this.playerCombo = 0;
    }

    // Decay wanted level
    if (this.playerWanted > 0 && this.totalTime - this.lastWantedTime > 5000) {
      this.playerWanted = Math.max(0, this.playerWanted - WANTED_DECAY * delta * 0.001);
    }

    // Check for off-road
    const playerRoadPos = this.playerX * 0.5 + 0.5;
    const roadLeft = 0.1;
    const roadRight = 0.9;
    this.playerOffroad = playerRoadPos < roadLeft || playerRoadPos > roadRight;

    // Off-road penalty
    if (this.playerOffroad) {
      this.playerSpeed *= 0.995;
      if (this.playerSpeed < OFFROAD_LIMIT) {
        this.playerSpeed = OFFROAD_LIMIT;
      }
    }

    // Update HUD
    this.updateHUD(delta);

    // Sky offset for animation
    this.skyOffset += delta * 0.0001;
    this.hillOffset += delta * 0.0002;
  }

  lastComboTime = 0;
  lastWantedTime = 0;

  checkCollisions() {
    if (this.playerInvuln > 0) return;

    const playerFront = this.playerZ + PLAYER_Z_OFFSET;
    const playerBack = this.playerZ - PLAYER_LENGTH * SEGMENT_LENGTH;
    const playerLeft = this.playerX - PLAYER_WIDTH / 2;
    const playerRight = this.playerX + PLAYER_WIDTH / 2;

    for (const e of this.entities) {
      if (!e.alive) continue;

      if (e.kind === 'traffic') {
        const traffic = e as Traffic;
        const eFront = traffic.z + (traffic.body === 'truck' ? 2 : traffic.body === 'van' ? 1.5 : 1) * 0.5;
        const eBack = traffic.z - (traffic.body === 'truck' ? 2 : traffic.body === 'van' ? 1.5 : 1) * 0.5;
        const eLeft = traffic.x - (traffic.body === 'truck' ? 2 : traffic.body === 'van' ? 1.5 : 1) * 0.5;
        const eRight = traffic.x + (traffic.body === 'truck' ? 2 : traffic.body === 'van' ? 1.5 : 1) * 0.5;

        // Simple AABB collision
        if (
          playerFront > eBack &&
          playerBack < eFront &&
          playerRight > eLeft &&
          playerLeft < eRight
        ) {
          // Collision!
          const damage = traffic.body === 'truck' ? 40 : traffic.body === 'van' ? 25 : 15;
          this.playerHealth -= damage;
          this.playerInvuln = 1000;
          audio.crash();

          // Particles
          for (let i = 0; i < 15; i++) {
            this.particles.push({
              x: (playerLeft + playerRight) / 2,
              y: playerFront / SEGMENT_LENGTH,
              vx: (Math.random() - 0.5) * 0.2,
              vy: (Math.random() - 0.5) * 0.2 - 0.1,
              life: 40 + Math.random() * 30,
              maxLife: 70,
              size: 0.03 + Math.random() * 0.05,
              color: '#ff4d2d',
              gravity: 0.003,
              kind: 'debris',
            });
          }

          // Check if game over
          if (this.playerHealth <= 0) {
            this.gameOver = true;
            audio.gameOver();
            this.options.onGameOver({
              score: this.playerScore,
              distance: this.playerDistance,
              takedowns: this.playerTakedowns,
              bestCombo: this.playerBestCombo,
              time: this.totalTime / 1000,
              cause: 'CRASH',
            });
          }
          return;
        }
      } else if (e.kind === 'enemy') {
        const enemy = e as Enemy;
        const eFront = enemy.z + 0.5;
        const eBack = enemy.z - 0.5;
        const eLeft = enemy.x - 0.45;
        const eRight = enemy.x + 0.45;

        // Check if enemy hits player
        if (
          enemy.state === 'punch' &&
          playerFront > eBack &&
          playerBack < eFront &&
          playerRight > eLeft &&
          playerLeft < eRight
        ) {
          // Enemy punch hits player
          const damage = enemy.type === 'cop' ? 15 : 10;
          this.playerHealth -= damage;
          this.playerInvuln = 500;
          this.playerCombo = 0;
          audio.hurt();

          // Wanted level
          this.playerWanted = Math.min(MAX_WANTED, this.playerWanted + WANTED_HIT);
          this.lastWantedTime = this.totalTime;

          // Particles
          for (let i = 0; i < 8; i++) {
            this.particles.push({
              x: (playerLeft + playerRight) / 2,
              y: playerFront / SEGMENT_LENGTH,
              vx: (Math.random() - 0.5) * 0.2,
              vy: (Math.random() - 0.5) * 0.2 - 0.1,
              life: 30 + Math.random() * 20,
              maxLife: 50,
              size: 0.02 + Math.random() * 0.03,
              color: '#ff4d2d',
              gravity: 0.003,
              kind: 'spark',
            });
          }

          // Check if game over
          if (this.playerHealth <= 0) {
            this.gameOver = true;
            audio.gameOver();
            this.options.onGameOver({
              score: this.playerScore,
              distance: this.playerDistance,
              takedowns: this.playerTakedowns,
              bestCombo: this.playerBestCombo,
              time: this.totalTime / 1000,
              cause: enemy.type === 'cop' ? 'BUSTED BY COPS' : 'GANG AMBUSH',
            });
          }
        }

        // Check if player hits enemy from behind (takedown)
        if (
          playerFront > eBack &&
          playerFront - eBack < 0.5 &&
          playerBack < eFront &&
          Math.abs(this.playerX - enemy.x) < 0.6
        ) {
          if (enemy.state === 'ride' && this.playerSpeed > enemy.speed * 1.2) {
            this.killEnemy(enemy, 'crash');
            this.lastComboTime = this.totalTime;
          }
        }
      }
    }

    // Check road edge collision
    const seg = findSegment(this.track, this.playerZ);
    const roadLeft = -1 - ROAD_EDGE_MARGIN;
    const roadRight = 1 + ROAD_EDGE_MARGIN;

    if (this.playerX < roadLeft || this.playerX > roadRight) {
      // Off the road completely - instant damage
      this.playerHealth -= delta * 0.05;
      this.playerInvuln = 100;

      if (this.playerHealth <= 0) {
        this.gameOver = true;
        audio.gameOver();
        this.options.onGameOver({
          score: this.playerScore,
          distance: this.playerDistance,
          takedowns: this.playerTakedowns,
          bestCombo: this.playerBestCombo,
          time: this.totalTime / 1000,
          cause: 'WENT OFF ROAD',
        });
      }
    }
  }

  updateHUD(delta: number) {
    const speedKph = Math.round(this.playerSpeed / SEGMENT_LENGTH * 100 * 3.6);
    const speedPct = this.playerSpeed / MAX_PLAYER_SPEED;

    const hud: HudState = {
      speedKph,
      speedPct,
      health: this.playerHealth,
      score: this.playerScore,
      distance: Math.floor(this.playerDistance),
      takedowns: this.playerTakedowns,
      combo: this.playerCombo,
      boost: this.playerBoost,
      wanted: Math.floor(this.playerWanted),
      offroad: this.playerOffroad,
    };

    this.options.onHud(hud);
  }

  render() {
    if (!this.ctx) return;

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const cx = this.halfWidth;
    const cy = this.halfHeight;

    // Clear
    ctx.fillStyle = '#06040c';
    ctx.fillRect(0, 0, w, h);

    // Get current segment
    const baseSegment = findSegment(this.track, this.cameraZ);
    const basePercent = (this.cameraZ % SEGMENT_LENGTH) / SEGMENT_LENGTH;

    // Current theme
    const theme = this.themeProgress < 0.5
      ? this.currentTheme
      : blendThemes(this.currentTheme, this.nextTheme, this.themeProgress * 2 - 1);

    // Draw sky
    this.drawSky(ctx, w, h, theme);

    // Draw far mountains / hills
    this.drawHills(ctx, w, h, theme);

    // Draw road
    const maxy = h;
    let n, segment, x, y, segmentPct, nextSegment, nextSegmentPct, carX, carY, carW, carH;

    for (n = 0; n < DRAW_DISTANCE; n++) {
      segment = this.track[(baseSegment.index + n) % this.track.length];
      nextSegment = this.track[(baseSegment.index + n + 1) % this.track.length];

      segmentPct = (n === 0) ? basePercent : 0;
      nextSegmentPct = (n === 0) ? 1 : 0;

      segment.p1.camera.z = segmentPct * SEGMENT_LENGTH - (n === 0 ? basePercent * SEGMENT_LENGTH : 0);
      segment.p2.camera.z = nextSegmentPct * SEGMENT_LENGTH - (n === 0 ? (1 - basePercent) * SEGMENT_LENGTH : 0);

      // Project points
      project(segment.p1, this.cameraX, this.cameraY, this.cameraZ, this.cameraDepth, w, h, this.roadWidth);
      project(segment.p2, this.cameraX, this.cameraY, this.cameraZ, this.cameraDepth, w, h, this.roadWidth);

      // Skip if segment is behind camera
      if (segment.p1.camera.z <= 0 && segment.p2.camera.z <= 0) continue;
      if (segment.p1.screen.y >= maxy && segment.p2.screen.y >= maxy) continue;

      this.drawSegment(ctx, w, h, segment, nextSegment, n, theme);
    }

    // Draw scenery sprites
    for (n = 0; n < DRAW_DISTANCE; n++) {
      segment = this.track[(baseSegment.index + n) % this.track.length];

      for (const sprite of segment.sprites) {
        const spriteDef = spriteDefs[sprite.kind];
        if (!spriteDef) continue;

        const spriteZ = segment.p1.world.z + sprite.offset * this.roadWidth;
        const spriteX = segment.p1.world.x + (segment.p2.world.x - segment.p1.world.x) * (spriteZ - segment.p1.world.z) / SEGMENT_LENGTH;
        const spriteY = segment.p1.world.y + (segment.p2.world.y - segment.p1.world.y) * (spriteZ - segment.p1.world.z) / SEGMENT_LENGTH;

        // Project sprite
        const p: Vec3 = { x: spriteX + sprite.offset * this.roadWidth, y: spriteY, z: spriteZ };
        const camera = { x: p.x - this.cameraX, y: p.y - this.cameraY, z: p.z - this.cameraZ };
        if (camera.z <= 0) continue;

        const scale = this.cameraDepth / camera.z;
        const x2d = Math.round(cx + (scale * camera.x * w) / 2);
        const y2d = Math.round(cy - (scale * camera.y * h) / 2);
        const spriteScreenW = Math.round((scale * this.roadWidth * spriteDef.w * w) / 2);
        const spriteScreenH = Math.round((scale * this.roadWidth * spriteDef.h * h) / 2);

        if (y2d > h || y2d < -spriteScreenH) continue;

        // Apply fog
        const fog = 1 - Math.min(1, Math.pow(camera.z / (DRAW_DISTANCE * SEGMENT_LENGTH), FOG_DENSITY));
        const alpha = fog;

        ctx.globalAlpha = alpha * 0.8;
        spriteDef.draw(ctx, x2d, y2d, spriteScreenW, spriteScreenH, 0);
        ctx.globalAlpha = 1;
      }
    }

    // Draw entities
    for (const e of this.entities) {
      if (!e.alive) continue;

      const dz = e.z - this.cameraZ;
      if (dz < -SEGMENT_LENGTH * 2 || dz > SEGMENT_LENGTH * DRAW_DISTANCE) continue;

      const camera = { x: e.x * this.roadWidth - this.cameraX, y: 0 - this.cameraY, z: dz };
      if (camera.z <= 0) continue;

      const scale = this.cameraDepth / camera.z;
      const x2d = Math.round(cx + (scale * camera.x * w) / 2);
      const y2d = Math.round(cy - (scale * camera.y * h) / 2);

      let spriteDef = spriteDefs[e.kind];
      if (e.kind === 'traffic') {
        const traffic = e as Traffic;
        spriteDef = spriteDefs[traffic.body];
      } else if (e.kind === 'enemy') {
        const enemy = e as Enemy;
        spriteDef = spriteDefs[enemy.type];
      } else if (e.kind === 'pickup') {
        const pickup = e as Pickup;
        spriteDef = spriteDefs[pickup.type];
      }

      if (!spriteDef) continue;

      const spriteW = Math.round((scale * this.roadWidth * spriteDef.w * w) / 2);
      const spriteH = Math.round((scale * this.roadWidth * spriteDef.h * h) / 2);

      if (y2d > h || y2d < -spriteH) continue;

      // Fog
      const fog = 1 - Math.min(1, Math.pow(dz / (DRAW_DISTANCE * SEGMENT_LENGTH), FOG_DENSITY));

      // Draw entity
      ctx.save();
      ctx.translate(x2d, y2d);

      if (e.kind === 'enemy') {
        const enemy = e as Enemy;
        if (enemy.state === 'crash') {
          ctx.rotate(enemy.crashRot);
        }
        if (enemy.hitFlash > 0) {
          ctx.filter = `brightness(${1 + enemy.hitFlash * 0.5})`;
        }
        if (enemy.lean !== 0) {
          ctx.translate(0, enemy.lean * spriteH * 0.5);
        }
      }

      ctx.globalAlpha = fog * (e.kind === 'enemy' && (e as Enemy).hitFlash > 0 ? 1 : 1);

      if (e.kind === 'traffic') {
        const traffic = e as Traffic;
        spriteDef.draw(ctx, 0, 0, spriteW, spriteH, traffic.colorIdx);
      } else if (e.kind === 'enemy') {
        const enemy = e as Enemy;
        spriteDef.draw(ctx, 0, 0, spriteW, spriteH, enemy.colorIdx);

        // Health bar for enemies
        if (enemy.health < enemy.maxHealth && dz < SEGMENT_LENGTH * 5) {
          const barH = Math.max(4, spriteH * 0.1);
          const barW = spriteW * 0.8;
          const barY = -spriteH * 0.5 - barH - 2;
          ctx.fillStyle = '#000';
          ctx.fillRect(-barW / 2, barY, barW, barH);
          ctx.fillStyle = enemy.health > enemy.maxHealth * 0.5 ? '#8dff6a' : enemy.health > enemy.maxHealth * 0.25 ? '#ffdc6b' : '#ff4d2d';
          ctx.fillRect(-barW / 2, barY, barW * (enemy.health / enemy.maxHealth), barH);
        }

        // Attack indicator
        if (enemy.state === 'wind' || enemy.state === 'punch') {
          ctx.strokeStyle = '#ff4d2d';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, -spriteH * 0.3, spriteW * 0.6, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (e.kind === 'pickup') {
        const pickup = e as Pickup;
        const pulse = Math.sin(pickup.phase) * 0.1 + 0.9;
        ctx.globalAlpha = fog * pulse;
        spriteDef.draw(ctx, 0, 0, spriteW, spriteH, 0);
      }

      ctx.restore();
    }

    // Draw player bike
    this.drawPlayer(ctx, w, h);

    // Draw particles
    for (const p of this.particles) {
      const dz = (p.y * SEGMENT_LENGTH) - this.cameraZ;
      if (dz < -SEGMENT_LENGTH * 2 || dz > SEGMENT_LENGTH * DRAW_DISTANCE) continue;

      const camera = { x: p.x * this.roadWidth - this.cameraX, y: 0 - this.cameraY, z: dz };
      if (camera.z <= 0) continue;

      const scale = this.cameraDepth / camera.z;
      const x2d = Math.round(cx + (scale * camera.x * w) / 2);
      const y2d = Math.round(cy - (scale * camera.y * h) / 2);

      const fog = 1 - Math.min(1, Math.pow(dz / (DRAW_DISTANCE * SEGMENT_LENGTH), FOG_DENSITY));
      const lifePct = p.life / p.maxLife;
      const size = p.size * scale * this.roadWidth * w * 0.5 * lifePct;

      ctx.globalAlpha = fog * lifePct;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(x2d, y2d, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Draw popups
    for (const p of this.popups) {
      const dz = (p.y * SEGMENT_LENGTH) - this.cameraZ;
      if (dz < -SEGMENT_LENGTH * 2 || dz > SEGMENT_LENGTH * DRAW_DISTANCE) continue;

      const camera = { x: p.x * this.roadWidth - this.cameraX, y: 0 - this.cameraY, z: dz };
      if (camera.z <= 0) continue;

      const scale = this.cameraDepth / camera.z;
      const x2d = Math.round(cx + (scale * camera.x * w) / 2);
      const y2d = Math.round(cy - (scale * camera.y * h) / 2);

      const fog = 1 - Math.min(1, Math.pow(dz / (DRAW_DISTANCE * SEGMENT_LENGTH), FOG_DENSITY));
      const lifePct = p.life / p.maxLife;

      ctx.globalAlpha = fog * lifePct;
      ctx.font = `${Math.round(14 * scale * p.size)}px sans-serif`;
      ctx.fillStyle = p.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.text, x2d, y2d);
      ctx.globalAlpha = 1;
    }

    // Draw attract mode text
    if (this.attractMode) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ff8a3c';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ROAD FURY', cx, cy - 40);
      ctx.fillStyle = '#6ff0ff';
      ctx.font = '16px sans-serif';
      ctx.fillText('JAILBREAK RUN', cx, cy);
      ctx.fillStyle = '#ffffff80';
      ctx.font = '12px sans-serif';
      ctx.fillText('Press SPACE to start', cx, cy + 40);
    }
  }

  drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, theme: Theme) {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, `rgb(${theme.skyTop[0]},${theme.skyTop[1]},${theme.skyTop[2]})`);
    gradient.addColorStop(1, `rgb(${theme.skyBot[0]},${theme.skyBot[1]},${theme.skyBot[2]})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // Stars
    if (theme.stars > 0) {
      ctx.fillStyle = '#fff';
      const starCount = theme.stars === 1 ? 100 : 50;
      for (let i = 0; i < starCount; i++) {
        const x = (i * 0x9e3779b9) % w;
        const y = (i * 0x3c6ef372) % h;
        const size = Math.random() < 0.3 ? 1.5 : 1;
        ctx.fillRect(x, y, size, size);
      }
    }

    // Sun
    if (theme.name !== 'NEON CITY' && theme.name !== 'MIDNIGHT PINES') {
      const sunSize = 60;
      const sunX = w * 0.8 + Math.sin(this.skyOffset) * w * 0.1;
      const sunY = h * 0.2 + Math.cos(this.skyOffset * 0.7) * h * 0.05;
      const gradient2 = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunSize * 2);
      gradient2.addColorStop(0, `rgb(${theme.sun[0]},${theme.sun[1]},${theme.sun[2]})`);
      gradient2.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient2;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunSize * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawHills(ctx: CanvasRenderingContext2D, w: number, h: number, theme: Theme) {
    const hillCount = 5;
    const hillHeight = h * 0.4;

    for (let i = 0; i < hillCount; i++) {
      const x = (i / hillCount) * w;
      const y = h - hillHeight + Math.sin(this.hillOffset + i * 1.5) * hillHeight * 0.1;
      const width = w / hillCount * 1.5;
      const height = hillHeight * 0.6 + Math.sin(this.hillOffset + i * 0.5) * hillHeight * 0.1;

      const gradient = ctx.createLinearGradient(x, y, x, y + height);
      gradient.addColorStop(0, `rgb(${theme.far[0]},${theme.far[1]},${theme.far[2]})`);
      gradient.addColorStop(1, `rgb(${theme.near[0]},${theme.near[1]},${theme.near[2]})`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(x - width / 2, y + height);
      for (let j = 0; j <= 10; j++) {
        const px = x - width / 2 + (j / 10) * width;
        const py = y + height - Math.sin(j + this.hillOffset * 0.1) * height * 0.3;
        ctx.lineTo(px, py);
      }
      ctx.lineTo(x + width / 2, y + height);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawSegment(ctx: CanvasRenderingContext2D, w: number, h: number, segment: Segment, nextSegment: Segment, n: number, theme: Theme) {
    const p1 = segment.p1.screen;
    const p2 = segment.p2.screen;
    const clip = segment.clip;

    // Road color based on segment
    const roadColor = segment.dark
      ? `rgb(${theme.roadDark[0]},${theme.roadDark[1]},${theme.roadDark[2]})`
      : `rgb(${theme.roadLight[0]},${theme.roadLight[1]},${theme.roadLight[2]})`;
    const grassColor = segment.dark
      ? `rgb(${theme.grassDark[0]},${theme.grassDark[1]},${theme.grassDark[2]})`
      : `rgb(${theme.grassLight[0]},${theme.grassLight[1]},${theme.grassLight[2]})`;
    const rumbleColor = segment.dark
      ? `rgb(${theme.rumbleDark[0]},${theme.rumbleDark[1]},${theme.rumbleDark[2]})`
      : `rgb(${theme.rumbleLight[0]},${theme.rumbleLight[1]},${theme.rumbleLight[2]})`;
    const laneColor = `rgb(${theme.lane[0]},${theme.lane[1]},${theme.lane[2]})`;

    // Draw grass
    ctx.fillStyle = grassColor;
    ctx.fillRect(0, p1.y, w, p2.y - p1.y);

    // Draw road
    ctx.fillStyle = roadColor;
    ctx.fillRect(p1.x - p1.w, p1.y, p1.w * 2, p2.y - p1.y);
    ctx.fillRect(p2.x - p2.w, p2.y, p2.w * 2, p2.y - p1.y);

    // Draw rumble strips
    const rumbleW = p1.w * 0.15;
    ctx.fillStyle = rumbleColor;
    ctx.fillRect(p1.x - p1.w - rumbleW, p1.y, rumbleW, p2.y - p1.y);
    ctx.fillRect(p1.x + p1.w, p1.y, rumbleW, p2.y - p1.y);
    ctx.fillRect(p2.x - p2.w - rumbleW, p2.y, rumbleW, p2.y - p1.y);
    ctx.fillRect(p2.x + p2.w, p2.y, rumbleW, p2.y - p1.y);

    // Draw lane markings
    if (segment.lane) {
      const laneW = p1.w * 0.04;
      const laneX1 = p1.x - p1.w * 0.5 + laneW * 0.5;
      const laneX2 = p1.x + p1.w * 0.5 - laneW * 0.5;
      ctx.fillStyle = laneColor;
      ctx.fillRect(laneX1 - laneW * 0.5, p1.y, laneW, LANE_MARKINGS_L * (p2.y - p1.y) / SEGMENT_LENGTH);
      ctx.fillRect(laneX2 - laneW * 0.5, p1.y, laneW, LANE_MARKINGS_L * (p2.y - p1.y) / SEGMENT_LENGTH);
    }

    // Draw fog
    if (theme.fog) {
      const fogColor = `rgba(${theme.fog[0]},${theme.fog[1]},${theme.fog[2]},${FOG_DENSITY * 0.01})`;
      ctx.fillStyle = fogColor;
      ctx.fillRect(0, p1.y, w, p2.y - p1.y);
    }
  }

  drawPlayer(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (this.attractMode) return;

    // Calculate player position on screen
    const dz = (this.playerZ + PLAYER_Z_OFFSET) - this.cameraZ;
    if (dz <= 0) return;

    const camera = { x: this.playerX * this.roadWidth - this.cameraX, y: 0 - this.cameraY, z: dz };
    const scale = this.cameraDepth / camera.z;
    const x2d = Math.round(this.halfWidth + (scale * camera.x * w) / 2);
    const y2d = Math.round(this.halfHeight - (scale * camera.y * h) / 2);

    const bikeW = Math.round((scale * this.roadWidth * BIKE_W * w) / 2);
    const bikeH = Math.round((scale * this.roadWidth * BIKE_H * h) / 2);

    ctx.save();
    ctx.translate(x2d, y2d);
    ctx.rotate(this.playerLean * 0.3);

    // Draw bike
    const bikeDef = spriteDefs.bike;
    bikeDef.draw(ctx, 0, 0, bikeW, bikeH, 0);

    // Draw player invulnerability flash
    if (this.playerInvuln > 0 && Math.floor(this.totalTime / 100) % 2 === 0) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#fff';
      ctx.fillRect(-bikeW / 2, -bikeH / 2, bikeW, bikeH);
      ctx.globalAlpha = 1;
    }

    // Draw boost effect
    if (this.playerBoosting) {
      ctx.fillStyle = 'rgba(140, 255, 120, 0.3)';
      ctx.beginPath();
      ctx.arc(0, 0, bikeW * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  gameLoop = () => {
    if (!this.running) return;

    const now = performance.now();
    this.deltaTime = now - this.lastTime;
    this.lastTime = now;

    // Cap delta time to prevent spiral of death
    if (this.deltaTime > 100) this.deltaTime = 100;

    this.update(this.deltaTime);
    this.render();

    this.frameCount++;

    requestAnimationFrame(this.gameLoop);
  };
}
