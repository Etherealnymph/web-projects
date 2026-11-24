import { describe, it, expect } from 'vitest';
import { readModelControls, indexModelSources, writeControl } from '../src/model-controls.js';
import { executeAnalysis } from '../src/analysis-engine.js';
import createModule from '../public/engine/ngspice.mjs';

const entry = 'schematics/transfer.cir';
const library = {
  path: 'models/device corners.lib',
  content:
    '* QA\n.lib TT\n.model NQ NMOS(level=1 vto=.5 kp=100u)\n.endl TT\n.lib ss\n.model NQ NMOS(level=1 vto=.5 kp=40u)\n.endl ss\n',
};
const deck =
  '* transfer\r\n.lib   "../models/device corners.lib"   TT  $ keep TT\r\n.param BIAS=1  LOAD=2k\r\nVD drain 0 1\r\nVG gate 0 {BIAS}\r\nM1 drain gate 0 0 NQ w=1u l=1u\r\n.op\r\n.end\r\n';

describe('model corners and source-aware design variables', () => {
  it('preserves original path, line spacing, CRLF, comments and all other assignments', () => {
    const fields = readModelControls(entry, deck);
    expect(fields.corners).toHaveLength(1);
    expect(fields.corners[0]).toMatchObject({ path: 'models/device corners.lib', value: 'TT', line: 2 });
    expect(fields.parameters.map((p) => p.name)).toEqual(['BIAS', 'LOAD']);
    expect(writeControl(deck, fields.corners[0], 'ss', ['TT', 'ss'])).toBe(
      deck.replace('   TT  $', '   ss  $'),
    );
    expect(writeControl(deck, fields.parameters[0], '.9')).toBe(deck.replace('BIAS=1', 'BIAS=.9'));
  });
  it('exposes only unambiguous literal values and top-level variables', () => {
    const source =
      'simulator lang=spectre\nparameters a=5 expr={a + b=9} b=12n quote="q=7" c=-2e-3 joined=2 + 9 // fake=8\nsubckt foo (a b)\nparameters local=3\nends foo\nparameters lower=1e3\n.control\n.param hidden=1\n.endc\n';
    const { parameters } = readModelControls('demo.scs', source);
    expect(parameters.map((p) => [p.name, p.value])).toEqual([
      ['a', '5'],
      ['b', '12n'],
      ['c', '-2e-3'],
      ['lower', '1e3'],
    ]);
    expect(writeControl(source, parameters[1], '20n')).toBe(source.replace('b=12n', 'b=20n'));
    expect(() => writeControl(source, parameters[1], '1\nRfake 1 0 2')).toThrow();
    expect(() => writeControl(source.replace('b=12n', 'b=15n'), parameters[1], '2n')).toThrow();
  });
  it('indexes declared sections and navigable definitions across loaded files', () => {
    const spectre = {
      path: 'models/pdk.scs',
      content:
        'library pdk\nsection FF\nmodel MP mos1 type=p\ninline subckt REF (a b)\nends REF\nendsection FF\n',
    };
    const libEntry = 'simulator lang=spectre\ninclude "../models/pdk.scs" section = FF // fast\n';
    const refs = readModelControls('circuits/demo.scs', libEntry).corners;
    const { sections, definitions } = indexModelSources([library, spectre]);
    expect(refs[0]).toMatchObject({ path: 'models/pdk.scs', value: 'FF', line: 2 });
    expect(sections.get('models/device corners.lib')).toEqual(['TT', 'ss']);
    expect(sections.get(spectre.path)).toEqual(['FF']);
    expect(definitions.find((d) => d.name === 'REF')).toEqual({
      name: 'REF',
      kind: 'subckt',
      section: 'FF',
      line: 4,
      path: spectre.path,
    });
    expect(() => writeControl(libEntry, refs[0], 'tt', ['FF'])).toThrow();
  });
  it('applies actual selected MOS corners and source parameters to ngspice', async () => {
    async function current(content) {
      const { traces } = await executeAnalysis(
        { files: [{ path: entry, content }, library], entry, config: { type: 'op' } },
        createModule,
      );
      return -traces.find((t) => t.name === 'i(vd)').values[0];
    }
    const controls = readModelControls(entry, deck);
    const slow = writeControl(deck, controls.corners[0], 'ss', ['TT', 'ss']);
    const rebias = writeControl(slow, readModelControls(entry, slow).parameters[0], '.8');
    expect(await current(deck)).toBeCloseTo(12.5e-6, 9);
    expect(await current(slow)).toBeCloseTo(5e-6, 9);
    expect(await current(rebias)).toBeCloseTo(1.8e-6, 9);
  });
});
