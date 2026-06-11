/* ═══════════════════════════════════════════════════════════════
   Highway Dash — script.js
   A complete HTML5 Canvas arcade car racing game.
   Modules: UI, Audio, Particles, Road, Player, Traffic,
            Pickups, Game, MobileCtrl, Achievements, Skins
═══════════════════════════════════════════════════════════════ */

'use strict';

/* ──────────────────────────────────────────────────────────────
   UTILITY HELPERS
────────────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand  = (lo, hi)    => lo + Math.random() * (hi - lo);
const randInt = (lo, hi)  => Math.floor(rand(lo, hi + 1));
const choose  = arr => arr[randInt(0, arr.length - 1)];

/* ──────────────────────────────────────────────────────────────
   SAVE / LOAD  (localStorage wrapper)
────────────────────────────────────────────────────────────── */
const Save = {
  _data: null,
  _defaults: {
    bestScore: 0,
    totalCoins: 0,
    musicOn: true,
    sfxOn: true,
    difficulty: 'normal',
    skinIndex: 0,
    achievements: {}
  },
  load() {
    try {
      const raw = localStorage.getItem('highwayDash');
      this._data = raw ? { ...this._defaults, ...JSON.parse(raw) } : { ...this._defaults };
    } catch { this._data = { ...this._defaults }; }
  },
  save() {
    try { localStorage.setItem('highwayDash', JSON.stringify(this._data)); } catch {}
  },
  get(k)    { return this._data[k]; },
  set(k, v) { this._data[k] = v; this.save(); }
};
Save.load();

/* ──────────────────────────────────────────────────────────────
   UI  – screen transitions & menu stat updates
────────────────────────────────────────────────────────────── */
const UI = {
  current: 'mainMenu',
  showScreen(id) {
    document.querySelectorAll('.screen.active').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
    this.current = id;
    if (id === 'mainMenu')         this.refreshMenu();
    if (id === 'achievementsScreen') Achievements.render();
    Audio.playClick();
  },
  refreshMenu() {
    $('menuBestScore').textContent = Save.get('bestScore');
    $('menuCoins').textContent     = Save.get('totalCoins');
  }
};

/* ──────────────────────────────────────────────────────────────
   AUDIO  – Web Audio API procedural sounds
   (No external files needed; pure synthesis)
────────────────────────────────────────────────────────────── */
const Audio = {
  ctx: null,
  engineNode: null,
  engineGain: null,
  musicNodes: [],
  _musicOn: Save.get('musicOn'),
  _sfxOn:   Save.get('sfxOn'),

  _ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  playClick() {
    if (!this._sfxOn) return;
    this._ensure();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.connect(g); g.connect(this.ctx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(.15, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, this.ctx.currentTime + .08);
    o.start(); o.stop(this.ctx.currentTime + .08);
  },

  playCrash() {
    if (!this._sfxOn) return;
    this._ensure();
    const bufLen = this.ctx.sampleRate * .6;
    const buf    = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(.6, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, this.ctx.currentTime + .6);
    src.connect(g); g.connect(this.ctx.destination);
    src.start();
  },

  playCoin() {
    if (!this._sfxOn) return;
    this._ensure();
    [880, 1320].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(.12, this.ctx.currentTime + i * .07);
      g.gain.exponentialRampToValueAtTime(.001, this.ctx.currentTime + i * .07 + .15);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(this.ctx.currentTime + i * .07);
      o.stop(this.ctx.currentTime + i * .07 + .15);
    });
  },

  playNitro() {
    if (!this._sfxOn) return;
    this._ensure();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(80, this.ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + .3);
    g.gain.setValueAtTime(.2, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, this.ctx.currentTime + .3);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + .3);
  },

  startEngine() {
    if (!this._musicOn) return;
    this._ensure();
    if (this.engineNode) return;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = .04;
    this.engineGain.connect(this.ctx.destination);
    this.engineNode = this.ctx.createOscillator();
    this.engineNode.type = 'sawtooth';
    this.engineNode.frequency.value = 55;
    this.engineNode.connect(this.engineGain);
    this.engineNode.start();
  },

  setEngineRPM(speed) { // speed 0-1
    if (!this.engineNode) return;
    this.engineNode.frequency.value = 55 + speed * 120;
    this.engineGain.gain.value      = .03 + speed * .04;
  },

  stopEngine() {
    if (!this.engineNode) return;
    try { this.engineNode.stop(); } catch {}
    this.engineNode = null;
  },

  toggleMusic() {
    this._musicOn = !this._musicOn;
    Save.set('musicOn', this._musicOn);
    $('toggleMusic').textContent = this._musicOn ? 'ON' : 'OFF';
    $('toggleMusic').classList.toggle('off', !this._musicOn);
    if (!this._musicOn) this.stopEngine();
  },

  toggleSFX() {
    this._sfxOn = !this._sfxOn;
    Save.set('sfxOn', this._sfxOn);
    $('toggleSFX').textContent = this._sfxOn ? 'ON' : 'OFF';
    $('toggleSFX').classList.toggle('off', !this._sfxOn);
  },

  initUI() {
    $('toggleMusic').textContent = this._musicOn ? 'ON' : 'OFF';
    $('toggleMusic').classList.toggle('off', !this._musicOn);
    $('toggleSFX').textContent   = this._sfxOn ? 'ON' : 'OFF';
    $('toggleSFX').classList.toggle('off', !this._sfxOn);
  }
};

/* ──────────────────────────────────────────────────────────────
   SKINS  – player car colour palettes
────────────────────────────────────────────────────────────── */
const Skins = {
  list: [
    { label:'🔴', body:'#e53935', roof:'#b71c1c', window:'#90caf9' },
    { label:'🔵', body:'#1e88e5', roof:'#0d47a1', window:'#b3e5fc' },
    { label:'🟢', body:'#43a047', roof:'#1b5e20', window:'#c8e6c9' },
    { label:'🟡', body:'#fdd835', roof:'#f57f17', window:'#e1f5fe' },
    { label:'🟣', body:'#8e24aa', roof:'#4a148c', window:'#e1bee7' },
    { label:'⬛', body:'#37474f', roof:'#000000', window:'#b0bec5' },
  ],
  current: 0,
  init() {
    this.current = Save.get('skinIndex') || 0;
    const wrap = $('skinBtns');
    wrap.innerHTML = '';
    this.list.forEach((s, i) => {
      const b = document.createElement('button');
      b.className = 'skin-btn' + (i === this.current ? ' active' : '');
      b.textContent = s.label;
      b.onclick = () => this.select(i);
      wrap.appendChild(b);
    });
  },
  select(i) {
    this.current = i;
    Save.set('skinIndex', i);
    document.querySelectorAll('.skin-btn').forEach((b, j) => b.classList.toggle('active', j === i));
  },
  get() { return this.list[this.current]; }
};

/* ──────────────────────────────────────────────────────────────
   ACHIEVEMENTS
────────────────────────────────────────────────────────────── */
const Achievements = {
  list: [
    { id:'first_run',    icon:'🏁', name:'First Race',        desc:'Complete your first run',             check: s => s.score > 0 },
    { id:'score_1000',   icon:'🎯', name:'Score 1000',         desc:'Reach a score of 1000',               check: s => s.score >= 1000 },
    { id:'score_5000',   icon:'⭐', name:'Score 5000',          desc:'Reach a score of 5000',               check: s => s.score >= 5000 },
    { id:'coin_50',      icon:'🪙', name:'Coin Hoarder',        desc:'Collect 50 coins in one run',         check: s => s.runCoins >= 50 },
    { id:'survive_60',   icon:'⏱️', name:'Survivor',            desc:'Survive for 60 seconds',              check: s => s.time >= 60 },
    { id:'survive_120',  icon:'🕐', name:'Endurance',           desc:'Survive for 2 minutes',              check: s => s.time >= 120 },
    { id:'nitro_5',      icon:'🔥', name:'Nitro Junkie',        desc:'Use nitro 5 times in one run',        check: s => s.nitroUses >= 5 },
    { id:'level_3',      icon:'🏆', name:'Level 3 Reached',     desc:'Reach Level 3',                       check: s => s.level >= 3 },
    { id:'coin_total_100',icon:'💰',name:'Rich Driver',         desc:'Collect 100 coins total (all time)',  check: s => Save.get('totalCoins') >= 100 },
  ],
  _unlocked: {},
  _newThisRun: [],

  load() {
    this._unlocked = Save.get('achievements') || {};
  },

  checkAll(stats) {
    this._newThisRun = [];
    this.list.forEach(a => {
      if (!this._unlocked[a.id] && a.check(stats)) {
        this._unlocked[a.id] = true;
        this._newThisRun.push(a);
        Save.set('achievements', this._unlocked);
        this._showToast(a);
      }
    });
  },

  _showToast(a) {
    const el = $('achToast');
    el.textContent = `🏆 Unlocked: ${a.name}`;
    el.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
  },

  render() {
    const wrap = $('achievementList');
    wrap.innerHTML = '';
    this.list.forEach(a => {
      const locked = !this._unlocked[a.id];
      const div = document.createElement('div');
      div.className = 'ach-item' + (locked ? '' : ' unlocked');
      div.innerHTML = `
        <div class="ach-icon">${a.icon}</div>
        <div class="ach-info">
          <div class="ach-name">${a.name}</div>
          <div class="ach-desc">${a.desc}</div>
        </div>
        <div class="ach-badge">${locked ? 'LOCKED' : 'DONE'}</div>`;
      wrap.appendChild(div);
    });
  }
};
Achievements.load();

/* ──────────────────────────────────────────────────────────────
   PARTICLE SYSTEM
────────────────────────────────────────────────────────────── */
class Particle {
  constructor(x, y, vx, vy, color, life, size, gravity = 0) {
    Object.assign(this, { x, y, vx, vy, color, life, maxLife: life, size, gravity });
  }
  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.vy += this.gravity * dt;
    this.life -= dt;
  }
  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  get alive() { return this.life > 0; }
}

const Particles = {
  pool: [],
  add(p) { this.pool.push(p); },
  update(dt) { this.pool = this.pool.filter(p => { p.update(dt); return p.alive; }); },
  draw(ctx)  { this.pool.forEach(p => p.draw(ctx)); },
  clear()    { this.pool = []; },

  crash(x, y) {
    const colors = ['#ff4d00','#ff8c00','#ffd700','#fff','#e53935'];
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(100, 500);
      this.add(new Particle(x, y,
        Math.cos(angle) * speed, Math.sin(angle) * speed,
        choose(colors), rand(.4, 1), rand(3, 10), 300));
    }
  },

  smoke(x, y, speed) {
    if (Math.random() > .3) return;
    const grey = `hsl(0,0%,${randInt(60,90)}%)`;
    this.add(new Particle(x, y, rand(-20, 20), rand(-40, -80) + speed * .5,
      grey, rand(.3, .7), rand(4, 10), -60));
  },

  coin(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      this.add(new Particle(x, y,
        Math.cos(a) * rand(50,150), Math.sin(a) * rand(50,150),
        '#ffd700', rand(.3,.6), rand(3,6), 200));
    }
  },

  nitroTrail(x, y) {
    const colors = ['#7b2fff','#c084fc','#00e5ff'];
    this.add(new Particle(x, y, rand(-30,30), rand(60,180),
      choose(colors), rand(.2,.5), rand(4,9), 0));
  }
};

/* ──────────────────────────────────────────────────────────────
   ROAD RENDERER
────────────────────────────────────────────────────────────── */
const Road = {
  // Road config (set in resize)
  x: 0, w: 0, lanes: 4,
  laneW: 0,
  scrollY: 0, scrollSpeed: 400,
  markLen: 60, markGap: 40,

  // Scenery items (trees / mountains)
  scenery: [],

  init(cw, ch) {
    this.w = Math.min(cw * .7, 380);
    this.x = (cw - this.w) / 2;
    this.laneW = this.w / this.lanes;
    this._initScenery(cw, ch);
  },

  _initScenery(cw, ch) {
    this.scenery = [];
    // Trees left
    for (let i = 0; i < 10; i++)
      this.scenery.push({ side:'L', y: i * (ch / 8), x: rand(10, this.x - 30) });
    // Trees right
    for (let i = 0; i < 10; i++)
      this.scenery.push({ side:'R', y: i * (ch / 8), x: rand(this.x + this.w + 10, cw - 10) });
  },

  update(dt, speed) {
    this.scrollY  = (this.scrollY + speed * dt) % (this.markLen + this.markGap);
    const pace    = speed * dt;
    this.scenery.forEach(s => {
      s.y += pace;
      if (s.y > Road._screenH + 80) s.y -= Road._screenH + 160;
    });
  },
  _screenH: 0,

  draw(ctx, cw, ch) {
    this._screenH = ch;
    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, ch * .55);
    sky.addColorStop(0,   '#0d1b3e');
    sky.addColorStop(.5,  '#1a237e');
    sky.addColorStop(1,   '#283593');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, cw, ch);

    // Mountains
    this._drawMountains(ctx, cw, ch);

    // Ground
    ctx.fillStyle = '#2e7d32';
    ctx.fillRect(0, ch * .45, cw, ch);

    // Road surface
    ctx.fillStyle = '#424242';
    ctx.fillRect(this.x, 0, this.w, ch);

    // Road shoulder lines
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(this.x, 0); ctx.lineTo(this.x, ch); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(this.x + this.w, 0); ctx.lineTo(this.x + this.w, ch); ctx.stroke();

    // Lane dashes
    ctx.setLineDash([this.markLen, this.markGap]);
    ctx.lineDashOffset = -this.scrollY;
    ctx.strokeStyle = '#fff8'; ctx.lineWidth = 2;
    for (let l = 1; l < this.lanes; l++) {
      const lx = this.x + l * this.laneW;
      ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, ch); ctx.stroke();
    }
    ctx.setLineDash([]);

    // Scenery
    this.scenery.forEach(s => this._drawTree(ctx, s.x, s.y));
  },

  _drawMountains(ctx, cw, ch) {
    const hy = ch * .48;
    ctx.fillStyle = '#1a237e';
    ctx.beginPath(); ctx.moveTo(0, hy);
    const peaks = [0, cw * .15, cw * .32, cw * .5, cw * .68, cw * .82, cw];
    peaks.forEach((px, i) => {
      if (i % 2 === 0) ctx.lineTo(px, hy);
      else             ctx.lineTo(px, hy - rand(50, 120));
    });
    ctx.lineTo(cw, hy); ctx.closePath(); ctx.fill();

    ctx.fillStyle = '#283593';
    ctx.beginPath(); ctx.moveTo(0, hy + 20);
    const peaks2 = [0, cw * .2, cw * .4, cw * .6, cw * .8, cw];
    peaks2.forEach((px, i) => {
      if (i % 2 === 0) ctx.lineTo(px, hy + 20);
      else             ctx.lineTo(px, hy - rand(30, 80));
    });
    ctx.lineTo(cw, hy + 20); ctx.closePath(); ctx.fill();
  },

  _drawTree(ctx, x, y) {
    ctx.fillStyle = '#4a2c2a';
    ctx.fillRect(x - 4, y - 10, 8, 20);
    ctx.fillStyle = '#2e7d32';
    ctx.beginPath(); ctx.arc(x, y - 20, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#388e3c';
    ctx.beginPath(); ctx.arc(x - 5, y - 24, 10, 0, Math.PI * 2); ctx.fill();
  },

  laneCenter(l) { return this.x + (l + .5) * this.laneW; },
  get leftEdge()  { return this.x + 6; },
  get rightEdge() { return this.x + this.w - 6; }
};

/* ──────────────────────────────────────────────────────────────
   CAR DRAWING  – canvas SVG-style shapes
────────────────────────────────────────────────────────────── */
function drawCar(ctx, x, y, w, h, skin, isPlayer = false, crashed = false, nitroActive = false) {
  ctx.save();
  ctx.translate(x, y);

  if (crashed) {
    ctx.rotate(Math.sin(Date.now() / 60) * .2);
    ctx.globalAlpha = .8 + .2 * Math.sin(Date.now() / 30);
  }

  const hw = w / 2, hh = h / 2;

  // Nitro glow
  if (nitroActive && isPlayer) {
    ctx.shadowColor   = '#7b2fff';
    ctx.shadowBlur    = 30;
  }

  // Car body
  ctx.fillStyle = skin.body;
  ctx.beginPath();
  ctx.roundRect(-hw, -hh, w, h, [6, 6, 8, 8]);
  ctx.fill();

  // Roof / cabin
  ctx.fillStyle = skin.roof;
  const rw = w * .68, rh = h * .42;
  ctx.beginPath();
  ctx.roundRect(-rw / 2, -hh + h * .12, rw, rh, 5);
  ctx.fill();

  // Windshield
  ctx.fillStyle = skin.window;
  ctx.globalAlpha = .75;
  ctx.beginPath();
  ctx.roundRect(-rw / 2 + 4, -hh + h * .14, rw - 8, rh * .52, 4);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Rear window
  ctx.fillStyle = skin.window;
  ctx.globalAlpha = .6;
  ctx.beginPath();
  ctx.roundRect(-rw / 2 + 5, -hh + h * .14 + rh * .54, rw - 10, rh * .38, 3);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Headlights (player) or taillights (traffic)
  if (isPlayer) {
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#fffbe6'; ctx.shadowBlur = 12;
    ctx.fillRect(-hw + 3, -hh + 2, 8, 5);
    ctx.fillRect(hw - 11, -hh + 2, 8, 5);
  } else {
    ctx.fillStyle = '#ff1744';
    ctx.shadowColor = '#ff1744'; ctx.shadowBlur = 8;
    ctx.fillRect(-hw + 3, hh - 7, 8, 5);
    ctx.fillRect(hw - 11, hh - 7, 8, 5);
  }
  ctx.shadowBlur = 0;

  // Wheels
  ctx.fillStyle = '#212121';
  const wy = h * .28;
  [[-hw - 3, -wy], [hw - 5, -wy], [-hw - 3, wy - 8], [hw - 5, wy - 8]].forEach(([wx, wyy]) => {
    ctx.fillRect(wx, wyy, 8, 12);
  });
  ctx.fillStyle = '#616161';
  [[-hw - 1, -wy + 2], [hw - 3, -wy + 2], [-hw - 1, wy - 6], [hw - 3, wy - 6]].forEach(([wx, wyy]) => {
    ctx.fillRect(wx, wyy, 4, 8);
  });

  ctx.restore();
}

function drawTruckCab(ctx, x, y, w, h, color) {
  ctx.save(); ctx.translate(x, y);
  const hw = w / 2, hh = h / 2;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(-hw, -hh, w, h, 5); ctx.fill();
  ctx.fillStyle = '#37474f';
  ctx.beginPath(); ctx.roundRect(-hw, -hh, w, h * .38, 5); ctx.fill();
  ctx.fillStyle = '#90caf9'; ctx.globalAlpha = .7;
  ctx.beginPath(); ctx.roundRect(-hw + 4, -hh + 4, w - 8, h * .28, 3); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ff1744';
  ctx.fillRect(-hw + 3, hh - 7, 8, 5);
  ctx.fillRect(hw - 11, hh - 7, 8, 5);
  ctx.restore();
}

/* ──────────────────────────────────────────────────────────────
   PLAYER  – the user's car
────────────────────────────────────────────────────────────── */
const Player = {
  w: 36, h: 64,
  x: 0, y: 0,
  vx: 0, speed: 0,    // speed = base road speed reference
  lane: 1,
  nitro: 0,           // 0-1
  nitroActive: false,
  nitroUses: 0,
  crashed: false,
  crashTimer: 0,
  invincible: 0,      // brief invincibility flicker

  init(cw, ch) {
    this.x = Road.laneCenter(1);
    this.y = ch * .75;
    this.vx = 0;
    this.nitro = 0;
    this.nitroActive = false;
    this.nitroUses = 0;
    this.crashed = false;
    this.crashTimer = 0;
    this.invincible = 0;
  },

  update(dt, keys, cw) {
    if (this.crashed) { this.crashTimer -= dt; return; }
    if (this.invincible > 0) this.invincible -= dt;

    // Horizontal input
    let targetVX = 0;
    if (keys.left  || MobileCtrl.left)  targetVX = -320;
    if (keys.right || MobileCtrl.right) targetVX =  320;
    this.vx += (targetVX - this.vx) * dt * 10;

    this.x = clamp(this.x + this.vx * dt, Road.leftEdge + this.w / 2, Road.rightEdge - this.w / 2);

    // Nitro
    if ((keys.nitro || MobileCtrl.nitro) && this.nitro > 0 && !this.nitroActive) {
      this.nitroActive = true;
      this.nitroUses++;
      Audio.playNitro();
    }
    if (this.nitroActive) {
      this.nitro = Math.max(0, this.nitro - dt * .6);
      if (this.nitro <= 0) this.nitroActive = false;
    }

    // Particles: tyre smoke when steering hard
    if (Math.abs(this.vx) > 200) Particles.smoke(this.x, this.y + this.h / 2, 0);
    if (this.nitroActive) Particles.nitroTrail(this.x, this.y + this.h * .4, 0);

    // HUD nitro bar
    $('nitroBar').style.width = (this.nitro * 100) + '%';
    $('nitroBar').style.background = this.nitroActive
      ? 'linear-gradient(90deg, #00e5ff, #7b2fff)'
      : 'linear-gradient(90deg, #7b2fff, #c084fc)';
  },

  draw(ctx) {
    if (this.crashed && Math.floor(this.crashTimer * 10) % 2 === 0) return;
    if (this.invincible > 0 && Math.floor(this.invincible * 10) % 2 === 0) return;
    drawCar(ctx, this.x, this.y, this.w, this.h, Skins.get(), true, this.crashed, this.nitroActive);
  },

  get rect() {
    return { x: this.x - this.w / 2 + 4, y: this.y - this.h / 2 + 4,
             w: this.w - 8,              h: this.h - 8 };
  },

  addNitro(amount) { this.nitro = Math.min(1, this.nitro + amount); },

  doCrash(cx, cy) {
    this.crashed  = true;
    this.crashTimer = 1.2;
    Particles.crash(cx, cy);
    Audio.playCrash();
  }
};

/* ──────────────────────────────────────────────────────────────
   TRAFFIC  – oncoming & same-direction cars
────────────────────────────────────────────────────────────── */
const TRAFFIC_COLORS = [
  { body:'#e53935', roof:'#b71c1c', window:'#90caf9' },
  { body:'#1e88e5', roof:'#0d47a1', window:'#b3e5fc' },
  { body:'#43a047', roof:'#1b5e20', window:'#c8e6c9' },
  { body:'#fdd835', roof:'#f57f17', window:'#e1f5fe' },
  { body:'#8e24aa', roof:'#4a148c', window:'#e1bee7' },
  { body:'#ff6d00', roof:'#bf360c', window:'#ffe0b2' },
  { body:'#00838f', roof:'#006064', window:'#b2ebf2' },
];

const Traffic = {
  cars: [],
  spawnTimer: 0, spawnInterval: 1.2,

  init() { this.cars = []; this.spawnTimer = 0; },

  update(dt, roadSpeed, ch) {
    // Spawn
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.spawnInterval * rand(.7, 1.3);
      this._spawn(ch, roadSpeed);
    }

    // Move & cull
    this.cars.forEach(c => {
      c.y += (roadSpeed - c.relSpeed) * dt;
    });
    this.cars = this.cars.filter(c => c.y < ch + 120 && c.y > -200);
  },

  _spawn(ch, roadSpeed) {
    const lane    = randInt(0, Road.lanes - 1);
    const isTruck = Math.random() < .15;
    const color   = choose(TRAFFIC_COLORS);
    const relSpd  = rand(-60, 120); // relative speed to road

    this.cars.push({
      x: Road.laneCenter(lane),
      y: -80,
      w: isTruck ? 44 : 36,
      h: isTruck ? 88 : 64,
      color, isTruck, relSpeed: relSpd,
      lane
    });
  },

  draw(ctx) {
    this.cars.forEach(c => {
      if (c.isTruck) drawTruckCab(ctx, c.x, c.y, c.w, c.h, c.color.body);
      else drawCar(ctx, c.x, c.y, c.w, c.h, c.color, false);
    });
  },

  checkCollision(player) {
    if (player.invincible > 0 || player.crashed) return false;
    const pr = player.rect;
    for (const c of this.cars) {
      const cr = { x: c.x - c.w / 2 + 4, y: c.y - c.h / 2 + 4, w: c.w - 8, h: c.h - 8 };
      if (pr.x < cr.x + cr.w && pr.x + pr.w > cr.x &&
          pr.y < cr.y + cr.h && pr.y + pr.h > cr.y) {
        return { x: (pr.x + cr.x) / 2, y: (pr.y + cr.y) / 2 };
      }
    }
    return false;
  },

  setSpawnRate(interval) { this.spawnInterval = interval; }
};

/* ──────────────────────────────────────────────────────────────
   PICKUPS  – coins & nitro canisters
────────────────────────────────────────────────────────────── */
const Pickups = {
  items: [],
  spawnTimer: 0, spawnInterval: 2.5,
  runCoins: 0,

  init() { this.items = []; this.spawnTimer = 0; this.runCoins = 0; },

  update(dt, roadSpeed, ch, player) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.spawnInterval * rand(.7, 1.4);
      this._spawn(ch);
    }

    this.items.forEach(it => { it.y += roadSpeed * dt; it.anim += dt; });
    this.items = this.items.filter(it => it.y < ch + 60);

    // Collect
    const pr = player.rect;
    this.items = this.items.filter(it => {
      const hit = Math.abs(it.x - player.x) < 28 && Math.abs(it.y - player.y) < 36;
      if (hit) {
        if (it.type === 'coin') {
          this.runCoins++;
          Save.set('totalCoins', Save.get('totalCoins') + 1);
          Particles.coin(it.x, it.y);
          Audio.playCoin();
        } else if (it.type === 'nitro') {
          player.addNitro(.5);
          Audio.playNitro();
        }
        return false;
      }
      return true;
    });
  },

  _spawn(ch) {
    const lane = randInt(0, Road.lanes - 1);
    const type = Math.random() < .7 ? 'coin' : 'nitro';
    this.items.push({ x: Road.laneCenter(lane), y: -40, type, anim: 0 });
  },

  draw(ctx) {
    this.items.forEach(it => {
      ctx.save();
      ctx.translate(it.x, it.y);
      const bob = Math.sin(it.anim * 4) * 4;
      ctx.translate(0, bob);

      if (it.type === 'coin') {
        ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 12;
        ctx.fillStyle   = '#ffd700';
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#b8860b';
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('¢', 0, 1);
      } else {
        ctx.shadowColor = '#7b2fff'; ctx.shadowBlur = 14;
        ctx.fillStyle   = '#7b2fff';
        ctx.beginPath(); ctx.roundRect(-10, -14, 20, 28, 4); ctx.fill();
        ctx.fillStyle = '#c084fc';
        ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🔥', 0, 1);
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    });
  }
};

/* ──────────────────────────────────────────────────────────────
   MOBILE CONTROLS
────────────────────────────────────────────────────────────── */
const MobileCtrl = {
  left: false, right: false, nitro: false,
  press(dir)   {
    if (dir === 'left')  this.left  = true;
    if (dir === 'right') this.right = true;
    if (dir === 'nitro') this.nitro = true;
    $('btn' + dir[0].toUpperCase() + dir.slice(1))?.classList.add('pressed');
  },
  release(dir) {
    if (dir === 'left')  this.left  = false;
    if (dir === 'right') this.right = false;
    if (dir === 'nitro') this.nitro = false;
    $('btn' + dir[0].toUpperCase() + dir.slice(1))?.classList.remove('pressed');
  },
  reset() { this.left = this.right = this.nitro = false; }
};

/* ──────────────────────────────────────────────────────────────
   DIFFICULTY PRESETS
────────────────────────────────────────────────────────────── */
const DIFF = {
  easy:   { baseSpeed: 250, maxSpeed: 550, accel: 4,  spawnStart: 2.0, spawnMin: .9  },
  normal: { baseSpeed: 320, maxSpeed: 700, accel: 6,  spawnStart: 1.5, spawnMin: .6  },
  hard:   { baseSpeed: 420, maxSpeed: 900, accel: 10, spawnStart: 1.0, spawnMin: .4  },
};

/* ──────────────────────────────────────────────────────────────
   MAIN GAME MODULE
────────────────────────────────────────────────────────────── */
const Game = {
  canvas: null, ctx: null,
  cw: 0, ch: 0,
  raf: null,
  lastTime: 0,

  // State
  running: false,
  paused:  false,
  over:    false,

  // Stats
  score: 0, level: 0,
  elapsedTime: 0,
  roadSpeed: 0,

  // Keys
  keys: { left:false, right:false, nitro:false },

  // Difficulty
  difficulty: Save.get('difficulty') || 'normal',

  init() {
    this.canvas = $('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this._bindKeys();
    Audio.initUI();
    Skins.init();
    this._applyDiffButtons();
  },

  _resize() {
    this.cw = this.canvas.width  = window.innerWidth;
    this.ch = this.canvas.height = window.innerHeight;
    Road.init(this.cw, this.ch);
    if (this.running) Player.x = clamp(Player.x, Road.leftEdge + Player.w / 2, Road.rightEdge - Player.w / 2);
  },

  _bindKeys() {
    window.addEventListener('keydown', e => {
      switch(e.code) {
        case 'ArrowLeft':  case 'KeyA': this.keys.left  = true; e.preventDefault(); break;
        case 'ArrowRight': case 'KeyD': this.keys.right = true; e.preventDefault(); break;
        case 'Space': case 'ShiftLeft': this.keys.nitro = true; e.preventDefault(); break;
        case 'KeyP': case 'Escape':
          if (this.running) this.togglePause();
          break;
      }
    });
    window.addEventListener('keyup', e => {
      switch(e.code) {
        case 'ArrowLeft':  case 'KeyA': this.keys.left  = false; break;
        case 'ArrowRight': case 'KeyD': this.keys.right = false; break;
        case 'Space': case 'ShiftLeft': this.keys.nitro = false; break;
      }
    });
  },

  setDifficulty(d) {
    this.difficulty = d;
    Save.set('difficulty', d);
    this._applyDiffButtons();
  },

  _applyDiffButtons() {
    ['easy','normal','hard'].forEach(d => {
      $('diff' + d[0].toUpperCase() + d.slice(1))?.classList.toggle('active', d === this.difficulty);
    });
  },

  startGame() {
    Audio._ensure();
    UI.showScreen('gameScreen');
    this._resetState();
    this.running = true;
    this.paused  = false;
    this.over    = false;
    this.lastTime = performance.now();
    Audio.startEngine();
    this.raf = requestAnimationFrame(ts => this._loop(ts));
  },

  _resetState() {
    const diff = DIFF[this.difficulty];
    this.score       = 0;
    this.elapsedTime = 0;
    this.level       = 1;
    this.roadSpeed   = diff.baseSpeed;

    Road.scrollSpeed = this.roadSpeed;
    Road._initScenery(this.cw, this.ch);

    Player.init(this.cw, this.ch);
    Traffic.init();
    Traffic.setSpawnRate(diff.spawnStart);
    Pickups.init();
    Particles.clear();
    MobileCtrl.reset();

    $('hudScore').textContent = '0';
    $('hudBest').textContent  = Save.get('bestScore');
    $('hudCoins').textContent = '0';
    $('hudLevel').textContent = 'LVL 1';
    $('nitroBar').style.width = '0%';
  },

  _loop(ts) {
    if (!this.running) return;
    const dt = Math.min((ts - this.lastTime) / 1000, .05); // cap at 50ms
    this.lastTime = ts;

    if (!this.paused && !this.over) this._update(dt);
    this._draw();

    this.raf = requestAnimationFrame(t => this._loop(t));
  },

  _update(dt) {
    const diff = DIFF[this.difficulty];
    this.elapsedTime += dt;

    // Speed ramp
    this.roadSpeed = Math.min(diff.maxSpeed, diff.baseSpeed + this.elapsedTime * diff.accel);
    Road.scrollSpeed = this.roadSpeed + (Player.nitroActive ? this.roadSpeed * .5 : 0);

    // Level (every 30 seconds)
    const newLevel = Math.min(10, 1 + Math.floor(this.elapsedTime / 30));
    if (newLevel !== this.level) {
      this.level = newLevel;
      $('hudLevel').textContent = 'LVL ' + this.level;
      Traffic.setSpawnRate(Math.max(diff.spawnMin, diff.spawnStart - (this.level - 1) * .1));
    }

    // Score (distance based)
    this.score += Math.round(this.roadSpeed * dt * .1);
    $('hudScore').textContent = this.score;
    $('hudCoins').textContent = Pickups.runCoins;

    // Engine sound
    Audio.setEngineRPM((this.roadSpeed - diff.baseSpeed) / (diff.maxSpeed - diff.baseSpeed));

    // Sub-systems
    Road.update(dt, Road.scrollSpeed);
    Player.update(dt, this.keys, this.cw);
    Traffic.update(dt, this.roadSpeed, this.ch);
    Pickups.update(dt, this.roadSpeed, this.ch, Player);
    Particles.update(dt);

    // Achievements mid-run check
    Achievements.checkAll({
      score: this.score,
      runCoins: Pickups.runCoins,
      time: this.elapsedTime,
      nitroUses: Player.nitroUses,
      level: this.level
    });

    // Collision
    if (!Player.crashed) {
      const hit = Traffic.checkCollision(Player);
      if (hit) {
        Player.doCrash(hit.x, hit.y);
        setTimeout(() => this._gameOver(), 1200);
      }
    }
  },

  _draw() {
    const { ctx, cw, ch } = this;
    ctx.clearRect(0, 0, cw, ch);

    Road.draw(ctx, cw, ch);
    Pickups.draw(ctx);
    Traffic.draw(ctx);
    Particles.draw(ctx);
    Player.draw(ctx);

    // Speed-line effect when nitro active
    if (Player.nitroActive) this._drawSpeedLines(ctx, cw, ch);
  },

  _drawSpeedLines(ctx, cw, ch) {
    ctx.save();
    ctx.globalAlpha = .12;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    for (let i = 0; i < 12; i++) {
      const x = rand(Road.x, Road.x + Road.w);
      const y = rand(0, ch);
      const len = rand(40, 100);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + len); ctx.stroke();
    }
    ctx.restore();
  },

  togglePause() {
    if (this.over) return;
    this.paused = !this.paused;
    if (this.paused) {
      Audio.stopEngine();
      UI.showScreen('pauseMenu');
    } else {
      Audio.startEngine();
      UI.showScreen('gameScreen');
      this.lastTime = performance.now();
    }
  },

  restart() {
    cancelAnimationFrame(this.raf);
    Audio.stopEngine();
    this.startGame();
  },

  quitToMenu() {
    cancelAnimationFrame(this.raf);
    this.running = false;
    Audio.stopEngine();
    UI.showScreen('mainMenu');
  },

  _gameOver() {
    this.over = true;
    Audio.stopEngine();

    // Save best
    const isNew = this.score > Save.get('bestScore');
    if (isNew) Save.set('bestScore', this.score);

    // Final achievement check
    Achievements.checkAll({
      score: this.score,
      runCoins: Pickups.runCoins,
      time: this.elapsedTime,
      nitroUses: Player.nitroUses,
      level: this.level
    });

    // Update UI
    $('goScore').textContent = this.score;
    $('goBest').textContent  = Save.get('bestScore');
    $('goCoins').textContent = Pickups.runCoins;
    $('goLevel').textContent = this.level;
    $('newRecord').classList.toggle('hidden', !isNew);

    const newAchs = Achievements._newThisRun;
    $('unlockedAch').textContent = newAchs.length
      ? '🏆 Unlocked: ' + newAchs.map(a => a.name).join(', ')
      : '';

    UI.showScreen('gameOver');
  }
};

/* ──────────────────────────────────────────────────────────────
   BOOT
────────────────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  Game.init();
  UI.showScreen('mainMenu');
});
