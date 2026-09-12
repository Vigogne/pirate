/* game.js — 3v3 海战 MOBA：双基地 / 护航舰 / 英雄 / 相机 / 胜负 */
"use strict";

const Game = {
  state: 'menu',
  time: 0,
  score: 0,
  playerKills: 0,
  bases: [],
  heroes: [],
  minions: [],
  towers: [],
  monsters: [],
  mines: [],
  hazards: [],
  chests: [],
  beacons: [],
  teamBuffs: { 0: {}, 1: {} },
  floats: [],
  player: null,
  cam: { x: 0, y: 0 },
  paused: false,
  cheatOn: false,
  repairCD: 0,
  slowmo: 0,        // 击沉特写：慢动作剩余时间
  shake: 0,         // 屏幕震动强度
  zoomKick: 0,      // 击沉/爆炸的镜头轻推
  ambientT: 8,      // 环境音调度
  _prev: {},
  spawnTick: 0,
  spawnIdx: 0,
  unlocks: { 0: {}, 1: {} },
  _shieldMsg: { 0: false, 1: false },

  get units() { return this.heroes.concat(this.minions, this.towers, this.monsters, this.chests || []); },
  baseOf(team) { return this.bases.find(b => b.team === team); },
  towersOf(team) { return this.towers.filter(t => t.team === team && !t.dead); },
  // 多层护盾：一塔全拆前二塔无敌；二塔全拆前基地免伤
  towerOpen(t) {
    if (t.tier === 1) return true;
    return !this.towers.some(x => x.team === t.team && x.tier === 1 && !x.dead);
  },
  baseOpen(team) {
    return !this.towers.some(x => x.team === team && x.tier === 2 && !x.dead);
  },
  isUnlocked(team, key) { return !!(this.unlocks[team] && this.unlocks[team][key]); },

  /* ---- 海况：洋流 + 风 的单位推力 ---- */  applyDrift(u, dt, scale = 1) {
    let dx = Weather.windX(), dy = Weather.windY();
    for (const cu of CURRENTS) {
      const nx = (u.x - cu.x) / cu.rx, ny = (u.y - cu.y) / cu.ry;
      if (nx * nx + ny * ny <= 1) { dx += cu.ax * cu.force; dy += cu.ay * cu.force; }
    }
    if (dx || dy) { u.x += dx * scale * dt; u.y += dy * scale * dt; }
  },
  /* ---- 浅滩：大船（Ⅲ 大型船）减速，小艇不受影响 ---- */
  shoalMul(u) {
    const tier = u.hullDef ? u.hullDef.tier : 1;
    if (tier < 3) return 1;
    for (const s of SHOALS) {
      const nx = (u.x - s.x) / s.rx, ny = (u.y - s.y) / s.ry;
      if (nx * nx + ny * ny <= 1) return 0.72;
    }
    return 1;
  },

  /* 陆地/塔推挤：船会被陆地阻挡 */
  landResolve(u) {
    for (const l of LAND) {
      const mx = l.rx + u.rad * 0.6, my = l.ry + u.rad * 0.6;
      const dx = (u.x - l.x) / mx, dy = (u.y - l.y) / my;
      const n = dx * dx + dy * dy;
      if (n < 1) {
        let ex = dx, ey = dy;
        if (n < 1e-6) {
          // 正好在岛心：按来路反方向推出（避免零向量卡死）
          const vl = Math.hypot(u.vx || 0, u.vy || 0);
          if (vl > 1) { ex = -(u.vx || 0) / vl; ey = -(u.vy || 0) / vl; }
          else { ex = 0; ey = 1; }
        }
        const s = Math.min(1 / Math.sqrt(Math.max(n, 1e-6)), 2.5);
        u.x = l.x + ex * mx * s;
        u.y = l.y + ey * my * s;
      }
    }
  },

  init() {
    // 预建整个世界作为菜单背景（start 时会重新开局）
    this.newGame();
  },

  newGame() {
    this.time = 0;
    this.score = 0;
    this.playerKills = 0;
    this.base0 = { team: 0, x: BASES[0].x, y: BASES[0].y, hp: MOBA.baseHp, maxHp: MOBA.baseHp, rad: MOBA.baseRadius, dead: false };
    this.base1 = { team: 1, x: BASES[1].x, y: BASES[1].y, hp: MOBA.baseHp, maxHp: MOBA.baseHp, rad: MOBA.baseRadius, dead: false };
    this.bases = [this.base0, this.base1];

    const B0 = this.base0, B1 = this.base1;
    this.heroes = [
      new Ship(this, { team: 0, ai: false, name: '舢板号', x: B0.x - 20, y: B0.y - 190, lane: 1 }),
      new Ship(this, { team: 0, ai: true, name: '护卫号', x: B0.x - 150, y: B0.y - 200, lane: 0 }),
      new Ship(this, { team: 0, ai: true, name: '先锋号', x: B0.x + 150, y: B0.y - 200, lane: 2 }),
      new Ship(this, { team: 1, ai: true, name: '掠夺号', x: B1.x - 30, y: B1.y + 190, lane: 1 }),
      new Ship(this, { team: 1, ai: true, name: '屠夫号', x: B1.x - 150, y: B1.y + 200, lane: 0 }),
      new Ship(this, { team: 1, ai: true, name: '暗影号', x: B1.x + 150, y: B1.y + 200, lane: 2 }),
    ];
    this.player = this.heroes[0];

    this.towers = [];
    for (const td of TOWERS) {
      const t = new Tower(this, td);
      this.towers.push(t);
      // 塔下平台也阻挡船只
    }

    // 野区海兽 Boss
    this.monsters = [];
    for (const md of JUNGLE_BOSSES) this.monsters.push(new Monster(this, md));
    this.unlocks = { 0: { ink: false, fang: false }, 1: { ink: false, fang: false } };
    this._shieldMsg = { 0: false, 1: false };
    this._refreshShields();

    this.minions = [];
    this.mines = [];
    this.hazards = [];
    this.waveTier = 0;
    this.teamBuffs = { 0: {}, 1: {} };
    this.beacons = BEACONS.map(b => ({ x: b.x, y: b.y, r: b.r, team: null, prog: 0, t: rand(0, 6) }));
    this.chests = [];
    this.chestT = 18;
    this.floats = [];
    this.spawnTick = 1.5;
    this.spawnIdx = 0;
    this.paused = false;
    this.repairCD = 0;
    Projectiles.clear();
    Particles.clear();

    this.cam.x = 0;
    const vh0 = View.h / Settings.zoom;
    this.cam.y = clamp(this.player.y - vh0 * 0.5, 0, Math.max(0, WORLD.h - vh0));
  },

  start() {
    AudioFX.init(); AudioFX.resume();
    this.state = 'playing';
    this.newGame();
    UI.hideOverlays();
    UI.showHud();
    UI.toggleDock(false);
    UI.refresh();
    UI.toast('方向键控制舢板号！先拆敌塔再打基地，按住 ALT 查看射程', 3.2);
  },
  restart() { this.start(); },

  update(dt) {
    Water.update(dt);
    Map.update(dt);
    this._toggles();
    if (this.frozen()) return;

    const rdt = dt;
    // 击沉特写：短暂的慢动作 + 镜头震动
    if (this.slowmo > 0) {
      this.slowmo = Math.max(0, this.slowmo - rdt);
      dt = dt * 0.4;
    }
    this.shake = Math.max(0, this.shake - rdt * 1.6);
    this.zoomKick = Math.max(0, this.zoomKick - rdt * 0.22);

    // 环境音：海浪底噪 + 风暴雷声
    this.ambientT -= rdt;
    if (this.ambientT <= 0) {
      this.ambientT = rand(6, 11);
      const k = Weather.type === 'storm' ? 1.4 : (Weather.type === 'clear' ? 0.6 : 1.0);
      AudioFX.ambient(k);
      if (Weather.type === 'storm' && Math.random() < 0.45) AudioFX.thunder();
    }

    this.time += dt;

    // 基地持续自动生成护航舰
    this._spawnMinions(dt);
    // 修船冷却
    this.repairCD = Math.max(0, this.repairCD - dt);
    // 作弊：自动刷钱
    if (this.cheatOn) this.player.gold += MOBA.cheatGold * dt;

    for (const h of this.heroes) h.update(dt, this);
    for (const t of this.towers) t.update(dt, this);
    for (const m of this.minions) m.update(dt, this);
    for (const m of this.monsters) m.update(dt, this);
    this._updateMines(dt);
    this._updateBuffs(dt);
    this._updateBeacons(dt);
    this._updateChests(dt);
    this._updatePing(dt);
    this._updateHazards(dt);
    Ambient.update(dt, this);
    this.minions = this.minions.filter(m => !m.dead);
    this._refreshShields();

    Projectiles.update(dt, this);
    Particles.update(dt);

    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life -= dt; f.y -= 26 * dt;
      if (f.life <= 0) this.floats.splice(i, 1);
    }

    // 相机跟随玩家（五屏大地图 + 视野缩放：可见世界区 = 视口 / 缩放）
    const vw = View.w / Settings.zoom, vh = View.h / Settings.zoom;
    const targetY = vh >= WORLD.h ? (WORLD.h - vh) * 0.5 : clamp(this.player.y - vh * 0.5, 0, WORLD.h - vh);
    this.cam.y = lerp(this.cam.y, targetY, clamp(dt * 6, 0, 1));
    const targetX = vw >= WORLD.w ? (WORLD.w - vw) * 0.5 : clamp(this.player.x - vw * 0.5, 0, WORLD.w - vw);
    this.cam.x = lerp(this.cam.x, targetX, clamp(dt * 6, 0, 1));

    UI.refresh();
    this._dockProximity();
  },

  _toggles() {
    const p = this._prev;
    const one = (code, fn) => { if (Input.down(code) && !p[code]) fn(); p[code] = Input.down(code); };
    one('Space', () => { if (this.state === 'playing') { this.paused = !this.paused; UI.toast(this.paused ? '已暂停（空格继续）' : '继续作战', 1.0); } });
    one('KeyP', () => { if (this.state === 'playing') UI.toggleDock(); });
    one('KeyM', () => { AudioFX.muted = !AudioFX.muted; AudioFX.applyMute(); UI._syncSoundUI(); });
    one('KeyC', () => { if (this.state === 'playing') this.cheatMoney(); });
    one('KeyQ', () => { if (this.state === 'playing') this.useSkill(); });
    one('KeyE', () => { if (this.state === 'playing') this.useItem(0); });
    one('KeyR', () => { if (this.state === 'playing') this.useItem(1); });
  },

  frozen() { return this.state !== 'playing' || this.paused || UI.anyOverlay(); },

  /* 靠近己方船坞：提示可购买道具/升级（手机点按钮打开船坞） */
  _dockProximity() {
    const p = this.player;
    const own = this.baseOf(0);
    const near = !!(p && !p.dead && own && !own.dead && dist(p.x, p.y, own.x, own.y) < 430);
    UI.showDockHint(near && !UI.anyOverlay() && this.state === 'playing');
  },

  _spawnMinions(dt) {
    // 兵线成长：每 5 分钟全体护航舰强化
    const tier = Math.floor(this.time / MINION_GROW_T);
    if (tier > this.waveTier) {
      this.waveTier = tier;
      UI.announce(`⚔ 兵线强化 ${tier} 级：护航舰全体变强！`, true);
      UI.toast('双方补给出兵升级：护航舰血量与火力提升', 2.4);
      AudioFX.wave();
    }
    for (const b of this.bases) {
      if (b.dead) continue;
      b.spawnT = (b.spawnT === undefined ? 2.0 : b.spawnT) - dt;
      if (b.spawnT <= 0) {
        b.spawnT = MOBA.minionInterval;
        const teamCount = this.minions.reduce((n, m) => n + (m.team === b.team ? 1 : 0), 0);
        // 波次：常规波 1 只（30% 双只），每 4 波来一次“大队”（3 只 + 旗船/水雷船）
        b.wave = (b.wave === undefined ? 0 : b.wave) + 1;
        const big = b.wave % MINION_BIGWAVE === 0;
        const plan = big ? MINION_BIGWAVE_PLAN : [MINION_WAVE[b.wave % MINION_WAVE.length]];
        if (big && b.team === 0) {
          UI.announce('⚓ 我方大队护航舰出击！', true);
          AudioFX.wave();
        }
        for (let k2 = 0; k2 < plan.length; k2++) {
          if (teamCount + k2 >= MOBA.minionCap) break;
          this.minions.push(new Minion(this, b.team, (Math.random() * LANES.length) | 0, plan[k2]));
        }
        if (!big && Math.random() < 0.3 && teamCount + 1 < MOBA.minionCap) {
          this.minions.push(new Minion(this, b.team, (Math.random() * LANES.length) | 0, 'sloop'));
        }
      }
    }
  },

  /* ---- 水雷（水雷船布设，触敌引爆） ---- */
  addMine(src) {
    if (this.mines.length > 60) this.mines.shift();
    const dir = src.team === 0 ? 1 : -1;
    this.mines.push({
      x: src.x + rand(-16, 16), y: src.y + dir * 26,
      team: src.team, t: 0, arm: 1.2, life: 32, r: 34,
    });
  },

  _updateMines(dt) {
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const mi = this.mines[i];
      mi.t += dt; mi.life -= dt;
      if (mi.life <= 0) { this.mines.splice(i, 1); continue; }
      if (mi.t < mi.arm) continue;
      for (const u of this.units) {
        if (u.dead || u.invuln || u.team === mi.team || u.team === 2) continue;
        if (dist(mi.x, mi.y, u.x, u.y) < mi.r + (u.rad || 10)) {
          u.hitBy(72, mi.x, mi.y, this, null);
          Particles.explosion(mi.x, mi.y, 48, '#ff9d4d');
          Particles.splash(mi.x, mi.y, 1.4);
          AudioFX.explosion(true);
          this.mines.splice(i, 1);
          break;
        }
      }
    }
  },

  _drawMines(ctx) {
    for (const mi of this.mines) {
      if (!inView(mi.x, mi.y, 60)) continue;
      const armed = mi.t >= mi.arm;
      const blink = 0.5 + 0.5 * Math.sin(mi.t * 6 + mi.x);
      // 敌我区分：我方用队伍蓝 + 绿灯，敌方用红 + 红灯
      const mine1 = mi.team === 0;
      const shell = mine1 ? '#26343f' : '#3a2426';
      const shellHi = mine1 ? '#3f5866' : '#5e3236';
      const glow = mine1 ? '#7ef0a0' : '#ff6a5a';
      const ring = mine1 ? TEAM[0].color : TEAM[1].color;
      ctx.save();
      ctx.translate(mi.x, mi.y);
      // 归属色水圈（一眼分辨敌我）
      ctx.globalAlpha = 0.30 + blink * 0.12;
      ctx.strokeStyle = ring; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.stroke();
      // 雷体
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = shell;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill();
      ctx.fillStyle = shellHi;
      ctx.beginPath(); ctx.arc(-2, -2, 5, 0, TAU); ctx.fill();
      // 触角
      ctx.strokeStyle = mine1 ? '#1b252c' : '#2a1a1c';
      ctx.lineWidth = 2;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + mi.t * 0.4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
        ctx.lineTo(Math.cos(a) * 13, Math.sin(a) * 13);
        ctx.stroke();
      }
      // 指示灯（布设完成后按归属色闪）
      ctx.globalAlpha = armed ? 0.35 + blink * 0.65 : 0.25;
      ctx.fillStyle = armed ? glow : '#ffd76a';
      ctx.beginPath(); ctx.arc(0, 0, 2.8, 0, TAU); ctx.fill();
      if (armed) {
        ctx.globalAlpha = blink * 0.35;
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  },

  /* ---- 基地受击 / 胜负 ---- */
  damageBase(base, dmg, x, y, owner) {
    if (base.dead) return;
    // 防御塔还在：基地护盾，必须先拆塔
    if (!this.baseOpen(base.team)) {
      Particles.ring(x !== undefined ? x : base.x, y !== undefined ? y : base.y, 40, 'rgba(120,220,255,0.9)');
      return;
    }
    base.hp -= dmg;
    Particles.explosion(x !== undefined ? x : base.x, y !== undefined ? y : base.y, 36, '#ffb15a');
    if (base.hp <= 0) {
      base.hp = 0;
      base.dead = true;
      Particles.explosion(base.x, base.y, 170, '#ff7a2a', true);
      Particles.smoke(base.x, base.y, 26, 90);
      AudioFX.explosion(true);
      if (base.team === 1) this._victory();
      else this._gameover();
    }
  },

  addFloat(x, y, text, color) { this.floats.push({ x, y, text, life: 1.0, color }); },

  /* ---- 塔盾刷新：一塔全拆 → 二塔破防；二塔全拆 → 基地破防 ---- */
  _refreshShields() {
    for (const team of [0, 1]) {
      const t1AllDead = !this.towers.some(x => x.team === team && x.tier === 1 && !x.dead);
      for (const t of this.towers) {
        if (t.team !== team || t.dead) continue;
        if (t.tier === 1) t.invuln = false;
        else t.invuln = !t1AllDead;
      }
      if (t1AllDead && !this._shieldMsg[team]) {
        this._shieldMsg[team] = true;
        UI.toast(`${team === 0 ? '我方' : '敌方'}一塔全部摧毁，二塔护盾解除！`, 2.4);
      }
    }
  },

  /* ---- 毒雾区域（九头蛇毒雾弹落点）：持续伤害 + 区域封锁 ---- */
  addHazard(x, y, r, dur, dps, owner) {
    this.hazards.push({ x, y, r, t: dur, max: dur, dps, owner, seed: Math.random() * 100 });
  },

  _updateHazards(dt) {
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.t -= dt;
      if (h.t <= 0) { this.hazards.splice(i, 1); continue; }
      // 冒泡（毒雾视觉）
      if (Math.random() < dt * 6) {
        Particles.spawn({
          type: 'smoke', layer: 'low',
          x: h.x + rand(-h.r * 0.7, h.r * 0.7), y: h.y + rand(-h.r * 0.6, h.r * 0.6),
          vx: rand(-5, 5), vy: rand(-16, -6),
          life: rand(0.6, 1.2), max: 1.2, size: rand(4, 9), grow: 7,
          color: '#5aa86a', drag: 0.95,
        });
      }
      // 伤害：毒云伤双方舰船（不伤中立与宝箱）
      for (const u of this.units) {
        if (u.dead || u.invuln || u.team === 2 || u.isChest) continue;
        if (dist(h.x, h.y, u.x, u.y) > h.r + (u.rad || 8)) continue;
        u.hitBy(h.dps * dt, undefined, undefined, this, h.owner || null);
      }
    }
  },

  _drawHazards(ctx) {
    for (const h of this.hazards) {
      if (!inView(h.x, h.y, 80)) continue;
      const k = clamp(h.t / h.max, 0, 1);
      const pulse = 0.5 + 0.5 * Math.sin(h.seed + this.time * 2.2);
      ctx.save();
      // 毒雾底盘
      const g = ctx.createRadialGradient(h.x, h.y, h.r * 0.15, h.x, h.y, h.r);
      g.addColorStop(0, `rgba(96,190,112,${0.30 * k + 0.10})`);
      g.addColorStop(0.65, `rgba(70,160,96,${0.22 * k})`);
      g.addColorStop(1, 'rgba(60,140,90,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.fill();
      // 边界气泡环
      ctx.globalAlpha = 0.35 * k + pulse * 0.15;
      ctx.strokeStyle = '#8fe0a0';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 9]);
      ctx.lineDashOffset = -this.time * 26;
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r * (0.9 + pulse * 0.08), 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      // 内部毒泡
      ctx.globalAlpha = 0.25 * k;
      ctx.fillStyle = '#bff2c4';
      for (let i = 0; i < 7; i++) {
        const a = h.seed + i * 0.9 + this.time * 0.7;
        const rr = h.r * (0.2 + ((i * 37) % 60) / 100);
        const bx = h.x + Math.cos(a) * rr;
        const by = h.y + Math.sin(a * 1.3) * rr * 0.7;
        ctx.beginPath(); ctx.arc(bx, by, 3 + (i % 3), 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  },

  /* ---- 玩家指令标记（给 AI 队友发信号） ---- */
  /* 点击小地图 → 转成世界坐标发指令 */
  minimapPing(px, py) {
    const r = this._mmRect;
    if (!r) return false;
    if (px < r.mx - 6 || px > r.mx + r.mw + 6 || py < r.my - 6 || py > r.my + r.mh + 6) return false;
    this.sendPing((px - r.mx) / r.sx, (py - r.my) / r.sy);
    return true;
  },

  sendPing(wx, wy, type) {
    const t = type || Settings.pingType || 'gather';
    const def = PINGS.find(p => p.id === t) || PINGS[0];
    this.ping = { x: clamp(wx, 0, WORLD.w), y: clamp(wy, 0, WORLD.h), type: def.id, t: 2.6, born: 0 };
    UI.toast(`📣 ${def.icon} ${def.name}：${def.desc}`, 1.6);
    AudioFX.wave();
  },

  _updatePing(dt) {
    if (this.ping) {
      this.ping.t -= dt;
      this.ping.born += dt;
      if (this.ping.t <= 0) this.ping = null;
    }
  },

  _drawPing(ctx) {
    const p = this.ping;
    if (!p) return;
    const def = PINGS.find(x => x.id === p.type) || PINGS[0];
    const k = clamp(p.born / 0.6, 0, 1);
    ctx.save();
    ctx.translate(p.x, p.y);
    // 扩散圆环
    for (let i = 0; i < 3; i++) {
      const rr = 12 + ((p.born * 46 + i * 24) % 72);
      ctx.globalAlpha = clamp(0.55 * (1 - rr / 84) * (p.t / 2.6 + 0.3), 0, 0.8);
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
    }
    // 中心图标
    ctx.globalAlpha = clamp(p.t / 1.2, 0, 1);
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(def.icon, 0, 8);
    ctx.restore();
  },

  /* ---- 野区 Boss 击杀结算（赏金已在斩杀结算中发放，这里解锁装备 + 团队增益） ---- */
  onBossDeath(m, killer) {
    const team = killer && killer.team !== undefined && killer.team !== 2 ? killer.team : 0;
    if (m.reward && WEAPONS[m.reward]) {
      // 同时记录 装备id 与 Boss类型 两个键，解锁查询两路都通
      this.unlocks[team][m.reward] = true;
      this.unlocks[team][m.type] = true;
      UI.announce(`${m.name} 被击败！解锁「${WEAPONS[m.reward].name}」`, true);
      UI.toast(`野区奖励：已解锁特殊装备「${WEAPONS[m.reward].name}」！去船坞装备吧`, 3.0);
    } else {
      UI.announce(`${m.name} 被击败！`, true);
    }
    if (m.buff && TEAM_BUFFS[m.buff]) this.grantBuff(team, m.buff, `击败 ${m.name}`);
    AudioFX.coin();
  },

  /* ---- 团队增益 ---- */
  grantBuff(team, id, reason) {
    const def = TEAM_BUFFS[id];
    if (!def) return;
    this.teamBuffs[team][id] = def.dur;
    const who = team === 0 ? '我方' : '敌方';
    UI.toast(`${def.icon} ${who}获得「${def.name}」：${def.desc}（${def.dur}s）`, 2.6);
    if (reason) UI.announce(`${def.icon} ${who}·${def.name}（${reason}）`, team === 0);
    AudioFX.upgrade();
    this._buffVer = (this._buffVer || 0) + 1;
  },

  buffOn(team, id) { return (this.teamBuffs[team] && this.teamBuffs[team][id] > 0); },
  _updateBuffs(dt) {
    for (const team of [0, 1]) {
      const b = this.teamBuffs[team];
      for (const k in b) {
        b[k] -= dt;
        if (b[k] <= 0) delete b[k];
      }
    }
  },
  /* 灯塔带来的全队航速加成 */
  beaconSpeedMul(team) {
    let n = 0;
    for (const bc of this.beacons) if (bc.team === team) n++;
    return 1 + BEACON.speedPer * n;
  },

  /* ---- 中立灯塔：站桩占领，全队加速 + 范围治疗 ---- */
  _updateBeacons(dt) {
    for (const bc of this.beacons) {
      bc.t = (bc.t || 0) + dt;
      let c0 = 0, c1 = 0;
      for (const u of this.heroes.concat(this.minions)) {
        if (u.dead) continue;
        if (dist(bc.x, bc.y, u.x, u.y) > bc.r) continue;
        if (u.team === 0) c0++; else c1++;
      }
      const solo = (c0 > 0) !== (c1 > 0);            // 仅一方在场才推进
      if (solo) {
        const team = c0 > 0 ? 0 : 1;
        const rate = dt / BEACON.captureTime * Math.min(2, Math.max(c0, c1));
        if (bc.team === team) {
          bc.prog = 1;
        } else {
          bc.prog = (bc.prog || 0) + rate;
          if (bc.prog >= 1) {
            bc.team = team;
            bc.prog = 1;
            UI.announce(`🗼 ${team === 0 ? '我方' : '敌方'}占领了灯塔！全队航速提升`, team === 0);
            AudioFX.wave();
          }
        }
      } else if (!solo) {
        // 争夺中：进度缓慢回落
        bc.prog = Math.max(0, (bc.prog || 0) - dt * 0.05);
        if (bc.prog === 0 && bc.team !== null && bc.team !== undefined) {
          // 无人占领时不清空归属，只是不再推进
        }
      }
      // 治疗范围内友军
      if (bc.team === 0 || bc.team === 1) {
        for (const u of this.heroes) {
          if (u.dead || u.team !== bc.team) continue;
          if (dist(bc.x, bc.y, u.x, u.y) > BEACON.healR) continue;
          if (u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + BEACON.heal * dt);
        }
      }
    }
  },

  /* ---- 海底宝箱 ---- */
  _updateChests(dt) {
    this.chestT = (this.chestT === undefined ? 18 : this.chestT) - dt;
    if (this.chestT <= 0) {
      this.chestT = CHEST.keep;
      if (this.chests.filter(c => !c.dead).length < CHEST.max) {
        const spot = CHEST_SPOTS[(Math.random() * CHEST_SPOTS.length) | 0];
        if (!this.chests.some(c => !c.dead && dist(c.x, c.y, spot.x, spot.y) < 120)) {
          this.chests.push(this._makeChest(spot.x, spot.y));
        }
      }
    }
    for (const cu of this.chests) {
      if (cu.dead) continue;
      cu.t += dt;
      cu.life -= dt;
      if (cu.life <= 0) { cu.dead = true; Particles.splash(cu.x, cu.y, 1); }
    }
    this.chests = this.chests.filter(c => !c.dead);
  },

  _makeChest(x, y) {
    const chest = {
      x, y, rad: CHEST.rad, maxHp: CHEST.hp, hp: CHEST.hp,
      dead: false, isChest: true, team: 2, t: 0, life: 150, flash: 0,
      hitBy(dmg, ix, iy, game, killer) {
        if (this.dead) return;
        this.hp -= dmg;
        this.flash = 0.12;
        if (ix !== undefined) Particles.spark(ix, iy, rand(0, TAU), 4, '#ffd76a');
        if (this.hp <= 0) {
          this.hp = 0;
          this.dead = true;
          const gold = Math.round(rand(CHEST.gold[0], CHEST.gold[1]));
          const team = killer && killer.team !== undefined && killer.team !== 2 ? killer.team : 0;
          if (killer && killer.isHero && !killer.dead) {
            killer.gold += gold;
            game.addFloat(this.x, this.y - 26, '+' + gold, '#ffd76a');
          }
          const keys = Object.keys(TEAM_BUFFS);
          game.grantBuff(team, keys[(Math.random() * keys.length) | 0], '开宝箱');
          Particles.explosion(this.x, this.y, 60, '#ffd76a');
          Particles.ring(this.x, this.y, 70, 'rgba(255,215,106,0.9)');
          AudioFX.coin();
        }
      },
    };
    return chest;
  },

  _drawChests(ctx) {
    for (const cu of this.chests) {
      if (!inView(cu.x, cu.y, 80)) continue;
      const bob = Math.sin(cu.t * 2) * 2;
      const blink = 0.5 + 0.5 * Math.sin(cu.t * 4);
      ctx.save();
      ctx.translate(cu.x, cu.y + bob);
      // 光晕
      ctx.globalAlpha = 0.25 + blink * 0.25;
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 40);
      g.addColorStop(0, 'rgba(255,215,106,0.8)');
      g.addColorStop(1, 'rgba(255,215,106,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, 40, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      // 箱体
      ctx.fillStyle = '#7a5330';
      ctx.fillRect(-16, -10, 32, 20);
      ctx.fillStyle = '#9a6a3e';
      ctx.fillRect(-16, -10, 32, 5);
      ctx.strokeStyle = '#3f2c17'; ctx.lineWidth = 2;
      ctx.strokeRect(-16, -10, 32, 20);
      // 金饰 + 锁
      ctx.fillStyle = '#ffd76a';
      ctx.fillRect(-16, -3, 32, 3);
      ctx.fillRect(-3, -8, 6, 16);
      ctx.fillStyle = '#ffefb0';
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill();
      // 血条（受损后）
      if (cu.hp < cu.maxHp) {
        const w = 34, h = 4;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(-w / 2, -26, w, h);
        ctx.fillStyle = '#ffd76a';
        ctx.fillRect(-w / 2, -26, w * clamp(cu.hp / cu.maxHp, 0, 1), h);
      }
      if (cu.flash > 0) {
        ctx.globalAlpha = cu.flash / 0.12 * 0.8;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.strokeRect(-16, -10, 32, 20);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  },

  /* ---- 灯塔绘制：石塔 + 旋转光柱 + 归属旗 + 占领进度环 ---- */
  _drawBeacons(ctx) {
    for (const bc of this.beacons) {
      if (!inView(bc.x, bc.y, 260)) continue;
      const col = bc.team === 0 ? TEAM[0].color : (bc.team === 1 ? TEAM[1].color : '#9aa3ac');
      const pulse = 0.5 + 0.5 * Math.sin((bc.t || 0) * 1.6);
      ctx.save();
      ctx.translate(bc.x, bc.y);
      // 占领范围
      ctx.globalAlpha = 0.10 + (bc.team === null || bc.team === undefined ? 0.05 : 0);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0, 0, bc.r, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath(); ctx.arc(0, 0, bc.r, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      // 礁石基座 + 塔身
      ctx.fillStyle = '#5a6157';
      ctx.beginPath(); ctx.ellipse(0, 14, 34, 16, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#8a917f';
      ctx.beginPath();
      ctx.moveTo(-16, 12); ctx.lineTo(-12, -30); ctx.lineTo(12, -30); ctx.lineTo(16, 12);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#3f4640'; ctx.lineWidth = 2; ctx.stroke();
      // 石纹
      ctx.strokeStyle = 'rgba(60,70,60,0.5)'; ctx.lineWidth = 1.2;
      for (let y = -22; y < 10; y += 10) { ctx.beginPath(); ctx.moveTo(-14, y); ctx.lineTo(14, y); ctx.stroke(); }
      // 灯室 + 旋转光柱
      ctx.fillStyle = '#3a4152';
      ctx.fillRect(-11, -42, 22, 13);
      ctx.fillStyle = `rgba(255,240,180,${0.55 + pulse * 0.45})`;
      ctx.fillRect(-7, -39, 14, 8);
      const beam = (bc.t || 0) * 0.6;
      ctx.globalAlpha = 0.22 + pulse * 0.16;
      ctx.fillStyle = '#fff3c0';
      ctx.beginPath();
      ctx.moveTo(0, -36);
      ctx.lineTo(Math.cos(beam - 0.18) * 150, -36 + Math.sin(beam - 0.18) * 90);
      ctx.lineTo(Math.cos(beam + 0.18) * 150, -36 + Math.sin(beam + 0.18) * 90);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      // 归属旗
      if (bc.team === 0 || bc.team === 1) {
        ctx.strokeStyle = '#2a1c0e'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -42); ctx.lineTo(0, -66); ctx.stroke();
        const fl = Math.sin((bc.t || 0) * 4) * 2;
        ctx.fillStyle = TEAM[bc.team].color;
        ctx.beginPath();
        ctx.moveTo(0, -66); ctx.lineTo(16 + fl, -60); ctx.lineTo(0, -54);
        ctx.closePath(); ctx.fill();
      }
      // 占领进度环
      if (bc.prog > 0.01 && bc.prog < 1) {
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, -12, 46, -Math.PI / 2, -Math.PI / 2 + TAU * bc.prog);
        ctx.stroke();
      }
      ctx.restore();
    }
  },

  /* ---- 玩家可打的宝箱列表（供武器索敌） ---- */
  chestsInRange(x, y, range) {
    const out = [];
    for (const cu of this.chests) {
      if (cu.dead) continue;
      if (dist(x, y, cu.x, cu.y) <= range) out.push(cu);
    }
    return out;
  },

  // 英雄被击沉的屏幕中央播报（含击沉特写：慢动作 + 镜头震动）
  announceHeroDeath(victim, killer) {
    const killerName = killer && killer.name ? killer.name : '海怪';
    const text = `${victim.name} 被 ${killerName} 击沉！`;
    const good = victim.team === 1;   // 敌方英雄阵亡 = 好消息
    UI.announce(text, good);
    this.slowmo = 0.5;
    this.shake = good ? 0.9 : 1.15;
    this.zoomKick = good ? 0.05 : 0.075;
    Particles.ring(victim.x, victim.y, 90, good ? 'rgba(126,240,160,0.9)' : 'rgba(255,140,110,0.9)');
    AudioFX.explosion(true);
  },

  /* ---- 玩家装备 / 升级（金币在玩家舰上） ---- */
  equipWeapon(slotIndex, weaponId, cost) {
    const slot = this.player.slots[slotIndex];
    if (slot.weaponId === weaponId) return;
    if (this.player.gold < cost) return;
    const oldId = slot.weaponId;
    const refund = WEAPON_BASE_COST[oldId] || 0;   // 旧武器按原价卖出
    this.player.gold -= cost;
    this.player.gold += refund;
    slot.weaponId = weaponId;
    slot.level = 1;
    this.player.recompute();
    UI.flashSlot(slotIndex);
    UI.toast(`已装备 ${WEAPONS[weaponId].name}${refund > 0 ? '，旧武器原价卖出 +' + refund + '💰' : ''}`, 2.0);
    AudioFX.upgrade();
    UI.refresh();
  },

  upgradeWeapon(slotIndex) {
    const s = this.player.slots[slotIndex];
    const maxLv = weaponMaxLevel(s.weaponId);
    if (s.level >= maxLv) { UI.toast(maxLv <= 1 ? '该武器无法升级（高性价比入门炮）' : '该武器已满级'); return; }
    // 武器熟练度：同一门炮打得越多，升级越便宜（最多 -35%）
    const cost = Math.max(20, Math.round(weaponUpgradeCost(s.weaponId, s.level) * this.player.masteryMul(s.weaponId)));
    if (this.player.gold < cost) { UI.toast('金币不足'); return; }
    this.player.gold -= cost;
    s.level++;
    this.player.recompute();
    UI.flashSlot(slotIndex);
    UI.toast(`${WEAPONS[s.weaponId].name} 升到 Lv.${s.level}!`, 1.4);
    AudioFX.upgrade();
    UI.refresh();
  },

  /* ---- 船体（选择型，自带技能且可升级；旧船体原价卖回） ---- */
  buyHull(id) {
    const p = this.player;
    const next = HULLS.find(h => h.id === id);
    if (!next) return;
    if (p.hullId === id) { UI.toast('已是该船体'); return; }
    // 生物舰需先击败两大海兽
    if (next.unlock === 'boss' && !(this.isUnlocked(0, 'octopus') && this.isUnlocked(0, 'shark'))) {
      UI.toast('🔒 生物型船体：先分别击败深海章鱼与猎鲨王', 2.4);
      return;
    }
    if (p.gold < next.cost) { UI.toast('金币不足'); return; }
    const oldRefund = p.hullDef ? p.hullDef.cost : 0;
    const oldMax = p.maxHp;
    p.gold -= next.cost;
    p.gold += oldRefund;
    p.hullId = id;
    p.growSlots(next.slots || 4);          // 船体升级 → 解锁更多炮位
    p.recompute();
    p.hp = Math.min(p.maxHp, p.hp + Math.max(0, p.maxHp - oldMax));
    UI.toast(`已换装「${next.name}」（${HULL_TIER_NAME[next.tier]} · ${next.slots} 炮位）· 技能：${next.skill.icon} ${next.skill.name}（Q 释放）`, 2.8);
    AudioFX.upgrade();
    UI.refresh();
  },

  /* ---- 强化当前船体（每种船体独立等级，最高 5 级） ---- */
  upgradeHull() {
    const p = this.player;
    const lv = p.hullLv[p.hullId] || 1;
    if (lv >= HULL_MAX_LV) { UI.toast('该船体已满级'); return; }
    const cost = hullLevelCost(p.hullId, lv);
    if (p.gold < cost) { UI.toast('金币不足'); return; }
    p.gold -= cost;
    p.hullLv[p.hullId] = lv + 1;
    const oldMax = p.maxHp;
    p.recompute();
    p.hp = Math.min(p.maxHp, p.hp + (p.maxHp - oldMax));
    UI.toast(`${p.hullDef.name} 强化到 Lv.${lv + 1}！`, 1.5);
    AudioFX.upgrade();
    UI.refresh();
  },

  /* ---- 释放船体技能（Q / 手机按钮） ---- */
  useSkill() {
    const p = this.player;
    if (p.dead) return;
    if (p.skillCd > 0) { UI.toast(`技能冷却中 ${Math.ceil(p.skillCd)}s`); return; }
    if (p.tryActivateSkill()) {
      UI.toast(`${p.hullDef.skill.icon} ${p.hullDef.skill.name}！`, 1.2);
    }
  },

  /* ---- 船长等级 → 天赋三选一（玩家弹面板，AI 自动） ---- */
  onPlayerLevel(p) {
    if (p.pendingTalent <= 0) return;
    const pool = TALENTS.slice();
    // 随机抽 3 个不同天赋（已点满的仍可出现，作为叠加）
    const offer = [];
    while (offer.length < 3 && pool.length) {
      offer.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
    }
    UI.announce(`⭐ 船长升到 Lv.${p.level}——选择天赋！`, true);
    AudioFX.upgrade();
    UI.openTalents(offer, p.pendingTalent);
  },

  chooseTalent(id) {
    const p = this.player;
    p.applyTalent(id);
    UI.refresh();
    if (p.pendingTalent > 0) this.onPlayerLevel(p);
    else UI.closeTalents();
  },

  /* ---- 主动道具 ---- */
  buyItem(slot, id) {
    const p = this.player;
    const def = ITEMS[id];
    if (!def) return;
    if (p.items[slot] === id) { UI.toast('该道具已在装备栏'); return; }
    if (p.gold < def.cost) { UI.toast('金币不足'); return; }
    p.gold -= def.cost;
    p.items[slot] = id;
    UI.toast(`已装备道具 ${def.icon} ${def.name}（${slot === 0 ? 'E' : 'R'} 键释放）`, 2.2);
    AudioFX.upgrade();
    UI.refresh();
  },

  useItem(slot) {
    const p = this.player;
    if (p.dead) return;
    const id = p.items[slot];
    if (!id) { UI.toast('该道具栏为空（船坞里购买）'); return; }
    if (p.itemCd[slot] > 0) { UI.toast(`道具冷却中 ${Math.ceil(p.itemCd[slot])}s`); return; }
    if (p.useItem(slot, this)) UI.toast(`${ITEMS[id].icon} ${ITEMS[id].name}！`, 1.1);
  },

  upgradeModule(kind) {
    const p = this.player;
    let arr, tier;
    if (kind === 'sail') { arr = SAILS; tier = p.tierSail; }
    else { arr = ARMORS; tier = p.tierArmor; }
    if (tier >= arr.length - 1) { UI.toast('已最高级'); return; }
    const next = arr[tier + 1];
    if (p.gold < next.cost) { UI.toast('金币不足'); return; }
    p.gold -= next.cost;
    const oldMax = p.maxHp;
    if (kind === 'sail') p.tierSail++;
    else p.tierArmor++;
    p.recompute();
    if (kind === 'armor') p.hp = Math.min(p.maxHp, p.hp + (p.maxHp - oldMax));
    UI.toast(`已强化 ${next.name}`, 1.4);
    AudioFX.upgrade();
    UI.refresh();
  },

  repairShip() {
    const s = this.player;
    if (this.repairCD > 0) { UI.toast(`修理冷却中 ${Math.ceil(this.repairCD)}s`); return; }
    if (s.dead) { UI.toast('等待重生……'); return; }
    if (s.hp >= s.maxHp) { UI.toast('战船已满血'); return; }
    const cost = s.repairCost();
    if (s.gold < cost) { UI.toast('金币不足'); return; }
    s.gold -= cost;
    s.hp = s.maxHp;
    s.disabled = false;
    this.repairCD = MOBA.repairCD;
    Particles.splash(s.x, s.y, 1.5);
    Particles.ring(s.x, s.y, 60, 'rgba(126,240,160,0.9)');
    UI.toast('战船已修复！', 1.4);
    AudioFX.upgrade();
    UI.refresh();
  },

  /* ---- 作弊 ---- */
  cheatMoney() {
    if (this.state !== 'playing') return;
    this.player.gold += MOBA.cheatGold;
    AudioFX.coin();
    UI.toast(`作弊成功 +${MOBA.cheatGold} 💰`, 1.2);
    UI.refresh();   // 立刻刷新界面（船坞打开时也不会等关闭才更新）
  },

  _gameover() {
    this.state = 'gameover';
    const stats = `我方基地被摧毁！<br/>坚持了 <b>${this._mmss()}</b><br/>舢板号击杀 <b>${this.playerKills}</b> 艘敌舰`;
    UI.showGameover(stats);
    UI.hideHud();
  },
  _victory() {
    this.state = 'victory';
    AudioFX.win();
    const stats = `敌方基地被摧毁！<br/>用时 <b>${this._mmss()}</b><br/>舢板号击杀 <b>${this.playerKills}</b> 艘敌舰<br/>剩余金币 <b>${fmt(this.player.gold)}</b>`;
    UI.showVictory(stats);
    UI.hideHud();
  },
  _mmss() {
    const t = Math.floor(this.time);
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  },

  /* ---- 渲染 ---- */
  render() {
    const ctx = Render.ctx;
    ctx.save();
    // 世界坐标 -> 相机偏移（含视野缩放 + 击沉特写震动/轻推）
    const sh = this.shake;
    const ox = sh > 0 ? rand(-1, 1) * sh * 13 : 0;
    const oy = sh > 0 ? rand(-1, 1) * sh * 13 : 0;
    const z = Settings.zoom * (1 + this.zoomKick);
    ctx.scale(z, z);
    ctx.translate(-Math.round(this.cam.x + ox), -Math.round(this.cam.y + oy));

    Water.draw(ctx);
    Map.draw(ctx, this);
    this._drawBeacons(ctx);
    this._drawMines(ctx);                 // 水雷贴在水面，位于所有单位之下
    this._drawHazards(ctx);               // 毒雾区域（九头蛇）
    Particles.draw(ctx, 'low');
    Ambient.draw(ctx, 'low');
    for (const t of this.towers) if (inView(t.x, t.y, 140)) t.draw(ctx);
    for (const m of this.monsters) if (inView(m.x, m.y, 200)) m.draw(ctx);
    this._drawChests(ctx);
    for (const m of this.minions) if (inView(m.x, m.y, 120)) m.draw(ctx);
    for (const h of this.heroes) if (inView(h.x, h.y, 160)) h.draw(ctx, h === this.player);
    Projectiles.draw(ctx);
    Ambient.draw(ctx, 'high');            // 海鸥在船之上飞过
    Particles.draw(ctx, 'high');
    this._drawPing(ctx);
    this._drawFloats(ctx);

    ctx.restore();

    // 屏幕空间：暗角 / 天候 / 小地图 / 武器冷却面板 / 摇杆 / 暂停
    Map._vignette(ctx, View.w, View.h);
    if (typeof Weather !== 'undefined') Water.drawWeatherOverlay(ctx, View.w, View.h);
    this._drawMinimap(ctx);
    if (this.state === 'playing' && !UI.anyOverlay()) this._drawWeaponStatus(ctx);
    this._drawJoystick(ctx);

    if (this.paused && this.state === 'playing') {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, 0, View.w, View.h);
      ctx.fillStyle = '#ffe9b0';
      ctx.font = 'bold 38px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('⏸ 已暂停', View.w / 2, View.h / 2);
    }
  },

  // 移动端虚拟摇杆（柔和光晕底盘 + 刻度环 + 渐变摇杆头 + 方向箭头）
  _drawJoystick(ctx) {
    const j = Input.joystickDraw();
    if (!j) return;
    const r = j.r;
    const dx0 = j.kx - j.cx, dy0 = j.ky - j.cy;
    const dl = Math.hypot(dx0, dy0);
    const power = clamp(dl / r, 0, 1);
    ctx.save();

    // 底盘光晕
    const g = ctx.createRadialGradient(j.cx, j.cy, r * 0.15, j.cx, j.cy, r * 1.3);
    g.addColorStop(0, 'rgba(12,44,70,0.46)');
    g.addColorStop(0.7, 'rgba(8,30,48,0.3)');
    g.addColorStop(1, 'rgba(8,30,48,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(j.cx, j.cy, r * 1.3, 0, TAU); ctx.fill();

    // 双层外环
    ctx.strokeStyle = `rgba(154,220,255,${0.35 + power * 0.35})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(j.cx, j.cy, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(154,220,255,0.18)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(j.cx, j.cy, r * 0.76, 0, TAU); ctx.stroke();

    // 八向刻度
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ctx.strokeStyle = `rgba(200,240,255,${i % 2 ? 0.2 : 0.42})`;
      ctx.beginPath();
      ctx.moveTo(j.cx + Math.cos(a) * r * 0.87, j.cy + Math.sin(a) * r * 0.87);
      ctx.lineTo(j.cx + Math.cos(a) * r * 0.98, j.cy + Math.sin(a) * r * 0.98);
      ctx.stroke();
    }

    // 方向指示扇（拖动方向）
    if (dl > 3) {
      const a = Math.atan2(dy0, dx0);
      ctx.globalAlpha = 0.18 + power * 0.22;
      ctx.fillStyle = '#9adcff';
      ctx.beginPath();
      ctx.moveTo(j.cx, j.cy);
      ctx.arc(j.cx, j.cy, r * 0.86, a - 0.42, a + 0.42);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 摇杆头（渐变球 + 高光 + 描边）
    const kg = ctx.createRadialGradient(j.kx - r * 0.18, j.ky - r * 0.22, 2, j.kx, j.ky, r * 0.54);
    kg.addColorStop(0, 'rgba(232,250,255,0.96)');
    kg.addColorStop(0.5, 'rgba(146,212,242,0.9)');
    kg.addColorStop(1, 'rgba(54,118,158,0.72)');
    ctx.fillStyle = kg;
    ctx.beginPath(); ctx.arc(j.kx, j.ky, r * 0.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.62)';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(j.kx, j.ky, r * 0.5, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(j.kx - r * 0.15, j.ky - r * 0.17, r * 0.12, 0, TAU); ctx.fill();

    // 拖动力度环（围绕摇杆头的一圈进度）
    if (power > 0.02) {
      ctx.strokeStyle = 'rgba(255,215,106,0.75)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(j.kx, j.ky, r * 0.62, -Math.PI / 2, -Math.PI / 2 + TAU * power);
      ctx.stroke();
    }
    ctx.restore();
  },

  /* 武器冷却状态（装备图标 + 冷却遮罩） */
  _drawWeaponStatus(ctx) {
    const p = this.player;
    if (!p) return;
    const cell = 52, gap = 8;
    const n = p.slots.length;
    const x0 = 14, y0 = View.h - cell - 14;
    ctx.save();
    ctx.textAlign = 'center';
    for (let i = 0; i < n; i++) {
      const slot = p.slots[i];
      const st = weaponStats(slot.weaponId, slot.level);
      const maxCd = (1 / st.rate) * p.reloadMul;
      const frac = maxCd > 0 ? clamp(slot.cd / maxCd, 0, 1) : 0;
      const x = x0 + i * (cell + gap), y = y0;

      // 底框
      ctx.fillStyle = 'rgba(8,30,48,0.9)';
      roundRect(ctx, x, y, cell, cell, 9); ctx.fill();
      ctx.strokeStyle = 'rgba(255,215,106,0.35)';
      ctx.lineWidth = 1.2;
      roundRect(ctx, x, y, cell, cell, 9); ctx.stroke();

      // 装备图标
      ctx.font = '24px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(st.def.icon, x + cell / 2, y + cell / 2 + 8);

      // 冷却遮罩（自下而上消退）
      if (frac > 0) {
        ctx.fillStyle = 'rgba(2,10,18,0.72)';
        roundRect(ctx, x + 2, y + 2, cell - 4, (cell - 4) * frac, 7); ctx.fill();
      }
      // 等级星
      if (slot.level > 1) {
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#ffd76a';
        ctx.fillText('★'.repeat(slot.level - 1), x + cell / 2, y + cell - 4);
      }
      // 就绪闪光
      if (frac <= 0) {
        ctx.strokeStyle = 'rgba(126,240,160,0.55)';
        ctx.lineWidth = 2;
        roundRect(ctx, x, y, cell, cell, 9); ctx.stroke();
      }
    }
    ctx.font = '11px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    const rangeOn = Input.down('ControlLeft') || Input.down('ControlRight') || UI.rangeOn;
    const tip = rangeOn ? '射程显示中（CTRL/🎯 切换）' : 'CTRL 或点 🎯 查看武器射程';
    ctx.textAlign = 'left';
    ctx.fillText(tip, x0, y0 - 6);
    ctx.restore();
  },

  _drawFloats(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    for (const f of this.floats) {
      ctx.globalAlpha = clamp(f.life, 0, 1);
      ctx.fillStyle = f.color;
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  },

  _drawMinimap(ctx) {
    // 小屏用更小的地图并整体下移，避开顶部信息条
    const small = View.w < 900 || View.h < 480;
    const mw = small ? 52 : 66;
    const mh = Math.round(mw * WORLD.h / WORLD.w);
    const topPad = small ? 74 : 66;
    const mx = View.w - mw - (small ? 8 : 14), my = topPad;
    const sx = mw / WORLD.w, sy = mh / WORLD.h;
    this._mmRect = { mx, my, mw, mh, sx, sy };   // 供点击小地图发指令

    ctx.save();
    ctx.fillStyle = 'rgba(4, 22, 38, 0.82)';
    roundRect(ctx, mx - 4, my - 4, mw + 8, mh + 8, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,106,0.4)'; ctx.lineWidth = 1;
    roundRect(ctx, mx - 4, my - 4, mw + 8, mh + 8, 6); ctx.stroke();

    // 兵线
    ctx.strokeStyle = 'rgba(150,200,220,0.25)';
    ctx.setLineDash([3, 4]);
    for (const lx of LANES) {
      ctx.beginPath(); ctx.moveTo(mx + lx * sx, my); ctx.lineTo(mx + lx * sx, my + mh); ctx.stroke();
    }
    ctx.setLineDash([]);

    // 基地（塔未拆完为半透明护盾态）
    for (const b of this.bases) {
      ctx.globalAlpha = this.baseOpen(b.team) ? 1 : 0.45;
      ctx.fillStyle = TEAM[b.team].color;
      ctx.fillRect(mx + b.x * sx - 4, my + b.y * sy - 4, 8, 8);
      ctx.globalAlpha = 1;
    }
    // 防御塔
    for (const t of this.towers) {
      if (t.dead) { ctx.fillStyle = 'rgba(110,110,110,0.4)'; }
      else ctx.fillStyle = TEAM[t.team].color;
      ctx.globalAlpha = t.invuln ? 0.5 : 1;
      const tx = mx + t.x * sx, ty = my + t.y * sy;
      ctx.beginPath();
      ctx.moveTo(tx, ty - 3.4); ctx.lineTo(tx + 3.4, ty); ctx.lineTo(tx, ty + 3.4); ctx.lineTo(tx - 3.4, ty);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // 野区 Boss（菱形标记）
    for (const m of this.monsters) {
      ctx.fillStyle = '#b48aff';
      ctx.globalAlpha = m.dead ? 0.3 : 0.9;
      const tx = mx + m.x * sx, ty = my + m.y * sy;
      cla(ctx, tx, ty, 4);
      ctx.globalAlpha = 1;
    }
    // 护航舰
    for (const m of this.minions) {
      ctx.fillStyle = TEAM[m.team].color;
      ctx.globalAlpha = 0.75;
      ctx.fillRect(mx + m.x * sx - 1.5, my + m.y * sy - 1.5, 3, 3);
    }
    // 水雷（橙点）
    ctx.fillStyle = '#ff9d4d';
    for (const mi of this.mines) {
      ctx.globalAlpha = 0.7;
      ctx.fillRect(mx + mi.x * sx - 1, my + mi.y * sy - 1, 2, 2);
    }
    // 灯塔（圈 + 归属色）
    for (const bc of this.beacons) {
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = bc.team === 0 ? TEAM[0].color : (bc.team === 1 ? TEAM[1].color : '#cfd8e0');
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(mx + bc.x * sx, my + bc.y * sy, 4.5, 0, TAU);
      ctx.stroke();
      if (bc.prog > 0.02 && bc.prog < 1) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(mx + bc.x * sx, my + bc.y * sy - 3);
        ctx.lineTo(mx + bc.x * sx + 3, my + bc.y * sy + 2);
        ctx.lineTo(mx + bc.x * sx - 3, my + bc.y * sy + 2);
        ctx.closePath(); ctx.fill();
      }
    }
    // 宝箱（金点）
    ctx.fillStyle = '#ffd76a';
    for (const cu of this.chests) {
      ctx.globalAlpha = 0.9;
      ctx.fillRect(mx + cu.x * sx - 1.5, my + cu.y * sy - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
    // 英雄（方块）
    ctx.globalAlpha = 1;
    for (const hcp of this.heroes) {
      if (hcp.dead) {
        ctx.fillStyle = 'rgba(150,150,150,0.5)';
        ctx.fillRect(mx + hcp.x * sx - 2.5, my + hcp.y * sy - 2.5, 5, 5);
        continue;
      }
      ctx.fillStyle = hcp === this.player ? '#ffffff' : TEAM[hcp.team].color;
      cla(ctx, mx + hcp.x * sx, my + hcp.y * sy, 4.5);
    }
    // 相机视口
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      mx + this.cam.x * sx, my + this.cam.y * sy,
      (View.w / Settings.zoom) * sx, (View.h / Settings.zoom) * sy
    );
    ctx.restore();
  },
};
