/* projectile.js — 弹体系统：team 标注阵营，命中对立单位/基地 */
"use strict";

class Projectile {
  constructor(o) {
    this.x = o.x; this.y = o.y;
    this.ang = o.ang || 0;
    this.style = o.style || 'cannonball';
    this.damage = o.damage || 0;
    this.splash = o.splash || 0;
    this.pierce = o.pierce || 0;
    this.team = o.team;                 // 0 我方 / 1 敌方
    this.owner = o.owner || null;       // 开火单位（英雄斩杀得金）
    this.color = o.color || '#333';
    this.size = o.size || 5;
    this.speed = o.speed || 500;
    this.arc = o.arc;
    this.arcH = o.arcH || 0;
    this.arcDur = 0;
    this.arcT = 0;
    this.startX = o.x; this.startY = o.y;
    this.tx = o.targetX !== undefined ? o.targetX : o.x;
    this.ty = o.targetY !== undefined ? o.targetY : o.y;
    this.maxDist = o.range || 400;
    this.dist = 0;

    this.vx = Math.cos(this.ang) * this.speed;
    this.vy = Math.sin(this.ang) * this.speed;

    this.hit = new Set();
    this.dead = false;
    this.trailTick = 0;

    if (this.arc) {
      const d = dist(this.startX, this.startY, this.tx, this.ty);
      this.arcDur = clamp(d / this.speed, 0.18, 1.6);
    }
    if (this.style === 'torpedo') this.wake = new WakeTrail(70);
  }

  _arcOffset() {
    const t = clamp(this.arcT, 0, 1);
    return 4 * this.arcH * t * (1 - t);
  }

  update(dt, game) {
    if (this.dead) return false;

    if (this.arc) {
      this.arcT += dt / this.arcDur;
      const t = clamp(this.arcT, 0, 1);
      this.x = lerp(this.startX, this.tx, t);
      this.y = lerp(this.startY, this.ty, t);
      if (this.arcT >= 1) { this._impact(game, this.x, this.y); return false; }
    } else {
      this.px = this.x; this.py = this.y;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.dist += this.speed * dt;
      if (this.style === 'torpedo') {
        // 鱼雷贴水面航行：会被陆地挡住
        for (const l of LAND) {
          if (l.base) continue;
          const tdx = (this.x - l.x) / (l.rx + this.size), tdy = (this.y - l.y) / (l.ry + this.size);
          if (tdx * tdx + tdy * tdy < 1) {
            Particles.explosion(this.x, this.y, 40, '#ff8b2a');
            Particles.splash(this.x, this.y, 1.6);
            AudioFX.explosion(false);
            if (this.splash > 0) this._impact(game, this.x, this.y);
            return false;
          }
        }
        if (this.wake) {
          this.wake.update(dt);
          this.wake.push(this.x, this.y, 0.8, Math.cos(this.ang), Math.sin(this.ang));
          if (Math.random() < 0.4) Particles.foam(this.x, this.y, 1);
        }
      }
    }

    if (this._collide(game)) return false;

    if (!this.arc && this.dist >= this.maxDist) {
      if (this.splash > 0) this._impact(game, this.x, this.y);
      else this._smallSplash();
      return false;
    }

    this.trailTick++;
    if (this._wantsTrail()) this._trail();
    return true;
  }

  _wantsTrail() {
    if (this.style === 'bullet') return this.trailTick % 2 === 0;
    if (this.style === 'cannonball' || this.style === 'twinball') return this.trailTick % 3 === 0;
    return false;
  }

  _trail() {
    Particles.spawn({
      type: 'splash', layer: 'low',
      x: this.x, y: this.y, vx: 0, vy: 0,
      life: 0.22, max: 0.22, size: this.size * 0.5,
      color: this.style === 'bullet' ? '#ffe9a0' : '#cfe8ff', drag: 0,
    });
  }

  _smallSplash() { Particles.splash(this.x, this.y, 0.8); }

  _collide(game) {
    // 对立单位（高速弹用线段扫测，防穿透）
    const x0 = this.px !== undefined ? this.px : this.x;
    const y0 = this.py !== undefined ? this.py : this.y;
    for (const u of game.units) {
      if (u.dead || u.invuln || u.team === this.team || this.hit.has(u)) continue;
      const hit = this.arc ? circleHit(this.x, this.y, this.size, u.x, u.y, u.rad)
                           : segCircleHit(x0, y0, this.x, this.y, u.x, u.y, u.rad + this.size);
      if (hit) {
        this._damageUnit(u, game);
        if (this.splash > 0) { this._impact(game, this.x, this.y); return true; }
        if (this.pierce > 0) {
          this.pierce--;
          if (this.pierce <= 0) { this._small(); return true; }
        } else { this._small(); return true; }
      }
    }
    // 对立基地
    for (const b of game.bases) {
      if (b.team === this.team || b.dead) continue;
      if (circleHit(this.x, this.y, this.size, b.x, b.y, b.rad)) {
        game.damageBase(b, this.damage, this.x, this.y, this.owner);
        if (!b.dead && this.splash > 0) this._impact(game, this.x, this.y);
        return true;
      }
    }
    return false;
  }

  _damageUnit(u, game) {
    // 对建筑类（塔/基地结构）有围攻加成，避免推塔久攻不下
    const dmg = u.isTower ? this.damage * 1.8 : this.damage;
    u.hitBy(dmg, this.x, this.y, game, this.owner);
    Particles.spark(this.x, this.y, this.ang, 3, '#ffcf70');
    this._awardGold(u, game);
  }

  _awardGold(u, game) {
    // 斩杀赏金（英雄击杀得金，并分英雄/小兵桶）
    if (u.dead && this.owner && this.owner.isHero && !this.owner.dead) {
      this.owner.gold += u.money;
      if (u.isHero) this.owner.killsHeroes++; else this.owner.killsMinions++;
      game.addFloat(u.x, u.y - 24, '+' + u.money, '#ffd76a');
      AudioFX.coin();
      if (this.owner === game.player) game.playerKills++;
    }
  }

  _small() {
    if (this.style === 'torpedo') {
      Particles.explosion(this.x, this.y, 40, '#ff8b2a');
      AudioFX.explosion(false);
    } else this._smallSplash();
  }

  _impact(game, x, y) {
    if (this.splash > 0) {
      const big = this.style === 'torpedo' || this.style === 'mortar';
      Particles.explosion(x, y, this.splash, big ? '#ff7a2a' : '#ffb15a', big);
      AudioFX.explosion(big);
      Particles.ring(x, y, this.splash);
      for (const u of game.units) {
        if (u.dead || u.invuln || u.team === this.team) continue;
        if (dist(x, y, u.x, u.y) <= this.splash) {
          u.hitBy(this.damage, x, y, game, this.owner);
          this._awardGold(u, game);
        }
      }
      for (const b of game.bases) {
        if (b.team === this.team || b.dead) continue;
        if (dist(x, y, b.x, b.y) <= this.splash + b.rad) {
          game.damageBase(b, this.damage, x, y, this.owner);
        }
      }
    } else this._smallSplash();
  }

  draw(ctx) {
    // —— 像素精灵：弹体（朝右精灵，运行时按发射角旋转） ——
    const projMap = {
      cannonball: 'proj_shell', twinball: 'proj_shell', mortar: 'proj_diamond',
      grenade: 'proj_grenade', harpoon: 'proj_harpoon', torpedo: 'proj_torpedo', bullet: 'proj_bullet',
    };
    const pid = projMap[this.style];
    if (pid && Assets.has(pid)) {
      if (this.arc && this._arcOffset() > 0) {
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#062b45';
        ctx.fillRect(this.x - this.size * 0.5, this.y - this.size * 0.3, this.size, this.size * 0.6);
        ctx.restore();
      }
      const sc = this.style === 'torpedo' ? 1.5 : (this.style === 'harpoon' ? 1.3 : 1.25);
      const b = this.arc ? this._arcOffset() : 0;
      Assets.draw(ctx, pid, this.x, this.y - b, sc, this.ang);
      return;
    }

    ctx.save();
    const a = this.arc ? this._arcOffset() : 0;
    if (this.arc && a > 0) {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#062b45';
      ctx.fillRect(this.x - this.size * 0.5, this.y - this.size * 0.3, this.size, this.size * 0.6);
    }

    const dx = Math.cos(this.ang), dy = Math.sin(this.ang);
    const drawY = this.y - a;

    switch (this.style) {
      case 'bullet':
        ctx.globalAlpha = 1;
        ctx.strokeStyle = this.color; ctx.lineWidth = this.size * 0.8; ctx.lineCap = 'square';
        ctx.beginPath();
        ctx.moveTo(this.x - dx * 14, drawY - dy * 14);
        ctx.lineTo(this.x, drawY);
        ctx.stroke();
        break;
      case 'cannonball':
      case 'twinball':
        ctx.fillStyle = '#1c1f26';
        ctx.fillRect(this.x - this.size / 2, drawY - this.size / 2, this.size, this.size);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(this.x - this.size / 2, drawY - this.size / 2, this.size * 0.4, this.size * 0.4);
        break;
      case 'mortar':
      case 'grenade':
        ctx.save();
        ctx.translate(this.x, drawY);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = this.style === 'mortar' ? '#2a2a2c' : '#4a3a22';
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
        ctx.strokeRect(-this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
        break;
      case 'harpoon':
        ctx.strokeStyle = '#c8cdd4'; ctx.lineWidth = 3; ctx.lineCap = 'square';
        ctx.beginPath();
        ctx.moveTo(this.x - dx * 26, drawY - dy * 26);
        ctx.lineTo(this.x, drawY);
        ctx.stroke();
        ctx.fillStyle = '#dfe4ea';
        ctx.save(); ctx.translate(this.x, drawY); ctx.rotate(this.ang);
        ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-3, -4); ctx.lineTo(-3, 4); ctx.closePath(); ctx.fill();
        ctx.restore();
        break;
      case 'torpedo':
        ctx.save(); ctx.translate(this.x, drawY); ctx.rotate(this.ang);
        ctx.fillStyle = '#37474f';
        ctx.fillRect(-12, -3.5, 24, 7);
        ctx.fillStyle = '#546e7a';
        ctx.beginPath(); ctx.moveTo(11, -3.5); ctx.lineTo(17, 0); ctx.lineTo(11, 3.5); ctx.closePath(); ctx.fill();
        ctx.restore();
        if (this.wake) this.wake.draw(ctx);
        break;
    }
    ctx.restore();
  }
}

const Projectiles = {
  list: [],
  launch(o) { this.list.push(new Projectile(o)); },
  update(dt, game) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (!this.list[i].update(dt, game)) this.list.splice(i, 1);
    }
  },
  draw(ctx) { for (const p of this.list) p.draw(ctx); },
  clear() { this.list = []; },
};
