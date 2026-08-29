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

    this.tierHull = 0;
    this.tierSail = 0;
    this.tierArmor = 0;

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
    const hull = HULLS[this.tierHull];
    const armor = ARMORS[this.tierArmor];
    const sail = SAILS[this.tierSail];
    this.hullDef = hull; this.armorDef = armor; this.sailDef = sail;
    const maxHp = hull.maxHp + armor.maxHp;
    this.maxHp = maxHp;
    this.hp = Math.min(this.hp === undefined ? maxHp : this.hp, maxHp);
    this.speed = sail.speed;
    this.reloadMul = sail.reloadMul;
    this.damageReduction = armor.reduce;
    this.scale = hull.size;
    // 碰撞半径（含船长舰宽，作为被击与陆地阻挡的判定）
    this.radius = this.rad = 58 * this.scale;
  }

  maxWeaponRange() {
    let r = 0;
    for (const s of this.slots) r = Math.max(r, weaponStats(s.weaponId, s.level).range);
    return r;
  }

  hitBy(dmg, ix, iy, game, killer) {
    if (this.dead) return;
    const real = dmg * (1 - this.damageReduction);
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
    return Math.round(missing * 2 * (0.8 + this.tierHull * 0.1));
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

    // 移动方向
    let dir;
    if (this.ai) { this._aiThink(dt); dir = this.aiMove; }
    else dir = this._inputDir();

    // 平移 + 朝移动方向转向
    const len = Math.hypot(dir.x, dir.y);
    const moving = len > 0.01;
    if (moving) {
      const nx = dir.x / len, ny = dir.y / len;
      this.x += nx * this.speed * dt;
      this.y += ny * this.speed * dt;
      const targetBow = Math.atan2(nx, -ny);   // 0=上
      this.angle = angleLerp(this.angle, targetBow, MOBA.turnSpeed * dt);
    }

    this._clampWorld(game);

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

    // 射击（4 槽独立）
    if (!this.disabled) {
      for (let i = 0; i < 4; i++) {
        this._updateSlot(this.slots[i], i, dt, game);
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
      if (!this.retreating && this.hp < this.maxHp * (openBase ? 0.12 : 0.22)) {
        this.retreating = true;
        this.retreatT = openBase ? 3 : 5;
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
          if (u.dead || u.team === this.team) continue;
          const dOwn = dist(u.x, u.y, ownBase.x, ownBase.y);
          if (dOwn < MOBA.defendRange && dOwn < best) { best = dOwn; target = u; }
        }
        // 其次守塔：敌人压到己方塔附近（防止塔被白白rush）
        if (!target) {
          for (const tw of game.towers) {
            if (tw.dead || tw.team !== this.team) continue;
            for (const u of game.units) {
              if (u.dead || u.team === this.team) continue;
              const dT = dist(u.x, u.y, tw.x, tw.y);
              if (dT < 300 && dT < best) { best = dT; target = u; }
            }
          }
        }
        // 追击保持：粘住上一个目标（但不会追进敌方泉水附近，防止雪崩）
        if (!target && this.aiTarget && !this.aiTarget.base && !this.aiTarget.dead) {
          const d = dist(this.x, this.y, this.aiTarget.x, this.aiTarget.y);
          const nearOwn = dist(this.aiTarget.x, this.aiTarget.y, game.baseOf(this.aiTarget.team).x, game.baseOf(this.aiTarget.team).y) < 340;
          if (d < 420 && !nearOwn) target = this.aiTarget;
        }
        // 其次接战最近敌人
        if (!target) {
          best = Infinity;
          for (const u of game.units) {
            if (u.dead || u.team === this.team) continue;
            const d = dist(this.x, this.y, u.x, u.y);
            if (d < MOBA.engageRange && d < best) { best = d; target = u; }
          }
        }
        // 否则推塔：优先最近的在世敌塔（先一塔后二塔），塔拆完才打基地
        if (!target) {
          let bestT = null, bestD = Infinity;
          for (const tw of game.towers) {
            if (tw.dead || tw.team === this.team) continue;
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
    // 模块
    const cand = [
      { key: 'hull', t: this.tierHull, arr: HULLS },
      { key: 'sail', t: this.tierSail, arr: SAILS },
      { key: 'armor', t: this.tierArmor, arr: ARMORS },
    ];
    cand.sort((a, b) => { const ca = a.arr[a.t + 1] ? a.arr[a.t + 1].cost : Infinity; const cb = b.arr[b.t + 1] ? b.arr[b.t + 1].cost : Infinity; return ca - cb; });
    const k = cand[0];
    const next = k.arr[k.t + 1];
    if (next && this.gold >= next.cost + 40) {
      this.gold -= next.cost;
      if (k.key === 'hull') this.tierHull++;
      else if (k.key === 'sail') this.tierSail++;
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

  _updateSlot(slot, idx, dt, game) {
    const sp = this._slotWorld(idx);
    const st = weaponStats(slot.weaponId, slot.level);

    // 索敌：射程内最近的对立单位，否则敌方基地
    let target = null, best = Infinity;
    for (const u of game.units) {
      if (u.dead || u.team === this.team) continue;
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
            if (u.dead || u.team === this.team) continue;
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
      slot.cd = (1 / st.rate) * this.reloadMul;
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

    // 团队光环（MOBA 选中气息）
    const team = TEAM[this.team];
    ctx.globalAlpha = isPlayer ? 0.35 : 0.16;
    ctx.strokeStyle = isPlayer ? '#ffffff' : team.color;
    ctx.lineWidth = isPlayer ? 3 : 2;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 8, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;

    // 阴影 & 航迹
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#04304a';
    ctx.beginPath(); ctx.ellipse(this.x, this.y + 22, HALF_WID * this.scale * 1.1, HALF_LEN * this.scale * 0.45, 0, 0, TAU); ctx.fill();
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

    // 射程圈（按住 Ctrl 或触屏开启射程显示，且仅玩家自己的船）
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
        ctx.beginPath(); ctx.arc(sp.x, sp.y, st.range, 0, TAU); ctx.stroke();
      }
      ctx.restore();
    }

    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    const s = this.scale;
    const disabled = this.disabled;
    const W = HALF_WID * s, L = HALF_LEN * s;
    const hullBase = this.team === 0 ? '#96633a' : '#6f4732';

    // ---- 船身（外轮廓） ----
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
    hg.addColorStop(0, shade(hullBase, -38));
    hg.addColorStop(0.28, shade(hullBase, 12));
    hg.addColorStop(0.72, shade(hullBase, 12));
    hg.addColorStop(1, shade(hullBase, -34));
    ctx.fillStyle = hg;
    ctx.globalAlpha = disabled ? 0.6 : 1;
    hullPath(); ctx.fill();
    ctx.strokeStyle = shade(hullBase, -60); ctx.lineWidth = 3; ctx.stroke();
    ctx.globalAlpha = 1;

    // 舷缘亮线
    ctx.strokeStyle = shade(hullBase, 46); ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, -L * 0.94);
    ctx.quadraticCurveTo(W * 0.8, -L * 0.64, W * 0.88, -6);
    ctx.quadraticCurveTo(0, L * 0.95, -W * 0.88, -6);
    ctx.quadraticCurveTo(-W * 0.8, -L * 0.64, 0, -L * 0.94);
    ctx.stroke();

    // 炮窗（两侧各三）
    for (let i = -1; i <= 1; i++) {
      for (const side of [-1, 1]) {
        const px = side * W * 0.78, py = -L * 0.22 + i * L * 0.3;
        ctx.fillStyle = shade(hullBase, -26);
        ctx.beginPath(); ctx.arc(px, py, 3.6 * s, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(20,10,5,0.55)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(px, py, 3.6 * s, 0, TAU); ctx.stroke();
      }
    }

    // ---- 甲板 ----
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
    const dg = ctx.createLinearGradient(0, -L, 0, L);
    dg.addColorStop(0, shade(hullBase, 36));
    dg.addColorStop(1, shade(hullBase, 12));
    ctx.fillStyle = dg;
    deck(); ctx.fill();
    ctx.strokeStyle = shade(hullBase, -16); ctx.lineWidth = 1.6;
    deck(); ctx.stroke();
    // 甲板板条
    ctx.strokeStyle = 'rgba(60,32,12,0.32)'; ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * W * 0.24, -L * 0.7);
      ctx.quadraticCurveTo(i * W * 0.24, 0, i * W * 0.2, L * 0.64);
      ctx.stroke();
    }

    // 队伍色披风带
    ctx.fillStyle = team.color;
    ctx.globalAlpha = disabled ? 0.5 : 0.92;
    ctx.beginPath();
    ctx.moveTo(-W * 0.7, -L * 0.12);
    ctx.lineTo(W * 0.7, -L * 0.12);
    ctx.lineTo(W * 0.63, -L * 0.02);
    ctx.lineTo(-W * 0.63, -L * 0.02);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;

    // 艏柱 & 艏旗
    ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 3 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -L * 0.97); ctx.lineTo(0, -L - 20 * s); ctx.stroke();
    ctx.fillStyle = team.color; ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.moveTo(0, -L);
    ctx.lineTo(13 * s, -L * 0.92);
    ctx.lineTo(0, -L * 0.9);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;

    // ---- 艉楼（舰尾舱房） ----
    ctx.fillStyle = shade(hullBase, -6);
    roundRect(ctx, -W * 0.4, L * 0.28, W * 0.8, L * 0.34, 4); ctx.fill();
    ctx.strokeStyle = shade(hullBase, -42); ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = 'rgba(255,240,200,0.3)';
    for (let i = -1; i <= 1; i++) {
      roundRect(ctx, i * 12 * s - 4 * s, L * 0.36, 8 * s, 8 * s, 2);
      ctx.fill();
    }

    // 舵 & 龙骨线
    ctx.fillStyle = shade(hullBase, -50);
    roundRect(ctx, -3, L * 0.92, 6, 15 * s, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(20,12,5,0.4)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -L * 0.97); ctx.lineTo(0, L * 0.9); ctx.stroke();

    // ---- 双桅帆 ----
    this._sail(ctx, s, -L * 0.55, disabled, team);
    this._sail(ctx, s, L * 0.35, disabled, team);

    // 四个炮塔
    for (let i = 0; i < 4; i++) this._turret(ctx, i, s, disabled);

    ctx.restore();

    // 血条 + 名字（屏幕不随旋转）
    this._drawBar(ctx, isPlayer);
    if (this.repairing) this._drawRepair(ctx);
    if (this.flash > 0) {
      ctx.save();
      ctx.globalAlpha = this.flash / 0.1;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  // 回家修船动画：浮动的修理工 + 旋转虚线环 + 脉冲光环
  _drawRepair(ctx) {
    const team = TEAM[this.team];
    const pulse = (Math.sin(this.t * 4) + 1) / 2;
    ctx.save();
    // 脉冲光环
    ctx.globalAlpha = 0.28 + pulse * 0.3;
    ctx.strokeStyle = team.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 8 + pulse * 5, 0, TAU); ctx.stroke();
    // 旋转虚线环（像检修圈）
    ctx.globalAlpha = 0.45;
    ctx.setLineDash([9, 12]);
    ctx.lineDashOffset = -this.t * 46;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 20, 0, TAU); ctx.stroke();
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

    // 等级金属材质色（等级用外形/颜色区分，不在船上打星）
    const lvMetal = [null, '#3d414c', '#8a6a3a', '#b9c2cc', '#e0b23a', '#5fe08e'];
    const lvDark  = [null, '#202430', '#4a3a1e', '#666e78', '#8f6d1c', '#2f7c50'];
    const metal = disabled ? '#6a6a6a' : lvMetal[slot.level] || '#3d414c';
    const metalDark = disabled ? '#4a4a4a' : lvDark[slot.level] || '#202430';

    ctx.save();
    ctx.translate(wx, wy);

    // 炮座（不随炮管旋转）
    ctx.fillStyle = disabled ? '#6a6a6a' : '#2c2f38';
    ctx.beginPath(); ctx.arc(0, 0, 9 * s, 0, TAU); ctx.fill();
    ctx.strokeStyle = TEAM[this.team].color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 12 * s, 0, TAU); ctx.stroke();
    // 等级环珠（等级-1 颗，均匀嵌在座圈上）
    const studs = slot.level - 1;
    if (studs > 0) {
      ctx.fillStyle = metal;
      ctx.strokeStyle = metalDark;
      ctx.lineWidth = 0.8;
      for (let i = 0; i < studs; i++) {
        const a = (i / studs) * TAU - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 12 * s, Math.sin(a) * 12 * s, 2.6 * s, 0, TAU);
        ctx.fill(); ctx.stroke();
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
        roundRect(ctx, 8, -5 * s, 12, 10 * s, 3); ctx.fill();
        ctx.fillStyle = disabled ? '#555' : metalDark;
        roundRect(ctx, 8, -5 * s, 12, 10 * s, 3); ctx.stroke();
        ctx.fillStyle = '#ff7a2a';
        ctx.beginPath(); ctx.arc(21, 0, 4 * s, 0, TAU); ctx.fill();
        break;
    }
    ctx.restore();
  }

  _barrel(ctx, s, n, w, len, metal, metalDark) {
    for (let i = 0; i < n; i++) {
      const offY = n > 1 ? (i - (n - 1) / 2) * 6 * s : 0;
      ctx.fillStyle = metal || '#3a3d47';
      roundRect(ctx, 6, offY - w / 2, len, w, w / 2); ctx.fill();
      ctx.strokeStyle = metalDark || '#202430';
      roundRect(ctx, 6, offY - w / 2, len, w, w / 2); ctx.stroke();
      // 炮口
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(6 + len, offY, w / 2.2, 0, TAU); ctx.fill();
      // 炮口亮边（高等级更亮）
      ctx.strokeStyle = metalDark || '#202430';
      ctx.beginPath(); ctx.arc(6 + len, offY, w / 2.2 + 0.8, 0, TAU); ctx.stroke();
    }
  }
}

function normAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}
