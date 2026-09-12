/* utils.js — 通用工具函数 */
"use strict";

const TAU = Math.PI * 2;

/* 全局设置（设置面板）：帧数显示 / 声音 / 音量 / 视野缩放 / 画质 */
const Settings = {
  showFps: false,
  volume: 1,
  soundOn: true,
  zoom: 1,          // 当前视野缩放（>1 看得更近，<1 看得更远）
  zoomTarget: 1,    // 目标缩放（滚轮 / 双指 / 按钮设置，平滑逼近）
  quality: 'high',  // low | mid | high（粒子数量与水面层数）
  autoQuality: true,     // 帧率过低时自动降一档画质
  difficulty: 'normal',   // easy | normal | hard（敌方 AI 强度）
  pingType: 'gather',     // 当前指令标记类型
};
const ZOOM_MIN = 0.55, ZOOM_MAX = 1.9;

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

/* 视口判定（世界坐标）：剔除屏幕外的绘制（单位/弹体/粒子/航迹）
 * 世界 1920×4500，一屏只看得到约 1/8 —— 剔除能省下大量描边与填充 */
function inView(x, y, pad = 90) {
  if (typeof Game === 'undefined' || !Game.cam || typeof View === 'undefined') return true;
  const zoom = (typeof Settings !== 'undefined' && Settings.zoom) || 1;
  const vw = View.w / zoom, vh = View.h / zoom;
  return x >= Game.cam.x - pad && x <= Game.cam.x + vw + pad &&
         y >= Game.cam.y - pad && y <= Game.cam.y + vh + pad;
}

// sin 归一到 0..1
function sin01(v) { return (Math.sin(v) + 1) / 2; }

/* —— 方型风格化作图工具：圆 → 八边形，椭圆 → 棱角多边形，方波 —— */
function octPts(rx, ry, rot = 0) {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8 + rot;
    pts.push([Math.cos(a) * rx, Math.sin(a) * ry]);
  }
  return pts;
}
function octPath(ctx, x, y, r, rot = 0) {
  const pts = octPts(r, r, rot);
  ctx.beginPath();
  ctx.moveTo(x + pts[0][0], y + pts[0][1]);
  for (let i = 1; i < 8; i++) ctx.lineTo(x + pts[i][0], y + pts[i][1]);
  ctx.closePath();
}
function octEllPath(ctx, x, y, rx, ry, rot = 0) {
  const pts = octPts(rx, ry, rot);
  ctx.beginPath();
  ctx.moveTo(x + pts[0][0], y + pts[0][1]);
  for (let i = 1; i < 8; i++) ctx.lineTo(x + pts[i][0], y + pts[i][1]);
  ctx.closePath();
}
function diaPath(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
  ctx.closePath();
}
function sqPolyPath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}
// 方波化（正弦 → 阶梯状，用于水面与波动纹理）
function sqWave(v) {
  const s = Math.sin(v);
  return Math.sign(s) * Math.min(1, Math.abs(s) * 2.4);
}
// 小地图/标记用菱形方块
function cla(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
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
