/* ===========================================================
   迷你世界 · 像素宇宙 — 静态数据
   =========================================================== */
window.MW = window.MW || {};
MW.VERSION = '1.0.0';

/* ---------- 基础调色板 ---------- */
MW.PALETTE = {
  grass: [0x77a83e, 0x7fb448, 0x6c9e37, 0x8abd52],
  dirt: [0x7a5a3a, 0x6d5033, 0x836244],
  stone: [0x8b8f92, 0x7d8285, 0x969b9e],
  sand: [0xd8c48a, 0xcdb87c, 0xe2d09a],
  snow: [0xeef3f7, 0xe4ebf1],
  water: [0x2f7fae, 0x2a739e, 0x368cb9],
  wood: [0x7b5230, 0x6a4528, 0x8a5d38],
  brick: [0xa5523b, 0x934833],
  gold: [0xd8a531, 0xc9971f, 0xe2b64a],
  red: [0x9d2f26, 0x8a2820, 0xb0382c],
  white: [0xe8e6df, 0xdedbd2],
  asphalt: [0x4a4e55, 0x42464c],
  glass: [0x5fa7c4, 0x6bb5d1],
  dark: [0x2b2f38, 0x23262d]
};

/* ---------- 背包 ---------- */
MW.BACKPACKS = [
  { level: 1, name: '帆布背包', capacity: 12, color: '#8a7a5c' },
  { level: 2, name: '战术背包', capacity: 20, color: '#5b7f4e' },
  { level: 3, name: '远征背包', capacity: 32, color: '#9a6b2f' }
];

/* ---------- 物品 ---------- */
MW.ITEMS = {
  grenade:    { name: '破片手雷', icon: '●', color: '#d8a33d', stack: 12, kind: 'throwable', desc: 'G 键投掷，范围爆炸' },
  mine:       { name: '反步兵地雷', icon: '▲', color: '#c9553d', stack: 8, kind: 'throwable', desc: 'M 键放置，靠近引爆' },
  medkit:     { name: '急救包', icon: '＋', color: '#5bc27a', stack: 5, kind: 'use', heal: 45, desc: '使用后恢复 45 生命' },
  armor:      { name: '防弹插板', icon: '⛨', color: '#5b9fe0', stack: 3, kind: 'use', armor: 50, desc: '获得 50 点护甲' },
  ammo_light: { name: '5.56mm 弹药', icon: '▮', color: '#e3c05a', stack: 240, kind: 'ammo', ammo: 'light', amount: 30 },
  ammo_heavy: { name: '7.62mm 弹药', icon: '▮', color: '#d99a4e', stack: 300, kind: 'ammo', ammo: 'heavy', amount: 40 },
  ammo_shell: { name: '12 号霰弹', icon: '▮', color: '#c96f4b', stack: 80, kind: 'ammo', ammo: 'shell', amount: 12 },
  ammo_rocket:{ name: '火箭弹', icon: '▮', color: '#b94f4f', stack: 20, kind: 'ammo', ammo: 'rocket', amount: 2 },
  backpack2:  { name: '战术背包', icon: '▣', color: '#6d8f4e', stack: 1, kind: 'backpack', upgrade: 2, desc: '背包容量提升至 20 格' },
  backpack3:  { name: '远征背包', icon: '▣', color: '#c08a3e', stack: 1, kind: 'backpack', upgrade: 3, desc: '背包容量提升至 32 格' }
};

/* ---------- 武器 ----------
   零件格式：{p:[x,y,z], s:[w,h,d], c:颜色, glow?:发光, shape?:'cyl', r?:半径, h?:高}
   枪口朝向 -Z，枪身原点在握把附近
------------------------------------ */
MW.WEAPONS = {
  pistol: {
    id: 'pistol', name: 'M9 手枪', short: 'M9', kind: 'gun', slot: 1,
    dmg: 24, pellets: 1, rpm: 340, auto: false, mag: 12, reserve: 72,
    spread: 0.012, range: 80, reload: 1.15, ammo: 'light', color: '#39414f',
    desc: '可靠、轻便的随身武器。', tier: 1,
    view: [
      { p: [0, 0.02, -0.1], s: [0.09, 0.095, 0.32], c: 0x3b4350 },
      { p: [0, 0.085, -0.12], s: [0.075, 0.035, 0.26], c: 0x2a303a },
      { p: [0, 0.02, -0.27], s: [0.055, 0.055, 0.1], c: 0x22262c },
      { p: [0, -0.09, 0.01], s: [0.075, 0.16, 0.09], c: 0x2a2e35 },
      { p: [0, 0.12, -0.22], s: [0.018, 0.025, 0.03], c: 0x9fd8ff, glow: true },
      { p: [0, 0.02, 0.07], s: [0.05, 0.06, 0.08], c: 0x22262c }
    ],
    muzzle: [0, 0.02, -0.33]
  },
  smg: {
    id: 'smg', name: 'MP5 冲锋枪', short: 'MP5', kind: 'gun', slot: 1,
    dmg: 17, pellets: 1, rpm: 880, auto: true, mag: 40, reserve: 200,
    spread: 0.03, range: 60, reload: 1.6, ammo: 'light', color: '#3d4a3f',
    desc: '高射速，近距离压制利器。', tier: 2,
    view: [
      { p: [0, 0.01, -0.18], s: [0.1, 0.12, 0.42], c: 0x3f4a40 },
      { p: [0, 0.02, -0.45], s: [0.045, 0.045, 0.22], c: 0x22262b },
      { p: [0, -0.17, -0.14], s: [0.055, 0.2, 0.1], c: 0x2c332d },
      { p: [0, 0.09, -0.05], s: [0.08, 0.05, 0.24], c: 0x2c332d },
      { p: [0, 0.02, 0.08], s: [0.05, 0.07, 0.14], c: 0x252a26 },
      { p: [0, 0.125, -0.2], s: [0.02, 0.03, 0.05], c: 0x8fe0ff, glow: true }
    ],
    muzzle: [0, 0.02, -0.58]
  },
  rifle: {
    id: 'rifle', name: 'AK-47 突击步枪', short: 'AK-47', kind: 'gun', slot: 2,
    dmg: 27, pellets: 1, rpm: 600, auto: true, mag: 30, reserve: 150,
    spread: 0.02, range: 100, reload: 1.9, ammo: 'light', color: '#6b4a2c',
    desc: '经典可靠，中距离全能。', tier: 2,
    view: [
      { p: [0, 0.01, -0.24], s: [0.09, 0.11, 0.52], c: 0x6d4a2d },
      { p: [0, 0.01, -0.58], s: [0.04, 0.04, 0.3], c: 0x272b2f },
      { p: [0, -0.15, -0.14], s: [0.07, 0.22, 0.1], c: 0x4a3420 },
      { p: [0, 0.1, -0.12], s: [0.07, 0.045, 0.3], c: 0x33251a },
      { p: [0, 0.01, 0.12], s: [0.08, 0.1, 0.2], c: 0x6d4a2d },
      { p: [0, 0.15, -0.36], s: [0.035, 0.035, 0.12], c: 0x2c2f33 },
      { p: [0, 0.19, -0.36], s: [0.02, 0.025, 0.05], c: 0x8fe0ff, glow: true }
    ],
    muzzle: [0, 0.01, -0.74]
  },
  shotgun: {
    id: 'shotgun', name: 'SPAS-12 霰弹枪', short: 'SPAS', kind: 'gun', slot: 3,
    dmg: 13, pellets: 9, rpm: 78, auto: false, mag: 6, reserve: 36,
    spread: 0.075, range: 42, reload: 2.3, ammo: 'shell', color: '#424a52',
    desc: '一发九弹丸，近距离毁天灭地。', tier: 2,
    view: [
      { p: [0, 0, -0.3], s: [0.1, 0.11, 0.62], c: 0x474f58 },
      { p: [0, 0.02, -0.66], s: [0.065, 0.065, 0.32], c: 0x2a2e33 },
      { p: [0, -0.1, -0.4], s: [0.08, 0.07, 0.26], c: 0x353c43 },
      { p: [0, -0.12, 0.0], s: [0.08, 0.15, 0.1], c: 0x2b3137 },
      { p: [0, 0.02, 0.12], s: [0.09, 0.12, 0.26], c: 0x353c43 }
    ],
    muzzle: [0, 0.02, -0.83]
  },
  sniper: {
    id: 'sniper', name: 'AWM 狙击枪', short: 'AWM', kind: 'gun', slot: 4,
    dmg: 150, pellets: 1, rpm: 48, auto: false, mag: 5, reserve: 25,
    spread: 0.0015, range: 260, reload: 2.8, ammo: 'heavy', color: '#2f4a3b',
    desc: '一枪一个，右键开启瞄准镜。', tier: 3, scope: true,
    view: [
      { p: [0, 0.01, -0.32], s: [0.09, 0.1, 0.72], c: 0x344f3c },
      { p: [0, 0.02, -0.82], s: [0.035, 0.035, 0.5], c: 0x1e2420 },
      { p: [0, 0.15, -0.3], s: [0.055, 0.055, 0.4], c: 0x14181a },
      { p: [0, 0.185, -0.5], s: [0.07, 0.07, 0.06], c: 0x2f6b4b },
      { p: [0, -0.12, -0.05], s: [0.07, 0.14, 0.1], c: 0x2b3a30 },
      { p: [0, 0.01, 0.18], s: [0.08, 0.11, 0.3], c: 0x344f3c }
    ],
    muzzle: [0, 0.02, -1.07]
  },
  minigun: {
    id: 'minigun', name: 'M134 重机枪', short: 'M134', kind: 'gun', slot: 5,
    dmg: 17, pellets: 1, rpm: 1200, auto: true, mag: 150, reserve: 450,
    spread: 0.05, range: 90, reload: 4.6, ammo: 'heavy', color: '#3d3f44',
    desc: '弹雨倾泻，移动速度降低。', tier: 3, heavy: true,
    view: [
      { p: [0, -0.02, -0.22], s: [0.18, 0.2, 0.4], c: 0x3f4247 },
      { p: [-0.05, 0, -0.62], s: [0.045, 0.045, 0.6], c: 0x24272b },
      { p: [0.05, 0, -0.62], s: [0.045, 0.045, 0.6], c: 0x24272b },
      { p: [0, 0.055, -0.62], s: [0.045, 0.045, 0.6], c: 0x24272b },
      { p: [0, -0.055, -0.62], s: [0.045, 0.045, 0.6], c: 0x24272b },
      { p: [0, 0.12, -0.15], s: [0.09, 0.06, 0.26], c: 0x2c2f33 },
      { p: [0, -0.16, -0.1], s: [0.16, 0.18, 0.2], c: 0x4d4f3f }
    ],
    muzzle: [0, 0.01, -0.94]
  },
  rpg: {
    id: 'rpg', name: 'RPG-7 火箭筒', short: 'RPG', kind: 'launcher', slot: 6,
    dmg: 190, radius: 7.5, rpm: 36, auto: false, mag: 1, reserve: 8,
    spread: 0.01, range: 160, reload: 3.4, ammo: 'rocket', color: '#4a5a3a',
    desc: '范围爆炸，对载具和集群目标极佳。', tier: 3, projectile: 'rocket',
    view: [
      { p: [0, 0.04, -0.42], s: [0.11, 0.11, 0.95], c: 0x4c5f3b },
      { p: [0, 0.2, -0.66], s: [0.09, 0.09, 0.1], c: 0x2f3a27 },
      { p: [0, -0.2, -0.2], s: [0.07, 0.16, 0.08], c: 0x3a3324 },
      { p: [0, 0.16, -0.05], s: [0.04, 0.12, 0.05], c: 0x2c2a22 },
      { p: [0, 0.04, -0.95], s: [0.15, 0.15, 0.18], c: 0x6e6a52 }
    ],
    muzzle: [0, 0.04, -1.06]
  },
  laser: {
    id: 'laser', name: 'ZX-9 激光枪', short: 'ZX-9', kind: 'gun', slot: 7,
    dmg: 58, pellets: 1, rpm: 170, auto: true, mag: 24, reserve: 96,
    spread: 0.0, range: 150, reload: 2.0, ammo: 'light', color: '#2b6f78',
    desc: '实验型定向能武器，弹道笔直。', tier: 3, glow: true,
    view: [
      { p: [0, 0, -0.3], s: [0.1, 0.14, 0.6], c: 0x2d3f4a },
      { p: [0, 0.02, -0.68], s: [0.05, 0.05, 0.36], c: 0x1f2c33 },
      { p: [0, 0.02, -0.76], s: [0.02, 0.02, 0.28], c: 0x64f0ff, glow: true },
      { p: [0, -0.12, -0.12], s: [0.07, 0.16, 0.1], c: 0x202b31 },
      { p: [0, 0.12, -0.25], s: [0.08, 0.06, 0.22], c: 0x34606b },
      { p: [0.0, 0.12, -0.47], s: [0.03, 0.03, 0.08], c: 0x64f0ff, glow: true }
    ],
    muzzle: [0, 0.02, -0.92]
  },
  missile: {
    id: 'missile', name: 'FGM-148 标枪导弹', short: '标枪', kind: 'launcher', slot: 7,
    dmg: 260, radius: 8, rpm: 42, auto: false, mag: 1, reserve: 6,
    spread: 0.0, range: 260, reload: 4.2, ammo: 'rocket', color: '#3d4a3f',
    desc: '红外制导反装甲导弹，自动追踪舰船与载具。', tier: 3, projectile: 'missile', homing: true,
    view: [
      { p: [0, 0.02, -0.4], s: [0.16, 0.16, 1.0], c: 0x3d4a3f },
      { p: [0, 0.3, -0.55], s: [0.12, 0.1, 0.3], c: 0x2c352f },
      { p: [0, 0.05, -0.95], s: [0.22, 0.22, 0.2], c: 0x5d6b58 },
      { p: [0, -0.18, -0.2], s: [0.07, 0.18, 0.1], c: 0x2a2f28 },
      { p: [0, 0.05, 0.1], s: [0.1, 0.12, 0.2], c: 0x2a2f28 },
      { p: [0.06, 0.16, -0.2], s: [0.04, 0.04, 0.12], c: 0x64f0ff, glow: true }
    ],
    muzzle: [0, 0.02, -1.08]
  }
};

/* ---------- 角色外观 ---------- */
MW.CHARACTERS = {
  player:  { name: '旅行者', scale: 1, skin: 0xd9a87a, shirt: 0x3f7fa8, pants: 0x2f3b4d, hair: 0x2a211c, accent: 0xf2b544 },
  soldier: { name: '联合士兵', scale: 1, skin: 0xc99a70, shirt: 0x536b3f, pants: 0x3c4a30, hair: 0x241d18, accent: 0x8fd08a, helmet: 0x50603c },
  zombie:  { name: '夜行尸', scale: 1.04, skin: 0x7e9a63, shirt: 0x5c5148, pants: 0x3f3a35, hair: 0x3a2f28, accent: 0x9db060, zombie: true },
  elite:   { name: '腐化巨尸', scale: 1.35, skin: 0x60774a, shirt: 0x4a3f3a, pants: 0x332f2b, hair: 0x2b241f, accent: 0xb7c46a, zombie: true }
};

/* ---------- 天气 / 季节 ---------- */
MW.WEATHERS = [
  { id: 'clear', name: '晴朗', icon: '☀' },
  { id: 'rain', name: '降雨', icon: '☂' },
  { id: 'snow', name: '降雪', icon: '❄' },
  { id: 'fog', name: '浓雾', icon: '≋' },
  { id: 'storm', name: '雷暴', icon: '⚡' }
];
MW.SEASONS = [
  { id: 'spring', name: '春', icon: '🌸', leaf: [0x86c35a, 0x9ed36b, 0x74b24c], tint: 0.02 },
  { id: 'summer', name: '夏', icon: '🌿', leaf: [0x4f9a3a, 0x5fae45, 0x468c34], tint: 0.0 },
  { id: 'autumn', name: '秋', icon: '🍂', leaf: [0xd08a35, 0xc9762e, 0xb9863a], tint: 0.03 },
  { id: 'winter', name: '冬', icon: '❄', leaf: [0xdfe8ee, 0xcddae2, 0xeaf2f6], tint: -0.04 }
];

MW.SKY_PRESETS = {
  day:    { top: 0x2f6fa8, bottom: 0xbfe0ef, horizon: 0xdff0f6, sun: 0xfff2cc, sunI: 1.0, hemiI: 0.75, night: 0, sunAngle: 62 },
  dusk:   { top: 0x2a2b52, bottom: 0xe08a52, horizon: 0xf3b46a, sun: 0xffb45e, sunI: 0.8, hemiI: 0.45, night: 0.35, sunAngle: 12 },
  night:  { top: 0x080c1c, bottom: 0x1d2c46, horizon: 0x33425e, sun: 0x9fc4ff, sunI: 0.22, hemiI: 0.24, night: 1, sunAngle: -30 },
  dawn:   { top: 0x3b4d7a, bottom: 0xf0b48a, horizon: 0xffd0a0, sun: 0xffd6a0, sunI: 0.7, hemiI: 0.5, night: 0.25, sunAngle: 8 }
};

/* ---------- 世界清单 ---------- */
MW.WORLDS = [
  {
    id: 'forbidden', name: '紫禁城', en: 'FORBIDDEN CITY', icon: '🏯',
    tags: ['宫殿', '国风', '探索'], difficulty: '探索',
    desc: '朱墙金瓦，九重宫阙。沿着中轴线穿过太和门，在黄昏的广场上击退夜行尸，夺回三座宫门。',
    grad: ['#2a120f', '#7d2f22', '#d9a53c'], accent: '#e8b64f',
    sky: 'dusk', season: 'autumn', weather: 'clear', seed: 11987,
    objective: '肃清宫城中的夜行尸，并占领 3 处宫门',
    features: ['中轴宫殿群', '黄昏', '坦克试驾'], vehicles: ['tank']
  },
  {
    id: 'changan', name: '唐长安 · 不夜城', en: 'CHANGAN NIGHT', icon: '🏮',
    tags: ['夜景', '市井', '灯会'], difficulty: '探索',
    desc: '一百零八坊，灯火彻夜不熄。朱雀大街两侧挂满红灯笼，大雁塔下有人在等一场夜战。',
    grad: ['#120b1e', '#4a1f3d', '#e2773a'], accent: '#ff9d5c',
    sky: 'night', season: 'summer', weather: 'clear', seed: 60231,
    objective: '点亮三坊灯火，守住朱雀大街',
    features: ['夜市灯会', '大雁塔', '夜景'], vehicles: ['apc']
  },
  {
    id: 'uestc', name: '电子科大 · 清水河', en: 'UESTC CAMPUS', icon: '🎓',
    tags: ['校园', '现代', '湖泊'], difficulty: '轻松',
    desc: '主楼、图书馆与清水河湖。银杏叶落满长椅，但今晚教学楼里有东西在游荡。',
    grad: ['#102a35', '#256b5e', '#b9c96a'], accent: '#6fd6a8',
    sky: 'day', season: 'autumn', weather: 'clear', seed: 30912,
    objective: '清理教学区，占领图书馆与主楼',
    features: ['清水河湖', '银杏大道', '无人机'], vehicles: ['drone']
  },
  {
    id: 'zh1z', name: '珠海一中', en: 'ZHUHAI NO.1', icon: '🏫',
    tags: ['校园', '青春', '操场'], difficulty: '轻松',
    desc: '红跑道、绿茵场、晚自习后的走廊。把僵尸赶出校园，别让上课铃再响一次。',
    grad: ['#122a1f', '#2f6d3f', '#d68a4a'], accent: '#f0a35e',
    sky: 'day', season: 'spring', weather: 'clear', seed: 77821,
    objective: '守住操场与学生宿舍，占领 3 处据点',
    features: ['标准跑道', '教学楼', '装甲车'], vehicles: ['apc']
  },
  {
    id: 'taiwan', name: '台湾 · 海峡战线', en: 'TAIWAN STRAIT', icon: '🌊',
    tags: ['海岛', '海战', '开放'], difficulty: '激战',
    desc: '海峡风急浪高。登上巡逻艇，击沉封锁港口的敌舰，再夺回安平古堡与山顶雷达站。',
    grad: ['#071f2e', '#146182', '#6fc5c9'], accent: '#63d8de',
    sky: 'dawn', season: 'summer', weather: 'clear', seed: 44519,
    objective: '击沉 2 艘敌舰，占领港口与古堡',
    features: ['海战', '巡逻艇', '海岛据点'], vehicles: ['boat']
  },
  {
    id: 'japan', name: '日本 · 富士战线', en: 'FUJI DEFENSE LINE', icon: '🗻',
    tags: ['大型', '军事', '海陆空'], difficulty: '激战',
    desc: '约 233×233 的大型战区：富士山下是霓虹都市，西侧是跑道、机库与导弹阵地，东南是军港。战斗机、坦克、导弹发射器全部可用。',
    grad: ['#071c24', '#1d5a68', '#dfb24c'], accent: '#6fe6ee',
    sky: 'day', season: 'spring', weather: 'clear', seed: 51027,
    objective: '夺取港口、防卫基地、雷达站与导弹阵地，击沉 2 艘敌舰',
    features: ['超大世界', '战斗机', '导弹阵地', '城市与军港'], vehicles: ['jet', 'tank', 'boat', 'car']
  }
];

/* ---------- 预置留言 ---------- */
MW.SAMPLE_MESSAGES = [
  { id: 'm1', author: '阿槑', text: '紫禁城的黄昏真的绝了，站在午门看过去像一张画。', time: '2026-10-21 19:22', likes: 32, channel: 'global' },
  { id: 'm2', author: '清水河摸鱼王', text: '图书馆三楼有把 AWM，谁捡到算谁的。', time: '2026-10-22 23:04', likes: 18, channel: 'global' },
  { id: 'm3', author: '长安夜行人', text: '能不能给灯笼加个开关？全城亮着睡不着。', time: '2026-10-24 01:17', likes: 7, channel: 'author' },
  { id: 'm4', author: '海边老船长', text: '巡逻艇手感不错，就是敌舰炮弹有点准。', time: '2026-10-25 16:40', likes: 11, channel: 'global' },
  { id: 'm5', author: '像素建筑师', text: 'AI 建造出来的大雁塔有点歪，建议加个“对齐”按钮。', time: '2026-10-27 10:08', likes: 25, channel: 'author' }
];

/* ---------- 默认设置 ---------- */
MW.DEFAULT_SETTINGS = {
  playerName: '旅行者',
  apiBase: 'https://api.deepseek.com',
  apiKey: '',
  model: 'deepseek-chat',
  webSearch: true,
  audio: true,
  graphics: 'high'
};

/* ---------- 掉落表 ---------- */
MW.DROP_WEAPONS = ['smg', 'rifle', 'shotgun', 'sniper', 'minigun', 'rpg'];
