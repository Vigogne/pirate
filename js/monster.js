/* monster.js — 野区海兽 Boss：深海章鱼 / 猎鲨王（中立，不在航路上） */
"use strict";

class Monster {
  constructor(game, def) {
    this.game = game;
    this.type = def.type;              // 'octopus' | 'shark' | 'serpent' | 'crab'
    this.name = def.name;
    this.isMonster = true;
    this.isHero = false;
    this.team = 2;                     // 中立：谁都打
    this.money = def.money;
    this.reward = def.reward;          // 解锁的装备 id（可为空）
    this.buff = def.buff || null;      // 击杀后给击杀方全队的增益
    this.homeX = def.x; this.homeY = def.y;
    this.lair = def.lair || null;      // 'grotto' | 'wreck'
    this.x = def.x; this.y = def.y;
    this.rad = def.rad;
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.speed = this.type === 'shark' ? 100 : (this.type === 'crab' ? 42 : (this.type === 'serpent' ? 62 : 36));
    this.aggro = this.type === 'shark' ? 310 : (this.type === 'crab' ? 260 : 290);
    this.leash = this.type === 'shark' ? 430 : 380;
    this.armor = this.type === 'crab' ? 0.4 : 0;   // 巨蟹厚壳减伤
    this.dead = false;
    this.respawnT = 0;
    this.t = rand(0, TAU);
    this.flash = 0;
    this.fireCD = rand(0.6, 1.4);
    this.vx = 0; this.vy = 0;
    this.face = (this.type === 'shark' && def.team === undefined) ? 0 : 0;
    this.faceTarget = 0;
    this._turn = 0;                       // 角速度（弧度/秒，转身动画用）
    this._turnS = 0;                      // 平滑后的角速度（避免骨骼抖动）
    this._bendS = 0;                      // 平滑后的脊柱弯曲
    this._whipS = 0;                      // 平滑后的甩尾强度
    this._headA = 0;                      // 海蛇头部平滑朝向
    this.wake = new WakeTrail(90);        // 海兽航迹
  }

  hitBy(dmg, ix, iy, game, killer) {
    if (this.dead) return;
    this.hp -= dmg * (1 - (this.armor || 0));
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
      if (u.dead || u.team === 2 || u.stealthT > 0) continue;
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
      } else if (this.type === 'serpent') {
        // 九头蛇：三头轮番出击 —— 中距离环绕游走 + 毒雾弹封锁 + 近身突咬
        const heads = this._heads || (this._heads = [0, 0, 0]);
        const lunges = this._lunges || (this._lunges = [0, 0, 0]);
        this._tgt = { x: target.x, y: target.y };
        // 环绕游走：保持 220~300 距离，并带一点切向绕圈（更难被直线命中）
        const tang = aim + Math.PI / 2 * (this._orbitDir || (this._orbitDir = Math.random() < 0.5 ? 1 : -1));
        if (best > 300) {
          this.x += Math.cos(aim) * this.speed * dt;
          this.y += Math.sin(aim) * this.speed * dt;
        } else if (best < 210) {
          this.x -= Math.cos(aim) * this.speed * 0.6 * dt;
          this.y -= Math.sin(aim) * this.speed * 0.6 * dt;
        } else {
          this.x += Math.cos(tang) * this.speed * 0.55 * dt;
          this.y += Math.sin(tang) * this.speed * 0.55 * dt;
        }
        if (Math.random() < dt * 0.25) this._orbitDir = -(this._orbitDir || 1);

        // ① 毒雾喷吐：一颗毒雾弹落地成毒云（区域封锁）
        this.fireCD -= dt;
        if (this.fireCD <= 0 && best <= 360) {
          this.fireCD = rand(3.4, 4.6);
          const hi = (this._spitHead = ((this._spitHead || 0) + 1) % 3);
          heads[hi] = 1;                                  // 该头前伸喷吐
          const mz = { x: this.x + Math.cos(aim) * this.rad * 0.8, y: this.y + Math.sin(aim) * this.rad * 0.8 };
          Particles.muzzle(mz.x, mz.y, aim, '#7ef0a0');
          Projectiles.launch({
            x: mz.x, y: mz.y, ang: aim,
            style: 'grenade', damage: 14, splash: 40, pierce: 0,
            team: 2, owner: this, color: '#4a8a5a', size: 7,
            speed: 330, range: 420, arc: true, arcH: 130,
            targetX: target.x, targetY: target.y,
            poisonZone: { r: 104, dur: 7.5, dps: 17 },
          });
          AudioFX.splash();
        }

        // ② 突进撕咬：目标贴脸时某个头猛咬一口
        this.lungeCD = (this.lungeCD || 1.2) - dt;
        if (this.lungeCD <= 0 && best < this.rad + target.rad + 90) {
          this.lungeCD = 1.5;
          const hi = (this._biteHead = ((this._biteHead || 0) + 1) % 3);
          lunges[hi] = 1;
          target.hitBy(30, this.x, this.y, game, this);
          Particles.spark(target.x, target.y, aim, 9, '#a8f0b8');
          Particles.explosion(target.x, target.y, 22, '#5aa86a', false);
          AudioFX.hit();
        }

        // ③ 头上毒液滴落（视觉）
        if (Math.random() < dt * 3) {
          const k = (Math.random() * 3) | 0;
          Particles.spawn({
            type: 'spark', layer: 'low',
            x: this.x + rand(-this.rad * 0.5, this.rad * 0.5), y: this.y + rand(-this.rad * 0.4, this.rad * 0.4),
            vx: 0, vy: rand(6, 18), life: rand(0.35, 0.7), max: 0.7,
            size: rand(1.6, 3), color: '#8fe0a0', drag: 0.96,
          });
          void k;
        }
        // 动画衰减：前伸/突咬随时间回落
        for (let i = 0; i < 3; i++) {
          const decay = heads[i] > 0.45 ? 5 : 1.1;       // 先急伸、再慢慢收回
          heads[i] = Math.max(0, heads[i] - dt * decay);
          lunges[i] = Math.max(0, lunges[i] - dt * 2.6);
        }
      } else if (this.type === 'crab') {
        // 巨蟹：缓慢横移逼近，铁钳重击 + 厚壳减伤
        this.x += Math.cos(aim) * this.speed * dt;
        this.y += Math.sin(aim) * this.speed * dt;
        this.fireCD -= dt;
        if (dist(this.x, this.y, target.x, target.y) < this.rad + target.rad + 6 && this.fireCD <= 0) {
          this.fireCD = 1.2;
          target.hitBy(52, this.x, this.y, game, this);
          Particles.spark(target.x, target.y, aim, 8, '#e8d9c2');
          Particles.explosion(this.x + Math.cos(aim) * this.rad, this.y + Math.sin(aim) * this.rad, 26, '#c8d4dc');
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
      const step = 3.2 * dt;                       // 转身速度（弧度/秒）
      const na = angleLerp(prev, this.faceTarget, step);
      this.face = na;
      let d = na - prev;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      const raw = clamp(dt > 0 ? d / dt : 0, -5, 5);
      // 一阶低通：目标切换/掉头时不会让脊柱与尾骨猛抖
      this._turnS += (raw - this._turnS) * Math.min(1, dt * 6);
      this._turn = this._turnS;
    }

    // 海兽航迹（缓慢移动也留一点沫）
    const movedD = dist(this.x, this.y, this._wx0 === undefined ? this.x : this._wx0, this._wy0 === undefined ? this.y : this._wy0);
    if (movedD > 1.4 && movedD < 80) {
      const nx = (this.x - this._wx0) / movedD, ny = (this.y - this._wy0) / movedD;
      this.wake.push(this.x - nx * this.rad * 0.9, this.y - ny * this.rad * 0.9, this.rad / 55, nx, ny);
    }
    this._wx0 = this.x; this._wy0 = this.y;
    this.wake.update(dt);

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
    // 海兽航迹（画在身体之下）
    this.wake.draw(ctx);
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
      root.sx = 1 + Math.sin(this.t * 2.1) * 0.035;                 // 随呼吸收放
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const seg = this._skel.get('t' + k + 'a');
        // 行波：越靠后的触手相位略滞后，追击时更激烈
        seg.angle = a + Math.sin(this.t * ws + k * 0.9) * (this.chasing ? 0.3 : 0.2);
        const tip = this._skel.get('t' + k + 'b');
        tip.angle = Math.sin(this.t * ws + k * 0.9 + 1.2) * (this.chasing ? 0.62 : 0.45);
      }
      const scale = this.rad / 42;
      const breath = 1 + Math.sin(this.t * 2.1) * 0.04;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(Math.sin(this.t * 0.8) * 0.05);
      // 墨雾气泡（偶发上浮，增添生气）
      if (Math.random() < 0.05) {
        Particles.spawn({
          type: 'smoke', layer: 'high',
          x: this.x + rand(-this.rad * 0.5, this.rad * 0.5), y: this.y + rand(-this.rad * 0.4, this.rad * 0.4),
          vx: rand(-6, 6), vy: rand(-26, -12),
          life: rand(0.6, 1.1), max: 1.1, size: rand(3, 6), grow: 8, color: '#7a5aa8', drag: 0.94,
        });
      }
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
      const turn = clamp(this._turnS || 0, -3, 3);
      // 平滑弯曲与甩尾（避免转向切换时骨骼跳动）
      const bendTarget = clamp(-turn * 0.14, -0.4, 0.4);
      this._bendS += (bendTarget - this._bendS) * Math.min(1, 0.18);
      const whipTarget = Math.min(1, Math.abs(turn) / 2.2);
      this._whipS += (whipTarget - this._whipS) * 0.1;
      const beat = 6.2 + (this.chasing ? 2.4 : 0);
      const head = this._skel.get('head');
      if (head) head.bob = Math.sin(this.t * 2.2) * 1.6;          // 游动时左右轻摆
      this._skel.get('rear').angle = this._bendS + Math.sin(this.t * 4.4) * 0.045;
      this._skel.get('tail').angle = Math.sin(this.t * beat) * (0.32 + this._whipS * 0.3)
                                   + Math.sin(this.t * beat * 0.45) * 0.05;
      const scale = this.rad / 32;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate((this.face || 0) + Math.PI / 2);   // 精灵头朝上 → 补偿标准角
      if (Math.abs(turn) > 1.6) {
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
    else if (this.type === 'shark') this._drawShark(ctx);
    else if (this.type === 'serpent') this._drawSerpent(ctx);
    else this._drawCrab(ctx);
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

  /* 九头蛇（程序化）：盘绕的蛇身 + 三条长颈蛇头（轮番喷毒 / 突咬）
   * 俯视角：身体盘成螺旋沉在水下，三个头从不同方向高昂而立 */
  _drawSerpent(ctx) {
    const R = this.rad, t = this.t;
    const heads = this._heads || (this._heads = [0, 0, 0]);
    const lunges = this._lunges || (this._lunges = [0, 0, 0]);

    // —— 朝向：平滑指向猎物（三头在本地系中各自偏转） ——
    const targetA = (this.face || 0) + Math.PI / 2;
    let dA = targetA - this._headA;
    while (dA > Math.PI) dA -= TAU;
    while (dA < -Math.PI) dA += TAU;
    this._headA += dA * 0.1;
    // 目标在本地坐标系里的角度（供三个头各自瞄准）
    let aimLocal = 0;
    if (this._tgt) {
      aimLocal = Math.atan2(this._tgt.y - this.y, this._tgt.x - this.x) - this._headA;
      while (aimLocal > Math.PI) aimLocal -= TAU;
      while (aimLocal < -Math.PI) aimLocal += TAU;
    }

    ctx.save();
    ctx.rotate(this._headA);

    // —— 水面扰动（盘踞处的水纹与泡沫） ——
    ctx.save();
    ctx.globalAlpha = 0.22 + Math.sin(t * 1.6) * 0.05;
    ctx.strokeStyle = '#bfe9d8';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const rr = R * (1.15 + i * 0.24) + Math.sin(t * 1.4 + i) * 3;
      ctx.beginPath(); ctx.ellipse(0, R * 0.15, rr, rr * 0.62, 0, 0, TAU); ctx.stroke();
    }
    ctx.restore();

    // —— 盘绕蛇身：由外圈到内圈的分节螺旋（行波起伏 + 背鳍棘） ——
    const coilN = 34;
    for (let i = coilN; i >= 0; i--) {
      const f = i / coilN;                              // 0 外圈尾端 → 1 内圈颈根
      const ang = -0.6 + f * TAU * 2.35;
      const rr = R * (1.28 - f * 0.95);
      const wave = Math.sin(t * 2.6 - f * 6.2) * R * 0.05 * (0.4 + f);
      const px = Math.cos(ang) * (rr + wave);
      const py = Math.sin(ang) * (rr + wave) * 0.62 + R * 0.15;
      const seg = R * (0.17 + 0.16 * (1 - f));
      // 背鳍棘（朝外）
      const fh = R * (0.22 - f * 0.1);
      ctx.fillStyle = 'rgba(20,54,42,0.9)';
      ctx.beginPath();
      ctx.moveTo(px + Math.cos(ang) * seg * 0.2, py + Math.sin(ang) * seg * 0.2);
      ctx.lineTo(px + Math.cos(ang) * (seg + fh), py + Math.sin(ang) * (seg + fh) * 0.62);
      ctx.lineTo(px + Math.cos(ang) * seg * 0.2 - seg * 0.6, py + Math.sin(ang) * seg * 0.6);
      ctx.closePath(); ctx.fill();
      // 体节（深浅交替 + 腹鳞高光 + 斑纹）
      ctx.fillStyle = f % 0.28 < 0.14 ? '#2c6650' : '#357a5e';
      ctx.beginPath(); ctx.ellipse(px, py, seg, seg * 0.82, ang, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(160,230,190,0.26)';
      ctx.beginPath(); ctx.ellipse(px - seg * 0.28, py + seg * 0.3, seg * 0.5, seg * 0.32, ang, 0, TAU); ctx.fill();
      if (i % 4 === 0) {
        ctx.fillStyle = 'rgba(14,44,34,0.55)';
        ctx.beginPath(); ctx.ellipse(px + seg * 0.3, py - seg * 0.3, seg * 0.26, seg * 0.2, ang, 0, TAU); ctx.fill();
      }
    }

    // —— 三条长颈 + 三个蛇头（依次偏转，各自瞄准猎物） ——
    for (let k = 0; k < 3; k++) {
      const rest = -Math.PI / 2 + (k - 1) * 0.78;                  // 静止时三头呈扇形
      const sway = Math.sin(t * 1.5 + k * 2.1) * 0.14;             // 呼吸式摆动
      const track = clamp(aimLocal - rest, -0.85, 0.85) * 0.55;    // 朝猎物偏转
      const ext = 1 + heads[k] * 0.55 + lunges[k] * 0.75;          // 喷吐/突咬时前伸
      const neckLen = R * 0.7 * ext;
      const baseA = rest + sway + track;
      // 颈根（从内圈伸出）
      let px = Math.cos(rest) * R * 0.18, py = Math.sin(rest) * R * 0.18 + R * 0.15;
      const segs = 5;
      for (let s = 0; s < segs; s++) {
        const f = s / segs;
        const segA = baseA + Math.sin(t * 2.2 + k * 1.7 + s * 0.6) * 0.07 * (1 - f);
        const len = neckLen / segs;
        const nx = px + Math.cos(segA) * len;
        const ny = py + Math.sin(segA) * len * 0.86;
        const w = R * (0.17 - f * 0.06) * (1 + heads[k] * 0.15);
        // 颈部（前亮后暗，环纹）
        ctx.strokeStyle = '#2f6b52';
        ctx.lineWidth = w * 2;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
        ctx.strokeStyle = 'rgba(150,225,185,0.35)';
        ctx.lineWidth = w * 0.7;
        ctx.beginPath();
        ctx.moveTo(px - Math.sin(segA) * w * 0.35, py + Math.cos(segA) * w * 0.35);
        ctx.lineTo(nx - Math.sin(segA) * w * 0.35, ny + Math.cos(segA) * w * 0.35);
        ctx.stroke();
        if (s % 2 === 0) {
          ctx.strokeStyle = 'rgba(18,50,38,0.65)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px + Math.cos(segA + 1.2) * w, py + Math.sin(segA + 1.2) * w);
          ctx.lineTo(px + Math.cos(segA - 1.2) * w, py + Math.sin(segA - 1.2) * w);
          ctx.stroke();
        }
        px = nx; py = ny;
      }
      // 头部朝向：颈末方向 + 朝猎物修正
      const hA = baseA + Math.sin(t * 2.2 + k * 1.7 + 0.6) * 0.05;
      this._hydraHead(ctx, px, py, hA, R * 0.46, {
        k, t, heads: heads[k], lunges: lunges[k], chasing: !!this.chasing, aim: aimLocal,
      });
    }
    ctx.restore();
  }

  /* 九头蛇单头：骨感尖颅 + 开合利颚 + 竖瞳 + 头冠鳍 */
  _hydraHead(ctx, x, y, a, S, o) {
    const open = clamp(0.14 + o.heads * 0.75 + o.lunges * 0.5 + (o.chasing ? Math.sin(o.t * 6 + o.k) * 0.12 : 0), 0.1, 1.1);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a + Math.PI / 2);   // 头朝本地 +y（前进方向）

    // 头冠鳍（三片）
    ctx.fillStyle = '#1f5038';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * S * 0.34, -S * 0.3);
      ctx.lineTo(i * S * 0.62, -S * 1.0 - Math.abs(i) * S * 0.1);
      ctx.lineTo(i * S * 0.12, -S * 0.62);
      ctx.closePath(); ctx.fill();
    }
    // 颅骨（略呈棱角）
    const hg = ctx.createLinearGradient(-S * 0.6, -S * 0.6, S * 0.6, S * 0.6);
    hg.addColorStop(0, '#3f8a68');
    hg.addColorStop(0.6, '#2f6b52');
    hg.addColorStop(1, '#22523e');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.moveTo(0, -S * 0.72);
    ctx.lineTo(S * 0.5, -S * 0.18);
    ctx.lineTo(S * 0.44, S * 0.34);
    ctx.lineTo(0, S * 0.56);
    ctx.lineTo(-S * 0.44, S * 0.34);
    ctx.lineTo(-S * 0.5, -S * 0.18);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#16362a'; ctx.lineWidth = 2; ctx.stroke();
    // 头背高光 + 鳞纹
    ctx.fillStyle = 'rgba(165,235,195,0.3)';
    ctx.beginPath(); ctx.ellipse(-S * 0.14, -S * 0.24, S * 0.24, S * 0.3, -0.3, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(16,46,34,0.55)'; ctx.lineWidth = 1.3;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(i * S * 0.24, -S * 0.4); ctx.lineTo(i * S * 0.24, S * 0.2); ctx.stroke();
    }
    // 下颚 + 口腔 + 牙
    ctx.save();
    ctx.translate(0, S * 0.26);
    ctx.rotate(open * 0.5);
    ctx.fillStyle = '#2b6650';
    ctx.beginPath();
    ctx.moveTo(-S * 0.4, 0);
    ctx.quadraticCurveTo(0, S * 0.4, S * 0.4, 0);
    ctx.quadraticCurveTo(0, S * 0.16, -S * 0.4, 0);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f4fbff';
    for (const s of [-1, 0, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * S * 0.2, 0);
      ctx.lineTo(s * S * 0.12, -S * 0.26);
      ctx.lineTo(s * S * 0.28, -S * 0.22);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // 口腔（张口时露红）与上颌毒牙
    if (open > 0.25) {
      ctx.fillStyle = 'rgba(150,44,54,0.9)';
      ctx.beginPath(); ctx.ellipse(0, S * 0.3, S * 0.3 * open, S * 0.22 * open, 0, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#f4fbff';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * S * 0.3, S * 0.2);
      ctx.lineTo(s * S * 0.16, S * 0.62);
      ctx.lineTo(s * S * 0.4, S * 0.5);
      ctx.closePath(); ctx.fill();
    }
    // 双眼（竖瞳，追击转红）+ 眉骨
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#c9f5d4';
      ctx.beginPath(); ctx.ellipse(s * S * 0.3, -S * 0.2, S * 0.16, S * 0.13, s * 0.2, 0, TAU); ctx.fill();
      ctx.fillStyle = o.chasing ? '#e23a2a' : '#0e1a16';
      ctx.beginPath(); ctx.ellipse(s * S * 0.3, -S * 0.2, S * 0.05, S * 0.12, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(s * S * 0.27, -S * 0.26, S * 0.03, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#16362a'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(s * S * 0.12, -S * 0.34); ctx.lineTo(s * S * 0.46, -S * 0.26); ctx.stroke();
    }
    // 鼻尖与信子（喷吐时更明显）
    ctx.fillStyle = 'rgba(12,36,28,0.8)';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * S * 0.1, -S * 0.66, S * 0.045, 0, TAU); ctx.fill(); }
    const flick = Math.max(0, Math.sin(o.t * 2.4 + o.k * 1.7));
    if (flick > 0.5 || o.heads > 0.2) {
      const ex = Math.max(flick > 0.5 ? (flick - 0.5) / 0.5 : 0, o.heads);
      ctx.strokeStyle = '#c8506a'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(0, S * 0.6); ctx.lineTo(0, S * (0.6 + 0.5 * ex)); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, S * (0.6 + 0.5 * ex)); ctx.lineTo(-S * 0.12, S * (0.72 + 0.6 * ex));
      ctx.moveTo(0, S * (0.6 + 0.5 * ex)); ctx.lineTo(S * 0.12, S * (0.72 + 0.6 * ex));
      ctx.stroke();
    }
    ctx.restore();
  }

  /* 俯视角铁甲巨蟹（程序化）：三足步态 + 双钳开合 + 甲壳质感 */
  _drawCrab(ctx) {
    const R = this.rad, t = this.t;
    const chasing = !!this.chasing;
    const gait = t * (chasing ? 4.6 : 2.8);
    ctx.save();
    ctx.rotate((this.face || 0) + Math.PI / 2);

    // ---- 六足：三足步态（相邻腿相位相差半周期，抬起-前伸-落下） ----
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const phase = (i + (s > 0 ? 0 : 1.5)) % 2;      // 交错两组
        const step = Math.sin(gait + phase * Math.PI);
        const lift = Math.max(0, step) * R * 0.22;
        const swing = Math.cos(gait + phase * Math.PI) * R * 0.12;
        const hipX = s * R * 0.42, hipY = R * (0.02 + i * 0.26);
        const kneeX = s * R * (0.92 + i * 0.06), kneeY = hipY + R * (0.1 + i * 0.06) - lift;
        const footX = s * R * (1.26 + i * 0.1) + swing, footY = hipY + R * (0.34 + i * 0.14) - lift * 0.4;
        ctx.strokeStyle = '#7d3526'; ctx.lineWidth = Math.max(2, R * 0.11);
        ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(kneeX, kneeY); ctx.stroke();
        ctx.strokeStyle = '#9a4230'; ctx.lineWidth = Math.max(1.6, R * 0.085);
        ctx.beginPath(); ctx.moveTo(kneeX, kneeY); ctx.lineTo(footX, footY); ctx.stroke();
        ctx.fillStyle = '#5f2018';
        ctx.beginPath(); ctx.arc(kneeX, kneeY, R * 0.07, 0, TAU); ctx.fill();
      }
    }

    // ---- 蟹壳：三层渐变 + 甲片纹 + 藤壶 ----
    const g = ctx.createRadialGradient(-R * 0.28, -R * 0.34, R * 0.15, 0, 0, R);
    g.addColorStop(0, '#e8806a');
    g.addColorStop(0.55, '#c14a34');
    g.addColorStop(1, '#7f2a1f');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, R * 0.98, R * 0.84, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#5f2018'; ctx.lineWidth = 2.6; ctx.stroke();
    // 甲片分区
    ctx.strokeStyle = 'rgba(90,30,20,0.55)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, 0, R * 0.66, R * 0.54, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, R * 0.36, R * 0.3, 0, 0, TAU); ctx.stroke();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * R * 0.1, -R * 0.74);
      ctx.quadraticCurveTo(s * R * 0.6, -R * 0.4, s * R * 0.52, R * 0.36);
      ctx.stroke();
    }
    // 会游走的高光（湿壳反光）
    const sheen = Math.sin(t * 0.9) * R * 0.3;
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#ffe6d8';
    ctx.beginPath(); ctx.ellipse(-R * 0.3 + sheen, -R * 0.38, R * 0.3, R * 0.14, -0.5, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    // 藤壶
    ctx.fillStyle = '#d9cbb4';
    for (const [bx, by, br] of [[-0.42, 0.3, 0.09], [0.36, 0.16, 0.07], [0.16, 0.44, 0.06]]) {
      ctx.beginPath(); ctx.arc(bx * R, by * R, br * R, 0, TAU); ctx.fill();
      ctx.fillStyle = '#8a7a62';
      ctx.beginPath(); ctx.arc(bx * R, by * R, br * R * 0.45, 0, TAU); ctx.fill();
      ctx.fillStyle = '#d9cbb4';
    }

    // ---- 双钳：两节螯肢 + 开合（攻击时快速咬合） ----
    for (const s of [-1, 1]) {
      const snap = chasing
        ? (Math.sin(t * 7 + (s > 0 ? 0 : 1.2)) > 0.2 ? 1 : 0)
        : 0.5 + Math.sin(t * 2.4 + (s > 0 ? 0 : 1.6)) * 0.5;
      const open = 0.28 + (1 - snap) * 0.5;
      ctx.save();
      ctx.translate(s * R * 0.6, -R * 0.66);
      ctx.rotate(s * (0.4 + (1 - snap) * 0.25));
      // 上臂
      ctx.strokeStyle = '#a83f2c'; ctx.lineWidth = Math.max(3, R * 0.2);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * R * 0.42, -R * 0.06); ctx.stroke();
      // 钳掌
      ctx.fillStyle = '#c14a34';
      ctx.beginPath(); ctx.ellipse(s * R * 0.74, -R * 0.06, R * 0.38, R * 0.26, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#5f2018'; ctx.lineWidth = 2; ctx.stroke();
      // 上下钳指
      ctx.fillStyle = '#d1583f';
      for (const up of [-1, 1]) {
        ctx.save();
        ctx.translate(s * R * 1.02, -R * 0.06);
        ctx.rotate(up * open * 0.6);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(s * R * 0.3, up * R * 0.1, s * R * 0.5, up * R * 0.02);
        ctx.quadraticCurveTo(s * R * 0.26, up * R * 0.2, 0, up * R * 0.12);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#5f2018'; ctx.lineWidth = 1.4; ctx.stroke();
        ctx.restore();
      }
      // 关节高光
      ctx.fillStyle = 'rgba(255,220,200,0.35)';
      ctx.beginPath(); ctx.arc(s * R * 0.42, -R * 0.12, R * 0.09, 0, TAU); ctx.fill();
      ctx.restore();
    }

    // ---- 眼柄（带滞后摆动）+ 触须 ----
    for (const s of [-1, 1]) {
      const sway = Math.sin(t * 1.8 + (s > 0 ? 0 : 0.9)) * R * 0.06;
      ctx.strokeStyle = '#8a2f22'; ctx.lineWidth = Math.max(2.4, R * 0.09);
      ctx.beginPath();
      ctx.moveTo(s * R * 0.22, -R * 0.52);
      ctx.quadraticCurveTo(s * R * 0.3 + sway, -R * 0.74, s * R * 0.26 + sway, -R * 0.92);
      ctx.stroke();
      ctx.fillStyle = '#101c18';
      ctx.beginPath(); ctx.arc(s * R * 0.26 + sway, -R * 0.95, R * 0.12, 0, TAU); ctx.fill();
      ctx.fillStyle = chasing ? '#ff6a5a' : '#3fe0a0';
      ctx.beginPath(); ctx.arc(s * R * 0.26 + sway, -R * 0.95, R * 0.055, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(180,90,70,0.8)'; ctx.lineWidth = 1.6;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * R * 0.18, -R * 0.7);
      ctx.quadraticCurveTo(s * R * 0.5, -R * 0.9 + Math.sin(t * 3 + s) * 3, s * R * 0.72, -R * 1.0);
      ctx.stroke();
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
