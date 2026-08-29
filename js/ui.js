/* ui.js — 界面：HUD / 船坞装备坞 / 武器选择 / 作弊 / 覆盖层 / 提示 */
"use strict";

const UI = {
  game: null,
  els: {},
  slotNodes: [],
  moduleNodes: {},
  toastTimer: null,
  dockOpen: false,
  pickerSlot: -1,
  rangeOn: false,     // 触屏端开关：显示武器射程（手机没有 Ctrl）

  init(game) {
    this.game = game;
    const gid = (id) => document.getElementById(id);
    this.els = {
      hud: gid('hud'), dock: gid('dock'),
      baseBar: gid('base-bar'), baseNum: gid('base-num'),
      ebaseBar: gid('ebase-bar'), ebaseNum: gid('ebase-num'),
      shipBar: gid('ship-bar'), shipNum: gid('ship-num'),
      wave: gid('wave-badge'), bounty: gid('bounty'), score: gid('score'),
      slots: gid('slots'), picker: gid('picker'), pickerTitle: gid('picker-title'),
      pickerGrid: gid('picker-grid'), menu: gid('menu'), gameover: gid('gameover'),
      victory: gid('victory'), goText: gid('go-text'), goStats: gid('go-stats'),
      victoryStats: gid('victory-stats'), toast: gid('toast'),
    };
    this.els.modHull = gid('mod-hull'); this.els.modSail = gid('mod-sail'); this.els.modArmor = gid('mod-armor');
    this.els.roster = gid('roster');
    this.els.rosterBody = gid('roster-body');
    this.els.announce = gid('announce');
    this.els.repairBtn = gid('btn-repair');

    this._buildSlots();
    this._buildModules();
    this._buildRoster();

    gid('btn-start').addEventListener('click', () => { AudioFX.init(); AudioFX.resume(); game.start(); });
    gid('btn-restart').addEventListener('click', () => game.restart());
    gid('btn-playagain').addEventListener('click', () => game.restart());
    gid('btn-open-menu').addEventListener('click', () => this.toggleDock());
    gid('btn-repair').addEventListener('click', () => game.repairShip());
    gid('btn-mute').addEventListener('click', () => {
      AudioFX.muted = !AudioFX.muted;
      gid('btn-mute').textContent = AudioFX.muted ? '🔇' : '🔊';
    });
    gid('btn-range').addEventListener('click', () => {
      this.rangeOn = !this.rangeOn;
      gid('btn-range').classList.toggle('on', this.rangeOn);
    });
    gid('btn-pause').addEventListener('click', () => {
      if (Game.state !== 'playing') return;
      Game.paused = !Game.paused;
      UI.toast(Game.paused ? '已暂停' : '继续作战', 1.0);
    });
    gid('btn-cheat').addEventListener('click', () => game.cheatMoney());
    gid('btn-cheat-auto').addEventListener('click', () => {
      game.cheatOn = !game.cheatOn;
      gid('btn-cheat-auto').textContent = game.cheatOn ? '自动刷钱:开' : '自动刷钱:关';
      gid('btn-cheat-auto').classList.toggle('on', game.cheatOn);
    });
    gid('picker-close').addEventListener('click', () => this.closePicker());
    this.els.picker.addEventListener('click', (e) => { if (e.target === this.els.picker) this.closePicker(); });

    const rot = gid('roster-toggle');
    rot.addEventListener('click', () => {
      this.els.roster.classList.toggle('collapsed');
      rot.textContent = this.els.roster.classList.contains('collapsed') ? '📋 战报 ▸' : '📋 战报 ▾';
    });
  },

  /* --------- 右侧战报栏：各船击杀/死亡/状态/复活/经济 --------- */
  _buildRoster() {
    const body = this.els.rosterBody;
    body.innerHTML = '';
    this.rosterRows = [];
    const groups = [0, 1];
    let idx = 0;
    for (const team of groups) {
      const gl = document.createElement('div');
      gl.className = 'r-group';
      gl.textContent = team === 0 ? '⚓ 我 方' : '🏴‍☠️ 敌 方';
      body.appendChild(gl);
      for (let k = 0; k < 3; k++) {
        const row = document.createElement('div');
        row.className = 'r-row';
        row.innerHTML = `
          <span class="r-dot" style="background:${TEAM[team].color}"></span>
          <span class="r-name"></span>
          <span class="r-kd"></span>
          <span class="r-gold"></span>
          <span class="r-status"></span>`;
        body.appendChild(row);
        this.rosterRows[idx] = {
          root: row,
          name: row.querySelector('.r-name'),
          kd: row.querySelector('.r-kd'),
          gold: row.querySelector('.r-gold'),
          status: row.querySelector('.r-status'),
        };
        idx++;
      }
    }
  },

  _refreshRoster() {
    const hs = this.game.heroes || [];
    for (let i = 0; i < 6; i++) {
      const r = this.rosterRows[i];
      const h = hs[i];
      if (!r || !h) continue;
      r.name.textContent = h.name;
      r.kd.innerHTML = `英 <b>${h.killsHeroes}</b> · 兵 <i>${h.killsMinions}</i> · 亡 <i>${h.deaths}</i>`;
      r.gold.textContent = '💰 ' + fmt(h.gold);
      if (h.dead) {
        r.status.textContent = `💀 复活 ${Math.max(1, Math.ceil(h.respawnTimer))}s`;
        r.status.className = 'r-status revive';
        r.root.classList.add('dead-row');
      } else {
        r.status.textContent = '⚓ 存活';
        r.status.className = 'r-status alive';
        r.root.classList.remove('dead-row');
      }
      r.root.classList.toggle('me', h === this.game.player);
    }
  },

  _buildSlots() {
    this.slotNodes = [];
    for (let i = 0; i < 4; i++) {
      const el = document.createElement('div');
      el.className = 'slot';
      el.innerHTML = `
        <div class="icon"></div>
        <div class="w-name"></div>
        <div class="w-lv"></div>
        <div class="w-desc"></div>
        <button class="w-btn">升级</button>`;
      el.addEventListener('click', (e) => { if (e.target.classList.contains('w-btn')) return; this.openPicker(i); });
      el.querySelector('.w-btn').addEventListener('click', (e) => { e.stopPropagation(); this.game.upgradeWeapon(i); });
      this.els.slots.appendChild(el);
      this.slotNodes.push(el);
    }
  },

  _buildModules() {
    this.moduleNodes = {};
    const defs = [
      { key: 'hull', el: this.els.modHull, title: '🛶 船体', label: '强化船体' },
      { key: 'sail', el: this.els.modSail, title: '⛵ 风帆', label: '强化风帆' },
      { key: 'armor', el: this.els.modArmor, title: '🛡️ 装甲', label: '强化装甲' },
    ];
    for (const d of defs) {
      const el = d.el;
      el.innerHTML = `<div class="m-title">${d.title}</div><div class="m-name"></div><div class="m-stat"></div><button class="m-btn">${d.label}</button>`;
      el.querySelector('.m-btn').addEventListener('click', () => this.game.upgradeModule(d.key));
      this.moduleNodes[d.key] = { el, name: el.querySelector('.m-name'), stat: el.querySelector('.m-stat'), btn: el.querySelector('.m-btn') };
    }
  },

  refresh() {
    const g = this.game;
    if (!g.base0 || !g.player) return;

    const b0 = g.base0, b1 = g.base1, p = g.player;
    this.els.baseBar.style.width = `${clamp(b0.hp / b0.maxHp * 100, 0, 100)}%`;
    this.els.baseNum.textContent = `${Math.max(0, Math.round(b0.hp))}`;
    this.els.ebaseBar.style.width = `${clamp(b1.hp / b1.maxHp * 100, 0, 100)}%`;
    this.els.ebaseNum.textContent = `${Math.max(0, Math.round(b1.hp))}`;
    this.els.shipBar.style.width = `${clamp(p.hp / p.maxHp * 100, 0, 100)}%`;
    this.els.shipNum.textContent = p.dead ? '重生中' : `${Math.max(0, Math.round(p.hp))}/${p.maxHp}`;

    this.els.bounty.textContent = '💰 ' + fmt(p.gold);
    const mm = Math.floor(g.time / 60), ss = String(Math.floor(g.time % 60)).padStart(2, '0');
    this.els.score.textContent = `击杀 ${g.playerKills} · ${mm}:${ss}`;
    this.els.wave.textContent = '3v3 海战';

    // 修船冷却
    if (this.els.repairBtn) {
      if (g.repairCD > 0) {
        this.els.repairBtn.disabled = true;
        this.els.repairBtn.textContent = `🔧 ${Math.ceil(g.repairCD)}s`;
      } else {
        this.els.repairBtn.disabled = false;
        this.els.repairBtn.textContent = '🔧 修船';
      }
    }

    this._refreshRoster();

    if (this.dockOpen) this._refreshSlots();
  },

  _refreshSlots() {
    const g = this.game;
    const p = g.player;
    for (let i = 0; i < 4; i++) {
      const slot = p.slots[i];
      const w = WEAPONS[slot.weaponId];
      const node = this.slotNodes[i];
      node.querySelector('.icon').textContent = w.icon;
      node.querySelector('.w-name').textContent = w.name;
      node.querySelector('.w-lv').textContent = slot.level >= WEAPON_MAX_LEVEL ? '★ 已满级' : '★'.repeat(slot.level) + ' Lv.' + slot.level;
      node.querySelector('.w-desc').textContent = w.desc;
      const btn = node.querySelector('.w-btn');
      const nextLv = slot.level + 1;
      if (slot.level >= WEAPON_MAX_LEVEL) { btn.textContent = '已满级'; btn.disabled = true; }
      else {
        const cost = weaponUpgradeCost(slot.weaponId, slot.level);
        btn.textContent = `升级 ${cost}💰`; btn.disabled = p.gold < cost;
      }
      node.title = `${w.name} · 点击更换装备`;
    }
    this._refreshModule('hull', HULLS, p.tierHull, (t) => `最大耐久 ${t.maxHp} · 尺寸 ${t.size.toFixed(2)}`);
    this._refreshModule('sail', SAILS, p.tierSail, (t) => `航速 ${t.speed} · 装弹 ${(t.reloadMul * 100).toFixed(0)}%`);
    this._refreshModule('armor', ARMORS, p.tierArmor, (t) => `减伤 ${(t.reduce * 100).toFixed(0)}% · +${t.maxHp} 耐久`);
  },

  _refreshModule(key, arr, tier, stat) {
    const cur = arr[tier];
    const node = this.moduleNodes[key];
    const next = arr[tier + 1];
    node.name.textContent = cur.name;
    node.stat.textContent = stat(cur);
    if (!next) { node.btn.textContent = '已最高'; node.btn.disabled = true; }
    else {
      node.btn.textContent = `${next.name} ${next.cost}💰`;
      node.btn.disabled = this.game.player.gold < next.cost;
    }
  },

  openPicker(slotIndex) {
    this.pickerSlot = slotIndex;
    const slot = this.game.player.slots[slotIndex];
    this.els.pickerTitle.textContent = `为 ${SLOT_LABELS[slotIndex]} 炮位选择武器`;
    const grid = this.els.pickerGrid;
    grid.innerHTML = '';
    const refund = (WEAPON_BASE_COST[slot.weaponId] || 0);
    for (const wid of WEAPON_ORDER) {
      const w = WEAPONS[wid];
      const st = weaponStats(wid, 1);
      const cost = WEAPON_BASE_COST[wid];
      const afford = this.game.player.gold >= cost;
      const card = document.createElement('div');
      card.className = 'wcard' + (slot.weaponId === wid ? ' equipped' : '') + (afford ? '' : ' no-cash');
      card.innerHTML = `
        <div class="wc-head"><span class="wc-icon">${w.icon}</span><span class="wc-name">${w.name}</span><span class="wc-lv">${slot.weaponId === wid ? '装备中' : ''}</span></div>
        <div class="wc-desc">${w.desc}</div>
        <div class="wc-stats">伤害 ${st.damage} · 射速 ${st.rate.toFixed(1)}<br/>射程 ${Math.round(st.range)}${st.splash ? ' · 溅射 ' + st.splash : ''}</div>
        <div class="wc-price ${afford ? 'ok' : 'no'}">💰 ${cost}</div>
        <div class="wc-note">卖旧武器 +${refund}</div>`;
      card.addEventListener('click', () => {
        if (!afford) { this.toast('金币不足，无法购买该武器'); return; }
        this.game.equipWeapon(slotIndex, wid, cost);
        this.closePicker();
      });
      grid.appendChild(card);
    }
    this.show(this.els.picker);
  },
  closePicker() { this.hide(this.els.picker); this.pickerSlot = -1; },

  toggleDock(force) {
    this.dockOpen = force === undefined ? !this.dockOpen : force;
    if (this.dockOpen) this.show(this.els.dock); else this.hide(this.els.dock);
    if (this.dockOpen) this._refreshSlots();
  },

  flashSlot(i) {
    const n = this.slotNodes[i];
    if (!n) return;
    n.classList.remove('change-flash');
    void n.offsetWidth;
    n.classList.add('change-flash');
  },

  toast(msg, dur = 1.7) {
    const t = this.els.toast;
    t.textContent = msg;
    this.show(t);
    t.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { t.style.opacity = '0'; this.hide(t); }, dur * 1000);
  },

  /* 击杀英雄的屏幕中央播报 */
  announce(text, good) {
    const el = this.els.announce;
    if (!el) return;
    el.textContent = text;
    el.className = 'visible' + (good ? ' good' : ' bad');
    clearTimeout(this._annT);
    this._annT = setTimeout(() => { el.className = ''; }, 2600);
  },

  show(sel) { sel.classList.remove('hidden'); },
  hide(sel) { sel.classList.add('hidden'); },
  showHud() { this.show(this.els.hud); },
  hideHud() { this.hide(this.els.hud); },

  showMenu() {
    this.hide(this.els.gameover); this.hide(this.els.victory);
    this.show(this.els.menu);
  },
  showGameover(stats) {
    this.hide(this.els.menu); this.hide(this.els.victory);
    this.els.goStats.innerHTML = stats;
    this.show(this.els.gameover);
  },
  showVictory(stats) {
    this.hide(this.els.menu); this.hide(this.els.gameover);
    this.els.victoryStats.innerHTML = stats;
    this.show(this.els.victory);
  },
  hideOverlays() { this.hide(this.els.menu); this.hide(this.els.gameover); this.hide(this.els.victory); },
};
