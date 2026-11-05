import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { simulate } from '../js/engine.mjs';
import { EXAMPLES } from '../js/examples.mjs';
import {
  number,
  safePath,
  validateFiles,
  prepareDeck,
  analysisCommand,
  parseRaw,
  csv,
} from '../js/spice.mjs';
import {
  parseSymbol,
  importASC,
  importTheme,
  changeComponent,
  parseComponents,
} from '../js/schematic.mjs';
const run = (ex) =>
  simulate({
    files: [{ path: 'main.cir', content: ex.netlist }],
    entry: 'main.cir',
    config: ex.analysis,
  });
const near = (a, b, tolerance) => assert.ok(Math.abs(a - b) <= tolerance, `${a} vs ${b}`);
test('all 30 bundled cases run with real ngspice and finite vectors', async () => {
  for (const ex of EXAMPLES) {
    const r = await run(ex);
    assert.ok(r.points > 0, ex.id);
    assert.ok(
      r.variables.every((v) => v.real.every(Number.isFinite) && v.imag.every(Number.isFinite)),
      ex.id,
    );
  }
});
test('divider is 5 V; load changes answer in the real engine', async () => {
  const ex = EXAMPLES[0];
  const a = await run(ex),
    b = await run({ ...ex, netlist: ex.netlist.replace('.end', 'RL out 0 1k\n.end') });
  near(a.variables.find((v) => v.name === 'v(out)').real[0], 5, 1e-10);
  near(b.variables.find((v) => v.name === 'v(out)').real[0], 10 / 3, 1e-9);
});
test('RC step follows analytic exponential at 1 time constant', async () => {
  const r = await run(EXAMPLES.find((e) => e.id === 'rc-step')),
    time = r.variables[0].real,
    out = r.variables.find((v) => v.name === 'v(out)').real;
  const i = time.findIndex((t) => t >= 0.002);
  near(out[i], 5 * (1 - Math.exp(-(time[i] - 0.001) / 0.001)), 0.006);
});
test('AC lowpass keeps complex phase and analytic magnitude', async () => {
  const r = await run(EXAMPLES.find((e) => e.id === 'rc-low-ac'));
  assert.equal(r.complex, true);
  const frequency = r.variables[0].real,
    out = r.variables.find((v) => v.name === 'v(out)');
  const i = frequency.findIndex((f) => f > 1500),
    omega = 2 * Math.PI * frequency[i] * 0.0001;
  near(Math.hypot(out.real[i], out.imag[i]), 1 / Math.sqrt(1 + omega * omega), 1e-8);
  near(Math.atan2(out.imag[i], out.real[i]), -Math.atan(omega), 1e-8);
  assert.match(csv(r), /\.imag/);
});
test('relative .include resolves in a nested project and subcircuit simulates', async () => {
  const r = await simulate({
    entry: 'project/main.cir',
    files: [
      {
        path: 'project/main.cir',
        content: '* models\n.include "models/rc.lib"\nV1 in 0 5\nX1 in out RC\n.end',
      },
      { path: 'project/models/rc.lib', content: '.subckt RC a b\nR1 a b 1k\nR2 b 0 1k\n.ends' },
    ],
    config: { type: 'op' },
  });
  near(r.variables.find((v) => v.name === 'v(out)').real[0], 2.5, 1e-10);
});
test('ASC plus ASY conversion preserves pin ordering and yields correct result', async () => {
  const symbols = {};
  for (const name of ['resistor', 'voltage'])
    symbols['folder/' + name] = parseSymbol(
      await readFile(new URL('../examples/' + name + '.asy', import.meta.url), 'utf8'),
      name,
    );
  const asc = await readFile(new URL('../examples/divider.asc', import.meta.url), 'utf8');
  const converted = importASC(asc, symbols);
  const r = await simulate({
    entry: 'main.cir',
    files: [{ path: 'main.cir', content: converted.netlist }],
    config: { type: 'op' },
  });
  near(r.variables.find((v) => v.name === 'v(out)').real[0], 5, 1e-10);
  assert.throws(() => importASC(asc, {}), /asy/);
});
test('SPICE units preserve m vs meg and reject nonfinite inputs', () => {
  near(number('1m'), 0.001, 0);
  near(number('1meg'), 1e6, 0);
  near(number('10uF'), 1e-5, 1e-18);
  assert.throws(() => number('1e999'));
  assert.throws(() => number('abc'));
});
test('bounded engineering input fails clearly before executing', () => {
  for (const path of ['../secret', '/etc/config', 'a/../../x', 'x\0y'])
    assert.throws(() => safePath(path));
  assert.throws(() =>
    validateFiles([
      { path: 'a', content: 'x' },
      { path: 'a', content: 'y' },
    ]),
  );
  assert.throws(() => prepareDeck('.control\nshell x\n.endc', { type: 'op' }));
  assert.throws(() => analysisCommand({ type: 'tran', step: '1p', stop: '1' }));
  assert.throws(() => analysisCommand({ type: 'dc', source: 'V1', start: '0', end: '1', step: '-1' }));
});
test('malformed symbol, theme and raw output are rejected', () => {
  assert.throws(() => parseSymbol('PIN 0 0 LEFT 0\nPINATTR SpiceOrder 2'));
  assert.throws(() => importTheme('{"accent":"url(https://example.com)"}'));
  assert.throws(() => parseRaw('No. Points: 3\nValues:\n'));
});
test('component edits preserve models and only replace the selected device line', () => {
  const original = '* test\nR1 in out 1k\nR2 out 0 1k\n.model NM NMOS (LEVEL=1)\n.end';
  const next = changeComponent(original, 'R2', { value: '2k' });
  assert.match(next, /R2 out 0 2k/);
  assert.match(next, /\.model NM/);
  assert.equal(parseComponents(next).components.length, 2);
  assert.throws(() => changeComponent(original, 'R1', { nodes: ['a\nR3 x y 1', '0'] }));
});
test('ASC unnamed nodes cannot collide with named nodes, and names are case-insensitive', () => {
  const symbol = parseSymbol(
    'SYMATTR Prefix R\nSYMATTR Value 1k\nPIN 0 0 LEFT 0\nPINATTR SpiceOrder 1\nPIN 10 0 RIGHT 0\nPINATTR SpiceOrder 2',
  );
  const asc =
    'SYMBOL r 0 0 R0\nSYMATTR InstName R1\nSYMBOL r 100 0 R0\nSYMATTR InstName R2\nFLAG 100 0 N1\nFLAG 110 0 0';
  const c = parseComponents(importASC(asc, { r: symbol }).netlist).components;
  assert.ok(!c[0].nodes.includes('n1'));
  assert.equal(c[1].nodes[0], 'n1');
  const same = importASC(asc + '\nFLAG 0 0 n1', { r: symbol });
  assert.equal(parseComponents(same.netlist).components[0].nodes[0], 'n1');
});
test('removing or editing a continued component cannot attach its parameters elsewhere', async () => {
  const { removeComponent } = await import('../js/schematic.mjs');
  const text =
    '* continued\nV1 in 0 10\nR1 in out 1k\nR2 out 0 1k\n+ tc=0.01\nR3 out 0 1k\n.temp 127\n.end';
  const removed = removeComponent(text, 'R2');
  assert.ok(!removed.includes('tc=0.01'));
  const r = await simulate({
    files: [{ path: 'main.cir', content: removed }],
    entry: 'main.cir',
    config: { type: 'op' },
  });
  near(r.variables.find((v) => v.name === 'v(out)').real[0], 5, 1e-10);
  const edited = changeComponent(text, 'R2', { nodes: ['out', 'other'] });
  assert.match(edited, /R2 out other 1k tc=0.01/);
  assert.ok(!edited.includes('\n+'));
});
test('descending DC scans remain addressable from either end of the plot', async () => {
  const { sampleAtFraction } = await import('../js/view.mjs');
  const result = {
    plot: 'DC transfer characteristic',
    variables: [{ real: Float64Array.from([5, 4, 3, 2, 1, 0]) }],
  };
  assert.equal(sampleAtFraction(result, 0), 5);
  assert.equal(sampleAtFraction(result, 1), 0);
  assert.equal(sampleAtFraction(result, 0.4), 3);
});
test('standard SPICE titles and explicitly untitled snippets both simulate correctly', async () => {
  const body = 'V1 in 0 10\nR1 in out 1k\nR2 out 0 1k\n.end';
  for (const [content, titleLine] of [
    ['Voltage divider\n' + body, true],
    [body, false],
  ]) {
    const r = await simulate({
      entry: 'main.cir',
      files: [{ path: 'main.cir', content }],
      config: { type: 'op', titleLine },
    });
    near(r.variables.find((v) => v.name === 'v(out)').real[0], 5, 1e-10);
  }
});
test('imported analysis directives preserve time window, internal step and sweep direction', async () => {
  const { inferAnalysis } = await import('../js/spice.mjs');
  assert.deepEqual(inferAnalysis('* t\n.tran 1n 10u 2u 0.5n uic\n.end'), {
    type: 'tran',
    step: '1n',
    stop: '10u',
    begin: '2u',
    maxStep: '0.5n',
    uic: true,
  });
  assert.deepEqual(inferAnalysis('* t\n.dc V1 5 0 -1\n.end'), {
    type: 'dc',
    source: 'V1',
    start: '5',
    end: '0',
    step: '-1',
  });
});
