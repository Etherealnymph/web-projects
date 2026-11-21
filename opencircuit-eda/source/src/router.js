import { GRID, snap, isHighVoltNet, isLowVoltNet, isNegVoltNet } from './pdk-parser.js';

/* ============================================================================
 * 7. 整体布局优化 (线长最小化 HPWL)
 * ============================================================================ */
function layoutSubckt(subckt) {
  const elements = JSON.parse(JSON.stringify(subckt.elements));
  if (elements.length === 0) return { elements: [], symbolOffsets: {}, wireOffsets: {}, width: 1080, height: 740 };

  const netMap = {};
  elements.forEach((el, idx) => {
    el.id = idx;
    el.pins.forEach(p => {
      if (!netMap[p.net]) netMap[p.net] = [];
      netMap[p.net].push({ el, pin: p });
    });
  });

  elements.forEach(el => {
    if (el.type === "subckt_inst") {
      const leftPins = [], rightPins = [];
      el.pins.forEach(p => {
        const pn = p.name.toLowerCase();
        if (isHighVoltNet(p.net) || pn === "vdd") p.dir = "top";
        else if (isLowVoltNet(p.net) || pn === "vss" || pn === "gnd" || pn === "gnode") p.dir = "bottom";
        else if (pn.includes("out") || pn.includes("ref") || /^i(?:ref|out|bias|_|$)/.test(pn) || pn === "vg" || pn === "vg3") rightPins.push(p);
        else leftPins.push(p);
      });
      if (rightPins.length === 0 && leftPins.length > 1) rightPins.push(leftPins.pop());
      leftPins.forEach(p => p.dir = "left");
      rightPins.forEach(p => p.dir = "right");
    }
  });

  elements.forEach(el => {
    const nets = el.pins.map(p => p.net);
    const hasHigh = nets.some(isHighVoltNet);
    const hasLow = nets.some(isLowVoltNet);
    const box = getElementBoxSize(el);
    el.w = box.w;
    el.h = box.h;

    if (el.type === "pmos") el.tier = hasHigh ? 0 : 1;
    else if (["isource", "vsource", "vsin", "vpulse", "vsweep", "vcvs", "vccs", "cccs", "ccvs"].includes(el.type)) el.tier = hasHigh ? 0 : 2;
    else if (el.type.startsWith("gate_") || el.type === "dff" || el.type === "mux2") el.tier = 1;
    else if (el.type === "resistor" || el.type === "inductor" || el.type === "capacitor" || el.type === "subckt_inst") el.tier = 1;
    else if (el.type === "nmos") el.tier = hasLow ? 3 : 2;
    else if (el.type === "pnp" || el.type === "npn") el.tier = 3;
    else el.tier = 1;
  });

  const signalNets = [];
  Object.entries(netMap).forEach(([net, conns]) => {
    if (isHighVoltNet(net) || isLowVoltNet(net) || conns.length < 2) return;
    signalNets.push({ net, conns });
  });

  elements.forEach((el, i) => { el.fx = 160 + (i % 5) * 160; el.fy = 140 + el.tier * 155; });

  for (let iter = 0; iter < 280; iter++) {
    const temp = 1 - iter / 280;
    elements.forEach(u => {
      let fx = 0, fy = 0;
      signalNets.forEach(sn => {
        if (!sn.conns.some(c => c.el.id === u.id)) return;
        sn.conns.forEach(c => {
          const v = c.el;
          if (v.id === u.id) return;
          const sameBranch = Math.abs(u.tier - v.tier) >= 1;
          fx += (v.fx - u.fx) * (sameBranch ? 0.25 : 0.14);
          fy += (v.fy - u.fy) * 0.06;
        });
      });

      elements.forEach(v => {
        if (u.id === v.id) return;
        const rx = u.fx - v.fx, ry = u.fy - v.fy;
        const minW = (u.w + v.w) / 2 + 80;
        const minH = (u.h + v.h) / 2 + 55;
        if (Math.abs(rx) < minW && Math.abs(ry) < minH) {
          fx += (rx >= 0 ? 1 : -1) * (minW - Math.abs(rx)) * 0.22;
          fy += (ry >= 0 ? 1 : -1) * (minH - Math.abs(ry)) * 0.12;
        }
      });

      fy += ((140 + u.tier * 155) - u.fy) * 0.18;
      u.fx += fx * temp;
      u.fy += fy * temp;
    });
  }

  const minFx = Math.min(...elements.map(e => e.fx));
  const placed = [];
  elements.sort((a, b) => a.tier - b.tier || a.fx - b.fx);

  elements.forEach(el => {
    let gx = snap(140 + (el.fx - minFx));
    let gy = snap(140 + el.tier * 155);
    let step = 0;
    while (checkOverlap(gx, gy, el.w, el.h, placed) && step < 80) {
      step++;
      const dir = step % 2 === 1 ? 1 : -1;
      gx = snap(140 + (el.fx - minFx) + dir * Math.ceil(step / 2) * 40);
      if (gx < 100) gx = snap(140 + (el.fx - minFx) + step * 40);
    }
    el.x = gx;
    el.y = gy;
    computePinPositions(el);
    placed.push(el);
  });

  // 2-Opt 离散交换线长最小化
  const calcHPWL = () => {
    let sum = 0;
    signalNets.forEach(sn => {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      sn.conns.forEach(c => {
        minX = Math.min(minX, c.pin.x); maxX = Math.max(maxX, c.pin.x);
        minY = Math.min(minY, c.pin.y); maxY = Math.max(maxY, c.pin.y);
      });
      sum += (maxX - minX) + (maxY - minY);
    });
    return sum;
  };
  let bestLen = calcHPWL();
  for (let p = 0; p < 3; p++) {
    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        const a = elements[i], b = elements[j];
        if (a.tier !== b.tier || a.w !== b.w || a.h !== b.h) continue;
        const ax = a.x, ay = a.y, bx = b.x, by = b.y;
        a.x = bx; a.y = by; computePinPositions(a);
        b.x = ax; b.y = ay; computePinPositions(b);
        const nl = calcHPWL();
        if (nl < bestLen) bestLen = nl;
        else { a.x = ax; a.y = ay; computePinPositions(a); b.x = bx; b.y = by; computePinPositions(b); }
      }
    }
  }

  // 4. 额外的单器件局部网格微调，进一步最小化 SPICE 等效电路与通用电路线长
  for (let pass = 0; pass < 2; pass++) {
    elements.forEach(el => {
      const ox = el.x, oy = el.y;
      const offsets = [[-40, 0], [40, 0], [0, -40], [0, 40], [-80, 0], [80, 0]];
      for (const [dx, dy] of offsets) {
        const nx = snap(ox + dx), ny = snap(oy + dy);
        if (nx < 100 || ny < 100) continue;
        const others = elements.filter(o => o.id !== el.id);
        if (checkOverlap(nx, ny, el.w, el.h, others)) continue;
        el.x = nx; el.y = ny; computePinPositions(el);
        const nl = calcHPWL();
        if (nl < bestLen) { bestLen = nl; return; }
      }
      el.x = ox; el.y = oy; computePinPositions(el);
    });
  }

  // 紧凑化画布边界，消除多余大片空白
  const minElX = Math.min(...elements.map(e => e.x - e.w / 2));
  const minElY = Math.min(...elements.map(e => e.y - e.h / 2));
  const shiftX = snap(Math.max(0, minElX - 100));
  const shiftY = snap(Math.max(0, minElY - 90));
  if (shiftX > 0 || shiftY > 0) {
    elements.forEach(el => {
      el.x -= shiftX;
      el.y -= shiftY;
      computePinPositions(el);
    });
  }

  const maxElX = Math.max(...elements.map(e => e.x + e.w / 2));
  const maxElY = Math.max(...elements.map(e => e.y + e.h / 2));
  const fitWidth = snap(Math.max(maxElX + 120, 640));
  const fitHeight = snap(Math.max(maxElY + 130, 340));

  return {
    elements,
    symbolOffsets: {},
    wireOffsets: {},
    width: fitWidth,
    height: fitHeight
  };
}

function getElementBoxSize(el) {
  if (el.type === "term_vdd" || el.type === "term_gnd" || el.type === "term_neg") {
    return { w: 40, h: 40 };
  }
  if (el.type === "subckt_inst") {
    if (el.symbolShape === "opamp") return { w: 120, h: 100 };
    if (["nand", "nor", "and", "or", "inv"].includes(el.symbolShape)) return { w: 120, h: 80 };
    const rows = Math.max(el.pins.filter(p => p.dir === "left").length, el.pins.filter(p => p.dir === "right").length, 2);
    return { w: 120, h: snap(rows * 40 + 40) };
  }
  if (el.type === "dff" || el.type === "mux2") return { w: 100, h: 100 };
  if (el.type.startsWith("gate_")) return { w: 100, h: 80 };
  if (["vcvs", "vccs", "cccs", "ccvs"].includes(el.type)) return { w: 100, h: 100 };
  return el.type === "capacitor" ? { w: 80, h: 60 } : { w: 80, h: 100 };
}

function checkOverlap(x, y, w, h, boxes) {
  return boxes.some(b => Math.abs(x - b.x) < (w + b.w) / 2 + 65 && Math.abs(y - b.y) < (h + b.h) / 2 + 45);
}

function computePinPositions(el) {
  const cx = el.x, cy = el.y;
  el.pins.forEach(p => {
    if (!p.baseDir) p.baseDir = p.dir;
    else p.dir = p.baseDir;
  });
  if (el.type === "nmos" || el.type === "pmos") {
    el.pins.forEach(p => {
      if (p.dir === "top") { p.x = cx + 20; p.y = cy - 40; }
      else if (p.dir === "bottom") { p.x = cx + 20; p.y = cy + 40; }
      else if (p.dir === "left") { p.x = cx - 40; p.y = cy; }
      else if (p.dir === "right") { p.x = cx + 20; p.y = cy; }
    });
  } else if (el.type === "pnp" || el.type === "npn") {
    el.pins.forEach(p => {
      if (p.dir === "top") { p.x = cx + 20; p.y = cy - 40; }
      else if (p.dir === "bottom") { p.x = cx + 20; p.y = cy + 40; }
      else if (p.dir === "left") { p.x = cx - 40; p.y = cy; }
    });
  } else if (["resistor", "inductor", "isource", "vsource", "vsin", "vpulse", "vsweep"].includes(el.type)) {
    el.pins.forEach(p => {
      if (p.dir === "top") { p.x = cx; p.y = cy - 40; }
      else if (p.dir === "bottom") { p.x = cx; p.y = cy + 40; }
    });
  } else if (["vcvs", "vccs", "cccs", "ccvs"].includes(el.type)) {
    el.pins.forEach(p => {
      if (p.dir === "top") { p.x = cx; p.y = cy - 40; }
      else if (p.dir === "bottom") { p.x = cx; p.y = cy + 40; }
      else if (p.dir === "left") { p.x = cx - 40; p.y = cy; }
      else if (p.dir === "right") { p.x = cx + 40; p.y = cy; }
    });
  } else if (el.type.startsWith("gate_") || el.type === "dff" || el.type === "mux2") {
    const leftPins = el.pins.filter(p => p.dir === "left");
    const rightPins = el.pins.filter(p => p.dir === "right");
    const botPins = el.pins.filter(p => p.dir === "bottom");
    leftPins.forEach((p, i) => {
      p.x = cx - 60;
      p.y = leftPins.length === 1 ? cy : (leftPins.length === 2 ? snap(cy - 20 + i * 40) : snap(cy - 20 + i * 20));
    });
    rightPins.forEach((p, i) => {
      p.x = cx + 60;
      p.y = rightPins.length === 1 ? cy : snap(cy - 20 + i * 40);
    });
    botPins.forEach((p) => { p.x = cx; p.y = cy + 60; });
  } else if (el.type === "capacitor") {
    el.pins.forEach(p => {
      if (p.dir === "left") { p.x = cx - 40; p.y = cy; }
      else if (p.dir === "right") { p.x = cx + 40; p.y = cy; }
    });
  } else if (el.type === "subckt_inst") {
    const hw = el.w / 2, hh = el.h / 2;
    const leftPins = el.pins.filter(p => p.dir === "left");
    const rightPins = el.pins.filter(p => p.dir === "right");
    const topPins = el.pins.filter(p => p.dir === "top");
    const botPins = el.pins.filter(p => p.dir === "bottom");

    if (el.symbolShape === "opamp") {
      leftPins.forEach((p, i) => { p.x = cx - hw - 20; p.y = cy + (i === 0 ? -20 : 20); });
      rightPins.forEach((p) => { p.x = cx + hw + 20; p.y = cy; });
      topPins.forEach((p) => { p.x = cx; p.y = cy - 40; });
      botPins.forEach((p) => { p.x = cx; p.y = cy + 40; });
    } else if (["nand", "nor", "and", "or", "inv"].includes(el.symbolShape)) {
      leftPins.forEach((p, i) => {
        p.x = cx - hw - 20;
        p.y = leftPins.length === 1 ? cy : cy + (i === 0 ? -20 : 20);
      });
      rightPins.forEach((p) => { p.x = cx + hw + 20; p.y = cy; });
      topPins.forEach((p) => { p.x = cx; p.y = cy - 40; });
      botPins.forEach((p) => { p.x = cx; p.y = cy + 40; });
    } else {
      leftPins.forEach((p, i) => { p.x = cx - hw - 20; p.y = snap(cy - hh + 40 + i * 40); });
      rightPins.forEach((p, i) => { p.x = cx + hw + 20; p.y = snap(cy - hh + 40 + i * 40); });
      topPins.forEach((p, i) => { p.x = snap(cx - 20 + i * 40); p.y = cy - hh - 20; });
      botPins.forEach((p, i) => { p.x = snap(cx - 20 + i * 40); p.y = cy + hh + 20; });
    }
  } else if (el.type === "term_vdd" || el.type === "term_gnd" || el.type === "term_neg") {
    el.pins.forEach(p => {
      if (el.type === "term_vdd") { p.x = cx; p.y = cy + 20; p.baseDir = "bottom"; p.dir = "bottom"; }
      else { p.x = cx; p.y = cy - 20; p.baseDir = "top"; p.dir = "top"; }
    });
  }

  // Apply flipX, flipY, and rotation (0, 90, 180, 270) around (cx, cy)
  const rot = (((el.rotation || 0) % 360) + 360) % 360;
  const fx = !!el.flipX;
  const fy = !!el.flipY;
  if (fx || fy || rot !== 0) {
    const dirList = ["top", "right", "bottom", "left"];
    el.pins.forEach(p => {
      if (p.x === undefined || p.y === undefined) return;
      let dx = p.x - cx;
      let dy = p.y - cy;
      let dir = p.baseDir || p.dir || "left";
      if (!p.baseDir) p.baseDir = dir;

      if (fx) {
        dx = -dx;
        if (dir === "left") dir = "right";
        else if (dir === "right") dir = "left";
      }
      if (fy) {
        dy = -dy;
        if (dir === "top") dir = "bottom";
        else if (dir === "bottom") dir = "top";
      }
      const steps = Math.round(rot / 90) % 4;
      for (let s = 0; s < steps; s++) {
        const ndx = -dy;
        const ndy = dx;
        dx = ndx;
        dy = ndy;
        const di = dirList.indexOf(dir);
        if (di !== -1) dir = dirList[(di + 1) % 4];
      }
      p.x = cx + dx;
      p.y = cy + dy;
      p.dir = dir;
    });
  }
}

/* ============================================================================
 * 8. 布线引擎：
 *    - 最高电压统一空心圆点，最低电压统一黑色圆点
 *    - 孤立没有连线的标签全部标注
 *    - 连线避开元件参数文字
 * ============================================================================ */
function routeSchematic(layout) {
  const { elements, width, height, symbolOffsets = {}, wireOffsets = {} } = layout;
  const cols = Math.ceil(width / GRID) + 2;
  const rows = Math.ceil(height / GRID) + 2;

  const obstacleGrid = Array.from({ length: rows }, () => new Uint8Array(cols));
  const textPenaltyGrid = Array.from({ length: rows }, () => new Uint8Array(cols));
  const hNetGrid = Array.from({ length: rows }, () => new Array(cols).fill(null));
  const vNetGrid = Array.from({ length: rows }, () => new Array(cols).fill(null));

  elements.forEach(el => {
    const x0 = Math.max(0, Math.floor((el.x - el.w / 2 + 10) / GRID));
    const x1 = Math.min(cols - 1, Math.ceil((el.x + el.w / 2 - 10) / GRID));
    const y0 = Math.max(0, Math.floor((el.y - el.h / 2 + 10) / GRID));
    const y1 = Math.min(rows - 1, Math.ceil((el.y + el.h / 2 - 10) / GRID));
    for (let r = y0; r <= y1; r++) {
      for (let c = x0; c <= x1; c++) obstacleGrid[r][c] = 1;
    }

    getDeviceTextBoxes(el).forEach(tb => {
      const tx0 = Math.max(0, Math.floor(tb.x1 / GRID));
      const tx1 = Math.min(cols - 1, Math.ceil(tb.x2 / GRID));
      const ty0 = Math.max(0, Math.floor(tb.y1 / GRID));
      const ty1 = Math.min(rows - 1, Math.ceil(tb.y2 / GRID));
      for (let r = ty0; r <= ty1; r++) {
        for (let c = tx0; c <= tx1; c++) textPenaltyGrid[r][c] = 1;
      }
    });
  });

  elements.forEach(el => el.pins.forEach(p => { delete p._handled; }));

  const netPins = {};
  elements.forEach(el => {
    el.pins.forEach(pin => {
      if (!netPins[pin.net]) netPins[pin.net] = [];
      netPins[pin.net].push({ el, pin, gx: Math.round(pin.x / GRID), gy: Math.round(pin.y / GRID) });
    });
  });

  const wires = [];
  const junctions = [];
  const symbols = [];

  // 电路图中的所有最高电压均显示成空白圆点，所有最低电压都显示成黑色圆点
  elements.forEach(el => {
    if (el.type === "term_vdd" || el.type === "term_gnd" || el.type === "term_neg") return;
    el.pins.forEach((pin, pIdx) => {
      if (isHighVoltNet(pin.net)) {
        symbols.push({
          id: `vdd_dot_${el.name}_${pin.name}_${pIdx}`,
          type: "vdd_dot",
          net: pin.net,
          x: pin.x,
          y: pin.y,
          dir: pin.dir
        });
        pin._handled = true;
      } else if (isLowVoltNet(pin.net)) {
        symbols.push({
          id: `gnd_dot_${el.name}_${pin.name}_${pIdx}`,
          type: "gnd_dot",
          net: pin.net,
          x: pin.x,
          y: pin.y,
          dir: pin.dir
        });
        pin._handled = true;
      } else if (isNegVoltNet(pin.net)) {
        symbols.push({
          id: `neg_dot_${el.name}_${pin.name}_${pIdx}`,
          type: "neg_dot",
          net: pin.net,
          x: pin.x,
          y: pin.y,
          dir: pin.dir
        });
        pin._handled = true;
      }
    });
  });

  // MOS 源衬同网短接
  elements.forEach(el => {
    if (el.type === "nmos" || el.type === "pmos") {
      const bPin = el.pins.find(p => p.name === "B");
      const sPin = el.pins.find(p => p.name === "S");
      if (bPin && sPin && !bPin._handled && bPin.net === sPin.net) {
        wires.push({
          net: bPin.net,
          points: [{ x: bPin.x, y: bPin.y }, { x: bPin.x, y: sPin.y }, { x: sPin.x, y: sPin.y }]
        });
        junctions.push({ net: bPin.net, x: sPin.x, y: sPin.y });
        bPin._handled = true;
      }
    }
  });

  Object.entries(netPins).forEach(([net, rawConns]) => {
    const conns = rawConns.filter(c => !c.pin._handled);
    if (conns.length === 0) return;

    // 孤立没有连线的标签全部同时标注
    if (conns.length === 1) {
      const c = conns[0];
      symbols.push({
        id: `port_${c.el.name}_${c.pin.name}_${net}`,
        type: "port",
        net,
        x: c.pin.x,
        y: c.pin.y,
        dir: c.pin.dir
      });
      return;
    }

    const connectedSet = [conns[0]];
    const remaining = conns.slice(1);
    const netSegments = [];
    const unroutedNodes = [];

    while (remaining.length > 0) {
      let bestIdx = 0, bestTarget = connectedSet[0], bestDist = Infinity;
      remaining.forEach((cand, idx) => {
        connectedSet.forEach(src => {
          const d = Math.abs(cand.gx - src.gx) + Math.abs(cand.gy - src.gy);
          if (d < bestDist) { bestDist = d; bestIdx = idx; bestTarget = src; }
        });
      });

      const nextNode = remaining.splice(bestIdx, 1)[0];
      let path = tryDirectStraightLine(nextNode.gx, nextNode.gy, bestTarget.gx, bestTarget.gy, net, obstacleGrid, textPenaltyGrid, hNetGrid, vNetGrid);
      if (!path) {
        path = astarOrthogonal(nextNode.gx, nextNode.gy, bestTarget.gx, bestTarget.gy, net, cols, rows, obstacleGrid, textPenaltyGrid, hNetGrid, vNetGrid, false);
      }
      if (!path) {
        path = astarOrthogonal(nextNode.gx, nextNode.gy, bestTarget.gx, bestTarget.gy, net, cols, rows, obstacleGrid, textPenaltyGrid, hNetGrid, vNetGrid, true);
      }

      if (path && path.length >= 2) {
        for (let i = 0; i < path.length - 1; i++) {
          const p1 = path[i], p2 = path[i + 1];
          if (p1.gy === p2.gy) {
            const c0 = Math.min(p1.gx, p2.gx), c1 = Math.max(p1.gx, p2.gx);
            for (let c = c0; c <= c1; c++) if (!hNetGrid[p1.gy][c]) hNetGrid[p1.gy][c] = net;
          } else {
            const r0 = Math.min(p1.gy, p2.gy), r1 = Math.max(p1.gy, p2.gy);
            for (let r = r0; r <= r1; r++) if (!vNetGrid[r][p1.gx]) vNetGrid[r][p1.gx] = net;
          }
        }
        const pts = simplifyPath(path.map(p => ({ x: p.gx * GRID, y: p.gy * GRID })));
        wires.push({ net, points: pts });
        netSegments.push(pts);
        connectedSet.push(nextNode);
      } else {
        unroutedNodes.push(bestTarget, nextNode);
      }
    }

    if (unroutedNodes.length > 0) {
      const seenPin = new Set();
      conns.forEach((anchor, idx) => {
        const key = `${anchor.el.name}.${anchor.pin.name}`;
        if (seenPin.has(key)) return;
        seenPin.add(key);
        symbols.push({ id: `port_${net}_${anchor.el.name}_${anchor.pin.name}_${idx}`, type: "port", net, x: anchor.pin.x, y: anchor.pin.y, dir: anchor.pin.dir });
      });
    }

    if (netSegments.length >= 2) {
      const endpoints = [];
      netSegments.forEach(seg => endpoints.push(seg[0], seg[seg.length - 1]));
      endpoints.forEach(pt => {
        for (let seg of netSegments) {
          for (let i = 0; i < seg.length - 1; i++) {
            const a = seg[i], b = seg[i + 1];
            if (a.x === b.x && pt.x === a.x && pt.y > Math.min(a.y, b.y) && pt.y < Math.max(a.y, b.y)) junctions.push({ net, x: pt.x, y: pt.y });
            if (a.y === b.y && pt.y === a.y && pt.x > Math.min(a.x, b.x) && pt.x < Math.max(a.x, b.x)) junctions.push({ net, x: pt.x, y: pt.y });
          }
        }
      });
    }
  });

  symbols.forEach(sym => {
    const off = symbolOffsets[sym.id];
    sym.drawX = off ? sym.x + off.dx : sym.x;
    sym.drawY = off ? sym.y + off.dy : sym.y;
  });

  wires.forEach((w, idx) => {
    const off = wireOffsets[idx];
    if (off && (off.dx || off.dy)) {
      w.points = w.points.map((pt, pIdx) => (pIdx === 0 || pIdx === w.points.length - 1) ? pt : { x: pt.x + off.dx, y: pt.y + off.dy });
    }
  });

  return { wires, junctions, symbols };
}

function getDeviceTextBoxes(el) {
  const { x, y, type } = el;
  if (type === "nmos" || type === "pmos") {
    return [{ x1: x + 22, y1: y - 34, x2: x + 82, y2: y - 14 }, { x1: x + 22, y1: y + 14, x2: x + 96, y2: y + 34 }];
  } else if (["pnp", "npn", "resistor", "inductor", "isource", "vsource", "vsin", "vpulse", "vsweep"].includes(type)) {
    return [{ x1: x + 12, y1: y - 18, x2: x + 92, y2: y + 18 }];
  } else if (type === "capacitor") {
    return [{ x1: x - 24, y1: y - 36, x2: x + 36, y2: y - 18 }, { x1: x - 24, y1: y + 18, x2: x + 36, y2: y + 36 }];
  }
  return [];
}

function tryDirectStraightLine(sx, sy, tx, ty, net, obstacleGrid, textPenaltyGrid, hNetGrid, vNetGrid) {
  if (sy === ty && sx !== tx) {
    const step = sx < tx ? 1 : -1;
    const pts = [{ gx: sx, gy: sy }];
    for (let x = sx + step; x !== tx + step; x += step) {
      const isEnd = (x === tx);
      if (!isEnd && (obstacleGrid[sy][x] === 1 || textPenaltyGrid[sy][x] === 1)) return null;
      if (hNetGrid[sy][x] && hNetGrid[sy][x] !== net) return null;
      pts.push({ gx: x, gy: sy });
    }
    return pts;
  }
  if (sx === tx && sy !== ty) {
    const step = sy < ty ? 1 : -1;
    const pts = [{ gx: sx, gy: sy }];
    for (let y = sy + step; y !== ty + step; y += step) {
      const isEnd = (y === ty);
      if (!isEnd && (obstacleGrid[y][sx] === 1 || textPenaltyGrid[y][sx] === 1)) return null;
      if (vNetGrid[y][sx] && vNetGrid[y][sx] !== net) return null;
      pts.push({ gx: sx, gy: y });
    }
    return pts;
  }
  return null;
}

function astarOrthogonal(sx, sy, tx, ty, net, cols, rows, obstacleGrid, textPenaltyGrid, hNetGrid, vNetGrid, allowOverlap = false) {
  if (sx === tx && sy === ty) return [{ gx: sx, gy: sy }];
  const dirs = [{ dx: 1, dy: 0, id: 0 }, { dx: -1, dy: 0, id: 1 }, { dx: 0, dy: 1, id: 2 }, { dx: 0, dy: -1, id: 3 }];
  const open = [{ gx: sx, gy: sy, dir: -1, g: 0, f: Math.abs(sx - tx) + Math.abs(sy - ty), parent: null }];
  const bestCost = new Map();
  let steps = 0;

  while (open.length > 0 && steps < 8000) {
    steps++;
    let minIdx = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[minIdx].f) minIdx = i;
    const curr = open.splice(minIdx, 1)[0];

    const hitSameNet = (curr.gx !== sx || curr.gy !== sy) && (hNetGrid[curr.gy][curr.gx] === net || vNetGrid[curr.gy][curr.gx] === net);
    if ((curr.gx === tx && curr.gy === ty) || hitSameNet) {
      const path = [];
      let p = curr;
      while (p) { path.push({ gx: p.gx, gy: p.gy }); p = p.parent; }
      return path.reverse();
    }

    for (let d of dirs) {
      const nx = curr.gx + d.dx, ny = curr.gy + d.dy;
      if (nx < 1 || nx >= cols - 1 || ny < 1 || ny >= rows - 1) continue;
      const isTarget = (nx === tx && ny === ty);
      if (!isTarget && obstacleGrid[ny][nx] === 1) continue;

      const isHoriz = d.dx !== 0;
      if (!allowOverlap) {
        if (isHoriz && hNetGrid[ny][nx] && hNetGrid[ny][nx] !== net) continue;
        if (!isHoriz && vNetGrid[ny][nx] && vNetGrid[ny][nx] !== net) continue;
      }

      let cost = 10;
      if (allowOverlap && ((isHoriz && hNetGrid[ny][nx] && hNetGrid[ny][nx] !== net) || (!isHoriz && vNetGrid[ny][nx] && vNetGrid[ny][nx] !== net))) {
        cost += 900;
      }
      if (curr.dir !== -1 && curr.dir !== d.id) cost += 35;
      if (!isTarget && textPenaltyGrid[ny][nx] === 1) cost += 700;
      if (isHoriz && vNetGrid[ny][nx] && vNetGrid[ny][nx] !== net) cost += 400;
      if (!isHoriz && hNetGrid[ny][nx] && hNetGrid[ny][nx] !== net) cost += 400;
      if ((isHoriz && hNetGrid[ny][nx] === net) || (!isHoriz && vNetGrid[ny][nx] === net)) cost = 2;

      const ng = curr.g + cost;
      const key = `${nx},${ny},${d.id}`;
      if (!bestCost.has(key) || ng < bestCost.get(key)) {
        bestCost.set(key, ng);
        open.push({ gx: nx, gy: ny, dir: d.id, g: ng, f: ng + (Math.abs(nx - tx) + Math.abs(ny - ty)) * 10, parent: curr });
      }
    }
  }
  return null;
}

function simplifyPath(pts) {
  if (pts.length <= 2) return pts;
  const res = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const p = res[res.length - 1], c = pts[i], n = pts[i + 1];
    if ((p.x === c.x && c.x === n.x) || (p.y === c.y && c.y === n.y)) continue;
    res.push(c);
  }
  res.push(pts[pts.length - 1]);
  return res;
}


export {
  layoutSubckt,
  getElementBoxSize,
  computePinPositions,
  routeSchematic,
  simplifyPath
};
