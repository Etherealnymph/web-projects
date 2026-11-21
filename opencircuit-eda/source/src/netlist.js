import { isHighVoltNet, isLowVoltNet, isNegVoltNet } from './pdk-parser.js';

/* ============================================================================
 * 6A. Verilog & VHDL 图形化解析器
 * ============================================================================ */
function detectHdlLanguage(text, fileName = "") {
  const fn = (fileName || "").toLowerCase();
  if (/\.(v|sv)$/.test(fn)) return "verilog";
  if (/\.(vhd|vhdl)$/.test(fn)) return "vhdl";
  if (/^\s*module\s+[a-zA-Z_]\w*/m.test(text) && /\bendmodule\b/.test(text)) return "verilog";
  if (/^\s*entity\s+[a-zA-Z_]\w*\s+is\b/im.test(text) && /\barchitecture\b/i.test(text)) return "vhdl";
  return "spectre";
}

function makeHdlGateElement(name, gateType, inNets, outNet, lineNo, extraPins = null, params = {}) {
  let pins = [];
  if (extraPins) {
    pins = extraPins;
  } else {
    inNets.forEach((n, idx) => pins.push({ name: `I${idx + 1}`, net: n, dir: "left" }));
    pins.push({ name: "Y", net: outNet, dir: "right" });
  }
  return {
    name,
    nodes: pins.map(p => p.net),
    model: gateType.replace("gate_", "").toUpperCase(),
    params,
    type: gateType,
    pins,
    line: lineNo
  };
}

function parseVerilogExprToGates(lhs, rhs, lineNo, elements, autoIdxRef) {
  const clean = rhs.trim().replace(/;$/, "").trim();
  const muxM = clean.match(/^(.+?)\?(.+?):(.+)$/);
  if (muxM) {
    const sel = muxM[1].trim(), d1 = muxM[2].trim(), d0 = muxM[3].trim();
    const gName = `MUX_${++autoIdxRef.n}`;
    elements.push(makeHdlGateElement(gName, "mux2", [], lhs, lineNo, [
      { name: "D0", net: d0, dir: "left" },
      { name: "D1", net: d1, dir: "left" },
      { name: "SEL", net: sel, dir: "bottom" },
      { name: "Y", net: lhs, dir: "right" }
    ]));
    return gName;
  }
  const notM = clean.match(/^[~!]+\s*\(?([a-zA-Z_]\w*)\)?$/);
  if (notM) {
    const gName = `INV_${++autoIdxRef.n}`;
    elements.push(makeHdlGateElement(gName, "gate_inv", [notM[1]], lhs, lineNo));
    return gName;
  }
  const binM = clean.match(/^([a-zA-Z_]\w*)\s*(&|\||\^|~&|~\||~\^)\s*([a-zA-Z_]\w*)$/);
  if (binM) {
    const opMap = { "&": "gate_and", "|": "gate_or", "^": "gate_xor", "~&": "gate_nand", "~|": "gate_nor", "~^": "gate_xnor" };
    const gt = opMap[binM[2]] || "gate_and";
    const gName = `${gt.replace("gate_", "").toUpperCase()}_${++autoIdxRef.n}`;
    elements.push(makeHdlGateElement(gName, gt, [binM[1], binM[3]], lhs, lineNo));
    return gName;
  }
  const bufM = clean.match(/^([a-zA-Z_]\w*)$/);
  if (bufM) {
    const gName = `BUF_${++autoIdxRef.n}`;
    elements.push(makeHdlGateElement(gName, "gate_buf", [bufM[1]], lhs, lineNo));
    return gName;
  }
  return null;
}

function stripVerilogComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").split(/\r?\n/).map(l => l.replace(/\/\/.*$/, "")).join("\n");
}

function parseVerilogToDesign(text) {
  const cleanText = stripVerilogComments(text);
  const subckts = {};
  const lineMap = new Map();
  const autoIdxRef = { n: 0 };

  const modRegex = /module\s+([a-zA-Z_]\w*)\s*(?:#\s*\([^)]*\))?\s*(?:\(([\s\S]*?)\))?\s*;([\s\S]*?)endmodule/g;
  let mm;
  while ((mm = modRegex.exec(cleanText)) !== null) {
    const modName = mm[1];
    const portHeader = mm[2] || "";
    const body = mm[3] || "";
    const modLine = cleanText.slice(0, mm.index).split("\n").length;
    const curMod = { name: modName, ports: [], portDirs: {}, elements: [], line: modLine };
    subckts[modName] = curMod;

    // Parse multi-line port header
    portHeader.split(",").forEach(rawP => {
      const p = rawP.trim();
      if (!p) return;
      const toks = p.replace(/\[[^\]]+\]/g, " ").trim().split(/\s+/);
      const pName = toks[toks.length - 1];
      if (pName && /^[a-zA-Z_]\w*$/.test(pName)) {
        if (!curMod.ports.includes(pName)) curMod.ports.push(pName);
        if (toks.includes("output")) curMod.portDirs[pName] = "output";
        else if (toks.includes("inout")) curMod.portDirs[pName] = "inout";
        else curMod.portDirs[pName] = "input";
      }
    });

    // Extract always @( ... ) blocks first
    let restBody = body.replace(/always(?:_ff)?\s*@\s*\(([^)]*)\)\s*begin([\s\S]*?)\bend\b/g, (full, ev, blk, offset) => {
      const lNo = modLine + body.slice(0, offset).split("\n").length - 1;
      const clkM = ev.match(/(?:posedge|negedge)\s+([a-zA-Z_]\w*)/);
      const clkNet = clkM ? clkM[1] : "clk";
      const rstM = ev.match(/or\s+(?:posedge|negedge)\s+([a-zA-Z_]\w*)/);
      const rstNet = rstM ? rstM[1] : null;
      const enM = blk.match(/else\s+if\s*\(\s*([a-zA-Z_]\w*)\s*\)/);
      const enNet = enM ? enM[1] : null;

      const nbaRegex = /([a-zA-Z_]\w*)\s*<=\s*([^;]+);/g;
      let am;
      const handledTargets = new Set();
      while ((am = nbaRegex.exec(blk)) !== null) {
        const target = am[1], rhs = am[2].trim();
        if (/^\d+'[bdho][0-9a-fA-F_xXzZ]+$|^0$/.test(rhs)) continue; // skip reset constant
        if (handledTargets.has(target)) continue;
        handledTargets.add(target);

        if (new RegExp("\\b" + target + "\\b\\s*[+-]").test(rhs)) {
          // Counter / Accumulator Register
          const cntName = `CNT_${target}`;
          const pins = [{ name: "CLK", net: clkNet, dir: "left" }];
          if (rstNet) pins.push({ name: "RST", net: rstNet, dir: "left" });
          if (enNet) pins.push({ name: "EN", net: enNet, dir: "left" });
          pins.push({ name: "Q", net: target, dir: "right" });
          curMod.elements.push(makeHdlGateElement(cntName, "dff", [], target, lNo, pins, { mode: "counter" }));
          lineMap.set(lNo, { name: cntName, subckt: modName });
        } else {
          const ffName = `DFF_${target}`;
          const pins = [{ name: "D", net: rhs.replace(/[^a-zA-Z0-9_]/g, "") || "d", dir: "left" }, { name: "CLK", net: clkNet, dir: "left" }];
          if (rstNet) pins.push({ name: "RST", net: rstNet, dir: "bottom" });
          if (enNet) pins.push({ name: "EN", net: enNet, dir: "left" });
          pins.push({ name: "Q", net: target, dir: "right" });
          curMod.elements.push(makeHdlGateElement(ffName, "dff", [], target, lNo, pins));
          lineMap.set(lNo, { name: ffName, subckt: modName });
        }
      }
      return "";
    });

    // Parse statements in remaining body
    restBody.split(";").forEach((stmtRaw, sIdx) => {
      const stmt = stmtRaw.trim();
      if (!stmt) return;
      const lNo = modLine + sIdx + 1;
      const portDecl = stmt.match(/^(input|output|inout)\s+(?:wire|reg|logic)?\s*(?:\[[^\]]+\])?\s*(.+)$/);
      if (portDecl) {
        portDecl[2].split(",").forEach(p => {
          const pName = p.trim().split(/\s+/).pop();
          if (pName && /^[a-zA-Z_]\w*$/.test(pName)) {
            if (!curMod.ports.includes(pName)) curMod.ports.push(pName);
            curMod.portDirs[pName] = portDecl[1];
          }
        });
        return;
      }
      const gateM = stmt.match(/^(and|nand|or|nor|xor|xnor|not|buf)\s+([a-zA-Z_]\w*)?\s*\(([^)]+)\)$/);
      if (gateM) {
        const gt = gateM[1] === "not" ? "gate_inv" : `gate_${gateM[1]}`;
        const gName = gateM[2] || `${gateM[1].toUpperCase()}_${++autoIdxRef.n}`;
        const argNets = gateM[3].split(",").map(s => s.trim()).filter(Boolean);
        if (argNets.length >= 2) {
          curMod.elements.push(makeHdlGateElement(gName, gt, argNets.slice(1), argNets[0], lNo));
          lineMap.set(lNo, { name: gName, subckt: modName });
        }
        return;
      }
      const assignM = stmt.match(/^assign\s+([a-zA-Z_]\w*)\s*=\s*(.+)$/);
      if (assignM) {
        const gName = parseVerilogExprToGates(assignM[1], assignM[2], lNo, curMod.elements, autoIdxRef);
        if (gName) lineMap.set(lNo, { name: gName, subckt: modName });
        return;
      }
      const instM = stmt.match(/^([a-zA-Z_]\w*)\s+([a-zA-Z_]\w*)\s*\(([\s\S]+)\)$/);
      if (instM && !["wire", "reg", "logic", "localparam", "parameter", "integer"].includes(instM[1])) {
        const pins = [];
        instM[3].split(",").forEach((arg, idx) => {
          const named = arg.trim().match(/^\.([a-zA-Z_]\w*)\s*\(([^)]+)\)$/);
          if (named) pins.push({ name: named[1], net: named[2].trim(), dir: "auto" });
          else if (arg.trim()) pins.push({ name: `P${idx + 1}`, net: arg.trim(), dir: "auto" });
        });
        if (pins.length > 0) {
          curMod.elements.push({ name: instM[2], nodes: pins.map(p => p.net), model: instM[1], params: {}, type: "subckt_inst", symbolShape: "box", pins, line: lNo });
          lineMap.set(lNo, { name: instM[2], subckt: modName });
        }
      }
    });
  }

  subckts["__TOP__"] = { name: "顶层 (Verilog)", ports: [], elements: [], line: 1 };
  return { subckts, lineMap, spiceModels: {}, hdlLang: "verilog" };
}

function parseVhdlToDesign(text) {
  const cleanText = text.split(/\r?\n/).map(l => l.replace(/--.*$/, "")).join("\n");
  const subckts = {};
  const lineMap = new Map();
  const autoIdxRef = { n: 0 };

  const entRegex = /entity\s+([a-zA-Z_]\w*)\s+is\s+([\s\S]*?)end\s+(?:entity\s+)?(?:\1)?\s*;/gi;
  let em;
  while ((em = entRegex.exec(cleanText)) !== null) {
    const entName = em[1];
    const entBody = em[2];
    const curEnt = { name: entName, ports: [], portDirs: {}, elements: [], line: 1 };
    subckts[entName] = curEnt;
    const portSec = entBody.match(/port\s*\(([\s\S]*)\)\s*;/i);
    if (portSec) {
      portSec[1].split(";").forEach(pLine => {
        const pm = pLine.trim().match(/^([a-zA-Z_]\w*)\s*:\s*(in|out|inout)\s+/i);
        if (pm) {
          const pName = pm[1];
          const dir = pm[2].toLowerCase() === "in" ? "input" : (pm[2].toLowerCase() === "out" ? "output" : "inout");
          if (!curEnt.ports.includes(pName)) curEnt.ports.push(pName);
          curEnt.portDirs[pName] = dir;
        }
      });
    }
  }

  const archRegex = /architecture\s+(\w+)\s+of\s+([a-zA-Z_]\w*)\s+is([\s\S]*?)\bbegin\b([\s\S]*?)end\s+(?:architecture(?:\s+\w+)?|\1)\s*;/gi;
  let am;
  while ((am = archRegex.exec(cleanText)) !== null) {
    const entName = am[2];
    const body = am[4] || "";
    const baseLine = cleanText.slice(0, am.index).split("\n").length;
    if (!subckts[entName]) subckts[entName] = { name: entName, ports: [], portDirs: {}, elements: [], line: baseLine };
    const curEnt = subckts[entName];

    // Extract process( ... ) begin ... end process;
    const restBody = body.replace(/process\s*\(([^)]*)\)[\s\S]*?\bbegin\b([\s\S]*?)end\s+process\s*;/gi, (full, sens, blk, offset) => {
      const lNo = baseLine + body.slice(0, offset).split("\n").length - 1;
      const sensList = sens.split(",").map(s => s.trim()).filter(Boolean);
      const clkM = blk.match(/rising_edge\s*\(\s*([a-zA-Z_]\w*)\s*\)/i) || blk.match(/([a-zA-Z_]\w*)'event/i);
      const clkNet = clkM ? clkM[1] : (sensList[0] || "clk");
      const rstNet = sensList.find(s => s !== clkNet && /rst|reset/i.test(s)) || null;
      const enM = blk.match(/if\s+([a-zA-Z_]\w*)\s*=\s*'1'\s+then/i);
      const enNet = enM && enM[1] !== clkNet ? enM[1] : null;

      const sigReg = /([a-zA-Z_]\w*)\s*<=\s*([^;]+);/g;
      let sm;
      const handled = new Set();
      while ((sm = sigReg.exec(blk)) !== null) {
        const target = sm[1], rhs = sm[2].trim();
        if (/^\(others\s*=>/i.test(rhs) || /^'[01]'$/.test(rhs)) continue;
        if (handled.has(target)) continue;
        handled.add(target);

        if (new RegExp("\\b" + target + "\\b\\s*[+-]").test(rhs)) {
          const cntName = `CNT_${target}`;
          const pins = [{ name: "CLK", net: clkNet, dir: "left" }];
          if (rstNet) pins.push({ name: "RST", net: rstNet, dir: "left" });
          if (enNet) pins.push({ name: "EN", net: enNet, dir: "left" });
          pins.push({ name: "Q", net: target, dir: "right" });
          curEnt.elements.push(makeHdlGateElement(cntName, "dff", [], target, lNo, pins, { mode: "counter" }));
          lineMap.set(lNo, { name: cntName, subckt: entName });
        } else {
          const ffName = `DFF_${target}`;
          const pins = [{ name: "D", net: rhs.replace(/[^a-zA-Z0-9_]/g, "") || "d", dir: "left" }, { name: "CLK", net: clkNet, dir: "left" }];
          if (rstNet) pins.push({ name: "RST", net: rstNet, dir: "bottom" });
          if (enNet) pins.push({ name: "EN", net: enNet, dir: "left" });
          pins.push({ name: "Q", net: target, dir: "right" });
          curEnt.elements.push(makeHdlGateElement(ffName, "dff", [], target, lNo, pins));
          lineMap.set(lNo, { name: ffName, subckt: entName });
        }
      }
      return "";
    });

    // Concurrent statements
    restBody.split(";").forEach((stmtRaw, sIdx) => {
      const stmt = stmtRaw.trim();
      if (!stmt) return;
      const lNo = baseLine + sIdx + 1;
      const sigAssign = stmt.match(/^([a-zA-Z_]\w*)\s*<=\s*([\s\S]+)$/);
      if (!sigAssign) return;
      const lhs = sigAssign[1], rhs = sigAssign[2].trim();

      const muxM = rhs.match(/^([a-zA-Z_]\w*)\s+when\s+([a-zA-Z_]\w*)\s*=\s*'1'\s+else\s+([a-zA-Z_]\w*)$/i);
      if (muxM) {
        const gName = `MUX_${++autoIdxRef.n}`;
        curEnt.elements.push(makeHdlGateElement(gName, "mux2", [], lhs, lNo, [
          { name: "D0", net: muxM[3], dir: "left" },
          { name: "D1", net: muxM[1], dir: "left" },
          { name: "SEL", net: muxM[2], dir: "bottom" },
          { name: "Y", net: lhs, dir: "right" }
        ]));
        lineMap.set(lNo, { name: gName, subckt: entName });
        return;
      }
      const notM = rhs.match(/^not\s+([a-zA-Z_]\w*)$/i);
      if (notM) {
        const gName = `INV_${++autoIdxRef.n}`;
        curEnt.elements.push(makeHdlGateElement(gName, "gate_inv", [notM[1]], lhs, lNo));
        lineMap.set(lNo, { name: gName, subckt: entName });
        return;
      }
      const binM = rhs.match(/^([a-zA-Z_]\w*)\s+(and|nand|or|nor|xor|xnor)\s+([a-zA-Z_]\w*)$/i);
      if (binM) {
        const gt = `gate_${binM[2].toLowerCase()}`;
        const gName = `${binM[2].toUpperCase()}_${++autoIdxRef.n}`;
        curEnt.elements.push(makeHdlGateElement(gName, gt, [binM[1], binM[3]], lhs, lNo));
        lineMap.set(lNo, { name: gName, subckt: entName });
        return;
      }
      const castM = rhs.match(/^(?:std_logic_vector|unsigned|signed)\s*\(\s*([a-zA-Z_]\w*)\s*\)$/i) || rhs.match(/^([a-zA-Z_]\w*)$/);
      if (castM) {
        const gName = `BUF_${++autoIdxRef.n}`;
        curEnt.elements.push(makeHdlGateElement(gName, "gate_buf", [castM[1]], lhs, lNo));
        lineMap.set(lNo, { name: gName, subckt: entName });
      }
    });
  }

  subckts["__TOP__"] = { name: "顶层 (VHDL)", ports: [], elements: [], line: 1 };
  return { subckts, lineMap, spiceModels: {}, hdlLang: "vhdl" };
}

function parseSpectreNetlist(text, fileName = "") {
  const hdlKind = detectHdlLanguage(text, fileName);
  if (hdlKind === "verilog") return parseVerilogToDesign(text);
  if (hdlKind === "vhdl") return parseVhdlToDesign(text);
  const rawLines = text.split(/\r?\n/);
  const logicalLines = [];
  let buffer = "";
  let startLineNum = 1;

  for (let i = 0; i < rawLines.length; i++) {
    const lineNo = i + 1;
    let stripped = rawLines[i].replace(/\/\/.*$/, "").replace(/;.*$/, "").replace(/^\s*\*.*$/, "").trim();
    if (!stripped) {
      if (buffer && !buffer.endsWith("\\")) {
        logicalLines.push({ line: buffer.trim(), lineNo: startLineNum });
        buffer = "";
      }
      continue;
    }

    // SPICE '+' 续行符 或 独立 ')' 闭合行 拼接到上一逻辑行
    if ((/^\+/.test(stripped) || stripped === ")") && logicalLines.length > 0 && !buffer) {
      const addPart = /^\+/.test(stripped) ? stripped.slice(1).trim() : stripped;
      logicalLines[logicalLines.length - 1].line += " " + addPart;
      continue;
    }
    if ((/^\+/.test(stripped) || stripped === ")") && buffer) {
      const addPart = /^\+/.test(stripped) ? stripped.slice(1).trim() : stripped;
      buffer += " " + addPart;
      continue;
    }

    if (!buffer) startLineNum = lineNo;
    if (stripped.endsWith("\\")) {
      buffer += " " + stripped.slice(0, -1).trim();
      continue;
    }
    const combined = (buffer + " " + stripped).trim();
    buffer = "";
    logicalLines.push({ line: combined, lineNo: startLineNum });
  }
  if (buffer.trim()) logicalLines.push({ line: buffer.trim(), lineNo: startLineNum });

  const subckts = {};
  const topElements = [];
  const lineMap = new Map();
  const spiceModels = {};
  let currentSubckt = null;

  for (const item of logicalLines) {
    const { line, lineNo } = item;

    // 1. 解析 SPICE .MODEL 定义（兼容括号跨行、无括号及末尾 ')'）
    const dotModelMatch = line.match(/^\.model\s+(\S+)\s+(\S+)\s*(.*)$/i);
    if (dotModelMatch) {
      const mName = dotModelMatch[1];
      const mType = dotModelMatch[2].toUpperCase();
      let paramBody = (dotModelMatch[3] || "").trim();
      if (paramBody.startsWith("(")) paramBody = paramBody.slice(1);
      if (paramBody.endsWith(")")) paramBody = paramBody.slice(0, -1);
      const params = {};
      const pr = /(\S+?)=([^\s()]+)/g;
      let pm;
      while ((pm = pr.exec(paramBody)) !== null) params[pm[1]] = pm[2];
      spiceModels[mName] = { name: mName, modelType: mType, params, line: lineNo };
      continue;
    }

    // 2. 解析 subckt / .subckt（剥离 PARAMS: 及 key=val 默认参数）
    const subMatch = line.match(/^(?:inline\s+|\.)?subckt\s+(\S+)\s*(.*)$/i);
    if (subMatch) {
      const name = subMatch[1];
      const rawTail = subMatch[2].replace(/\bPARAMS\s*:.*$/i, "").replace(/[()]/g, "").trim();
      const ports = rawTail.split(/\s+/).filter(t => t && !t.includes("="));
      currentSubckt = { name, ports, elements: [], line: lineNo };
      subckts[name] = currentSubckt;
      continue;
    }

    if (/^(?:ends|\.ends|\.end)\b/i.test(line)) {
      currentSubckt = null;
      continue;
    }

    if (/^\./.test(line)) continue;

    // 3. 解析 Spectre 格式器件: Inst (n1 n2 ...) model params...
    let instMatch = line.match(/^(\S+)\s*\(([^)]+)\)\s*(\S+)(.*)$/);
    let instName, nodes, model, paramStr;
    if (instMatch) {
      instName = instMatch[1];
      nodes = instMatch[2].trim().split(/\s+/);
      model = instMatch[3];
      paramStr = instMatch[4].trim();
    } else {
      // 4. 兼容标准 SPICE 无括号器件行 (M, Q, D, R, L, C, V, I, X)
      const tokens = line.split(/\s+/);
      const firstChar = tokens[0] ? tokens[0][0].toUpperCase() : "";
      if (tokens.length >= 3 && ["M", "Q", "D", "R", "L", "C", "V", "I", "X"].includes(firstChar)) {
        instName = tokens[0];
        if (firstChar === "M" && tokens.length >= 6) {
          nodes = tokens.slice(1, 5); model = tokens[5]; paramStr = tokens.slice(6).join(" ");
        } else if (firstChar === "Q" && tokens.length >= 5) {
          // 区分 3 节点 Q1 c b e mod 与 4 节点 Q1 c b e sub mod
          const has6thNonParam = tokens.length >= 6 && !tokens[5].includes("=");
          if (has6thNonParam) {
            nodes = tokens.slice(1, 4); model = tokens[5]; paramStr = tokens.slice(6).join(" ");
          } else {
            nodes = tokens.slice(1, 4); model = tokens[4]; paramStr = tokens.slice(5).join(" ");
          }
        } else if (firstChar === "D" && tokens.length >= 4) {
          nodes = tokens.slice(1, 3); model = tokens[3]; paramStr = tokens.slice(4).join(" ");
        } else if (["R", "L", "C", "V", "I"].includes(firstChar) && tokens.length >= 4) {
          nodes = tokens.slice(1, 3);
          const pName = firstChar === "R" ? "r" : (firstChar === "L" ? "l" : (firstChar === "C" ? "c" : "dc"));
          model = firstChar === "R" ? "resistor" : (firstChar === "L" ? "inductor" : (firstChar === "C" ? "capacitor" : (firstChar === "V" ? "vsource" : "isource")));
          let restTokens = tokens.slice(3);
          if ((firstChar === "V" || firstChar === "I") && restTokens[0] && /^(DC|AC)$/i.test(restTokens[0]) && restTokens[1]) {
            paramStr = `${pName}=${restTokens[1]} ${restTokens.slice(2).join(" ")}`.trim();
          } else if (restTokens[0] && !restTokens[0].includes("=")) {
            paramStr = `${pName}=${restTokens[0]} ${restTokens.slice(1).join(" ")}`.trim();
          } else {
            paramStr = restTokens.join(" ");
          }
        } else if (firstChar === "X" && tokens.length >= 3) {
          const cleanTokens = tokens.filter(t => !/^PARAMS:$/i.test(t));
          const kvIdx = cleanTokens.findIndex((t, ti) => ti > 0 && t.includes("="));
          const endIdx = kvIdx === -1 ? cleanTokens.length : kvIdx;
          if (endIdx >= 3) {
            nodes = cleanTokens.slice(1, endIdx - 1);
            model = cleanTokens[endIdx - 1];
            paramStr = cleanTokens.slice(endIdx).join(" ");
          }
        }
      }
    }

    if (instName && nodes && model) {
      if (["dc", "ac", "tran", "noise", "sp", "pss", "pac", "stb"].includes(model.toLowerCase())) continue;
      const params = {};
      const paramRegex = /(\S+?)=([^\s]+)/g;
      let pm;
      while ((pm = paramRegex.exec(paramStr || "")) !== null) params[pm[1]] = pm[2];

      const element = classifyElement(instName, nodes, model, params, lineNo, subckts);
      const subKey = currentSubckt ? currentSubckt.name : "__TOP__";
      lineMap.set(lineNo, { name: element.name, subckt: subKey });
      if (currentSubckt) currentSubckt.elements.push(element);
      else topElements.push(element);
    }
  }

  // 若用户仅输入了 SPICE .MODEL 定义（无其他实例化元件），自动生成基础图形化器件并构建电阻电容级等效电路图
  if (topElements.length === 0 && Object.keys(subckts).length === 0 && Object.keys(spiceModels).length > 0) {
    Object.values(spiceModels).forEach((mDef) => {
      const t = mDef.modelType;
      let elName = `M_${mDef.name}`;
      let elNodes = ["d", "g", "s", "b"];
      if (t === "NPN" || t === "PNP") {
        elName = `Q_${mDef.name}`;
        elNodes = ["collector", "base", "emitter"];
      } else if (t === "D") {
        elName = `D_${mDef.name}`;
        elNodes = ["anode", "cathode"];
      }
      const previewEl = classifyElement(elName, elNodes, mDef.name, mDef.params, mDef.line, subckts);
      if (t === "NPN") previewEl.type = "npn";
      else if (t === "PNP") previewEl.type = "pnp";
      else if (t === "NMOS") previewEl.type = "nmos";
      else if (t === "PMOS") previewEl.type = "pmos";
      computePinPositions(previewEl);
      topElements.push(previewEl);
      lineMap.set(mDef.line, { name: previewEl.name, subckt: "__TOP__" });
    });
  }

  // 为每个 .MODEL 预生成电阻电容级等效电路子电路（双击基础元件即可直接进入）
  Object.values(spiceModels).forEach((mDef) => {
    if (!subckts[mDef.name]) {
      const eqCode = buildSpiceModelEquivSubckt(mDef.name, mDef.modelType, mDef.params);
      if (eqCode) {
        const eqParsed = parseSpectreNetlist(eqCode);
        if (eqParsed.subckts[mDef.name]) {
          subckts[mDef.name] = eqParsed.subckts[mDef.name];
        }
      }
    }
  });

  Object.values(subckts).forEach(sub => {
    sub.elements.forEach(el => {
      if (el.type === "subckt_inst") el.symbolShape = detectSubcktSymbolShape(el.model, subckts[el.model]);
    });
  });
  topElements.forEach(el => {
    if (el.type === "subckt_inst") el.symbolShape = detectSubcktSymbolShape(el.model, subckts[el.model]);
  });

  subckts["__TOP__"] = {
    name: "顶层测试台 (Top-Level)",
    ports: [],
    elements: topElements,
    line: 1
  };

  return { subckts, lineMap, spiceModels };
}

function detectSubcktSymbolShape(modelName, subDef) {
  const m = modelName.toLowerCase();
  if (/err|opamp|ota|comp|amp/.test(m)) return "opamp";
  if (/nand/.test(m)) return "nand";
  if (/nor/.test(m)) return "nor";
  if (/and/.test(m)) return "and";
  if (/or/.test(m)) return "or";
  if (/inv|not|buf/.test(m)) return "inv";
  if (subDef && subDef.ports) {
    const pLow = subDef.ports.map(p => p.toLowerCase());
    if ((pLow.includes("in_p") || pLow.includes("vinp")) && (pLow.includes("in_n") || pLow.includes("vinn"))) return "opamp";
  }
  return "box";
}

function classifyElement(name, nodes, model, params, line, subckts) {
  const mLow = model.toLowerCase();
  const nFirst = name[0].toUpperCase();
  let type = "subckt_inst";
  let pins = [];

  if (mLow === "nch" || mLow === "nmos" || (nFirst === "M" && /^n(ch|mos|anch|ench)/i.test(mLow))) {
    type = "nmos";
    pins = [
      { name: "D", net: nodes[0], dir: "top" },
      { name: "G", net: nodes[1], dir: "left" },
      { name: "S", net: nodes[2], dir: "bottom" },
      { name: "B", net: nodes[3] || nodes[2], dir: "right" }
    ];
  } else if (mLow === "pch" || mLow === "pmos" || (nFirst === "M" && /^p(ch|mos|ech)/i.test(mLow))) {
    type = "pmos";
    pins = [
      { name: "D", net: nodes[0], dir: "bottom" },
      { name: "G", net: nodes[1], dir: "left" },
      { name: "S", net: nodes[2], dir: "top" },
      { name: "B", net: nodes[3] || nodes[2], dir: "right" }
    ];
  } else if (mLow.includes("pnp")) {
    type = "pnp";
    pins = [
      { name: "C", net: nodes[0], dir: "bottom" },
      { name: "B", net: nodes[1], dir: "left" },
      { name: "E", net: nodes[2], dir: "top" }
    ];
  } else if (mLow.includes("npn")) {
    type = "npn";
    pins = [
      { name: "C", net: nodes[0], dir: "top" },
      { name: "B", net: nodes[1], dir: "left" },
      { name: "E", net: nodes[2], dir: "bottom" }
    ];
  } else if (mLow === "resistor" || nFirst === "R") {
    type = "resistor";
    pins = [
      { name: "P", net: nodes[0], dir: "top" },
      { name: "N", net: nodes[1], dir: "bottom" }
    ];
  } else if (mLow === "inductor" || nFirst === "L") {
    type = "inductor";
    pins = [
      { name: "P", net: nodes[0], dir: "top" },
      { name: "N", net: nodes[1], dir: "bottom" }
    ];
  } else if (mLow === "capacitor" || nFirst === "C") {
    type = "capacitor";
    pins = [
      { name: "P", net: nodes[0], dir: "left" },
      { name: "N", net: nodes[1], dir: "right" }
    ];
  } else if (mLow === "isource" || nFirst === "I") {
    type = "isource";
    pins = [
      { name: "P", net: nodes[0], dir: "top" },
      { name: "N", net: nodes[1], dir: "bottom" }
    ];
  } else if (mLow === "vsin" || mLow === "sin" || mLow === "vac") {
    type = "vsin";
    pins = [
      { name: "P", net: nodes[0], dir: "top" },
      { name: "N", net: nodes[1], dir: "bottom" }
    ];
  } else if (mLow === "vpulse" || mLow === "pulse") {
    type = "vpulse";
    pins = [
      { name: "P", net: nodes[0], dir: "top" },
      { name: "N", net: nodes[1], dir: "bottom" }
    ];
  } else if (mLow === "vsweep" || mLow === "sweep" || mLow === "ac_sweep" || mLow === "chirp") {
    type = "vsweep";
    pins = [
      { name: "P", net: nodes[0], dir: "top" },
      { name: "N", net: nodes[1], dir: "bottom" }
    ];
  } else if (["vcvs", "vccs", "cccs", "ccvs"].includes(mLow) || (["E", "G", "F", "H"].includes(nFirst) && nodes.length >= 4)) {
    type = ["vcvs", "vccs", "cccs", "ccvs"].includes(mLow) ? mLow : (nFirst === "E" ? "vcvs" : (nFirst === "G" ? "vccs" : (nFirst === "F" ? "cccs" : "ccvs")));
    pins = [
      { name: "OUT+", net: nodes[0], dir: "top" },
      { name: "OUT-", net: nodes[1], dir: "bottom" },
      { name: "IN+", net: nodes[2] || "0", dir: "left" },
      { name: "IN-", net: nodes[3] || "0", dir: "right" }
    ];
  } else if (["gate_and", "gate_nand", "gate_or", "gate_nor", "gate_xor", "gate_xnor", "and", "nand", "or", "nor", "xor", "xnor"].includes(mLow)) {
    type = mLow.startsWith("gate_") ? mLow : `gate_${mLow}`;
    pins = [
      { name: "I1", net: nodes[0] || "a", dir: "left" },
      { name: "I2", net: nodes[1] || "b", dir: "left" },
      { name: "Y", net: nodes[2] || "y", dir: "right" }
    ];
  } else if (["gate_inv", "gate_buf", "inv", "not", "buf"].includes(mLow)) {
    type = (mLow === "inv" || mLow === "not" || mLow === "gate_inv") ? "gate_inv" : "gate_buf";
    pins = [
      { name: "I1", net: nodes[0] || "a", dir: "left" },
      { name: "Y", net: nodes[1] || "y", dir: "right" }
    ];
  } else if (mLow === "mux2") {
    type = "mux2";
    pins = [
      { name: "D0", net: nodes[0] || "d0", dir: "left" },
      { name: "D1", net: nodes[1] || "d1", dir: "left" },
      { name: "SEL", net: nodes[2] || "sel", dir: "bottom" },
      { name: "Y", net: nodes[3] || "y", dir: "right" }
    ];
  } else if (mLow === "dff") {
    type = "dff";
    pins = [
      { name: "D", net: nodes[0] || "d", dir: "left" },
      { name: "CLK", net: nodes[1] || "clk", dir: "left" },
      { name: "Q", net: nodes[2] || "q", dir: "right" }
    ];
  } else if (mLow === "term_vdd" || mLow === "vdd_dot") {
    type = "term_vdd";
    pins = [{ name: "P", net: nodes[0] || "vdd", dir: "bottom" }];
  } else if (mLow === "term_gnd" || mLow === "gnd_dot") {
    type = "term_gnd";
    pins = [{ name: "P", net: nodes[0] || "0", dir: "top" }];
  } else if (mLow === "term_neg" || mLow === "neg_dot") {
    type = "term_neg";
    pins = [{ name: "P", net: nodes[0] || "vee", dir: "top" }];
  } else if (mLow === "vsource" || nFirst === "V") {
    type = "vsource";
    pins = [
      { name: "P", net: nodes[0], dir: "top" },
      { name: "N", net: nodes[1], dir: "bottom" }
    ];
  } else {
    type = "subckt_inst";
    const subDef = subckts ? subckts[model] : null;
    nodes.forEach((net, idx) => {
      const pName = (subDef && subDef.ports[idx]) ? subDef.ports[idx] : `P${idx + 1}`;
      pins.push({ name: pName, net, dir: "auto" });
    });
  }

  return { name, nodes, model, params, type, pins, line };
}


export {
  detectHdlLanguage,
  parseVerilogToDesign,
  parseVhdlToDesign,
  parseSpectreNetlist,
  classifyElement,
  detectSubcktSymbolShape
};
