/* ui.js — 界面：HUD / 船坞装备坞 / 武器选择 / 作弊 / 覆盖层 / 提示 */
"use strict";

const UI = {
  game: null,
  els: {},
  slotNodes: [],
  moduleNodes: {},
  toastTimer: null,
  pickerSlot: -1,
  rangeOn: false,     // 触屏端开关：显示武器射程（手机没有 Ctrl）

  /* --------- UI 层级管理：所有覆盖层统一登记，游戏暂停与提示都以此为准 --------- */
  layers: { dock: false, itemshop: false, picker: false, talents: false, settings: false },
  Z: { dock: 30, itemshop: 42, picker: 44, talents: 46, settings: 48 },
  _layerEl(name) {
    const map = { dock: 'dock', itemshop: 'itemshop', picker: 'picker', talents: 'talents', settings: 'settings' };
    return this.els[map[name]];
  },
  openLayer(name) {
    const el = this._layerEl(name);
    if (!el) return;
    this.layers[name] = true;
    el.style.zIndex = String(this.Z[name] || 30);
    this.show(el);
  },
  closeLayer(name) {
    const el = this._layerEl(name);
    this.layers[name] = false;
    if (el) this.hide(el);
  },
  anyOverlay() { return Object.keys(this.layers).some(k => this.layers[k]); },
  get dockOpen() { return this.layers.dock; },
  get settingsOpen() { return this.layers.settings; },
  get talentOpen() { return this.layers.talents; },
  get pickerOpen() { return this.layers.picker; },
  get shopOpen() { return this.layers.itemshop; },

  init(game) {
    this.game = game;
    const gid = (id) => document.getElementById(id);
    this.els = {
      hud: gid('hud'), dock: gid('dock'),
      baseBar: gid('base-bar'), baseNum: gid('base-num'),
      ebaseBar: gid('ebase-bar'), ebaseNum: gid('ebase-num'),
      shipBar: gid('ship-bar'), shipNum: gid('ship-num'),
      wave: gid('wave-badge'), bounty: gid('bounty'), score: gid('score'),
      weather: gid('weather'), lvlChip: gid('lvl-chip'), buffRow: gid('buff-row'),
      dockHint: gid('dock-hint'),
      itemBtns: [gid('btn-item0'), gid('btn-item1')],
      talents: gid('talents'), talentGrid: gid('talent-grid'),
      talentTitle: gid('talent-title'), talentPending: gid('talent-pending'),
      slots: gid('slots'), picker: gid('picker'), pickerTitle: gid('picker-title'),
      pickerGrid: gid('picker-grid'), menu: gid('menu'), gameover: gid('gameover'),
      victory: gid('victory'), goText: gid('go-text'), goStats: gid('go-stats'),
      victoryStats: gid('victory-stats'), toast: gid('toast'),
      settings: gid('settings'),
      itemshop: gid('itemshop'), itemShopGrid: gid('itemshop-grid'), itemShopGold: gid('itemshop-gold'),
    };
    this.els.modHull = gid('mod-hull'); this.els.modSail = gid('mod-sail'); this.els.modArmor = gid('mod-armor');
    this.els.roster = gid('roster');
    this.els.rosterBody = gid('roster-body');
    this.els.announce = gid('announce');
    this.els.repairBtn = gid('btn-repair');
    this.els.skillBtn = gid('btn-skill');

    this._buildSlots();
    this._buildModules();
    this._buildRoster();

    gid('btn-start').addEventListener('click', () => { AudioFX.init(); AudioFX.resume(); game.start(); });
    gid('btn-restart').addEventListener('click', () => game.restart());
    gid('btn-playagain').addEventListener('click', () => game.restart());
    gid('btn-open-menu').addEventListener('click', () => this.toggleDock());
    gid('btn-repair').addEventListener('click', () => game.repairShip());
    // 顶部 HUD 不再放声音按钮：声音开关/音量统一在设置面板里
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
    gid('btn-dock-close').addEventListener('click', () => this.toggleDock(false));
    const quick = gid('btn-dock-quick');
    if (quick) quick.addEventListener('click', () => this.toggleDock(true));
    const shopQuick = gid('btn-shop-quick');
    if (shopQuick) shopQuick.addEventListener('click', () => this.openItemShop(0));
    gid('itemshop-close').addEventListener('click', () => this.closeItemShop());
    this.els.itemshop.addEventListener('click', (e) => { if (e.target === this.els.itemshop) this.closeItemShop(); });
    // 指令标记类型切换（集合 / 撤退 / 打野·危险）
    this.els.pingBtn = gid('btn-ping');
    const cyclePing = () => {
      const i = PINGS.findIndex(p => p.id === Settings.pingType);
      const next = PINGS[(i + 1 + PINGS.length) % PINGS.length];
      Settings.pingType = next.id;
      this._syncPingUI();
      this.toast(`${next.icon} 指令标记：${next.name}（${next.desc}）`, 1.8);
    };
    if (this.els.pingBtn) this.els.pingBtn.addEventListener('click', cyclePing);
    // 难度选择（菜单 + 设置面板同步）
    this._bindDiff();
    this._bindUiScale();
    this._syncPingUI();
    this.applyUiScale();
    gid('picker-close').addEventListener('click', () => this.closePicker());
    this.els.picker.addEventListener('click', (e) => { if (e.target === this.els.picker) this.closePicker(); });

    // 设置面板（帧数显示 / 声音开关 / 音量）
    gid('btn-settings').addEventListener('click', () => this.toggleSettings());
    gid('settings-close').addEventListener('click', () => this.toggleSettings(false));
    this.els.settings.addEventListener('click', (e) => { if (e.target === this.els.settings) this.toggleSettings(false); });
    gid('set-fps').addEventListener('click', () => {
      Settings.showFps = !Settings.showFps;
      gid('set-fps').textContent = Settings.showFps ? '帧数显示：开' : '帧数显示：关';
      gid('set-fps').classList.toggle('on', Settings.showFps);
    });
    gid('set-sound').addEventListener('click', () => this.toggleSound(true));
    gid('set-zoom-in').addEventListener('click', () => this.zoomStep(1.2));
    gid('set-zoom-out').addEventListener('click', () => this.zoomStep(1 / 1.2));
    gid('set-zoom-reset').addEventListener('click', () => { Settings.zoomTarget = 1; UI.toast('视野已复位', 0.9); });
    gid('set-quality').addEventListener('click', () => {
      const order = ['low', 'mid', 'high'];
      const next = order[(order.indexOf(Settings.quality) + 1) % order.length];
      Settings.quality = next;
      Settings._qualityTouched = true;      // 手动选择后不再被移动端默认/自动降级覆盖
      Settings.autoQuality = false;
      gid('set-quality').textContent = '画质：' + ({ low: '低', mid: '中', high: '高' })[next];
      gid('set-quality').classList.toggle('on', next === 'high');
      // 立即按新画质重建画布分辨率
      const cv = document.getElementById('game');
      if (typeof applyDpr === 'function' && cv) { applyDpr(cv); fitCanvas(cv); }
      UI.toast(`画质已设为「${{ low: '低', mid: '中', high: '高' }[next]}」`, 1.4);
    });
    const vol = gid('set-vol');
    vol.addEventListener('input', () => {
      AudioFX.setVolume(Math.round(vol.value) / 100);
      if (AudioFX.muted) { AudioFX.muted = false; AudioFX.applyMute(); UI._syncSoundUI(); }
      const vn = gid('set-vol-num');
      if (vn) vn.textContent = vol.value + '%';
    });
    this._syncSoundUI();

    if (this.els.skillBtn) this.els.skillBtn.addEventListener('click', () => game.useSkill());
    this.els.itemBtns.forEach((b, i) => {
      if (b) b.addEventListener('click', () => game.useItem(i));
    });
    if (this.els.lvlChip) {
      this.els.lvlChip.addEventListener('click', () => {
        const p = this.game.player;
        if (p && p.pendingTalent > 0) this.game.onPlayerLevel(p);
      });
    }

    const rot = gid('roster-toggle');
    rot.addEventListener('click', () => {
      this.els.roster.classList.toggle('collapsed');
      rot.textContent = this.els.roster.classList.contains('collapsed') ? '📋 战报 ▸' : '📋 战报 ▾';
    });
    // 小屏默认折叠战报栏（避免遮挡战场）
    try {
      const small = (window.innerWidth || 1280) <= 900 || (window.innerHeight || 900) <= 520;
      if (small) {
        this.els.roster.classList.add('collapsed');
        rot.textContent = '📋 战报 ▸';
      }
    } catch (e) { /* 忽略 */ }
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

  /* 战报栏：4Hz 节流 + 只在内容变化时写 DOM（原来是每帧 6 行 innerHTML） */
  _refreshRoster(force) {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (!force && now - (this._rosterAt || 0) < 250) return;
    this._rosterAt = now;
    const hs = this.game.heroes || [];
    for (let i = 0; i < 6; i++) {
      const r = this.rosterRows[i];
      const h = hs[i];
      if (!r || !h) continue;
      this._setText(r.name, h.name);
      this._setText(r.kd, `英 ${h.killsHeroes} · 兵 ${h.killsMinions} · 亡 ${h.deaths}`);
      this._setText(r.gold, '💰 ' + fmt(h.gold));
      if (h.dead) {
        this._setText(r.status, `💀 复活 ${Math.max(1, Math.ceil(h.respawnTimer))}s`);
        if (r.status._clsName !== 'revive') { r.status._clsName = 'revive'; r.status.className = 'r-status revive'; }
        if (r.root._dead !== true) { r.root._dead = true; r.root.classList.add('dead-row'); }
      } else {
        this._setText(r.status, '⚓ 存活');
        if (r.status._clsName !== 'alive') { r.status._clsName = 'alive'; r.status.className = 'r-status alive'; }
        if (r.root._dead !== false) { r.root._dead = false; r.root.classList.remove('dead-row'); }
      }
      const me = h === this.game.player;
      if (r.root._me !== me) { r.root._me = me; r.root.classList.toggle('me', me); }
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
    // 船体模块：两个按钮（强化 / 更换）
    {
      const el = this.els.modHull;
      el.innerHTML = `<div class="m-title">🛶 船体（技能）</div><div class="m-name"></div><div class="m-stat"></div>
        <div class="m-btns">
          <button class="m-btn" data-act="up">强化船体</button>
          <button class="m-btn" data-act="swap">更换</button>
        </div>`;
      el.querySelector('[data-act="up"]').addEventListener('click', () => this.game.upgradeHull());
      el.querySelector('[data-act="swap"]').addEventListener('click', () => this.openHullPicker());
      this.moduleNodes.hull = {
        el, name: el.querySelector('.m-name'), stat: el.querySelector('.m-stat'),
        btn: el.querySelector('[data-act="up"]'), btn2: el.querySelector('[data-act="swap"]'),
      };
    }
    const defs = [
      { key: 'sail', el: this.els.modSail, title: '⛵ 风帆', label: '强化风帆' },
      { key: 'armor', el: this.els.modArmor, title: '🛡️ 装甲', label: '强化装甲' },
    ];
    for (const d of defs) {
      const el = d.el;
      el.innerHTML = `<div class="m-title">${d.title}</div><div class="m-name"></div><div class="m-stat"></div><button class="m-btn">${d.label}</button>`;
      el.querySelector('.m-btn').addEventListener('click', () => this.game.upgradeModule(d.key));
      this.moduleNodes[d.key] = { el, name: el.querySelector('.m-name'), stat: el.querySelector('.m-stat'), btn: el.querySelector('.m-btn') };
    }
    // 主动道具栏（E / R）
    {
      const el = this.els.modItems;
      if (el) {
        el.innerHTML = `<div class="m-title">🎒 主动道具（独立商店）</div>
          <div class="m-stat" id="item-stat"></div>
          <div class="m-btns">
            <button class="m-btn" data-slot="0">道具栏 1（E）</button>
            <button class="m-btn" data-slot="1">道具栏 2（R）</button>
          </div>`;
        el.querySelectorAll('[data-slot]').forEach((b) => {
          b.addEventListener('click', () => this.openItemShop(Number(b.dataset.slot)));
        });
        this.moduleNodes.items = { el, stat: el.querySelector('#item-stat'), btns: el.querySelectorAll('[data-slot]') };
      }
    }
  },

  /* ---- 只在数值真正变化时写 DOM（移动端每帧改 DOM 会触发重排） ---- */
  _setText(el, v) {
    if (!el) return;
    if (el._v === v) return;
    el._v = v;
    el.textContent = v;
  },
  _setWidth(el, pct) {
    if (!el) return;
    const v = Math.round(pct * 2) / 2;          // 0.5% 粒度，避免亚像素抖动
    if (el._w === v) return;
    el._w = v;
    el.style.width = v + '%';
  },
  _setCls(el, cls, on) {
    if (!el) return;
    const key = '_c_' + cls;
    if (el[key] === on) return;
    el[key] = on;
    el.classList.toggle(cls, on);
  },
  _setAttr(el, attr, v) {
    if (!el) return;
    const key = '_a_' + attr;
    if (el[key] === v) return;
    el[key] = v;
    if (attr === 'title') el.title = v;
    else if (attr === 'disabled') el.disabled = v;
  },

  refresh() {
    const g = this.game;
    if (!g.base0 || !g.player) return;

    const b0 = g.base0, b1 = g.base1, p = g.player;
    this._setWidth(this.els.baseBar, clamp(b0.hp / b0.maxHp * 100, 0, 100));
    this._setText(this.els.baseNum, `${Math.max(0, Math.round(b0.hp))}`);
    this._setWidth(this.els.ebaseBar, clamp(b1.hp / b1.maxHp * 100, 0, 100));
    this._setText(this.els.ebaseNum, `${Math.max(0, Math.round(b1.hp))}`);
    this._setWidth(this.els.shipBar, clamp(p.hp / p.maxHp * 100, 0, 100));
    this._setText(this.els.shipNum, p.dead ? '重生中' : `${Math.max(0, Math.round(p.hp))}/${p.maxHp}`);

    this._setText(this.els.bounty, '💰 ' + fmt(p.gold));
    if (this.els.lvlChip) {
      const need = xpToNext(p.level);
      this._setText(this.els.lvlChip, `⭐ Lv.${p.level}`);
      this._setAttr(this.els.lvlChip, 'title',
        `船长等级 ${p.level} · 经验 ${Math.floor(p.xp)}/${need}` + (p.pendingTalent > 0 ? ` · 有 ${p.pendingTalent} 个天赋待选（点击）` : ''));
      this._setCls(this.els.lvlChip, 'ready', p.pendingTalent > 0);
    }
    this._refreshItems();
    this._refreshBuffs();
    const mm = Math.floor(g.time / 60), ss = String(Math.floor(g.time % 60)).padStart(2, '0');
    this._setText(this.els.score, `击杀 ${g.playerKills} · ${mm}:${ss}`);
    this._setText(this.els.wave, '3v3 海战');
    if (this.els.weather && typeof Weather !== 'undefined') {
      const wi = Weather.info();
      this._setText(this.els.weather, `${wi.icon} ${wi.name}`);
      const cls = 'weather-chip w-' + Weather.type;
      if (this.els.weather._cls !== cls) { this.els.weather._cls = cls; this.els.weather.className = cls; }
    }

    // 修船冷却（只在秒数变化时更新）
    if (this.els.repairBtn) {
      const txt = g.repairCD > 0 ? `🔧 ${Math.ceil(g.repairCD)}s` : '🔧 修船';
      this._setText(this.els.repairBtn, txt);
      this._setAttr(this.els.repairBtn, 'disabled', g.repairCD > 0);
    }

    // 船体技能按钮
    if (this.els.skillBtn) {
      const sk = p.hullDef && p.hullDef.skill;
      if (!sk) { this._setText(this.els.skillBtn, '—'); this._setAttr(this.els.skillBtn, 'disabled', true); }
      else {
        if (p.skillCd > 0) {
          this._setText(this.els.skillBtn, `${sk.icon}${Math.ceil(p.skillCd)}s`);
          this._setAttr(this.els.skillBtn, 'disabled', true);
          this._setCls(this.els.skillBtn, 'on', false);
        } else {
          this._setText(this.els.skillBtn, p.skillT > 0 ? `${sk.icon} 生效` : sk.icon);
          this._setAttr(this.els.skillBtn, 'disabled', false);
          this._setCls(this.els.skillBtn, 'on', p.skillT > 0);
        }
        this._setAttr(this.els.skillBtn, 'title', `技能：${sk.name}（${sk.desc}）· 冷却 ${sk.cd}s · 按 Q`);
      }
    }

    this._refreshRoster();

    if (this.dockOpen) this._refreshSlots();
  },

  _refreshSlots() {
    const g = this.game;
    const p = g.player;
    const n = p.slots.length;
    for (let i = 0; i < 4; i++) {
      const node = this.slotNodes[i];
      if (i >= n) { node.style.display = 'none'; continue; }
      node.style.display = '';
      const slot = p.slots[i];
      const w = WEAPONS[slot.weaponId];
      const maxLv = weaponMaxLevel(slot.weaponId);
      node.querySelector('.icon').textContent = w.icon;
      node.querySelector('.w-name').textContent = `${W_TIER_LABEL[w.tier]} ${w.name}`;
      node.querySelector('.w-lv').textContent = maxLv <= 1 ? '不可升级' : (slot.level >= maxLv ? '★ 已满级' : '★'.repeat(slot.level) + ' Lv.' + slot.level);
      node.querySelector('.w-desc').textContent = w.desc;
      const btn = node.querySelector('.w-btn');
      if (slot.level >= maxLv) { btn.textContent = maxLv <= 1 ? '无法升级' : '已满级'; btn.disabled = true; }
      else {
        const cost = weaponUpgradeCost(slot.weaponId, slot.level);
        const disc = p.masteryMul ? p.masteryMul(slot.weaponId) : 1;
        const finalCost = Math.max(20, Math.round(cost * disc));
        btn.textContent = disc < 1 ? `升级 ${finalCost}💰 (-${Math.round((1 - disc) * 100)}%)` : `升级 ${finalCost}💰`;
        btn.disabled = p.gold < finalCost;
      }
      node.title = `${w.name} · 点击更换装备`;
    }
    this._refreshHull();
    this._refreshModule('sail', SAILS, p.tierSail, (t) => `航速 ${t.speed} · 装弹 ${(t.reloadMul * 100).toFixed(0)}%`);
    this._refreshModule('armor', ARMORS, p.tierArmor, (t) => `减伤 ${(t.reduce * 100).toFixed(0)}% · +${t.maxHp} 耐久`);
  },

  _refreshHull() {
    const p = this.game.player;
    const h = p.hullDef;
    if (!h) return;
    const node = this.moduleNodes.hull;
    const lv = p.hullLv[p.hullId] || 1;
    const stats = hullStatsAt(h, lv);
    node.name.textContent = `${h.name} Lv.${lv}`;
    node.stat.innerHTML = `${HULL_TIER_NAME[h.tier]} · ${h.slots} 炮位 · 耐久 ${stats.maxHp + ARMORS[p.tierArmor].maxHp} · 体型 ${stats.size.toFixed(2)}<br/>技能 ${h.skill.icon} ${h.skill.name}：${h.skill.desc}`;
    if (lv >= HULL_MAX_LV) { node.btn.textContent = '已满级'; node.btn.disabled = true; }
    else {
      const cost = hullLevelCost(p.hullId, lv);
      node.btn.textContent = `强化 ${cost}💰`;
      node.btn.disabled = p.gold < cost;
    }
    if (node.btn2) node.btn2.disabled = false;
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

  /* 船坞接近提示（手机可点按按钮购买道具/升级） */
  showDockHint(on) {
    const el = this.els.dockHint;
    if (!el) return;
    if (on === this._dockHintOn) return;
    this._dockHintOn = on;
    if (on) this.show(el); else this.hide(el);
  },

  /* 团队增益徽章（击杀海兽 / 开宝箱获得） */
  _refreshBuffs() {
    const row = this.els.buffRow;
    if (!row) return;
    const g = this.game;
    const buffs = (g.teamBuffs && g.teamBuffs[0]) || {};
    const keys = Object.keys(buffs);
    const sig = keys.map(k => k + Math.ceil(buffs[k])).join(',');
    if (sig === this._buffSig) return;      // 内容未变则不动 DOM
    this._buffSig = sig;
    row.innerHTML = '';
    for (const k of keys.slice(0, 6)) {
      const def = TEAM_BUFFS[k];
      if (!def) continue;
      const el = document.createElement('span');
      el.className = 'buff-chip b-' + k;
      el.textContent = `${def.icon} ${def.name} ${Math.ceil(buffs[k])}s`;
      el.title = def.desc;
      row.appendChild(el);
    }
  },

  /* 主动道具按钮 / 船坞道具栏状态 */
  _refreshItems() {
    const p = this.game.player;
    if (!p) return;
    for (let i = 0; i < 2; i++) {
      const b = this.els.itemBtns[i];
      if (!b) continue;
      const id = p.items[i];
      const cd = p.itemCd[i];
      if (!id) {
        this._setText(b, '▫️');
        this._setAttr(b, 'disabled', true);
        this._setAttr(b, 'title', `道具栏 ${i + 1} 为空（船坞里购买）`);
        continue;
      }
      const def = ITEMS[id];
      this._setAttr(b, 'disabled', cd > 0);
      this._setText(b, cd > 0 ? `${def.icon}${Math.ceil(cd)}s` : def.icon);
      this._setAttr(b, 'title', `${def.name}（${i === 0 ? 'E' : 'R'}）：${def.desc}`);
    }
    const node = this.moduleNodes.items;
    if (node) {
      const desc = [0, 1].map((i) => {
        const id = p.items[i];
        return id ? `${ITEMS[id].icon} ${ITEMS[id].name}` : '空';
      }).join(' · ');
      this._setText(node.stat, desc);
    }
    if (this.layers.itemshop) this._refreshItemShop();
  },

  /* 船长天赋三选一 */
  openTalents(offer, pending) {
    const grid = this.els.talentGrid;
    if (!grid) return;
    this.openLayer('talents');
    grid.innerHTML = '';
    this.els.talentPending.textContent = pending > 1 ? `还有 ${pending} 次选择` : '选择后立即生效';
    const p = this.game.player;
    for (const t of offer) {
      const lv = p.talentCount(t.id);
      const card = document.createElement('div');
      card.className = 'tcard';
      card.innerHTML = `
        <div class="t-icon">${t.icon}</div>
        <div class="t-name">${t.name}${lv ? ` <span class="t-lv">已有 ${lv} 层</span>` : ''}</div>
        <div class="t-desc">${t.desc}</div>`;
      card.addEventListener('click', () => {
        this.game.chooseTalent(t.id);
        if (this.game.player.pendingTalent <= 0) this.closeTalents();
      });
      grid.appendChild(card);
    }
    this.show(this.els.talents);
  },
  closeTalents() { this.closeLayer('talents'); },

  /* --------- 道具商店（独立于武器/船体的装备界面） --------- */
  openItemShop(slot) {
    this.shopSlot = slot === 0 || slot === 1 ? slot : 0;
    this.openLayer('itemshop');
    this._refreshItemShop();
  },
  closeItemShop() { this.closeLayer('itemshop'); },
  _refreshItemShop() {
    const p = this.game && this.game.player;
    const grid = this.els.itemShopGrid;
    if (!p || !grid) return;
    grid.innerHTML = '';
    const slot = this.shopSlot || 0;
    // 两张卡片并列：道具栏 1（E） / 道具栏 2（R）
    const wrap = document.createElement('div');
    wrap.className = 'is-cols';
    for (let si = 0; si < 2; si++) {
      const col = document.createElement('div');
      col.className = 'is-col' + (si === slot ? ' active' : '');
      const cur = p.items[si];
      col.innerHTML = `<div class="is-head">道具栏 ${si + 1} · 键位 ${si === 0 ? 'E' : 'R'}
        <span class="is-cur">${cur ? ITEMS[cur].icon + ' ' + ITEMS[cur].name : '空'}</span></div>`;
      for (const id of ITEM_ORDER) {
        const it = ITEMS[id];
        const afford = p.gold >= it.cost;
        const inUse = cur === id;
        const row = document.createElement('div');
        row.className = 'is-row' + (inUse ? ' equipped' : '') + (afford ? '' : ' no-cash');
        row.innerHTML = `
          <span class="is-icon">${it.icon}</span>
          <span class="is-body">
            <span class="is-name">${it.name}<span class="is-cd">冷却 ${it.cd}s</span></span>
            <span class="is-desc">${it.desc}</span>
          </span>
          <span class="is-buy">${inUse ? '✓ 已装备' : (afford ? '💰 ' + it.cost : '💰 ' + it.cost + '<br/><i>金币不足</i>')}</span>`;
        row.addEventListener('click', () => {
          if (inUse) { this.toast('该道具已在此栏'); return; }
          if (!afford) { this.toast('金币不足'); return; }
          this.shopSlot = si;
          this.game.buyItem(si, id);
          this._refreshItemShop();
        });
        col.appendChild(row);
      }
      wrap.appendChild(col);
    }
    grid.appendChild(wrap);
    if (this.els.itemShopGold) this.els.itemShopGold.textContent = '💰 ' + fmt(p.gold);
  },

  openPicker(slotIndex) {
    this.pickerSlot = slotIndex;
    this.openLayer('picker');
    const slot = this.game.player.slots[slotIndex];
    this.els.pickerTitle.textContent = `为 ${SLOT_LABELS[slotIndex]} 炮位选择武器`;
    const grid = this.els.pickerGrid;
    grid.innerHTML = '';
    const refund = (WEAPON_BASE_COST[slot.weaponId] || 0);
    for (const wid of WEAPON_ORDER) {
      const w = WEAPONS[wid];
      const st = weaponStats(wid, 1);
      const cost = WEAPON_BASE_COST[wid];
      const locked = !!(w.unlockKey && !this.game.isUnlocked(0, w.unlockKey));
      const afford = this.game.player.gold >= cost;
      const card = document.createElement('div');
      card.className = 'wcard' + (slot.weaponId === wid ? ' equipped' : '') + (afford ? '' : ' no-cash') + (locked ? ' locked' : '');
      card.innerHTML = `
        <div class="wc-head"><span class="wc-icon">${w.icon}</span><span class="wc-name">${w.name}</span><span class="wc-lv">${slot.weaponId === wid ? '装备中' : ''}</span></div>
        <div class="wc-tier ${w.tier >= 4 ? 'tier-s' : ''}">${W_TIER_LABEL[w.tier] || ''} · ${weaponMaxLevel(wid) <= 1 ? '⛔ 不可升级' : '可升级至 Lv.' + weaponMaxLevel(wid)}</div>
        <div class="wc-desc">${w.desc}</div>
        <div class="wc-stats">伤害 ${st.damage} · 射速 ${st.rate.toFixed(1)}<br/>射程 ${Math.round(st.range)}${st.splash ? ' · 溅射 ' + st.splash : ''}</div>
        ${locked
          ? `<div class="wc-price lock">🔒 击败「${MONSTER_BOSS_NAME[w.unlockKey]}」解锁</div>`
          : `<div class="wc-price ${afford ? 'ok' : 'no'}">💰 ${cost}</div>`}
        <div class="wc-note">${locked ? '野区 Boss 掉落' : '卖旧武器 +' + refund}</div>`;
      card.addEventListener('click', () => {
        if (locked) { this.toast(`🔒 去野区击败「${MONSTER_BOSS_NAME[w.unlockKey]}」即可解锁`); return; }
        if (!afford) { this.toast('金币不足，无法购买该武器'); return; }
        this.game.equipWeapon(slotIndex, wid, cost);
        this.closePicker();
      });
      grid.appendChild(card);
    }
  },
  closePicker() { this.closeLayer('picker'); this.pickerSlot = -1; this.pickerMode = null; },

  /* --------- 船体选择（技能不同） --------- */
  openHullPicker() {
    this.pickerMode = 'hull';
    this.openLayer('picker');
    this.els.pickerTitle.textContent = '选择船体（各有专属技能）';
    const grid = this.els.pickerGrid;
    grid.innerHTML = '';
    const p = this.game.player;
    const oldRefund = p.hullDef ? p.hullDef.cost : 0;
    const bossUnlock = this.game.isUnlocked(0, 'octopus') && this.game.isUnlocked(0, 'shark');
    for (const h of HULLS) {
      const inUse = p.hullId === h.id;
      const locked = h.unlock === 'boss' && !bossUnlock;
      const afford = p.gold >= h.cost;
      const card = document.createElement('div');
      card.className = 'wcard' + (inUse ? ' equipped' : '') + (afford ? '' : ' no-cash') + (locked ? ' locked' : '');
      const lv = p.hullLv[h.id] || 1;
      card.innerHTML = `
        <div class="wc-head"><span class="wc-icon">🛶</span><span class="wc-name">${h.name}</span><span class="wc-lv">${inUse ? '装备中' : ''}</span></div>
        <div class="wc-tier">${HULL_TIER_NAME[h.tier]} · ${h.slots} 炮位${h.unlock === 'boss' ? ' · 🔒 Boss' : ''}</div>
        <div class="wc-desc">${h.desc}</div>
        <div class="wc-stats">耐久 ${h.maxHp} · 体型 ${h.size.toFixed(2)} · 等级 ${lv}/${HULL_MAX_LV}</div>
        <div class="wc-stats">技能 ${h.skill.icon} <b>${h.skill.name}</b>：${h.skill.desc}（冷却 ${h.skill.cd}s）</div>
        ${locked
          ? `<div class="wc-price lock">🔒 击败「深海章鱼」与「猎鲨王」解锁</div>`
          : `<div class="wc-price ${inUse ? 'ok' : (afford ? 'ok' : 'no')}">${inUse ? '✓ 当前' : '💰 ' + h.cost}</div>`}
        ${inUse || locked ? '' : `<div class="wc-note">卖旧船体 +${oldRefund}</div>`}`;
      card.addEventListener('click', () => {
        if (inUse) { this.closePicker(); return; }
        if (locked) { this.toast('🔒 先去野区击败章鱼与鲨鱼'); return; }
        if (!afford) { this.toast('金币不足'); return; }
        this.game.buyHull(h.id);
        this.closePicker();
      });
      grid.appendChild(card);
    }
  },

  /* --------- 难度与指令标记 --------- */
  _bindDiff() {
    const btns = document.querySelectorAll ? document.querySelectorAll('[data-diff]') : [];
    this._diffBtns = [];
    const list = btns && btns.length ? btns : [];
    for (const b of list) {
      b.addEventListener('click', () => {
        Settings.difficulty = b.dataset.diff || 'normal';
        this._syncDiffUI();
        const D = DIFFICULTY[Settings.difficulty];
        this.toast(`敌方 AI 难度：${D.icon} ${D.name}`, 1.6);
      });
      this._diffBtns.push(b);
    }
    this._syncDiffUI();
  },
  _syncDiffUI() {
    for (const b of (this._diffBtns || [])) {
      b.classList.toggle('on', b.dataset.diff === Settings.difficulty);
    }
  },

  /* --------- 界面缩放（手机显示不全时调小） --------- */
  _bindUiScale() {
    this._uiBtns = [];
    const list = (typeof document !== 'undefined' && document.querySelectorAll)
      ? document.querySelectorAll('[data-ui]') : [];
    for (const b of (list || [])) {
      b.addEventListener('click', () => {
        Settings.uiScale = Number(b.dataset.ui) || 1;
        Settings._uiScaleTouched = true;
        this.applyUiScale();
        UI.toast(`界面缩放：${b.textContent}`, 1.2);
      });
      this._uiBtns.push(b);
    }
  },
  applyUiScale() {
    const v = Settings.uiScale || 1;
    if (typeof document === 'undefined' || !document.documentElement) return;
    document.documentElement.style.setProperty('--ui-scale', String(v));
    for (const b of (this._uiBtns || [])) {
      b.classList.toggle('on', Math.abs((Number(b.dataset.ui) || 1) - v) < 0.001);
    }
  },
  _syncPingUI() {
    const def = PINGS.find(p => p.id === Settings.pingType) || PINGS[0];
    if (this.els.pingBtn) this.els.pingBtn.textContent = `${def.icon} ${def.name}`;
  },

  toggleDock(force) {
    const open = force === undefined ? !this.layers.dock : force;
    if (open) this.openLayer('dock'); else this.closeLayer('dock');
    if (open) this._refreshSlots();
  },

  /* --------- 设置面板 --------- */
  zoomStep(mul) {
    Settings.zoomTarget = clamp(Settings.zoomTarget * mul, ZOOM_MIN, ZOOM_MAX);
  },
  toggleSettings(force) {
    const open = force === undefined ? !this.layers.settings : force;
    if (open) this.openLayer('settings'); else this.closeLayer('settings');
  },
  toggleSound(syncOnly) {
    AudioFX.muted = !AudioFX.muted;
    AudioFX.applyMute();
    this._syncSoundUI();
    if (!syncOnly) UI.toast(AudioFX.muted ? '声音已关' : '声音已开', 0.9);
  },
  _syncSoundUI() {
    const gid = (id) => document.getElementById(id);
    const s = gid('set-sound');
    if (s) {
      s.textContent = AudioFX.muted ? '声音：关' : '声音：开';
      s.classList.toggle('on', !AudioFX.muted);
    }
    const v = gid('set-vol');
    if (v && document.activeElement !== v) v.value = Math.round((AudioFX.volume || 1) * 100);
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
