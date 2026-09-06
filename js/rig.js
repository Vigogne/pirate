/* rig.js — 2D 骨骼动画：部件挂到骨骼链上，姿态由程序逐帧驱动（非序列帧） */
"use strict";

/* 骨骼节点：spriteId 为该骨骼上的部件精灵
 * px/py：相对父骨骼枢轴的偏移；ox/oy：部件中心相对本骨骼枢轴的偏移（旋转围绕枢轴）
 * angle：当前骨骼角（由 pose 写入）；sx：横向缩放（帆鼓风）；bob：额外位移 */
class Bone {
  constructor(id, spriteId, px = 0, py = 0, ox = 0, oy = 0) {
    this.id = id;
    this.spriteId = spriteId || null;
    this.px = px; this.py = py;
    this.ox = ox; this.oy = oy;
    this.angle = 0;
    this.bob = 0;
    this.sx = 1;
    this.children = [];
  }
  child(b) { this.children.push(b); return b; }
}

class Skeleton {
  constructor(root) { this.root = root; }
  get(id) {
    const walk = (n) => {
      if (n.id === id) return n;
      for (const c of n.children) { const r = walk(c); if (r) return r; }
      return null;
    };
    return walk(this.root);
  }
  draw(ctx, scale = 1, AssetsRef) {
    const drawNode = (n) => {
      ctx.save();
      ctx.translate(n.px * scale, n.py * scale);
      ctx.rotate(n.angle);
      if (n.bob) ctx.translate(n.bob, 0);
      if (n.spriteId) {
        AssetsRef.draw(ctx, n.spriteId, n.ox * scale, n.oy * scale, scale * (n.sx || 1));
      }
      for (const c of n.children) drawNode(c);
      ctx.restore();
    };
    drawNode(this.root);
  }
}
