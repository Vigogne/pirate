/* input.js — 输入管理（键盘 + 鼠标 + 触摸虚拟摇杆） */
"use strict";

const Input = {
  keys: Object.create(null),
  mouse: { x: 0, y: 0, down: false, clicked: false, inFrame: false },
  // 触摸摇杆（移动端）
  touch: { active: false, id: null, x0: 0, y0: 0, x: 0, y: 0 },
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
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) / r.width * View.w;
      this.mouse.y = (e.clientY - r.top) / r.height * View.h;
    });
    window.addEventListener('mouseup', () => { this.mouse.down = false; });

    canvas.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    /* ---- 触摸摇杆：按住拖动 = 移动方向（实时模拟向量） ---- */
    const toView = (t) => {
      const r = canvas.getBoundingClientRect();
      return { x: (t.clientX - r.left) / r.width * View.w, y: (t.clientY - r.top) / r.height * View.h };
    };
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.isTouch = true;
      const t = e.changedTouches[0];
      const p = toView(t);
      if (this.touch.id === null) {
        this.touch.id = t.identifier;
        this.touch.active = true;
        this.touch.x0 = p.x; this.touch.y0 = p.y;
        this.touch.x = p.x; this.touch.y = p.y;
      }
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== this.touch.id) continue;
        const p = toView(t);
        this.touch.x = p.x; this.touch.y = p.y;
      }
    }, { passive: false });
    const endTouch = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== this.touch.id) continue;
        this.touch.id = null;
        this.touch.active = false;
      }
    };
    canvas.addEventListener('touchend', endTouch);
    canvas.addEventListener('touchcancel', endTouch);
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
