/* utils.js — 通用工具函数 */
"use strict";

const TAU = Math.PI * 2;

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(a = 1, b) { return b === undefined ? Math.random() * a : a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
function randSign() { return Math.random() < 0.5 ? -1 : 1; }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

function dist(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  return Math.hypot(dx, dy);
}
function dist2(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  return dx * dx + dy * dy;
}
function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }

// 将角度插值到 target，考虑环绕，返回新角度
function angleLerp(cur, target, maxStep) {
  let a = target - cur;
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  if (Math.abs(a) <= maxStep) return target;
  return cur + Math.sign(a) * maxStep;
}

// 圆与圆碰撞
function circleHit(ax, ay, ar, bx, by, br) {
  const r = ar + br;
  return dist2(ax, ay, bx, by) <= r * r;
}

// 线段(ax,ay)->(bx,by) 与圆(cx,cy,r) 相交检测（用于高速弹无穿透）
function segCircleHit(ax, ay, bx, by, cx, cy, r) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0) t = clamp(((cx - ax) * dx + (cy - ay) * dy) / len2, 0, 1);
  const px = ax + dx * t, py = ay + dy * t;
  return dist2(px, py, cx, cy) <= r * r;
}

// 用十六进制颜色 + 透明度合成
function hexA(hex, alpha) {
  const c = hex.replace('#', '');
  const bigint = parseInt(c, 16);
  const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

// 颜色明暗调整（hex -> rgb，amt 为 ±）
function shade(hex, amt) {
  const c = hex.replace('#', '');
  const n = parseInt(c, 16);
  const r = clamp((n >> 16) + amt, 0, 255);
  const g = clamp(((n >> 8) & 255) + amt, 0, 255);
  const b = clamp((n & 255) + amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}

// 绘制圆角矩形路径
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 缓动
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

// 格式化数字（千分位）
function fmt(n) { return n.toLocaleString('en-US'); }

const Utils = { TAU, clamp, lerp, rand, randInt, randSign, pick, dist, dist2, angleTo, angleLerp, circleHit, hexA, roundRect, easeOut, easeInOut, fmt };
