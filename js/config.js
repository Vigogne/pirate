/* config.js — 全部游戏数据，皆可修改
 * ------------------------------------------------------------------
 * 这是一个 3v3 海战 MOBA：上下两座基地，各自动生成护航舰（minion）互攻，
 * 双方各有 3 艘“英雄”战船（玩家 + 2 名队友 + 3 名敌舰）各自具备完整
 * 的武器/模块系统，会自动打怪→赚钱→升级。地图纵向共 5 个屏幕。
 * 船体分三级：小艇（1 炮位）→ 中型船（2 炮位）→ 大型船（4 炮位）。
 * ------------------------------------------------------------------
 */
"use strict";

/* ============ 地图尺寸 ============
 * VIEW  = 一个屏幕（可视区域，也即画布逻辑分辨率）
 * WORLD = 整张图的尺寸（上下五个屏幕的大海图）
 * ================================= */
const VIEW = { w: 1280, h: 900 };
const WORLD = { w: 1920, h: VIEW.h * 5 };   // 加宽 + 五屏高，地图更大
// 运行时视口（自适应手机横/竖屏，由 main.js 计算；绘制坐标大多用这个）
const View = { w: VIEW.w, h: VIEW.h };

/* ============ 阵营 / 基地 ============ */
const TEAM = [
  { name: '我方', color: '#4db6e8', dark: '#2a6b8f', accent: '#7ef0a0' },
  { name: '敌方', color: '#e6574d', dark: '#8f2a2a', accent: '#ffb15a' },
];

// 基地锚点（team A 在下，team B 在上）
const BASES = [
  { team: 0, x: WORLD.w / 2, y: WORLD.h - 140 },
  { team: 1, x: WORLD.w / 2, y: 140 },
];

const MOBA = {
  startGold: 150,          // 每个英雄初始金币
  heroBounty: 90,          // 击沉一艘敌方英雄的赏金
  baseHp: 2800,            // 基地耐久（被塔保护，拆完塔才能打到）
  baseRadius: 92,          // 基地碰撞半径
  minionInterval: 1.9,     // 基地每隔几秒出一只护航舰（更多兵）
  minionCap: 32,           // 每方护航舰上限
  heroRespawn: 9,          // 英雄阵亡复活时间
  engageRange: 340,        // 英雄索敌/接战距离
  defendRange: 240,        // 己方基地受威胁时的回防距离
  turnSpeed: 4.2,          // 船身转向速度（弧度/秒）
  cheatGold: 1500,         // 点击一次作弊刷的钱
  repairCD: 12,            // 手动修船的冷却（秒）
};

// 防御塔：每方「一塔两座（左右）+ 二塔两座（左右）」，多层护盾：
// 一塔全拆前二塔无敌；二塔全拆前基地无敌
const TOWER_DEF = { rad: 44, damage: 36, rate: 0.8, range: 270, money: 80 };
const TOWERS = [
  // 我方（下）：一塔 x2（左右），二塔 x2（左右）
  { team: 0, tier: 1, x: 660, y: WORLD.h - 140 - 1000 },
  { team: 0, tier: 1, x: 1260, y: WORLD.h - 140 - 1000 },
  { team: 0, tier: 2, x: 660, y: WORLD.h - 140 - 500 },
  { team: 0, tier: 2, x: 1260, y: WORLD.h - 140 - 500 },
  // 敌方（上）：镜像
  { team: 1, tier: 1, x: 660, y: 140 + 1000 },
  { team: 1, tier: 1, x: 1260, y: 140 + 1000 },
  { team: 1, tier: 2, x: 660, y: 140 + 500 },
  { team: 1, tier: 2, x: 1260, y: 140 + 500 },
];
function towerHp(tier) { return tier === 1 ? 950 : 1250; }

/* ============ 野区海兽 Boss（各一只，带特色巢穴，不在航路上） ============
 * lair: 'grotto' 礁石溶洞（章鱼巢） / 'wreck' 沉船残骸（鲨鱼巢）
 * ================================================================ */
const JUNGLE_BOSSES = [
  { id: 'octoken', type: 'octopus', name: '深海章鱼', x: 430, y: 2300, hp: 3200, money: 360, reward: 'ink', rad: 62, lair: 'grotto' },
  { id: 'sharkking', type: 'shark', name: '猎鲨王', x: 1470, y: 2080, hp: 1800, money: 240, reward: 'fang', rad: 46, lair: 'wreck' },
];
const MONSTER_RESPAWN = 60;   // Boss 重生秒数
const MONSTER_BOSS_NAME = { octopus: '深海章鱼', shark: '猎鲨王' };

/* ============ 陆地分割战场（船会被阻挡） ============
 * 椭圆岛（含基地岛），同时用于绘制与碰撞推挤。
 * 三条兵线（LANES）保留航道，中路两侧的岛群把战场切成
 * 若干走廊，需要绕行 —— 形成 MOBA 式的地形分割。
 * ==================================================== */
const LAND = [
  // 中路两侧的岛链（中央走廊）
  { shape: 'ellipse', x: 720, y: 1950, rx: 100, ry: 240 },
  { shape: 'ellipse', x: 1200, y: 1950, rx: 100, ry: 240 },
  { shape: 'ellipse', x: 720, y: 2700, rx: 100, ry: 240 },
  { shape: 'ellipse', x: 1200, y: 2700, rx: 100, ry: 240 },
  // 外围分隔岛（堵住斜切）
  { shape: 'ellipse', x: 250, y: 1625, rx: 78, ry: 170 },
  { shape: 'ellipse', x: 1670, y: 1625, rx: 78, ry: 170 },
  { shape: 'ellipse', x: 250, y: 3025, rx: 78, ry: 170 },
  { shape: 'ellipse', x: 1670, y: 3025, rx: 78, ry: 170 },
  // 两座基地岛（含在陆地碰撞里）
  { shape: 'ellipse', x: BASES[0].x, y: BASES[0].y, rx: 178, ry: 130, base: true },
  { shape: 'ellipse', x: BASES[1].x, y: BASES[1].y, rx: 178, ry: 130, base: true },
];

// 护航舰航行的三条“兵线” x 坐标
const LANES = [WORLD.w * 0.30, WORLD.w * 0.50, WORLD.w * 0.70];

/* ============ 船体：三级进阶（小艇 1 炮位 → 中型 2 炮位 → 大型 4 炮位） ============
 * tier：阶级 1/2/3；slots：炮位数（1/2/4）
 * maxHp/size：基础耐久与体型；cost：购买价（旧船体按原价卖回）
 * skill：技能 id / 名称 / 图标 / 描述 / dur / cd
 * unlock：'boss' = 击败章鱼+鲨鱼后才解锁的生物船体
 * look：造型配色 {hull, deck, trim}；sailType：square 帆/steam 蒸汽/lateen 三角帆/ram 单帆/none
 * ================================================================== */
const HULL_TIER_NAME = ['', 'Ⅰ 小艇', 'Ⅱ 中型船', 'Ⅲ 大型船'];
const HULLS = [
  {
    id: 'skiff', name: '舢板艇', tier: 1, slots: 1, maxHp: 380, size: 0.78, cost: 0,
    desc: '船坞边的小木艇，浆帆齐用。仅一个船头炮位。',
    look: { hull: '#8a5a34', deck: '#c79a62', trim: '#f2efe0' }, sailType: 'square',
    skill: { id: 'paddle', name: '划桨疾行', icon: '🛶', desc: '5 秒内航速 +35%', dur: 5, cd: 14 },
  },
  {
    id: 'gale', name: '疾风型船体', tier: 2, slots: 2, maxHp: 430, size: 0.94, cost: 300,
    desc: '轻快的纵帆快艇，又长又窄，与风同速。双炮位。',
    look: { hull: '#2f7f8f', deck: '#3e98a8', trim: '#e8f4f6' }, sailType: 'lateen',
    skill: { id: 'fury', name: '速射狂热', icon: '⚡', desc: '6 秒内射速 +55%', dur: 6, cd: 20 },
  },
  {
    id: 'ram', name: '破浪型船体', tier: 2, slots: 2, maxHp: 570, size: 1.08, cost: 520,
    desc: '重型冲撞舰，黄铜撞角立于船头。双炮位。',
    look: { hull: '#8a4a34', deck: '#a86a48', trim: '#e8d9c2' }, sailType: 'ram',
    skill: { id: 'ram', name: '破浪冲撞', icon: '🌊', desc: '向前猛冲，撞穿路径上的敌舰', dur: 0.6, cd: 14 },
  },
  {
    id: 'bulwark', name: '铁壁型船体', tier: 2, slots: 2, maxHp: 780, size: 1.14, cost: 620,
    desc: '蒸汽铁甲舰，铆接的重铁外壳，怒涛难撼。双炮位。',
    look: { hull: '#46525e', deck: '#59646f', trim: '#93a0ad' }, sailType: 'steam',
    skill: { id: 'iron', name: '铁甲铁幕', icon: '🛡️', desc: '4 秒内受到伤害 -75%', dur: 4, cd: 22 },
  },
  {
    id: 'flag', name: '旗舰型船体', tier: 3, slots: 4, maxHp: 640, size: 1.06, cost: 1350,
    desc: '均衡的古典加农帆船，旗舰之姿。四个炮位全开。',
    look: { hull: '#96633a', deck: '#c79a62', trim: '#f2efe0' }, sailType: 'square',
    skill: { id: 'sprint', name: '疾风冲刺', icon: '💨', desc: '8 秒内航速 +60%', dur: 8, cd: 18 },
  },
  {
    id: 'bio', name: '生物型船体', tier: 3, slots: 4, maxHp: 720, size: 1.18, cost: 900, unlock: 'boss',
    desc: '章鱼之躯、鲨鱼之首的活体战船——击败两大海兽后苏醒。',
    look: { hull: '#7a4fae', deck: '#8a5ac0', trim: '#b48aff' }, sailType: 'none',
    skill: { id: 'bio', name: '深海狂暴', icon: '🐙', desc: '8 秒内减伤 35% 且航速 +35%', dur: 8, cd: 20 },
  },
];
const HULL_MAX_LV = 5;
function hullLevelCost(hullId, nextLv) { return 160 + nextLv * 240; }
// 某船体在指定等级下的实际数值
function hullStatsAt(def, lv) {
  const k = lv - 1;
  return {
    maxHp: Math.round(def.maxHp * (1 + 0.14 * k)),
    size: def.size * (1 + 0.035 * k),
  };
}
const SAILS = [
  { name: '旧布帆',   speed: 160, reloadMul: 1.00, cost: 0,   desc: '聊胜于无。' },
  { name: '亚麻帆',   speed: 215, reloadMul: 0.94, cost: 150, desc: '顺风好调头。' },
  { name: '丝绸帆',   speed: 280, reloadMul: 0.87, cost: 420, desc: '快且灵巧。' },
  { name: '魔藤帆',   speed: 360, reloadMul: 0.79, cost: 950, desc: '疾风加持，装弹更快。' },
];
const ARMORS = [
  { name: '木甲',     reduce: 0.0,  maxHp: 0,   cost: 0,   desc: '仅以身挡。' },
  { name: '皮革甲',   reduce: 0.08, maxHp: 50,  cost: 120, desc: '稍减损伤。' },
  { name: '铁甲',     reduce: 0.18, maxHp: 110, cost: 380, desc: '重甲减伤。' },
  { name: '魔法护甲', reduce: 0.32, maxHp: 180, cost: 900, desc: '抗性护身。' },
];

/* ============ 武器（火炮分四级）：英雄炮位可装备 ============
 * tier：Ⅰ 基础 / Ⅱ 精良 / Ⅲ 精锐 / Ⅳ 传说（Boss 掉落）
 * maxLevel：可升级上限（轻旋炮不可升级，但有极佳的性价比）
 * ========================================================= */
const W_TIER_LABEL = ['', 'Ⅰ 基础', 'Ⅱ 精良', 'Ⅲ 精锐', 'Ⅳ 传说'];
const WEAPONS = {
  swivel: {
    id: 'swivel', name: '轻旋炮', icon: '🪝', tier: 1, maxLevel: 1,
    desc: '船头轻便旋转炮：便宜耐用、火力不俗，可惜无法升级。',
    kind: 'projectile', style: 'swivel',
    damage: 9, rate: 1.5, range: 250, speed: 520,
    count: 1, spread: 0, pierce: 0, splash: 0, arc: false, arcH: 0,
    color: '#8a8f9a', size: 4, token: 'round',
    grow: { dmg: 1, rate: 1, range: 1 },
  },
  cannon: {
    id: 'cannon', name: '加农炮', icon: '💣', tier: 1,
    desc: '标准舰炮，弹道平直，命中稳定。稳扎稳打的入门之选。',
    kind: 'projectile', style: 'cannonball',
    damage: 16, rate: 1.15, range: 330, speed: 540,
    count: 1, spread: 0, pierce: 0, splash: 0, arc: false, arcH: 0,
    color: '#2c2f38', size: 5, token: 'round',
    grow: { dmg: 1.24, rate: 1.10, range: 1.07 },
  },
  twin: {
    id: 'twin', name: '二联装火炮', icon: '💥', tier: 2,
    desc: '两根炮管同时齐射，弹幕密集，前向火力凶猛。',
    kind: 'projectile', style: 'twinball',
    damage: 10, rate: 1.35, range: 300, speed: 560,
    count: 2, spread: 0.07, pierce: 0, splash: 0, arc: false, arcH: 0,
    color: '#33384a', size: 4, token: 'round',
    grow: { dmg: 1.23, rate: 1.10, range: 1.07 },
  },
  grenade: {
    id: 'grenade', name: '榴弹炮', icon: '🧨', tier: 2,
    desc: '中程抛射，爆炸半径适中，兼顾伤害与射速。',
    kind: 'projectile', style: 'grenade',
    damage: 19, rate: 0.85, range: 305, speed: 380,
    count: 1, spread: 0, pierce: 0, splash: 58, arc: true, arcH: 150,
    color: '#4a3a22', size: 5, token: 'grenade',
    grow: { dmg: 1.24, rate: 1.10, range: 1.06 },
  },
  mgun: {
    id: 'mgun', name: '机枪', icon: '🪖', tier: 2,
    desc: '极高射速连续扫射，弹幕如雨，专治快速小船。',
    kind: 'projectile', style: 'bullet',
    damage: 5, rate: 9, range: 235, speed: 820,
    count: 1, spread: 0.14, pierce: 0, splash: 0, arc: false, arcH: 0,
    color: '#ffd76a', size: 3, token: 'bullet',
    grow: { dmg: 1.2, rate: 1.12, range: 1.06 },
  },
  flame: {
    id: 'flame', name: '喷火器', icon: '🔥', tier: 2,
    desc: '近距离扇形喷射烈焰，持续灼烧，敌舰越多越壮观。',
    kind: 'flame', style: 'flame',
    damage: 5, rate: 12, range: 150, speed: 0,
    count: 1, spread: 0.5, pierce: 0, splash: 0, arc: false, arcH: 0,
    color: '#ff7a2a', size: 8, token: 'flame', cone: 0.55,
    grow: { dmg: 1.26, rate: 1.05, range: 1.06 },
  },
  mortar: {
    id: 'mortar', name: '臼炮', icon: '🎇', tier: 3,
    desc: '高抛曲射，落点大范围爆炸，射程极远，对舰群最是克制。',
    kind: 'projectile', style: 'mortar',
    damage: 34, rate: 0.55, range: 470, speed: 300,
    count: 1, spread: 0, pierce: 0, splash: 78, arc: true, arcH: 240,
    color: '#2a2a2c', size: 6, token: 'mortar',
    grow: { dmg: 1.26, rate: 1.08, range: 1.06 },
  },
  harpoon: {
    id: 'harpoon', name: '鱼叉炮', icon: '🔱', tier: 3,
    desc: '射出钢叉，贯穿整排敌舰，命中一条直线上的目标。',
    kind: 'projectile', style: 'harpoon',
    damage: 26, rate: 0.8, range: 350, speed: 780,
    count: 1, spread: 0, pierce: 4, splash: 0, arc: false, arcH: 0,
    color: '#c8cdd4', size: 5, token: 'harpoon',
    grow: { dmg: 1.24, rate: 1.09, range: 1.07 },
  },
  torpedo: {
    id: 'torpedo', name: '鱼雷', icon: '🛢', tier: 3,
    desc: '直线射出的水中雷，命中即大爆，威力惊人但易被躲开。',
    kind: 'projectile', style: 'torpedo',
    damage: 52, rate: 0.42, range: 400, speed: 250,
    count: 1, spread: 0, pierce: 0, splash: 68, arc: false, arcH: 0,
    color: '#3a4a4f', size: 6, token: 'torpedo',
    grow: { dmg: 1.28, rate: 1.07, range: 1.06 },
  },
  /* --- 野区 Boss 掉落的特殊装备（解锁键=对应 Boss，Ⅳ 传说级） --- */
  ink: {
    id: 'ink', name: '墨汁炮', icon: '🐙', tier: 4,
    desc: '击败深海章鱼解锁。泼出大片墨汁，大范围腐蚀爆破，暗伤船体。',
    kind: 'projectile', style: 'mortar',
    damage: 42, rate: 0.5, range: 480, speed: 320,
    count: 1, spread: 0, pierce: 0, splash: 96, arc: true, arcH: 240,
    color: '#5a4a7a', size: 7, token: 'mortar', unlockKey: 'octopus',
    grow: { dmg: 1.27, rate: 1.08, range: 1.06 },
  },
  fang: {
    id: 'fang', name: '鲨牙弩', icon: '🦈', tier: 4,
    desc: '击败猎鲨王解锁。鲨牙巨弩，射速快，贯穿整排敌舰。',
    kind: 'projectile', style: 'harpoon',
    damage: 34, rate: 0.9, range: 390, speed: 800,
    count: 1, spread: 0, pierce: 6, splash: 0, arc: false, arcH: 0,
    color: '#9adcff', size: 5, token: 'harpoon', unlockKey: 'shark',
    grow: { dmg: 1.25, rate: 1.1, range: 1.07 },
  },
};
const WEAPON_MAX_LEVEL = 5;
function weaponMaxLevel(id) { return WEAPONS[id] ? (WEAPONS[id].maxLevel || WEAPON_MAX_LEVEL) : WEAPON_MAX_LEVEL; }
const WEAPON_ORDER = ['swivel', 'cannon', 'twin', 'grenade', 'mgun', 'flame', 'mortar', 'harpoon', 'torpedo', 'ink', 'fang'];
const WEAPON_BASE_COST = {
  swivel: 0, cannon: 100, twin: 220, mortar: 300, grenade: 240,
  harpoon: 340, flame: 300, torpedo: 420, mgun: 200,
  ink: 520, fang: 480,
};
function weaponUpgradeCost(weaponId, nextLevel) {
  return Math.round((90 + nextLevel * 120) * (weaponId === 'cannon' ? 1 : 1.15));
}

/* ============ 护航舰（行为简单的自动单位） ============ */
const MINIONS = {
  sloop: { name: '哨船', hp: 82, speed: 80, money: 20, damage: 13, range: 175, rate: 0.8, size: 1.0, palette: ['#7a5a34', '#d8e0e6'] },
  gunboat: { name: '炮艇', hp: 150, speed: 58, money: 34, damage: 20, range: 205, rate: 0.6, size: 1.28, palette: ['#5a4a3a', '#aab2ba'] },
};
const MINION_ORDER = ['sloop', 'gunboat'];

/* 根据编号取护航舰类型 */
function minionTypeFor(i) { return MINION_ORDER[i % MINION_ORDER.length]; }
