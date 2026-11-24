import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { executeAnalysis } from '../src/analysis-engine.js';
import {
  analysisCommand,
  engineeringNumber,
  inferAnalysis,
  prepareAnalysis,
} from '../src/analysis-deck.js';
import createModule from '../public/engine/ngspice.mjs';

const file = (path, content) => ({ path, content });
const run = (content, config, others = [], entry = 'main.cir') =>
  executeAnalysis({ files: [file(entry, content), ...others], entry, config }, createModule);
const vector = (result, name) => result.traces.find((v) => v.name === name);
const divider = '* Equal-resistance divider\nV1 in 0 DC 2 AC 1\nRa in out 1k\nRb out 0 1k\n.end';

describe('ngspice CPU/WASM analyses', () => {
  it('solves a DC operating point and signed branch currents', async () => {
    const r = await run(divider, { type: 'op' });
    expect(r.points).toBe(1);
    expect(vector(r, 'v(out)').values[0]).toBeCloseTo(1, 9);
    expect(vector(r, 'i(v1)').values[0]).toBeCloseTo(-0.001, 9);
  });
  it('honours scan direction and exposes source sweep axis', async () => {
    const r = await run(divider, { type: 'dc', source: 'V1', start: 3, end: 1, step: -1 });
    expect(r.x).toEqual({ name: 'V1', unit: 'V', values: [3, 2, 1] });
    expect(vector(r, 'v(out)').values).toEqual([1.5, 1, 0.5]);
  });
  it('returns complex RC response close to -3.01 dB / -45 degrees at fc', async () => {
    const rc = 1e-4,
      fc = 1 / (2 * Math.PI * rc);
    const r = await run('* AC\nVin in 0 DC 0 AC 1\nR1 in out 1k\nC1 out 0 100n\n.end', {
      type: 'ac',
      scale: 'lin',
      points: 3,
      start: fc,
      end: 2 * fc,
    });
    const v = vector(r, 'v(out)');
    expect(v.values[0]).toBeCloseTo(0.5, 8);
    expect(v.imag[0]).toBeCloseTo(-0.5, 8);
  });
  it('integrates a charging capacitor against the analytical curve at one time constant', async () => {
    const r = await run(
      '* RC step\nVin in 0 PULSE(0 1 0 1n 1n 1 2)\nR1 in out 1k\nC1 out 0 1u\n.tran 2u 3m',
    );
    const i = r.x.values.findIndex((t) => t >= 0.001);
    expect(
      Math.abs(vector(r, 'v(out)').values[i] - (1 - Math.exp(-r.x.values[i] / 0.001))),
    ).toBeLessThan(0.001);
  });
  it('resolves the selected nested library section and signed nonlinear model', async () => {
    const model = file(
      'pdk/lib/model.lib',
      '.lib tt\n.include "../devices/mtt.inc"\n.endl tt\n.lib bad\n.include "missing.inc"\n.endl bad',
    );
    const m = file('pdk/devices/mtt.inc', '.model NDEV NMOS(Level=1 VTO=.5 KP=100u LAMBDA=0)');
    const body =
      '* model test\n.lib "../pdk/lib/model.lib" tt\nVD d 0 DC 1\nVG g 0 DC 1\nM1 d g 0 0 NDEV w=1u l=1u\n.op';
    const r = await run(body, undefined, [model, m], 'schematics/main.sp');
    expect(r.dependencies).toContain('pdk/devices/mtt.inc');
    expect(vector(r, 'i(vd)').values[0]).toBeCloseTo(-12.5e-6, 9);
    const slow = await run(
      body,
      undefined,
      [model, { ...m, content: m.content.replace('100u', '50u') }],
      'schematics/main.sp',
    );
    expect(vector(slow, 'i(vd)').values[0]).toBeCloseTo(-6.25e-6, 9);
  });
  it('converts Spectre models, includes, subcircuits, primitive names and analysis cards', async () => {
    const entry = 'circuits/main.scs';
    const m = file(
      'pdk/models.scs',
      'simulator lang=spectre\nlibrary pkg\nsection tt\nmodel NCH mos1 type=n vto=0.5 kp=100u\nendsection tt\nendlibrary pkg',
    );
    const src =
      'simulator lang=spectre\ninclude "../pdk/models.scs" section=tt\nsubckt transistor (d g)\nmos (d g 0 0) NCH w=1u l=1u\nends transistor\nVD (d 0) vsource dc=1\nVG (g 0) vsource dc=1\ninst (d g) transistor\ndcs dc dev=VG param=dc start=0 stop=1 step=.5';
    const r = await run(src, undefined, [m], entry);
    expect(r.analysis).toBe('dc');
    expect(vector(r, 'i(vd)').values.at(-1)).toBeCloseTo(-12.5e-6, 9);
    const sine =
      'simulator lang=spectre\nV1 (in 0) vsource type=sine dc=1 ampl=1 freq=1M\nR1 (in 0) resistor r=1k\ntransient tran stop=2u step=5n';
    const t = await run(sine, undefined, [], entry);
    expect(Math.max(...vector(t, 'v(in)').values)).toBeGreaterThan(1.999);
  });
  it('runs a fixed Apache-licensed upstream SKY130 subcircuit', async () => {
    const path = 'sky130_fd_pr__ind_03_90.model.spice';
    const asset = (name) =>
      readFileSync(new URL('../public/engine/sky130/' + name, import.meta.url), 'utf8');
    const r = await run(asset('tank.cir'), undefined, [file(path, asset(path))]);
    const port = vector(r, 'v(port)'),
      magnitude = port.values.map((v, i) => Math.hypot(v, port.imag[i]));
    const peak = Math.max(...magnitude);
    expect(r.points).toBe(161);
    expect(peak).toBeGreaterThan(8);
    expect(peak).toBeLessThan(9);
    expect(r.x.values[magnitude.indexOf(peak)]).toBeGreaterThan(390e6);
    expect(r.x.values[magnitude.indexOf(peak)]).toBeLessThan(410e6);
  });
  it('runs the upstream size-binned SKY130 1.8 V NMOS TT library without editing the model cards', async () => {
    const paths = [
      'mos-transfer.cir',
      'sky130_fd_pr__nfet_01v8__mismatch.corner.spice',
      'sky130_fd_pr__nfet_01v8__tt.corner.spice',
      'sky130_fd_pr__nfet_01v8__tt.pm3.spice',
    ];
    const files = paths.map((path) =>
      file(path, readFileSync(new URL('../public/engine/sky130/' + path, import.meta.url), 'utf8')),
    );
    const r = await executeAnalysis({ files, entry: paths[0] }, createModule);
    expect(r.points).toBe(37);
    expect(r.dependencies).toHaveLength(4);
    const currents = vector(r, 'i(vd)').values;
    expect(Math.abs(currents[0])).toBeLessThan(1e-12);
    expect(-currents.at(-1)).toBeCloseTo(12.0773e-6, 9);
  });
  it('accepts ordinary SPICE title lines and named first-device snippets', async () => {
    const body = 'V1 in 0 2\nRtop in out 1k\nRbottom out 0 1k\n.op';
    for (const title of ['RC low pass filter', 'demo', '']) {
      const r = await run((title ? title + '\n' : '') + body);
      expect(vector(r, 'v(out)').values[0]).toBeCloseTo(1, 9);
    }
    const r = await run('Rtop in out 1k\nV1 in 0 2\nRbottom out 0 1k\n.op');
    expect(vector(r, 'v(out)').values[0]).toBeCloseTo(1, 9);
  });
  it('converts a flat multiline Spectre model block', async () => {
    const src =
      'simulator lang=spectre\nmodel dn diode {\nis=1p\nn=1\n}\nV1 (a 0) vsource dc=.5\nDtest (a 0) dn';
    const r = await run(src, undefined, [], 'diode.scs');
    expect(-vector(r, 'i(v1)').values[0]).toBeGreaterThan(0.0002);
    expect(-vector(r, 'i(v1)').values[0]).toBeLessThan(0.0003);
  });
  it('fails on missing libraries, bad corners, cycles and unsupported Spectre syntax', async () => {
    for (const [line, others, pattern] of [
      ['.include missing.lib', [], /missing.lib/],
      ['.lib pdk.lib ss', [file('pdk.lib', '.lib tt\n.endl')], /ss/],
      ['.include a.lib', [file('a.lib', '.include main.cir')], /循环/],
      ['.include "../secret"', [], /超出工程/],
      ['.include x', [file('x', '.control\n.endc')], /x:1/],
    ]) {
      expect(() =>
        prepareAnalysis({ entry: 'main.cir', files: [file('main.cir', '*test\n' + line), ...others] }),
      ).toThrow(pattern);
    }
    await expect(
      run('simulator lang=spectre\nQbad (a b) special abc=1', undefined, [], 'test.scs'),
    ).rejects.toThrow(/test.scs:2/);
    await expect(run('* bad\nVx in 0 2\nD1 in 0 missing_model\n.op')).rejects.toThrow();
  });
  it('validates analysis values and reads the last source analysis card', () => {
    expect(engineeringNumber('1A')).toBe(1);
    expect(engineeringNumber('5mA')).toBe(0.005);
    expect(inferAnalysis('* T\n.op\n.ac dec 20 10 1meg').type).toBe('ac');
    expect(() => analysisCommand({ type: 'dc', source: 'V1', start: 0, end: 1, step: -1 })).toThrow();
    expect(() => analysisCommand({ type: 'tran', step: '1p', stop: '1' })).toThrow();
    expect(() => analysisCommand({ type: 'ac', scale: 'lin', points: 0, start: 0, end: 1 })).toThrow();
  });
});
