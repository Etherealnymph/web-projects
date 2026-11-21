import { isHighVoltNet, isLowVoltNet, isNegVoltNet } from './pdk-parser.js';

/* ============================================================================
 * 16. 数据版本化 (Schema v2)、友好 Toast 错误边界与真实 MNA 电路求解器
 * ============================================================================ */
const EDA_SCHEMA_VERSION = 2;

function maskApiKey(key) {
  if (!key || key.length < 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

function showToast(message, type = "info", duration = 3500) {
  if (typeof document === "undefined") return;
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `eda-toast ${type}`;
  toast.innerHTML = `<span>${message}</span><button class="q-btn" style="padding:1px 6px;font-size:11px;" onclick="this.parentElement.remove()">✕</button>`;
  container.appendChild(toast);
  setTimeout(() => { if (toast.parentElement) toast.remove(); }, duration);
}

function parseEngineeringValue(str, fallback = 1) {
  if (typeof str === "number") return isFinite(str) ? str : fallback;
  if (!str) return fallback;
  const m = String(str).trim().match(/^([-+]?[\d.]+(?:e[-+]?\d+)?)([a-zA-Z]*)/i);
  if (!m) return fallback;
  const num = parseFloat(m[1]);
  if (isNaN(num)) return fallback;
  const unit = m[2].toLowerCase();
  const mults = { f: 1e-15, p: 1e-12, n: 1e-9, u: 1e-6, m: 1e-3, k: 1e3, meg: 1e6, g: 1e9, t: 1e12 };
  return num * (mults[unit] || 1);
}

function solveLinearSystem(A, b) {
  const n = b.length;
  if (n === 0) return [];
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    if (Math.abs(M[piv][col]) < 1e-15) {
      throw new Error("Singular MNA matrix: check for floating nodes, missing ground (0/GND), or parallel voltage source loops.");
    }
    [M[col], M[piv]] = [M[piv], M[col]];
    const div = M[col][col];
    for (let j = col; j <= n; j++) M[col][j] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      if (factor === 0) continue;
      for (let j = col; j <= n; j++) M[r][j] -= factor * M[col][j];
    }
  }
  return M.map(row => row[n]);
}

function solveComplexLinearSystem(Ar, Ai, br, bi) {
  const n = br.length;
  if (n === 0) return { xr: [], xi: [] };
  const A = Array.from({ length: 2 * n }, () => new Array(2 * n).fill(0));
  const b = new Array(2 * n).fill(0);
  for (let r = 0; r < n; r++) {
    b[r] = br[r];
    b[r + n] = bi[r];
    for (let c = 0; c < n; c++) {
      A[r][c] = Ar[r][c];
      A[r][c + n] = -Ai[r][c];
      A[r + n][c] = Ai[r][c];
      A[r + n][c + n] = Ar[r][c];
    }
  }
  const sol = solveLinearSystem(A, b);
  return { xr: sol.slice(0, n), xi: sol.slice(n, 2 * n) };
}

function evalSourceWaveform(el, t, defaultDc = 1.8) {
  const dc = parseEngineeringValue(el.params?.dc, defaultDc);
  if (el.type === "vsin") {
    const offset = parseEngineeringValue(el.params?.dc ?? el.params?.v0, 0.9);
    const ampl = parseEngineeringValue(el.params?.ampl ?? el.params?.va, 0.1);
    const freq = parseEngineeringValue(el.params?.freq, 10e6);
    return offset + ampl * Math.sin(2 * Math.PI * freq * t);
  }
  if (el.type === "vpulse") {
    const v1 = parseEngineeringValue(el.params?.val0 ?? el.params?.v1, 0);
    const v2 = parseEngineeringValue(el.params?.val1 ?? el.params?.v2, 1.8);
    const per = Math.max(1e-12, parseEngineeringValue(el.params?.period ?? el.params?.per, 100e-9));
    const pw = parseEngineeringValue(el.params?.width ?? el.params?.pw, per * 0.5);
    const cyc = t % per;
    return cyc < pw ? v2 : v1;
  }
  return dc;
}

function evalStimulusAtTime(stim, t) {
  if (!stim || !stim.type || stim.type === "none") return 0;
  const ampl = Number(stim.ampl ?? 1.0);
  const freq = Math.max(1, Number(stim.freqHz ?? 10e6));
  const offset = Number(stim.offset ?? 0);
  const tMax = Math.max(1e-12, Number(stim.tStop ?? 10e-6));
  if (stim.type === "sine") return offset + ampl * Math.sin(2 * Math.PI * freq * t);
  if (stim.type === "pulse") {
    const per = 1 / freq;
    return (t % per) < 0.5 * per ? offset + ampl : offset;
  }
  if (stim.type === "step") {
    return t < tMax * 0.15 ? offset : offset + ampl;
  }
  if (stim.type === "chirp") {
    const fInst = freq * (0.2 + 1.8 * (t / tMax));
    return offset + ampl * Math.sin(2 * Math.PI * fInst * t);
  }
  return offset;
}

function estimateSupplyVoltage(elements) {
  for (const el of elements) {
    if (["vsource", "vsin", "vpulse", "vsweep"].includes(el.type)) {
      const p0 = el.pins?.[0]?.net || "";
      if (isHighVoltNet(p0)) {
        const v = parseEngineeringValue(el.params?.dc, 1.8);
        if (isFinite(v) && v > 0) return v;
      }
    }
  }
  return 1.8;
}

function buildMnaSystem(elements, dt = 0, prevState = null, stimOverride = null, options = {}) {
  const nodeMap = new Map();
  const isGnd = (n) => isLowVoltNet(n);
  const getNodeIdx = (n) => {
    if (!n || isGnd(n)) return -1;
    if (!nodeMap.has(n)) nodeMap.set(n, nodeMap.size);
    return nodeMap.get(n);
  };

  const vsources = [];
  (elements || []).forEach(el => {
    (el.pins || []).forEach(p => getNodeIdx(p.net));
    if (["vsource", "vsin", "vpulse", "vsweep", "inductor"].includes(el.type)) {
      vsources.push(el);
    }
  });
  if (stimOverride && stimOverride.node && !isGnd(stimOverride.node)) {
    getNodeIdx(stimOverride.node);
    const existingIdx = vsources.findIndex(vs =>
      vs.type !== "inductor" &&
      vs.pins?.[0]?.net === stimOverride.node &&
      isGnd(vs.pins?.[1]?.net)
    );
    if (existingIdx >= 0) {
      vsources[existingIdx] = { ...vsources[existingIdx], __overrideVal: stimOverride.val, __isStimTarget: true };
    } else {
      vsources.push({ type: "__stim_v__", pins: [{ net: stimOverride.node }, { net: "0" }], val: stimOverride.val, __isStimTarget: true });
    }
  }

  const N = nodeMap.size;
  const M = vsources.length;
  const dim = N + M;
  if (dim === 0) return { nodeMap, vsources, G: [], C: [], rhs: [], dim: 0, N: 0, mosOps: {} };

  const G = Array.from({ length: dim }, () => new Array(dim).fill(0));
  const C = Array.from({ length: dim }, () => new Array(dim).fill(0));
  const rhs = new Array(dim).fill(0);
  const mosOps = {};

  // Weak Gmin to ground for numerical stability
  for (let i = 0; i < N; i++) G[i][i] += 1e-9;

  const stampG = (n1, n2, g) => {
    if (n1 >= 0) G[n1][n1] += g;
    if (n2 >= 0) G[n2][n2] += g;
    if (n1 >= 0 && n2 >= 0) { G[n1][n2] -= g; G[n2][n1] -= g; }
  };
  const stampC = (n1, n2, c) => {
    if (n1 >= 0) C[n1][n1] += c;
    if (n2 >= 0) C[n2][n2] += c;
    if (n1 >= 0 && n2 >= 0) { C[n1][n2] -= c; C[n2][n1] -= c; }
  };

  const vddGuess = estimateSupplyVoltage(elements || []);
  const pdk = options.pdkParams || {};
  const tNow = options.t ?? 0;

  // Heuristic initial node voltage guess from power rails when prevState is absent
  const guessNodeV = (net, idx, roleHint = "mid") => {
    if (idx < 0) return 0;
    if (prevState && prevState.V && isFinite(prevState.V[idx])) return prevState.V[idx];
    if (isHighVoltNet(net)) return vddGuess;
    if (isNegVoltNet(net)) return -vddGuess;
    if (roleHint === "pmos_s") return vddGuess;
    if (roleHint === "nmos_s") return 0;
    return vddGuess * 0.5;
  };

  (elements || []).forEach(el => {
    if (el.type === "resistor") {
      const r = Math.max(1e-3, parseEngineeringValue(el.params?.r, 1e3));
      stampG(getNodeIdx(el.pins[0]?.net), getNodeIdx(el.pins[1]?.net), 1 / r);
    } else if (el.type === "capacitor") {
      const c = Math.max(1e-16, parseEngineeringValue(el.params?.c, 1e-12));
      const n1 = getNodeIdx(el.pins[0]?.net), n2 = getNodeIdx(el.pins[1]?.net);
      stampC(n1, n2, c);
      if (dt > 0) {
        const geq = (2 * c) / dt;
        stampG(n1, n2, geq);
        if (prevState) {
          const v1 = n1 >= 0 ? (prevState.V[n1] || 0) : 0;
          const v2 = n2 >= 0 ? (prevState.V[n2] || 0) : 0;
          const icPrev = prevState.capI?.[el.name] || 0;
          const ieq = geq * (v1 - v2) + icPrev;
          if (n1 >= 0) rhs[n1] += ieq;
          if (n2 >= 0) rhs[n2] -= ieq;
        }
      }
    } else if (el.type === "isource") {
      const iVal = parseEngineeringValue(el.params?.dc, 20e-6);
      const n1 = getNodeIdx(el.pins[0]?.net), n2 = getNodeIdx(el.pins[1]?.net);
      if (n1 >= 0) rhs[n1] -= iVal;
      if (n2 >= 0) rhs[n2] += iVal;
    } else if (el.type === "vccs") {
      const gm = parseEngineeringValue(el.params?.gm, 1e-3);
      const op = getNodeIdx(el.pins[0]?.net), on = getNodeIdx(el.pins[1]?.net);
      const ip = getNodeIdx(el.pins[2]?.net), in_ = getNodeIdx(el.pins[3]?.net);
      if (op >= 0 && ip >= 0) G[op][ip] += gm;
      if (op >= 0 && in_ >= 0) G[op][in_] -= gm;
      if (on >= 0 && ip >= 0) G[on][ip] -= gm;
      if (on >= 0 && in_ >= 0) G[on][in_] += gm;
    } else if (el.type === "nmos" || el.type === "pmos") {
      const dNet = el.pins[0]?.net, gNet = el.pins[1]?.net, sNet = el.pins[2]?.net;
      const d = getNodeIdx(dNet), g = getNodeIdx(gNet), s = getNodeIdx(sNet);
      const w = parseEngineeringValue(el.params?.w, 10e-6);
      const l = parseEngineeringValue(el.params?.l, 1e-6);
      const baseKpN = pdk.kpN ?? 180e-6;
      const baseKpP = pdk.kpP ?? 60e-6;
      const lambda = pdk.lambda ?? 0.02;
      const baseVth = Math.abs(pdk.vth0 ?? 0.5);
      const kp = (el.type === "nmos" ? baseKpN : baseKpP) * (w / Math.max(1e-7, l));
      const vg = guessNodeV(gNet, g, "mid");
      const vs = guessNodeV(sNet, s, el.type === "pmos" ? "pmos_s" : "nmos_s");
      const vd = guessNodeV(dNet, d, "mid");
      const sign = el.type === "nmos" ? 1 : -1;
      const vgs = sign * (vg - vs);
      const vds = Math.max(0.01, sign * (vd - vs));
      const vov = Math.max(0.02, vgs - baseVth);
      let idVal, gm, gds, region;
      if (vgs <= baseVth) {
        region = "Subthreshold/Cutoff";
        idVal = 0.5 * kp * 0.02 * 0.02 * (1 + lambda * vds);
        gm = kp * 0.02 * (1 + lambda * vds) * 0.1;
        gds = Math.max(1e-7, lambda * idVal);
      } else if (vds >= vov) {
        region = "Saturation";
        idVal = 0.5 * kp * vov * vov * (1 + lambda * vds);
        gm = kp * vov * (1 + lambda * vds);
        gds = Math.max(1e-6, lambda * 0.5 * kp * vov * vov);
      } else {
        region = "Triode";
        idVal = kp * ((vov * vds) - 0.5 * vds * vds);
        gm = kp * vds;
        gds = Math.max(1e-6, kp * (vov - vds));
      }
      stampG(d, s, gds);
      if (d >= 0 && g >= 0) G[d][g] += sign * gm;
      if (s >= 0 && g >= 0) G[s][g] -= sign * gm;
      const id0 = sign * (idVal - gm * vgs - gds * vds);
      if (d >= 0) rhs[d] -= id0;
      if (s >= 0) rhs[s] += id0;
      if (el.name) {
        mosOps[el.name] = { id: idVal, gm, gds, ro: 1 / Math.max(1e-9, gds), vgs, vds, region };
      }
    }
  });

  vsources.forEach((vs, k) => {
    const row = N + k;
    const np = getNodeIdx(vs.pins[0]?.net), nn = getNodeIdx(vs.pins[1]?.net);
    if (np >= 0) { G[np][row] += 1; G[row][np] += 1; }
    if (nn >= 0) { G[nn][row] -= 1; G[row][nn] -= 1; }
    if (vs.type === "inductor") {
      const lVal = Math.max(1e-12, parseEngineeringValue(vs.params?.l, 1e-9));
      if (dt > 0) {
        const req = (2 * lVal) / dt;
        G[row][row] -= req;
        if (prevState) {
          const vp = np >= 0 ? (prevState.V[np] || 0) : 0;
          const vn = nn >= 0 ? (prevState.V[nn] || 0) : 0;
          const ilPrev = prevState.V[row] || 0;
          rhs[row] = -(vp - vn + req * ilPrev);
        }
      } else {
        G[row][row] -= 1e-4; // DC short
      }
    } else if (vs.type === "__stim_v__") {
      rhs[row] = vs.val;
    } else if (vs.__overrideVal !== undefined) {
      rhs[row] = vs.__overrideVal;
    } else {
      rhs[row] = dt > 0 ? evalSourceWaveform(vs, tNow, 1.8) : parseEngineeringValue(vs.params?.dc, 1.8);
    }
  });

  return { nodeMap, vsources, G, C, rhs, dim, N, mosOps };
}

function solveMnaDc(elements, options = {}) {
  const maxIter = options.maxIter ?? 30;
  const tol = options.tol ?? 1e-6;
  let state = options.initialState || null;
  let converged = false;
  let iterations = 0;

  for (let iter = 0; iter < maxIter; iter++) {
    iterations = iter + 1;
    const sys = buildMnaSystem(elements, 0, state, options.stimOverride || null, options);
    if (sys.dim === 0) {
      return options.returnFull ? { nodeVoltages: {}, mosOps: {}, state: null, converged: true, iterations: 0 } : {};
    }
    const sol = solveLinearSystem(sys.G, sys.rhs);
    let maxDelta = 0;
    if (state && state.V) {
      for (let i = 0; i < sys.N; i++) {
        maxDelta = Math.max(maxDelta, Math.abs(sol[i] - (state.V[i] ?? 0)));
      }
    } else {
      maxDelta = Infinity;
    }
    state = { V: sol };
    if (iter > 0 && maxDelta < tol) {
      converged = true;
      break;
    }
  }

  const sys = buildMnaSystem(elements, 0, state, options.stimOverride || null, options);
  const res = {};
  sys.nodeMap.forEach((idx, net) => {
    const v = state.V[idx];
    if (isFinite(v)) res[net] = v;
  });

  if (options.returnFull) {
    return { nodeVoltages: res, mosOps: sys.mosOps, state, converged, iterations };
  }
  return res;
}

function simulateDC(elements, options = {}) {
  const warnings = [];
  if (!elements || elements.length === 0) {
    return { type: "dc", xLabel: "Sweep Voltage (V)", xScale: 1, xVals: [], series: {}, nodeVoltages: {}, mosOps: {}, converged: true, warnings };
  }

  if (options.sweepNode) {
    const numPoints = options.numPoints ?? 120;
    const vStart = options.vStart ?? 0;
    const vStop = options.vStop ?? 2.5;
    const xVals = Array.from({ length: numPoints }, (_, i) => vStart + (i / (numPoints - 1)) * (vStop - vStart));
    const series = {};
    let prevState = null;
    let nonConvergedCount = 0;

    xVals.forEach((v) => {
      const stepRes = solveMnaDc(elements, {
        ...options,
        stimOverride: { node: options.sweepNode, val: v },
        initialState: prevState,
        returnFull: true
      });
      prevState = stepRes.state;
      if (!stepRes.converged) nonConvergedCount++;
      Object.entries(stepRes.nodeVoltages).forEach(([net, nv]) => {
        if (!series[net]) series[net] = [];
        series[net].push(nv);
      });
    });

    if (nonConvergedCount > 0) {
      warnings.push(`DC sweep had ${nonConvergedCount} step(s) reaching max Newton iterations.`);
    }
    return { type: "dc", xLabel: `Sweep ${options.sweepNode} (V)`, xScale: 1, xVals, series, warnings };
  }

  const op = solveMnaDc(elements, { ...options, returnFull: true });
  if (!op.converged) {
    warnings.push(`DC operating point reached max ${options.maxIter ?? 30} Newton iterations.`);
  }
  return { type: "dc", ...op, warnings };
}

function simulateTran(elements, tStop = 10e-6, options = {}) {
  const warnings = [];
  const numSteps = options.numSteps ?? 256;
  const totalT = Math.max(1e-12, tStop);
  const dt = totalT / (numSteps - 1);
  const xVals = Array.from({ length: numSteps }, (_, i) => i * dt);
  const series = {};

  if (!elements || elements.length === 0) {
    return { type: "tran", xLabel: totalT < 1e-6 ? "Time (ns)" : "Time (us)", xScale: totalT < 1e-6 ? 1e9 : 1e6, xVals, series, warnings };
  }

  const stim = options.stim && options.stim.type && options.stim.type !== "none" && options.stim.node
    ? { ...options.stim, tStop: totalT }
    : null;

  // Initialize from t=0 DC operating point
  const t0Stim = stim ? { node: stim.node, val: evalStimulusAtTime(stim, 0) } : null;
  const dcInit = solveMnaDc(elements, { ...options, stimOverride: t0Stim, returnFull: true });
  let prevState = {
    V: dcInit.state ? [...dcInit.state.V] : [],
    capI: {}
  };

  xVals.forEach((t, stepIdx) => {
    const stimOverride = stim ? { node: stim.node, val: evalStimulusAtTime(stim, t) } : null;
    if (stepIdx === 0) {
      Object.entries(dcInit.nodeVoltages).forEach(([net, v]) => {
        if (!series[net]) series[net] = [];
        series[net].push(v);
      });
      return;
    }

    const sys = buildMnaSystem(elements, dt, prevState, stimOverride, { ...options, t });
    if (sys.dim === 0) return;
    const sol = solveLinearSystem(sys.G, sys.rhs);

    // Update capacitor branch currents using trapezoidal rule
    const nextCapI = {};
    elements.forEach(el => {
      if (el.type === "capacitor") {
        const c = Math.max(1e-16, parseEngineeringValue(el.params?.c, 1e-12));
        const n1 = sys.nodeMap.get(el.pins[0]?.net) ?? -1;
        const n2 = sys.nodeMap.get(el.pins[1]?.net) ?? -1;
        const v1 = n1 >= 0 ? (sol[n1] || 0) : 0;
        const v2 = n2 >= 0 ? (sol[n2] || 0) : 0;
        const v1p = n1 >= 0 ? (prevState.V[n1] || 0) : 0;
        const v2p = n2 >= 0 ? (prevState.V[n2] || 0) : 0;
        const icPrev = prevState.capI?.[el.name] || 0;
        nextCapI[el.name] = ((2 * c) / dt) * ((v1 - v2) - (v1p - v2p)) - icPrev;
      }
    });

    prevState = { V: sol, capI: nextCapI };
    sys.nodeMap.forEach((idx, net) => {
      if (!series[net]) series[net] = [];
      series[net].push(isFinite(sol[idx]) ? sol[idx] : 0);
    });
  });

  const useNs = totalT < 1e-6;
  return {
    type: "tran",
    xLabel: useNs ? "Time (ns)" : "Time (us)",
    xScale: useNs ? 1e9 : 1e6,
    xVals,
    series,
    warnings
  };
}

function simulateAC(elements, options = {}) {
  const warnings = [];
  if (!elements || elements.length === 0) {
    return { type: "ac", freqs: [], seriesDb: {}, warnings };
  }

  // Constrain AC frequency sweep to physically meaningful range
  const fStart = Math.max(1, options.fStart ?? 10);
  const fStop = Math.min(10e9, Math.max(fStart * 10, options.fStop ?? 1e9));
  const numPoints = options.numPoints ?? 160;
  const logStart = Math.log10(fStart);
  const logStop = Math.log10(fStop);
  const freqs = Array.from({ length: numPoints }, (_, i) => Math.pow(10, logStart + (i / (numPoints - 1)) * (logStop - logStart)));

  const dcOp = solveMnaDc(elements, { ...options, returnFull: true });
  if (!dcOp.converged) {
    warnings.push("AC linearization performed at unconverged DC point.");
  }

  const stimNode = options.stimNode && !isLowVoltNet(options.stimNode) ? options.stimNode : null;
  const stimAmpl = Number(options.stimAmpl ?? 1.0);
  const stimOverride = stimNode ? { node: stimNode, val: 0 } : null;
  const sys = buildMnaSystem(elements, 0, dcOp.state, stimOverride, options);

  const seriesDb = {};
  if (sys.dim === 0) return { type: "ac", freqs, seriesDb, warnings };

  sys.nodeMap.forEach((_, net) => { seriesDb[net] = []; });

  const br = new Array(sys.dim).fill(0);
  const bi = new Array(sys.dim).fill(0);

  // Set AC excitation on __stim_v__ or first non-power voltage source
  let acSourceSet = false;
  sys.vsources.forEach((vs, k) => {
    const row = sys.N + k;
    if (vs.type === "__stim_v__" || vs.__isStimTarget) {
      br[row] = stimAmpl;
      acSourceSet = true;
    } else if (!acSourceSet && (vs.type === "vsweep" || vs.type === "vsin" || (vs.params && vs.params.ac))) {
      br[row] = parseEngineeringValue(vs.params?.ac ?? vs.params?.ampl, stimAmpl);
      acSourceSet = true;
    }
  });
  if (!acSourceSet && sys.vsources.length > 0) {
    // Fallback: excite last non-inductor voltage source
    for (let k = sys.vsources.length - 1; k >= 0; k--) {
      if (sys.vsources[k].type !== "inductor") {
        br[sys.N + k] = stimAmpl;
        break;
      }
    }
  }

  freqs.forEach((fHz) => {
    const omega = 2 * Math.PI * fHz;
    const Ar = sys.G.map(row => [...row]);
    const Ai = sys.C.map(row => row.map(val => omega * val));
    // Stamp inductor j*omega*L impedance in MNA branch rows
    sys.vsources.forEach((vs, k) => {
      if (vs.type === "inductor") {
        const row = sys.N + k;
        const lVal = Math.max(1e-12, parseEngineeringValue(vs.params?.l, 1e-9));
        Ar[row][row] = 0; // Remove DC short placeholder
        Ai[row][row] -= omega * lVal;
      }
    });
    const { xr, xi } = solveComplexLinearSystem(Ar, Ai, br, bi);
    sys.nodeMap.forEach((idx, net) => {
      const mag = Math.hypot(xr[idx] || 0, xi[idx] || 0);
      const db = 20 * Math.log10(Math.max(1e-12, mag));
      seriesDb[net].push(db);
    });
  });

  return { type: "ac", freqs, seriesDb, warnings };
}

export {
  EDA_SCHEMA_VERSION,
  maskApiKey,
  showToast,
  parseEngineeringValue,
  solveLinearSystem,
  solveComplexLinearSystem,
  buildMnaSystem,
  solveMnaDc,
  simulateDC,
  simulateTran,
  simulateAC
};
