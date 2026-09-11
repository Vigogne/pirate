/* input.js — 输入管理（键盘 + 鼠标 + 触摸虚拟摇杆） */
"use strict";

const Input = {
  keys: Object.create(null),
  mouse: { x: 0, y: 0, down: false, clicked: false, inFrame: false },
  // 触摸摇杆（移动端）
  touch: { active: false, id: null, x0: 0, y0: 0, x: 0, y: 0 },
  // 双指缩放（移动端）
  pinch: { active: false, dist0: 0, zoom0: 1 },
  isTouch: false,
  _bound: false,

  init(canvas) {
    if (this._bound) return;
    this._bound = true;

    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      // 避免空格滚动页面
      if (e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) / r.width * View.w;
      this.mouse.y = (e.clientY - r.top) / r.height * View.h;
    });
    canvas.addEventListener('mousedown', (e) => {
      this.mouse.down = true;
      this.mouse.clicked = true;
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) / r.width * View.w;
      this.mouse.y = (e.clientY - r.top) / r.height * View.h;
      // 点小地图 = 发指令标记
      if (typeof Game !== 'undefined' && Game.state === 'playing' && Game.minimapPing) {
        Game.minimapPing(this.mouse.x, this.mouse.y);
      }
    });
    window.addEventListener('mouseup', () => { this.mouse.down = false; });

    // PC：滚轮缩放视野（向鼠标方向聚焦）
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const step = -Math.sign(e.deltaY) * 0.12;
      Input.zoomBy(step, e.clientX, e.clientY, canvas);
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      // 右键：在世界里发指令标记（给 AI 队友）
      if (typeof Game !== 'undefined' && Game.state === 'playing' && Game.sendPing) {
        const r = canvas.getBoundingClientRect();
        const sx = (e.clientX - r.left) / r.width * View.w;
        const sy = (e.clientY - r.top) / r.height * View.h;
        const w = Input.screenToWorld(sx, sy);
        Game.sendPing(w.x, w.y);
      }
    });

    /* ---- 触摸：单指拖动 = 摇杆；双指捏合 = 缩放视野 ---- */
    const toView = (t) => {
      const r = canvas.getBoundingClientRect();
      return { x: (t.clientX - r.left) / r.width * View.w, y: (t.clientY - r.top) / r.height * View.h };
    };
    const pinchDist = (touches) => {
      const a = toView(touches[0]), b = toView(touches[1]);
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.isTouch = true;
      if (e.touches.length >= 2) {
        // 双指：进入缩放，收起摇杆
        this.pinch.active = true;
        this.pinch.dist0 = Math.max(1, pinchDist(e.touches));
        this.pinch.zoom0 = Settings.zoomTarget;
        this.touch.id = null;
        this.touch.active = false;
        return;
      }
      const t = e.changedTouches[0];
      const p = toView(t);
      if (this.touch.id === null && !this.pinch.active) {
        this.touch.id = t.identifier;
        this.touch.active = true;
        this.touch.x0 = p.x; this.touch.y0 = p.y;
        this.touch.x = p.x; this.touch.y = p.y;
        this.touch.moved = 0;
      }
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (this.pinch.active && e.touches.length >= 2) {
        const d = pinchDist(e.touches);
        Settings.zoomTarget = clamp(this.pinch.zoom0 * (d / this.pinch.dist0), ZOOM_MIN, ZOOM_MAX);
        return;
      }
      for (const t of e.changedTouches) {
        if (t.identifier !== this.touch.id) continue;
        const p = toView(t);
        this.touch.x = p.x; this.touch.y = p.y;
        this.touch.moved = Math.max(this.touch.moved || 0, Math.hypot(p.x - this.touch.x0, p.y - this.touch.y0));
      }
    }, { passive: false });
    const endTouch = (e) => {
      if (this.pinch.active && e.touches.length < 2) this.pinch.active = false;
      for (const t of e.changedTouches) {
        if (t.identifier !== this.touch.id) continue;
        // 轻点小地图 = 发指令标记
        if ((this.touch.moved || 0) < 12 && typeof Game !== 'undefined' && Game.state === 'playing' && Game.minimapPing) {
          Game.minimapPing(this.touch.x, this.touch.y);
        }
        this.touch.id = null;
        this.touch.active = false;
      }
    };
    canvas.addEventListener('touchend', endTouch);
    canvas.addEventListener('touchcancel', endTouch);
  },

  /* 缩放：step>0 放大。若给了屏幕坐标，则朝该点聚焦（滚轮手感） */
  zoomBy(step, clientX, clientY, canvas) {
    Settings.zoomTarget = clamp(Settings.zoomTarget * Math.exp(step), ZOOM_MIN, ZOOM_MAX);
    if (clientX === undefined || !canvas || typeof Game === 'undefined' || !Game.cam) return;
    // 保持指针下的世界点不动（相机随后仍会平滑回到跟随玩家的位置）
    const r = canvas.getBoundingClientRect();
    const sx = (clientX - r.left) / r.width * View.w;
    const sy = (clientY - r.top) / r.height * View.h;
    const wx = Game.cam.x + sx / Settings.zoom, wy = Game.cam.y + sy / Settings.zoom;
    Game.cam.x = wx - sx / Settings.zoomTarget;
    Game.cam.y = wy - sy / Settings.zoomTarget;
  },

  /* 屏幕坐标（View 空间）→ 世界坐标 */
  screenToWorld(x, y) {
    return { x: Game.cam.x + x / Settings.zoom, y: Game.cam.y + y / Settings.zoom };
  },

  down(code) { return !!this.keys[code]; },

  /* 统一移动向量：键盘优先，否则触摸摇杆（模拟量 0..1） */
  moveVec() {
    let x = 0, y = 0;
    if (this.down('ArrowUp') || this.down('KeyW')) y -= 1;
    if (this.down('ArrowDown') || this.down('KeyS')) y += 1;
    if (this.down('ArrowLeft') || this.down('KeyA')) x -= 1;
    if (this.down('ArrowRight') || this.down('KeyD')) x += 1;
    if (x !== 0 || y !== 0) return { x, y };
    if (this.touch.active) {
      const dx = this.touch.x - this.touch.x0, dy = this.touch.y - this.touch.y0;
      const L = Math.hypot(dx, dy);
      const dead = 10;
      if (L > dead) {
        const M = Math.min(L, 95);
        return { x: dx / L * (M / 95), y: dy / L * (M / 95) };
      }
    }
    return { x: 0, y: 0 };
  },

  // 摇杆绘制信息（移动端屏幕空间，坐标系同 View）
  joystickDraw() {
    if (!this.touch.active) return null;
    const dx = this.touch.x - this.touch.x0, dy = this.touch.y - this.touch.y0;
    const L = Math.hypot(dx, dy) || 1;
    const M = Math.min(L, 95);
    return {
      cx: this.touch.x0, cy: this.touch.y0,
      kx: this.touch.x0 + dx / L * M, ky: this.touch.y0 + dy / L * M,
      r: 42,
    };
  },

  // 每帧末调用，清除瞬态
  frameEnd() {
    this.mouse.clicked = false;
  },
};
