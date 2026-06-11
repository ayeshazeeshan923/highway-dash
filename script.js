/* ═══════════════════════════════════════════════════════════════
   Highway Dash — script.js  (v2 — fixed)
   Pure HTML5 Canvas game. No libraries, no external assets.
═══════════════════════════════════════════════════════════════ */
'use strict';

/* ── Polyfill: ctx.roundRect (missing in older browsers) ──── */
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    r = typeof r === 'object' ? r[0] : (r || 0);
    r = Math.min(r, w / 2, h / 2);
    this.beginPath();
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.quadraticCurveTo(x + w, y,     x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.quadraticCurveTo(x,     y + h, x,     y + h - r);
    this.lineTo(x, y + r);
    this.quadraticCurveTo(x,     y,     x + r, y);
    this.closePath();
  };
}

/* ── Helpers ─────────────────────────────────────────────── */
const $       = id  => document.getElementById(id);
const clamp   = (v,lo,hi) => Math.max(lo, Math.min(hi, v));
const rand    = (lo,hi)   => lo + Math.random() * (hi - lo);
const randInt = (lo,hi)   => Math.floor(rand(lo, hi + 1));
const choose  = arr => arr[randInt(0, arr.length - 1)];

/* ══════════════════════════════════════════════════════════
   SAVE / LOAD
══════════════════════════════════════════════════════════ */
const Save = {
  _defaults: { bestScore:0, totalCoins:0, musicOn:true, sfxOn:true,
                difficulty:'normal', skinIndex:0, achievements:{} },
  _data: null,
  load() {
    try {
      const raw = localStorage.getItem('hd2');
      this._data = raw ? { ...this._defaults, ...JSON.parse(raw) }
                       : { ...this._defaults };
    } catch(e) { this._data = { ...this._defaults }; }
  },
  save() { try { localStorage.setItem('hd2', JSON.stringify(this._data)); } catch(e){} },
  get(k)    { return this._data[k]; },
  set(k,v)  { this._data[k] = v; this.save(); }
};
Save.load();

/* ══════════════════════════════════════════════════════════
   UI — screen manager
══════════════════════════════════════════════════════════ */
const UI = {
  current: '',
  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = $(id);
    if (!el) { console.warn('No screen:', id); return; }
    el.classList.add('active');
    this.current = id;
    if (id === 'mainMenu')          this._refreshMenu();
    if (id === 'achievementsScreen') Achievements.render();
    Audio.playClick();
  },
  _refreshMenu() {
    $('menuBestScore').textContent = Save.get('bestScore');
    $('menuCoins').textContent     = Save.get('totalCoins');
  }
};

/* ══════════════════════════════════════════════════════════
   AUDIO — Web Audio API (no files needed)
══════════════════════════════════════════════════════════ */
const Audio = {
  ctx: null,
  engineOsc: null, engineGain: null,
  _music: Save.get('musicOn') !== false,
  _sfx:   Save.get('sfxOn')   !== false,

  _boot() {
    if (this.ctx) { if (this.ctx.state==='suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) { this.ctx = null; }
  },

  _beep(freq, type, vol, dur, startDelay) {
    if (!this._sfx || !this.ctx) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      const t = this.ctx.currentTime + (startDelay||0);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + dur + 0.01);
    } catch(e) {}
  },

  playClick()  { this._boot(); this._beep(660,'sine',.1,.07); },
  playCoin()   { this._boot(); this._beep(880,'sine',.1,.1); this._beep(1320,'sine',.08,.1,.08); },
  playNitro()  { this._boot();
    if(!this.ctx||!this._sfx) return;
    try {
      const o=this.ctx.createOscillator(); const g=this.ctx.createGain();
      o.type='sawtooth'; o.frequency.setValueAtTime(80,this.ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(200,this.ctx.currentTime+.3);
      g.gain.setValueAtTime(.15,this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(.001,this.ctx.currentTime+.3);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(); o.stop(this.ctx.currentTime+.31);
    } catch(e){}
  },
  playCrash() {
    this._boot();
    if(!this.ctx||!this._sfx) return;
    try {
      const sr=this.ctx.sampleRate, len=Math.floor(sr*.5);
      const buf=this.ctx.createBuffer(1,len,sr);
      const d=buf.getChannelData(0);
      for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*(1-i/len);
      const src=this.ctx.createBufferSource();
      src.buffer=buf;
      const g=this.ctx.createGain();
      g.gain.setValueAtTime(.5,this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(.001,this.ctx.currentTime+.5);
      src.connect(g); g.connect(this.ctx.destination); src.start();
    } catch(e){}
  },

  startEngine() {
    this._boot();
    if(!this._music||!this.ctx||this.engineOsc) return;
    try {
      this.engineGain=this.ctx.createGain(); this.engineGain.gain.value=.04;
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc=this.ctx.createOscillator();
      this.engineOsc.type='sawtooth'; this.engineOsc.frequency.value=55;
      this.engineOsc.connect(this.engineGain); this.engineOsc.start();
    } catch(e){}
  },
  setEngineRPM(t) {
    if(!this.engineOsc) return;
    try {
      this.engineOsc.frequency.value = 55+t*120;
      this.engineGain.gain.value     = .03+t*.04;
    } catch(e){}
  },
  stopEngine() {
    if(!this.engineOsc) return;
    try { this.engineOsc.stop(); } catch(e){}
    this.engineOsc=null; this.engineGain=null;
  },

  toggleMusic() {
    this._music=!this._music; Save.set('musicOn',this._music);
    $('toggleMusic').textContent=this._music?'ON':'OFF';
    $('toggleMusic').classList.toggle('off',!this._music);
    if(!this._music) this.stopEngine();
  },
  toggleSFX() {
    this._sfx=!this._sfx; Save.set('sfxOn',this._sfx);
    $('toggleSFX').textContent=this._sfx?'ON':'OFF';
    $('toggleSFX').classList.toggle('off',!this._sfx);
  },
  initUI() {
    $('toggleMusic').textContent=this._music?'ON':'OFF';
    $('toggleMusic').classList.toggle('off',!this._music);
    $('toggleSFX').textContent=this._sfx?'ON':'OFF';
    $('toggleSFX').classList.toggle('off',!this._sfx);
  }
};

/* ══════════════════════════════════════════════════════════
   SKINS
══════════════════════════════════════════════════════════ */
const Skins = {
  list: [
    {label:'🔴', body:'#e53935', roof:'#b71c1c', win:'#90caf9'},
    {label:'🔵', body:'#1e88e5', roof:'#0d47a1', win:'#b3e5fc'},
    {label:'🟢', body:'#43a047', roof:'#1b5e20', win:'#c8e6c9'},
    {label:'🟡', body:'#fdd835', roof:'#f57f17', win:'#e1f5fe'},
    {label:'🟣', body:'#8e24aa', roof:'#4a148c', win:'#e1bee7'},
    {label:'⬛', body:'#546e7a', roof:'#263238', win:'#cfd8dc'},
  ],
  current: 0,
  init() {
    this.current = Save.get('skinIndex')||0;
    const wrap=$('skinBtns'); wrap.innerHTML='';
    this.list.forEach((s,i)=>{
      const b=document.createElement('button');
      b.className='skin-btn'+(i===this.current?' active':'');
      b.textContent=s.label; b.onclick=()=>this.select(i);
      wrap.appendChild(b);
    });
  },
  select(i) {
    this.current=i; Save.set('skinIndex',i);
    document.querySelectorAll('.skin-btn').forEach((b,j)=>b.classList.toggle('active',j===i));
  },
  get() { return this.list[this.current]; }
};

/* ══════════════════════════════════════════════════════════
   ACHIEVEMENTS
══════════════════════════════════════════════════════════ */
const Achievements = {
  list: [
    {id:'first',    icon:'🏁', name:'First Race',    desc:'Complete your first run',          chk:s=>s.score>0},
    {id:'s1000',    icon:'🎯', name:'Score 1000',     desc:'Reach 1000 score',                 chk:s=>s.score>=1000},
    {id:'s5000',    icon:'⭐', name:'Score 5000',     desc:'Reach 5000 score',                 chk:s=>s.score>=5000},
    {id:'c50',      icon:'🪙', name:'Coin Hoarder',   desc:'Collect 50 coins in one run',      chk:s=>s.runCoins>=50},
    {id:'t60',      icon:'⏱️', name:'Survivor',       desc:'Survive 60 seconds',               chk:s=>s.time>=60},
    {id:'t120',     icon:'🕐', name:'Endurance',      desc:'Survive 2 minutes',                chk:s=>s.time>=120},
    {id:'nitro5',   icon:'🔥', name:'Nitro Junkie',   desc:'Use nitro 5 times in one run',     chk:s=>s.nitroUses>=5},
    {id:'lvl3',     icon:'🏆', name:'Level 3',        desc:'Reach Level 3',                    chk:s=>s.level>=3},
    {id:'total100', icon:'💰', name:'Rich Driver',    desc:'Collect 100 coins total',          chk:()=>Save.get('totalCoins')>=100},
  ],
  _done: {},
  _newThisRun: [],
  load()  { this._done=Save.get('achievements')||{}; },
  checkAll(stats) {
    this._newThisRun=[];
    this.list.forEach(a=>{
      if(!this._done[a.id]&&a.chk(stats)){
        this._done[a.id]=true; this._newThisRun.push(a);
        Save.set('achievements',this._done);
        this._toast(a);
      }
    });
  },
  _toast(a) {
    const el=$('achToast');
    el.textContent='🏆 Unlocked: '+a.name;
    el.classList.remove('hidden');
    clearTimeout(this._t);
    this._t=setTimeout(()=>el.classList.add('hidden'),3000);
  },
  render() {
    const wrap=$('achievementList'); wrap.innerHTML='';
    this.list.forEach(a=>{
      const ok=!!this._done[a.id];
      const d=document.createElement('div');
      d.className='ach-item'+(ok?' unlocked':'');
      d.innerHTML=`<div class="ach-icon">${a.icon}</div>
        <div class="ach-info"><div class="ach-name">${a.name}</div>
        <div class="ach-desc">${a.desc}</div></div>
        <div class="ach-badge">${ok?'✓':'LOCKED'}</div>`;
      wrap.appendChild(d);
    });
  }
};
Achievements.load();

/* ══════════════════════════════════════════════════════════
   PARTICLES
══════════════════════════════════════════════════════════ */
class Particle {
  constructor(x,y,vx,vy,col,life,size,grav=0){
    this.x=x;this.y=y;this.vx=vx;this.vy=vy;
    this.col=col;this.life=life;this.max=life;this.size=size;this.grav=grav;
  }
  update(dt){ this.x+=this.vx*dt; this.y+=this.vy*dt; this.vy+=this.grav*dt; this.life-=dt; }
  draw(ctx){
    const a=Math.max(0,this.life/this.max);
    ctx.globalAlpha=a; ctx.fillStyle=this.col;
    ctx.beginPath(); ctx.arc(this.x,this.y,Math.max(.5,this.size*a),0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
  }
  get dead(){ return this.life<=0; }
}

const Particles={
  pool:[],
  add(p){ this.pool.push(p); },
  update(dt){ this.pool=this.pool.filter(p=>{p.update(dt);return!p.dead;}); },
  draw(ctx){ this.pool.forEach(p=>p.draw(ctx)); },
  clear(){ this.pool=[]; },
  crash(x,y){
    const cols=['#ff4d00','#ff8c00','#ffd700','#ffffff','#e53935'];
    for(let i=0;i<55;i++){
      const a=Math.random()*Math.PI*2, sp=rand(80,450);
      this.add(new Particle(x,y,Math.cos(a)*sp,Math.sin(a)*sp,choose(cols),rand(.4,1),rand(3,9),280));
    }
  },
  smoke(x,y){
    if(Math.random()>.35) return;
    const g=`hsl(0,0%,${randInt(55,85)}%)`;
    this.add(new Particle(x,y,rand(-18,18),rand(-50,-90),g,rand(.3,.7),rand(4,10),-50));
  },
  coin(x,y){
    for(let i=0;i<8;i++){
      const a=Math.random()*Math.PI*2;
      this.add(new Particle(x,y,Math.cos(a)*rand(40,140),Math.sin(a)*rand(40,140),'#ffd700',rand(.3,.6),rand(3,6),200));
    }
  },
  nitro(x,y){
    const cols=['#7b2fff','#c084fc','#00e5ff'];
    this.add(new Particle(x,y,rand(-25,25),rand(50,160),choose(cols),rand(.2,.45),rand(4,8),0));
  }
};

/* ══════════════════════════════════════════════════════════
   ROAD
══════════════════════════════════════════════════════════ */
const Road={
  x:0, w:0, lanes:4, laneW:0,
  scrollY:0, _ch:600,
  trees:[],

  init(cw,ch){
    this._ch=ch;
    this.w=Math.min(cw*.72,400);
    this.x=(cw-this.w)/2;
    this.laneW=this.w/this.lanes;
    this._spawnTrees(cw,ch);
  },

  _spawnTrees(cw,ch){
    this.trees=[];
    for(let i=0;i<14;i++){
      const side=i<7?'L':'R';
      const tx=side==='L'?rand(8,this.x-20):rand(this.x+this.w+20,cw-8);
      this.trees.push({x:tx, y:rand(0,ch)});
    }
  },

  update(dt,spd){
    const pace=spd*dt;
    this.scrollY=(this.scrollY+pace)%(80);
    this.trees.forEach(t=>{ t.y+=pace; if(t.y>this._ch+60) t.y=-60; });
  },

  draw(ctx,cw,ch){
    /* sky */
    const sky=ctx.createLinearGradient(0,0,0,ch*.5);
    sky.addColorStop(0,'#0a1628'); sky.addColorStop(.6,'#1a237e'); sky.addColorStop(1,'#283593');
    ctx.fillStyle=sky; ctx.fillRect(0,0,cw,ch);

    /* mountains */
    this._mountains(ctx,cw,ch);

    /* grass */
    ctx.fillStyle='#2e7d32'; ctx.fillRect(0,ch*.46,cw,ch);

    /* road */
    ctx.fillStyle='#3d3d3d'; ctx.fillRect(this.x,0,this.w,ch);

    /* kerb stripes */
    const stripeH=24;
    for(let y=-stripeH;y<ch+stripeH;y+=stripeH*2){
      const offset=this.scrollY%(stripeH*2);
      ctx.fillStyle='#e53935';
      ctx.fillRect(this.x,y+offset,10,stripeH);
      ctx.fillRect(this.x+this.w-10,y+offset,10,stripeH);
      ctx.fillStyle='#ffffff';
      ctx.fillRect(this.x,y+offset+stripeH,10,stripeH);
      ctx.fillRect(this.x+this.w-10,y+offset+stripeH,10,stripeH);
    }

    /* road edges */
    ctx.strokeStyle='#fff'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(this.x,0); ctx.lineTo(this.x,ch); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(this.x+this.w,0); ctx.lineTo(this.x+this.w,ch); ctx.stroke();

    /* lane dashes */
    ctx.strokeStyle='rgba(255,255,255,.4)'; ctx.lineWidth=2;
    ctx.setLineDash([50,40]); ctx.lineDashOffset=-this.scrollY*1.5;
    for(let l=1;l<this.lanes;l++){
      const lx=this.x+l*this.laneW;
      ctx.beginPath(); ctx.moveTo(lx,0); ctx.lineTo(lx,ch); ctx.stroke();
    }
    ctx.setLineDash([]);

    /* trees */
    this.trees.forEach(t=>this._tree(ctx,t.x,t.y));
  },

  _mountains(ctx,cw,ch){
    const hy=ch*.48;
    [[`#1a237e`,70],[`#283593`,50],[`#303f9f`,35]].forEach(([col,amp],layer)=>{
      ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(0,hy);
      const steps=8;
      for(let i=0;i<=steps;i++){
        const px=cw*i/steps;
        const py=i%2===0?hy:hy-rand(amp*.6,amp);
        ctx.lineTo(px,py);
      }
      ctx.lineTo(cw,hy); ctx.lineTo(cw,ch); ctx.lineTo(0,ch); ctx.closePath(); ctx.fill();
    });
  },

  _tree(ctx,x,y){
    ctx.fillStyle='#5d4037'; ctx.fillRect(x-4,y-8,8,20);
    ctx.fillStyle='#388e3c'; ctx.beginPath(); ctx.arc(x,y-20,15,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#2e7d32'; ctx.beginPath(); ctx.arc(x-4,y-26,10,0,Math.PI*2); ctx.fill();
  },

  laneCenter(l){ return this.x+(l+.5)*this.laneW; },
  get left()    { return this.x+6; },
  get right()   { return this.x+this.w-6; }
};

/* ══════════════════════════════════════════════════════════
   CAR DRAWING helpers
══════════════════════════════════════════════════════════ */
function rr(ctx,x,y,w,h,r){ ctx.roundRect(x,y,w,h,r); }  // shorthand

function drawPlayerCar(ctx,x,y,w,h,skin,nitro,crashed){
  ctx.save(); ctx.translate(x,y);
  if(crashed) ctx.rotate(Math.sin(Date.now()*.05)*.25);
  const hw=w/2,hh=h/2;
  if(nitro){ ctx.shadowColor='#c084fc'; ctx.shadowBlur=24; }
  /* body */
  ctx.fillStyle=skin.body; ctx.beginPath(); rr(ctx,-hw,-hh,w,h,7); ctx.fill();
  /* roof */
  ctx.fillStyle=skin.roof; ctx.beginPath(); rr(ctx,-hw*.64,-hh+h*.1,w*.68,h*.44,5); ctx.fill();
  /* windshield */
  ctx.fillStyle=skin.win; ctx.globalAlpha=.8;
  ctx.beginPath(); rr(ctx,-hw*.56,-hh+h*.12,w*.62,h*.22,4); ctx.fill();
  /* rear window */
  ctx.beginPath(); rr(ctx,-hw*.52,-hh+h*.38,w*.58,h*.16,3); ctx.fill();
  ctx.globalAlpha=1;
  /* headlights */
  ctx.fillStyle='#fff'; ctx.shadowColor='#fffbe6'; ctx.shadowBlur=10;
  ctx.fillRect(-hw+3,-hh+3,9,5); ctx.fillRect(hw-12,-hh+3,9,5);
  ctx.shadowBlur=0;
  /* wheels */
  [[-hw-3,-h*.25],[hw-5,-h*.25],[-hw-3,h*.18],[hw-5,h*.18]].forEach(([wx,wy])=>{
    ctx.fillStyle='#212121'; ctx.fillRect(wx,wy,8,13);
    ctx.fillStyle='#757575'; ctx.fillRect(wx+1,wy+2,6,9);
  });
  ctx.restore();
}

function drawTrafficCar(ctx,x,y,w,h,skin,isTruck){
  ctx.save(); ctx.translate(x,y);
  const hw=w/2,hh=h/2;
  ctx.fillStyle=skin.body; ctx.beginPath(); rr(ctx,-hw,-hh,w,h,6); ctx.fill();
  if(!isTruck){
    ctx.fillStyle=skin.roof; ctx.beginPath(); rr(ctx,-hw*.65,-hh+h*.1,w*.68,h*.44,5); ctx.fill();
    ctx.fillStyle=skin.win; ctx.globalAlpha=.75;
    ctx.beginPath(); rr(ctx,-hw*.57,-hh+h*.12,w*.62,h*.22,4); ctx.fill(); ctx.globalAlpha=1;
  } else {
    ctx.fillStyle='#37474f'; ctx.beginPath(); rr(ctx,-hw,-hh,w,h*.38,5); ctx.fill();
    ctx.fillStyle='#90caf9'; ctx.globalAlpha=.6;
    ctx.beginPath(); rr(ctx,-hw+4,-hh+4,w-8,h*.24,3); ctx.fill(); ctx.globalAlpha=1;
  }
  /* taillights */
  ctx.fillStyle='#ff1744'; ctx.shadowColor='#ff1744'; ctx.shadowBlur=8;
  ctx.fillRect(-hw+3,hh-7,8,5); ctx.fillRect(hw-11,hh-7,8,5);
  ctx.shadowBlur=0;
  /* wheels */
  [[-hw-3,-h*.25],[hw-5,-h*.25],[-hw-3,h*.18],[hw-5,h*.18]].forEach(([wx,wy])=>{
    ctx.fillStyle='#212121'; ctx.fillRect(wx,wy,8,13);
    ctx.fillStyle='#757575'; ctx.fillRect(wx+1,wy+2,6,9);
  });
  ctx.restore();
}

/* ══════════════════════════════════════════════════════════
   PLAYER
══════════════════════════════════════════════════════════ */
const Player={
  w:36,h:62, x:0,y:0, vx:0,
  nitro:0, nitroOn:false, nitroUses:0,
  crashed:false, crashTimer:0, blink:0,

  init(cw,ch){
    this.x=Road.laneCenter(1); this.y=ch*.75;
    this.vx=0; this.nitro=0; this.nitroOn=false;
    this.nitroUses=0; this.crashed=false; this.crashTimer=0; this.blink=0;
  },

  update(dt,keys,cw){
    if(this.crashed){ this.crashTimer-=dt; return; }
    if(this.blink>0) this.blink-=dt;

    /* steer */
    let tvx=0;
    if(keys.left ||MobileCtrl.left)  tvx=-310;
    if(keys.right||MobileCtrl.right) tvx= 310;
    this.vx+=(tvx-this.vx)*dt*9;
    this.x=clamp(this.x+this.vx*dt, Road.left+this.w/2, Road.right-this.w/2);

    /* nitro */
    if((keys.nitro||MobileCtrl.nitro)&&this.nitro>0&&!this.nitroOn){
      this.nitroOn=true; this.nitroUses++; Audio.playNitro();
    }
    if(this.nitroOn){
      this.nitro=Math.max(0,this.nitro-dt*.55);
      if(this.nitro<=0) this.nitroOn=false;
    }

    /* particles */
    if(Math.abs(this.vx)>190) Particles.smoke(this.x,this.y+this.h*.4);
    if(this.nitroOn)           Particles.nitro(this.x,this.y+this.h*.35);

    /* HUD */
    const nb=$('nitroBar');
    if(nb){
      nb.style.width=(this.nitro*100)+'%';
      nb.style.background=this.nitroOn
        ?'linear-gradient(90deg,#00e5ff,#7b2fff)'
        :'linear-gradient(90deg,#7b2fff,#c084fc)';
    }
  },

  draw(ctx){
    if(this.blink>0&&Math.floor(this.blink*12)%2===0) return;
    drawPlayerCar(ctx,this.x,this.y,this.w,this.h,Skins.get(),this.nitroOn,this.crashed);
  },

  get rect(){ return {x:this.x-this.w/2+5,y:this.y-this.h/2+4,w:this.w-10,h:this.h-8}; },
  addNitro(v){ this.nitro=Math.min(1,this.nitro+v); },
  crash(cx,cy){ this.crashed=true; this.crashTimer=1.1; Particles.crash(cx,cy); Audio.playCrash(); }
};

/* ══════════════════════════════════════════════════════════
   TRAFFIC
══════════════════════════════════════════════════════════ */
const TCOLS=[
  {body:'#e53935',roof:'#b71c1c',win:'#90caf9'},
  {body:'#1e88e5',roof:'#0d47a1',win:'#b3e5fc'},
  {body:'#43a047',roof:'#1b5e20',win:'#c8e6c9'},
  {body:'#fdd835',roof:'#f57f17',win:'#fff9c4'},
  {body:'#8e24aa',roof:'#4a148c',win:'#e1bee7'},
  {body:'#ff6d00',roof:'#bf360c',win:'#ffe0b2'},
  {body:'#00838f',roof:'#006064',win:'#b2ebf2'},
];

const Traffic={
  cars:[], timer:0, interval:1.4,

  init(){ this.cars=[]; this.timer=0; },

  update(dt,spd,ch){
    this.timer-=dt;
    if(this.timer<=0){ this.timer=this.interval*rand(.65,1.35); this._spawn(ch,spd); }
    this.cars.forEach(c=>{ c.y+=(spd-c.rel)*dt; });
    this.cars=this.cars.filter(c=>c.y<ch+140&&c.y>-250);
  },

  _spawn(ch,spd){
    const lane=randInt(0,Road.lanes-1);
    const truck=Math.random()<.14;
    this.cars.push({
      x:Road.laneCenter(lane), y:-90,
      w:truck?44:36, h:truck?90:62,
      skin:choose(TCOLS), truck,
      rel:rand(-70,110)
    });
  },

  draw(ctx){ this.cars.forEach(c=>drawTrafficCar(ctx,c.x,c.y,c.w,c.h,c.skin,c.truck)); },

  hit(player){
    if(player.blink>0||player.crashed) return false;
    const pr=player.rect;
    for(const c of this.cars){
      const cr={x:c.x-c.w/2+4,y:c.y-c.h/2+4,w:c.w-8,h:c.h-8};
      if(pr.x<cr.x+cr.w&&pr.x+pr.w>cr.x&&pr.y<cr.y+cr.h&&pr.y+pr.h>cr.y)
        return {x:(pr.x+cr.x+cr.w)/2, y:(pr.y+cr.y)/2};
    }
    return false;
  },

  setRate(v){ this.interval=v; }
};

/* ══════════════════════════════════════════════════════════
   PICKUPS
══════════════════════════════════════════════════════════ */
const Pickups={
  items:[], timer:0, interval:2.2, runCoins:0,

  init(){ this.items=[]; this.timer=0; this.runCoins=0; },

  update(dt,spd,ch,player){
    this.timer-=dt;
    if(this.timer<=0){ this.timer=this.interval*rand(.7,1.5); this._spawn(ch); }
    this.items.forEach(it=>{ it.y+=spd*dt; it.anim+=dt*4; });
    this.items=this.items.filter(it=>{
      if(it.y>ch+50) return false;
      if(Math.abs(it.x-player.x)<26&&Math.abs(it.y-player.y)<34){
        if(it.type==='coin'){ this.runCoins++; Save.set('totalCoins',Save.get('totalCoins')+1); Particles.coin(it.x,it.y); Audio.playCoin(); }
        else { player.addNitro(.5); Audio.playNitro(); }
        return false;
      }
      return true;
    });
  },

  _spawn(ch){
    const lane=randInt(0,Road.lanes-1);
    this.items.push({x:Road.laneCenter(lane),y:-50,type:Math.random()<.7?'coin':'nitro',anim:0});
  },

  draw(ctx){
    this.items.forEach(it=>{
      ctx.save(); ctx.translate(it.x,it.y+Math.sin(it.anim)*5);
      if(it.type==='coin'){
        ctx.shadowColor='#ffd700'; ctx.shadowBlur=14;
        ctx.fillStyle='#ffd700'; ctx.beginPath(); ctx.arc(0,0,12,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#f9a825'; ctx.beginPath(); ctx.arc(0,0,9,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#fff8e1'; ctx.font='bold 10px sans-serif';
        ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('¢',0,1);
      } else {
        ctx.shadowColor='#7b2fff'; ctx.shadowBlur=16;
        ctx.fillStyle='#7b2fff'; ctx.beginPath();
        rr(ctx,-10,-15,20,30,4); ctx.fill();
        ctx.fillStyle='#e040fb'; ctx.font='13px sans-serif';
        ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('N',0,1);
      }
      ctx.shadowBlur=0; ctx.restore();
    });
  }
};

/* ══════════════════════════════════════════════════════════
   MOBILE CONTROLS
══════════════════════════════════════════════════════════ */
const MobileCtrl={
  left:false, right:false, nitro:false,
  press(d){
    if(d==='left')  this.left=true;
    if(d==='right') this.right=true;
    if(d==='nitro') this.nitro=true;
    const btn=$('btn'+d[0].toUpperCase()+d.slice(1));
    if(btn) btn.classList.add('pressed');
  },
  release(d){
    if(d==='left')  this.left=false;
    if(d==='right') this.right=false;
    if(d==='nitro') this.nitro=false;
    const btn=$('btn'+d[0].toUpperCase()+d.slice(1));
    if(btn) btn.classList.remove('pressed');
  },
  reset(){ this.left=this.right=this.nitro=false; }
};

/* ══════════════════════════════════════════════════════════
   DIFFICULTY
══════════════════════════════════════════════════════════ */
const DIFF={
  easy:   {base:240,max:520,accel:3.5,spawnStart:2.0,spawnMin:.9},
  normal: {base:310,max:680,accel:5.5,spawnStart:1.4,spawnMin:.55},
  hard:   {base:420,max:880,accel:9,  spawnStart:1.0,spawnMin:.38},
};

/* ══════════════════════════════════════════════════════════
   GAME
══════════════════════════════════════════════════════════ */
const Game={
  canvas:null, ctx:null, cw:0, ch:0,
  raf:null, lastTime:0,
  running:false, paused:false, over:false,
  score:0, level:0, elapsed:0, roadSpd:0,
  keys:{left:false,right:false,nitro:false},
  difficulty: Save.get('difficulty')||'normal',

  init(){
    this.canvas=$('gameCanvas');
    if(!this.canvas){ console.error('Canvas not found!'); return; }
    this.ctx=this.canvas.getContext('2d');
    this._resize();
    window.addEventListener('resize',()=>this._resize());
    this._keys();
    Audio.initUI();
    Skins.init();
    this._applyDiff();
  },

  _resize(){
    this.cw=this.canvas.width=window.innerWidth;
    this.ch=this.canvas.height=window.innerHeight;
    Road.init(this.cw,this.ch);
  },

  _keys(){
    const dn=(e)=>{
      if(e.code==='ArrowLeft' ||e.code==='KeyA'){ this.keys.left=true;  e.preventDefault(); }
      if(e.code==='ArrowRight'||e.code==='KeyD'){ this.keys.right=true; e.preventDefault(); }
      if(e.code==='Space'||e.code==='ShiftLeft'){ this.keys.nitro=true; e.preventDefault(); }
      if((e.code==='KeyP'||e.code==='Escape')&&this.running&&!this.over) this.togglePause();
    };
    const up=(e)=>{
      if(e.code==='ArrowLeft' ||e.code==='KeyA') this.keys.left=false;
      if(e.code==='ArrowRight'||e.code==='KeyD') this.keys.right=false;
      if(e.code==='Space'||e.code==='ShiftLeft') this.keys.nitro=false;
    };
    window.addEventListener('keydown',dn);
    window.addEventListener('keyup',up);
  },

  setDifficulty(d){
    this.difficulty=d; Save.set('difficulty',d); this._applyDiff();
  },

  _applyDiff(){
    ['easy','normal','hard'].forEach(d=>{
      const b=$('diff'+d[0].toUpperCase()+d.slice(1));
      if(b) b.classList.toggle('active',d===this.difficulty);
    });
  },

  startGame(){
    /* unlock audio on first gesture */
    Audio._boot();
    this._reset();
    UI.showScreen('gameScreen');
    this.running=true; this.paused=false; this.over=false;
    this.lastTime=performance.now();
    Audio.startEngine();
    if(this.raf) cancelAnimationFrame(this.raf);
    this.raf=requestAnimationFrame(ts=>this._loop(ts));
  },

  _reset(){
    const d=DIFF[this.difficulty];
    this.score=0; this.elapsed=0; this.level=1; this.roadSpd=d.base;
    Road.init(this.cw,this.ch);
    Player.init(this.cw,this.ch);
    Traffic.init(); Traffic.setRate(d.spawnStart);
    Pickups.init(); Particles.clear(); MobileCtrl.reset();
    /* update HUD */
    const set=(id,v)=>{ const el=$(id); if(el) el.textContent=v; };
    set('hudScore',0); set('hudBest',Save.get('bestScore'));
    set('hudCoins',0); set('hudLevel','LVL 1');
    const nb=$('nitroBar'); if(nb) nb.style.width='0%';
  },

  _loop(ts){
    if(!this.running) return;
    const dt=Math.min((ts-this.lastTime)/1000,.05);
    this.lastTime=ts;
    if(!this.paused&&!this.over) this._update(dt);
    this._draw();
    this.raf=requestAnimationFrame(t=>this._loop(t));
  },

  _update(dt){
    const d=DIFF[this.difficulty];
    this.elapsed+=dt;

    /* speed ramp */
    this.roadSpd=Math.min(d.max, d.base+this.elapsed*d.accel);
    const effectiveSpd=this.roadSpd*(Player.nitroOn?1.5:1);

    /* level */
    const newLvl=Math.min(10,1+Math.floor(this.elapsed/30));
    if(newLvl!==this.level){
      this.level=newLvl;
      const hl=$('hudLevel'); if(hl) hl.textContent='LVL '+this.level;
      Traffic.setRate(Math.max(d.spawnMin, d.spawnStart-(this.level-1)*.09));
    }

    /* score */
    this.score+=Math.round(this.roadSpd*dt*.1);
    const hs=$('hudScore'); if(hs) hs.textContent=this.score;
    const hc=$('hudCoins'); if(hc) hc.textContent=Pickups.runCoins;

    Audio.setEngineRPM((this.roadSpd-d.base)/(d.max-d.base));

    Road.update(dt,effectiveSpd);
    Player.update(dt,this.keys,this.cw);
    Traffic.update(dt,this.roadSpd,this.ch);
    Pickups.update(dt,this.roadSpd,this.ch,Player);
    Particles.update(dt);

    Achievements.checkAll({score:this.score,runCoins:Pickups.runCoins,
      time:this.elapsed,nitroUses:Player.nitroUses,level:this.level});

    /* collision */
    if(!Player.crashed){
      const hit=Traffic.hit(Player);
      if(hit){ Player.crash(hit.x,hit.y); setTimeout(()=>this._over(),1150); }
    }
  },

  _draw(){
    const {ctx,cw,ch}=this;
    ctx.clearRect(0,0,cw,ch);
    Road.draw(ctx,cw,ch);
    Pickups.draw(ctx);
    Traffic.draw(ctx);
    Particles.draw(ctx);
    Player.draw(ctx);
    if(Player.nitroOn) this._speedLines(ctx,cw,ch);
  },

  _speedLines(ctx,cw,ch){
    ctx.save(); ctx.globalAlpha=.1; ctx.strokeStyle='#fff'; ctx.lineWidth=1.5;
    for(let i=0;i<10;i++){
      const sx=rand(Road.x,Road.x+Road.w), sy=rand(0,ch), len=rand(35,90);
      ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(sx,sy+len); ctx.stroke();
    }
    ctx.restore();
  },

  togglePause(){
    if(this.over) return;
    this.paused=!this.paused;
    if(this.paused){ Audio.stopEngine(); UI.showScreen('pauseMenu'); }
    else { Audio.startEngine(); UI.showScreen('gameScreen'); this.lastTime=performance.now(); }
  },

  restart(){
    cancelAnimationFrame(this.raf); this.raf=null;
    Audio.stopEngine(); this.running=false;
    this.startGame();
  },

  quitToMenu(){
    cancelAnimationFrame(this.raf); this.raf=null;
    Audio.stopEngine(); this.running=false;
    UI.showScreen('mainMenu');
  },

  _over(){
    this.over=true; Audio.stopEngine();
    const isNew=this.score>Save.get('bestScore');
    if(isNew) Save.set('bestScore',this.score);

    Achievements.checkAll({score:this.score,runCoins:Pickups.runCoins,
      time:this.elapsed,nitroUses:Player.nitroUses,level:this.level});

    const set=(id,v)=>{ const el=$(id); if(el) el.textContent=v; };
    set('goScore',this.score); set('goBest',Save.get('bestScore'));
    set('goCoins',Pickups.runCoins); set('goLevel',this.level);

    const nr=$('newRecord'); if(nr) nr.classList.toggle('hidden',!isNew);
    const ua=$('unlockedAch');
    if(ua) ua.textContent=Achievements._newThisRun.length
      ?'🏆 '+Achievements._newThisRun.map(a=>a.name).join(', '):'' ;

    UI.showScreen('gameOver');
  }
};

/* ══════════════════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded',()=>{
  Game.init();
  UI.showScreen('mainMenu');
});
