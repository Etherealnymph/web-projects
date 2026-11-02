/* ===========================================================
   AI 世界建筑师
   - 本地结构图谱（无需联网）
   - DeepSeek/OpenAI 兼容 API 生成建筑
   - 维基百科联网检索参考资料与图片
   =========================================================== */
(function () {
  const MW = window.MW;

  const STYLES = {
    chinese: { wall: '#9d2f26', roof: '#d8a531', ridge: '#8a5a12', base: '#cfc7ae', accent: '#ffb347', glow: true },
    modern: { wall: '#cfc9bd', roof: '#8f959b', ridge: '#6b7278', base: '#b9b4a8', accent: '#6fc3d8', glow: true },
    neon: { wall: '#2b3550', roof: '#1b2236', ridge: '#0d1220', base: '#3a4666', accent: '#64f0ff', glow: true },
    wood: { wall: '#8a6b45', roof: '#6a4a2e', ridge: '#3f2c1b', base: '#9a7a4e', accent: '#ffb347', glow: false },
    stone: { wall: '#8d9297', roof: '#6f757a', ridge: '#4a4f53', base: '#9ea3a6', accent: '#d8a531', glow: false },
    sand: { wall: '#d8c48a', roof: '#b89a5a', ridge: '#8a6f3a', base: '#c9b078', accent: '#ffe0a0', glow: true }
  };

  function P(hex) { return MW.parseColor(hex, 0x888888); }
  function fill(x1, y1, z1, x2, y2, z2, c, t) {
    return { op: 'fill', a: [x1, y1, z1], b: [x2, y2, z2], c, t: t || 0 };
  }
  function ring(x1, y1, z1, x2, y2, z2, c) {
    return { op: 'ring', a: [x1, y1, z1], b: [x2, y2, z2], c };
  }
  function tree(x, y, z, h, leaf) {
    return { op: 'tree', a: [x, y, z], h: h || 5, c: leaf || '#4f9a3a' };
  }
  function lamp(x, y, z) {
    return { op: 'lamp', a: [x, y, z] };
  }

  /* ---------- 建筑模板（坐标相对锚点，y=0 为地面） ---------- */
  const TEMPLATES = {
    pagoda(S) {
      const ops = [];
      let size = 7, y = 0;
      ops.push(fill(-size - 2, 0, -size - 2, size + 2, 1, size + 2, S.base));
      for (let t = 0; t < 7; t++) {
        const s = Math.max(2, size - t);
        ops.push(fill(-s, y + 2, -s, s, y + 5, s, t % 2 ? '#b08a4a' : S.wall));
        ops.push(fill(-s - 2, y + 6, -s - 2, s + 2, y + 6, s + 2, t % 2 ? '#3f6b52' : S.roof));
        ops.push(fill(-s - 1, y + 7, -s - 1, s + 1, y + 7, s + 1, S.ridge));
        ops.push(fill(-1, y + 2, -s - 1, 1, y + 4, -s, '#2a211b'));
        y += 8;
        size -= 1;
      }
      ops.push(lamp(0, y, 0));
      return { ops, name: '七层宝塔' };
    },
    palace(S) {
      const ops = [];
      ops.push(fill(-20, 0, -14, 20, 2, 14, S.base));
      for (let i = 0; i < 3; i++) ops.push(fill(-4, -i, 15 + i, 4, -i, 15 + i, S.base));
      ops.push(fill(-16, 3, -10, 16, 5, 10, '#8f8774'));
      ops.push(ring(-16, 3, -10, 16, 11, 10, S.wall));
      for (let x = -12; x <= 12; x += 4) {
        ops.push(fill(x, 3, -10, x, 11, -10, '#6e241c'));
        ops.push(fill(x, 3, 10, x, 11, 10, '#6e241c'));
      }
      ops.push(fill(-2, 3, 10, 2, 6, 10, '#2a211b'));
      for (let i = 0; i < 5; i++) {
        ops.push(fill(-18 + i * 3, 12 + i, -12 + i * 2, 18 - i * 3, 12 + i, 12 - i * 2, i < 2 ? S.roof : S.ridge));
      }
      ops.push(fill(-3, 18, -1, 3, 18, 1, S.ridge));
      ops.push(lamp(-10, 8, 12));
      ops.push(lamp(10, 8, 12));
      for (const sx of [-1, 1]) {
        ops.push(fill(sx * 24 - 3, 0, -4, sx * 24 + 3, 5, 8, '#8a6b45'));
        ops.push(fill(sx * 24 - 4, 6, -5, sx * 24 + 4, 6, 9, S.roof));
      }
      return { ops, name: '中式宫殿' };
    },
    castle(S) {
      const ops = [];
      ops.push(fill(-12, 0, -12, 12, 0, 12, S.base));
      ops.push(ring(-11, 1, -11, 11, 6, 11, S.wall));
      ops.push(ring(-11, 7, -11, 11, 7, 11, S.ridge));
      for (let x = -11; x <= 11; x += 3) {
        ops.push(fill(x, 8, -11, x, 9, -11, S.wall));
        ops.push(fill(x, 8, 11, x, 9, 11, S.wall));
      }
      ops.push(fill(-2, 1, 11, 2, 5, 12, '#3a2a22'));
      for (const [x, z] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) {
        ops.push(fill(x - 2, 1, z - 2, x + 2, 11, z + 2, S.wall));
        ops.push(fill(x - 3, 12, z - 3, x + 3, 12, z + 3, S.roof));
      }
      ops.push(fill(-5, 1, -6, 5, 9, 3, '#b0a08a'));
      ops.push(fill(-6, 10, -7, 6, 10, 4, S.roof));
      ops.push(lamp(0, 7, 11));
      return { ops, name: '石砌城堡' };
    },
    bridge(S) {
      const ops = [];
      for (let x = -20; x <= 20; x++) {
        const y = Math.round(Math.sin((x / 20 + 1) * Math.PI) * 5);
        ops.push(fill(x, y, -4, x, y, 4, '#a8a29a'));
        ops.push(fill(x, y + 1, -4, x, y + 1, -4, '#8a6b45'));
        ops.push(fill(x, y + 1, 4, x, y + 1, 4, '#8a6b45'));
        if (Math.abs(x) % 8 === 0) ops.push(fill(x, 0, -3, x, Math.max(0, y - 1), 3, '#8d9297'));
      }
      ops.push(lamp(-16, 1, -4), lamp(16, 1, -4));
      return { ops, name: '石拱桥' };
    },
    pyramid(S) {
      const ops = [];
      let half = 12;
      for (let y = 0; y <= 12; y++) {
        ops.push(fill(-half, y, -half, half, y, half, y % 2 ? '#d8c48a' : '#c9b078'));
        if (y % 3 === 2) half -= 1;
      }
      ops.push(fill(-1, 13, -1, 1, 13, 1, '#ffe0a0'));
      return { ops, name: '金字塔' };
    },
    house(S) {
      const ops = [];
      ops.push(fill(-7, 0, -6, 7, 0, 6, '#8f8574'));
      ops.push(ring(-6, 1, -5, 6, 5, 5, S.wall));
      ops.push(fill(-2, 1, 5, 2, 4, 5, '#4a3420'));
      for (const x of [-5, 5]) for (const z of [-2, 2]) ops.push(fill(x, 2, z, x, 3, z, '#2a211b'));
      for (let i = 0; i < 4; i++) ops.push(fill(-7 + i, 6 + i, -7 + i, 7 - i, 6 + i, 7 - i, S.roof));
      ops.push(fill(-1, 12, -1, 1, 13, 1, '#6a4a2e'));
      ops.push(fill(3, 8, 2, 4, 11, 3, '#9a9180'));
      ops.push(tree(-11, 0, 6, 5, '#4f9a3a'), tree(10, 0, -7, 4, '#4f9a3a'));
      ops.push(lamp(-8, 0, 6));
      return { ops, name: '林间小屋' };
    },
    fountain(S) {
      const ops = [];
      for (let x = -8; x <= 8; x++) for (let z = -8; z <= 8; z++) {
        const d = Math.sqrt(x * x + z * z);
        if (d > 8) continue;
        if (d > 6.5) ops.push(fill(x, 0, z, x, 1, z, '#c6bda9'));
        else ops.push(fill(x, 0, z, x, 0, z, '#2f7fa8'));
      }
      ops.push(fill(-1, 0, -1, 1, 4, 1, '#c6bda9'));
      ops.push(fill(-2, 5, -2, 2, 5, 2, '#b1a692'));
      ops.push(lamp(0, 6, 0));
      for (const [x, z] of [[-10, 0], [10, 0], [0, -10], [0, 10]]) ops.push(tree(x, 0, z, 4, '#4f9a3a'));
      return { ops, name: '中央喷泉' };
    },
    stadium(S) {
      const ops = [];
      for (let x = -22; x <= 22; x++) for (let z = -14; z <= 14; z++) {
        const d = Math.max(Math.abs(x) / 22, Math.abs(z) / 14);
        if (d > 1) continue;
        ops.push(fill(x, 0, z, x, 0, z, d > 0.62 ? '#a8422f' : '#4f8f3e'));
        if (d > 0.62 && (Math.abs(d - 0.68) < 0.012 || Math.abs(d - 0.78) < 0.012 || Math.abs(d - 0.9) < 0.012)) {
          ops.push(fill(x, 0, z, x, 0, z, '#e7e2d6'));
        }
      }
      ops.push(fill(-22, 1, -14, 22, 1, -13, '#8f959b'));
      ops.push(fill(-22, 1, 13, 22, 1, 14, '#8f959b'));
      ops.push(fill(-2, 1, -14, 2, 3, -14, '#eeeeee'));
      return { ops, name: '标准体育场' };
    },
    modern(S) {
      const ops = [];
      const floors = 6;
      for (let f = 0; f < floors; f++) {
        const y = f * 4;
        ops.push(fill(-10, y, -8, 10, y, 8, '#8f8b82'));
        ops.push(ring(-10, y + 1, -8, 10, y + 3, 8, f % 2 ? S.wall : '#6fa6bd'));
        for (let x = -7; x <= 7; x += 3) {
          ops.push(fill(x, y + 1, -8, x, y + 2, -8, S.accent));
          ops.push(fill(x, y + 1, 8, x, y + 2, 8, S.accent));
        }
      }
      ops.push(fill(-10, floors * 4, -8, 10, floors * 4, 8, S.roof));
      ops.push(fill(-4, 1, 8, 4, 4, 8, '#2a2e33'));
      ops.push(fill(-4, 4, 8, 4, 4, 9, '#3f4a52'));
      ops.push(lamp(0, 1, 10));
      for (const [x, z] of [[-14, 10], [14, 10], [-14, -10], [14, -10]]) ops.push(tree(x, 0, z, 5, '#4f9a3a'));
      return { ops, name: '现代教学楼' };
    },
    skyscraper(S) {
      const ops = [];
      for (let f = 0; f < 14; f++) {
        const y = f * 4;
        const half = f > 10 ? 6 : 8;
        ops.push(fill(-half, y, -half, half, y, half, '#3a4149'));
        ops.push(ring(-half, y + 1, -half, half, y + 3, half, f % 2 ? S.wall : '#4a7f92'));
        ops.push(ring(-half, y + 1, -half, half, y + 1, half, S.accent));
      }
      ops.push(fill(-8, 56, -8, 8, 56, 8, S.roof));
      ops.push(fill(-1, 57, -1, 1, 62, 1, '#9aa3a8'));
      ops.push(lamp(0, 63, 0));
      ops.push(fill(-8, 1, 8, 8, 3, 8, '#2a2e33'));
      return { ops, name: '赛博大厦' };
    },
    wall(S) {
      const ops = [];
      for (let x = -24; x <= 24; x++) {
        const z = Math.round(Math.sin(x / 7) * 3);
        ops.push(fill(x, 0, z - 2, x, 5, z + 2, S.wall));
        ops.push(fill(x, 6, z - 2, x, 6, z + 2, S.ridge));
        if (x % 3 === 0) ops.push(fill(x, 7, z - 2, x, 8, z - 2, S.wall));
      }
      ops.push(fill(-2, 0, -2, 2, 4, 4, '#3a2a22'));
      ops.push(lamp(-20, 7, -2), lamp(0, 7, 0), lamp(20, 7, 2));
      return { ops, name: '长城关隘' };
    },
    park(S) {
      const ops = [];
      ops.push(fill(-14, 0, -10, 14, 0, 10, '#6f9e42'));
      ops.push(fill(-14, 0, -1, 14, 0, 2, '#b8ae98'));
      for (let x = -12; x <= 12; x += 6) {
        ops.push(tree(x, 0, -6, 5 + (x % 3), '#4f9a3a'));
        ops.push(tree(x, 0, 6, 4 + (x % 2), '#4f9a3a'));
      }
      ops.push(fill(-2, 0, -2, 2, 1, 2, '#9a9180'));
      ops.push(lamp(0, 1, 0));
      for (const x of [-8, 8]) {
        ops.push(fill(x, 1, -1, x + 3, 1, 1, '#8a6b45'));
        ops.push(fill(x, 2, 1, x + 3, 2, 1, '#8a6b45'));
      }
      return { ops, name: '城市公园' };
    },
    statue(S) {
      const ops = [];
      ops.push(fill(-4, 0, -4, 4, 2, 4, '#9a9180'));
      ops.push(fill(-3, 3, -3, 3, 3, 3, '#8a8272'));
      ops.push(fill(-1, 4, -1, 1, 8, 1, '#b8b0a0'));
      ops.push(fill(-2, 9, -2, 2, 10, 2, '#c9c1b0'));
      ops.push(fill(-2, 11, -1, 2, 14, 1, '#b8b0a0'));
      ops.push(fill(-3, 13, -1, -2, 15, 1, '#b8b0a0'));
      ops.push(fill(3, 13, -1, 2, 15, 1, '#b8b0a0'));
      ops.push(lamp(-6, 0, 0), lamp(6, 0, 0));
      return { ops, name: '纪念雕像' };
    },
    ship(S) {
      const ops = [];
      ops.push(fill(-6, 0, -18, 6, 2, 18, '#8b949a'));
      ops.push(fill(-5, 3, -14, 5, 5, 12, '#6b747a'));
      ops.push(fill(-4, 4, -6, 4, 4, 5, '#8b949a'));
      ops.push(fill(-3, 6, 0, 3, 9, 5, '#a8b0b5'));
      ops.push(fill(-4, 10, 1, 4, 10, 6, '#c9d2d6'));
      ops.push(fill(0, 11, 3, 0, 15, 3, '#d8dde0'));
      ops.push(fill(-4, 3, 10, 4, 4, 12, '#5d666b'));
      ops.push(fill(0, 4, 13, 0, 5, 18, '#3a3f42'));
      ops.push(lamp(0, 5, -16));
      return { ops, name: '停泊战舰' };
    },
    garden(S) {
      const ops = [];
      for (let x = -16; x <= 16; x++) for (let z = -12; z <= 12; z++) {
        const d = Math.sqrt(x * x + z * z);
        if (d < 5) ops.push(fill(x, 0, z, x, 0, z, '#2f7fa8'));
        else if (d < 6) ops.push(fill(x, 0, z, x, 0, z, '#c6bda9'));
      }
      for (const [x, z] of [[-12, -6], [12, -8], [-10, 8], [11, 7], [-16, 0], [16, -2]]) {
        ops.push(tree(x, 0, z, 5, '#4f9a3a'));
      }
      ops.push(fill(-2, 0, 8, 2, 5, 8, '#8a6b45'));
      ops.push(fill(-3, 6, 7, 3, 6, 9, S.roof));
      ops.push(lamp(0, 1, 0));
      ops.push(fill(-3, 0, -13, 3, 0, -8, '#b8ae98'));
      return { ops, name: '水景园林' };
    }
  };

  const KEYWORDS = [
    { keys: ['大雁塔', '宝塔', '塔', '佛塔'], template: 'pagoda' },
    { keys: ['紫禁城', '宫殿', '故宫', '太和殿', '中式', '古风'], template: 'palace' },
    { keys: ['城堡', '古堡', '堡垒', '碉堡'], template: 'castle' },
    { keys: ['桥', '拱桥'], template: 'bridge' },
    { keys: ['金字塔'], template: 'pyramid' },
    { keys: ['别墅', '小屋', '木屋', '房子', '住宅'], template: 'house' },
    { keys: ['喷泉'], template: 'fountain' },
    { keys: ['体育场', '操场', '球场', '跑道'], template: 'stadium' },
    { keys: ['教学楼', '图书馆', '学校', '大楼', '建筑'], template: 'modern' },
    { keys: ['摩天楼', '大厦', '高楼', '赛博', '霓虹'], template: 'skyscraper' },
    { keys: ['长城', '城墙', '关隘'], template: 'wall' },
    { keys: ['公园', '花园', '绿地'], template: 'park' },
    { keys: ['雕像', '纪念碑', '塑像'], template: 'statue' },
    { keys: ['战舰', '军舰', '驱逐舰'], template: 'ship' },
    { keys: ['园林', '庭院', '水景'], template: 'garden' }
  ];

  class Architect {
    constructor(game) {
      this.game = game;
      this.queue = [];
      this.total = 0;
      this.done = 0;
      this.busy = false;
      this.buildSoundT = 0;
      this.lastOps = null;
    }

    styleFor(prompt, webText) {
      const s = (prompt + ' ' + (webText || '')).toLowerCase();
      if (/赛博|未来|霓虹|科技/.test(s)) return STYLES.neon;
      if (/中式|古风|宫殿|紫禁|唐|汉|红墙|金瓦|塔|宫|殿|阁|亭|寺|庙|长城|城墙/.test(s)) return STYLES.chinese;
      if (/沙漠|埃及|金字|沙/.test(s)) return STYLES.sand;
      if (/木|森林|乡村|田园/.test(s)) return STYLES.wood;
      if (/军事|堡垒|石|城墙/.test(s)) return STYLES.stone;
      return STYLES.modern;
    }

    pickTemplate(prompt, webText) {
      const s = prompt + ' ' + (webText || '');
      for (const k of KEYWORDS) {
        if (k.keys.some(w => s.includes(w))) return { id: k.template, match: k.keys.find(w => s.includes(w)) };
      }
      return { id: 'house', match: null };
    }

    async generate(request) {
      if (this.busy) {
        this.game.ui.aiLog('system', '正在建造中，请稍候……');
        return;
      }
      request = (request || '').trim();
      if (!request) {
        this.game.ui.aiLog('system', '先告诉我你想建什么，例如「建一座大雁塔」。');
        return;
      }
      this.busy = true;
      this.game.ui.setAiBusy(true);
      this.game.ui.aiLog('user', request);
      this.game.ui.aiLog('system', '正在理解需求并勘察地形……');

      let webInfo = null;
      const tpl = this.pickTemplate(request, '');
      const keyword = tpl.match || this.extractSubject(request);
      if (this.game.settings.webSearch && keyword) {
        this.game.ui.aiLog('system', `联网检索「${keyword}」的参考资料……`);
        webInfo = await this.lookup(keyword);
        if (webInfo) {
          this.game.ui.aiLog('source', `已检索到「${webInfo.title}」：${webInfo.extract.slice(0, 120)}…`);
          this.game.ui.aiImage(webInfo.image);
        } else {
          this.game.ui.aiLog('system', '联网资料不可用，改用本地世界图谱。');
        }
      }

      let plan = null;
      let reply = '';
      if (this.game.settings.apiKey) {
        this.game.ui.aiLog('system', '调用大模型规划建筑结构……');
        try {
          const out = await this.callAPI(request, webInfo);
          if (out && out.ops && out.ops.length) {
            plan = out;
            reply = out.reply || '';
          } else if (out && out.reply) {
            reply = out.reply;
          }
        } catch (e) {
          console.warn('AI API 失败', e);
          this.game.ui.aiLog('system', `API 调用失败：${e.message}，改用本地建筑师。`);
        }
      }

      if (!plan) {
        const selected = this.pickTemplate(request, webInfo ? webInfo.extract : '');
        const style = this.styleFor(request, webInfo ? webInfo.extract : '');
        const builder = TEMPLATES[selected.id] || TEMPLATES.house;
        const built = builder(style);
        plan = { ops: built.ops, reply: `本地建筑师采用了「${built.name}」方案。` };
        if (!reply) reply = `${built.name}已就位。${webInfo ? '结合了联网检索到的资料。' : ''}`;
      }

      // 锚点：玩家前方 20 格（海面世界自动寻找最近的陆地）
      const p = this.game.player;
      let ax = Math.round(p.pos.x - Math.sin(p.yaw) * 20);
      let az = Math.round(p.pos.z - Math.cos(p.yaw) * 20);
      const wl = this.game.world.meta.waterLevel;
      if (wl != null) {
        let found = false;
        for (let r = 0; r <= 26 && !found; r += 2) {
          for (let a = 0; a < 12; a++) {
            const ang = a / 12 * Math.PI * 2;
            const tx = Math.round(ax + Math.cos(ang) * r);
            const tz = Math.round(az + Math.sin(ang) * r);
            if (this.game.world.surfaceAt(tx, tz) > wl + 0.6) {
              ax = tx; az = tz; found = true; break;
            }
          }
        }
      }
      let ay = this.game.world.surfaceAt(ax, az);
      ay = Math.max(1, ay);
      const ops = this.normalizeOps(plan.ops, ax, ay, az);
      const clamped = ops.slice(0, 400);
      this.game.ui.aiLog('assistant', reply || '开始建造。');
      this.queue = [];
      for (const op of clamped) this.queueOp(op);
      this.total = this.queue.length;
      this.done = 0;
      this.game.ui.aiSetProgress(0, this.total);
      this.lastOps = clamped;
      this.busy = false;
      this.game.ui.setAiBusy(false);
      if (!this.total) {
        this.game.ui.aiLog('system', '这个方案没有产生有效方块，换个描述试试。');
      } else {
        this.game.ui.toast(`AI 建造：${this.total} 个方块`, 'good');
        MW.SFX.build();
      }
    }

    extractSubject(text) {
      const m = text.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,12}(塔|楼|城|桥|殿|宫|馆|场|园|屋|堡)/);
      return m ? m[0] : null;
    }

    normalizeOps(ops, ox, oy, oz) {
      const out = [];
      for (const op of ops || []) {
        if (!op || !op.op) continue;
        if (op.op === 'fill' || op.op === 'ring' || op.op === 'clear') {
          const a = op.a, b = op.b;
          if (!Array.isArray(a) || !Array.isArray(b)) continue;
          const lim = 48;
          const a2 = [MW.clamp(Math.round(a[0]), -lim, lim), MW.clamp(Math.round(a[1]), -2, 48), MW.clamp(Math.round(a[2]), -lim, lim)];
          const b2 = [MW.clamp(Math.round(b[0]), -lim, lim), MW.clamp(Math.round(b[1]), -2, 48), MW.clamp(Math.round(b[2]), -lim, lim)];
          out.push({
            op: op.op, a: [a2[0] + ox, a2[1] + oy, a2[2] + oz],
            b: [b2[0] + ox, b2[1] + oy, b2[2] + oz],
            c: MW.parseColor(op.c, 0x9a9180), t: op.t || 0
          });
        } else if (op.op === 'tree' || op.op === 'lamp') {
          const a = op.a;
          if (!Array.isArray(a)) continue;
          out.push({
            op: op.op, a: [MW.clamp(Math.round(a[0]), -48, 48) + ox, MW.clamp(Math.round(a[1] || 0), -2, 40) + oy, MW.clamp(Math.round(a[2]), -48, 48) + oz],
            h: MW.clamp(op.h || 5, 2, 12), c: MW.parseColor(op.c, 0x4f9a3a)
          });
        }
      }
      // 起点附近不要挡住玩家
      return out;
    }

    queueOp(op) {
      const w = this.game.world;
      if (op.op === 'fill' || op.op === 'ring') {
        const [x1, y1, z1] = op.a, [x2, y2, z2] = op.b;
        const ax = Math.min(x1, x2), bx = Math.max(x1, x2);
        const ay = Math.min(y1, y2), by = Math.max(y1, y2);
        const az = Math.min(z1, z2), bz = Math.max(z1, z2);
        for (let x = ax; x <= bx; x++) for (let z = az; z <= bz; z++) for (let y = ay; y <= by; y++) {
          if (op.op === 'ring' && !(x === ax || x === bx || z === az || z === bz)) continue;
          this.queue.push({ x, y, z, c: op.c, t: op.t || 0 });
          if (this.queue.length > 14000) return;
        }
      } else if (op.op === 'tree') {
        const [x, y, z] = op.a, h = op.h || 5;
        for (let i = 0; i < h; i++) this.queue.push({ x, y: y + i, z, c: 0x6b4a2c, t: 0 });
        for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 0; dy <= 3; dy++) {
          if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy - 1) > 3.4) continue;
          this.queue.push({ x: x + dx, y: y + h - 2 + dy, z: z + dz, c: op.c, t: MW.BLOCK_TYPES.LEAF });
        }
      } else if (op.op === 'lamp') {
        const [x, y, z] = op.a;
        for (let i = 0; i < 4; i++) this.queue.push({ x, y: y + i, z, c: 0x4a3a2a, t: 0 });
        this.queue.push({ x, y: y + 4, z, c: 0xffb347, t: MW.BLOCK_TYPES.GLOW });
      } else if (op.op === 'clear') {
        const [x1, y1, z1] = op.a, [x2, y2, z2] = op.b;
        for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
          for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++)
            for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
              if (this.game.world.isSolid(x, y, z)) this.queue.push({ x, y, z, remove: true });
            }
      }
    }

    update(dt) {
      if (!this.queue.length) return;
      this.buildSoundT -= dt;
      const budget = 420;
      let n = 0;
      while (this.queue.length && n < budget) {
        const b = this.queue.shift();
        n++; this.done++;
        if (b.remove) this.game.world.remove(b.x, b.y, b.z);
        else this.game.world.set(b.x, b.y, b.z, b.c, b.t, true);
        if (Math.random() < 0.006) {
          this.game.combat.spark(new THREE.Vector3(b.x + 0.5, b.y + 1, b.z + 0.5), 0xffd27a, 1);
        }
      }
      if (this.buildSoundT <= 0) {
        this.buildSoundT = 0.18;
        MW.SFX.build();
      }
      const pct = this.total ? this.done / this.total : 0;
      this.game.ui.aiSetProgress(pct, this.total - this.done);
      if (!this.queue.length) {
        this.game.ui.aiLog('system', `建造完成，共放置 ${this.total} 个方块。`);
        this.game.ui.toast('建筑完成！', 'good');
        this.game.ui.aiSetProgress(1, 0);
        this.game.saveLater();
      }
    }

    /* ---------- 大模型 API ---------- */
    async callAPI(userPrompt, webInfo) {
      const apiBase = (this.game.settings.apiBase || '').replace(/\/+$/, '');
      if (!apiBase) throw new Error('未配置 API 地址');
      const system = this.game.skillPrompt || `你是《迷你世界·像素宇宙》的世界建筑师。
请把用户的需求转成像素建筑，只输出 JSON，格式：
{"reply":"一句话说明","ops":[{"op":"fill","a":[x1,y1,z1],"b":[x2,y2,z2],"c":"#rrggbb"},{"op":"tree","a":[x,y,z],"h":5},{"op":"lamp","a":[x,y,z]}]}
坐标相对玩家前方 15 格的地基中心，y=0 是地面，x/z 范围 -30..30，y 范围 0..30，方块总数不超过 3500。
建筑要完整、有屋顶、门、窗或装饰。只输出 JSON，不要 markdown。`;
      const context = webInfo ? `\n参考资料（来自维基百科）：${webInfo.extract}\n` : '';
      const body = {
        model: this.game.settings.model || 'deepseek-chat',
        temperature: 0.85,
        max_tokens: 2600,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `需求：${userPrompt}\n${context}\n请生成建筑 JSON。` }
        ]
      };
      if (/deepseek|openai/i.test(apiBase)) body.response_format = { type: 'json_object' };
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 45000);
      let res;
      try {
        res = await fetch(apiBase + '/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + this.game.settings.apiKey
          },
          body: JSON.stringify(body),
          signal: ctrl.signal
        });
      } finally { clearTimeout(timer); }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const text = data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content : '';
      const parsed = this.extractJSON(text);
      if (!parsed) throw new Error('模型未返回有效 JSON');
      return parsed;
    }

    extractJSON(text) {
      if (!text) return null;
      let s = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      try { return JSON.parse(s); } catch (e) {}
      const start = s.indexOf('{');
      const end = s.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try { return JSON.parse(s.slice(start, end + 1)); } catch (e) {}
      }
      return null;
    }

    /* ---------- 通用 JSON 对话（供模型工坊使用） ---------- */
    async askJSON(system, user) {
      const apiBase = (this.game.settings.apiBase || '').replace(/\/+$/, '');
      if (!apiBase || !this.game.settings.apiKey) throw new Error('未配置 API');
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 45000);
      let res;
      try {
        res = await fetch(apiBase + '/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + this.game.settings.apiKey
          },
          body: JSON.stringify({
            model: this.game.settings.model || 'deepseek-chat',
            temperature: 0.9,
            max_tokens: 1400,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user }
            ]
          }),
          signal: ctrl.signal
        });
      } finally { clearTimeout(timer); }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const text = data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content : '';
      const parsed = this.extractJSON(text);
      if (!parsed) throw new Error('模型没有返回 JSON');
      return parsed;
    }

    /* ---------- 维基百科检索 ---------- */
    async lookup(keyword) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3800);
        const url = 'https://zh.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&exintro=1&explaintext=1&piprop=thumbnail&pithumbsize=520&redirects=1&format=json&origin=*&titles=' + encodeURIComponent(keyword);
        const req = fetch(url, { signal: ctrl.signal, mode: 'cors' }).catch(() => null);
        const timeout = new Promise(resolve => setTimeout(() => resolve(null), 4000));
        const res = await Promise.race([req, timeout]);
        clearTimeout(timer);
        if (!res || !res.ok) return null;
        const data = await res.json();
        const pages = data.query && data.query.pages ? Object.values(data.query.pages) : [];
        const page = pages[0];
        if (!page || !page.extract) return null;
        return {
          title: page.title,
          extract: page.extract,
          image: page.thumbnail ? page.thumbnail.source : null
        };
      } catch (e) {
        console.warn('联网检索失败', e);
        return null;
      }
    }
  }

  MW.Architect = Architect;
})();
