/* ===========================================================
   UI 控制器
   =========================================================== */
(function () {
  const MW = window.MW;

  const DIR_NAMES = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  const LOAD_QUOTES = [
    '“先搭一座桥，再考虑要不要过河。”',
    '“世界不是被发现的，是被一块一块放上去的。”',
    '“在像素里，黄昏可以永远不结束。”',
    '“所有伟大的城市，都从一块石头开始。”',
    '“别忘了在离开的地方留一张便签。”'
  ];

  class UI {
    constructor(game) {
      this.g = game;
      this.panel = null;
      this.toastTimers = [];
      this.minimapT = 0;
      this.compassT = 0;
      this.vitalsT = 0;
      this.hitTimer = null;
      this.aiImageTimer = null;
      this.selectedWeapon = 'pistol';
      this.selectedCharacter = { name: '旅行者', spec: Object.assign({}, MW.CHARACTERS.player) };
      this.characterSkins = MW.store.get('customCharacters', []);
      if (!Array.isArray(this.characterSkins)) this.characterSkins = [];
      this.menuDots = [];
      this.menuCubes = [];
      this.workshop = null;
      this.lastCrosshair = '';
    }

    $(id) { return document.getElementById(id); }

    init() {
      this.buildWorldCards();
      this.initMenuCanvas();
      this.bindMenu();
      this.bindHud();
      this.bindPanels();
      this.bindForms();
      this.renderBuildColors();
      this.updateName();
      this.setWeather(MW.WEATHERS[0]);
      this.setSeason(MW.SEASONS[2]);
      this.fillSettings();
      this.renderMessages();
      this.renderNotes();
      this.initWorkshop();
      this.menuLoop();
      this.aiLog('system', '你好，我是世界建筑师。告诉我你想建什么——比如「建一座大雁塔」「盖一栋玻璃幕墙图书馆」。建筑会出现在你前方 20 格。');

      document.addEventListener('pointerdown', () => MW.SFX.init(), { once: true });
      window.addEventListener('resize', () => this.resizeMenuCanvas());
    }

    /* =======================================================
       菜单
       ======================================================= */
    buildWorldCards() {
      const grid = this.$('world-grid');
      if (!grid) return;
      grid.innerHTML = '';
      [...MW.WORLDS].sort((a,b)=>Number(['beijing','washington','tokyo','earth'].includes(b.id))-Number(['beijing','washington','tokyo','earth'].includes(a.id))).forEach((w, i) => {
        const el = document.createElement('button');
        el.className = 'world-card';
        el.dataset.world = w.id;
        el.dataset.icon = w.icon;
        el.style.setProperty('--g1', w.grad[0]);
        el.style.setProperty('--g2', w.grad[1]);
        el.style.setProperty('--g3', w.grad[2]);
        el.innerHTML = `
          <div class="wc-top">
            <span class="wc-index">W.${String(i + 1).padStart(2, '0')}</span>
            <span class="wc-diff">${MW.escapeHtml(w.difficulty)}</span>
          </div>
          <h4>${MW.escapeHtml(w.name)}</h4>
          <span class="wc-en">${MW.escapeHtml(w.en)}</span>
          <div class="wc-bottom">
            ${w.tags.map(t => `<span class="wc-tag">${MW.escapeHtml(t)}</span>`).join('')}
            <span class="wc-go">进入 →</span>
          </div>`;
        el.addEventListener('click', () => {
          if (el.classList.contains('loading')) return;
          MW.SFX.init();
          MW.SFX.click();
          el.classList.add('loading');
          this.g.startWorld(w.id);
          setTimeout(() => el.classList.remove('loading'), 8000);
        });
        grid.appendChild(el);
      });
      const last = this.g.lastWorldId;
      const cont = this.$('btn-continue');
      if (cont) cont.disabled = !last;
      const status = this.$('menu-status');
      if (status) status.textContent = last ? `上次存档：${this.worldName(last)}` : '系统就绪 · 选择一张世界卡片';
    }

    worldName(id) {
      const w = MW.WORLDS.find(x => x.id === id);
      if (w) return w.name;
      const save = MW.store.get('save_' + id, null);
      return save && save.name ? save.name : '导入的世界';
    }

    bindMenu() {
      const play = this.$('btn-play');
      if (play) play.addEventListener('click', () => {
        MW.SFX.init(); MW.SFX.click();
        const grid = document.querySelector('.worlds');
        if (grid) {
          grid.scrollIntoView({ behavior: 'smooth', block: 'center' });
          document.querySelectorAll('.world-card').forEach(c => {
            c.style.transition = 'box-shadow .3s';
            c.style.boxShadow = '0 0 0 1px var(--orange), 0 0 34px rgba(255,157,60,.25)';
            setTimeout(() => { c.style.boxShadow = ''; }, 900);
          });
        }
      });
      const cont = this.$('btn-continue');
      if (cont) cont.addEventListener('click', () => {
        MW.SFX.init(); MW.SFX.click();
        const id = this.g.lastWorldId || MW.WORLDS[0].id;
        this.g.startWorld(id);
      });
      const imp = this.$('btn-import-menu');
      if (imp) imp.addEventListener('click', () => this.$('file-world').click());
      const sample = this.$('btn-sample-world');
      if (sample) sample.addEventListener('click', () => { MW.SFX.init(); MW.SFX.click(); this.g.loadSampleWorld(); });
      const set = this.$('btn-settings-menu');
      if (set) set.addEventListener('click', () => { MW.SFX.init(); this.g.openPanel('settings'); });
      const help = this.$('btn-help-menu');
      if (help) help.addEventListener('click', () => { MW.SFX.init(); this.g.openPanel('help'); });
      const help2 = this.$('btn-help-menu2');
      if (help2) help2.addEventListener('click', () => this.g.openPanel('help'));
    }

    initMenuCanvas() {
      this.menuCanvas = this.$('menu-canvas');
      if (!this.menuCanvas) return;
      this.menuCtx = this.menuCanvas.getContext('2d');
      this.resizeMenuCanvas();
      this.menuDots = [];
      for (let i = 0; i < 70; i++) {
        this.menuDots.push({
          x: Math.random(), y: Math.random(),
          s: Math.random() * 2 + 0.5,
          sp: Math.random() * 0.00012 + 0.00003,
          a: Math.random() * 0.5 + 0.1,
          c: Math.random() < 0.65 ? '255,180,110' : '94,234,212'
        });
      }
      this.menuCubes = [
        { x: 0.09, y: 0.68, s: 26, sp: 0.00018, ph: 0, c: '255,170,90' },
        { x: 0.2, y: 0.8, s: 14, sp: 0.00025, ph: 2, c: '255,200,130' },
        { x: 0.86, y: 0.7, s: 38, sp: 0.00013, ph: 4, c: '94,234,212' },
        { x: 0.74, y: 0.86, s: 18, sp: 0.00021, ph: 1, c: '94,234,212' },
        { x: 0.5, y: 0.9, s: 22, sp: 0.00016, ph: 3, c: '255,170,90' }
      ];
    }

    resizeMenuCanvas() {
      if (!this.menuCanvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = this.menuCanvas.clientWidth || window.innerWidth;
      const h = this.menuCanvas.clientHeight || window.innerHeight;
      this.menuCanvas.width = Math.floor(w * dpr);
      this.menuCanvas.height = Math.floor(h * dpr);
      this.menuCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.menuW = w; this.menuH = h;
    }

    drawIsoCube(ctx, x, y, s, color, alpha) {
      const h = s * 0.55;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = `rgba(${color},${alpha})`;
      ctx.lineWidth = 1;
      // 顶面
      ctx.beginPath();
      ctx.moveTo(x, y - h); ctx.lineTo(x + s, y); ctx.lineTo(x, y + h); ctx.lineTo(x - s, y); ctx.closePath();
      ctx.fillStyle = `rgba(${color},0.05)`;
      ctx.fill(); ctx.stroke();
      // 左右侧面
      ctx.beginPath();
      ctx.moveTo(x - s, y); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h + s * 0.9); ctx.lineTo(x - s, y + s * 0.9); ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + s, y); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h + s * 0.9); ctx.lineTo(x + s, y + s * 0.9); ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    menuLoop() {
      const tick = () => {
        requestAnimationFrame(tick);
        const screen = this.$('start-screen');
        if (!screen || screen.classList.contains('hidden')) return;
        const now = performance.now();
        const ctx = this.menuCtx;
        if (!ctx || !this.menuW) return;
        ctx.clearRect(0, 0, this.menuW, this.menuH);
        for (const d of this.menuDots) {
          d.y -= d.sp * 16;
          if (d.y < -0.05) { d.y = 1.05; d.x = Math.random(); }
          const alpha = d.a * (0.6 + 0.4 * Math.sin(now * 0.001 + d.x * 10));
          ctx.fillStyle = `rgba(${d.c},${alpha})`;
          ctx.fillRect(d.x * this.menuW, d.y * this.menuH, d.s, d.s);
        }
        for (const c of this.menuCubes) {
          const bob = Math.sin(now * 0.0004 + c.ph) * 10;
          this.drawIsoCube(ctx, c.x * this.menuW, c.y * this.menuH + bob, c.s, c.c, 0.5);
        }
      };
      requestAnimationFrame(tick);
    }

    showMenu() {
      this.$('start-screen').classList.remove('hidden');
      this.buildWorldCards();
      this.resizeMenuCanvas();
      this.setSaveInfo('存档会自动保存到本机浏览器。');
    }

    hideMenu() { this.$('start-screen').classList.add('hidden'); }
    showHud() { this.$('hud').classList.remove('hidden'); }
    hideHud() { this.$('hud').classList.add('hidden'); }

    /* =======================================================
       加载
       ======================================================= */
    showLoading(title) {
      const el = this.$('loading');
      el.classList.remove('hidden');
      this.$('load-title').textContent = title ? `正在生成「${title}」` : '正在生成世界';
      this.$('load-sub').textContent = '搬运方块中……';
      this.$('load-quote').textContent = MW.pick(LOAD_QUOTES || ['“世界始于第一块石头。”']);
      this.setLoading(0, '0 方块');
    }

    setLoading(pct, label) {
      const p = MW.clamp(pct, 0, 100);
      this.$('load-progress').style.width = p.toFixed(1) + '%';
      this.$('load-percent').textContent = Math.round(p) + '%';
      if (label) this.$('load-sub').textContent = label;
      if (typeof label === 'string' && /方块/.test(label)) this.$('load-count').textContent = label;
    }

    hideLoading() { this.$('loading').classList.add('hidden'); }

    showFatal(msg) {
      const div = document.createElement('div');
      div.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#0b0e14;color:#fff;display:grid;place-items:center;text-align:center;padding:30px;font-family:sans-serif';
      div.innerHTML = `<div><h1 style="color:#ff9d3c">无法启动 3D 渲染</h1><p style="color:#8b97a7;max-width:480px;line-height:1.8">${MW.escapeHtml(msg || '请使用支持 WebGL 的现代浏览器，并确认已开启硬件加速。')}</p></div>`;
      document.body.appendChild(div);
    }

    /* =======================================================
       菜单 / HUD 事件
       ======================================================= */
    bindHud() {
      document.querySelectorAll('[data-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (this.g.state !== 'playing' || this.g.panelOpen) return;
          this.g.setMode(btn.dataset.mode);
        });
      });
      const weather = this.$('btn-weather');
      if (weather) weather.addEventListener('click', () => {
        if (this.g.state !== 'playing') return;
        this.g.cycleWeather();
      });
      const season = this.$('btn-season');
      if (season) season.addEventListener('click', () => {
        if (this.g.state !== 'playing') return;
        this.g.cycleSeason();
      });
      const dispatch = this.$('btn-dispatch');
      if (dispatch) dispatch.addEventListener('click', () => this.g.dispatchSquad());
      const bPlace = this.$('build-action-place');
      const bDestroy = this.$('build-action-destroy');
      if (bPlace) bPlace.addEventListener('click', () => this.g.setBuildAction('place'));
      if (bDestroy) bDestroy.addEventListener('click', () => this.g.setBuildAction('destroy'));
      const cbag = this.$('combat-bag');
      if (cbag) cbag.addEventListener('click', () => this.g.openPanel('inventory'));
    }

    openPanel(name) {
      this.closeAllDOM();
      const el = this.$('panel-' + name);
      if (!el) return;
      el.classList.remove('hidden');
      this.panel = name;
      document.querySelectorAll('.toolbar button').forEach(b => {
        b.classList.toggle('active', b.dataset.panel === name);
      });
      this.$('pointer-hint')?.classList.add('hidden');
      if (name === 'workshop') setTimeout(() => this.resizeWorkshop(), 30);
      if (name === 'ai') {
        setTimeout(() => this.$('ai-text')?.focus(), 60);
        this.updateAIStatus();
      }
      if (name === 'inventory') this.renderInventory();
      if (name === 'squad') this.renderSquadPanel();
      if (name === 'notes') { this.renderNotes(); this.renderMessages(); }
      if (name === 'settings') this.fillSettings();
      if (name === 'workshop') this.refreshWorkshop();
      if (name === 'map') setTimeout(() => this.drawWorldMap(), 20);
    }

    renderElevator(elevator) {
      if (!elevator) return;
      this.$('elevator-title').textContent = elevator.spec.name || '电梯';
      this.$('elevator-info').textContent = `${elevator.floors} 层 · 选择要前往的楼层`;
      const box = this.$('elevator-floors');
      box.innerHTML = '';
      const p = this.g.player;
      const cur = p ? Math.round((p.pos.y - elevator.spec.y - 1) / 4) : -1;
      for (let i = 0; i < elevator.floors; i++) {
        const b = document.createElement('button');
        b.textContent = `${i + 1}F`;
        if (i === cur) b.classList.add('current');
        b.addEventListener('click', () => this.g.rideElevator(i));
        box.appendChild(b);
      }
    }

    drawWorldMap() {      const g = this.g;
      if (!g || !g.world || !g.player) return;
      const canvas = this.$('world-map-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const w = g.world;
      const bounds = w.meta.bounds || w.bounds || 74;
      if (this.mapZoom == null) this.mapZoom = 1;
      if (!this.mapPan) this.mapPan = { x: 0, y: 0 };
      const base = (Math.min(W, H) - 42) / (bounds * 2 + 2);
      const scale = base * this.mapZoom;
      ctx.clearRect(0, 0, W, H);
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#0a151c');
      sky.addColorStop(1, '#081016');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W / 2 + this.mapPan.x, H / 2 + this.mapPan.y);
      ctx.scale(scale, scale);
      // 地图边界
      ctx.strokeStyle = 'rgba(150, 190, 205, .25)';
      ctx.lineWidth = 1 / scale;
      ctx.strokeRect(-bounds, -bounds, bounds * 2, bounds * 2);
      const wl = w.meta.waterLevel;
      for (let x = -bounds; x <= bounds; x++) {
        for (let z = -bounds; z <= bounds; z++) {
          const top = w.topMap.get(x + ',' + z);
          let c;
          if (top) {
            if (wl != null && top.y <= wl) c = '#17465e';
            else c = '#' + (top.c >>> 0).toString(16).padStart(6, '0');
          } else if (wl != null) {
            c = '#0d2d3e';
          } else {
            c = '#' + ((w.meta.fallbackColor != null ? w.meta.fallbackColor : 0x5c8a3e) >>> 0).toString(16).padStart(6, '0');
          }
          ctx.fillStyle = c;
          ctx.fillRect(x, z, 1.02, 1.02);
        }
      }
      // 据点
      for (const zo of g.zones) {
        ctx.beginPath();
        ctx.arc(zo.def.x, zo.def.z, Math.max(1.5, zo.def.r), 0, Math.PI * 2);
        ctx.strokeStyle = zo.captured ? '#67d391' : '#ffb347';
        ctx.lineWidth = Math.max(0.7, 1.1 / scale);
        ctx.stroke();
        ctx.fillStyle = zo.captured ? 'rgba(103,211,145,.18)' : 'rgba(255,179,71,.15)';
        ctx.fill();
        ctx.fillStyle = zo.captured ? '#b8f5cf' : '#ffd9a0';
        ctx.font = `${Math.max(0.8, 7 / scale)}px "Microsoft YaHei", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(zo.def.name, zo.def.x, zo.def.z - Math.max(1.5, zo.def.r * 0.55));
      }
      // 载具
      for (const v of g.vehicles) {
        if (v.dead) continue;
        ctx.fillStyle = '#9fe6a8';
        ctx.fillRect(v.pos.x - 1, v.pos.z - 1, 2, 2);
      }
      // 敌舰
      for (const s of g.ships) {
        if (s.dead) continue;
        ctx.fillStyle = '#ff5a4a';
        ctx.fillRect(s.pos.x - 2, s.pos.z - 2, 4, 4);
      }
      // 僵尸
      for (const z of g.zombies) {
        if (z.dead) continue;
        ctx.fillStyle = '#b56bff';
        ctx.fillRect(z.pos.x - 0.8, z.pos.z - 0.8, 1.6, 1.6);
      }
      // 玩家
      const p = g.player;
      ctx.save();
      ctx.translate(p.pos.x, p.pos.z);
      ctx.rotate(-p.yaw);
      ctx.beginPath();
      ctx.moveTo(0, -2.6);
      ctx.lineTo(1.7, 1.8);
      ctx.lineTo(0, 0.9);
      ctx.lineTo(-1.7, 1.8);
      ctx.closePath();
      ctx.fillStyle = '#7fd8ff';
      ctx.shadowColor = '#7fd8ff';
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.restore();
      ctx.restore();
      // 标注世界名与坐标
      ctx.fillStyle = 'rgba(232, 240, 246, .9)';
      ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
      ctx.fillText(w.meta.name || '世界', 18, 28);
      ctx.fillStyle = 'rgba(160, 180, 195, .65)';
      ctx.font = '11px monospace';
      ctx.fillText(`${Math.round(p.pos.x)}, ${Math.round(p.pos.z)}  ·  ${Math.round(this.mapZoom * 100)}%`, 18, 47);
    }

    bindMapEvents() {
      const canvas = this.$('world-map-canvas');
      if (!canvas) return;
      let dragging = false, lx = 0, ly = 0;
      canvas.addEventListener('wheel', e => {
        e.preventDefault();
        this.mapZoom = MW.clamp((this.mapZoom || 1) * Math.exp(-e.deltaY * 0.0012), 0.6, 4.5);
        this.drawWorldMap();
      }, { passive: false });
      canvas.addEventListener('pointerdown', e => {
        dragging = true; lx = e.clientX; ly = e.clientY;
        canvas.setPointerCapture(e.pointerId);
      });
      canvas.addEventListener('pointermove', e => {
        if (!dragging) return;
        this.mapPan.x += e.clientX - lx;
        this.mapPan.y += e.clientY - ly;
        lx = e.clientX; ly = e.clientY;
        this.drawWorldMap();
      });
      const stop = () => { dragging = false; };
      canvas.addEventListener('pointerup', stop);
      canvas.addEventListener('pointercancel', stop);
      this.$('map-zoom-in')?.addEventListener('click', () => { this.mapZoom = Math.min(4.5, (this.mapZoom || 1) * 1.3); this.drawWorldMap(); });
      this.$('map-zoom-out')?.addEventListener('click', () => { this.mapZoom = Math.max(0.6, (this.mapZoom || 1) / 1.3); this.drawWorldMap(); });
      this.$('map-reset')?.addEventListener('click', () => { this.mapZoom = 1; this.mapPan = { x: 0, y: 0 }; this.drawWorldMap(); });
    }

    closePanel(name) {
      const el = this.$('panel-' + (name || this.panel));
      if (el) el.classList.add('hidden');
      if (!name || name === this.panel) this.panel = null;
      document.querySelectorAll('.toolbar button').forEach(b => b.classList.remove('active'));
    }

    closeAllDOM() {
      document.querySelectorAll('.modal, .drawer').forEach(el => el.classList.add('hidden'));
      this.panel = null;
      document.querySelectorAll('.toolbar button').forEach(b => b.classList.remove('active'));
    }

    closeAll() {
      this.closeAllDOM();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    }

    bindPanels() {
      document.querySelectorAll('[data-panel]').forEach(btn => {
        btn.addEventListener('click', () => {
          const name = btn.dataset.panel;
          if (this.g.state === 'playing') this.g.openPanel(name);
          else if (name === 'settings' || name === 'help') this.g.openPanel(name);
        });
      });
      document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.g.closeAllPanels();
        });
      });
      document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('mousedown', e => {
          if (e.target !== modal) return;
          this.g.closeAllPanels();
        });
      });
      const noteTabs = this.$('note-tabs');
      if (noteTabs) noteTabs.addEventListener('click', e => {
        const btn = e.target.closest('button[data-tab]');
        if (!btn) return;
        noteTabs.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
        ['world', 'global', 'author'].forEach(t => {
          this.$('note-' + t).classList.toggle('hidden', t !== btn.dataset.tab);
        });
      });
      const wsTabs = this.$('workshop-tabs');
      if (wsTabs) wsTabs.addEventListener('click', e => {
        const btn = e.target.closest('button[data-tab]');
        if (!btn) return;
        wsTabs.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
        this.$('workshop-weapons').classList.toggle('hidden', btn.dataset.tab !== 'weapons');
        this.$('workshop-characters').classList.toggle('hidden', btn.dataset.tab !== 'characters');
      });
      this.bindMapEvents();
    }

    bindForms() {
      const aiForm = this.$('ai-form');
      if (aiForm) aiForm.addEventListener('submit', e => {
        e.preventDefault();
        const text = this.$('ai-text').value.trim();
        if (!text) return;
        this.$('ai-text').value = '';
        this.g.architect?.generate(text);
      });
      const aiText = this.$('ai-text');
      if (aiText) aiText.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.$('ai-form').dispatchEvent(new Event('submit', { cancelable: true }));
        }
      });
      document.querySelectorAll('#ai-chips button').forEach(btn => {
        btn.addEventListener('click', () => {
          if (!this.g.architect) return;
          this.g.architect.generate(btn.textContent);
        });
      });
      const webToggle = this.$('ai-web-toggle');
      if (webToggle) {
        webToggle.checked = !!this.g.settings.webSearch;
        webToggle.addEventListener('change', () => {
          this.g.settings.webSearch = webToggle.checked;
          MW.store.set('settings', this.g.settings);
          this.updateAIStatus();
        });
      }

      // 背包
      const invGrid = this.$('inv-grid');
      if (invGrid) invGrid.addEventListener('click', e => {
        const slot = e.target.closest('.inv-slot.filled');
        if (!slot) return;
        const id = slot.dataset.item;
        const def = MW.ITEMS[id];
        if (!def) return;
        if (def.kind === 'use') {
          if (this.g.player.useItem(id)) { this.renderInventory(); this.updateHUD(); }
        } else {
          this.toast(`${def.name} · ${def.desc || '可在战斗中使用'}`, 'info');
        }
      });
      const invWeapons = this.$('inv-weapons');
      if (invWeapons) invWeapons.addEventListener('click', e => {
        const row = e.target.closest('[data-widx]');
        if (!row) return;
        this.g.player.switchWeapon(Number(row.dataset.widx));
        this.renderInventory();
        this.updateWeapon();
      });

      // 小队
      this.$('btn-recruit')?.addEventListener('click', () => this.g.recruitSoldier());
      this.$('btn-dispatch-2')?.addEventListener('click', () => this.g.dispatchSquad());

      // 便签
      this.$('btn-add-note')?.addEventListener('click', () => {
        const ta = this.$('note-text');
        if (!ta) return;
        if (this.g.addWorldNote(ta.value)) { ta.value = ''; this.renderNotes(); }
      });
      const addMsg = (btnId, inputId, channel) => {
        const btn = this.$(btnId);
        if (!btn) return;
        btn.addEventListener('click', () => {
          const ta = this.$(inputId);
          const nameInput = this.$(channel === 'author' ? 'author-name' : 'msg-name');
          const name = nameInput && nameInput.value.trim() || this.g.settings.playerName;
          if (this.g.addMessage(channel, name, ta.value)) {
            ta.value = '';
            this.renderMessages();
          }
        });
      };
      addMsg('btn-add-msg', 'msg-text', 'global');
      addMsg('btn-add-author', 'author-text', 'author');
      const likeHandler = e => {
        const btn = e.target.closest('[data-like]');
        if (!btn) return;
        this.g.likeMessage(btn.dataset.like);
      };
      this.$('msg-list-global')?.addEventListener('click', likeHandler);
      this.$('msg-list-author')?.addEventListener('click', likeHandler);
      this.$('note-list')?.addEventListener('click', e => {
        const del = e.target.closest('[data-del-note]');
        if (del) { this.g.deleteNote(del.dataset.delNote); return; }
        const go = e.target.closest('[data-goto-note]');
        if (go) this.gotoNote(go.dataset.gotoNote);
      });
      this.$('btn-delete-note')?.addEventListener('click', () => {
        if (this.currentNote) this.g.deleteNote(this.currentNote.id);
      });

      // 设置
      this.$('btn-save-settings')?.addEventListener('click', () => { this.g.applySettingsFromUI(); this.g.closeAllPanels(); });
      this.$('btn-test-api')?.addEventListener('click', () => this.g.testAPI());
      this.$('btn-export-world')?.addEventListener('click', () => this.g.exportWorld());
      this.$('btn-import-world')?.addEventListener('click', () => this.$('file-world').click());
      this.$('btn-reset-world')?.addEventListener('click', () => this.g.resetWorldProgress());
      this.$('file-world')?.addEventListener('change', e => {
        const f = e.target.files && e.target.files[0];
        if (f) this.g.importWorldFile(f);
        e.target.value = '';
      });

      // 暂停 / 胜利
      this.$('btn-resume')?.addEventListener('click', () => this.g.closeAllPanels());
      this.$('btn-save-now')?.addEventListener('click', () => { this.g.saveProgress(); this.toast('世界已保存', 'good'); });
      this.$('btn-exit-menu')?.addEventListener('click', () => {
        this.g.returnToMenu();
      });
      this.$('btn-victory-continue')?.addEventListener('click', () => {
        this.hideVictory();
        this.g.panelOpen = null;
        this.g.paused = false;
        this.g.requestLock();
      });
      this.$('btn-victory-menu')?.addEventListener('click', () => {
        this.hideVictory();
        this.g.panelOpen = null;
        this.g.returnToMenu();
      });

      // 工坊
      this.$('btn-equip-weapon')?.addEventListener('click', () => this.g.equipWeapon(this.selectedWeapon));
      this.$('btn-export-weapon')?.addEventListener('click', () => this.g.exportWeapon(this.selectedWeapon));
      this.$('btn-import-weapon')?.addEventListener('click', () => this.$('file-weapon').click());
      this.$('file-weapon')?.addEventListener('change', async e => {
        const f = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!f) return;
        try {
          const data = JSON.parse(await MW.readFile(f));
          this.g.importWeaponData(data);
        } catch (err) { this.toast('导入失败：' + err.message, 'bad'); }
      });
      this.$('btn-ai-weapon')?.addEventListener('click', async () => {
        const input = this.$('model-ai-input');
        const v = input.value.trim();
        if (!v) { this.toast('先描述一下武器', 'bad'); return; }
        const btn = this.$('btn-ai-weapon');
        btn.disabled = true;
        btn.textContent = '生成中……';
        try {
          const def = await this.g.generateWeaponAI(v);
          if (def) { this.selectedWeapon = def.id; this.refreshWorkshop(); }
        } finally {
          btn.disabled = false;
          btn.textContent = '✦ AI 生成武器';
        }
      });
      this.$('btn-apply-character')?.addEventListener('click', () => {
        this.g.applyPlayerSkin(Object.assign({}, this.selectedCharacter.spec));
      });
      this.$('btn-export-character')?.addEventListener('click', () => {
        MW.download('character_' + (this.selectedCharacter.spec.name || 'skin') + '.json',
          JSON.stringify({ format: 'miniworld-character', version: 1, name: this.selectedCharacter.spec.name, ...this.selectedCharacter.spec }, null, 2));
        this.toast('人物模型已导出', 'good');
      });
      this.$('btn-import-character')?.addEventListener('click', () => this.$('file-character').click());
      this.$('file-character')?.addEventListener('change', async e => {
        const f = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!f) return;
        try {
          const data = JSON.parse(await MW.readFile(f));
          const spec = this.normalizeCharacter(data);
          this.characterSkins.push(spec);
          MW.store.set('customCharacters', this.characterSkins);
          this.selectedCharacter = { name: spec.name || '导入人物', spec };
          this.refreshWorkshop();
          this.toast('人物模型已导入', 'good');
        } catch (err) { this.toast('导入失败：' + err.message, 'bad'); }
      });
    }

    /* =======================================================
       世界信息 / HUD
       ======================================================= */
    setWorldInfo(meta, def) {
      const name = meta.name || def.name || '世界';
      const skyName = { day: '白昼', dusk: '黄昏', night: '夜晚', dawn: '黎明' }[meta.sky] || '';
      const tags = (def.tags || []).slice(0, 2).join(' · ');
      this.$('hud-world').textContent = name;
      this.$('hud-tagline').textContent = `${skyName}${tags ? ' · ' + tags : ''}`;
      this.$('mini-world').textContent = name;
      this.$('hud-objective').textContent = meta.objective || def.objective || '自由探索这个世界';
      document.title = `${name} · 迷你世界`;
      this.updateObjectives();
    }

    updateName() {
      const n = this.g.settings.playerName || '旅行者';
      this.$('hud-name').textContent = n;
      this.$('hud-avatar').textContent = n.slice(0, 1);
      const msgName = this.$('msg-name');
      const authorName = this.$('author-name');
      if (msgName && !msgName.value) msgName.value = n;
      if (authorName && !authorName.value) authorName.value = n;
    }

    updateHUD() {
      const p = this.g.player;
      if (!p) return;
      this.$('hud-name').textContent = this.g.settings.playerName;
      this.$('hud-avatar').textContent = (this.g.settings.playerName || '旅').slice(0, 1);
      this.$('hud-level').textContent = Math.max(1, 1 + Math.floor(p.kills / 8));
      this.$('hud-hp-fill').style.width = MW.clamp(p.health / p.maxHealth * 100, 0, 100) + '%';
      this.$('hud-hp-text').textContent = Math.ceil(p.health);
      this.$('hud-armor-fill').style.width = MW.clamp(p.armor, 0, 100) + '%';
      this.$('hud-coins').textContent = p.coins;
      this.$('hud-kills').textContent = `${p.kills} 击杀`;
      this.$('hud-backpack').textContent = `背包 ${p.usedSlots()}/${p.capacity}`;
      this.updateWeapon();
    }

    updateVitals() {
      const p = this.g.player;
      if (!p) return;
      this.$('hud-hp-fill').style.width = MW.clamp(p.health / p.maxHealth * 100, 0, 100) + '%';
      this.$('hud-hp-text').textContent = Math.ceil(p.health);
      this.$('hud-armor-fill').style.width = MW.clamp(p.armor, 0, 100) + '%';
      this.$('hud-coins').textContent = p.coins;
      const ch = this.$('crosshair');
      if (ch && p.reloading) ch.classList.add('reloading'); else if (ch) ch.classList.remove('reloading');
    }

    updateWeapon() {
      const p = this.g.player;
      if (!p) return;
      const w = p.weapon, def = p.weaponDef;
      this.$('hud-backpack').textContent = `背包 ${p.usedSlots()}/${p.capacity}`;
      if (!w || !def) {
        this.$('hud-weapon-name').textContent = '空手';
        this.$('hud-mag').textContent = '—';
        this.$('hud-reserve').textContent = '';
        this.$('hud-ammo-type').textContent = '';
        this.$('hud-weapon-desc').textContent = '在探索模式中寻找武器';
        this.$('weapon-belt').innerHTML = '';
        return;
      }
      this.$('hud-weapon-name').textContent = def.name;
      this.$('hud-mag').textContent = w.mag;
      this.$('hud-reserve').textContent = p.ammo[def.ammo] || 0;
      this.$('hud-ammo-type').textContent = { light: '5.56mm', heavy: '7.62mm', shell: '12 GA', rocket: 'RPG' }[def.ammo] || '';
      this.$('hud-weapon-desc').textContent = def.desc || '';
      const belt = this.$('weapon-belt');
      belt.innerHTML = '';
      p.weapons.forEach((ww, i) => {
        const d = MW.WEAPONS[ww.id];
        const slot = document.createElement('div');
        slot.className = 'slot' + (i === p.current ? ' active' : '');
        slot.innerHTML = `<b>${i + 1}</b><span>${MW.escapeHtml((d && d.short) || '?')}</span>`;
        slot.addEventListener('click', () => { p.switchWeapon(i); this.updateWeapon(); });
        belt.appendChild(slot);
      });
    }

    setMode(mode) {
      document.querySelectorAll('#mode-switch button').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === mode);
      });
      const ch = this.$('crosshair');
      if (ch) {
        ch.classList.remove('build', 'combat', 'explore', 'destroy');
        ch.classList.add(mode);
      }
      const hints = this.$('hud-hints');
      if (hints) {
        hints.textContent = mode === 'build'
          ? '左键放置 · 右键拆除 · 1–0 调色板 · [ ] 笔刷 · Z/C 切换模式'
          : mode === 'combat'
            ? '左键射击 · 右键瞄准 · R 换弹 · G 手雷 · M 地雷 · 1–7 武器 · E 交互'
            : 'WASD 移动 · 鼠标视角 · E 交互 · N 便签 · B AI 建造 · Esc 菜单';
      }
      this.buildBar(mode === 'build');
      const ck = this.$('combat-keys');
      if (ck) ck.classList.toggle('hidden', mode !== 'combat');
      if (mode !== 'combat') this.setScope(false);
    }

    setBuildAction(action) {
      const place = this.$('build-action-place');
      const destroy = this.$('build-action-destroy');
      if (place) place.classList.toggle('active', action !== 'destroy');
      if (destroy) destroy.classList.toggle('active', action === 'destroy');
      const cross = this.$('crosshair');
      if (cross) cross.classList.toggle('destroy', action === 'destroy');
      const hints = this.$('hud-hints');
      if (hints && this.g.mode === 'build') {
        hints.textContent = action === 'destroy'
          ? '左键摧毁 · 右键拆除 · F 切换为放置 · [ ] 笔刷 · Z/C 切换模式'
          : '左键放置 · 右键拆除 · F 切换为摧毁 · 1–0 调色板 · [ ] 笔刷';
      }
    }

    buildBar(show) {
      const bar = this.$('build-bar');
      if (!bar) return;
      bar.classList.toggle('hidden', !show);
      if (show) this.updateBrush();
    }

    renderBuildColors() {
      const wrap = this.$('build-colors');
      if (!wrap) return;
      wrap.innerHTML = '';
      (MW.BUILD_COLORS || []).forEach((c, i) => {
        const btn = document.createElement('button');
        btn.style.background = MW.hexToCss(c.c);
        btn.title = c.name;
        btn.dataset.color = String(i);
        btn.innerHTML = `<span>${i === 9 ? 0 : i + 1}</span>`;
        btn.addEventListener('click', () => this.g.setBuildColor(i));
        wrap.appendChild(btn);
      });
      this.updateBuildColors();
    }

    updateBuildColors() {
      document.querySelectorAll('#build-colors button').forEach(b => {
        b.classList.toggle('active', Number(b.dataset.color) === this.g.buildColorIndex);
      });
    }

    updateBrush() {
      const el = this.$('brush-size');
      if (el) el.textContent = `${this.g.buildBrush}×${this.g.buildBrush}×${this.g.buildBrush}`;
      this.updateBuildColors();
    }

    setWeather(def) {
      const btn = this.$('btn-weather');
      if (btn) btn.innerHTML = `${def.icon} <span>${def.name}</span> <kbd>T</kbd>`;
    }

    setSeason(def) {
      const btn = this.$('btn-season');
      if (btn) btn.innerHTML = `${def.icon} <span>${def.name}</span> <kbd>Y</kbd>`;
    }

    setInteract(label) {
      const el = this.$('interact-prompt');
      if (!el) return;
      if (!label) { el.classList.add('hidden'); return; }
      el.classList.remove('hidden');
      el.querySelector('span').textContent = label;
    }

    setIntro(on) {
      this.introActive = !!on;
      const ch = this.$('crosshair');
      if (ch) ch.classList.toggle('hidden', !!on);
      if (on) {
        const hint = this.$('pointer-hint');
        if (hint) hint.classList.add('hidden');
      }
    }

    setPointerLock(locked) {
      const hint = this.$('pointer-hint');
      if (hint) hint.classList.toggle('hidden', locked || !!this.g.panelOpen || this.g.state !== 'playing');
      const canvas = this.g.canvas;
      if (canvas) canvas.style.cursor = locked ? 'none' : 'crosshair';
    }

    setScope(on) {
      const el = this.$('scope-overlay');
      if (!el) return;
      el.classList.toggle('hidden', !on);
      const ch = this.$('crosshair');
      if (ch) ch.classList.toggle('hidden', on);
      if (on) this.$('hud-weapon-desc').textContent = 'AWM · 右键退出瞄准';
    }

    clearScope() {
      const el = this.$('scope-overlay');
      if (el) el.classList.add('hidden');
      const ch = this.$('crosshair');
      if (ch) ch.classList.remove('hidden');
    }

    setCrosshair(mode, scoped) {
      const ch = this.$('crosshair');
      if (!ch) return;
      if (scoped) { ch.classList.add('hidden'); return; }
      ch.classList.remove('hidden');
      if (!ch.classList.contains(mode)) {
        ch.classList.remove('explore', 'build', 'combat');
        ch.classList.add(mode || 'explore');
      }
    }

    setAim(on) {
      const ch = this.$('crosshair');
      if (ch) ch.classList.toggle('aim', !!on);
    }

    setThirdView(on) {
      const hint = this.$('hud-hints');
      if (!hint) return;
      hint.style.opacity = on ? '0.2' : '';
    }

    setUnderwater(on) {
      document.body.classList.toggle('underwater', !!on);
    }

    setFps(n, details) { const el = this.$('fps'); if (el) el.textContent = n + ' FPS' + (details || ''); }

    setSaveInfo(text) { const el = this.$('save-info'); if (el) el.textContent = text; }

    updateAll() {
      this.updateName();
      this.updateHUD();
      this.updateSquad();
      this.updateObjectives();
      this.updateInventory();
      this.drawMinimap();
      this.updateCompass();
      const w = MW.WEATHERS.find(x => x.id === this.g.weather);
      const s = MW.SEASONS.find(x => x.id === this.g.season);
      if (w) this.setWeather(w);
      if (s) this.setSeason(s);
      if (this.g.mode) this.setMode(this.g.mode);
    }

    updateObjectives() {
      const list = this.$('objective-list');
      if (!list) return;
      const g = this.g, p = g.player;
      if (!p || !g.world) { list.innerHTML = ''; return; }
      const items = [];
      for (const z of g.zones) {
        items.push({
          label: z.def.name,
          done: z.captured,
          prog: z.captured ? '已占领' : `${Math.round(z.progress)}%`,
          cls: !z.captured && z.zombiesInside > 0 ? 'contested' : ''
        });
      }
      items.push({
        label: `击败夜行尸（${p.kills}/${g.killTarget}）`,
        done: p.kills >= g.killTarget,
        prog: `${Math.min(p.kills, g.killTarget)}/${g.killTarget}`
      });
      if (g.shipTotal > 0) {
        items.push({
          label: `击沉敌方战舰（${g.shipsDestroyed}/${g.shipTotal}）`,
          done: g.shipsDestroyed >= g.shipTotal,
          prog: `${g.shipsDestroyed}/${g.shipTotal}`
        });
      }
      list.innerHTML = items.slice(0, 6).map(it => `
        <li class="${it.done ? 'done' : ''} ${it.cls || ''}">
          <i>${it.done ? '✓' : ''}</i>
          <span>${MW.escapeHtml(it.label)}</span>
          <span class="zo-prog">${MW.escapeHtml(it.prog || '')}</span>
        </li>`).join('');
    }

    updateSquad() {
      const g = this.g;
      const dots = this.$('squad-dots');
      if (dots) {
        dots.innerHTML = '';
        for (let i = 0; i < 6; i++) {
          const s = g.soldiers[i];
          const el = document.createElement('i');
          if (s) el.className = s.dead ? 'dead' : 'alive';
          dots.appendChild(el);
        }
      }
      const count = g.soldiers.filter(s => !s.dead).length;
      const sc = this.$('squad-count');
      if (sc) sc.textContent = `${count} / 6`;
      const rec = this.$('btn-recruit');
      if (rec) rec.disabled = count >= 6;
      if (this.panel === 'squad') this.renderSquadPanel();
    }

    renderSquadPanel() {
      const g = this.g;
      const list = this.$('soldier-list');
      if (!list) return;
      if (!g.soldiers.length) {
        list.innerHTML = '<p class="inv-tip">还没有士兵。招募后他们会跟随你并自动射击附近的夜行尸。</p>';
      } else {
        list.innerHTML = g.soldiers.map(s => `
          <div class="soldier-row ${s.dead ? 'dead' : ''}">
            <span class="sdot"></span>
            <span class="sname">${MW.escapeHtml(s.name)}</span>
            <span class="sstate">${s.dead ? '阵亡' : `${Math.ceil(s.hp)} HP · ${s.state === 'capture' ? '前往据点' : '跟随中'}`}</span>
          </div>`).join('');
      }
      const zl = this.$('zone-list');
      if (zl) {
        if (!g.zones.length) zl.innerHTML = '<p class="inv-tip">这个世界没有据点。</p>';
        else zl.innerHTML = g.zones.map(z => `
          <div class="zone-row ${z.captured ? 'done' : ''} ${z.zombiesInside > 0 ? 'contested' : ''}">
            <div class="zhead">
              <b>${MW.escapeHtml(z.def.name)}</b>
              <span>${z.captured ? '已占领' : `${Math.round(z.progress)}%${z.zombiesInside > 0 ? ' · 交战中' : ''}`}</span>
            </div>
            <div class="zone-bar"><i style="width:${z.captured ? 100 : z.progress}%"></i></div>
          </div>`).join('');
      }
      this.$('btn-recruit').disabled = g.soldiers.filter(s => !s.dead).length >= 6;
    }

    updateInventory() {
      if (this.panel === 'inventory') this.renderInventory();
    }

    renderInventory() {
      const p = this.g.player;
      if (!p) return;
      const def = MW.BACKPACKS[p.backpackLevel - 1];
      this.$('inv-backpack-name').textContent = def.name;
      this.$('inv-capacity').textContent = `${p.usedSlots()} / ${p.capacity}`;
      const grid = this.$('inv-grid');
      grid.innerHTML = '';
      const stacks = [];
      for (const [id, count] of p.items) {
        const item = MW.ITEMS[id];
        if (!item) continue;
        const maxStack = item.stack || 1;
        let left = count;
        while (left > 0) {
          const n = Math.min(left, maxStack);
          stacks.push({ id, count: n, item });
          left -= n;
        }
      }
      let used = 0;
      for (const st of stacks) {
        used++;
        const el = document.createElement('div');
        el.className = 'inv-slot filled';
        el.dataset.item = st.id;
        el.title = `${st.item.name} ×${st.count} · ${st.item.desc || ''}`;
        const bg = st.item.kind === 'use' ? 'rgba(103,211,145,.08)' : 'rgba(255,255,255,.04)';
        el.style.background = bg;
        el.innerHTML = `<span class="ic" style="color:${st.item.color || '#fff'}">${st.item.icon || '▪'}</span><span class="cnt">×${st.count}</span>`;
        grid.appendChild(el);
      }
      for (let i = used; i < p.capacity; i++) {
        const el = document.createElement('div');
        el.className = 'inv-slot';
        grid.appendChild(el);
      }
      const weapons = this.$('inv-weapons');
      weapons.innerHTML = p.weapons.map((w, i) => {
        const d = MW.WEAPONS[w.id];
        if (!d) return '';
        return `<div class="inv-weapon ${i === p.current ? 'active' : ''}" data-widx="${i}">
          <span class="widx">${i + 1}</span>
          <span class="wname">${MW.escapeHtml(d.name)}</span>
          <span class="wammo">${w.mag}/${p.ammo[d.ammo] || 0}</span>
        </div>`;
      }).join('') || '<p class="inv-tip">没有武器</p>';
      const eq = this.$('inv-equipped');
      const w = p.weapon, wd = p.weaponDef;
      eq.innerHTML = wd
        ? `<span style="font-size:22px;color:${wd.color || '#fff'}">▮</span><div><b>${MW.escapeHtml(wd.name)}</b><br><span>${MW.escapeHtml(wd.desc || '')}</span></div>`
        : '<span>空手</span>';
    }

    /* =======================================================
       便签 / 留言
       ======================================================= */
    renderNotes() {
      const wrap = this.$('note-list');
      if (!wrap) return;
      const notes = this.g.worldNotes || [];
      if (!notes.length) {
        wrap.innerHTML = '<p class="inv-tip">这片世界还没有便签。按 N 或在上方写下第一张。</p>';
        return;
      }
      wrap.innerHTML = notes.slice().reverse().map(n => `
        <div class="note-item">
          <p>${MW.escapeHtml(n.text)}</p>
          <div class="meta"><b>${MW.escapeHtml(n.author || '旅行者')}</b><span>${MW.escapeHtml(n.time || '')}</span><span>(${n.x}, ${n.z})</span></div>
          <div class="actions">
            <button data-goto-note="${n.id}" title="前往">◎</button>
            <button data-del-note="${n.id}" title="撕掉">✕</button>
          </div>
        </div>`).join('');
    }

    gotoNote(id) {
      const note = (this.g.worldNotes || []).find(n => n.id === id);
      if (!note) return;
      this.g.closeAllPanels();
      const p = this.g.player;
      p.pos.set(note.x, this.g.world.surfaceAt(note.x, note.z) + 0.1, note.z + 1.2);
      p.vel.set(0, 0, 0);
      this.toast('已传送到便签附近', 'info');
    }

    renderMessages() {
      const board = this.g.getBoard();
      for (const ch of ['global', 'author']) {
        const wrap = this.$(ch === 'global' ? 'msg-list-global' : 'msg-list-author');
        if (!wrap) continue;
        const msgs = board.filter(m => (m.channel || 'global') === ch);
        wrap.innerHTML = msgs.map(m => `
          <div class="note-item ${ch === 'author' ? 'suggest' : ''}">
            <p>${MW.escapeHtml(m.text)}</p>
            <div class="meta">
              <b>${MW.escapeHtml(m.author || '匿名')}</b>
              <span>${MW.escapeHtml(m.time || '')}</span>
              <span>${m.likes || 0} 赞</span>
              <button class="link" data-like="${m.id}" style="margin-left:auto">♥ 点赞</button>
            </div>
          </div>`).join('') || '<p class="inv-tip">还没有留言，说点什么吧。</p>';
      }
    }

    openNote(note) {
      this.currentNote = note;
      this.$('note-read-body').textContent = note.text || '';
      this.$('note-read-meta').textContent = `—— ${note.author || '旅行者'} · ${note.time || ''} · 坐标 ${note.x}, ${note.z}`;
    }

    focusNoteInput() {
      const tabs = this.$('note-tabs');
      if (tabs) {
        const worldBtn = tabs.querySelector('[data-tab="world"]');
        if (worldBtn) worldBtn.click();
      }
      setTimeout(() => this.$('note-text')?.focus(), 60);
    }

    /* =======================================================
       AI 建筑师
       ======================================================= */
    aiLog(role, text) {
      const log = this.$('ai-log');
      if (!log) return;
      const el = document.createElement('div');
      el.className = 'msg ' + role;
      el.textContent = text;
      log.appendChild(el);
      while (log.children.length > 60) log.removeChild(log.firstChild);
      log.scrollTop = log.scrollHeight;
    }

    setAiBusy(busy) {
      const btn = this.$('ai-send');
      if (btn) {
        btn.disabled = busy;
        btn.innerHTML = busy ? '思考中…' : '建造 <span>↵</span>';
      }
      const status = this.$('ai-status-text');
      if (status) status.textContent = busy ? '正在规划建筑结构……' : this.aiStatusText();
    }

    updateAIStatus() {
      const text = this.$('ai-status-text');
      if (text) text.textContent = this.aiStatusText();
      const dot = this.$('ai-status-dot');
      if (dot) dot.classList.toggle('offline', !this.g.settings.apiKey);
      this.setAPIStatus(!!this.g.settings.apiKey);
    }

    aiStatusText() {
      return this.g.settings.apiKey
        ? `大模型模式 · ${this.g.settings.model || 'deepseek-chat'}`
        : '本地模式 · 内置世界图谱';
    }

    setAPIStatus(hasKey) {
      const text = this.$('ai-status-text');
      if (text) text.textContent = hasKey ? `大模型模式 · ${this.g.settings.model || 'deepseek-chat'}` : '本地模式 · 内置世界图谱';
      const dot = this.$('ai-status-dot');
      if (dot) dot.classList.toggle('offline', !hasKey);
      const result = this.$('api-test-result');
      if (result && !hasKey) { result.textContent = '未配置 · 本地模式'; result.className = 'api-test'; }
    }

    aiImage(url) {
      const wrap = this.$('ai-image-wrap');
      if (!wrap) return;
      if (!url) { wrap.classList.add('hidden'); return; }
      this.$('ai-image').src = url;
      wrap.classList.remove('hidden');
      clearTimeout(this.aiImageTimer);
      this.aiImageTimer = setTimeout(() => wrap.classList.add('hidden'), 15000);
    }

    aiSetProgress(pct, remain) {
      const wrap = this.$('ai-progress-wrap');
      if (!wrap) return;
      wrap.classList.remove('hidden');
      this.$('ai-progress-fill').style.width = Math.round(pct * 100) + '%';
      this.$('ai-progress-text').textContent = remain > 0 ? `剩余 ${remain} 块` : '完成';
      if (pct >= 1) {
        clearTimeout(this._aiProgTimer);
        this._aiProgTimer = setTimeout(() => wrap.classList.add('hidden'), 1800);
      }
    }

    /* =======================================================
       设置
       ======================================================= */
    fillSettings() {
      const s = this.g.settings;
      this.$('set-name').value = s.playerName || '';
      this.$('set-api-base').value = s.apiBase || '';
      this.$('set-api-key').value = s.apiKey || '';
      this.$('set-model').value = s.model || '';
      this.$('set-web').checked = !!s.webSearch;
      this.$('set-audio').checked = !!s.audio;
      this.$('set-graphics').value = s.graphics || 'auto';
      this.$('set-motion').checked = !!s.reducedMotion;
      this.$('set-performance').checked = s.performanceHUD !== false;
      for (const key of ['master','effects','ambience','engine']) {
        const input=this.$('set-volume-'+key), output=this.$('volume-value-'+key);
        input.value=Math.round((s[key+'Volume'] ?? MW.DEFAULT_SETTINGS[key+'Volume'])*100);
        output.textContent=input.value+'%';
      }
      this.updateName();
      if (!s.apiKey) {
        const r = this.$('api-test-result');
        if (r) { r.textContent = '本地模式 · 无需 Key'; r.className = 'api-test'; }
      }
    }

    /* =======================================================
       工坊
       ======================================================= */
    initWorkshop() {
      const canvas = this.$('workshop-canvas');
      if (!canvas) return;
      try {
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(520, 260, false);
        renderer.outputEncoding = THREE.sRGBEncoding;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(38, 520 / 260, 0.05, 20);
        camera.position.set(0, 0.28, 1.85);
        camera.lookAt(0, 0, -0.1);
        scene.add(new THREE.HemisphereLight(0xdff4ff, 0x30343a, 0.75));
        const d1 = new THREE.DirectionalLight(0xffe6c0, 0.85);
        d1.position.set(2, 3, 3);
        scene.add(d1);
        const d2 = new THREE.DirectionalLight(0x5eead4, 0.45);
        d2.position.set(-3, 1, -2);
        scene.add(d2);
        this.workshop = { renderer, scene, camera, object: null, spin: 0 };
        this.renderWeaponPreview('pistol');
      } catch (e) {
        console.warn('工坊预览初始化失败', e);
      }
    }

    resizeWorkshop() {
      const canvas = this.$('workshop-canvas');
      if (!canvas || !this.workshop) return;
      const w = canvas.clientWidth || 520;
      const h = canvas.clientHeight || 250;
      const r = this.workshop.renderer;
      r.setSize(w, h, false);
      this.workshop.camera.aspect = w / h;
      this.workshop.camera.updateProjectionMatrix();
    }

    refreshWorkshop() {
      this.renderWeaponList();
      this.renderCharacterList();
      this.selectWeapon(this.selectedWeapon || 'pistol', false);
    }

    renderWeaponList() {
      const list = this.$('weapon-model-list');
      if (!list) return;
      const ids = Object.keys(MW.WEAPONS);
      list.innerHTML = '';
      for (const id of ids) {
        const def = MW.WEAPONS[id];
        const btn = document.createElement('button');
        btn.className = 'model-item' + (id === this.selectedWeapon ? ' active' : '');
        btn.innerHTML = `
          <span class="mi-type">${def.kind === 'launcher' ? 'RPG' : 'GUN'}</span>
          <span class="mi-name">${MW.escapeHtml(def.name)}${def.custom ? ' ✦' : ''}</span>
          <span class="mi-tier">T${def.tier || 1}</span>`;
        btn.addEventListener('click', () => this.selectWeapon(id, true));
        list.appendChild(btn);
      }
    }

    selectWeapon(id, scroll) {
      if (!MW.WEAPONS[id]) id = 'pistol';
      this.selectedWeapon = id;
      const def = MW.WEAPONS[id];
      this.$('model-name').textContent = def.name;
      this.$('model-desc').textContent = def.desc || '';
      this.$('model-stats').innerHTML = `
        <span>伤害<b>${def.dmg || 0}</b></span>
        <span>射速<b>${def.rpm || 0}</b></span>
        <span>弹匣<b>${def.mag || 0}</b></span>
        <span>弹药<b>${({ light: '5.56', heavy: '7.62', shell: '12GA', rocket: 'RPG' })[def.ammo] || '—'}</b></span>`;
      document.querySelectorAll('#weapon-model-list .model-item').forEach((b, i) => {
        b.classList.toggle('active', Object.keys(MW.WEAPONS)[i] === id);
      });
      this.renderWeaponPreview(id);
    }

    renderWeaponPreview(id) {
      if (!this.workshop) return;
      const ws = this.workshop;
      if (ws.object) { ws.scene.remove(ws.object); ws.object = null; }
      const group = MW.Models.weaponView(id);
      group.traverse(o => { o.frustumCulled = false; });
      group.position.set(0, 0.02, 0);
      group.rotation.set(0.1, Math.PI * 0.78, 0.02);
      group.scale.setScalar(1.4);
      ws.scene.add(group);
      ws.object = group;
    }

    updateWorkshop(dt) {
      if (!this.workshop || this.panel !== 'workshop') return;
      const ws = this.workshop;
      ws.spin += dt * 0.4;
      if (ws.object) ws.object.rotation.y = Math.PI * 0.78 + Math.sin(ws.spin) * 0.18;
      ws.renderer.render(ws.scene, ws.camera);
    }

    normalizeCharacter(data) {
      return {
        name: (data.name || '自定义人物').slice(0, 12),
        skin: MW.parseColor(data.skin, 0xd9a87a),
        shirt: MW.parseColor(data.shirt, 0x3f7fa8),
        pants: MW.parseColor(data.pants, 0x2f3b4d),
        hair: MW.parseColor(data.hair, 0x2a211c),
        accent: MW.parseColor(data.accent, 0xf2b544),
        helmet: data.helmet ? MW.parseColor(data.helmet, 0x50603c) : 0,
        scale: 1
      };
    }

    renderCharacterList() {
      const list = this.$('character-model-list');
      if (!list) return;
      const presets = [
        { name: '旅行者', spec: Object.assign({}, MW.CHARACTERS.player) },
        { name: '联合士兵', spec: Object.assign({}, MW.CHARACTERS.soldier) },
        { name: '夜行尸', spec: Object.assign({}, MW.CHARACTERS.zombie) },
        { name: '霓虹旅人', spec: { name: '霓虹旅人', skin: 0xe0b48a, shirt: 0x1d3f4a, pants: 0x14232b, hair: 0x0f2b33, accent: 0x5eead4, scale: 1 } }
      ];
      for (const s of this.characterSkins) presets.push({ name: s.name || '导入人物', spec: s, custom: true });
      list.innerHTML = '';
      presets.forEach((p, i) => {
        const btn = document.createElement('button');
        btn.className = 'model-item' + (this.selectedCharacter.name === p.name ? ' active' : '');
        btn.innerHTML = `<span class="mi-type">CHAR</span><span class="mi-name">${MW.escapeHtml(p.name)}</span><span class="mi-tier">${p.custom ? '自定义' : '预设'}</span>`;
        btn.addEventListener('click', () => {
          this.selectedCharacter = p;
          this.renderCharacterPreview(p.spec);
          list.querySelectorAll('.model-item').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
        list.appendChild(btn);
      });
      this.renderCharacterPreview(this.selectedCharacter.spec);
    }

    renderCharacterPreview(spec) {
      spec = Object.assign({}, MW.CHARACTERS.player, spec || {});
      const head = document.querySelector('.cp-head');
      const body = document.querySelector('.cp-body');
      const legs = document.querySelector('.cp-legs');
      if (head) head.style.background = MW.hexToCss(spec.skin);
      if (body) body.style.background = MW.hexToCss(spec.shirt);
      if (legs) { legs.style.borderLeftColor = MW.hexToCss(spec.pants); legs.style.borderRightColor = MW.hexToCss(spec.pants); }
      const desc = this.$('character-desc');
      if (desc) desc.textContent = `${this.selectedCharacter.name} · 皮肤会应用到第三人称模型，并保存在本机。`;
    }

    /* =======================================================
       反馈
       ======================================================= */
    toast(text, type) {
      const wrap = this.$('toast-container');
      if (!wrap) return;
      const el = document.createElement('div');
      el.className = 'toast ' + (type || '');
      el.textContent = text;
      wrap.appendChild(el);
      while (wrap.children.length > 4) wrap.removeChild(wrap.firstChild);
      setTimeout(() => {
        el.classList.add('out');
        setTimeout(() => el.remove(), 300);
      }, 2800);
    }

    hitMarker(type) {
      const el = this.$('hit-marker');
      if (!el) return;
      el.classList.remove('show', 'head');
      void el.offsetWidth;
      el.classList.add('show');
      if (type === 'head') el.classList.add('head');
      clearTimeout(this.hitTimer);
      this.hitTimer = setTimeout(() => el.classList.remove('show', 'head'), 230);
    }

    hurtFlash() {
      const el = this.$('hurt-flash');
      if (!el) return;
      el.classList.add('active');
      setTimeout(() => el.classList.remove('active'), 90);
    }

    showDamageFrom(pos) {
      if (!pos || !this.g.player) return;
      const p = this.g.player;
      const dx = pos.x - p.pos.x, dz = pos.z - p.pos.z;
      if (Math.abs(dx) < 0.001 && Math.abs(dz) < 0.001) return;
      const worldAngle = Math.atan2(dx, -dz);
      const rel = worldAngle - p.yaw;
      const el = this.$('damage-indicator');
      if (!el) return;
      el.querySelector('i').style.transform = `translateX(-50%) rotate(${rel}rad)`;
      el.classList.add('show');
      clearTimeout(this._dmgTimer);
      this._dmgTimer = setTimeout(() => el.classList.remove('show'), 1200);
    }

    setDanger(on, text) {
      const el = this.$('danger-warning');
      if (!el) return;
      el.classList.toggle('hidden', !on);
      if (on && text) el.querySelector('span').textContent = text;
    }

    updateVehicleHUD(v) {
      const el = this.$('vehicle-hud');
      if (!el) return;
      const ck = this.$('combat-keys');
      if (ck) ck.classList.toggle('hidden', !!v || this.g.mode !== 'combat');
      if (!v) { el.classList.add('hidden'); return; }
      el.classList.remove('hidden');
      this.$('vh-name').textContent = v.name;
      this.$('vh-speed').textContent = String(Math.round((v.currentSpeed || 0) * 3.6));
      const alt = Math.max(0, Math.round(v.pos.y - this.g.world.surfaceAt(v.pos.x, v.pos.z)));
      const altEl = this.$('vh-alt');
      altEl.textContent = (v.type === 'jet' || v.type === 'drone') ? `高度 ${alt}m` : '';
      let hint = 'A/D 转向 · W/S 前后 · E 离开';
      if (v.type === 'car') hint = 'A/D 转向 · W/S 前后 · Shift 加速 · Space 刹车 · E 离开';
      else if (v.type === 'train') hint = '自动环线巡航 · Space 刹车 · E 下车 · U 指挥台';
      else if (v.type === 'apc') hint = 'A/D 转向 · W/S 前后 · 左键机炮 · Shift 加速 · E 离开';
      else if (v.type === 'boat') hint = 'A/D 转向 · W/S 前后 · 左键舰炮 · Shift 加速 · E 离开';
      else if (v.type === 'tank') hint = 'A/D 转向 · W/S 前后 · 滚轮/↑↓ 炮口俯仰 · 左键开火 · E 离开';
      else if (v.type === 'artillery') hint = 'A/D 转向 · W/S 缓慢推动 · 滚轮/↑↓ 炮口 · 左键重炮 · E 离开';
      else if (v.type === 'drone') hint = `A/D 转向 · W/S 前后 · Space/Shift 升降 · V ${v.droneFPV ? '第三人称' : '第一视角'} · E 降落`;
      else if (v.type === 'jet') hint = `W/S 油门 · A/D 转向 · 鼠标上下 俯仰 · Space/Shift 升降 · V ${v.fpv ? '第三人称' : '座舱视角'} · E 离开`;
      this.$('vh-hint').textContent = hint;
    }

    killFeed(name, extra) {
      const feed = this.$('kill-feed');
      if (!feed) return;
      const el = document.createElement('div');
      el.className = 'kf';
      el.innerHTML = `<b>${MW.escapeHtml(name)}</b> ${extra ? MW.escapeHtml(extra) : '被击杀'} <span class="kf-head">+</span>`;
      feed.appendChild(el);
      while (feed.children.length > 5) feed.removeChild(feed.firstChild);
      setTimeout(() => el.remove(), 4200);
    }

    showDeath() {
      this.$('death-screen').classList.remove('hidden');
      this.g.firing = false;
      this.g.aiming = false;
      if (document.pointerLockElement) document.exitPointerLock();
      this.setScope(false);
    }

    hideDeath() { this.$('death-screen').classList.add('hidden'); }

    showVictory(stats) {
      const el = this.$('victory-screen');
      if (!el) return;
      const box = this.$('victory-stats');
      if (box) box.innerHTML = (stats || []).map(s => `<div><b>${s.value}</b><span>${MW.escapeHtml(s.label)}</span></div>`).join('');
      this.$('victory-desc').textContent = `你占领了所有据点，并完成了这片世界的战斗目标。+500 金币`;
      el.classList.remove('hidden');
      this.g.panelOpen = 'victory';
      this.g.firing = false;
      if (document.pointerLockElement) document.exitPointerLock();
    }

    hideVictory() { this.$('victory-screen').classList.add('hidden'); }

    /* =======================================================
       小地图 / 罗盘
       ======================================================= */
    drawMinimap() {
      const canvas = this.$('minimap');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const g = this.g;
      if (!g.world || !g.player) return;
      ctx.save();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = '#080e14';
      ctx.fillRect(0, 0, w, h);

      const px = g.player.pos.x, pz = g.player.pos.z;
      const radius = g.world.meta.terrain ? 112 : 34;
      const sampleStep = g.world.meta.terrain ? 4 : 1;
      const scale = w / (radius * 2);
      const wl = g.world.meta.waterLevel;
      for (let dx = -radius; dx < radius; dx += sampleStep) {
        for (let dz = -radius; dz < radius; dz += sampleStep) {
          const bx = Math.floor(px + dx), bz = Math.floor(pz + dz);
          const top = g.world.mapSampleAt ? g.world.mapSampleAt(bx,bz) : g.world.topBlock(bx, bz);
          let color = '#141c24';
          if (top) {
            if (wl != null && top.y <= wl) color = '#1d4b66';
            else color = MW.hexToCss(top.c);
          } else if (wl != null) {
            color = '#12364c';
          } else {
            color = MW.hexToCss((g.world.meta && g.world.meta.fallbackColor) || 0x6f8f4a);
          }
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.9;
          const sx = (bx - px + radius) * scale;
          const sz = (bz - pz + radius) * scale;
          ctx.fillRect(sx, sz, scale * sampleStep + 0.4, scale * sampleStep + 0.4);
        }
      }
      ctx.globalAlpha = 1;

      const toMap = (x, z) => [ (x - px + radius) * scale, (z - pz + radius) * scale ];
      // 据点
      for (const zo of g.zones) {
        const [sx, sz] = toMap(zo.def.x, zo.def.z);
        if (sx < -10 || sx > w + 10 || sz < -10 || sz > h + 10) continue;
        ctx.beginPath();
        ctx.arc(sx, sz, Math.max(3, zo.def.r * scale), 0, Math.PI * 2);
        ctx.fillStyle = zo.captured ? 'rgba(103,211,145,.22)' : 'rgba(255,107,90,.2)';
        ctx.fill();
        ctx.strokeStyle = zo.captured ? '#67d391' : '#ff6b5a';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = zo.captured ? '#b8f5cf' : '#ffb3a8';
        ctx.font = 'bold 8px monospace';
        ctx.fillText(zo.def.name.slice(0, 3), sx + 5, sz + 3);
      }
      // 载具
      for (const v of g.vehicles) {
        const [sx, sz] = toMap(v.pos.x, v.pos.z);
        if (sx < 0 || sx > w || sz < 0 || sz > h) continue;
        ctx.fillStyle = '#ffc857';
        ctx.fillRect(sx - 2, sz - 2, 4, 4);
      }
      // 拾取物
      for (const p of g.pickups) {
        const [sx, sz] = toMap(p.pos.x, p.pos.z);
        if (sx < 0 || sx > w || sz < 0 || sz > h) continue;
        ctx.fillStyle = p.kind === 'weapon' ? '#ff9d3c' : '#5eead4';
        ctx.fillRect(sx - 1.5, sz - 1.5, 3, 3);
      }
      // 僵尸
      for (const z of g.zombies) {
        if (z.dead) continue;
        const [sx, sz] = toMap(z.pos.x, z.pos.z);
        if (sx < 0 || sx > w || sz < 0 || sz > h) continue;
        ctx.fillStyle = '#ff5a4a';
        ctx.beginPath();
        ctx.arc(sx, sz, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      // 士兵
      for (const s of g.soldiers) {
        if (s.dead) continue;
        const [sx, sz] = toMap(s.pos.x, s.pos.z);
        ctx.fillStyle = '#63b3ff';
        ctx.fillRect(sx - 2, sz - 2, 4, 4);
      }
      // 敌舰
      for (const s of g.ships || []) {
        if (s.dead) continue;
        const [sx, sz] = toMap(s.pos.x, s.pos.z);
        if (sx < 0 || sx > w || sz < 0 || sz > h) continue;
        ctx.fillStyle = '#ff8b5a';
        ctx.fillRect(sx - 3, sz - 3, 6, 6);
      }
      // 玩家
      const yaw = g.player.yaw;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const cx = w / 2, cy = h / 2;
      ctx.beginPath();
      ctx.moveTo(cx + fx * 9, cy + fz * 9);
      ctx.lineTo(cx - fz * 5 - fx * 4, cy + fx * 5 - fz * 4);
      ctx.lineTo(cx + fz * 5 - fx * 4, cy - fx * 5 - fz * 4);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#ff9d3c';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 北向标记
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('N', w / 2 - 3, 12);
      ctx.restore();
      // 外框
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,.15)';
      ctx.stroke();
      const coord = this.$('mini-coord');
      if (coord) coord.textContent = `${Math.round(px)}, ${Math.round(pz)}`;
    }

    updateCompass() {
      const g = this.g;
      if (!g.player) return;
      let deg = (g.player.yaw * 180 / Math.PI) % 360;
      if (deg < 0) deg += 360;
      const idx = Math.round(deg / 45) % 8;
      const el = this.$('compass-dir');
      if (el) el.textContent = DIR_NAMES[idx];
    }

    /* =======================================================
       主 UI tick
       ======================================================= */
    tick(dt, game) {
      if (game.state !== 'playing') return;
      this.vitalsT += dt;
      if (this.vitalsT > 0.12) {
        this.vitalsT = 0;
        this.updateVitals();
        const k = this.$('hud-kills');
        if (k && game.player) k.textContent = `${game.player.kills} 击杀`;
      }
      this.minimapT += dt;
      if (this.minimapT > 0.14) {
        this.minimapT = 0;
        this.drawMinimap();
      }
      this.compassT += dt;
      if (this.compassT > 0.08) {
        this.compassT = 0;
        this.updateCompass();
      }
      if (this.panel === 'workshop') this.updateWorkshop(dt);
      const hint = this.$('pointer-hint');
      if (hint) {
        const show = !game.pointerLocked && !game.panelOpen && !game.intro && game.state === 'playing' && game.player && game.player.alive;
        hint.classList.toggle('hidden', !show);
      }
    }
  }

  MW.UI = UI;
})();
