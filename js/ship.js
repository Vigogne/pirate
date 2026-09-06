/* ship.js — 英雄战船：玩家/队友/敌舰共用，完整 4 炮位 + 模块，支持 AI 与转向移动 */
"use strict";

// 炮位在船上的局部坐标（船头朝上为本地系，-y 为前）
const SLOT_POS = [
  [-0.60, -0.34], // 左前
  [ 0.60, -0.34], // 右前
  [-0.50,  0.40], // 左后
  [ 0.50,  0.40], // 右后
];
const SLOT_LABELS = ['①', '②', '③', '④'];
const DEFAULT_SLOTS = ['cannon', 'cannon', 'twin', 'mortar'];

function weaponStats(id, level) {
  const w = WEAPONS[id];
  const g = w.grow;
  return {
    id, def: w,
    damage: w.damage * Math.pow(g.dmg, level - 1),
    rate: w.rate * Math.pow(g.rate, level - 1),
    range: w.range * Math.pow(g.range, level - 1),
    speed: w.speed,
    count: w.count, spread: w.spread, pierce: w.pierce, splash: w.splash,
    arc: w.arc, arcH: w.arcH, kind: w.kind, style: w.style,
    cone: w.cone || 0, color: w.color, size: w.size,
  };
}

const HALF_LEN = 66;
const HALF_WID = 44;

class Ship {
  constructor(game, cfg) {
    this.game = game;
    this.team = cfg.team || 0;
    this.ai = !!cfg.ai;               // true=电脑操控
    this.name = cfg.name || (this.team === 0 ? '旗舰号' : '敌舰');
    this.isHero = true;
    this.money = MOBA.heroBounty;   // 击沉赏金
    this.killsHeroes = 0;           // 击沉英雄数
    this.killsMinions = 0;          // 击沉小兵/塔数
    this.deaths = 0;
    this.lane = cfg.lane || 1;        // 推塔喜好路线
    this.x = cfg.x;
    this.y = cfg.y;
    this.angle = this.team === 0 ? 0 : Math.PI;  // 船头朝向：0=上，PI=下
    this.gold = MOBA.startGold;
    this.dead = false;
    this.respawnTimer = 0;

    this.hullId = 'flag';               // 船体类型（带专属技能）
    this.hullLv = { flag: 1, bulwark: 1, gale: 1, ram: 1, bio: 1 };   // 各船体独立等级
    this.tierSail = 0;
    this.tierArmor = 0;
    // 技能状态
    this.skillCd = 0;
    this.skillT = 0;
    this.skillId = null;
    this.ramHits = new Set();

    this.slots = [];
    const slots = cfg.slots || DEFAULT_SLOTS;
    for (let i = 0; i < 4; i++) {
      this.slots.push({ weaponId: slots[i] || 'cannon', level: 1, cd: 0, angle: cfg.team === 0 ? -Math.PI / 2 : Math.PI / 2 });
    }

    this.t = rand(0, TAU);
    this.disabled = false;
    this.lastHit = -99;
    this.flash = 0;
    this.wake = new WakeTrail(150);

    // AI 状态
    this.aiT = 0;
    this.aiTarget = null;
    this.aiMove = { x: 0, y: 0 };
    this.upT = 1;
    this.retreating = false;
    this.retreatT = 0;

    this.recompute();
  }

  recompute() {
    const hull = HULLS.find(h => h.id === this.hullId) || HULLS[0];
    const stats = hullStatsAt(hull, this.hullLv[this.hullId] || 1);
    const armor = ARMORS[this.tierArmor];
    const sail = SAILS[this.tierSail];
    this.hullDef = hull; this.armorDef = armor; this.sailDef = sail;
    const maxHp = stats.maxHp + armor.maxHp;
    this.maxHp = maxHp;
    this.hp = Math.min(this.hp === undefined ? maxHp : this.hp, maxHp);
    this.speed = sail.speed;
    this.reloadMul = sail.reloadMul;
    this.damageReduction = armor.reduce;
    this.scale = stats.size;
    // 碰撞半径（含船长舰宽，作为被击与陆地阻挡的判定）
    this.radius = this.rad = 58 * this.scale;
  }

  /* ---- 船体技能 ---- */
  tryActivateSkill() {
    const sk = this.hullDef && this.hullDef.skill;
    if (!sk || this.dead || this.skillCd > 0) return false;
    this.skillCd = sk.cd;
    this.skillT = sk.dur;
    this.skillId = sk.id;
    if (sk.id === 'ram') this.ramHits = new Set();
    Particles.ring(this.x, this.y, 64, '#7ef0a0');
    Particles.spark(this.x, this.y, rand(0, TAU), 8, '#ffe9a0');
    AudioFX.upgrade();
    return true;
  }

  skillActive() { return this.skillT > 0 && this.skillId; }

  maxWeaponRange() {
    let r = 0;
    for (const s of this.slots) r = Math.max(r, weaponStats(s.weaponId, s.level).range);
    return r;
  }

  hitBy(dmg, ix, iy, game, killer) {
    if (this.dead) return;
    // 铁壁/生物技能：铁甲铁幕·深海狂暴期间大幅减伤
    let buffRed = 0;
    if (this.skillT > 0 && this.skillId) {
      if (this.skillId === 'iron') buffRed = 0.75;
      if (this.skillId === 'bio') buffRed = 0.35;
    }
    const red = Math.min(0.88, this.damageReduction + buffRed);
    const real = dmg * (1 - red);
    this.hp -= real;
    this.flash = 0.1;
    if (ix !== undefined) Particles.spark(ix, iy, rand(0, TAU), 4, '#ffcf70');
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.deaths++;
      this.respawnTimer = MOBA.heroRespawn;
      Particles.explosion(this.x, this.y, 90, this.team === 0 ? '#4db6e8' : '#ff8b2a', true);
      Particles.smoke(this.x, this.y, 14, 55);
      AudioFX.lose();
      if (game && game.announceHeroDeath) game.announceHeroDeath(this, killer);
      if (!this.ai) UI.toast(`${this.name} 被击沉！${MOBA.heroRespawn} 秒后重生`);
    }
  }

  repairCost() {
    const missing = this.maxHp - this.hp;
    return Math.round(missing * 1.8);
  }

  update(dt, game) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.wake.update(dt);
    const px = this.x, py = this.y;

    if (this.dead) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this._respawn(game);
      return;
    }

    // 技能计时 & 效果
    this.skillCd = Math.max(0, this.skillCd - dt);
    if (this.skillT > 0) {
      this.skillT -= dt;
      if (this.skillT <= 0) this.skillId = null;
    }
    let spdMul = 1;
    let rldMul = this.reloadMul;
    if (this.skillT > 0 && this.skillId) {
      if (this.skillId === 'sprint') spdMul = 1.6;
      if (this.skillId === 'fury') rldMul = this.reloadMul * 0.65;
      if (this.skillId === 'bio') spdMul = 1.35;   // 深海狂暴：又硬又快
    }

    // 移动方向
    let dir;
    if (this.ai) { this._aiThink(dt); dir = this.aiMove; }
    else dir = this._inputDir();

    // 破浪冲撞：沿船头猛冲并撞伤沿途敌舰
    if (this.skillId === 'ram' && this.skillT > 0) {
      const dxr = Math.sin(this.angle), dyr = -Math.cos(this.angle);
      this.x += dxr * this.speed * 3.4 * dt;
      this.y += dyr * this.speed * 3.4 * dt;
      for (const u of game.units) {
        if (u.dead || u.invuln || u.team === this.team || this.ramHits.has(u)) continue;
        if (dist(this.x, this.y, u.x, u.y) < this.radius + u.rad) {
          this.ramHits.add(u);
          u.hitBy(120, this.x, this.y, game, this);
          Particles.explosion(u.x, u.y, 44, '#ffd76a');
          AudioFX.hit();
          if (u.isHero && u.dead) continue;
        }
      }
    } else {
      // 平移 + 朝移动方向转向
      const len = Math.hypot(dir.x, dir.y);
      const moving = len > 0.01;
      this._moving = moving;
      if (moving) {
        const nx = dir.x / len, ny = dir.y / len;
        this.x += nx * this.speed * spdMul * dt;
        this.y += ny * this.speed * spdMul * dt;
        const targetBow = Math.atan2(nx, -ny);   // 0=上
        this.angle = angleLerp(this.angle, targetBow, MOBA.turnSpeed * dt);
      }
    }

    this._clampWorld(game);

    // 铁壁烟囱冒蒸汽（视觉）
    if (!this.dead && this.hullId === 'bulwark' && Math.random() < 0.14) {
      const d = HALF_LEN * this.scale * 0.66;
      Particles.smoke(
        this.x + Math.sin(this.angle) * d,
        this.y - Math.cos(this.angle) * d, 1, 26
      );
    }

    // 实际位移 → 航迹（位移过小/被陆地弹飞时不记录，避免凭空轨迹与原地堆泡）
    const moved = dist(px, py, this.x, this.y);
    if (moved > 1.5 && moved < 60) {
      const nx = (this.x - px) / moved, ny = (this.y - py) / moved;
      this.wake.push(
        this.x - nx * 14 * this.scale,
        this.y - ny * 14 * this.scale,
        this.scale, nx, ny
      );
    }

    // 实际速度（供武器提前量瞄准）
    this.vx = dt > 0 ? (this.x - px) / dt : 0;
    this.vy = dt > 0 ? (this.y - py) / dt : 0;

    // 射击（4 槽独立；疾风/速射 buff 影响装填）
    if (!this.disabled) {
      for (let i = 0; i < 4; i++) {
        this._updateSlot(this.slots[i], i, dt, game, rldMul);
      }
    }

    // 修复
    const idle = game.time - this.lastHit;
    if (this.disabled) {
      this.hp += 16 * dt;
      if (this.hp >= this.maxHp * 0.3) this.disabled = false;
    } else if (idle > 4 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + 3 * dt);
    }

    // 基地码头：靠近己方基地快速修复（双方对称），并驱动修理动画
    const own = game.baseOf(this.team);
    const nearBase = own && !own.dead && dist(this.x, this.y, own.x, own.y) < 300;
    this.repairing = !!(nearBase && this.hp < this.maxHp);
    if (this.repairing && own) {
      this.hp = Math.min(this.maxHp, this.hp + 30 * dt);
      // 修理动画：金色火星/蒸汽
      if (Math.random() < 0.3) {
        Particles.spawn({
          type: 'spark', layer: 'high',
          x: this.x + rand(-this.radius, this.radius), y: this.y + rand(-8, 8),
          vx: rand(-14, 14), vy: rand(-46, -16),
          life: rand(0.4, 0.85), max: 0.85, size: rand(1, 2.2),
          color: '#ffd76a', drag: 0.96,
        });
      }
      if (Math.random() < 0.14) {
        Particles.smoke(this.x + rand(-this.radius, this.radius), this.y + rand(-6, 6), 1, 8);
      }
    } else {
      this.repairing = false;
    }
  }

  _respawn(game) {
    const base = game.baseOf(this.team);
    this.dead = false;
    this.x = base.x + rand(-90, 90);
    this.y = base.y + (this.team === 0 ? -120 : 120);
    this.angle = this.team === 0 ? 0 : Math.PI;
    this.hp = this.maxHp;
    this.disabled = false;
    this.wake.pts.length = 0;          // 清掉旧轨迹，避免凭空出现一串
    this.repairing = false;
    Particles.splash(this.x, this.y, 2);
    if (!this.ai) UI.toast(`${this.name} 重新起航！`);
  }

  _inputDir() {
    return Input.moveVec();   // 键盘 / WASD 或 触摸虚拟摇杆
  }

  /* --------- AI --------- */
  _aiThink(dt) {
    this.aiT -= dt;
    if (this.aiT <= 0) {
      this.aiT = 0.28;

      // 撤退判定：低血量回归本阵修整（边退边打）；
      // 敌塔全破、基地门户大开时更拼（撤退阈值更低，避免决赛局僵持）
      const openBase = this.game.baseOpen(1 - this.team);
      if (!this.retreating && this.hp < this.maxHp * (openBase ? 0.08 : 0.22)) {
        this.retreating = true;
        this.retreatT = openBase ? 2.5 : 5;
      }
      if (this.retreating) {
        this.retreatT -= 0.28;
        if (this.retreatT <= 0 || this.hp > this.maxHp * 0.75) this.retreating = false;
      }

      if (!this.retreating) {
        const game = this.game;
        const ownBase = game.baseOf(this.team);
        const enemyBase = game.baseOf(1 - this.team);
        let target = null, best = Infinity;

        // 优先回防：敌人在己方基地附近
        for (const u of game.units) {
          if (u.dead || u.invuln || u.team === this.team) continue;
          const dOwn = dist(u.x, u.y, ownBase.x, ownBase.y);
          if (dOwn < MOBA.defendRange && dOwn < best) { best = dOwn; target = u; }
        }
        // 其次守塔：敌人压到己方塔附近（防止塔被白白rush）
        if (!target) {
          for (const tw of game.towers) {
            if (tw.dead || tw.team !== this.team) continue;
            for (const u of game.units) {
              if (u.dead || u.invuln || u.team === this.team) continue;
              const dT = dist(u.x, u.y, tw.x, tw.y);
              if (dT < 300 && dT < best) { best = dT; target = u; }
            }
          }
        }
        // 追击保持：粘住上一个目标（但不会追进敌方泉水附近，防止雪崩）
        if (!target && this.aiTarget && !this.aiTarget.base && !this.aiTarget.dead && !this.aiTarget.invuln) {
          const d = dist(this.x, this.y, this.aiTarget.x, this.aiTarget.y);
          const tb = game.baseOf(this.aiTarget.team);
          const nearOwn = tb && dist(this.aiTarget.x, this.aiTarget.y, tb.x, tb.y) < 340;
          if (d < 420 && !nearOwn) target = this.aiTarget;
        }
        // 其次接战最近敌人
        if (!target) {
          best = Infinity;
          for (const u of game.units) {
            if (u.dead || u.invuln || u.team === this.team) continue;
            const d = dist(this.x, this.y, u.x, u.y);
            if (d < MOBA.engageRange && d < best) { best = d; target = u; }
          }
        }
        // 否则推塔：优先最近的在世/破防敌塔（先一塔后二塔），塔拆完才打基地
        if (!target) {
          let bestT = null, bestD = Infinity;
          for (const tw of game.towers) {
            if (tw.dead || tw.invuln || tw.team === this.team) continue;
            const d = dist(this.x, this.y, tw.x, tw.y);
            if (d < bestD) { bestD = d; bestT = tw; }
          }
          this.aiTarget = bestT || { x: enemyBase.x, y: enemyBase.y, base: true };
        } else this.aiTarget = target;
      }
    }

    // 移动决策
    if (this.retreating) {
      // 朝远离当前威胁的方向退（留在战场附近，避免整局僵持）
      const src = this.aiTarget && !this.aiTarget.base ? this.aiTarget : { x: this.x, y: this.y - (this.team === 0 ? 1 : -1) };
      let nx = this.x - src.x, ny = this.y - src.y;
      if (Math.hypot(nx, ny) < 1) { nx = 0; ny = this.team === 0 ? -1 : 1; }
      const L = Math.hypot(nx, ny) || 1;
      this.aiMove = { x: nx / L, y: ny / L };
    } else {
      const t = this.aiTarget;
      const wr = this.maxWeaponRange();
      if (t) {
        const d = dist(this.x, this.y, t.x, t.y);
        const inRange = !t.base && !t.dead && d < wr * 0.92;
        if (inRange || d < 60) {
          this.aiMove = { x: 0, y: 0 };
        } else {
          const nx = t.x - this.x, ny = t.y - this.y;
          const L = Math.hypot(nx, ny) || 1;
          this.aiMove = { x: nx / L, y: ny / L };
        }
      } else this.aiMove = { x: 0, y: 0 };
    }

    // 自动升级
    this.upT -= dt;
    if (this.upT <= 0) {
      this.upT = 1.1;
      this._aiGrow();
    }

    // AI 自动用船体技能
    if (this.skillCd <= 0 && !this.retreating) {
      const sk = this.hullDef && this.hullDef.skill;
      if (sk) {
        if (sk.id === 'sprint' && (this.aiMove.x !== 0 || this.aiMove.y !== 0)) this.tryActivateSkill();
        else if (sk.id === 'iron' && this.hp < this.maxHp * 0.45) this.tryActivateSkill();
        else if (sk.id === 'fury' && this.aiTarget && !this.aiTarget.base) this.tryActivateSkill();
        else if (sk.id === 'ram' && this.aiTarget && !this.aiTarget.base &&
                 dist(this.x, this.y, this.aiTarget.x, this.aiTarget.y) < 330) this.tryActivateSkill();
      }
    }
  }

  _aiGrow() {
    // 优先升级最便宜的武器，其次模块；留一点金币
    let bestCost = Infinity, bestAt = -1;
    for (let i = 0; i < 4; i++) {
      const s = this.slots[i];
      if (s.level >= WEAPON_MAX_LEVEL) continue;
      const c = weaponUpgradeCost(s.weaponId, s.level);
      if (c < bestCost) { bestCost = c; bestAt = i; }
    }
    if (bestAt >= 0 && this.gold >= bestCost + 40) {
      this.gold -= bestCost;
      this.slots[bestAt].level++;
      this.recompute();
      return;
    }
    // 模块（船体为选择型，不再升级；AI 攒够钱换更硬的船体）
    const cand = [
      { key: 'sail', t: this.tierSail, arr: SAILS },
      { key: 'armor', t: this.tierArmor, arr: ARMORS },
    ];
    if (this.hullId === 'flag' && this.gold >= 620) {
      const pick = HULLS[this.hullId === 'flag' ? 2 : 1];   // 先疾风后铁壁
      this.gold -= pick.cost;
      this.hullId = pick.id;
      this.recompute();
      return;
    }
    cand.sort((a, b) => { const ca = a.arr[a.t + 1] ? a.arr[a.t + 1].cost : Infinity; const cb = b.arr[b.t + 1] ? b.arr[b.t + 1].cost : Infinity; return ca - cb; });
    const k = cand[0];
    const next = k.arr[k.t + 1];
    if (next && this.gold >= next.cost + 40) {
      this.gold -= next.cost;
      if (k.key === 'sail') this.tierSail++;
      else this.tierArmor++;
      this.recompute();
    }
  }

  _clampWorld(game) {
    this.x = clamp(this.x, 60, WORLD.w - 60);
    this.y = clamp(this.y, 90, WORLD.h - 90);
    // 陆地（含基地岛）阻挡
    game.landResolve(this);
    // 防御塔石台阻挡
    for (const t of game.towers) {
      if (t.dead) continue;
      const d = dist(this.x, this.y, t.x, t.y);
      const min = t.rad + this.radius * 0.5;
      if (d < min) {
        const a = angleTo(t.x, t.y, this.x, this.y);
        this.x = t.x + Math.cos(a) * min;
        this.y = t.y + Math.sin(a) * min;
      }
    }
  }

  /* --------- 射击 --------- */
  _slotWorld(idx) {
    const p = SLOT_POS[idx];
    const lx = p[0] * HALF_WID * this.scale, ly = p[1] * HALF_LEN * this.scale;
    const cos = Math.cos(this.angle), sin = Math.sin(this.angle);
    return {
      x: this.x + lx * cos - ly * sin,
      y: this.y + lx * sin + ly * cos,
    };
  }

  _updateSlot(slot, idx, dt, game, rldMul) {
    const sp = this._slotWorld(idx);
    const st = weaponStats(slot.weaponId, slot.level);

    // 索敌：射程内最近的对立单位，否则敌方基地（无敌塔不索敌）
    let target = null, best = Infinity;
    for (const u of game.units) {
      if (u.dead || u.invuln || u.team === this.team) continue;
      const d = dist(sp.x, sp.y, u.x, u.y);
      if (d <= st.range && d < best) { best = d; target = u; }
    }
    const eBase = game.baseOf(1 - this.team);
    // 塔还在时基地免伤，只能打塔
    if (!target && eBase && !eBase.dead && game.baseOpen(eBase.team)) {
      const d = dist(sp.x, sp.y, eBase.x, eBase.y);
      if (d <= st.range) { target = eBase; }
    }

    const aimAngle = target ? angleTo(sp.x, sp.y, target.x, target.y) : (this.team === 0 ? -Math.PI / 2 : Math.PI / 2);
    slot.angle = angleLerp(slot.angle, aimAngle, 7 * dt);

    if (st.kind === 'flame') {
      if (target && !target.base) {
        const facingDiff = Math.abs(normAngle(aimAngle - slot.angle));
        if (facingDiff < 0.35) {
          for (const u of game.units) {
            if (u.dead || u.invuln || u.team === this.team) continue;
            const d = dist(sp.x, sp.y, u.x, u.y);
            if (d <= st.range && Math.abs(normAngle(angleTo(sp.x, sp.y, u.x, u.y) - slot.angle)) <= st.cone) {
              u.hitBy(st.damage * st.rate * dt, undefined, undefined, game, this);
            }
          }
          const tip = { x: sp.x + Math.cos(slot.angle) * 20, y: sp.y + Math.sin(slot.angle) * 20 };
          for (let k = 0; k < 2; k++) Particles.flamePuff(tip.x, tip.y, slot.angle, st.range, st.color);
          AudioFX.flame();
        }
      }
      return;
    }

    // 提前量瞄准点（炮弹/鱼叉/鱼雷沿炮管方向从炮口射出）
    let tx = target ? target.x : sp.x, ty = target ? target.y : sp.y;
    if (target && !target.base && (target.vx || target.vy)) {
      const flight = clamp(dist(sp.x, sp.y, tx, ty) / Math.max(st.speed, 200), 0, 0.9);
      tx += (target.vx || 0) * flight;
      ty += (target.vy || 0) * flight;
    }
    slot.aimX = tx; slot.aimY = ty;
    const fireAng = target ? angleTo(sp.x, sp.y, tx, ty) : aimAngle;
    // 炮管转向“发射方向”——打出去的方向 = 炮口所指方向
    slot.angle = angleLerp(slot.angle, fireAng, 9 * dt);

    slot.cd -= dt;
    if (slot.cd > 0 || !target) return;
    if (Math.abs(normAngle(fireAng - slot.angle)) < 0.09) {
      this._fire(st, idx, sp, game);
      slot.cd = (1 / st.rate) * (rldMul || this.reloadMul);
    }
  }

  _fire(st, idx, sp, game) {
    AudioFX[st.style === 'bullet' ? 'mgun' : 'cannon']();
    const slot = this.slots[idx];
    const ang = slot.angle;                        // 与炮管同向：打出去 = 炮口所指
    const tx = slot.aimX, ty = slot.aimY;
    // 各武器炮口位于炮管末端（与 _turret 画法一致）
    const tips = { cannonball: 30, twinball: 30, mortar: 20, grenade: 21, harpoon: 37, torpedo: 25, bullet: 23, flame: 20 };
    const tip = (tips[st.style] || 26) * this.scale;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const px = -dy, py = dx;                       // 垂直于炮管（双管排布）
    const count = st.count || 1;

    for (let k = 0; k < count; k++) {
      const lateral = count > 1 ? (k - (count - 1) / 2) * 7 * this.scale : 0;
      const mx = sp.x + dx * tip + px * lateral;
      const my = sp.y + dy * tip + py * lateral;
      const off = count > 1 ? (k - (count - 1) / 2) * st.spread : 0;
      const a = ang + off;
      const o = {
        x: mx, y: my, ang: a,
        style: st.style, damage: st.damage, splash: st.splash, pierce: st.pierce,
        team: this.team, owner: this,
        color: st.color, size: st.size, speed: st.speed, range: st.range,
      };
      if (st.arc) { o.arc = true; o.arcH = st.arcH; o.targetX = tx; o.targetY = ty; }
      Projectiles.launch(o);
      if (k === 0) {
        Particles.muzzle(mx, my, a, st.color);
        Particles.spark(mx, my, a, 2, '#ffe9a0');
      }
    }
  }

  /* --------- 绘制 --------- */
  draw(ctx, isPlayer) {
    if (this.dead) {
      this._drawDead(ctx);
      return;
    }
    ctx.save();

    // 团队光环（MOBA 选中气息，圆形双环）
    const team = TEAM[this.team];
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = isPlayer ? 0.22 : 0.10;
    ctx.strokeStyle = isPlayer ? '#ffffff' : team.color;
    ctx.lineWidth = isPlayer ? 6 : 4;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 12, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = isPlayer ? 0.5 : 0.2;
    ctx.lineWidth = isPlayer ? 2.4 : 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 9, 0, TAU);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;

    // 技能生效光环（旋转虚线圆环）
    if (this.skillT > 0 && this.skillId) {
      const pulse = (Math.sin(this.t * 9) + 1) / 2;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.globalAlpha = 0.30 + pulse * 0.30;
      ctx.strokeStyle = this.skillId === 'sprint' ? '#7ef0a0'
        : this.skillId === 'iron' ? '#4db6e8'
        : this.skillId === 'fury' ? '#ffd76a' : '#ff9d4d';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 9]);
      ctx.lineDashOffset = -this.t * 36;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 16 + pulse * 6, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // 阴影 & 航迹（椭圆软影）
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#04304a';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 22, HALF_WID * this.scale * 1.1, HALF_LEN * this.scale * 0.45, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    this.wake.draw(ctx);

    // 玩家朝向指示箭头
    if (isPlayer) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.fillStyle = 'rgba(126,240,160,0.75)';
      ctx.beginPath();
      ctx.moveTo(0, -(this.radius + 20));
      ctx.lineTo(-7, -(this.radius + 8));
      ctx.lineTo(7, -(this.radius + 8));
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // 射程圈（虚线圆环）
    const showRanges = isPlayer && (Input.down('ControlLeft') || Input.down('ControlRight') || UI.rangeOn);
    if (showRanges) {
      ctx.save();
      const ringColors = ['#7ef0a0', '#4db6e8', '#ffd76a', '#ff9d4d'];
      ctx.setLineDash([7, 9]);
      for (let i = 0; i < 4; i++) {
        const st = weaponStats(this.slots[i].weaponId, this.slots[i].level);
        const sp = this._slotWorld(i);
        ctx.strokeStyle = hexA(ringColors[i], 0.6);
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, st.range, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    const s = this.scale;
    const disabled = this.disabled;
    const W = HALF_WID * s, L = HALF_LEN * s;

    // 按船体类型绘制完全不同的造型
    this._drawHullBody(ctx, s, W, L, disabled, team);

    // 四个炮塔
    for (let i = 0; i < 4; i++) this._turret(ctx, i, s, disabled);

    ctx.restore();

    // 血条 + 名字（屏幕不随旋转）
    this._drawBar(ctx, isPlayer);
    if (this.repairing) this._drawRepair(ctx);
    if (this.flash > 0) {
      // 独立受击特效：白描边 + 星光（不把原图变白）
      if (Assets.has('ship_' + this.hullId + '_b__e')) {
        Assets.drawFlash(ctx, 'ship_' + this.hullId + '_b', this.x, this.y, this.scale * 1.85, this.angle, (this.flash / 0.1) * 0.9);
      } else {
        ctx.save();
        ctx.globalAlpha = this.flash / 0.1;
        ctx.fillStyle = '#fff';
        ctx.fillRect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        ctx.restore();
      }
    }
  }

  /* ============ 船体：2D 骨骼驱动（部件精灵挂骨骼） ============ */
  _buildShipSkel() {
    const hid = this.hullId;
    const B = (id, sp, px, py, ox, oy) => new Bone(id, sp, px, py, ox, oy);
    const root = B('root', 'ship_' + hid + '_b', 0, 0, 0, 0);
    if (hid === 'flag') {
      const mF = root.child(B('mastF', 'ship_flag_mF', 0, -30, 0, -28));
      mF.child(B('flag', 'ship_pennant', 0, -50, 14, -2));
      root.child(B('mastB', 'ship_flag_mB', 0, 14, 0, -24));
    } else if (hid === 'gale') {
      const mF = root.child(B('mastF', 'ship_gale_m', 0, -6, 0, -50));
      mF.child(B('flag', 'ship_pennant', 0, -88, 14, -2));
    } else if (hid === 'ram') {
      const mF = root.child(B('mastF', 'ship_ram_m', 0, 22, 0, -33));
      mF.child(B('flag', 'ship_pennant', 0, -56, 14, -2));
    } else if (hid === 'bulwark') {
      // 蒸汽舰：无帆，旗挂在艉杆
      root.child(B('flag', 'ship_pennant', 0, 88, 12, -4));
    }
    return new Skeleton(root);
  }
  _poseShip(sk) {
    const t = this.t;
    const spd = this._moving ? 1.8 : 1;
    const root = sk.get('root');
    if (root) {
      root.angle = Math.sin(t * 0.9) * (this._moving ? 0.035 : 0.016);
      root.bob = Math.sin(t * 1.6) * (this._moving ? 2.6 : 1.4);
    }
    const poseMast = (id, ph, amp) => {
      const m = sk.get(id);
      if (m) {
        m.angle = Math.sin(t * 1.7 * spd + ph) * amp;
        m.sx = 1 + Math.sin(t * 2.3 * spd + ph) * 0.07;   // 帆随风鼓
      }
    };
    poseMast('mastF', 0, 0.09);
    poseMast('mastB', 1.4, 0.11);
    const flag = sk.get('flag');
    if (flag) flag.angle = Math.sin(t * 4.2 * spd) * 0.5;
  }

  /* ============ 按船体类型的专属外形 ============ */
  _drawHullBody(ctx, s, W, L, disabled, team) {
    // 优先：2D 骨骼（船体部件 + 帆/旗骨骼链）
    if (Assets.has('ship_' + this.hullId + '_b')) {
      if (!this._skel) this._skel = this._buildShipSkel();
      this._poseShip(this._skel);
      this._skel.draw(ctx, this.scale * 1.85, Assets);
      return;
    }
    ctx.globalAlpha = disabled ? 0.6 : 1;
    const type = this.hullId;
    if (type === 'bulwark') this._hullBulwark(ctx, s, W, L, disabled, team);
    else if (type === 'gale') this._hullGale(ctx, s, W, L, disabled, team);
    else if (type === 'ram') this._hullRam(ctx, s, W, L, disabled, team);
    else if (type === 'bio') this._hullBio(ctx, s, W, L, disabled, team);
    else this._hullFlag(ctx, s, W, L, disabled, team);
    ctx.globalAlpha = 1;
  }

  _lookCol() { return this.hullDef ? this.hullDef.look : { hull: '#96633a', deck: '#c79a62', trim: '#f2efe0' }; }

  /* 旗舰型：经典双桅加农帆船 */
  _hullFlag(ctx, s, W, L, disabled, team) {
    const col = this._lookCol();
    const hullBase = col.hull;
    const hullPath = () => {
      ctx.beginPath();
      ctx.moveTo(0, -L);
      ctx.quadraticCurveTo(W * 0.92, -L * 0.7, W, -8);
      ctx.lineTo(W * 0.88, L * 0.8);
      ctx.quadraticCurveTo(0, L * 1.08, -W * 0.88, L * 0.8);
      ctx.lineTo(-W, -8);
      ctx.quadraticCurveTo(-W * 0.92, -L * 0.7, 0, -L);
      ctx.closePath();
    };
    const hg = ctx.createLinearGradient(-W, 0, W, 0);
    hg.addColorStop(0, shade(hullBase, -38)); hg.addColorStop(0.28, shade(hullBase, 12));
    hg.addColorStop(0.72, shade(hullBase, 12)); hg.addColorStop(1, shade(hullBase, -34));
    ctx.fillStyle = hg; hullPath(); ctx.fill();
    ctx.strokeStyle = shade(hullBase, -60); ctx.lineWidth = 3; ctx.stroke();
    // 舷缘
    ctx.strokeStyle = shade(hullBase, 46); ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, -L * 0.94);
    ctx.quadraticCurveTo(W * 0.8, -L * 0.64, W * 0.88, -6);
    ctx.quadraticCurveTo(0, L * 0.95, -W * 0.88, -6);
    ctx.quadraticCurveTo(-W * 0.8, -L * 0.64, 0, -L * 0.94);
    ctx.stroke();
    // 炮窗（方块窗）
    for (let i = -1; i <= 1; i++) for (const side of [-1, 1]) {
      const px = side * W * 0.78 - 2.6 * s, py = -L * 0.22 + i * L * 0.3 - 2.6 * s;
      ctx.fillStyle = shade(hullBase, -26);
      ctx.fillRect(px, py, 5.2 * s, 5.2 * s);
      ctx.strokeStyle = 'rgba(20,10,5,0.55)'; ctx.lineWidth = 1;
      ctx.strokeRect(px, py, 5.2 * s, 5.2 * s);
    }
    // 甲板
    const deck = () => {
      ctx.beginPath();
      ctx.moveTo(0, -L * 0.82);
      ctx.quadraticCurveTo(W * 0.68, -L * 0.52, W * 0.72, 0);
      ctx.lineTo(W * 0.62, L * 0.68);
      ctx.quadraticCurveTo(0, L * 0.88, -W * 0.62, L * 0.68);
      ctx.lineTo(-W * 0.72, 0);
      ctx.quadraticCurveTo(-W * 0.68, -L * 0.52, 0, -L * 0.82);
      ctx.closePath();
    };
    ctx.fillStyle = col.deck; deck(); ctx.fill();
    ctx.strokeStyle = shade(hullBase, -16); ctx.lineWidth = 1.6; deck(); ctx.stroke();
    ctx.strokeStyle = 'rgba(60,32,12,0.32)'; ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * W * 0.24, -L * 0.7);
      ctx.quadraticCurveTo(i * W * 0.24, 0, i * W * 0.2, L * 0.64);
      ctx.stroke();
    }
    // 队伍色披风带
    ctx.fillStyle = team.color; ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.moveTo(-W * 0.7, -L * 0.12); ctx.lineTo(W * 0.7, -L * 0.12);
    ctx.lineTo(W * 0.63, -L * 0.02); ctx.lineTo(-W * 0.63, -L * 0.02);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    // 艏柱 & 艏旗
    ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 3 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -L * 0.97); ctx.lineTo(0, -L - 20 * s); ctx.stroke();
    ctx.fillStyle = team.color; ctx.globalAlpha = 0.92;
    ctx.beginPath(); ctx.moveTo(0, -L); ctx.lineTo(13 * s, -L * 0.92); ctx.lineTo(0, -L * 0.9); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    // 艉楼
    ctx.fillStyle = shade(hullBase, -6);
    roundRect(ctx, -W * 0.4, L * 0.28, W * 0.8, L * 0.34, 4); ctx.fill();
    ctx.strokeStyle = shade(hullBase, -42); ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = 'rgba(255,240,200,0.3)';
    for (let i = -1; i <= 1; i++) { roundRect(ctx, i * 12 * s - 4 * s, L * 0.36, 8 * s, 8 * s, 2); ctx.fill(); }
    // 舵
    ctx.fillStyle = shade(hullBase, -50);
    roundRect(ctx, -3, L * 0.92, 6, 15 * s, 3); ctx.fill();
    // 双桅方帆
    this._sail(ctx, s, -L * 0.55, disabled, team);
    this._sail(ctx, s, L * 0.35, disabled, team);
  }

  /* 铁壁型：蒸汽铁甲舰（无帆、冒烟囱、铆接铁甲） */
  _hullBulwark(ctx, s, W, L, disabled, team) {
    const col = this._lookCol();
    const iron = col.hull;
    // 宽厚船体
    ctx.fillStyle = shade(iron, -14);
    roundRect(ctx, -W * 0.98, -L * 0.86, W * 1.96, L * 1.7, W * 0.36); ctx.fill();
    ctx.strokeStyle = shade(iron, -55); ctx.lineWidth = 3; ctx.stroke();
    // 装甲带 + 铆钉
    ctx.strokeStyle = shade(iron, 30); ctx.lineWidth = 2;
    roundRect(ctx, -W * 0.88, -L * 0.68, W * 1.76, L * 0.2, 6); ctx.stroke();
    ctx.fillStyle = shade(iron, -34);
    for (let i = -3; i <= 3; i++) {
      ctx.fillRect(i * W * 0.26 - 1.9 * s, -L * 0.58 - 1.9 * s, 3.8 * s, 3.8 * s);
      ctx.fillRect(i * W * 0.26 - 1.9 * s, L * 0.02 - 1.9 * s, 3.8 * s, 3.8 * s);
    }
    // 甲板
    ctx.fillStyle = shade(iron, 12);
    roundRect(ctx, -W * 0.7, -L * 0.6, W * 1.4, L * 1.14, W * 0.3); ctx.fill();
    ctx.strokeStyle = shade(iron, -30); ctx.lineWidth = 1.2; ctx.stroke();
    // 装甲指挥塔（中段）
    ctx.fillStyle = shade(iron, 24);
    roundRect(ctx, -W * 0.42, -L * 0.34, W * 0.84, L * 0.56, W * 0.2); ctx.fill();
    ctx.strokeStyle = shade(iron, -44); ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = team.color; ctx.globalAlpha = 0.9;
    ctx.fillRect(-W * 0.42, -L * 0.28, W * 0.84, L * 0.07);
    ctx.globalAlpha = 1;
    // 侧面方形炮门
    ctx.fillStyle = '#14181d';
    for (let i = -1; i <= 1; i++) for (const side of [-1, 1]) {
      roundRect(ctx, side * W * 0.78, -L * 0.18 + i * L * 0.34, W * 0.12, L * 0.16, 2); ctx.fill();
    }
    // 烟囱（蒸汽）
    ctx.fillStyle = shade(iron, -36);
    roundRect(ctx, -W * 0.14, -L * 0.66, W * 0.28, L * 0.34, 3); ctx.fill();
    ctx.strokeStyle = shade(iron, 30); ctx.lineWidth = 1.4;
    roundRect(ctx, -W * 0.14, -L * 0.66, W * 0.28, L * 0.34, 3); ctx.stroke();
    ctx.fillStyle = '#15181c';
    ctx.fillRect(-W * 0.14, -L * 0.66 - 3 * s, W * 0.28, 6 * s);
    // 铁冲角
    ctx.fillStyle = shade(iron, -28);
    ctx.beginPath(); ctx.moveTo(0, -L * 0.86); ctx.lineTo(W * 0.34, -L * 0.62); ctx.lineTo(-W * 0.34, -L * 0.62); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = shade(iron, -60); ctx.lineWidth = 2; ctx.stroke();
    // 队伍旗（艉杆）
    ctx.strokeStyle = '#2a1c0e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, L * 0.78); ctx.lineTo(0, L * 1.28); ctx.stroke();
    ctx.fillStyle = team.color;
    const fw = 14 * s + Math.sin(this.t * 5) * 2;
    ctx.beginPath();
    ctx.moveTo(0, L * 1.28); ctx.lineTo(fw, L * 1.24); ctx.lineTo(0, L * 1.2); ctx.closePath(); ctx.fill();
  }

  /* 疾风型：双体快艇——左右浮筒 + 横跨桥板（四个炮位全落在桥板上） */
  _hullGale(ctx, s, W, L, disabled, team) {
    const col = this._lookCol();
    const hull = col.hull;

    // 两个细长浮筒（梭形）
    for (const side of [-1, 1]) {
      const cx = side * W * 0.56;
      const tip = side * W * 0.2;
      ctx.beginPath();
      ctx.moveTo(cx, -L * 0.95);
      ctx.quadraticCurveTo(cx + tip, -L * 0.5, cx + tip * 0.85, -L * 0.05);
      ctx.quadraticCurveTo(cx + tip * 0.7, L * 0.62, cx, L * 0.9);
      ctx.quadraticCurveTo(cx - tip * 0.7, L * 0.62, cx - tip * 0.85, -L * 0.05);
      ctx.quadraticCurveTo(cx - tip, -L * 0.5, cx, -L * 0.95);
      ctx.closePath();
      const pg = ctx.createLinearGradient(cx - tip, 0, cx + tip, 0);
      pg.addColorStop(0, shade(hull, -30));
      pg.addColorStop(0.5, shade(hull, 8));
      pg.addColorStop(1, shade(hull, -30));
      ctx.fillStyle = pg; ctx.fill();
      ctx.strokeStyle = shade(hull, -48); ctx.lineWidth = 2.4; ctx.stroke();
      // 浮筒队色细条 + 艏尖高光
      ctx.fillStyle = team.color; ctx.globalAlpha = 0.9;
      ctx.fillRect(cx - tip * 0.8, -L * 0.42, tip * 1.6, 5 * s);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(cx - 3 * s, -L * 0.86 - 3 * s, 6 * s, 6 * s);
    }

    // 前后横梁
    ctx.strokeStyle = shade(hull, -20); ctx.lineWidth = 3.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-W * 0.56, -L * 0.08); ctx.lineTo(W * 0.56, -L * 0.08); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-W * 0.56, L * 0.38); ctx.lineTo(W * 0.56, L * 0.38); ctx.stroke();

    // 桥板甲板（宽幅，完全覆盖四个炮位）
    const deck = () => {
      roundRect(ctx, -W * 0.8, -L * 0.52, W * 1.6, L * 1.06, W * 0.26);
    };
    const dg = ctx.createLinearGradient(0, -L * 0.52, 0, L * 0.5);
    dg.addColorStop(0, col.trim);
    dg.addColorStop(1, shade(col.trim, -22));
    ctx.fillStyle = dg; deck(); ctx.fill();
    ctx.strokeStyle = shade(hull, -40); ctx.lineWidth = 2.2; deck(); ctx.stroke();
    // 蹦床网格纹理
    ctx.strokeStyle = 'rgba(90,130,150,0.35)'; ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * W * 0.3, -L * 0.48);
      ctx.lineTo(i * W * 0.3, L * 0.48);
      ctx.stroke();
    }
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(-W * 0.76, i * L * 0.31);
      ctx.lineTo(W * 0.76, i * L * 0.31);
      ctx.stroke();
    }
    // 桥板前缘队色条
    ctx.fillStyle = team.color; ctx.globalAlpha = 0.9;
    ctx.fillRect(-W * 0.76, -L * 0.52, W * 1.52, 6 * s);
    ctx.globalAlpha = 1;

    // 中央桅杆 + 大三角纵帆（横跨在两筒之间）
    const flap = Math.sin(this.t * 2.2) * 0.14;
    ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 2.8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, L * 0.1); ctx.lineTo(0, -L * 1.18); ctx.stroke();
    ctx.save();
    ctx.translate(0, -L * 0.42);
    ctx.rotate(flap);
    const sg = ctx.createLinearGradient(-W * 1.15, 0, 0, 0);
    sg.addColorStop(0, col.trim); sg.addColorStop(1, shade(col.trim, -30));
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-W * 1.1, L * 0.6);
    ctx.lineTo(W * 0.14, L * 0.48);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(90,110,120,0.55)'; ctx.lineWidth = 1.2; ctx.stroke();
    // 前帆（艏支索三角帆）
    ctx.fillStyle = shade(col.trim, -16);
    ctx.beginPath();
    ctx.moveTo(0, -L * 0.6);
    ctx.lineTo(-W * 0.42, -L * 0.02);
    ctx.lineTo(W * 0.06, -L * 0.26);
    ctx.closePath(); ctx.fill();
    // 帆缝
    ctx.strokeStyle = 'rgba(90,110,120,0.4)'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(-W * 0.42, L * 0.12); ctx.lineTo(-W * 0.34, L * 0.42); ctx.stroke();
    ctx.restore();

    // 艏旗
    ctx.fillStyle = team.color;
    ctx.beginPath(); ctx.moveTo(0, -L * 1.18); ctx.lineTo(12 * s, -L * 1.12); ctx.lineTo(0, -L * 1.06); ctx.closePath(); ctx.fill();
  }

  /* 破浪型：重装冲撞舰——宽大甲板 + 黄铜撞角（炮位全部落在甲板上） */
  _hullRam(ctx, s, W, L, disabled, team) {
    const col = this._lookCol();
    const hull = col.hull;
    // 宽厚的船体（与旗舰同长度，甲板足够覆盖四个炮位）
    const hullPath = () => {
      ctx.beginPath();
      ctx.moveTo(0, -L * 0.92);
      ctx.quadraticCurveTo(W * 0.96, -L * 0.62, W * 0.97, -L * 0.05);
      ctx.lineTo(W * 0.9, L * 0.82);
      ctx.quadraticCurveTo(0, L * 1.05, -W * 0.9, L * 0.82);
      ctx.lineTo(-W * 0.97, -L * 0.05);
      ctx.quadraticCurveTo(-W * 0.96, -L * 0.62, 0, -L * 0.92);
      ctx.closePath();
    };
    const hg = ctx.createLinearGradient(-W, 0, W, 0);
    hg.addColorStop(0, shade(hull, -40));
    hg.addColorStop(0.3, shade(hull, 10));
    hg.addColorStop(0.7, shade(hull, 10));
    hg.addColorStop(1, shade(hull, -36));
    ctx.fillStyle = hg;
    hullPath(); ctx.fill();
    ctx.strokeStyle = shade(hull, -58); ctx.lineWidth = 3; ctx.stroke();

    // 侧舷装甲带（贴船体轮廓的弧带 + 铆钉）
    ctx.strokeStyle = shade(hull, 34); ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -L * 0.86);
    ctx.quadraticCurveTo(W * 0.82, -L * 0.56, W * 0.82, -L * 0.02);
    ctx.quadraticCurveTo(0, L * 0.88, -W * 0.82, -L * 0.02);
    ctx.quadraticCurveTo(-W * 0.82, -L * 0.56, 0, -L * 0.86);
    ctx.stroke();
    ctx.fillStyle = shade(hull, -30);
    for (let i = -3; i <= 3; i++) {
      for (const side of [-1, 1]) {
        ctx.fillRect(side * W * 0.74 - 1.7 * s, -L * 0.1 + i * L * 0.22 - 1.7 * s, 3.4 * s, 3.4 * s);
      }
    }
    // 甲板（完全覆盖四个炮位）
    const deck = () => {
      ctx.beginPath();
      ctx.moveTo(0, -L * 0.78);
      ctx.quadraticCurveTo(W * 0.72, -L * 0.5, W * 0.72, -L * 0.02);
      ctx.lineTo(W * 0.68, L * 0.72);
      ctx.quadraticCurveTo(0, L * 0.92, -W * 0.68, L * 0.72);
      ctx.lineTo(-W * 0.72, -L * 0.02);
      ctx.quadraticCurveTo(-W * 0.72, -L * 0.5, 0, -L * 0.78);
      ctx.closePath();
    };
    ctx.fillStyle = col.deck; deck(); ctx.fill();
    ctx.strokeStyle = shade(hull, -20); ctx.lineWidth = 1.6; deck(); ctx.stroke();
    // 甲板板条
    ctx.strokeStyle = 'rgba(70,35,15,0.3)'; ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * W * 0.26, -L * 0.66);
      ctx.quadraticCurveTo(i * W * 0.26, 0, i * W * 0.22, L * 0.66);
      ctx.stroke();
    }
    // 队色披风带
    ctx.fillStyle = team.color; ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.moveTo(-W * 0.7, L * 0.34); ctx.lineTo(W * 0.7, L * 0.34);
    ctx.lineTo(W * 0.64, L * 0.44); ctx.lineTo(-W * 0.64, L * 0.44);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    // 黄铜撞角（大三角 + 描金环 + 中棱）
    const rg = ctx.createLinearGradient(0, -L * 1.5, 0, -L * 0.5);
    rg.addColorStop(0, '#f2d278');
    rg.addColorStop(0.6, '#c9942e');
    rg.addColorStop(1, '#8f6a1a');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(0, -L * 1.5);
    ctx.quadraticCurveTo(W * 0.3, -L * 0.98, W * 0.34, -L * 0.82);
    ctx.lineTo(-W * 0.34, -L * 0.82);
    ctx.quadraticCurveTo(-W * 0.3, -L * 0.98, 0, -L * 1.5);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#5f4610'; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.strokeStyle = 'rgba(120,90,25,0.8)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, -L * 1.42); ctx.lineTo(0, -L * 0.86); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,235,170,0.55)'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -L * 1.46);
    ctx.quadraticCurveTo(W * 0.12, -L * 1.05, W * 0.27, -L * 0.86);
    ctx.stroke();
    // 单桅大帆（在艉半段，避开前部炮位）
    const flap = Math.sin(this.t * 2.6) * 0.14;
    ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, L * 0.3); ctx.lineTo(0, -L * 0.86); ctx.stroke();
    ctx.save();
    ctx.translate(0, -L * 0.4);
    ctx.rotate(flap * 0.5);
    const sg = ctx.createLinearGradient(0, -L * 0.4, 0, L * 0.44);
    sg.addColorStop(0, '#f5f1e2'); sg.addColorStop(1, '#d9cfae');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(0, -L * 0.4);
    ctx.quadraticCurveTo(W * 0.86, -L * 0.16, W * 0.78, L * 0.3);
    ctx.quadraticCurveTo(W * 0.28, L * 0.36, 0, L * 0.34);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(120,105,75,0.5)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
    // 艉旗
    ctx.fillStyle = team.color;
    ctx.beginPath(); ctx.moveTo(0, L * 1.0); ctx.lineTo(12 * s, L * 0.94); ctx.lineTo(0, L * 0.88); ctx.closePath(); ctx.fill();
    // 艉舵
    ctx.fillStyle = shade(hull, -50);
    roundRect(ctx, -3, L * 0.94, 6, 14 * s, 3); ctx.fill();
  }

  /* 生物型：章鱼身躯 + 鲨鱼之首 */
  _hullBio(ctx, s, W, L, disabled, team) {
    const col = this._lookCol();
    const body = col.hull;          // 紫色
    const pulse = 1 + Math.sin(this.t * 2.2) * 0.03;
    // 吸盘（方块）
    for (let k = 0; k < 6; k++) {
      const bx = (k - 2.5) / 2.5 * W * 0.62;
      const wag = Math.sin(this.t * 2.4 + k * 1.3) * W * 0.16;
      ctx.strokeStyle = shade(body, -16);
      ctx.lineWidth = 8 * s - k * 0.6 * s;
      ctx.beginPath();
      ctx.moveTo(bx, L * 0.2);
      ctx.quadraticCurveTo(bx + wag * 0.6, L * 0.66, bx + wag, L * 1.08);
      ctx.stroke();
      ctx.fillStyle = '#5a3a8a';
      ctx.fillRect(bx + wag * 0.8 - 2.4 * s, L * 0.86 - 2.4 * s, 4.8 * s, 4.8 * s);
    }
    // 章鱼头部身体（宽大圆润）
    const bg = ctx.createRadialGradient(-W * 0.2, -L * 0.2, 6, 0, -L * 0.05, W * 1.15);
    bg.addColorStop(0, '#a678d8');
    bg.addColorStop(0.7, body);
    bg.addColorStop(1, shade(body, -32));
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(0, -L * 0.42);
    ctx.quadraticCurveTo(W * 1.1, -L * 0.28, W * 0.95, L * 0.4);
    ctx.quadraticCurveTo(0, L * 0.72, -W * 0.95, L * 0.4);
    ctx.quadraticCurveTo(-W * 1.1, -L * 0.28, 0, -L * 0.42);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#3c2260'; ctx.lineWidth = 2.6; ctx.stroke();
    // 体表光斑（方块）
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    for (let i = -2; i <= 2; i++) {
      ctx.fillRect(i * W * 0.34 - 3.4 * s, -L * 0.05 + (i % 2) * L * 0.1 - 3.4 * s, 6.8 * s, 6.8 * s);
    }
    // 背鳍
    ctx.fillStyle = shade(body, -24);
    ctx.beginPath(); ctx.moveTo(-W * 0.1, -L * 0.3); ctx.lineTo(0, -L * 0.85); ctx.lineTo(W * 0.14, -L * 0.28); ctx.closePath(); ctx.fill();
    // —— 鲨鱼之首（船艏）——
    const hg = ctx.createLinearGradient(0, -W, 0, 0);
    hg.addColorStop(0, '#3f7f9e'); hg.addColorStop(1, '#2a5872');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.moveTo(0, -L * 1.34);                       // 吻尖
    ctx.quadraticCurveTo(W * 0.52, -L * 0.78, W * 0.5, -L * 0.3);
    ctx.lineTo(W * 0.42, -L * 0.05);
    ctx.lineTo(-W * 0.42, -L * 0.05);
    ctx.lineTo(-W * 0.5, -L * 0.3);
    ctx.quadraticCurveTo(-W * 0.52, -L * 0.78, 0, -L * 1.34);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#1d3a4a'; ctx.lineWidth = 2.4; ctx.stroke();
    // 鲨鱼嘴 + 方牙（多边形缺口）
    ctx.fillStyle = '#12303e';
    ctx.beginPath();
    ctx.moveTo(-W * 0.22, -L * 0.44);
    ctx.lineTo(0, -L * 0.6);
    ctx.lineTo(W * 0.22, -L * 0.44);
    ctx.lineTo(W * 0.14, -L * 0.38);
    ctx.lineTo(-W * 0.14, -L * 0.38);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#eef8fc'; ctx.lineWidth = 1.2;
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.moveTo(-L * 0.1 + k * L * 0.1, -L * 0.5);
      ctx.lineTo(-L * 0.1 + k * L * 0.1, -L * 0.4);
      ctx.stroke();
    }
    // 双眼（方块眼）
    ctx.fillStyle = '#e8f4f8';
    ctx.fillRect(-W * 0.3 - 3.2 * s, -L * 0.55 - 3.2 * s, 6.4 * s, 6.4 * s);
    ctx.fillRect(W * 0.3 - 3.2 * s, -L * 0.55 - 3.2 * s, 6.4 * s, 6.4 * s);
    ctx.fillStyle = '#0c1418';
    ctx.fillRect(-W * 0.26 - 1.7 * s, -L * 0.55 - 1.7 * s, 3.4 * s, 3.4 * s);
    ctx.fillRect(W * 0.34 - 1.7 * s, -L * 0.55 - 1.7 * s, 3.4 * s, 3.4 * s);
    // 侧鳍
    ctx.fillStyle = shade(body, -20);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * W * 0.86, L * 0.05);
      ctx.lineTo(side * W * 1.28, L * 0.18);
      ctx.lineTo(side * W * 0.82, L * 0.24);
      ctx.closePath(); ctx.fill();
    }
    // 队色标记（方块）
    ctx.fillStyle = team.color; ctx.globalAlpha = 0.9;
    ctx.fillRect(-5.5 * s, L * 0.32 - 5.5 * s, 11 * s, 11 * s);
    ctx.globalAlpha = 1;
  }

  // 回家修船动画：浮动的修理工 + 脉冲圆环 + 旋转虚线圆环
  _drawRepair(ctx) {
    const team = TEAM[this.team];
    const pulse = (Math.sin(this.t * 4) + 1) / 2;
    ctx.save();
    // 脉冲圆环
    ctx.globalAlpha = 0.28 + pulse * 0.3;
    ctx.strokeStyle = team.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius + 8 + pulse * 5, 0, TAU);
    ctx.stroke();
    // 旋转虚线圆环
    ctx.globalAlpha = 0.45;
    ctx.setLineDash([9, 12]);
    ctx.lineDashOffset = -this.t * 46;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius + 20, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    // 修理小人/扳手在甲板边上跳动
    const bob = Math.sin(this.t * 5.2) * 4;
    ctx.globalAlpha = 1;
    ctx.font = '17px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔧', this.x + this.radius * 0.55, this.y + this.radius * 0.5 + bob);
    ctx.restore();
  }

  _drawDead(ctx) {
    // 甲板上的残骸标记 + 重生倒计时
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(this.x - 14, this.y - 3, 28, 6);
    ctx.fillRect(this.x - 4, this.y - 12, 8, 24);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.max(1, Math.ceil(this.respawnTimer))}s`, this.x, this.y - 22);
    ctx.restore();
  }

  _drawBar(ctx, isPlayer) {
    const w = this.radius * 1.8, h = 6;
    const bx = this.x - w / 2, by = this.y - this.radius - 26;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, bx, by, w, h, 3); ctx.fill();
    const pct = clamp(this.hp / this.maxHp, 0, 1);
    ctx.fillStyle = TEAM[this.team].color;
    roundRect(ctx, bx, by, w * pct, h, 3); ctx.fill();
    if (isPlayer) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(this.name, this.x, by - 5);
    }
  }

  _sail(ctx, s, sy, disabled, team) {
    const flap = Math.sin(this.t * 2.4 + sy) * 0.16 + Math.sin(this.t * 1.3) * 0.1;
    const w = 50 * s, h = 74 * s;
    const c1 = disabled ? '#9aa1a8' : (this.team === 0 ? '#f7f3e3' : '#ecdfc6');
    const c2 = disabled ? '#8a9198' : (this.team === 0 ? '#dcd4be' : '#d2c09e');

    ctx.save();
    ctx.translate(0, sy);
    // 桅杆
    ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -h * 0.72); ctx.stroke();
    // 横桁
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-w * 0.56, -h * 0.66); ctx.lineTo(w * 0.56, -h * 0.66); ctx.stroke();

    ctx.save();
    ctx.translate(0, -h * 0.62);
    ctx.rotate(flap);
    // 左帆
    let g = ctx.createLinearGradient(-w, 0, 0, 0);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-w / 2, -h * 0.5, -w * 0.52, h * 0.34);
    ctx.quadraticCurveTo(-w * 0.14, h * 0.3, 0, h * 0.3);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(120,105,75,0.55)'; ctx.lineWidth = 1.2; ctx.stroke();
    // 右帆
    g = ctx.createLinearGradient(w, 0, 0, 0);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(w / 2, -h * 0.5, w * 0.52, h * 0.34);
    ctx.quadraticCurveTo(w * 0.14, h * 0.3, 0, h * 0.3);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // 帆缝线
    ctx.strokeStyle = 'rgba(120,100,70,0.4)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-w * 0.3, -h * 0.18); ctx.lineTo(-w * 0.32, h * 0.28); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w * 0.3, -h * 0.18); ctx.lineTo(w * 0.32, h * 0.28); ctx.stroke();
    ctx.restore();

    // 桅顶队伍旗（飘扬）
    ctx.fillStyle = TEAM[this.team].color;
    const fw = 15 * s + Math.sin(this.t * 5 + sy) * 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.72);
    ctx.lineTo(fw, -h * 0.72 + 3.5 * s);
    ctx.lineTo(0, -h * 0.72 + 7 * s);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  _turret(ctx, idx, s, disabled) {
    const p = SLOT_POS[idx];
    const wx = p[0] * HALF_WID * s, wy = p[1] * HALF_LEN * s;
    const slot = this.slots[idx];
    const st = weaponStats(slot.weaponId, slot.level);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(SLOT_LABELS[idx], wx, wy + 26);

    // 优先：像素炮塔精灵（朝上；槽位角度为标准角 → 旋转 +PI/2）
    if (Assets.has('turret_' + st.style)) {
      Assets.draw(ctx, 'turret_' + st.style, wx, wy, s * 1.5, slot.angle + Math.PI / 2);
      return;
    }

    // 等级金属材质色（等级用外形/颜色区分，不在船上打星）
    const lvMetal = [null, '#3d414c', '#8a6a3a', '#b9c2cc', '#e0b23a', '#5fe08e'];
    const lvDark  = [null, '#202430', '#4a3a1e', '#666e78', '#8f6d1c', '#2f7c50'];
    const metal = disabled ? '#6a6a6a' : lvMetal[slot.level] || '#3d414c';
    const metalDark = disabled ? '#4a4a4a' : lvDark[slot.level] || '#202430';

    ctx.save();
    ctx.translate(wx, wy);

    // 炮座（八边形底座，不随炮管旋转）
    ctx.fillStyle = disabled ? '#6a6a6a' : '#2c2f38';
    octPath(ctx, 0, 0, 9 * s, Math.PI / 8); ctx.fill();
    ctx.strokeStyle = TEAM[this.team].color; ctx.lineWidth = 2;
    octPath(ctx, 0, 0, 12 * s, Math.PI / 8); ctx.stroke();
    // 等级环珠（等级-1 颗小方块，嵌在座圈上）
    const studs = slot.level - 1;
    if (studs > 0) {
      ctx.fillStyle = metal;
      ctx.strokeStyle = metalDark;
      ctx.lineWidth = 0.8;
      for (let i = 0; i < studs; i++) {
        const a = (i / studs) * TAU - Math.PI / 2;
        const sx = Math.cos(a) * 13 * s, sy = Math.sin(a) * 13 * s;
        ctx.fillRect(sx - 2 * s, sy - 2 * s, 4 * s, 4 * s);
        ctx.strokeRect(sx - 2 * s, sy - 2 * s, 4 * s, 4 * s);
      }
    }

    ctx.rotate(slot.angle);
    switch (st.style) {
      case 'cannonball':
      case 'twinball':
        this._barrel(ctx, s, st.style === 'twinball' ? 2 : 1, 6, 24, metal, metalDark);
        break;
      case 'mortar':
        ctx.save(); ctx.rotate(-0.28); this._barrel(ctx, s, 1, 11, 16, metal, metalDark); ctx.restore();
        break;
      case 'grenade': this._barrel(ctx, s, 1, 8, 15, metal, metalDark); break;
      case 'harpoon': this._barrel(ctx, s, 1, 3, 30, metal, metalDark); break;
      case 'torpedo': this._barrel(ctx, s, 1, 9, 18, metal, metalDark); break;
      case 'bullet': this._barrel(ctx, s, 3, 3, 16, metal, metalDark); break;
      case 'flame':
        ctx.fillStyle = disabled ? '#777' : metal;
        ctx.fillRect(8, -5 * s, 12, 10 * s);
        ctx.strokeStyle = disabled ? '#555' : metalDark;
        ctx.strokeRect(8, -5 * s, 12, 10 * s);
        ctx.fillStyle = '#ff7a2a';
        ctx.fillRect(19, -4 * s, 9, 8 * s);
        break;
    }
    ctx.restore();
  }

  _barrel(ctx, s, n, w, len, metal, metalDark) {
    for (let i = 0; i < n; i++) {
      const offY = n > 1 ? (i - (n - 1) / 2) * 6 * s : 0;
      ctx.fillStyle = metal || '#3a3d47';
      ctx.fillRect(6, offY - w / 2, len, w);
      ctx.strokeStyle = metalDark || '#202430';
      ctx.strokeRect(6, offY - w / 2, len, w);
      // 炮口（方形）
      ctx.fillStyle = '#111';
      ctx.fillRect(6 + len - (w / 1.8), offY - w / 2.6, w / 1.1, w / 1.3);
      ctx.strokeStyle = metalDark || '#202430';
      ctx.strokeRect(6 + len - (w / 1.8), offY - w / 2.6, w / 1.1, w / 1.3);
    }
  }
}

function normAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}
