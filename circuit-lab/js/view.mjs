const ns = 'http://www.w3.org/2000/svg';
export function svgNode(tag, attrs = {}, text = '') {
  const node = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text) node.textContent = text;
  return node;
}
export function pinsFor(component) {
  const n = component.nodes.length;
  if (n === 2)
    return [
      [-48, 0],
      [48, 0],
    ];
  return component.nodes.map((_, i) => [
    i % 2 === 0 ? -48 : 48,
    Math.floor(i / 2) * 22 - (Math.ceil(n / 2) - 1) * 11,
  ]);
}
export function symbolPreview(symbol) {
  const svg = svgNode('svg', { viewBox: '-90 -110 180 220' }),
    group = svgNode('g', { fill: 'none', stroke: '#70d7c6', 'stroke-width': 2 });
  for (const [x1, y1, x2, y2] of symbol.lines) group.append(svgNode('line', { x1, y1, x2, y2 }));
  for (const [x1, y1, x2, y2] of symbol.rectangles)
    group.append(
      svgNode('rect', {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
      }),
    );
  for (const [x1, y1, x2, y2] of symbol.circles)
    group.append(
      svgNode('ellipse', {
        cx: (x1 + x2) / 2,
        cy: (y1 + y2) / 2,
        rx: Math.abs(x2 - x1) / 2,
        ry: Math.abs(y2 - y1) / 2,
      }),
    );
  for (const pin of symbol.pins) {
    group.append(svgNode('circle', { cx: pin.x, cy: pin.y, r: 3 }));
    group.append(
      svgNode(
        'text',
        { x: pin.x + 5, y: pin.y - 5, fill: '#dcebef', stroke: 'none', 'font-size': 9 },
        `${pin.order} ${pin.label}`,
      ),
    );
  }
  const points = symbol.pins
    .flatMap((p) => [[p.x, p.y]])
    .concat(
      symbol.lines.flatMap((p) => [
        [p[0], p[1]],
        [p[2], p[3]],
      ]),
    );
  if (points.length) {
    const xs = points.map((p) => p[0]),
      ys = points.map((p) => p[1]);
    const x = Math.min(...xs) - 20,
      y = Math.min(...ys) - 20;
    svg.setAttribute('viewBox', `${x} ${y} ${Math.max(...xs) - x + 40} ${Math.max(...ys) - y + 40}`);
  }
  svg.append(group);
  return svg;
}
export function drawSchematic(svg, components, layout, selected, onSelect, onPin, onMove) {
  svg.replaceChildren();
  components.forEach((component, i) => {
    layout[component.name] ??= { x: 150 + (i % 3) * 265, y: 150 + Math.floor(i / 3) * 135 };
  });
  const xs = components.map((c) => layout[c.name].x),
    ys = components.map((c) => layout[c.name].y);
  const left = Math.min(0, ...xs.map((x) => x - 90)),
    top = Math.min(0, ...ys.map((y) => y - 65));
  const width = Math.max(900, ...xs.map((x) => x + 100)) - left,
    height = Math.max(440, ...ys.map((y) => y + 80)) - top;
  svg.setAttribute('viewBox', `${left} ${top} ${width} ${height}`);
  const networks = new Map();
  for (const component of components) {
    const pos = layout[component.name];
    pinsFor(component).forEach(([x, y], i) => {
      const node = component.nodes[i];
      if (!networks.has(node)) networks.set(node, []);
      networks.get(node).push([pos.x + x, pos.y + y]);
    });
  }
  const wires = svgNode('g');
  let busIndex = 0;
  for (const [name, points] of networks) {
    if (name === '0') {
      for (const [xx, yy] of points)
        wires.append(
          svgNode('path', { d: `M${xx},${yy} v12 m-7,0 h14 m-11,4 h8 m-6,4 h4`, class: 'wire' }),
        );
      continue;
    }
    const busY = 24 + (busIndex++ % 7) * 15;
    const minX = Math.min(...points.map((p) => p[0])),
      maxX = Math.max(...points.map((p) => p[0]));
    if (points.length > 1)
      wires.append(
        svgNode('path', { d: `M${minX},${busY} H${maxX}`, class: 'wire', 'data-node': name }),
      );
    for (const [x, y] of points) {
      wires.append(svgNode('path', { d: `M${x},${y} V${busY}`, class: 'wire', 'data-node': name }));
      if (points.length > 1)
        wires.append(svgNode('circle', { cx: x, cy: busY, r: 2, fill: 'var(--wire)' }));
    }
    wires.append(
      svgNode('text', { x: minX + 4, y: busY - 4, fill: 'var(--muted)', 'font-size': 9 }, name),
    );
  }
  svg.append(wires);
  for (const component of components) {
    const pos = layout[component.name],
      g = svgNode('g', {
        transform: `translate(${pos.x} ${pos.y})`,
        class: 'component' + (selected === component.name ? ' selected' : ''),
        'data-name': component.name,
      });
    g.append(
      svgNode('rect', {
        x: -34,
        y: -25,
        width: 68,
        height: 50,
        rx: component.type === 'V' || component.type === 'I' ? 25 : 6,
        class: 'component-body',
      }),
    );
    g.append(
      svgNode(
        'text',
        { x: 0, y: -35, 'text-anchor': 'middle', fill: 'var(--text)', 'font-size': 13 },
        component.name,
      ),
    );
    g.append(
      svgNode(
        'text',
        { x: 0, y: 5, 'text-anchor': 'middle', fill: '#70d7c6', 'font-size': 17 },
        component.type === 'R'
          ? '∿'
          : component.type === 'C'
            ? '─││─'
            : component.type === 'L'
              ? '∩∩∩'
              : component.type === 'V'
                ? '+ −'
                : component.type === 'I'
                  ? '↑'
                  : component.type,
      ),
    );
    g.append(
      svgNode(
        'text',
        { x: 0, y: 46, 'text-anchor': 'middle', fill: '#d8b487', 'font-size': 10 },
        component.value.length > 28 ? component.value.slice(0, 25) + '…' : component.value,
      ),
    );
    pinsFor(component).forEach(([x, y], i) => {
      g.append(svgNode('line', { x1: Math.sign(x) * 34, y1: y, x2: x, y2: y, stroke: '#849cae' }));
      const pin = svgNode('circle', { cx: x, cy: y, r: 5, class: 'pin', 'data-pin': i });
      pin.append(svgNode('title', {}, `${component.name} 引脚 ${i + 1} · ${component.nodes[i]}`));
      pin.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        onPin(component, i);
      });
      g.append(pin);
      g.append(
        svgNode(
          'text',
          {
            x: x + (x < 0 ? -5 : 5),
            y: y - 9,
            'text-anchor': x < 0 ? 'end' : 'start',
            fill: 'var(--muted)',
            'font-size': 9,
          },
          component.nodes[i],
        ),
      );
    });
    g.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const start = { x: event.clientX, y: event.clientY, px: pos.x, py: pos.y };
      let moved = false;
      const rect = svg.getBoundingClientRect(),
        scale = Math.max(width / rect.width, height / rect.height);
      g.setPointerCapture(event.pointerId);
      const move = (e) => {
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 3) moved = true;
        pos.x = Math.round((start.px + (e.clientX - start.x) * scale) / 5) * 5;
        pos.y = Math.round((start.py + (e.clientY - start.y) * scale) / 5) * 5;
        g.setAttribute('transform', `translate(${pos.x} ${pos.y})`);
      };
      const up = () => {
        g.removeEventListener('pointermove', move);
        g.removeEventListener('pointerup', up);
        if (moved) onMove();
        else onSelect(component.name);
      };
      g.addEventListener('pointermove', move);
      g.addEventListener('pointerup', up, { once: true });
    });
    svg.append(g);
  }
}
export const COLORS = ['#70d7c6', '#efb875', '#ad9de8', '#ef8fa5', '#78aee9', '#b2d683'];
export function traceValue(variable, index, mode) {
  const re = variable.real[index],
    im = variable.imag[index];
  return mode === 'db'
    ? 20 * Math.log10(Math.max(1e-20, Math.hypot(re, im)))
    : mode === 'phase'
      ? (Math.atan2(im, re) * 180) / Math.PI
      : re;
}
export function drawPlot(canvas, result, names, mode, sample, held) {
  const rect = canvas.getBoundingClientRect(),
    w = Math.max(280, rect.width),
    h = 240,
    dpr = Math.min(devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== h * dpr) {
    canvas.width = Math.round(w * dpr);
    canvas.height = h * dpr;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#91a8b5';
  ctx.font = '11px system-ui';
  if (!result) {
    ctx.fillText('运行一个电路，观察节点电压与支路电流。', 20, 110);
    return;
  }
  const isOp = /Operating Point/i.test(result.plot),
    logX = /AC Analysis/i.test(result.plot);
  const axis = result.variables[0];
  const xAt = (r, i) =>
    isOp ? i : logX ? Math.log10(Math.max(1e-30, r.variables[0].real[i])) : r.variables[0].real[i];
  let xmin = Math.min(xAt(result, 0), xAt(result, result.points - 1)),
    xmax = Math.max(xAt(result, 0), xAt(result, result.points - 1));
  if (xmax <= xmin) xmax = xmin + 1;
  const selected = result.variables.filter((v) => names.has(v.name));
  let low = Infinity,
    high = -Infinity;
  for (const variable of selected)
    for (let i = 0; i < result.points; i++) {
      const value = traceValue(variable, i, mode);
      low = Math.min(low, value);
      high = Math.max(high, value);
    }
  const compatible = held && held.plot === result.plot;
  if (compatible)
    for (const variable of held.variables.filter((v) => names.has(v.name)))
      for (let i = 0; i < held.points; i++) {
        const v = traceValue(variable, i, mode);
        low = Math.min(low, v);
        high = Math.max(high, v);
      }
  if (!Number.isFinite(low)) {
    low = 0;
    high = 1;
  }
  if (high - low < 1e-12) {
    low -= 1;
    high += 1;
  }
  const margin = (high - low) * 0.08;
  low -= margin;
  high += margin;
  const x = (value) => 50 + ((value - xmin) / (xmax - xmin)) * (w - 66),
    y = (value) => h - 30 - ((value - low) / (high - low)) * (h - 50);
  ctx.strokeStyle = '#233945';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const yy = 20 + (i * (h - 50)) / 4;
    ctx.beginPath();
    ctx.moveTo(50, yy);
    ctx.lineTo(w - 16, yy);
    ctx.stroke();
    ctx.fillText((high - (i * (high - low)) / 4).toPrecision(3), 1, yy + 4);
  }
  const draw = (r, variable, color, dashed) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.setLineDash(dashed ? [4, 4] : []);
    ctx.beginPath();
    const stride = Math.max(1, Math.ceil(r.points / (w * 2)));
    let started = false;
    for (let begin = 0; begin < r.points; begin += stride) {
      const end = Math.min(r.points, begin + stride);
      let minIndex = begin,
        maxIndex = begin;
      for (let i = begin + 1; i < end; i++) {
        const value = traceValue(variable, i, mode);
        if (value < traceValue(variable, minIndex, mode)) minIndex = i;
        if (value > traceValue(variable, maxIndex, mode)) maxIndex = i;
      }
      const indices = [begin, minIndex, maxIndex, end - 1].sort((a, b) => a - b);
      for (const i of new Set(indices)) {
        const px = x(xAt(r, i)),
          py = y(traceValue(variable, i, mode));
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
    if (r.points === 1) {
      ctx.beginPath();
      ctx.arc(x(xmin), y(traceValue(variable, 0, mode)), 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  };
  ctx.save();
  ctx.beginPath();
  ctx.rect(49, 10, w - 63, h - 39);
  ctx.clip();
  selected.forEach((variable, index) => {
    const colorIndex = result.variables.indexOf(variable) - (isOp ? 0 : 1);
    const color = COLORS[Math.max(0, colorIndex) % COLORS.length];
    draw(result, variable, color, false);
    if (compatible) {
      const previous = held.variables.find((v) => v.name === variable.name);
      if (previous) draw(held, previous, color, true);
    }
  });
  ctx.restore();
  ctx.setLineDash([]);
  ctx.strokeStyle = '#ffffff55';
  const sx = x(xAt(result, Math.min(result.points - 1, sample)));
  ctx.beginPath();
  ctx.moveTo(sx, 20);
  ctx.lineTo(sx, h - 30);
  ctx.stroke();
  ctx.fillStyle = '#91a8b5';
  ctx.fillText(
    isOp
      ? '直流工作点'
      : `${Math.min(axis.real[0], axis.real[result.points - 1]).toPrecision(3)} ${axis.unit}`,
    50,
    h - 10,
  );
  ctx.fillText(
    isOp ? '' : `${Math.max(axis.real[0], axis.real[result.points - 1]).toPrecision(3)} ${axis.unit}`,
    Math.max(100, w - 130),
    h - 10,
  );
}

export function sampleAtFraction(result, fraction) {
  const axis = result.variables[0].real,
    first = axis[0],
    last = axis[axis.length - 1];
  const low = Math.min(first, last),
    high = Math.max(first, last),
    position = Math.min(1, Math.max(0, fraction));
  const target = /AC Analysis/.test(result.plot)
    ? Math.pow(10, Math.log10(low) + position * Math.log10(high / low))
    : low + position * (high - low);
  const ascending = last >= first;
  let lo = 0,
    hi = axis.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ascending ? axis[mid] < target : axis[mid] > target) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(axis[lo - 1] - target) < Math.abs(axis[lo] - target)) lo--;
  return lo;
}
