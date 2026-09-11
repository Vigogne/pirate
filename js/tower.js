/* tower.js — 防御塔：一塔/二塔，塔不倒基地不破防 */
"use strict";

class Tower {
  constructor(game, def) {
    this.game = game;
    this.team = def.team;
    this.tier = def.tier;              // 1=一塔 2=二塔
    this.isTower = true;
    this.isHero = false;
    this.name = (def.team === 0 ? '我方' : '敌方') + (def.tier === 1 ? '一塔' : '二塔');
    this.money = TOWER_DEF.money;      // 拆塔赏金
    this.x = def.x;
    this.y = def.y;
    this.rad = TOWER_DEF.rad;
    this.maxHp = towerHp(def.tier);
    this.hp = this.maxHp;
    this.dead = false;
    this.invuln = def.tier === 2;   // 一塔未全拆前二塔无敌（Game._refreshShields 维护）
    this.angle = def.team === 0 ? 0 : Math.PI;
    this.fireCD = rand(0.3, 1.0);
    this.flash = 0;
    this.t = rand(0, TAU);
  }

  hitBy(dmg, ix, iy, game) {
    if (this.dead || this.invuln) return;   // 一塔未全拆前二塔无敌
    this.hp -= dmg;
    this.flash = 0.1;
    if (ix !== undefined) Particles.spark(ix, iy, rand(0, TAU), 3, '#ffcf70');
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      Particles.explosion(this.x, this.y, 70, '#ffb15a', true);
      Particles.smoke(this.x, this.y, 12, 60);
      AudioFX.explosion(true);
      UI.toast(`${this.name} 已被摧毁！`, 1.8);
      if (game && game._refreshShields) game._refreshShields();
    }
  }

  update(dt, game) {
    if (this.dead) return;
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);

    // 索敌：射程内最近的对立单位（英雄优先；无敌塔不打；烟幕中的目标不可锁定）
    let target = null, bestHero = Infinity, bestAny = Infinity;
    for (const u of game.units) {
      if (u.dead || u.invuln || u.isChest || u.team === this.team || u.stealthT > 0) continue;
      const d = dist(this.x, this.y, u.x, u.y);
      if (d <= TOWER_DEF.range) {
        if (u.isHero) { if (d < bestHero) { bestHero = d; target = u; } }
        else if (d < bestAny) { bestAny = d; }
      }
    }
    if (!target && bestAny < Infinity) {
      for (const u of game.units) {
        if (u.dead || u.invuln || u.isChest || u.team === this.team || u.isHero || u.stealthT > 0) continue;
        const d = dist(this.x, this.y, u.x, u.y);
        if (d <= TOWER_DEF.range && d === bestAny) { target = u; break; }
      }
    }

    if (target) {
      const aim = angleTo(this.x, this.y, target.x, target.y);
      this.angle = angleLerp(this.angle, aim, 5 * dt);
      this.fireCD -= dt;
      if (this.fireCD <= 0) {
        this.fireCD = 1 / TOWER_DEF.rate;
        const mz = { x: this.x + Math.cos(aim) * 34, y: this.y + Math.sin(aim) * 34 };
        Particles.muzzle(mz.x, mz.y, aim, '#9adcff');
        Projectiles.launch({
          x: mz.x, y: mz.y, ang: aim,
          style: 'cannonball', damage: TOWER_DEF.damage, splash: 0, pierce: 0,
          team: this.team, owner: this, color: '#9adcff', size: 6,
          speed: 460, range: TOWER_DEF.range + 50,
        });
        AudioFX.cannon();
      }
    }
  }

  draw(ctx) {
    if (this.dead) return;
    const team = TEAM[this.team];

    // —— 2D 骨骼：塔身 + 炮塔骨（炮塔骨骼朝目标旋转） ——
    const bId = 'tower_body' + this.tier, tId = 'tower_turret' + this.tier;
    if (Assets.has(bId)) {
      if (!this._skel) {
        const root = new Bone('body', bId, 0, 0, 0, 0);
        root.child(new Bone('turret', tId, 0, 0, 0, -2));
        this._skel = new Skeleton(root);
      }
      const t2 = this._skel.get('turret');
      t2.angle = this.angle + Math.PI / 2;   // 精灵朝上 → 标准角补偿
      this._skel.root.bob = Math.sin(this.t * 2.2) * 0.8;
      ctx.save();
      ctx.translate(this.x, this.y);
      this._skel.draw(ctx, this.rad / 30, Assets);
      // 队伍旗帜（旗杆 + 波浪三角旗）
      const flap = Math.sin(this.t * 3.2) * 2.5;
      ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -this.rad * 0.62); ctx.lineTo(0, -this.rad - 30); ctx.stroke();
      ctx.fillStyle = team.color;
      ctx.beginPath();
      ctx.moveTo(0, -this.rad - 30);
      ctx.lineTo(19 + flap, -this.rad - 24.5);
      ctx.lineTo(0, -this.rad - 19);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.moveTo(0, -this.rad - 30);
      ctx.lineTo(19 + flap, -this.rad - 24.5);
      ctx.lineTo(0, -this.rad - 27);
      ctx.closePath(); ctx.fill();
      // 无敌护罩（圆形能量泡，玻璃高光弧）
      if (this.invuln) {
        const pulse = (Math.sin(this.t * 3) + 1) / 2;
        const rr = this.rad * (1.04 + pulse * 0.05);
        ctx.globalAlpha = 0.15 + pulse * 0.12;
        ctx.fillStyle = '#7fe0ff';
        ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.fill();
        ctx.globalAlpha = 0.5 + pulse * 0.3;
        ctx.strokeStyle = '#aef4ff'; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.arc(0, 0, rr + 1.5, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 0.4 + pulse * 0.25;
        ctx.beginPath(); ctx.arc(0, 0, rr - 3, -2.4, -0.9); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // 塔标（描边文字）
      ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(this.tier === 1 ? '一' : '二', 1, this.rad + 7);
      ctx.fillStyle = '#fff';
      ctx.fillText(this.tier === 1 ? '一' : '二', 0, this.rad + 6);
      // 受击闪光（独立特效）
      if (this.flash > 0) Assets.drawFlash(ctx, bId, 0, 0, this.rad / 30, 0, this.flash / 0.1);
      // 血条（塔顶上方）
      const w = this.rad * 2, h = 7;
      roundRect(ctx, -w / 2, -this.rad - 42, w, h, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();
      roundRect(ctx, -w / 2, -this.rad - 42, w * clamp(this.hp / this.maxHp, 0, 1), h, 3);
      ctx.fillStyle = team.color; ctx.fill();
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(this.x, this.y);

    // 水中石台（八边形）
    ctx.fillStyle = 'rgba(140,160,150,0.5)';
    octEllPath(ctx, 0, 10, this.rad * 1.5, this.rad * 0.75, 0.2); ctx.fill();
    ctx.fillStyle = '#5a5f56';
    octPath(ctx, 0, 0, this.rad * 1.15, Math.PI / 8); ctx.fill();
    ctx.strokeStyle = '#3c4038'; ctx.lineWidth = 3;
    octPath(ctx, 0, 0, this.rad * 1.15, Math.PI / 8); ctx.stroke();

    // 塔身（八边形石砌）
    const g = ctx.createRadialGradient(-10, -12, 4, 0, 0, this.rad);
    g.addColorStop(0, '#8a917f');
    g.addColorStop(1, '#565c50');
    ctx.fillStyle = g;
    octPath(ctx, 0, 0, this.rad, Math.PI / 8); ctx.fill();
    ctx.strokeStyle = '#3c4038'; ctx.lineWidth = 2.5;
    octPath(ctx, 0, 0, this.rad, Math.PI / 8); ctx.stroke();

    // 石纹（方块石块）
    ctx.strokeStyle = 'rgba(40,45,38,0.5)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
      ctx.lineTo(Math.cos(a) * this.rad * 0.9, Math.sin(a) * this.rad * 0.9);
      ctx.stroke();
    }
    ctx.strokeRect(-this.rad * 0.5, -this.rad * 0.22, this.rad, this.rad * 0.15);
    ctx.strokeRect(-this.rad * 0.5, this.rad * 0.12, this.rad, this.rad * 0.15);

    // 旋转炮塔（方形底座）
    ctx.save();
    ctx.rotate(this.angle);
    ctx.fillStyle = '#2c2f38';
    ctx.fillRect(-this.rad * 0.3, -this.rad * 0.3, this.rad * 0.6, this.rad * 0.6);
    ctx.fillStyle = '#3a3d47';
    ctx.fillRect(8, -6, 26, 12);
    ctx.fillStyle = '#111';
    ctx.fillRect(32, -4, 8, 8);
    ctx.strokeStyle = team.color; ctx.lineWidth = 2.5;
    ctx.strokeRect(-this.rad * 0.42, -this.rad * 0.42, this.rad * 0.84, this.rad * 0.84);
    ctx.restore();

    // 雉堞（齿状墙头）
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ctx.fillStyle = '#6b7263';
      ctx.fillRect(Math.cos(a) * this.rad * 0.92 - 5, Math.sin(a) * this.rad * 0.92 - 5, 10, 10);
    }

    // 队伍旗 + 塔标
    ctx.strokeStyle = '#2a1c0e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -this.rad * 0.9); ctx.lineTo(0, -this.rad * 1.5); ctx.stroke();
    const flap = Math.sin(this.t * 3) * 2;
    ctx.fillStyle = team.color;
    ctx.beginPath();
    ctx.moveTo(0, -this.rad * 1.5);
    ctx.lineTo(26 + flap, -this.rad * 1.42);
    ctx.lineTo(0, -this.rad * 1.34);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(this.tier === 1 ? '一' : '二', 0, this.rad - 6);

    // 血条
    const w = this.rad * 2, h = 7;
    const bx = -w / 2, by = -this.rad - 30;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, bx, by, w, h, 3); ctx.fill();
    ctx.fillStyle = team.color;
    roundRect(ctx, bx, by, w * clamp(this.hp / this.maxHp, 0, 1), h, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    roundRect(ctx, bx, by, w, h, 3); ctx.stroke();

    // 无敌护罩（一塔未全拆的二塔，圆形能量泡）
    if (this.invuln) {
      const pulse = (Math.sin(this.t * 3) + 1) / 2;
      ctx.save();
      const rr = this.rad * (1.08 + pulse * 0.07);
      ctx.globalAlpha = 0.18 + pulse * 0.16;
      ctx.fillStyle = '#7fe0ff';
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = '#aef4ff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, rr + 3, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    if (this.flash > 0) {
      ctx.globalAlpha = this.flash / 0.1;
      ctx.fillStyle = '#fff';
      ctx.fillRect(-this.rad, -this.rad, this.rad * 2, this.rad * 2);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}
