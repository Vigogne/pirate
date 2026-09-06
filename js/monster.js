/* monster.js — 野区海兽 Boss：深海章鱼 / 猎鲨王（中立，不在航路上） */
"use strict";

class Monster {
  constructor(game, def) {
    this.game = game;
    this.type = def.type;              // 'octopus' | 'shark'
    this.name = def.name;
    this.isMonster = true;
    this.isHero = false;
    this.team = 2;                     // 中立：谁都打
    this.money = def.money;
    this.reward = def.reward;          // 解锁的装备 id
    this.homeX = def.x; this.homeY = def.y;
    this.lair = def.lair || null;      // 'grotto' | 'wreck'
    this.x = def.x; this.y = def.y;
    this.rad = def.rad;
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.speed = this.type === 'shark' ? 100 : 36;
    this.aggro = this.type === 'shark' ? 310 : 280;
    this.leash = this.type === 'shark' ? 430 : 360;
    this.dead = false;
    this.respawnT = 0;
    this.t = rand(0, TAU);
    this.flash = 0;
    this.fireCD = rand(0.6, 1.4);
    this.vx = 0; this.vy = 0;
    this.face = (this.type === 'shark' && def.team === undefined) ? 0 : 0;
    this.faceTarget = 0;
    this._turn = 0;                       // 角速度（弧度/秒，转身动画用）
  }

  hitBy(dmg, ix, iy, game, killer) {
    if (this.dead) return;
    this.hp -= dmg;
    this.flash = 0.12;
    if (ix !== undefined) Particles.spark(ix, iy, rand(0, TAU), 4, '#ffcf70');
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.respawnT = MONSTER_RESPAWN;
      Particles.explosion(this.x, this.y, 120, this.type === 'octopus' ? '#8a5ac0' : '#ff9d4d', true);
      Particles.smoke(this.x, this.y, 16, 70);
      AudioFX.explosion(true);
      game.onBossDeath(this, killer);
    }
  }

  update(dt, game) {
    if (this.dead) {
      this.respawnT -= dt;
      if (this.respawnT <= 0) {
        this.dead = false;
        this.hp = this.maxHp;
        this.x = this.homeX; this.y = this.homeY;
        Particles.splash(this.x, this.y, 2.5);
      }
      return;
    }
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);

    // 索敌（双方英雄/小兵/塔）
    let target = null, best = Infinity;
    for (const u of game.units) {
      if (u.dead || u.team === 2) continue;
      const d = dist(this.x, this.y, u.x, u.y);
      if (d <= this.aggro && d < best) { best = d; target = u; }
    }

    if (target) {
      this.chasing = true;
      const aim = angleTo(this.x, this.y, target.x, target.y);
      this.faceTarget = aim;
      if (this.type === 'shark') {
        // 鲨鱼：快速追击 · 啃咬
        this.x += Math.cos(aim) * this.speed * dt;
        this.y += Math.sin(aim) * this.speed * dt;
        this.fireCD -= dt;
        if (dist(this.x, this.y, target.x, target.y) < this.rad + target.rad && this.fireCD <= 0) {
          this.fireCD = 0.8;
          target.hitBy(38, this.x, this.y, game, this);
          Particles.explosion(this.x + Math.cos(aim) * this.rad, this.y + Math.sin(aim) * this.rad, 22, '#ffb15a');
          AudioFX.hit();
        }
      } else {
        // 章鱼：缓缓逼近 + 墨汁爆破弹
        if (best > 210) {
          this.x += Math.cos(aim) * this.speed * dt;
          this.y += Math.sin(aim) * this.speed * dt;
        }
        this.fireCD -= dt;
        if (this.fireCD <= 0 && best <= 310) {
          this.fireCD = 1.7;
          const mz = { x: this.x + Math.cos(aim) * this.rad * 0.8, y: this.y + Math.sin(aim) * this.rad * 0.8 };
          Particles.muzzle(mz.x, mz.y, aim, '#b48aff');
          Projectiles.launch({
            x: mz.x, y: mz.y, ang: aim,
            style: 'mortar', damage: 34, splash: 80, pierce: 0,
            team: 2, owner: this, color: '#5a4a7a', size: 6,
            speed: 300, range: 420, arc: true, arcH: 190,
            targetX: target.x, targetY: target.y,
          });
          AudioFX.cannon();
        }
      }
    } else {
      this.chasing = false;
      // 无目标：回巢游弋
      const dh = dist(this.x, this.y, this.homeX, this.homeY);
      if (dh > 60) {
        const a = angleTo(this.x, this.y, this.homeX, this.homeY);
        this.faceTarget = a;
        this.x += Math.cos(a) * this.speed * 0.6 * dt;
        this.y += Math.sin(a) * this.speed * 0.6 * dt;
      } else {
        this.faceTarget = Math.sin(this.t * 0.4) * 0.8;   // 缓慢左右掉头游弋
        this.x = this.homeX + Math.cos(this.t * 0.45) * 34;
        this.y = this.homeY + Math.sin(this.t * 0.32) * 40;
      }
    }

    // 平滑转身（鲨鱼：朝目标角 / 猎物角匀速转向，记录角速度供骨骼弯曲）
    if (this.type === 'shark') {
      const prev = this.face;
      const step = 3.6 * dt;                       // 转身速度（弧度/秒）
      const na = angleLerp(prev, this.faceTarget, step);
      this.face = na;
      let d = na - prev;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      this._turn = dt > 0 ? d / dt : 0;
    }

    // 不离开巢穴太远
    const dh2 = dist(this.x, this.y, this.homeX, this.homeY);
    if (dh2 > this.leash) {
      const a = angleTo(this.x, this.y, this.homeX, this.homeY);
      this.x = this.homeX + Math.cos(a) * this.leash;
      this.y = this.homeY + Math.sin(a) * this.leash;
    }

    // 海兽不能穿过陆地
    game.landResolve(this);
    this.x = clamp(this.x, 60, WORLD.w - 60);
    this.y = clamp(this.y, 70, WORLD.h - 70);

    this.vx = 0; this.vy = 0;
  }

  draw(ctx) {
    if (this.dead) {
      // 重生倒计时标记
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#b48aff';
      ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`🐚 ${Math.max(1, Math.ceil(this.respawnT))}s`, this.x, this.y);
      ctx.restore();
      return;
    }
    // —— 2D 骨骼：章鱼 = 身体 + 8 触手（每根：基骨+梢骨）；鲨鱼 = 身体 + 尾骨 ——
    if (this.type === 'octopus' && Assets.has('oct_body')) {
      if (!this._skel) {
        const root = new Bone('body', 'oct_body', 0, 0, 0, 0);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          const base = root.child(new Bone('t' + k + 'a', 'oct_seg', Math.cos(a) * 26, Math.sin(a) * 26, 0, 9));
          base.child(new Bone('t' + k + 'b', 'oct_tip', 0, 19, 0, 8));
        }
        this._skel = new Skeleton(root);
      }
      const ws = this.chasing ? 8 : 4.2;
      const root = this._skel.root;
      root.bob = Math.sin(this.t * 2.1) * 1.6;
      root.angle = Math.sin(this.t * 0.8) * 0.05;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const seg = this._skel.get('t' + k + 'a');
        seg.angle = a + Math.sin(this.t * ws + k * 0.9) * 0.22;
        const tip = this._skel.get('t' + k + 'b');
        tip.angle = Math.sin(this.t * ws + k * 0.9 + 1.2) * 0.5;
      }
      const scale = this.rad / 42;
      const breath = 1 + Math.sin(this.t * 2.1) * 0.04;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(Math.sin(this.t * 0.8) * 0.05);
      this._skel.draw(ctx, scale * breath, Assets);
      if (this.flash > 0) Assets.drawFlash(ctx, 'oct_body', 0, 0, scale * breath, 0, this.flash / 0.12);
      ctx.restore();
      this._drawBossBar(ctx);
      return;
    }
    if (this.type === 'shark' && Assets.has('shark_head')) {
      if (!this._skel) {
        // 俯视角三段骨骼：头（根）+ 后身（弯曲）+ 尾（摆动）
        const root = new Bone('head', 'shark_head', 0, 0, 0, -17);
        const rear = root.child(new Bone('rear', 'shark_rear', 0, 10, 0, 17));
        rear.child(new Bone('tail', 'shark_tail2', 0, 30, 0, 52));
        this._skel = new Skeleton(root);
      }
      const turn = this._turn || 0;
      // 转身：后身向转弯内侧弯曲（滞后） + 正常游动时轻微起伏
      this._skel.get('rear').angle = clamp(-turn * 0.16, -0.45, 0.45) + Math.sin(this.t * 4.6) * 0.05;
      const whip = Math.abs(turn) > 1.2 ? Math.sin(this.t * 10) * 0.22 : 0;
      this._skel.get('tail').angle = Math.sin(this.t * 7) * 0.36 + whip;
      // 急转弯：身侧划出水涡（白浪弧）
      const scale = this.rad / 32;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate((this.face || 0) + Math.PI / 2);   // 精灵头朝上 → 补偿标准角
      if (Math.abs(turn) > 2.2) {
        const dir = Math.sign(turn);
        ctx.globalAlpha = clamp(Math.abs(turn) * 0.16, 0.2, 0.5);
        ctx.strokeStyle = '#eafcff';
        ctx.lineWidth = 2.2;
        for (let i = 0; i < 2; i++) {
          ctx.beginPath();
          ctx.arc(dir * (12 + i * 6), 4, 16 + i * 10, dir > 0 ? -0.5 - i * 0.3 : Math.PI - 0.7, dir > 0 ? 0.8 : Math.PI + 0.8);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      this._skel.draw(ctx, scale, Assets);
      if (this.flash > 0) Assets.drawFlash(ctx, 'shark_body2', 0, 0, scale, 0, this.flash / 0.12);
      ctx.restore();
      this._drawBossBar(ctx);
      return;
    }

    // 回退：纯图形绘制
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.type === 'octopus') this._drawOctopus(ctx);
    else this._drawShark(ctx);
    if (this.flash > 0) {
      ctx.globalAlpha = this.flash / 0.12;
      ctx.fillStyle = '#fff';
      ctx.fillRect(-this.rad, -this.rad, this.rad * 2, this.rad * 2);
    }
    ctx.restore();
    this._drawBossBar(ctx);
  }

  _drawBossBar(ctx) {
    // 血条 + 名称
    const w = this.rad * 1.9, h = 7;
    roundRect(ctx, this.x - w / 2, this.y - this.rad - 16, w, h, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
    roundRect(ctx, this.x - w / 2, this.y - this.rad - 16, w * clamp(this.hp / this.maxHp, 0, 1), h, 3);
    ctx.fillStyle = '#b48aff'; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(this.name, this.x, this.y - this.rad - 24);
  }

  _drawOctopus(ctx) {
    const R = this.rad;
    const t = this.t;
    const waveSpeed = this.chasing ? 7.5 : 3.4;   // 追击时触手甩得更快
    const breath = Math.sin(t * 2.1) * 0.06;
    const rock = Math.sin(t * 0.8) * 0.06;        // 身体轻微摇摆

    // 触手：程序化行波（8 根 × 5 段，段宽渐细、波幅随节段放大）
    for (let k = 0; k < 8; k++) {
      const baseA = (k / 8) * TAU + 0.4;
      const phase = k * 1.1;
      let px = Math.cos(baseA) * R * 0.3, py = Math.sin(baseA) * R * 0.3;
      let seg = R * 0.34;
      let a2 = baseA;
      const pts = [[px, py]];
      for (let i = 1; i <= 5; i++) {
        const wave = Math.sin(t * waveSpeed + phase + i * 1.05) * (0.10 + i * 0.09);
        a2 = baseA + wave;
        px += Math.cos(a2) * seg; py += Math.sin(a2) * seg;
        pts.push([px, py]);
        seg *= 0.84;
      }
      ctx.strokeStyle = shade('#8a5ac0', -10 - (k % 3) * 9);
      ctx.lineCap = 'round';
      for (let i = 0; i < pts.length - 1; i++) {
        ctx.lineWidth = Math.max(1.3, 7.5 * Math.pow(0.84, i));
        ctx.beginPath();
        ctx.moveTo(pts[i][0], pts[i][1]);
        ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
        ctx.stroke();
      }
      // 吸盘微光（方块）
      if (k % 2 === 0) {
        ctx.fillStyle = 'rgba(60,30,90,0.55)';
        ctx.fillRect(pts[3][0] - 2.2, pts[3][1] - 2.2, 4.4, 4.4);
      } else {
        ctx.fillStyle = 'rgba(230,200,255,0.4)';
        ctx.fillRect(pts[4][0] - 1.8, pts[4][1] - 1.8, 3.6, 3.6);
      }
    }

    // 身体（呼吸 + 摇摆）
    ctx.save();
    ctx.translate(Math.sin(t * 0.8) * R * 0.14, Math.sin(t * 1.2) * 2.5);
    ctx.rotate(rock);
    const bodyR = R * (1 + breath);
    const g = ctx.createRadialGradient(-bodyR * 0.3, -bodyR * 0.3, 4, 0, 0, bodyR);
    g.addColorStop(0, '#a678d8');
    g.addColorStop(0.65, '#7a4fae');
    g.addColorStop(1, '#54307e');
    ctx.fillStyle = g;
    octPath(ctx, 0, 0, bodyR, 0); ctx.fill();
    ctx.strokeStyle = '#3c2260'; ctx.lineWidth = 3;
    octPath(ctx, 0, 0, bodyR, 0); ctx.stroke();

    // 墨点：随呼吸扩散聚拢（方块墨点）
    const ripple = (Math.sin(t * 1.4) + 1) / 2;
    ctx.fillStyle = `rgba(60,30,90,${0.25 + ripple * 0.3})`;
    for (let k2 = 0; k2 < 6; k2++) {
      const a = k2 * 1.05 + t * 0.4;
      const d = bodyR * (0.3 + ripple * 0.24);
      const sz = 2.6 + ripple * 1.4;
      ctx.fillRect(Math.cos(a) * d - sz / 2, Math.sin(a) * d - sz / 2, sz, sz);
    }

    // 怒目 + 眨眼（追击时竖瞳发红，方块眼）
    const blink = (t % 3.6) > 3.45;
    const angry = this.chasing;
    for (let i = 0; i < 2; i++) {
      const cx = (i === 0 ? -0.32 : 0.32) * bodyR, cy = -0.34 * bodyR;
      const er = bodyR * 0.17;
      ctx.fillStyle = '#ffe9c0';
      ctx.fillRect(cx - er, cy - er, er * 2, er * 2);
      if (blink) {
        ctx.strokeStyle = '#3c2260'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy); ctx.stroke();
      } else {
        ctx.fillStyle = angry ? '#e23a2a' : '#1a1030';
        if (angry) {
          ctx.fillRect(cx - bodyR * 0.05, cy - bodyR * 0.09, bodyR * 0.1, bodyR * 0.18);
        } else {
          ctx.fillRect(cx + i * 4 - bodyR * 0.07, cy - bodyR * 0.07, bodyR * 0.14, bodyR * 0.14);
        }
      }
    }
    ctx.restore();
  }

  /* 俯视角鲨鱼（回退绘制）：白色腹缘 + 灰蓝背部，胸鳍后掠，尾骨左右摆 */
  _drawShark(ctx) {
    const R = this.rad;
    ctx.save();
    ctx.rotate((this.face || 0) + Math.PI / 2);
    const path = (pts, col) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      pts.forEach((p, i) => {
        const px = p[0] * R, py = p[1] * R;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.closePath(); ctx.fill();
    };
    const sil = [[0, -2.05], [0.32, -1.68], [0.5, -1.0], [0.96, -0.62], [1.34, 0.1], [1.02, 0.68], [0.62, 0.2], [0.52, 1.05], [0.3, 1.8], [0, 2.0], [-0.3, 1.8], [-0.52, 1.05], [-0.62, 0.2], [-1.02, 0.68], [-1.34, 0.1], [-0.96, -0.62], [-0.5, -1.0], [-0.32, -1.68]];
    path(sil, '#e8f4f8');                                  // 白腹缘
    path(sil.map((p) => [p[0] * 0.84, p[1] * 0.88]), '#4a82a0');  // 背部灰蓝
    path([[0, -1.85], [0.2, -0.7], [0, 1.6], [-0.2, -0.7]], '#5a92ae'); // 脊背受光
    path([[0.4, -0.72], [0.98, -0.02], [0.7, 0.36], [0.4, -0.18]], '#315f7a'); // 右胸鳍
    path([[-0.4, -0.72], [-0.98, -0.02], [-0.7, 0.36], [-0.4, -0.18]], '#315f7a'); // 左胸鳍
    path([[0, -0.5], [0.17, 0.12], [0, 0.72], [-0.17, 0.12]], '#2d5d78'); // 背鳍中刃
    // 尾骨（左右摆）
    ctx.save();
    ctx.translate(0, 1.9 * R);
    ctx.rotate(Math.sin(this.t * 7) * 0.38);
    path([[0, -0.22], [0.5, 0.3], [0.4, 0.72], [0.1, 0.32], [-0.1, 0.32], [-0.4, 0.72], [-0.5, 0.3], [0, -0.22]], '#315f7a');
    ctx.restore();
    // 鳃缝
    ctx.strokeStyle = '#2c5672'; ctx.lineWidth = 1.2;
    for (const s of [1, -1]) for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(s * (0.32 + k * 0.02) * R, (-0.66 + k * 0.15) * R);
      ctx.lineTo(s * (0.4 + k * 0.03) * R, (-0.56 + k * 0.15) * R);
      ctx.stroke();
    }
    // 眼睛（头部两侧）
    for (const s of [1, -1]) {
      ctx.fillStyle = '#f0f7fa';
      ctx.fillRect(s * 0.29 * R - 2.4, -1.4 * R - 2.4, 4.8, 4.8);
      ctx.fillStyle = '#101c24';
      ctx.fillRect(s * 0.29 * R - 1.6, -1.4 * R - 1.6, 3.2, 3.2);
    }
    ctx.restore();
  }
}
