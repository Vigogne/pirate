/* main.js — 启动：自适应视口（手机横/竖屏）/ 渲染上下文 / 主循环 */
"use strict";

const Render = { ctx: null, W: VIEW.w, H: VIEW.h, dpr: 1 };
let _last = 0;

/* 根据窗口宽高比计算可视范围（保持世界 1280x3600 不变）：
 * - 横屏较宽（>1.42:1）：宽固定 1280，高度按比例收窄（更低看的视野更远）
 * - 竖屏：高固定 900，宽度按比例收窄（相机左右跟随） */
function computeView() {
  const A = window.innerWidth / Math.max(1, window.innerHeight);
  let w, h;
  if (A >= VIEW.w / VIEW.h) {
    w = VIEW.w;
    h = Math.round(clamp(VIEW.w / A, 480, VIEW.h));
  } else {
    h = VIEW.h;
    w = Math.round(clamp(VIEW.h * A, 380, VIEW.w));
  }
  View.w = w;
  View.h = h;
}

function boot() {
  const canvas = document.getElementById('game');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  Render.dpr = dpr;
  computeView();
  Render.W = View.w;
  Render.H = View.h;
  canvas.width = Math.round(View.w * dpr);
  canvas.height = Math.round(View.h * dpr);
  Render.ctx = canvas.getContext('2d');
  Render.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  Input.init(canvas);
  AudioFX.init();
  UI.init(Game);
  Game.init();
  UI.showMenu();

  fitCanvas(canvas);
  window.addEventListener('resize', () => onResize(canvas));
  window.addEventListener('orientationchange', () => setTimeout(() => onResize(canvas), 200));

  requestAnimationFrame(loop);
}

function onResize(canvas) {
  computeView();
  const dpr = Render.dpr;
  canvas.width = Math.round(View.w * dpr);
  canvas.height = Math.round(View.h * dpr);
  Render.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  Render.W = View.w;
  Render.H = View.h;
  fitCanvas(canvas);
}

function fitCanvas(canvas) {
  // 视口比例与窗口一致：直接铺满窗口（等比）
  const scale = Math.min(window.innerWidth / View.w, window.innerHeight / View.h);
  canvas.style.width = Math.round(View.w * scale) + 'px';
  canvas.style.height = Math.round(View.h * scale) + 'px';
}

function loop(ts) {
  const now = ts / 1000;
  let dt = now - _last;
  _last = now;
  if (dt > 0.033) dt = 0.033;
  if (dt < 0) dt = 0;

  Game.update(dt);
  Game.render();
  Input.frameEnd();

  requestAnimationFrame(loop);
}

window.addEventListener('load', boot);
