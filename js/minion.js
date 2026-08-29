/* minion.js — 护航舰：行为简单的自动单位，沿兵线进攻对方基地 */
"use strict";

class Minion {
  constructor(game, team, lane, type) {
    const def = MINIONS[type || 'sloop'];
    this.game = game;
    this.team = team;
    this.isHero = false;
    this.name = def.name;
    this.money = def.money;
    this.armor = 0;
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.speed = def.speed;
    this.damage = def.damage;
    this.range = def.range;
    this.rate = def.rate;
    this.size = def.size;
    this.palette = def.palette;
    this.rad = 20 * def.size;

    const base = game.baseOf(team);
    this.laneX = LANES[lane % LANES.length];
    this.x = this.laneX + rand(-18, 18);
    this.y = base.y + (team === 0 ? -180 : 180);
    this.angle = team === 0 ? 0 : Math.PI;
    this.t = rand(0, TAU);
    this.wob = rand(0, TAU);
    this.fireCD = rand(0.2, 0.8);
    this.flash = 0;
    this.dead = false;
    this.wake = new WakeTrail(130);
    this.marching = true;
  }

  hitBy(dmg, ix, iy, game) {
    if (this.dead) return;
    this.hp -= dmg;
    this.flash = 0.1;
    if (ix !== undefined) Particles.spark(ix, iy, rand(0, TAU), 3, '#ffcf70');
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      Particles.explosion(this.x, this.y, 34, '#ffb15a');
      Particles.smoke(this.x, this.y, 4, 40);
      AudioFX.explosion(false);
    }
  }

  update(dt, game) {
    if (this.dead) return;
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.wake.update(dt);
    const px = this.x, py = this.y;

    // 索敌（射程内最近的对立单位）
    let target = null, best = Infinity;
    for (const u of game.units) {
      if (u.dead || u.team === this.team) continue;
      const d = dist(this.x, this.y, u.x, u.y);
      if (d <= this.range && d < best) { best = d; target = u; }
    }
      // 敌方基地（塔未拆完基地免伤，只能攻塔）
      const eBase = game.baseOf(1 - this.team);
      if (!target && eBase && !eBase.dead && game.baseOpen(eBase.team) &&
          dist(this.x, this.y, eBase.x, eBase.y) <= this.range + eBase.rad * 0.4) {
        target = eBase;
      }

    this.marching = !target;
    if (target) {
      // 船头坐标系（0=朝上）与标准角度的换算：bow = aim + PI/2
      const aim = angleTo(this.x, this.y, target.x, target.y);
      this.angle = angleLerp(this.angle, aim + Math.PI / 2, 5 * dt);
      this.fireCD -= dt;
      if (this.fireCD <= 0) {
        this.fireCD = 1 / this.rate;
        // 从船艏炮口射出（与船头一致）
        const muzzle = { x: this.x + Math.cos(aim) * 32 * this.size, y: this.y + Math.sin(aim) * 32 * this.size };
        Particles.muzzle(muzzle.x, muzzle.y, aim, '#ffb15a');
        Projectiles.launch({
          x: muzzle.x, y: muzzle.y, ang: aim,
          style: 'cannonball', damage: this.damage, splash: 0, pierce: 0,
          team: this.team, owner: this, color: '#2c2f38', size: 5,
          speed: 420, range: this.range + 40,
        });
        AudioFX.cannon();
      }
    } else {
      // 沿兵线推进
      const dir = this.team === 0 ? -1 : 1;   // 我方在上打，敌方在下打
      const wx0 = this.x, wy0 = this.y;
      this.y += dir * this.speed * dt;
      this.x = this.laneX + Math.sin(this.wob + this.t * 0.9) * 10;
      this.angle = this.team === 0 ? 0 : Math.PI;
      // 实际位移（避免被陆地弹飞时留下凭空轨迹）
      const wmoved = dist(wx0, wy0, this.x, this.y);
      if (wmoved > 1 && wmoved < 60) {
        this.wake.push(this.x, this.y + dir * 18 * this.size, this.size, 0, dir);
      }
    }

    // 世界边界 + 陆地/塔阻挡
    this.x = clamp(this.x, 40, WORLD.w - 40);
    this.y = clamp(this.y, 70, WORLD.h - 70);
    game.landResolve(this);

    this.vx = dt > 0 ? (this.x - px) / dt : 0;
    this.vy = dt > 0 ? (this.y - py) / dt : 0;
  }

  draw(ctx) {
    if (this.dead) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    this.wake.draw(ctx);
    ctx.rotate(this.angle);

    const R = this.rad;
    const hullCol = shade(this.palette[0], this.team === 0 ? 8 : -8);

    // 船体（尖艏平艉，像一艘小帆船）
    ctx.fillStyle = hullCol;
    ctx.beginPath();
    ctx.moveTo(0, -R * 1.2);                       // 艏尖
    ctx.quadraticCurveTo(R * 0.66, -R * 0.8, R * 0.7, -R * 0.1);
    ctx.lineTo(R * 0.58, R * 0.66);
    ctx.quadraticCurveTo(0, R * 0.86, -R * 0.58, R * 0.66);
    ctx.lineTo(-R * 0.7, -R * 0.1);
    ctx.quadraticCurveTo(-R * 0.66, -R * 0.8, 0, -R * 1.2);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = shade(this.palette[0], -48); ctx.lineWidth = 1.8; ctx.stroke();

    // 舷缘亮线
    ctx.strokeStyle = shade(this.palette[0], 34); ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -R * 1.05);
    ctx.quadraticCurveTo(R * 0.55, -R * 0.7, R * 0.56, -R * 0.05);
    ctx.quadraticCurveTo(0, R * 0.7, -R * 0.56, -R * 0.05);
    ctx.quadraticCurveTo(-R * 0.55, -R * 0.7, 0, -R * 1.05);
    ctx.stroke();

    // 甲板
    ctx.fillStyle = this.palette[1];
    ctx.beginPath();
    ctx.moveTo(0, -R * 0.86);
    ctx.quadraticCurveTo(R * 0.45, -R * 0.56, R * 0.46, -R * 0.02);
    ctx.quadraticCurveTo(0, R * 0.66, -R * 0.46, -R * 0.02);
    ctx.quadraticCurveTo(-R * 0.45, -R * 0.56, 0, -R * 0.86);
    ctx.closePath(); ctx.fill();

    // 队伍色条纹（船头段）
    ctx.fillStyle = TEAM[this.team].color;
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.moveTo(-R * 0.4, -R * 0.52);
    ctx.lineTo(R * 0.4, -R * 0.52);
    ctx.lineTo(R * 0.34, -R * 0.4);
    ctx.lineTo(-R * 0.34, -R * 0.4);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;

    // 桅杆 + 横帆（鼓风）
    const flap = Math.sin(this.t * 3 + this.wob) * 0.2;
    ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(0, -R * 0.28); ctx.lineTo(0, -R * 1.0); ctx.stroke();
    ctx.fillStyle = this.palette[1];
    ctx.save();
    ctx.translate(0, -R * 0.62);
    ctx.rotate(flap + 0.1);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-R * 0.55, -R * 0.06, -R * 0.6, R * 0.16);
    ctx.lineTo(0, R * 0.2);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(R * 0.55, -R * 0.06, R * 0.6, R * 0.16);
    ctx.lineTo(0, R * 0.2);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // 桅顶队伍旗
    ctx.fillStyle = TEAM[this.team].color;
    const fw = R * 0.34 + Math.sin(this.t * 5 + this.wob) * 2;
    ctx.beginPath();
    ctx.moveTo(0, -R * 1.0);
    ctx.lineTo(fw, -R * 0.96);
    ctx.lineTo(0, -R * 0.92);
    ctx.closePath(); ctx.fill();

    // 船头小炮（炮口朝船头向前 = 发射方向）
    ctx.fillStyle = '#22262e';
    ctx.beginPath(); ctx.arc(0, -R * 0.42, R * 0.16, 0, TAU); ctx.fill();
    ctx.fillStyle = '#33383f';
    roundRect(ctx, -R * 0.07, -R * 0.78, R * 0.14, R * 0.4, R * 0.07); ctx.fill();

    // 艉舵
    ctx.fillStyle = shade(this.palette[0], -50);
    roundRect(ctx, -R * 0.05, R * 0.78, R * 0.1, R * 0.18, 2); ctx.fill();

    if (this.flash > 0) {
      ctx.globalAlpha = this.flash / 0.1;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // 血条
    if (this.hp < this.maxHp) {
      const w = R * 1.7, h = 4;
      roundRect(ctx, this.x - w / 2, this.y - R - 10, w, h, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();
      roundRect(ctx, this.x - w / 2, this.y - R - 10, w * clamp(this.hp / this.maxHp, 0, 1), h, 2);
      ctx.fillStyle = TEAM[this.team].color; ctx.fill();
    }
  }
}
