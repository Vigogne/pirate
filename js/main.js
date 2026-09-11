/* main.js — 启动：自适应视口（手机横/竖屏）/ 渲染上下文 / 主循环 */
"use strict";

const Render = { ctx: null, W: VIEW.w, H: VIEW.h, dpr: 1 };
let _last = 0;
let _fps = 60;

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
  Assets.init(() => {});          // 异步加载本地像素素材（失败则回退过程式绘制）
  UI.init(Game);
  Game.init();
  UI.showMenu();

  fitCanvas(canvas);
  window.addEventListener('resize', () => onResize(canvas));
  window.addEventListener('orientationchange', () => setTimeout(() => onResize(canvas), 200));

  // 版本自检：部署新版本后，已缓存/已打开的页面会自动更新
  checkVersion(true);
  const _vTimer = setInterval(() => checkVersion(false), 5 * 60 * 1000);
  // 无头环境（Node）里不要让定时器阻止进程退出
  if (_vTimer && typeof _vTimer.unref === 'function') _vTimer.unref();

  requestAnimationFrame(loop);
}

/* ============ 版本自检（防缓存） ============
 * 1) 用 no-store 抓 version.json（带时间戳参数，绕开浏览器与 CDN 缓存）
 * 2) 与本页 GAME_VERSION 比对：不一致 → 清 Cache Storage → 带 ?v=新版本 强刷
 * 3) 30 秒内只强刷一次，避免 CDN 未同步时来回刷新
 */
async function checkVersion(verbose) {
  if (typeof location === 'undefined' || location.protocol === 'file:') return;
  if (typeof fetch !== 'function') return;
  try {
    const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    const remote = data && data.version;
    const local = typeof window !== 'undefined' ? window.GAME_VERSION : null;
    if (!remote || !local || remote === local) {
      if (verbose) console.log('[版本] 已是最新：', local);
      return;
    }
    let last = 0;
    try { last = Number(sessionStorage.getItem('dsh.reloadAt') || 0); } catch (e) { last = 0; }
    if (Date.now() - last < 30000) return;
    try { sessionStorage.setItem('dsh.reloadAt', String(Date.now())); } catch (e) { /* 忽略 */ }
    console.log('[版本] 发现新版本', remote, '（本地', local, '）→ 清理缓存并强刷');
    try {
      if (typeof caches !== 'undefined' && caches.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.update()));
      }
    } catch (e) { /* 忽略 */ }
    if (typeof UI !== 'undefined' && UI.toast) UI.toast('发现新版本，正在更新…', 1.6);
    const url = new URL(location.href);
    url.searchParams.set('v', remote);
    setTimeout(() => location.replace(url.toString()), 700);
  } catch (e) {
    // 离线 / 未部署 version.json：静默忽略，不影响游玩
    if (verbose) console.log('[版本] 自检跳过：', e && e.message);
  }
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
  if (dt > 0) _fps = _fps * 0.92 + (1 / dt) * 0.08;

  // 视野缩放平滑逼近目标值（滚轮 / 双指 / 设置按钮）
  if (Math.abs(Settings.zoom - Settings.zoomTarget) > 0.001) {
    Settings.zoom = lerp(Settings.zoom, Settings.zoomTarget, clamp(dt * 11, 0, 1));
  } else {
    Settings.zoom = Settings.zoomTarget;
  }

  Game.update(dt);
  Game.render();
  drawFps();
  Input.frameEnd();

  requestAnimationFrame(loop);
}

/* 帧数显示（设置面板开关） */
function drawFps() {
  if (!Settings.showFps) return;
  const ctx = Render.ctx;
  ctx.save();
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillText(`FPS ${Math.round(_fps)}`, 11, 21);
  ctx.fillStyle = _fps >= 50 ? '#8fe8a0' : (_fps >= 30 ? '#ffd76a' : '#ff8b6a');
  ctx.fillText(`FPS ${Math.round(_fps)}`, 10, 20);
  ctx.restore();
}

window.addEventListener('load', boot);
