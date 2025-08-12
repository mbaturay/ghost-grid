import React, { useEffect, useRef, useState } from "react";
import pSprite2Url from "../images/PSprite2.png";
import gSpriteUrl from "../images/GSprite.png";
import gSprite2Url from "../images/GSprite2.png";
import gSprite3Url from "../images/GSprite3.png";
import gSprite4Url from "../images/GSprite4.png";
import powerUrl from "../images/power.png";

/**
 * Ghost Grid-The Last Pellet — modern appraoch to Pacman and Spy's Demise 
 * (React + dynamic Phaser import).
 * How it works: we import('phaser') inside useEffect, then define the Scene.
 */

// --- Tunables --------------------------------------------------------------
const GAME_W = 960;
const GAME_H = 720;
const FLOORS_START = 12;
//const FLOORS_MIN = 3;
const SHAFT_COUNT = 7;
const FLOOR_MARGIN_X = 48;
const PLAYER_SPEED = 250;
const PLAYER_SPRINT = 480;
// Sprint stamina tank (0..1): consume fast, regen slow
const STAMINA_CONSUME_PER_S = 1.2; // empties in ~0.8s of continuous sprint
const STAMINA_REGEN_PER_S = 0.2;   // fills in ~5s from empty
const CAR_WIDTH = 56;
const CAR_HEIGHT = 56;
const SHAFT_WIDTH = 56;
const FLOOR_THICKNESS = 2;
const PILL_SPACING = 48;
const PILL_RADIUS = 6;
const PILL_Y_OFFSET = 0; // draw pills centered on the floor line
//const PAC_RADIUS = 16; // Pac-Man visual size

// Cryptogram lines (9 visible) + hidden one in code
const CRYPTOGRAM_VISIBLE = [
  "QEB NRFZH YOLTK CLU GRJMP LSBO QEB IXWV ALD.",
  "URYYB JBEYQ! CEBPRFFVAT VZCBFFVOYR BSSRAQVAT.",
  "LORUM IPSUM DOLOR SIT AMET (THIS ONE'S A RINGER)",
  "VJKUBKUBC BOJXRAOBO ZL GRKG VF FRPERG.",
  "KHOOR ZRUOG, ZDLW IRU WKH WRQH!",
  "SPY WORK IS 90% WAITING AND 10% PANIC.",
  "LOOK EAST AT DAWN; THE LIFT SINGS THEN.",
  "DONT TRUST THE TENTH LINE IN CODE.",
  "MEET ME AT THE TOP FLOOR. ASK FOR K."
];
const CRYPTOGRAM_HIDDEN = "CODEWORD: PENGUIN SAYS PLAY FAIR";

// Palettes
const PALETTES = {
  neon: {
    // Custom scheme
    // Background
    bg0: 0x0b0f1a,
    // Grid Lines (also used for floor line color)
    //bg1: 0x00e5ff,
    //floor: 0x00e5ff,
    floor: 0x12233a,
    // Column Shading
    shaft: 0x12233a,
    // Unused / kept for compatibility with any legacy UI effects
    car: 0x55ff99,
    carGlow: 0x9ffff0,
    player: 0xffe066,
    text: "#e6f2ff",
    accent: "#60ffa8"
  },
  tritanopia: {
    // Mirror to custom so switching (if ever re-enabled) looks consistent
    bg0: 0x0b0f1a,
    bg1: 0x00e5ff,
    floor: 0x00e5ff,
    shaft: 0x12233a,
    car: 0x55ff99,
    carGlow: 0x9ffff0,
    player: 0xffe066,
    text: "#e6f2ff",
    accent: "#60ffa8"
  }
};

export default function App() {
  const hostRef = useRef(null);
  const gameRef = useRef(null);
  const topRef = useRef(null);
  const bottomRef = useRef(null);
  const [palette, setPalette] = useState("neon");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [phaserError, setPhaserError] = useState("");
  const [frameH, setFrameH] = useState(null);
  const [frameW, setFrameW] = useState(null);

  // Compute responsive canvas height: fill viewport height while preserving 4:3 within viewport width
  useEffect(() => {
    const recalc = () => {
      const vw = window.innerWidth || document.documentElement.clientWidth || 1024;
      const vh = window.innerHeight || document.documentElement.clientHeight || 768;
      const topH = topRef.current?.offsetHeight ?? 0;
      const botH = bottomRef.current?.offsetHeight ?? 0;
      // Matches .app vertical padding (16 top + 16 bottom) plus a small safety margin
      const verticalPad = 32 + 8;
      // Space available for the game container
      const availableH = Math.max(200, vh - topH - botH - verticalPad);
      // Ensure width doesn't overflow the viewport (leave ~4vw gutters)
      const maxHByWidth = Math.floor((vw - Math.max(24, vw * 0.08)) * 3 / 4);
      const target = Math.max(220, Math.min(availableH, maxHByWidth));
      let targetW = Math.floor(target * (GAME_W / GAME_H)); // 4:3 width
      // Clamp to viewport width minus small gutters
      const maxW = vw - Math.max(24, vw * 0.06);
      if (targetW > maxW) {
        targetW = Math.floor(maxW);
        // If width clamps, recompute height to preserve 4:3
        const newH = Math.floor(targetW * (GAME_H / GAME_W));
        setFrameH(newH);
        setFrameW(targetW);
        return;
      }
  setFrameH(target);
  setFrameW(targetW);
    };
    recalc();
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, []);

  // OS-first Reduced Motion with persistent override
  useEffect(() => {
    const KEY = "gg_reducedMotionOverride"; // 'on' | 'off' | null
    const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'on') setReducedMotion(true);
      else if (saved === 'off') setReducedMotion(false);
      else setReducedMotion(!!mq?.matches);
    } catch {}
    if (mq) {
      const handler = (e) => {
        try {
          const saved = localStorage.getItem(KEY);
          // Only follow OS when no override is set
          if (saved !== 'on' && saved !== 'off') setReducedMotion(!!e.matches);
        } catch {}
      };
      if (mq.addEventListener) mq.addEventListener('change', handler);
      else if (mq.addListener) mq.addListener(handler);
      return () => {
        if (mq.removeEventListener) mq.removeEventListener('change', handler);
        else if (mq.removeListener) mq.removeListener(handler);
      };
    }
  }, []);

  // Set browser tab title
  useEffect(() => {
    document.title = "Ghost Grid: The Last Pellet";
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function boot() {
      if (!hostRef.current) return;

      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }

      let PhaserMod;
      try {
        PhaserMod = await import("phaser");
      } catch (e) {
        if (isMounted) setPhaserError("Failed to load Phaser. Did you run `npm i`?");
        return;
      }
      const Phaser = PhaserMod.default || PhaserMod;
      if (!Phaser || !Phaser.Scene) {
        if (isMounted) setPhaserError("Phaser import empty. Check bundler/node version.");
        return;
      }

      const hexToCss = (hex) => `#${hex.toString(16).padStart(6, "0")}`;

      class GameScene extends Phaser.Scene {
        constructor() { super("GameScene"); }
        level = 1;
        floors = FLOORS_START;
    currentFloorIndex = 0;
  lives = 1;
        paused = false;
        paletteState = PALETTES[palette];
        reducedMotion = reducedMotion;

  player; playerX = FLOOR_MARGIN_X;
  // Continuous movement: persistent direction (-1 left, +1 right, 0 idle until user input)
  moveDir = 0; inputSprint = false; transitioning = false;
  sprintActive = false;
  // Pac-Man mouth animation state
  pacMouthPhase = 0; pacMouthOpen = 0.2;
        shaftsX = []; ghosts = []; pills = [];
  gBackground; gFloors; gShafts; gGuides; gUI;
  stamina = 1;
  staminaIcon;
      levelText;
  // Scoring
  score = 0; highScore = 0; scoreText;
  // Per-lane attempt tracking for "one go" bonus
  laneStartMoveDir = 0; // first direction chosen this lane (-1/0/+1)
  laneSingleGo = true;  // remains true only if no reversal occurs during the lane
  // Cryptogram: number of visible lines unlocked and UI refs
  cryptUnlocked = 0; // 0..CRYPTOGRAM_VISIBLE.length
  _cryptPanel = null; // overlay container when open

        init(data = {}) {
          if (data.palette) this.paletteState = PALETTES[data.palette];
          if (typeof data.reducedMotion === "boolean") this.reducedMotion = data.reducedMotion;
        }
        preload() {
          // Player sprite sheet: 3 frames laid out horizontally, 48x48 each (no gaps)
          this.load.spritesheet('psprite', pSprite2Url, { frameWidth: 48, frameHeight: 48 });
          // Ghost sprite sheets: frames 56x56 with 1px gap between frames (4 color variants)
          this.load.spritesheet('gsprite1', gSpriteUrl, { frameWidth: 56, frameHeight: 56, margin: 0, spacing: 1 });
          this.load.spritesheet('gsprite2', gSprite2Url, { frameWidth: 56, frameHeight: 56, margin: 0, spacing: 1 });
          this.load.spritesheet('gsprite3', gSprite3Url, { frameWidth: 56, frameHeight: 56, margin: 0, spacing: 1 });
          this.load.spritesheet('gsprite4', gSprite4Url, { frameWidth: 56, frameHeight: 56, margin: 0, spacing: 1 });
          // Power icon for stamina HUD
          this.load.image('power', powerUrl);
        }
        create() {
          this.cameras.main.setBackgroundColor(this.paletteState.bg0);
          this.gBackground = this.add.graphics();
          this.gFloors = this.add.graphics();
          this.gShafts = this.add.graphics();
          this.gGuides = this.add.graphics();
          this.gUI = this.add.graphics().setDepth(60);
          // Stamina PNG icon above UI graphics
          this.staminaIcon = this.add.image(0, 0, 'power')
            .setOrigin(0.5)
            .setDepth(61)
            .setScrollFactor(0)
            .setVisible(false)
            .setTint(0x000000);
          this.drawBackground();
          // Load hi-score from storage
          try { const hs = parseInt(localStorage.getItem('gg_highScore') || '0', 10); if (!isNaN(hs)) this.highScore = hs; } catch {}
          // Load cryptogram progress
          try {
            const cu = parseInt(localStorage.getItem('gg_cryptUnlocked') || '0', 10);
            if (!isNaN(cu)) this.cryptUnlocked = Phaser.Math.Clamp(cu, 0, CRYPTOGRAM_VISIBLE.length);
          } catch {}
          // Level label at top-center
          this.levelText = this.add.text(GAME_W / 2, 26, '', {
            fontSize: '22px',
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
            color: '#e6f2ff',
            align: 'center'
          }).setOrigin(0.5).setDepth(62).setScrollFactor(0);
          this.levelText.setStroke('#000000', 3);
          this.updateLevelLabel();
          // Score HUD (top-left)
          this.scoreText = this.add.text(12, 10, '', {
            fontSize: '22px',
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
            color: '#e6f2ff'
          }).setOrigin(0, 0).setDepth(62).setScrollFactor(0);
          this.scoreText.setStroke('#000000', 3);
          this.updateScoreText();
          // Define player animation (loop frames 0-1-2-1 for smooth chomp)
          if (!this.anims.exists('psprite-walk')) {
            this.anims.create({
              key: 'psprite-walk',
              frames: [
                { key: 'psprite', frame: 0 },
                { key: 'psprite', frame: 1 },
                { key: 'psprite', frame: 2 },
                { key: 'psprite', frame: 1 }
              ],
              frameRate: 10,
              repeat: -1
            });
          }
          // Create per-variant ghost animations if they don't exist
          for (const key of ['gsprite1','gsprite2','gsprite3','gsprite4']) {
            const animKey = `${key}-walk`;
            if (!this.anims.exists(animKey)) {
              this.anims.create({
                key: animKey,
                frames: [
                  { key, frame: 0 },
                  { key, frame: 1 },
                  { key, frame: 2 },
                  { key, frame: 1 }
                ],
                frameRate: 8,
                repeat: -1
              });
            }
          }
          this.resetLevel(true);
          this.input.keyboard.on("keydown", (e) => this.onKey(e, true));
          this.input.keyboard.on("keyup", (e) => this.onKey(e, false));
        }
        // Choose ghost sheet based on level: every 3 levels cycle 1->2->3->4->1...
        currentGhostTexKey() {
          const idx = Math.floor((this.level - 1) / 3) % 4; // 0..3
          return ['gsprite1','gsprite2','gsprite3','gsprite4'][idx];
        }
        onKey(e, down) {
          // Reverse-only control: on key down, set direction; key up does not stop motion
          if (!this.transitioning) {
            if (down && (e.code === "ArrowLeft" || e.code === "KeyA")) {
              const dir = -1;
              // Track first direction and detect reversal for one-go bonus
              if (this.laneStartMoveDir === 0) this.laneStartMoveDir = dir; else if (dir !== this.laneStartMoveDir) this.laneSingleGo = false;
              this.moveDir = dir;
            }
            if (down && (e.code === "ArrowRight" || e.code === "KeyD")) {
              const dir = 1;
              if (this.laneStartMoveDir === 0) this.laneStartMoveDir = dir; else if (dir !== this.laneStartMoveDir) this.laneSingleGo = false;
              this.moveDir = dir;
            }
          }
          // Test helpers: change level with < (Comma) / > (Period)
          if (down && (e.code === "Comma" || e.code === "Period")) {
            if (this._gameOverShown) return; // ignore during game over overlay
            if (e.code === "Period") this.gotoLevel(this.level + 1);
            else this.gotoLevel(Math.max(1, this.level - 1));
          }
          if (e.code === "ShiftLeft" || e.code === "ShiftRight") this.inputSprint = down;
          if (down && (e.code === "KeyP" || e.code === "Space")) this.paused = !this.paused;
          // Toggle Cryptogram panel with C; allow Esc to close
          if (down && e.code === 'KeyC') {
            if (this._cryptPanel) this.closeCryptPanel(); else this.openCryptPanel();
          }
          if (down && e.code === 'Escape') {
            if (this._cryptPanel) this.closeCryptPanel();
          }
        }
        // Lane direction helpers: even floors go left→right, odd floors go right→left
        floorDirection(index) { return index % 2 === 0 ? 1 : -1; }
        floorStartX(index) { return this.floorDirection(index) === 1 ? FLOOR_MARGIN_X : (GAME_W - FLOOR_MARGIN_X); }
        floorEndReached(index, x) {
          const dir = this.floorDirection(index);
          const left = FLOOR_MARGIN_X, right = GAME_W - FLOOR_MARGIN_X, eps = 2;
          if (dir === 1) return x >= right - eps;
          return x <= left + eps;
        }

        resetLevel(fresh = false) {
          if (fresh) {
            this.level = 1; this.floors = FLOORS_START; this.lives = 1; this.stamina = 1; this.score = 0; this.updateScoreText?.();
            // Reset cryptogram progress on a fresh game start
            this.cryptUnlocked = 0;
            try { localStorage.removeItem('gg_cryptUnlocked'); } catch {}
          }
          else { this.level += 1; this.floors = FLOORS_START; }
          this.currentFloorIndex = 0; this.transitioning = false;
          this.playerX = this.floorStartX(this.currentFloorIndex);
          // No auto-move; user initiates movement
          this.moveDir = 0; this.sprintActive = false; this.stamina = 1;
          // Start a fresh attempt for first lane
          this.laneStartMoveDir = 0; this.laneSingleGo = true;
          this.shaftsX = [];
          const usableW = GAME_W - FLOOR_MARGIN_X * 2;
          for (let i = 0; i < SHAFT_COUNT; i++) {
            const t = (i + 1) / (SHAFT_COUNT + 1);
            this.shaftsX.push(FLOOR_MARGIN_X + Math.round(usableW * t));
          }
          this.ghosts.forEach(g => g.sprite.destroy());
          this.ghosts = [];
          for (let i = 0; i < SHAFT_COUNT; i++) {
            const x = this.shaftsX[i];
            // Spawn within board bounds: from top lane to bottom lane
            const topBound = this.floorY(this.floors - 1);
            const bottomBound = this.floorY(0);
            const span = Math.max(1, bottomBound - topBound);
            const spawnY = topBound + Math.random() * span;
            const gKey = this.currentGhostTexKey();
            const img = this.add.sprite(x, spawnY, gKey, 1).setDepth(5);
            img.setDisplaySize(CAR_WIDTH, CAR_HEIGHT);
            img.play(`${gKey}-walk`);
            const baseSpeed = 70 + this.level * 15 + i * 5;
            const vy = (Math.random() > 0.5 ? 1 : -1) * baseSpeed;
            const phase = Math.random() * Math.PI * 2;
            this.ghosts.push({ sprite: img, vy, phase });
          }
          // Pills across lanes
          this.pills.forEach(p => p.sprite.destroy());
          this.pills = [];
          this.spawnPills();
          if (this.player) this.player.destroy();
          this.player = this.add.sprite(this.playerX, this.floorY(this.currentFloorIndex), 'psprite', 1)
            .setDepth(10)
            .setOrigin(0.5, 0.5);
          this.player.setDisplaySize(48, 48);
          this.drawStaticGeometry();
          this.updateLevelLabel();
          this.updateScoreText();
        }
  
        makeGhost(x, y, pal) {
          const cont = this.add.container(x, y).setDepth(8);
          const body = this.add.graphics();
          const w = CAR_WIDTH, h = CAR_HEIGHT; const r = 14;
          const color = pal.car;
          body.fillStyle(color, 1);
          // rounded top
          body.fillRoundedRect(-w/2, -h/2, w, h, { tl: r, tr: r, bl: 6, br: 6 });
          // simple eyes
          body.fillStyle(0xffffff, 1);
          body.fillCircle(-6, -4, 3);
          body.fillCircle(6, -4, 3);
          body.fillStyle(0x2b6cff, 1);
          body.fillCircle(-6, -4, 1.5);
          body.fillCircle(6, -4, 1.5);
          cont.add(body);
          // soft glow
          const glow = this.add.rectangle(0, 0, w + 12, h + 12, pal.carGlow, 0.22).setDepth(4);
          cont.add(glow);
          // breathing glow tween
          this.tweens.addCounter({ from: 0, to: 1, duration: 1200, repeat: -1, yoyo: true,
            onUpdate: (tw) => { const v = 0.15 + 0.15 * tw.getValue(); glow.setFillStyle(pal.carGlow, v); }
          });
          return cont;
        }
        spawnPills() {
          for (let fi = 0; fi < this.floors; fi++) {
            const y = this.floorY(fi);
            // Build lane segments between shafts
            const segments = [];
            const leftEdge = FLOOR_MARGIN_X;
            const rightEdge = GAME_W - FLOOR_MARGIN_X;
            const xs = [leftEdge, ...this.shaftsX.map(x => x - SHAFT_WIDTH / 2), ...this.shaftsX.map(x => x + SHAFT_WIDTH / 2), rightEdge].sort((a,b)=>a-b);
            for (let i = 0; i < xs.length - 1; i++) {
              const a = xs[i], b = xs[i+1];
              const len = b - a;
              if (len > PILL_SPACING * 0.6) segments.push([a, b, len]);
            }
            for (const [a,b,len] of segments) {
              // Number of pellets that fit with spacing, at least 1
              const count = Math.max(1, Math.floor((len - PILL_SPACING) / PILL_SPACING) + 1);
              // Center the row: compute total occupied width and start so they’re centered in [a,b]
              const totalWidth = (count - 1) * PILL_SPACING;
              const start = (a + b) / 2 - totalWidth / 2;
              for (let i = 0; i < count; i++) {
                const x = Math.round(start + i * PILL_SPACING);
                const color = 0xffd700; // pellets are gold
                const dot = this.add.circle(x, y + PILL_Y_OFFSET, PILL_RADIUS, color, 1).setDepth(4);
                this.pills.push({ floor: fi, x, sprite: dot, taken: false });
              }
            }
          }
        }
        drawBackground() {
          const g = this.gBackground; g.clear();
          // Background color is set by camera; nothing else needed for now.
        }

        // Draw static floor lines and shaft columns, then guides
        drawStaticGeometry() {
          // Floors
          const gf = this.gFloors; gf.clear();
          gf.lineStyle(FLOOR_THICKNESS, this.paletteState.floor, 1);
          for (let i = 0; i < this.floors; i++) {
            const y = this.floorY(i);
            gf.beginPath();
            gf.moveTo(FLOOR_MARGIN_X, y);
            gf.lineTo(GAME_W - FLOOR_MARGIN_X, y);
            gf.strokePath();
          }
          // Shafts
          const gs = this.gShafts; gs.clear();
          gs.fillStyle(this.paletteState.shaft, 0.2);
          for (const x of this.shaftsX) {
            gs.fillRect(x - SHAFT_WIDTH / 2, 0, SHAFT_WIDTH, GAME_H);
          }
          // Guides
          this.drawGuides();
        }

        // Top-right stamina pie: larger, invisible when empty (no bg/border), with PNG bolt centered
        drawStaminaBar() {
          if (!this.gUI) return;
          const g = this.gUI; g.clear();
          const pad = 12;
          const radius = 16; // a bit bigger
          const cx = GAME_W - pad - radius;
          const cy = pad + radius;
          const fillColor = 0x80d8ff; // cyan fill
          const pct = Phaser.Math.Clamp(this.stamina, 0, 1);
          const start = -Math.PI / 2; // 12 o'clock
          const end = start + pct * Math.PI * 2;
          // Only draw the pie when there is any fill
          if (pct > 0) {
            g.fillStyle(fillColor, 0.95);
            g.beginPath();
            g.moveTo(cx, cy);
            g.arc(cx, cy, radius, start, end, false);
            g.closePath();
            g.fillPath();
            // Center PNG lightning icon, scaled to fit the circle
            if (this.staminaIcon) {
              this.staminaIcon.setVisible(true);
              this.staminaIcon.setPosition(cx, cy);
              // Preserve PNG aspect (10:15). Use intrinsic texture size if available.
              const tex = this.textures.get('power');
              const srcImg = tex && tex.getSourceImage ? tex.getSourceImage() : null;
              const iw = srcImg?.width ?? 10;
              const ih = srcImg?.height ?? 15;
              const heightTarget = Math.round(radius * 1.5); // ~24px for radius 16
              const widthTarget = Math.round(heightTarget * (iw / ih));
              this.staminaIcon.setDisplaySize(widthTarget, heightTarget);
            }
          } else {
            if (this.staminaIcon) this.staminaIcon.setVisible(false);
          }
        }
        updateLevelLabel() {
          if (this.levelText) this.levelText.setText(`LEVEL ${this.level}`);
        }
        drawGuides() {
          // Simple straight vertical guides, matching floor color/thickness.
          const g = this.gGuides; if (!g) return; g.clear();
          const color = this.paletteState.floor;
          const thickness = FLOOR_THICKNESS;

          for (let i = 0; i < this.floors - 1; i++) {
            const x = this.floorStartX(i + 1); // ascent edge for floor i -> i+1
            const y0 = this.floorY(i);
            const y1 = this.floorY(i + 1);
            g.lineStyle(thickness, color, 1);
            g.beginPath();
            g.moveTo(x, y0);
            g.lineTo(x, y1);
            g.strokePath();
          }
        }
        floorY(index) {
          // Add extra top padding so the HUD (level label + stamina) has clear space above the game board
          const topPad = 112, bottomPad = 64; const usable = GAME_H - topPad - bottomPad; const step = usable / (this.floors - 1); return GAME_H - bottomPad - index * step;
        }
  update(time, deltaMS) {
          if (this.paused) return; const dt = deltaMS / 1000;
          // Keep ghosts within the board: from top lane to bottom lane (avoid HUD above top lane)
          const top = this.floorY(this.floors - 1); const bottom = this.floorY(0);
          this.ghosts.forEach((g, i) => { const sprite = g.sprite; let vy = g.vy; if (!this.reducedMotion) { vy += Math.sin((time / 1000) * (0.3 + i * 0.07) + g.phase) * 20; } sprite.y += vy * dt; if (sprite.y < top) { sprite.y = top; g.vy = Math.abs(g.vy); } if (sprite.y > bottom) { sprite.y = bottom; g.vy = -Math.abs(g.vy); } });
          if (!this.transitioning) {
            const y = this.floorY(this.currentFloorIndex);
            // Stamina/sprint: consume when sprinting, regen otherwise (including when empty)
            let sprinting = false;
            // Only allow starting sprint when tank is full; consume fast, regen slow when not sprinting
            if (this.sprintActive) {
              if (this.inputSprint && this.stamina > 0.001) {
                sprinting = true;
                this.stamina = Math.max(0, this.stamina - STAMINA_CONSUME_PER_S * dt);
              } else {
                this.sprintActive = false;
              }
            } else {
              if (this.inputSprint && this.stamina >= 0.999) {
                this.sprintActive = true;
                sprinting = true;
                this.stamina = Math.max(0, this.stamina - STAMINA_CONSUME_PER_S * dt);
              } else {
                this.stamina = Math.min(1, this.stamina + STAMINA_REGEN_PER_S * dt);
              }
            }
            const speed = sprinting ? PLAYER_SPRINT : PLAYER_SPEED;
            if (this.moveDir !== 0) this.playerX += this.moveDir * speed * dt;
            this.playerX = Phaser.Math.Clamp(this.playerX, FLOOR_MARGIN_X, GAME_W - FLOOR_MARGIN_X);
            this.player.setPosition(this.playerX, y);
            // Play/stop sprite animation and face direction
            if (this.player) {
              if (this.moveDir !== 0) {
                if (!this.player.anims.isPlaying || this.player.anims.currentAnim?.key !== 'psprite-walk') {
                  this.player.play('psprite-walk');
                }
                this.player.setFlipX(this.moveDir < 0);
              } else {
                this.player.stop();
                this.player.setFrame(1); // neutral frame
              }
            }
            for (const c of this.ghosts) {
              const isBlocking = Math.abs(c.sprite.y - y) < CAR_HEIGHT * 0.55;
              const left = c.sprite.x - CAR_WIDTH / 2; const right = c.sprite.x + CAR_WIDTH / 2;
              if (isBlocking && this.playerX > left && this.playerX < right) { this.onHit(); return; }
            }
            // Collect pills on current floor
            for (const p of this.pills) {
              if (p.taken || p.floor !== this.currentFloorIndex) continue;
              if (Math.abs(p.x - this.playerX) <= PILL_RADIUS + 8) {
                p.taken = true; p.sprite.destroy();
                this.addScore(10);
              }
            }
            if (this.floorEndReached(this.currentFloorIndex, this.playerX)) { this.startElevation(); }
          }
          // UI refresh
          this.drawStaminaBar();
    this.updateLevelLabel();
        }
        startElevation() {
          if (this.transitioning) return;
          const nextIndex = this.currentFloorIndex + 1;
          if (nextIndex >= this.floors) { this.onLevelComplete(); return; }
          // Lane completion bonuses
          this.addScore(this.level * 10); // per-lane bonus
          if (this.laneSingleGo) this.addScore(this.level * 100); // one-go bonus
          this.transitioning = true;
          const fromY = this.floorY(this.currentFloorIndex);
          const toY = this.floorY(nextIndex);
          // Lock player X to the edge for the next floor for a crisp vertical move
          this.playerX = this.floorStartX(nextIndex);
          const lineX = this.playerX;
          this.player.setPosition(this.playerX, fromY);
          const g = this.add.graphics().setDepth(9);
          const drawLine = (py) => {
            g.clear(); g.fillStyle(this.paletteState.floor, 0.35);
            const top = Math.min(py, toY); const bottom = Math.max(py, fromY);
            g.fillRect(lineX - 2, top, 4, bottom - top);
          };
          drawLine(fromY);
          this.tweens.add({
            targets: this.player,
            y: toY,
            duration: this.reducedMotion ? 120 : 420,
            ease: this.reducedMotion ? 'Linear' : 'Sine.easeInOut',
            onUpdate: () => drawLine(this.player.y),
            onComplete: () => {
              g.destroy();
              this.currentFloorIndex = nextIndex;
              this.playerX = this.floorStartX(this.currentFloorIndex);
              // Do not auto-move; user chooses direction
              this.moveDir = 0;
              this.player.setPosition(this.playerX, toY);
              // Face the direction of travel for the new floor
              const dir = this.floorDirection(this.currentFloorIndex);
              this.player.setFlipX(dir < 0);
              this.flashFloor(this.currentFloorIndex);
              this.transitioning = false;
        // New lane attempt starts now
        this.laneStartMoveDir = 0; this.laneSingleGo = true;
            }
          });
        }
        onHit() {
          this.lives -= 1; this.cameras.main.shake(120, 0.004); this.flashRed();
          if (this.lives <= 0) { this.gameOver(); return; }
          // Reset to this floor's starting edge; no auto-move
          this.playerX = this.floorStartX(this.currentFloorIndex);
      this.moveDir = 0;
      // Restart attempt on this lane (one-go resets)
      this.laneStartMoveDir = 0; this.laneSingleGo = true;
        }
        onLevelComplete() {
          // No code/panel: flash and immediately start the next level from floor 1
          this.cameras.main.flash(200, 128, 216, 255);
          // Unlock next cryptogram line every 3 levels only
          if (this.level % 3 === 0) this.unlockCryptLine();
          this.resetLevel(false);
        }
        unlockCryptLine() {
          if (this.cryptUnlocked < CRYPTOGRAM_VISIBLE.length) {
            const idx = this.cryptUnlocked;
            this.cryptUnlocked += 1;
            try { localStorage.setItem('gg_cryptUnlocked', String(this.cryptUnlocked)); } catch {}
            this.showCryptToast(idx);
          }
        }
        showCryptToast(lineIndex) {
          // Non-blocking toast under the HUD that auto-fades
          const text = CRYPTOGRAM_VISIBLE[lineIndex] || '';
          const container = this.add.container(GAME_W / 2, 64).setDepth(200);
          const padX = 16, padY = 8;
          const label = this.add.text(0, 0, `Cryptogram +1: ${text}`, {
            fontSize: '18px',
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
            color: '#e6f2ff',
            align: 'center',
            wordWrap: { width: GAME_W - 160 }
          }).setOrigin(0.5);
          const bgW = Math.min(GAME_W - 80, label.width + padX * 2);
          const bgH = label.height + padY * 2;
          const bg = this.add.rectangle(0, 0, bgW, bgH, 0x102033, 0.9).setStrokeStyle(2, 0x80d8ff, 0.7).setOrigin(0.5);
          container.add([bg, label]);
          container.setAlpha(0);
          this.tweens.add({ targets: container, alpha: 1, duration: 200, ease: 'Sine.easeOut' });
          this.time.delayedCall(3200, () => {
            this.tweens.add({ targets: container, alpha: 0, duration: 250, onComplete: () => container.destroy() });
          });
        }
        openCryptPanel() {
          if (this._cryptPanel) return;
          const overlay = this.add.container(GAME_W / 2, GAME_H / 2).setDepth(5000);
          // Subtle panel without global dim so gameplay remains visible/non-blocking
          const panelW = 760;
          const maxH = 420;
          const panel = this.add.rectangle(0, 0, panelW, maxH, 0x0f172a, 0.95).setStrokeStyle(3, 0x80d8ff, 0.7).setOrigin(0.5);
          const title = this.add.text(0, -maxH / 2 + 24, 'Cryptogram', {
            fontSize: '22px',
            fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
            color: '#e6f2ff'
          }).setOrigin(0.5, 0);
          const lines = CRYPTOGRAM_VISIBLE.slice(0, this.cryptUnlocked);
          const bodyText = lines.length ? lines.map((t, i) => `${String(i + 1).padStart(2, '0')}. ${t}`).join('\n') : 'No lines unlocked yet. Clear levels to reveal clues!';
          const body = this.add.text(-panelW / 2 + 24, -maxH / 2 + 60, bodyText, {
            fontSize: '18px',
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
            color: '#e6f2ff',
            wordWrap: { width: panelW - 48 }
          }).setOrigin(0, 0);
          const hint = this.add.text(0, maxH / 2 - 28, 'Press C or Esc to close', {
            fontSize: '14px', fontFamily: "ui-sans-serif, system-ui", color: '#a7c7ff'
          }).setOrigin(0.5, 1);
          overlay.add([panel, title, body, hint]);
          overlay.setScale(0.96); overlay.setAlpha(0);
          this.tweens.add({ targets: overlay, alpha: 1, scale: 1, duration: 160, ease: 'Sine.easeOut' });
          this._cryptPanel = overlay;
        }
        closeCryptPanel() {
          const overlay = this._cryptPanel; if (!overlay) return;
          this._cryptPanel = null;
          this.tweens.add({ targets: overlay, alpha: 0, scale: 0.98, duration: 120, ease: 'Sine.easeIn', onComplete: () => overlay.destroy() });
        }
        gotoLevel(targetLevel) {
          this.level = Math.max(1, Math.floor(targetLevel));
          this.floors = FLOORS_START;
          this.currentFloorIndex = 0; this.transitioning = false;
          this.playerX = this.floorStartX(this.currentFloorIndex);
          // No auto-move; user initiates movement
          this.moveDir = 0;
          // Fresh attempt on new level's first lane
          this.laneStartMoveDir = 0; this.laneSingleGo = true;
          // Rebuild shafts positions
          this.shaftsX = [];
          const usableW = GAME_W - FLOOR_MARGIN_X * 2;
          for (let i = 0; i < SHAFT_COUNT; i++) {
            const t = (i + 1) / (SHAFT_COUNT + 1);
            this.shaftsX.push(FLOOR_MARGIN_X + Math.round(usableW * t));
          }
          // Rebuild ghosts
          this.ghosts.forEach(g => g.sprite.destroy());
          this.ghosts = [];
          for (let i = 0; i < SHAFT_COUNT; i++) {
            const x = this.shaftsX[i];
            // Spawn within board bounds: from top lane to bottom lane
            const topBound = this.floorY(this.floors - 1);
            const bottomBound = this.floorY(0);
            const span = Math.max(1, bottomBound - topBound);
            const spawnY = topBound + Math.random() * span;
            const gKey = this.currentGhostTexKey();
            const img = this.add.sprite(x, spawnY, gKey, 1).setDepth(5);
            img.setDisplaySize(CAR_WIDTH, CAR_HEIGHT);
            img.play(`${gKey}-walk`);
            const baseSpeed = 70 + this.level * 15 + i * 5;
            const vy = (Math.random() > 0.5 ? 1 : -1) * baseSpeed;
            const phase = Math.random() * Math.PI * 2;
            this.ghosts.push({ sprite: img, vy, phase });
          }
          // Rebuild pills
          this.pills.forEach(p => p.sprite.destroy());
          this.pills = [];
          this.spawnPills();
          // Rebuild player
          if (this.player) this.player.destroy();
          this.player = this.add.sprite(this.playerX, this.floorY(this.currentFloorIndex), 'psprite', 1)
            .setDepth(10)
            .setOrigin(0.5, 0.5);
          this.player.setDisplaySize(48, 48);
          // Redraw static geometry and level label
          this.drawStaticGeometry();
          this.updateScoreText();
        }
        // --- Scoring helpers ---
        addScore(pts) {
          if (!pts) return;
          this.score = Math.max(0, Math.floor(this.score + pts));
          if (this.score > this.highScore) {
            this.highScore = this.score;
            try { localStorage.setItem('gg_highScore', String(this.highScore)); } catch {}
          }
          this.updateScoreText();
        }
        updateScoreText() {
          if (!this.scoreText) return;
          const clamp6 = (n) => Math.max(0, Math.min(999999, Math.floor(n)));
          const fmt6 = (n) => String(clamp6(n)).padStart(6, '0');
          this.scoreText.setText(`SCORE ${fmt6(this.score)}   HI ${fmt6(this.highScore)}`);
        }
        gameOver() {
          if (this._gameOverShown) return;
          this._gameOverShown = true;
          // Stop gameplay via our own flag so rendering/input keep working
          this.paused = true;
          // High-contrast overlay with dim background, title and options
          const overlay = this.add.container(GAME_W / 2, GAME_H / 2).setDepth(10000);
          const dim = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.6).setOrigin(0.5);
          // Capture clicks on the dim to avoid underlying interactions
          dim.setInteractive(new Phaser.Geom.Rectangle(-GAME_W/2, -GAME_H/2, GAME_W, GAME_H), Phaser.Geom.Rectangle.Contains);
          const panel = this.add.rectangle(0, 0, 720, 360, 0x220a0a, 0.94)
            .setStrokeStyle(3, 0xff4d4d, 0.9)
            .setOrigin(0.5);
          const title = this.add.text(0, 0, "GAME OVER", {
            fontSize: "84px",
            fontFamily: "'Bangers', 'Permanent Marker', cursive",
            color: "#ffffff",
            align: "center"
          }).setOrigin(0.5);
          title.setStroke('#ff4d4d', 6).setShadow(0, 3, '#000000', 8, false, true);
          const hint = this.add.text(0, 0, "R - Retry     Q - Quit", {
            fontSize: "26px",
            fontFamily: "'Bangers','Permanent Marker', cursive",
            color: "#ffecec"
          }).setOrigin(0.5);
          // Center the two lines vertically within the panel
          const spacing = 16;
          const h1 = title.height;
          const h2 = hint.height;
          const total = h1 + spacing + h2;
          title.setY(-total / 2 + h1 / 2);
          hint.setY(title.y + h1 / 2 + spacing + h2 / 2);
          overlay.add([dim, panel, title, hint]);

          // Keyboard shortcuts only: Retry (R), Quit (Q)
          const kb = this.input.keyboard;
          const closeOverlay = () => {
            // Cleanup keyboard listener and overlay
            kb.off('keydown', onKeyDown);
            overlay.destroy();
            this._gameOverShown = false; this.paused = false;
          };
          const doRetry = () => { closeOverlay(); this.resetLevel(true); };
          const doQuit = () => {
            // Show a simple DOM overlay, then destroy the Phaser game to stop everything
            try {
              const canvas = this.game?.canvas;
              const parent = canvas?.parentNode;
              if (parent) {
                const msg = document.createElement('div');
                msg.style.position = 'absolute';
                msg.style.left = '0';
                msg.style.top = '0';
                msg.style.width = '100%';
                msg.style.height = '100%';
                msg.style.display = 'flex';
                msg.style.flexDirection = 'column';
                msg.style.alignItems = 'center';
                msg.style.justifyContent = 'center';
                msg.style.background = 'rgba(0,0,0,0.85)';
                msg.style.zIndex = '99999';
                msg.style.color = '#ffecec';
                msg.style.textAlign = 'center';
                msg.style.fontFamily = "'Permanent Marker', cursive";
                  msg.innerHTML = `<div style="font-size:72px;color:#ff4d4d;text-shadow:0 3px 8px rgba(0,0,0,.6);">Thanks for playing!</div><div style="font-size:22px;margin-top:12px;color:#e6f2ff;">if you want to go again, just refresh the page</div>`;
                parent.style.position = 'relative';
                parent.appendChild(msg);
              }
            } catch {}
            try { this.game.destroy(true); } catch {}
          };
          const onKeyDown = (e) => {
            if (e.code === 'KeyR') doRetry();
            else if (e.code === 'KeyQ') doQuit();
          };
          kb.on('keydown', onKeyDown);
          // No on-screen buttons; hint above indicates keys
        }
        makeButton(x, y, label, onClick, style = {}) {
          const fillColor = style.fillColor ?? 0x80d8ff;
          const strokeColor = style.strokeColor ?? 0x80d8ff;
          const textColor = style.textColor ?? "#e6f2ff";
          const fillAlpha = style.fillAlpha ?? 0.12;
          const hoverFillAlpha = style.hoverFillAlpha ?? 0.22;
          const strokeAlpha = style.strokeAlpha ?? 0.65;

          const btn = this.add.container(x, y).setDepth(105);
          const r = this.add.rectangle(0, 0, 200, 52, fillColor, fillAlpha)
            .setStrokeStyle(2, strokeColor, strokeAlpha)
            .setOrigin(0.5);
          const t = this.add.text(0, 0, label, { fontSize: "18px", fontFamily: "ui-sans-serif, system-ui", color: textColor }).setOrigin(0.5);
          btn.add([r, t]); btn.setSize(200, 52);
          btn.setInteractive(new Phaser.Geom.Rectangle(-100, -26, 200, 52), Phaser.Geom.Rectangle.Contains);
          btn.on("pointerover", () => r.setFillStyle(fillColor, hoverFillAlpha));
          btn.on("pointerout", () => r.setFillStyle(fillColor, fillAlpha));
          btn.on("pointerdown", () => onClick());
          return btn;
        }
        flashRed() { const cam = this.cameras.main; cam.flash(100, 255, 50, 50); }
        flashFloor(floorIndex) {
          const y = this.floorY(floorIndex); const g = this.add.graphics({ x: 0, y: 0 }).setDepth(20);
          g.lineStyle(FLOOR_THICKNESS + 6, 0x9ffff0, 0.5); g.strokeRoundedRect(FLOOR_MARGIN_X - 8, y - (FLOOR_THICKNESS + 6) / 2, GAME_W - FLOOR_MARGIN_X * 2 + 16, FLOOR_THICKNESS + 6, 3);
          this.tweens.add({ targets: g, alpha: 0, duration: 350, onComplete: () => g.destroy() });
        }
      }

      const config = {
        type: Phaser.CANVAS,
        parent: hostRef.current,
        backgroundColor: "#000000",
        fps: { target: 60, forceSetTimeOut: true },
        // Make the game responsive while preserving aspect ratio using Phaser Scale Manager
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: GAME_W,
          height: GAME_H
        },
        scene: [GameScene]
      };

      const game = new Phaser.Game(config);
      game.scene.start("GameScene", { palette, reducedMotion });
      gameRef.current = game;
    }

    boot();
    return () => { isMounted = false; if (gameRef.current) { gameRef.current.destroy(true); gameRef.current = null; } };
  }, [palette, reducedMotion]);

  return (
    <div className="app">
      <div className="controls" ref={topRef}>
        <h1>Ghost Grid: The Last Pellet</h1>
        {/* <small className="hint">(React + Phaser)</small> */}
      </div>
      {phaserError && <div className="bad">{phaserError}</div>}
      <div
        ref={hostRef}
        className="canvas-frame"
        style={{
          height: frameH ? `${frameH}px` : undefined,
          width: frameW ? `${frameW}px` : undefined,
          background: "linear-gradient(180deg,#0a0c12,#0f1320)"
        }}
      />
      <div className="controls" ref={bottomRef} style={{ marginTop: 12 }}>
{/*         <label className="checkbox">
          <input
            type="checkbox"
            checked={reducedMotion}
            onChange={(e) => {
              const checked = e.target.checked;
              setReducedMotion(checked);
              const KEY = "gg_reducedMotionOverride";
              const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
              const osPref = !!mq?.matches;
              try {
                // If user choice equals OS, clear override; else persist override
                if (checked === osPref) localStorage.removeItem(KEY);
                else localStorage.setItem(KEY, checked ? 'on' : 'off');
              } catch {}
            }}
          />
          Reduced motion
        </label> */}
  <small className="hint">Controls: tap ← or → to set direction; tap opposite to reverse; hold Shift to sprint; Space/P to pause; C to view Cryptogram</small>
      </div>
    </div>
  );
}
