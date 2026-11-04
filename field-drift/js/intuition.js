(function () {
  'use strict';
  const FD = window.FD;
  const I = (FD.Intuition = { active: false, running: false, accumulator: 0, history: [], trail: [] });
  let root, canvas, context, metrics, status, prediction, reveal, selector, controls, play;
  let width = 800,
    height = 460,
    lastSample = -1,
    lastReadout = -1;
  const colors = ['#64e1d0', '#f5b767', '#b4a0ff'];
  const node = (tag, text, className) => {
    const item = document.createElement(tag);
    if (text) item.textContent = text;
    if (className) item.className = className;
    return item;
  };
  function load(index) {
    I.definition = FD.EXPERIMENTS[index];
    I.values = {};
    controls.replaceChildren();
    I.definition.params.forEach((parameter) => {
      const label = node('label', parameter.label);
      const output = node('output', String(parameter.value));
      const input = node('input');
      input.type = 'range';
      input.min = parameter.min;
      input.max = parameter.max;
      input.step = parameter.step;
      input.value = parameter.value;
      input.setAttribute('aria-label', parameter.label);
      input.addEventListener('input', () => {
        I.values[parameter.key] = Number(input.value);
        output.value = input.value;
        reset();
      });
      label.append(output, input);
      controls.append(label);
    });
    root.querySelector('.intuition-question').textContent = I.definition.question;
    root.querySelector('.intuition-equation').textContent = I.definition.equation;
    root.querySelector('.intuition-limits').textContent = I.definition.limits;
    reveal.textContent = I.definition.explanation;
    reveal.hidden = true;
    prediction.value = '';
    reset();
  }
  function reset() {
    I.model = FD.createExperiment(I.definition, I.values);
    I.accumulator = 0;
    I.history = [];
    I.trail = [];
    lastSample = -1;
    lastReadout = -1;
    I.running = false;
    play.textContent = '开始观察';
    sample();
    draw();
  }
  function sample() {
    const value = I.model.observe();
    if (I.model.time !== lastSample) {
      I.history.push([I.model.time, value.kinetic, value.potential, value.kinetic + value.potential]);
      I.trail.push([value.x, value.y]);
      lastSample = I.model.time;
    }
    // At most 1201 points over the 40 s observation window.
    if (I.history.length > 1201) {
      I.history.shift();
      I.trail.shift();
    }
    if (I.model.time - lastReadout >= 0.1 || lastReadout < 0 || I.model.ended) {
      metrics.replaceChildren(
        ...value.metrics.map(([label, number]) => {
          const row = node('div');
          row.append(node('span', label), node('b', number.toFixed(3)));
          return row;
        }),
      );
      status.textContent = `${I.model.time.toFixed(2)} s · ${I.model.reason || (I.running ? '观察中' : '已暂停')} · 改参数会从同一起点重放`;
      lastReadout = I.model.time;
    }
  }
  function resize() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    width = Math.max(280, rect.width);
    height = Math.max(260, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (I.active) draw();
  }
  function line(points, color, dashed) {
    if (!points.length) return;
    context.strokeStyle = color;
    context.lineWidth = 1.6;
    context.setLineDash(dashed ? [5, 5] : []);
    context.beginPath();
    points.forEach(([x, y], index) => (index ? context.lineTo(x, y) : context.moveTo(x, y)));
    context.stroke();
    context.setLineDash([]);
  }
  function dot(x, y, color, radius = 6) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  function arrow(x, y, dx, dy, color) {
    const magnitude = Math.hypot(dx, dy);
    if (magnitude < 1e-9) return;
    const length = Math.min(68, 18 + 20 * Math.log1p(magnitude));
    dx = (dx / magnitude) * length;
    dy = (-dy / magnitude) * length;
    line(
      [
        [x, y],
        [x + dx, y + dy],
      ],
      color,
    );
    const angle = Math.atan2(dy, dx);
    line(
      [
        [x + dx - 7 * Math.cos(angle - 0.5), y + dy - 7 * Math.sin(angle - 0.5)],
        [x + dx, y + dy],
        [x + dx - 7 * Math.cos(angle + 0.5), y + dy - 7 * Math.sin(angle + 0.5)],
      ],
      color,
    );
  }
  function draw() {
    if (!I.model || !context) return;
    const model = I.model,
      kind = I.definition.kind,
      value = model.observe(),
      p = model.p;
    context.fillStyle = '#081723';
    context.fillRect(0, 0, width, height);
    const plotBottom = height * 0.66;
    const bounds = I.definition.bounds.slice();
    if (!['induction', 'wave', 'pendulum', 'resonance'].includes(kind)) {
      I.trail.forEach(([x, y]) => {
        bounds[0] = Math.min(bounds[0], x - 1);
        bounds[1] = Math.max(bounds[1], x + 1);
        bounds[2] = Math.min(bounds[2], y - 1);
        bounds[3] = Math.max(bounds[3], y + 1);
      });
    }
    // Equal axis scale avoids distorting circular trajectories.
    const scale = Math.min(
      (width - 80) / (bounds[1] - bounds[0]),
      (plotBottom - 50) / (bounds[3] - bounds[2]),
    );
    const cx = (bounds[0] + bounds[1]) / 2,
      cy = (bounds[2] + bounds[3]) / 2;
    const xy = (x, y) => [width / 2 + (x - cx) * scale, plotBottom / 2 + 12 - (y - cy) * scale];
    context.font = '12px system-ui';
    context.fillStyle = '#91aab8';
    context.fillText('轨迹与矢量 · 青色 v · 橙色合力（箭长压缩，仅方向可比较）', 18, 21);
    line([xy(bounds[0], 0), xy(bounds[1], 0)], '#294050');
    line([xy(0, bounds[2]), xy(0, bounds[3])], '#294050');
    if (kind === 'wave') {
      const points = [];
      for (let i = 0; i <= 240; i++)
        points.push(xy(i / 240, FD.Physics.standingWave(i / 240, model.time, p.mode)));
      line(points, colors[0]);
      for (let i = 0; i <= p.mode; i++) {
        const a = xy(i / p.mode, 0);
        dot(a[0], a[1], colors[1], 4);
      }
    } else if (kind === 'induction') {
      const center = xy(0, 0),
        radius = scale;
      context.strokeStyle = colors[0];
      context.lineWidth = 3;
      context.beginPath();
      context.ellipse(center[0], center[1], radius, radius * 0.7, 0, 0, Math.PI * 2);
      context.stroke();
      const quantity = FD.Physics.induction(model.time, p.frequency, p.resistance);
      context.fillStyle = colors[2];
      context.font = '24px system-ui';
      context.fillText(quantity.flux >= 0 ? '⊙ B' : '⊗ B', center[0] - 28, center[1] + 7);
      const direction = Math.sign(quantity.current);
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4 + direction * model.time * 2;
        dot(
          center[0] + radius * Math.cos(angle),
          center[1] - radius * 0.7 * Math.sin(angle),
          colors[1],
          Math.abs(quantity.current) < 0.01 ? 2 : 4,
        );
      }
      context.font = '12px system-ui';
    } else {
      line(
        I.trail.map(([x, y]) => xy(x, y)),
        '#367a85',
      );
      if (kind === 'orbit') {
        const a = xy(0, 0);
        dot(a[0], a[1], colors[1], 9);
      }
      if (kind === 'projectile') {
        const theta = (p.angle * Math.PI) / 180,
          reference = [];
        for (let t = 0; t <= (30 * Math.sin(theta)) / 9.81; t += 0.025)
          reference.push(xy(15 * Math.cos(theta) * t, 15 * Math.sin(theta) * t - (9.81 * t * t) / 2));
        line(reference, '#8894a7', true);
      }
      if (kind === 'pendulum') {
        const theta = ((p.angle * Math.PI) / 180) * Math.cos(Math.sqrt(9.81 / p.length) * model.time);
        line([xy(0, 0), xy(p.length * Math.sin(theta), -p.length * Math.cos(theta))], '#8996a9', true);
        line([xy(0, 0), xy(value.x, value.y)], '#d6e3e9');
      }
      if (kind === 'resonance') {
        const spring = [xy(-3.7, 0)];
        for (let i = 0; i <= 22; i++)
          spring.push(xy(-3.7 + ((value.x + 3.7) * i) / 22, i % 2 ? 0.15 : -0.15));
        line(spring, '#92a8b8');
      }
      const a = xy(value.x, value.y);
      dot(a[0], a[1], colors[0]);
      arrow(a[0], a[1], value.vx, value.vy, colors[0]);
      arrow(a[0], a[1], value.ax, value.ay, colors[1]);
    }
    const top = plotBottom + 27,
      bottom = height - 26;
    const seriesCount = kind === 'induction' ? 2 : 3;
    let low = 0,
      high = 0.01;
    I.history.forEach((row) =>
      row.slice(1, seriesCount + 1).forEach((number) => {
        low = Math.min(low, number);
        high = Math.max(high, number);
      }),
    );
    const duration = Math.max(10, model.time),
      span = high - low;
    for (let series = 0; series < seriesCount; series++) {
      line(
        I.history.map((row) => [
          48 + (row[0] / duration) * (width - 72),
          bottom - ((row[series + 1] - low) / span) * (bottom - top),
        ]),
        colors[series],
      );
    }
    context.fillStyle = '#9ab2c0';
    context.fillText(
      kind === 'induction'
        ? '磁通 Φ / Wb（青） · 电动势 ε / V（橙），共用数值轴'
        : '动能（青） · 势能（橙） · 总能（紫）',
      18,
      top - 10,
    );
    context.fillText(high.toFixed(2), 5, top + 8);
    context.fillText(low.toFixed(2), 5, bottom);
    context.fillText('0 s', 48, height - 8);
    context.fillText(duration.toFixed(1) + ' s', width - 64, height - 8);
  }
  I.update = function (dt) {
    if (!I.active || !I.running) return;
    if (I.running && !I.model.ended) {
      I.accumulator += Math.min(dt, 0.05);
      while (I.accumulator >= 1 / 240) {
        I.model.step(1 / 240);
        I.accumulator -= 1 / 240;
        if (I.model.time - lastSample >= 1 / 30 || I.model.ended) sample();
        if (I.model.ended) {
          I.running = false;
          play.textContent = '重新观察';
          break;
        }
      }
    }
    draw();
  };
  I.init = function () {
    root = document.getElementById('intuition');
    root.innerHTML = `<div class="intuition-head"><div><span>FIELD NOTES / 可重复的物理实验</span><h2>先猜想，再观察</h2></div><button id="intuition-close" class="btn">回到场海</button></div>
      <div class="intuition-layout"><aside><label class="case-label">选择案例<select id="intuition-case"></select></label><p class="intuition-question"></p><label class="case-label">记录你的预测<textarea id="intuition-prediction" rows="2" placeholder="改变一个参数后，方向、周期或能量会怎样变化？"></textarea></label><div id="intuition-controls"></div><div class="intuition-buttons"><button id="intuition-play" class="btn primary">开始观察</button><button id="intuition-step" class="btn">单步</button><button id="intuition-reset" class="btn">重置</button></div><button id="intuition-explain" class="btn small">对照解释</button><p id="intuition-reveal" hidden></p></aside><div class="intuition-main"><canvas id="intuition-canvas" aria-label="物理轨迹、矢量和数值历史图"></canvas><div id="intuition-status" role="status"></div><div id="intuition-metrics"></div><p class="intuition-equation"></p><p class="intuition-limits"></p><p class="intuition-reference">模型参考 <a href="https://openstax.org/details/books/university-physics-volume-1" target="_blank" rel="noopener">OpenStax 力学</a> · <a href="https://openstax.org/details/books/university-physics-volume-2" target="_blank" rel="noopener">OpenStax 电磁学</a></p></div></div>`;
    selector = document.getElementById('intuition-case');
    FD.EXPERIMENTS.forEach((definition, index) => {
      const option = node('option', definition.name);
      option.value = index;
      selector.append(option);
    });
    controls = document.getElementById('intuition-controls');
    canvas = document.getElementById('intuition-canvas');
    context = canvas.getContext('2d');
    metrics = document.getElementById('intuition-metrics');
    status = document.getElementById('intuition-status');
    prediction = document.getElementById('intuition-prediction');
    reveal = document.getElementById('intuition-reveal');
    play = document.getElementById('intuition-play');
    selector.addEventListener('change', () => load(Number(selector.value)));
    play.addEventListener('click', () => {
      if (I.model.ended) reset();
      I.running = !I.running;
      play.textContent = I.running ? '暂停' : '继续观察';
      lastReadout = -1;
      sample();
    });
    document.getElementById('intuition-step').addEventListener('click', () => {
      I.running = false;
      for (let i = 0; i < 8; i++) I.model.step(1 / 240);
      lastReadout = -1;
      sample();
      draw();
      play.textContent = '继续观察';
    });
    document.getElementById('intuition-reset').addEventListener('click', reset);
    document.getElementById('intuition-explain').addEventListener('click', () => {
      reveal.hidden = !reveal.hidden;
    });
    document.getElementById('btn-intuition').addEventListener('click', () => {
      I.active = true;
      FD.G.mode = 'intuition';
      root.hidden = false;
      document.getElementById('scr-title').classList.remove('active');
      FD.Audio.thrust(0);
      FD.Audio.pad(0);
      load(Number(selector.value));
      resize();
      selector.focus();
    });
    document.getElementById('intuition-close').addEventListener('click', () => {
      I.active = false;
      I.running = false;
      root.hidden = true;
      FD.G.mode = 'title';
      document.getElementById('scr-title').classList.add('active');
      document.getElementById('btn-intuition').focus();
    });
    window.addEventListener('resize', resize);
  };
})();
