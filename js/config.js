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
  { id: 'octoken', type: 'octopus', name: '深海章鱼', x: 430, y: 2300, hp: 3200, money: 360, reward: 'ink', rad: 62, lair: 'grotto', buff: 'dmg' },
  { id: 'sharkking', type: 'shark', name: '猎鲨王', x: 1470, y: 2080, hp: 1800, money: 240, reward: 'fang', rad: 46, lair: 'wreck', buff: 'spd' },
  { id: 'serpent', type: 'serpent', name: '深海九头蛇', x: 1520, y: 3260, hp: 2400, money: 280, rad: 54, buff: 'shield' },
  { id: 'crab', type: 'crab', name: '铁甲巨蟹', x: 420, y: 1160, hp: 2600, money: 280, rad: 56, buff: 'regen' },
];
const MONSTER_RESPAWN = 60;   // Boss 重生秒数
const MONSTER_BOSS_NAME = { octopus: '深海章鱼', shark: '猎鲨王', serpent: '深海九头蛇', crab: '铁甲巨蟹' };

/* ============ 团队增益（击杀海兽 / 开宝箱获得，全队生效） ============ */
const TEAM_BUFFS = {
  dmg:    { name: '狂暴', icon: '🔥', dur: 90, desc: '全队武器伤害 +15%' },
  spd:    { name: '顺风', icon: '💨', dur: 90, desc: '全队航速 +12%' },
  shield: { name: '铁鳞', icon: '🛡️', dur: 90, desc: '全队受到伤害 -10%' },
  regen:  { name: '潮汐治愈', icon: '💧', dur: 90, desc: '全队每秒回复 3 耐久' },
  gold:   { name: '宝藏', icon: '💰', dur: 60, desc: '全队击杀赏金 +25%' },
};

/* ============ 中立灯塔（占领后全队加速 + 范围治疗） ============ */
const BEACONS = [
  { x: 340, y: 2250, r: 150 },
  { x: 1580, y: 2250, r: 150 },
];
const BEACON = { captureTime: 13, healR: 300, heal: 7, speedPer: 0.06 };

/* ============ 海底宝箱（打破得金币 + 随机团队增益） ============ */
const CHEST_SPOTS = [
  { x: 620, y: 2620 }, { x: 1300, y: 1780 }, { x: 960, y: 3250 },
  { x: 340, y: 1700 }, { x: 1580, y: 2800 }, { x: 960, y: 1300 },
];
const CHEST = { hp: 220, rad: 22, keep: 42, max: 3, gold: [150, 260], buffDur: 45 };

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

/* ============ 洋流（船在其中被推动：顺流快，逆流慢） ============
 * ax/ay：流向单位向量；force：推力（px/s）
 * ========================================================= */
const CURRENTS = [
  { x: WORLD.w * 0.5, y: 2250, rx: 560, ry: 420, ax: 0, ay: 1, force: 30 },       // 中央南下流
  { x: WORLD.w * 0.5, y: 1500, rx: 520, ry: 360, ax: 0, ay: -1, force: 26 },      // 上段北上流
  { x: 330, y: 3350, rx: 260, ry: 460, ax: 0.6, ay: -0.8, force: 24 },            // 左下回旋
  { x: WORLD.w - 330, y: 1100, rx: 260, ry: 460, ax: -0.6, ay: 0.8, force: 24 },  // 右上回旋
];

/* ============ 浅滩（可通行浅水：大船减速，小艇无碍 → 小船体有独特价值） ============ */
const SHOALS = [
  { x: 560, y: 3300, rx: 210, ry: 150 },
  { x: 1360, y: 1200, rx: 210, ry: 150 },
  { x: WORLD.w * 0.5, y: 2280, rx: 150, ry: 300 },
];

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

/* ============ 船长天赋（每 3 级三选一，局内成长分支） ============
 * key：talents 计数键；eff：数值效果说明
 * ============================================================= */
const TALENT_EVERY = 3;              // 每 N 级给一次天赋选择
const TALENTS = [
  { id: 'reload', name: '铁腕装填', icon: '⚙️', desc: '装填速度 +9%（可叠加）' },
  { id: 'range', name: '精准炮术', icon: '🎯', desc: '武器射程 +7%（可叠加）' },
  { id: 'damage', name: '弹药强化', icon: '💥', desc: '武器伤害 +8%（可叠加）' },
  { id: 'hull', name: '硬化船壳', icon: '🛡️', desc: '受到伤害 -6%（可叠加）' },
  { id: 'regen', name: '补漏工匠', icon: '🩹', desc: '每秒回复 +1.6 耐久（可叠加）' },
  { id: 'sail', name: '疾风之帆', icon: '⛵', desc: '航速 +7%（可叠加）' },
  { id: 'booty', name: '战利品猎人', icon: '💰', desc: '击杀赏金 +22%（可叠加）' },
  { id: 'focus', name: '技能专精', icon: '⚡', desc: '船体技能冷却 -14%（可叠加）' },
];
/* 船长经验：击杀获得，另有每秒少量经验 */
const XP = { heroKill: 130, minionKill: 22, towerKill: 120, bossKill: 220, perSec: 2.2 };
function xpToNext(level) { return Math.round(70 + level * 30); }

/* ============ 主动道具（2 个道具栏，键位 E / R） ============ */
const ITEMS = {
  grapple: {
    id: 'grapple', name: '钩爪', icon: '🪝', cost: 260, cd: 16,
    desc: '甩出钩爪缠住最近的敌舰，把它拖向自己并造成 70 伤害。',
  },
  smoke: {
    id: 'smoke', name: '烟幕', icon: '💨', cost: 300, cd: 22,
    desc: '放出烟幕：3.2 秒内敌方无法锁定你，期间航速 +25%。',
  },
  minekit: {
    id: 'minekit', name: '水雷包', icon: '💣', cost: 240, cd: 20,
    desc: '在船尾连投 3 枚水雷，封锁航道。',
  },
  repairkit: {
    id: 'repairkit', name: '抢修箱', icon: '🧰', cost: 320, cd: 26,
    desc: '立刻修复 35% 耐久（与船坞修船冷却无关）。',
  },
};
const ITEM_ORDER = ['grapple', 'smoke', 'minekit', 'repairkit'];

/* ============ AI 难度 ============
 * aiTick：AI 思考间隔（越小越灵敏）；goldMul：敌方 AI 经济倍率
 * focusPlayer：优先集火玩家的概率；group：抱团推进概率
 * bossy：抢野怪概率；protect：保护残血队友概率；retreatMul：撤退阈值系数
 * ================================ */
const DIFFICULTY = {
  easy:   { name: '简单', icon: '🌤️', aiTick: 0.46, goldMul: 0.85, focusPlayer: 0.05, group: 0.25, bossy: 0.2, protect: 0.3, retreatMul: 1.3 },
  normal: { name: '普通', icon: '⛅', aiTick: 0.28, goldMul: 1.00, focusPlayer: 0.35, group: 0.5, bossy: 0.5, protect: 0.6, retreatMul: 1.0 },
  hard:   { name: '困难', icon: '⛈️', aiTick: 0.18, goldMul: 1.15, focusPlayer: 0.85, group: 0.85, bossy: 0.9, protect: 0.9, retreatMul: 0.78 },
};
const DIFF_ORDER = ['easy', 'normal', 'hard'];
function diffCfg() { return DIFFICULTY[(typeof Settings !== 'undefined' && Settings.difficulty) || 'normal'] || DIFFICULTY.normal; }

/* ============ 玩家指令（标记给 AI 队友） ============ */
const PINGS = [
  { id: 'gather', name: '集合', icon: '📍', color: '#7ef0a0', desc: '队友向标记点集合' },
  { id: 'retreat', name: '撤退', icon: '🏳️', color: '#ffd76a', desc: '队友立刻后撤回防' },
  { id: 'danger', name: '打野/危险', icon: '⚠️', color: '#ff8b6a', desc: '队友转向标记点附近的敌人或海兽' },
];

/* ============ 护航舰（行为简单的自动单位） ============
 * 加成字段：mines 布水雷 / aura 友军护盾光环半径 / siege 对塔倍率
 * ================================================== */
const MINIONS = {
  sloop: { name: '哨船', hp: 82, speed: 80, money: 20, damage: 13, range: 175, rate: 0.8, size: 1.0, palette: ['#7a5a34', '#d8e0e6'] },
  gunboat: { name: '炮艇', hp: 150, speed: 58, money: 34, damage: 20, range: 205, rate: 0.6, size: 1.28, palette: ['#5a4a3a', '#aab2ba'] },
  miner: { name: '水雷船', hp: 100, speed: 66, money: 24, damage: 8, range: 165, rate: 0.7, size: 1.02, palette: ['#4d5a3c', '#c2ccb6'], mines: true, mineCD: 4.0 },
  banner: { name: '旗船', hp: 140, speed: 60, money: 28, damage: 11, range: 185, rate: 0.7, size: 1.16, palette: ['#7a5a34', '#efe0b0'], aura: 175 },
  siege: { name: '攻城船', hp: 140, speed: 46, money: 36, damage: 40, range: 320, rate: 0.45, size: 1.38, palette: ['#5a4a3a', '#9aa3ad'], siege: 2.4 },
};
const MINION_ORDER = ['sloop', 'gunboat'];

/* 出兵波次表：每 4 波来一次“大队”，大队会带上旗船/攻城船/水雷船 */
const MINION_WAVE = ['sloop', 'sloop', 'gunboat', 'sloop', 'siege', 'sloop', 'gunboat', 'banner'];
const MINION_BIGWAVE = 4;          // 每 N 波为大队
const MINION_BIGWAVE_PLAN = ['gunboat', 'banner', 'miner'];
const MINION_GROW_T = 300;         // 每 5 分钟兵线全体强化一次
const MINION_GROW = { hp: 0.12, dmg: 0.12, spd: 0.02 };

/* 根据编号取护航舰类型（保留旧接口） */
function minionTypeFor(i) { return MINION_ORDER[i % MINION_ORDER.length]; }
