/* config.js — 全部游戏数据，皆可修改
 * ------------------------------------------------------------------
 * 这是一个 3v3 海战 MOBA：上下两座基地，各自动生成护航舰（minion）互攻，
 * 双方各有 3 艘“英雄”战船（玩家 + 2 名队友 + 3 名敌舰）各自具备完整
 * 的武器/模块系统，会自动打怪→赚钱→升级。地图纵向共 3 个屏幕。
 * ------------------------------------------------------------------
 */
"use strict";

/* ============ 地图尺寸 ============
 * VIEW  = 一个屏幕（可视区域，也即画布逻辑分辨率）
 * WORLD = 整张图的尺寸（上下四个屏幕，比之前更大）
 * ================================= */
const VIEW = { w: 1280, h: 900 };
const WORLD = { w: 1760, h: VIEW.h * 4 };   // 更宽：让野区海兽有地盘
// 运行时视口（自适应手机横/竖屏，由 main.js 计算；绘制坐标大多用这个）
const View = { w: VIEW.w, h: VIEW.h };

/* ============ 阵营 / 基地 ============ */
const TEAM = [
  { name: '我方', color: '#4db6e8', dark: '#2a6b8f', accent: '#7ef0a0' },
  { name: '敌方', color: '#e6574d', dark: '#8f2a2a', accent: '#ffb15a' },
];

// 基地锚点（team A 在下，team B 在上）
const BASES = [
  { team: 0, x: WORLD.w / 2, y: WORLD.h - 130 },
  { team: 1, x: WORLD.w / 2, y: 130 },
];

const MOBA = {
  startGold: 130,          // 每个英雄初始金币
  heroBounty: 90,          // 击沉一艘敌方英雄的赏金
  baseHp: 2800,            // 基地耐久（被塔保护，拆完塔才能打到）
  baseRadius: 92,          // 基地碰撞半径
  minionInterval: 2.6,     // 基地每隔几秒出一只护航舰（更多兵）
  minionCap: 26,           // 每方护航舰上限
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
  { team: 0, tier: 1, x: 620, y: WORLD.h - 130 - 800 },
  { team: 0, tier: 1, x: 1140, y: WORLD.h - 130 - 800 },
  { team: 0, tier: 2, x: 620, y: WORLD.h - 130 - 400 },
  { team: 0, tier: 2, x: 1140, y: WORLD.h - 130 - 400 },
  // 敌方（上）：镜像
  { team: 1, tier: 1, x: 620, y: 130 + 800 },
  { team: 1, tier: 1, x: 1140, y: 130 + 800 },
  { team: 1, tier: 2, x: 620, y: 130 + 400 },
  { team: 1, tier: 2, x: 1140, y: 130 + 400 },
];
function towerHp(tier) { return tier === 1 ? 950 : 1250; }

/* ============ 野区海兽 Boss（各一只，带特色巢穴，不在航路上） ============
 * lair: 'grotto' 礁石溶洞（章鱼巢） / 'wreck' 沉船残骸（鲨鱼巢）
 * ================================================================ */
const JUNGLE_BOSSES = [
  { id: 'octoken', type: 'octopus', name: '深海章鱼', x: 390, y: 2060, hp: 3200, money: 360, reward: 'ink', rad: 62, lair: 'grotto' },
  { id: 'sharkking', type: 'shark', name: '猎鲨王', x: 1330, y: 1660, hp: 1800, money: 240, reward: 'fang', rad: 46, lair: 'wreck' },
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
  { shape: 'ellipse', x: 660, y: 1560, rx: 96, ry: 215 },
  { shape: 'ellipse', x: 1100, y: 1560, rx: 96, ry: 215 },
  { shape: 'ellipse', x: 660, y: 2160, rx: 96, ry: 215 },
  { shape: 'ellipse', x: 1100, y: 2160, rx: 96, ry: 215 },
  // 外围分隔岛（堵住斜切）
  { shape: 'ellipse', x: 230, y: 1300, rx: 72, ry: 155 },
  { shape: 'ellipse', x: 1530, y: 1300, rx: 72, ry: 155 },
  { shape: 'ellipse', x: 230, y: 2440, rx: 72, ry: 155 },
  { shape: 'ellipse', x: 1530, y: 2440, rx: 72, ry: 155 },
  // 两座基地岛（含在陆地碰撞里）
  { shape: 'ellipse', x: BASES[0].x, y: BASES[0].y, rx: 178, ry: 130, base: true },
  { shape: 'ellipse', x: BASES[1].x, y: BASES[1].y, rx: 178, ry: 130, base: true },
];

// 护航舰航行的三条“兵线” x 坐标（中间留出 30/50/70 的位置）
const LANES = [WORLD.w * 0.30, WORLD.w * 0.50, WORLD.w * 0.70];

/* ============ 船体：五种全异造型，各有专属技能，且可强化升级 ============
 * maxHp/size：基础耐久与体型；cost：购买价（旧船体按原价卖回）
 * skill：技能 id / 名称 / 图标 / 描述 / dur / cd
 * unlock：'boss' = 击败章鱼+鲨鱼后才解锁的生物船体
 * look：造型配色 {hull, deck, trim}；sailType：square 帆/steam 蒸汽/lateen 三角帆/ram 单帆/none
 * ================================================================== */
const HULLS = [
  {
    id: 'flag', name: '旗舰型船体', maxHp: 480, size: 1.00, cost: 0,
    desc: '均衡的古典加农帆船，旗舰之姿。',
    look: { hull: '#96633a', deck: '#c79a62', trim: '#f2efe0' }, sailType: 'square',
    skill: { id: 'sprint', name: '疾风冲刺', icon: '💨', desc: '8 秒内航速 +60%', dur: 8, cd: 18 },
  },
  {
    id: 'bulwark', name: '铁壁型船体', maxHp: 780, size: 1.14, cost: 420,
    desc: '蒸汽铁甲舰，铆接的重铁外壳，怒涛难撼。',
    look: { hull: '#46525e', deck: '#59646f', trim: '#93a0ad' }, sailType: 'steam',
    skill: { id: 'iron', name: '铁甲铁幕', icon: '🛡️', desc: '4 秒内受到伤害 -75%', dur: 4, cd: 22 },
  },
  {
    id: 'gale', name: '疾风型船体', maxHp: 430, size: 0.94, cost: 300,
    desc: '轻快的纵帆快艇，又长又窄，与风同速。',
    look: { hull: '#2f7f8f', deck: '#3e98a8', trim: '#e8f4f6' }, sailType: 'lateen',
    skill: { id: 'fury', name: '速射狂热', icon: '⚡', desc: '6 秒内射速 +55%', dur: 6, cd: 20 },
  },
  {
    id: 'ram', name: '破浪型船体', maxHp: 570, size: 1.08, cost: 520,
    desc: '重型冲撞舰，黄铜撞角立于船头。',
    look: { hull: '#8a4a34', deck: '#a86a48', trim: '#e8d9c2' }, sailType: 'ram',
    skill: { id: 'ram', name: '破浪冲撞', icon: '🌊', desc: '向前猛冲，撞穿路径上的敌舰', dur: 0.6, cd: 14 },
  },
  {
    id: 'bio', name: '生物型船体', maxHp: 720, size: 1.18, cost: 900, unlock: 'boss',
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

/* ============ 武器：英雄 4 个炮位可装备 ============ */
const WEAPONS = {
  cannon: {
    id: 'cannon', name: '加农炮', icon: '💣',
    desc: '标准舰炮，弹道平直，命中稳定。稳扎稳打的入门之选。',
    kind: 'projectile', style: 'cannonball',
    damage: 16, rate: 1.15, range: 330, speed: 540,
    count: 1, spread: 0, pierce: 0, splash: 0, arc: false, arcH: 0,
    color: '#2c2f38', size: 5, token: 'round',
    grow: { dmg: 1.24, rate: 1.10, range: 1.07 },
  },
  twin: {
    id: 'twin', name: '二联装火炮', icon: '💥',
    desc: '两根炮管同时齐射，弹幕密集，前向火力凶猛。',
    kind: 'projectile', style: 'twinball',
    damage: 10, rate: 1.35, range: 300, speed: 560,
    count: 2, spread: 0.07, pierce: 0, splash: 0, arc: false, arcH: 0,
    color: '#33384a', size: 4, token: 'round',
    grow: { dmg: 1.23, rate: 1.10, range: 1.07 },
  },
  mortar: {
    id: 'mortar', name: '臼炮', icon: '🎇',
    desc: '高抛曲射，落点大范围爆炸，射程极远，对舰群最是克制。',
    kind: 'projectile', style: 'mortar',
    damage: 34, rate: 0.55, range: 470, speed: 300,
    count: 1, spread: 0, pierce: 0, splash: 78, arc: true, arcH: 240,
    color: '#2a2a2c', size: 6, token: 'mortar',
    grow: { dmg: 1.26, rate: 1.08, range: 1.06 },
  },
  grenade: {
    id: 'grenade', name: '榴弹炮', icon: '🧨',
    desc: '中程抛射，爆炸半径适中，兼顾伤害与射速。',
    kind: 'projectile', style: 'grenade',
    damage: 19, rate: 0.85, range: 305, speed: 380,
    count: 1, spread: 0, pierce: 0, splash: 58, arc: true, arcH: 150,
    color: '#4a3a22', size: 5, token: 'grenade',
    grow: { dmg: 1.24, rate: 1.10, range: 1.06 },
  },
  harpoon: {
    id: 'harpoon', name: '鱼叉炮', icon: '🔱',
    desc: '射出钢叉，贯穿整排敌舰，命中一条直线上的目标。',
    kind: 'projectile', style: 'harpoon',
    damage: 26, rate: 0.8, range: 350, speed: 780,
    count: 1, spread: 0, pierce: 4, splash: 0, arc: false, arcH: 0,
    color: '#c8cdd4', size: 5, token: 'harpoon',
    grow: { dmg: 1.24, rate: 1.09, range: 1.07 },
  },
  flame: {
    id: 'flame', name: '喷火器', icon: '🔥',
    desc: '近距离扇形喷射烈焰，持续灼烧，敌舰越多越壮观。',
    kind: 'flame', style: 'flame',
    damage: 5, rate: 12, range: 150, speed: 0,
    count: 1, spread: 0.5, pierce: 0, splash: 0, arc: false, arcH: 0,
    color: '#ff7a2a', size: 8, token: 'flame', cone: 0.55,
    grow: { dmg: 1.26, rate: 1.05, range: 1.06 },
  },
  torpedo: {
    id: 'torpedo', name: '鱼雷', icon: '🛢',
    desc: '直线射出的水中雷，命中即大爆，威力惊人但易被躲开。',
    kind: 'projectile', style: 'torpedo',
    damage: 52, rate: 0.42, range: 400, speed: 250,
    count: 1, spread: 0, pierce: 0, splash: 68, arc: false, arcH: 0,
    color: '#3a4a4f', size: 6, token: 'torpedo',
    grow: { dmg: 1.28, rate: 1.07, range: 1.06 },
  },
  mgun: {
    id: 'mgun', name: '机枪', icon: '🪖',
    desc: '极高射速连续扫射，弹幕如雨，专治快速小船。',
    kind: 'projectile', style: 'bullet',
    damage: 5, rate: 9, range: 235, speed: 820,
    count: 1, spread: 0.14, pierce: 0, splash: 0, arc: false, arcH: 0,
    color: '#ffd76a', size: 3, token: 'bullet',
    grow: { dmg: 1.2, rate: 1.12, range: 1.06 },
  },
  /* --- 野区 Boss 掉落的特殊装备（unlockKey=击败对应 Boss 解锁） --- */
  ink: {
    id: 'ink', name: '墨汁炮', icon: '🐙',
    desc: '击败深海章鱼解锁。泼出大片墨汁，大范围腐蚀爆破，暗伤船体。',
    kind: 'projectile', style: 'mortar',
    damage: 42, rate: 0.5, range: 480, speed: 320,
    count: 1, spread: 0, pierce: 0, splash: 96, arc: true, arcH: 240,
    color: '#5a4a7a', size: 7, token: 'mortar', unlockKey: 'octopus',
    grow: { dmg: 1.27, rate: 1.08, range: 1.06 },
  },
  fang: {
    id: 'fang', name: '鲨牙弩', icon: '🦈',
    desc: '击败猎鲨王解锁。鲨牙巨弩，射速快，贯穿整排敌舰。',
    kind: 'projectile', style: 'harpoon',
    damage: 34, rate: 0.9, range: 390, speed: 800,
    count: 1, spread: 0, pierce: 6, splash: 0, arc: false, arcH: 0,
    color: '#9adcff', size: 5, token: 'harpoon', unlockKey: 'shark',
    grow: { dmg: 1.25, rate: 1.1, range: 1.07 },
  },
};
const WEAPON_MAX_LEVEL = 5;
const WEAPON_ORDER = ['cannon', 'twin', 'mortar', 'grenade', 'harpoon', 'flame', 'torpedo', 'mgun', 'ink', 'fang'];
const WEAPON_BASE_COST = {
  cannon: 0, twin: 220, mortar: 300, grenade: 240,
  harpoon: 340, flame: 300, torpedo: 420, mgun: 200,
  ink: 520, fang: 480,
};
function weaponUpgradeCost(weaponId, nextLevel) {
  return Math.round((90 + nextLevel * 120) * (weaponId === 'cannon' ? 1 : 1.15));
}

/* 六名英雄的默认 4 炮位（镜像对称：同一兵线上敌我战力一致，公平对战；
 * 三个兵线各有不同风格——中路均衡、左路鱼叉、右路鱼雷机枪） */
const HERO_SLOTS = [
  ['cannon', 'cannon', 'twin', 'mortar'],   // 我方 中路
  ['cannon', 'twin', 'grenade', 'harpoon'], // 我方 左线
  ['mgun', 'cannon', 'torpedo', 'cannon'],  // 我方 右线
  ['cannon', 'cannon', 'twin', 'mortar'],   // 敌方 中路（镜像）
  ['cannon', 'twin', 'grenade', 'harpoon'], // 敌方 左线（镜像）
  ['mgun', 'cannon', 'torpedo', 'cannon'],  // 敌方 右线（镜像）
];

/* ============ 护航舰（行为简单的自动单位） ============ */
const MINIONS = {
  sloop: { name: '哨船', hp: 82, speed: 80, money: 15, damage: 13, range: 175, rate: 0.8, size: 1.0, palette: ['#7a5a34', '#d8e0e6'] },
  gunboat: { name: '炮艇', hp: 150, speed: 58, money: 25, damage: 20, range: 205, rate: 0.6, size: 1.28, palette: ['#5a4a3a', '#aab2ba'] },
};
const MINION_ORDER = ['sloop', 'gunboat'];

/* 根据编号取护航舰类型 */
function minionTypeFor(i) { return MINION_ORDER[i % MINION_ORDER.length]; }
