/* rf018.scs / Spectre BSIM3 binning parser — no dependencies */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CmosModel = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CORNERS = [
    ['TT', 'tt', 'mos'], ['FF', 'ff', 'mos'], ['SS', 'ss', 'mos'],
    ['SF', 'sf', 'mos'], ['FS', 'fs', 'mos'],
    ['TT_3V', 'tt_3v', 'mos_3v'], ['FF_3V', 'ff_3v', 'mos_3v'],
    ['SS_3V', 'ss_3v', 'mos_3v'], ['SF_3V', 'sf_3v', 'mos_3v'],
    ['FS_3V', 'fs_3v', 'mos_3v']
  ];
  const KEEP_DEVICES = new Set(['nch', 'pch', 'nch3', 'pch3']);
  const SLIM_KEYS = ['type','lmin','lmax','wmin','wmax','vth0','k1','k2','tox','u0','ua','ub','uc',
    'vsat','rdsw','pclm','pdiblc1','pdiblc2','eta0','etab','nfactor','cit','cgdo','cgso',
    'cj','cjsw','dlc','dwc','wint','lint','xl','xw','phi'];

  function cleanText(text) {
    return text.split(/\r?\n/).map(line => {
      const i = line.indexOf('//');
      return i >= 0 ? line.slice(0, i) : line;
    }).join('\n');
  }

  function joinContinuations(text) {
    const out = [];
    for (const line of text.split(/\r?\n/)) {
      if (/^\s*\+/.test(line) && out.length) {
        out[out.length - 1] += ' ' + line.replace(/^\s*\+\s*/, '');
      } else {
        out.push(line.replace(/\s+$/, ''));
      }
    }
    return out;
  }

  function parseSections(lines) {
    const sections = Object.create(null);
    let cur = null, buf = [];
    for (const line of lines) {
      let m = line.match(/^\s*section\s+([A-Za-z0-9_]+)/);
      if (m) {
        if (cur !== null) sections[cur] = buf.join('\n');
        cur = m[1]; buf = [];
        continue;
      }
      m = line.match(/^\s*endsection(?:\s+([A-Za-z0-9_]+))?/);
      if (m) {
        if (cur !== null) sections[cur] = buf.join('\n');
        cur = null; buf = [];
        continue;
      }
      if (cur !== null) buf.push(line);
    }
    if (cur !== null) sections[cur] = buf.join('\n');
    return sections;
  }

  // Safe-ish arithmetic expression evaluation against a parameter environment.
  // This is a local model file parser, not a security boundary.
  const FN = { sqrt: Math.sqrt, exp: Math.exp, ln: Math.log, log: Math.log,
    abs: Math.abs, min: Math.min, max: Math.max, pow: Math.pow };

  function evalExpr(expr, env) {
    if (expr == null) return 0;
    let s = String(expr).trim();
    if (!s) return 0;
    s = s.replace(/\^/g, '**');
    // Replace identifiers with numeric literals / known function names.
    s = s.replace(/(?<![0-9.])[A-Za-z_][A-Za-z0-9_]*/g, name => {
      if (Object.prototype.hasOwnProperty.call(env, name)) {
        const v = Number(env[name]);
        return Number.isFinite(v) ? '(' + v + ')' : '0';
      }
      if (Object.prototype.hasOwnProperty.call(FN, name)) return name;
      return '0';
    });
    // A leading unary '+' after whitespace is legal JS.
    if (!/^[0-9eE+\-*/().,\sA-Za-z_]+$/.test(s)) return 0;
    try {
      const fn = new Function('sqrt', 'exp', 'ln', 'log', 'abs', 'min', 'max', 'pow', 'return (' + s + ');');
      const v = fn(FN.sqrt, FN.exp, FN.ln, FN.log, FN.abs, FN.min, FN.max, FN.pow);
      return Number.isFinite(v) ? v : 0;
    } catch (e) { return 0; }
  }

  function parseParameters(sectionText, baseEnv) {
    const env = Object.assign(Object.create(null), baseEnv || {});
    const lines = sectionText.split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s*parameters\s+(.+)$/);
      if (!m) continue;
      const stmt = m[1].trim();
      let i = 0;
      while (i < stmt.length) {
        const nm = stmt.slice(i).match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
        if (!nm) { i++; continue; }
        const name = nm[1];
        i += nm[0].length;
        const start = i;
        let depth = 0;
        while (i < stmt.length) {
          const c = stmt[i];
          if (c === '(') depth++;
          else if (c === ')') depth = Math.max(0, depth - 1);
          else if (depth === 0) {
            const next = stmt.slice(i).match(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*=/);
            if (next) break;
          }
          i++;
        }
        env[name] = evalExpr(stmt.slice(start, i), env);
      }
    }
    return env;
  }

  function splitBins(body) {
    const parts = [];
    const re = /^\s*(\d+)\s*:\s*/gm;
    let m, lastIndex = 0, lastNum = null;
    while ((m = re.exec(body))) {
      if (lastNum !== null) parts.push([lastNum, body.slice(lastIndex, m.index)]);
      lastNum = Number(m[1]);
      lastIndex = re.lastIndex;
    }
    if (lastNum !== null) parts.push([lastNum, body.slice(lastIndex)]);
    return parts;
  }

  function parseModelBins(sectionText, env) {
    const models = Object.create(null);
    const re = /^\s*model\s+([A-Za-z0-9_]+)\s+bsim3v3\s*\{/gm;
    let m;
    while ((m = re.exec(sectionText))) {
      const name = m[1];
      const start = re.lastIndex;
      let depth = 1, i = start;
      while (i < sectionText.length && depth > 0) {
        if (sectionText[i] === '{') depth++;
        else if (sectionText[i] === '}') depth--;
        i++;
      }
      const body = sectionText.slice(start, i - 1);
      const bins = [];
      for (const [num, chunk] of splitBins(body)) {
        const typeMatch = chunk.match(/\btype\s*=\s*([np])/);
        const type = typeMatch && typeMatch[1] === 'p' ? 'p' : 'n';
        const pairs = Object.create(null);
        const matches = [];
        const kre = /([A-Za-z_][A-Za-z0-9_]*)\s*=/g;
        let km;
        while ((km = kre.exec(chunk))) matches.push({ key: km[1], start: km.index, end: kre.lastIndex });
        for (let j = 0; j < matches.length; j++) {
          const key = matches[j].key;
          const a = matches[j].end;
          const b = j + 1 < matches.length ? matches[j + 1].start : chunk.length;
          const val = chunk.slice(a, b).replace(/[\s+]+$/, '').trim();
          if (key === 'type') { pairs.type = type; continue; }
          pairs[key] = evalExpr(val, env);
        }
        const bin = { type };
        for (const key of SLIM_KEYS) {
          if (key === 'type') continue;
          bin[key] = Number(pairs[key]) || 0;
        }
        bins.push(bin);
      }
      if (KEEP_DEVICES.has(name)) models[name] = bins;
    }
    return models;
  }

  function parseSpectre(text, meta) {
    const source = Object.assign({ file: 'rf018.scs', bytes: 0, lines: 0, sha256: '' }, meta || {});
    const lines = joinContinuations(cleanText(text));
    source.lines = String(text).split(/\r?\n/).length;
    source.bytes = (typeof TextEncoder !== 'undefined') ? new TextEncoder().encode(text).length : text.length;
    const sections = parseSections(lines);
    const corners = Object.create(null);
    for (const [label, secName, modelSec] of CORNERS) {
      if (!sections[secName] || !sections[modelSec]) continue;
      const env = parseParameters(sections[secName], {});
      const models = parseModelBins(sections[modelSec], env);
      const devices = Object.create(null);
      for (const dev of Object.keys(models)) {
        if (dev === 'nch' || dev === 'pch' || dev === 'nch3' || dev === 'pch3') devices[dev] = models[dev];
      }
      if (Object.keys(devices).length === 0) continue;
      corners[label] = {
        section: secName,
        modelSection: modelSec,
        devices,
        params: {
          toxn: env.toxn || 0, toxp: env.toxp || 0,
          toxn3: env.toxn3 || 0, toxp3: env.toxp3 || 0,
          dxln: env.dxln || 0, dxlp: env.dxlp || 0,
          dxln3: env.dxln3 || 0, dxlp3: env.dxlp3 || 0,
          dxwn: env.dxwn || 0, dxwp: env.dxwp || 0,
          dxwn3: env.dxwn3 || 0, dxwp3: env.dxwp3 || 0
        }
      };
    }
    return { source, corners };
  }

  return { parseSpectre, evalExpr, CORNERS };
});
