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
  floats: [],
  player: null,
  cam: { x: 0, y: 0 },
  paused: false,
  cheatOn: false,
  repairCD: 0,
  _prev: {},
  spawnTick: 0,
  spawnIdx: 0,
  unlocks: { 0: {}, 1: {} },
  _shieldMsg: { 0: false, 1: false },

  get units() { return this.heroes.concat(this.minions, this.towers, this.monsters); },
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

  // 陆地/塔推挤：船会被陆地阻挡
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
    this.floats = [];
    this.spawnTick = 1.5;
    this.spawnIdx = 0;
    this.paused = false;
    this.repairCD = 0;
    Projectiles.clear();
    Particles.clear();

    this.cam.x = 0;
    this.cam.y = clamp(this.player.y - View.h * 0.5, 0, WORLD.h - View.h);
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
    this.minions = this.minions.filter(m => !m.dead);
    this._refreshShields();

    Projectiles.update(dt, this);
    Particles.update(dt);

    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life -= dt; f.y -= 26 * dt;
      if (f.life <= 0) this.floats.splice(i, 1);
    }

    // 相机跟随玩家（纵向四屏大地图，横/竖屏视口自适应）
    const targetY = clamp(this.player.y - View.h * 0.5, 0, WORLD.h - View.h);
    this.cam.y = lerp(this.cam.y, targetY, clamp(dt * 6, 0, 1));
    const targetX = clamp(this.player.x - View.w * 0.5, 0, WORLD.w - View.w);
    this.cam.x = lerp(this.cam.x, targetX, clamp(dt * 6, 0, 1));

    UI.refresh();
  },

  _toggles() {
    const p = this._prev;
    const one = (code, fn) => { if (Input.down(code) && !p[code]) fn(); p[code] = Input.down(code); };
    one('Space', () => { if (this.state === 'playing') { this.paused = !this.paused; UI.toast(this.paused ? '已暂停（空格继续）' : '继续作战', 1.0); } });
    one('KeyP', () => { if (this.state === 'playing') UI.toggleDock(); });
    one('KeyM', () => { AudioFX.muted = !AudioFX.muted; AudioFX.applyMute(); UI._syncSoundUI(); });
    one('KeyC', () => { if (this.state === 'playing') this.cheatMoney(); });
    one('KeyQ', () => { if (this.state === 'playing') this.useSkill(); });
  },

  frozen() { return this.state !== 'playing' || this.paused || UI.dockOpen || UI.settingsOpen; },

  _spawnMinions(dt) {
    for (const b of this.bases) {
      if (b.dead) continue;
      b.spawnT = (b.spawnT === undefined ? 2.0 : b.spawnT) - dt;
      if (b.spawnT <= 0) {
        b.spawnT = MOBA.minionInterval;
        const teamCount = this.minions.reduce((n, m) => n + (m.team === b.team ? 1 : 0), 0);
        // 出兵量：基本 1 只，30% 概率一次 2 只（受上限约束）
        const wave = Math.random() < 0.3 ? 2 : 1;
        for (let k2 = 0; k2 < wave && teamCount + k2 < MOBA.minionCap; k2++) {
          const type = minionTypeFor(this.spawnIdx++);
          this.minions.push(new Minion(this, b.team, (Math.random() * LANES.length) | 0, type));
        }
      }
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

  /* ---- 野区 Boss 击杀结算（赏金已在斩杀结算中发放，这里解锁装备） ---- */
  onBossDeath(m, killer) {
    const team = killer && killer.team !== undefined && killer.team !== 2 ? killer.team : 0;
    // 同时记录 装备id 与 Boss类型 两个键，解锁查询两路都通
    this.unlocks[team][m.reward] = true;
    this.unlocks[team][m.type] = true;
    UI.announce(`${m.name} 被击败！解锁「${WEAPONS[m.reward].name}」`, true);
    UI.toast(`野区奖励：已解锁特殊装备「${WEAPONS[m.reward].name}」！去船坞装备吧`, 3.0);
    AudioFX.coin();
  },

  // 英雄被击沉的屏幕中央播报
  announceHeroDeath(victim, killer) {
    const killerName = killer && killer.name ? killer.name : '海怪';
    const text = `${victim.name} 被 ${killerName} 击沉！`;
    const good = victim.team === 1;   // 敌方英雄阵亡 = 好消息
    UI.announce(text, good);
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
    const cost = weaponUpgradeCost(s.weaponId, s.level);
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
    // 世界坐标 -> 相机偏移
    ctx.translate(-Math.round(this.cam.x), -Math.round(this.cam.y));

    Water.draw(ctx);
    Map.draw(ctx, this);
    Particles.draw(ctx, 'low');
    for (const t of this.towers) t.draw(ctx);
    for (const m of this.monsters) m.draw(ctx);
    for (const m of this.minions) m.draw(ctx);
    for (const h of this.heroes) h.draw(ctx, h === this.player);
    Projectiles.draw(ctx);
    Particles.draw(ctx, 'high');
    this._drawFloats(ctx);

    ctx.restore();

    // 屏幕空间：暗角 / 小地图 / 武器冷却面板 / 摇杆 / 暂停
    Map._vignette(ctx, View.w, View.h);
    this._drawMinimap(ctx);
    if (this.state === 'playing' && !UI.dockOpen) this._drawWeaponStatus(ctx);
    this._drawJoystick(ctx);

    if (this.paused && this.state === 'playing') {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, 0, View.w, View.h);
      ctx.fillStyle = '#ffe9b0';
      ctx.font = 'bold 38px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('⏸ 已暂停', View.w / 2, View.h / 2);
    }
  },

  // 移动端虚拟摇杆（方型底座）
  _drawJoystick(ctx) {
    const j = Input.joystickDraw();
    if (!j) return;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#06283e';
    cla(ctx, j.cx, j.cy, j.r);
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#9adcff'; ctx.lineWidth = 2;
    ctx.save(); ctx.translate(j.cx, j.cy); ctx.rotate(Math.PI / 4);
    ctx.strokeRect(-j.r, -j.r, j.r * 2, j.r * 2);
    ctx.restore();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#cfeaff';
    ctx.fillRect(j.kx - j.r * 0.3, j.ky - j.r * 0.3, j.r * 0.6, j.r * 0.6);
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
    const mw = 66, mh = Math.round(mw * WORLD.h / WORLD.w);   // 约 139
    const mx = View.w - mw - 14, my = 66;
    const sx = mw / WORLD.w, sy = mh / WORLD.h;

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
      View.w * sx, View.h * sy
    );
    ctx.restore();
  },
};
