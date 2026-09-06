/* assets.js — 本地图像素材加载器（assets/atlas.png + assets/manifest.js）
 * 加载成功后用精灵绘制；失败时游戏回退到过程式绘制（不影响游玩）。
 */
"use strict";

const Assets = {
  ok: false,
  img: null,
  m: {},
  _tiles: {},

  init(done) {
    try {
      const m = window.SPRITE_MANIFEST;
      if (!m || typeof Image === 'undefined') { if (done) done(); return; }
      this.m = m;
      const img = new Image();
      img.onload = () => { this.img = img; this.ok = true; if (done) done(); };
      img.onerror = () => { if (done) done(); };
      img.src = 'assets/atlas.png';
    } catch (e) { if (done) done(); }
  },

  has(id) { return this.ok && !!this.m[id]; },

  /* 帧动画：统计 <base>_0.._n-1 的帧数 */
  frames(base) {
    let n = 0;
    while (this.has(base + '_' + n)) n++;
    return n;
  },

  /* 受击闪光：独立的白描边版本 + 星光碎片（不改变原图） */
  drawFlash(ctx, id, x, y, scale, rot, strength) {
    if (!this.ok) return;
    const eid = id + '__e';
    const r = this.m[eid];
    if (!r) return;
    const w = r.w * scale, h = r.h * scale;
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.globalAlpha = Math.min(1, strength);
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.img, r.x, r.y, r.w, r.h, -w / 2, -h / 2, w, h);
    // 星光碎片
    const sp = this.m['sparkle'];
    if (sp) {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + (i % 2 ? 0.5 : 0.9);
        const d = 16 + (i * 7) % 22;
        ctx.globalAlpha = Math.min(1, strength) * (0.5 + (i % 2) * 0.4);
        ctx.drawImage(this.img, sp.x, sp.y, sp.w, sp.h,
          Math.cos(a) * d - sp.w / 2, Math.sin(a) * d - sp.h / 2, sp.w, sp.h);
      }
    }
    ctx.restore();
  },

  /* 中心锚点绘制（可选旋转 / 轴向拉伸）。像素风：关闭平滑 */
  draw(ctx, id, x, y, scale = 1, rot = 0, scaleY) {
    if (!this.has(id)) return;
    const r = this.m[id];
    const w = r.w * scale, h = r.h * (scaleY || scale);
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.img, r.x, r.y, r.w, r.h, -w / 2, -h / 2, w, h);
    ctx.restore();
  },

  /* 左上角锚点（用于平铺绘图） */
  drawAt(ctx, id, x, y, scale = 1) {
    if (!this.has(id)) return;
    const r = this.m[id];
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.img, r.x, r.y, r.w, r.h, x, y, r.w * scale, r.h * scale);
  },

  /* 从图集抠出单图（缓存的画布） */
  tile(id) {
    if (this._tiles[id]) return this._tiles[id];
    if (!this.has(id)) return null;
    const r = this.m[id];
    const cv = document.createElement('canvas');
    cv.width = r.w; cv.height = r.h;
    const c2 = cv.getContext('2d');
    c2.imageSmoothingEnabled = false;
    c2.drawImage(this.img, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    this._tiles[id] = cv;
    return cv;
  },

  /* 平铺填充给定矩形（用于水面） */
  tileRect(ctx, id, x, y, w, h, offX = 0, offY = 0, repeatW = 32, repeatH = 32) {
    const t = this.tile(id);
    if (!t) return false;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // 先平铺满的基准
    for (let yy = 0; yy < h; yy += repeatH) {
      for (let xx = 0; xx < w; xx += repeatW) {
        ctx.drawImage(t, x + xx + offX, y + yy + offY);
      }
    }
    ctx.restore();
    return true;
  },
};
