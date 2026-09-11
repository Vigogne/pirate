/* map.js — 上下两座基地海岛：沙滩 / 椰子树 / 船坞 */
"use strict";

const Map = {
  t: 0,
  update(dt) { this.t += dt; },

  /* --------- 静态地形分块缓存（岛屿/基地/巢穴只画一次，之后按视口 blit） --------- */
  CHUNK_W: 960, CHUNK_H: 900,
  cache: null,

  buildCache() {
    // 无素材（过程式回退）时不做缓存：回退巢穴是逐帧动画
    if (!Assets.ok || !Assets.has('island_0') || typeof document === 'undefined') return false;
    const cw = this.CHUNK_W, ch = this.CHUNK_H;
    const cols = Math.ceil(WORLD.w / cw), rows = Math.ceil(WORLD.h / ch);
    const canvases = [];
    try {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cv = document.createElement('canvas');
          cv.width = cw; cv.height = ch;
          const c2 = cv.getContext('2d');
          if (!c2) throw new Error('no 2d ctx');
          c2.imageSmoothingEnabled = false;
          c2.translate(-c * cw, -r * ch);
          this._drawStatic(c2, c * cw, r * ch, cw, ch);
          canvases.push(cv);
        }
      }
    } catch (e) { this.cache = null; return false; }
    this.cache = { cw, ch, cols, rows, canvases };
    return true;
  },

  /* 静态地形内容（岛屿群 / 基地岛 / 海兽巢穴） */
  _drawStatic(ctx, rx0 = 0, ry0 = 0, rw = WORLD.w, rh = WORLD.h) {
    const hits = (x, y, pad) => x + pad >= rx0 && x - pad <= rx0 + rw && y + pad >= ry0 && y - pad <= ry0 + rh;

    const ISLAND_IDS = ['island_0', 'island_1', 'island_2', 'island_3'];
    let li = 0;
    for (const l of LAND) {
      if (l.base) continue;
      const id = ISLAND_IDS[li % 4]; li++;
      const pad = Math.max(l.rx, l.ry) * 1.3 + 60;
      if (!hits(l.x, l.y, pad)) continue;
      if (Assets.has(id)) {
        Assets.draw(ctx, id, l.x, l.y, l.rx / 96, 0, l.ry / 96);
        // 椰树独立叠加（不随岛形拉伸变形）；树冠摇摆由贴图倾斜模拟
        const pn = l.rx >= 95 ? 3 : 2;
        for (let i = 0; i < pn; i++) {
          const a = (i / pn) * TAU + li * 1.9 + i * 0.6;
          const px = l.x + Math.cos(a) * l.rx * 0.58;
          const py = l.y + Math.sin(a) * l.ry * 0.58;
          const s = 0.85 + ((i * 7 + li * 3) % 4) * 0.07;
          Assets.draw(ctx, 'palm', px, py - 30 * s, s, ((i + li) % 3 - 1) * 0.08);
        }
        continue;
      }
      this._island(ctx, l);
    }

    // 双方基地岛
    for (const b of BASES) {
      if (!hits(b.x, b.y, 280)) continue;
      if (Assets.has('base_0')) Assets.draw(ctx, 'base_' + b.team, b.x, b.y, 178 / 160, 0, 130 / 102);
      else this._baseIsland(ctx, { bases: [b] }, b);
    }

    // 野区海兽巢穴
    for (const m of JUNGLE_BOSSES) {
      if (!hits(m.x, m.y, 240)) continue;
      if (m.lair === 'grotto') {
        if (Assets.has('lair_grotto')) Assets.draw(ctx, 'lair_grotto', m.x, m.y, 1, 0);
        else this._lairGrotto(ctx, m.x, m.y);
      } else if (m.lair === 'wreck') {
        if (Assets.has('lair_wreck')) Assets.draw(ctx, 'lair_wreck', m.x, m.y, 1, 0);
        else this._lairWreck(ctx, m.x, m.y);
      }
    }

    // 浅滩（可通行浅水：沙底 + 泡沫圈；大型船在此减速）
    for (const s of SHOALS) {
      if (!hits(s.x, s.y, Math.max(s.rx, s.ry) + 40)) continue;
      this._shoal(ctx, s.x, s.y, s.rx, s.ry);
    }
  },

  /* 浅滩：半透明沙底 + 亮色浅水环 + 泡沫碎点 */
  _shoal(ctx, x, y, rx, ry) {
    ctx.save();
    const g = ctx.createRadialGradient(x, y, Math.min(rx, ry) * 0.2, x, y, Math.max(rx, ry));
    g.addColorStop(0, 'rgba(226,212,158,0.55)');
    g.addColorStop(0.55, 'rgba(180,232,224,0.40)');
    g.addColorStop(1, 'rgba(150,220,220,0)');
    ctx.fillStyle = g;
    this._coast(ctx, x, y, rx, ry, 13, 30);
    ctx.fill();
    // 沙纹
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#f2e6bc';
    ctx.lineWidth = 1.4;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.ellipse(x, y + i * ry * 0.22, rx * (0.3 + Math.abs(i) * 0.16), ry * (0.12 + Math.abs(i) * 0.05), 0, 0, TAU);
      ctx.stroke();
    }
    // 边缘泡沫（模拟动态波纹）
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    const wob = Math.sin(this.t * 1.6) * 2;
    this._coast(ctx, x, y, rx + wob, ry + wob, 13, 34);
    ctx.stroke();
    ctx.restore();
  },

  draw(ctx, game) {
    // 静态地形：优先走分块缓存（只画可见块）
    if (this.cache || this.buildCache()) {
      const cw = this.cache.cw, ch = this.cache.ch;
      const vw = View.w / Settings.zoom, vh = View.h / Settings.zoom;
      const x0 = Math.max(0, Math.floor(game.cam.x / cw));
      const x1 = Math.min(this.cache.cols - 1, Math.floor((game.cam.x + vw) / cw));
      const y0 = Math.max(0, Math.floor(game.cam.y / ch));
      const y1 = Math.min(this.cache.rows - 1, Math.floor((game.cam.y + vh) / ch));
      for (let r = y0; r <= y1; r++) {
        for (let c = x0; c <= x1; c++) {
          const cv = this.cache.canvases[r * this.cache.cols + c];
          if (cv) ctx.drawImage(cv, c * cw, r * ch);
        }
      }
    } else {
      this._drawStatic(ctx);
    }

    // —— 动态部分：基地血条 ——
    for (const base of game.bases) {
      const bw = 150, bh = 10;
      const by = base.y + 92;   // 血条放在栈桥一侧，避开旗杆
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      roundRect(ctx, base.x - bw / 2, by, bw, bh, 4); ctx.fill();
      ctx.fillStyle = TEAM[base.team].color;
      roundRect(ctx, base.x - bw / 2, by, bw * clamp(base.hp / base.maxHp, 0, 1), bh, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
      roundRect(ctx, base.x - bw / 2, by, bw, bh, 4); ctx.stroke();
    }
  },

  /* 章鱼巢：礁石溶洞——墨紫泻湖 + 环礁石（留巢口）+ 螺旋巨壳 + 气泡与旋涡 */
  _lairGrotto(ctx, x, y) {
    const t = this.t;
    ctx.save();
    // 墨紫泻湖（自然轮廓 + 柔光）
    const g = ctx.createRadialGradient(x, y, 10, x, y, 120);
    g.addColorStop(0, 'rgba(70,30,110,0.5)');
    g.addColorStop(0.7, 'rgba(50,25,90,0.28)');
    g.addColorStop(1, 'rgba(50,25,90,0)');
    ctx.fillStyle = g;
    this._coast(ctx, x, y, 130, 88, 71, 36); ctx.fill();
    // 旋涡（圆环虚线）
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#c9a4ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 10]);
    ctx.lineDashOffset = -t * 30;
    for (let r = 30; r <= 66; r += 18) {
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.72, 0, 0, TAU); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    // 礁石环（不规则摆石，东南留巢口）
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * TAU - 0.4;
      if (Math.abs(a - 0.9) < 0.5) continue;
      const rr = 74 + (i % 3) * 10;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.72;
      this._coast(ctx, px, py, 11 + (i % 4) * 4, 9 + ((i * 7) % 6), i * 13 + 5, 10);
      ctx.fillStyle = i % 2 ? '#4a5560' : '#39424c'; ctx.fill();
      ctx.strokeStyle = '#232a31'; ctx.lineWidth = 1.6; ctx.stroke();
    }
    // 螺旋巨壳（圆形螺旋纹）
    ctx.save();
    ctx.translate(x + 62, y + 34);
    ctx.rotate(-0.5);
    ctx.fillStyle = '#e8bfa0';
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#a87858'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const a2 = i / 40 * TAU * 2.4;
      const r2 = 1.5 + i / 40 * 10.5;
      const px2 = Math.cos(a2) * r2, py2 = Math.sin(a2) * r2;
      if (i === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
    }
    ctx.stroke();
    ctx.restore();
    // 上涌气泡（圆形）
    for (let i = 0; i < 10; i++) {
      const seed = i * 37.7;
      const bx = x + (Math.sin(seed) * 0.5) * 130;
      const life = sin01(t * 0.7 + seed);
      const by = y + 40 - life * 70;
      ctx.globalAlpha = (1 - life) * 0.5;
      ctx.fillStyle = '#d9c2ff';
      const bs = 1.5 + (seed % 3);
      ctx.beginPath(); ctx.arc(bx, by, bs, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  /* 鲨鱼巢：礁滩沉船——沙洲 + 断成两截的船体 + 斜桅破帆 + 白骨与水纹 */
  _lairWreck(ctx, x, y) {
    const t = this.t;
    ctx.save();
    // 血红藻晕（淡红柔光）
    const g = ctx.createRadialGradient(x, y, 10, x, y, 120);
    g.addColorStop(0, 'rgba(150,40,40,0.30)');
    g.addColorStop(0.7, 'rgba(110,35,45,0.16)');
    g.addColorStop(1, 'rgba(110,35,45,0)');
    ctx.fillStyle = g;
    this._coast(ctx, x, y, 130, 88, 19, 36); ctx.fill();
    // 沙洲（自然轮廓）
    this._coast(ctx, x, y, 118, 80, 23, 40);
    ctx.fillStyle = '#dcc08a'; ctx.fill();
    ctx.strokeStyle = 'rgba(150,110,60,0.5)'; ctx.lineWidth = 1.6; ctx.stroke();
    // 沉船前半段（翘起）
    ctx.save();
    ctx.translate(x - 40, y - 16);
    ctx.rotate(0.5);
    ctx.fillStyle = '#4a3524';
    ctx.beginPath();
    ctx.moveTo(-52, -14); ctx.lineTo(52, 10); ctx.lineTo(44, 26); ctx.lineTo(-56, 8);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2c1e12'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(230,210,170,0.5)'; ctx.lineWidth = 1.4;
    for (let i = -3; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(i * 12 - 8, -8); ctx.lineTo(i * 12, 6); ctx.lineTo(i * 12 + 8, -8); ctx.stroke();
    }
    ctx.restore();
    // 沉船后半段（下沉）
    ctx.save();
    ctx.translate(x + 46, y + 26);
    ctx.rotate(-0.8);
    ctx.fillStyle = '#3e2c1e';
    ctx.beginPath();
    ctx.moveTo(-40, -8); ctx.lineTo(44, 14); ctx.lineTo(36, 30); ctx.lineTo(-44, 12);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#26180e'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    // 斜桅 + 破帆
    ctx.save();
    ctx.translate(x - 10, y - 8);
    ctx.rotate(-0.35 + Math.sin(t * 0.6) * 0.02);
    ctx.strokeStyle = '#2c1e12'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -74); ctx.stroke();
    const flap = Math.sin(t * 1.6) * 5;
    ctx.fillStyle = 'rgba(210,195,160,0.75)';
    ctx.beginPath();
    ctx.moveTo(0, -70);
    ctx.quadraticCurveTo(26 + flap, -52, 24 + flap, -26);
    ctx.lineTo(4, -34);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(90,70,45,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(4, -52); ctx.lineTo(3, -30); ctx.stroke();
    ctx.restore();
    // 白骨（骨棒 + 圆形骨节）
    ctx.strokeStyle = 'rgba(235,225,200,0.65)'; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const seed = i * 61.3;
      const bx = x + (Math.sin(seed) * 0.5) * 100;
      const by = y + (Math.cos(seed * 1.7) * 0.4) * 56;
      const a = seed * 0.7;
      ctx.beginPath();
      ctx.moveTo(bx - Math.cos(a) * 7, by - Math.sin(a) * 7);
      ctx.lineTo(bx + Math.cos(a) * 7, by + Math.sin(a) * 7);
      ctx.stroke();
      ctx.fillStyle = 'rgba(235,225,200,0.8)';
      ctx.beginPath();
      ctx.arc(bx + Math.cos(a) * 6, by + Math.sin(a) * 6, 2, 0, TAU);
      ctx.arc(bx - Math.cos(a) * 6, by - Math.sin(a) * 6, 2, 0, TAU);
      ctx.fill();
    }
    // 水纹涟漪（椭圆环）
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = '#ffb0a0';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      const ph = sin01(t * 0.8 + i * 0.33);
      const rr = 30 + ph * 44;
      ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.6, 0, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  // 有机海岸路径（谐波叠加 → 自然的不规则岛形）
  _coast(ctx, x, y, rx, ry, seed, n = 40) {
    const a1 = 0.10 + (seed % 5) * 0.012, p1 = (seed % 7) * 0.9;
    const a2 = 0.05 + (seed % 3) * 0.015, p2 = (seed % 11) * 0.7;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const t = (i % n) / n * TAU;
      const w = 1 + a1 * Math.sin(t * 2 + p1) + a2 * Math.sin(t * 5 + p2);
      const px = x + Math.cos(t) * rx * w;
      const py = y + Math.sin(t) * ry * w;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  },

  // 大中型陆地岛（自然轮廓：窄边沙滩 + 草甸主体 + 椰树）
  _island(ctx, l) {
    const x = l.x, y = l.y, rx = l.rx, ry = l.ry;
    const big = rx >= 90;
    const seed = ((l.x * 7 + l.y * 13) | 0) % 97;

    // 浅滩光晕（半透明柔光）
    ctx.save();
    this._coast(ctx, x, y, rx * 1.22, ry * 1.22, seed + 31, 44);
    ctx.fillStyle = 'rgba(140,220,200,0.22)'; ctx.fill();
    // 湿沙 → 窄边沙滩 → 草甸
    this._coast(ctx, x, y, rx * 0.99, ry * 0.99, seed + 1, 52);
    ctx.fillStyle = '#c8a568'; ctx.fill();
    this._coast(ctx, x, y, rx * 0.955, ry * 0.955, seed, 52);
    ctx.fillStyle = '#ecd795'; ctx.fill();
    ctx.strokeStyle = 'rgba(150,110,60,0.55)'; ctx.lineWidth = 1.6;
    ctx.stroke();
    this._coast(ctx, x, y, rx * 0.845, ry * 0.845, seed + 5, 52);
    ctx.fillStyle = '#3f8f52'; ctx.fill();
    ctx.strokeStyle = 'rgba(40,102,58,0.8)'; ctx.lineWidth = 1.4;
    ctx.stroke();
    // 草甸明暗
    this._coast(ctx, x - rx * 0.1, y - ry * 0.12, rx * 0.36, ry * 0.34, seed + 9, 30);
    ctx.fillStyle = 'rgba(85,167,102,0.7)'; ctx.fill();
    this._coast(ctx, x + rx * 0.22, y + ry * 0.16, rx * 0.3, ry * 0.28, seed + 13, 26);
    ctx.fillStyle = 'rgba(47,122,66,0.8)'; ctx.fill();
    ctx.restore();

    // 岸线泡沫（沿岸抖动细线）
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let a = 0; a <= TAU + 0.1; a += 0.16) {
      const wob = (Math.sin(a * 5 + this.t * 1.8) * 0.5 + 0.5) * 3.2;
      const px = x + Math.cos(a) * (rx + wob);
      const py = y + Math.sin(a) * (ry + wob);
      if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();

    // 草叶（折线）+ 小花
    ctx.strokeStyle = 'rgba(44,110,58,0.8)';
    ctx.lineWidth = 1.2;
    const gn = big ? 10 : 5;
    for (let i = 0; i < gn; i++) {
      const gg = i * 2.39 + seed;
      const gx = x + (Math.sin(gg) * 0.4) * rx;
      const gy = y + (Math.cos(gg * 1.3) * 0.38) * ry;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + 1.5, gy - 6);
      ctx.lineTo(gx + 3, gy - 11 - (Math.sin(this.t * 1.6 + i + 3) * 0.5 + 0.5) * 3);
      ctx.stroke();
    }

    // 椰子树（大岛上更多）
    const pn = big ? 4 : 2;
    for (let i = 0; i < pn; i++) {
      const a = (i / pn) * TAU + seed;
      const px = x + Math.cos(a) * rx * 0.62;
      const py = y + Math.sin(a) * ry * 0.6;
      this._palm(ctx, px, py, 0.85 + (i % 2) * 0.18);
    }
  },

  _baseIsland(ctx, game, base) {
    const team = TEAM[base.team];
    const x = base.x, y = base.y;
    const top = base.team === 1;               // 敌方基地在上方
    const R = 150;                              // 岛屿半径
    const seed = ((x * 11 + y * 17) | 0) % 97;

    // 自然岛形：浅滩 → 窄边沙滩 → 草甸
    ctx.save();
    this._coast(ctx, x, y, R * 1.2, R * 0.82, seed + 31, 40);
    ctx.fillStyle = 'rgba(140,220,200,0.22)'; ctx.fill();
    this._coast(ctx, x, y, R * 1.0, R * 0.68, seed + 1, 44);
    ctx.fillStyle = '#c8a568'; ctx.fill();
    this._coast(ctx, x, y, R * 0.96, R * 0.65, seed, 44);
    ctx.fillStyle = '#ecd795'; ctx.fill();
    ctx.strokeStyle = 'rgba(150,110,60,0.55)'; ctx.lineWidth = 1.6; ctx.stroke();
    this._coast(ctx, x, y, R * 0.84, R * 0.57, seed + 5, 44);
    ctx.fillStyle = '#3f8f52'; ctx.fill();
    ctx.strokeStyle = 'rgba(40,102,58,0.8)'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.restore();

    // 岸线泡沫（沿岸抖动细线）
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let a = 0; a <= TAU + 0.1; a += 0.14) {
      const wob = (Math.sin(a * 5 + this.t * 2 + 1) * 0.5 + 0.5) * 3.6;
      const px = x + Math.cos(a) * (R * 1.0 + wob);
      const py = y + Math.sin(a) * (R * 0.68 + wob);
      if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();

    // 椰子树（岛周）
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = top ? Math.PI * (0.15 + 0.7 * i / (n - 1)) : Math.PI * (1.15 + 0.7 * i / (n - 1));
      const px = x + Math.cos(a) * R * 0.68;
      const py = y + Math.sin(a) * R * 0.48;
      this._palm(ctx, px, py, 0.95 + (i % 2) * 0.2);
    }

    // 船坞基地
    this._shipyard(ctx, game, base, team);
  },

  // 椰子树（折线树干 + 多面体树冠，方型风格）
  _palm(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    const sway = sqWave(this.t * 1.1 + x * 0.1 + 2) * 0.08;

    // 折线树干（三段折）
    ctx.strokeStyle = '#7a4b26';
    ctx.lineWidth = 7;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-4 + sway * 14, -30);
    ctx.lineTo(-8 + sway * 30, -58);
    ctx.stroke();

    // 横纹（方块纹）
    ctx.strokeStyle = 'rgba(60,35,15,0.5)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 6; i++) {
      const tt = i / 6;
      const bx = (-8 + sway * 30) * tt * tt;
      const by = -58 * tt;
      ctx.beginPath(); ctx.moveTo(bx - 3 - sway * 4, by); ctx.lineTo(bx + 3 + sway * 4, by); ctx.stroke();
    }

    const cx = -8 + sway * 30, cy = -58;
    ctx.save();
    ctx.translate(cx, cy);
    // 多面体叶片（三角长条 + 方叶脉）
    const fronds = 7;
    for (let i = 0; i < fronds; i++) {
      const a = (i / fronds) * Math.PI * 2 + sway;
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = i % 2 ? '#2f8f4e' : '#37a45a';
      const fl = 38 + sqWave(this.t * 2 + i + 4) * 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(fl * 0.55, -3);
      ctx.lineTo(fl, 6);
      ctx.lineTo(fl * 0.5, 3);
      ctx.closePath(); ctx.fill();
      // 中脉
      ctx.strokeStyle = 'rgba(25,80,45,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(4, 1); ctx.lineTo(fl * 0.85, 5); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#6b4a22';
    ctx.fillRect(-7, -1, 6, 6);
    ctx.fillRect(1, -1, 6, 6);
    ctx.restore();
    ctx.restore();
  },

  // 船坞基地（各队配色）
  _shipyard(ctx, game, base, team) {
    const x = base.x, y = base.y;
    const w = 210, h = 70;
    const top = base.team === 1;
    ctx.save();
    ctx.translate(x, y);

    const g = ctx.createLinearGradient(0, -h, 0, h);
    g.addColorStop(0, top ? '#9a5f3a' : '#8a6336');
    g.addColorStop(1, top ? '#5f3a24' : '#5f4326');
    ctx.fillStyle = g;
    roundRect(ctx, -w / 2, -h * 0.5, w, h, 9); ctx.fill();
    ctx.strokeStyle = '#3f2c17'; ctx.lineWidth = 3; ctx.stroke();

    ctx.strokeStyle = 'rgba(40,26,14,0.6)'; ctx.lineWidth = 1.4;
    for (let i = 1; i < 6; i++) {
      const yy = -h * 0.5 + (h / 6) * i;
      ctx.beginPath(); ctx.moveTo(-w / 2 + 6, yy); ctx.lineTo(w / 2 - 6, yy); ctx.stroke();
    }

    // 吊机（朝向海面一侧）
    const dir = top ? 1 : -1;
    ctx.fillStyle = '#3a2a18';
    roundRect(ctx, -w / 2 - 30, dir > 0 ? -h * 0.5 : -h * 0.5, 20, 66, 3); ctx.fill();
    ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-w / 2 - 20, -h * 0.5 - 6);
    ctx.quadraticCurveTo(w * 0.35, -h * 0.5 - 30, w * 0.25, -h * 0.5 + 8);
    ctx.stroke();

    // 旗帜（队伍色）
    ctx.strokeStyle = '#2a1c0e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(w / 2 - 12, -h * 0.5); ctx.lineTo(w / 2 - 12, -h * 0.5 - 44); ctx.stroke();
    ctx.fillStyle = team.color;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 12, -h * 0.5 - 44);
    ctx.lineTo(w / 2 - 40, -h * 0.5 - 37);
    ctx.lineTo(w / 2 - 12, -h * 0.5 - 30);
    ctx.closePath(); ctx.fill();

    // 队伍徽记（斜方块）
    ctx.fillStyle = team.color;
    ctx.globalAlpha = 0.9;
    ctx.save();
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-16, -16, 32, 32);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
    ctx.strokeRect(-16, -16, 32, 32);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(base.team === 0 ? '我' : '敌', 0, 1);
    ctx.textBaseline = 'alphabetic';

    // 基地血条（队伍色）
    const bw = w * 0.72, bh = 9;
    const bx = -bw / 2, by = top ? -h * 0.5 - 24 : h * 0.5 + 10;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, bx, by, bw, bh, 4); ctx.fill();
    const pct = clamp(base.hp / base.maxHp, 0, 1);
    ctx.fillStyle = team.color;
    roundRect(ctx, bx, by, bw * pct, bh, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
    roundRect(ctx, bx, by, bw, bh, 4); ctx.stroke();

    ctx.restore();
  },

  _vignette(ctx, W, H) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,20,30,0.4)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  },
};
