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
    this.angle = def.team === 0 ? 0 : Math.PI;
    this.fireCD = rand(0.3, 1.0);
    this.flash = 0;
    this.t = rand(0, TAU);
  }

  hitBy(dmg, ix, iy, game) {
    if (this.dead) return;
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
    }
  }

  update(dt, game) {
    if (this.dead) return;
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);

    // 索敌：射程内最近的对立单位（英雄优先）
    let target = null, bestHero = Infinity, bestAny = Infinity;
    for (const u of game.units) {
      if (u.dead || u.team === this.team) continue;
      const d = dist(this.x, this.y, u.x, u.y);
      if (d <= TOWER_DEF.range) {
        if (u.isHero) { if (d < bestHero) { bestHero = d; target = u; } }
        else if (d < bestAny) { bestAny = d; }
      }
    }
    if (!target && bestAny < Infinity) {
      for (const u of game.units) {
        if (u.dead || u.team === this.team || u.isHero) continue;
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
    ctx.save();
    ctx.translate(this.x, this.y);

    // 水中石台
    ctx.fillStyle = 'rgba(140,160,150,0.5)';
    ctx.beginPath(); ctx.ellipse(0, 10, this.rad * 1.5, this.rad * 0.75, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5a5f56';
    ctx.beginPath(); ctx.arc(0, 0, this.rad * 1.15, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3c4038'; ctx.lineWidth = 3; ctx.stroke();

    // 塔身（石砌）
    const g = ctx.createRadialGradient(-10, -12, 4, 0, 0, this.rad);
    g.addColorStop(0, '#8a917f');
    g.addColorStop(1, '#565c50');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, this.rad, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3c4038'; ctx.lineWidth = 2.5; ctx.stroke();

    // 石纹
    ctx.strokeStyle = 'rgba(40,45,38,0.5)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
      ctx.lineTo(Math.cos(a) * this.rad * 0.9, Math.sin(a) * this.rad * 0.9);
      ctx.stroke();
    }

    // 旋转炮塔（对准目标）
    ctx.save();
    ctx.rotate(this.angle);
    ctx.fillStyle = '#2c2f38';
    ctx.beginPath(); ctx.arc(0, 0, this.rad * 0.42, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a3d47';
    roundRect(ctx, 8, -6, 26, 12, 5); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(34, 0, 5, 0, TAU); ctx.fill();
    ctx.strokeStyle = team.color; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, this.rad * 0.55, 0, TAU); ctx.stroke();
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

    if (this.flash > 0) {
      ctx.globalAlpha = this.flash / 0.1;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, this.rad, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}
