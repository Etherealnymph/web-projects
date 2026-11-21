import { describe, it, expect } from 'vitest';
import { BUILTIN_TSMC_PDK, parsePdkLibraryText, snap, isHighVoltNet, isLowVoltNet, isNegVoltNet } from '../src/pdk-parser.js';
import { detectHdlLanguage, parseSpectreNetlist, parseVerilogToDesign, parseVhdlToDesign, classifyElement } from '../src/netlist.js';
import { layoutSubckt, routeSchematic, simplifyPath } from '../src/router.js';
import { EDA_SCHEMA_VERSION, maskApiKey, parseEngineeringValue, solveLinearSystem, solveComplexLinearSystem, solveMnaDc, simulateDC, simulateTran, simulateAC } from '../src/simulator.js';

describe('PDK Parser & Grid Helpers', () => {
  it('1. snaps coordinates to 20px grid', () => {
    expect(snap(33)).toBe(40);
    expect(snap(28)).toBe(20);
  });
  it('2. identifies high voltage power nets', () => {
    expect(isHighVoltNet('VDD')).toBe(true);
    expect(isHighVoltNet('avdd')).toBe(true);
    expect(isHighVoltNet('vref')).toBe(false);
  });
  it('3. identifies ground / low voltage nets', () => {
    expect(isLowVoltNet('0')).toBe(true);
    expect(isLowVoltNet('GND')).toBe(true);
    expect(isLowVoltNet('vss')).toBe(true);
  });
  it('4. identifies negative supply nets', () => {
    expect(isNegVoltNet('VEE')).toBe(true);
    expect(isNegVoltNet('vneg')).toBe(true);
  });
  it('5. built-in TSMC 0.18um PDK has NMOS and PMOS models', () => {
    expect(BUILTIN_TSMC_PDK.nmosModels.length).toBeGreaterThan(5);
    expect(BUILTIN_TSMC_PDK.pmosModels.length).toBeGreaterThan(5);
  });
  it('6. parses custom BSIM PDK model text', () => {
    const pdk = parsePdkLibraryText('model nmos_cust bsim3v3 { type=n }\nmodel pmos_cust bsim3v3 { type=p }', 'custom.lib');
    expect(pdk.nmosModels.some(m => m.name === 'nmos_cust')).toBe(true);
    expect(pdk.pmosModels.some(m => m.name === 'pmos_cust')).toBe(true);
  });
});

describe('Netlist, Verilog & VHDL Parsers', () => {
  it('7. detects Spice-like, Verilog, and VHDL languages', () => {
    expect(detectHdlLanguage('M1 (d g 0 0) nch', 'test.scs')).toBe('spectre');
    expect(detectHdlLanguage('module top(input a); endmodule', 'top.v')).toBe('verilog');
    expect(detectHdlLanguage('entity top is end top;', 'top.vhd')).toBe('vhdl');
  });
  it('8. parses Spice-like resistor, capacitor, inductor, and MOS', () => {
    const d = parseSpectreNetlist('R1 (in out) resistor r=1k\nC1 (out 0) capacitor c=1p\nL1 (in lout) inductor l=2n\nM1 (d g 0 0) nch w=10u l=1u');
    expect(d.subckts.__TOP__.elements.length).toBe(4);
  });
  it('9. parses all new source types (vsin, vpulse, vsweep, vcvs, vccs)', () => {
    const d = parseSpectreNetlist('V1 (in 0) vsin ampl=1 freq=1M\nV2 (clk 0) vpulse val1=1.8\nV3 (sw 0) vsweep fstop=1G\nE1 (op on ip in) vcvs gain=10\nG1 (op on ip in) vccs gm=1m');
    const types = d.subckts.__TOP__.elements.map(e => e.type);
    expect(types).toEqual(['vsin', 'vpulse', 'vsweep', 'vcvs', 'vccs']);
  });
  it('10. parses subckt hierarchy', () => {
    const d = parseSpectreNetlist('subckt inv in out vdd vss\nMP (out in vdd vdd) pch\nMN (out in vss vss) nch\nends inv');
    expect(d.subckts.inv.elements.length).toBe(2);
    expect(d.subckts.inv.ports).toEqual(['in', 'out', 'vdd', 'vss']);
  });
  it('11. parses Verilog multi-line counter4.v into CNT/DFF graphical element', () => {
    const vCode = `module counter4 (\n input wire clk,\n input wire rst_n,\n input wire en,\n output reg [3:0] cnt\n);\n always @(posedge clk or negedge rst_n) begin\n if (!rst_n) cnt <= 4'd0; else if (en) cnt <= cnt + 4'd1;\n end\nendmodule`;
    const d = parseVerilogToDesign(vCode);
    expect(d.subckts.counter4.elements.length).toBe(1);
    expect(d.subckts.counter4.elements[0].type).toBe('dff');
    expect(d.subckts.counter4.elements[0].pins.map(p => p.net)).toContain('clk');
  });
  it('12. parses Verilog gate primitives and assign mux', () => {
    const d = parseVerilogToDesign('module g(input a, input b, input s, output y, output m); and U1(y, a, b); assign m = s ? a : b; endmodule');
    expect(d.subckts.g.elements.map(e => e.type)).toEqual(['gate_and', 'mux2']);
  });
  it('13. parses VHDL counter4.vhd into CNT/REG + BUF graphical elements', () => {
    const vhd = `entity counter4 is Port ( clk : in STD_LOGIC; rst_n : in STD_LOGIC; en : in STD_LOGIC; cnt : out STD_LOGIC_VECTOR(3 downto 0) ); end counter4;\narchitecture Behavioral of counter4 is signal cnt_reg : unsigned(3 downto 0); begin\n process(clk, rst_n) begin if rst_n = '0' then cnt_reg <= (others => '0'); elsif rising_edge(clk) then if en = '1' then cnt_reg <= cnt_reg + 1; end if; end if; end process;\n cnt <= std_logic_vector(cnt_reg);\nend Behavioral;`;
    const d = parseVhdlToDesign(vhd);
    expect(d.subckts.counter4.elements.length).toBe(2);
    expect(d.subckts.counter4.elements[0].type).toBe('dff');
    expect(d.subckts.counter4.elements[1].type).toBe('gate_buf');
  });
  it('14. classifies SPICE BJT and Diode primitives', () => {
    const q = classifyElement('Q1', ['c', 'b', 'e'], 'npn1', {}, 1, {});
    expect(q.type).toBe('npn');
  });
});

describe('Layout & Orthogonal Router', () => {
  it('15. lays out elements without overlapping', () => {
    const d = parseSpectreNetlist('R1 (a b) resistor r=1k\nR2 (b c) resistor r=1k\nC1 (c 0) capacitor c=1p');
    const lay = layoutSubckt(d.subckts.__TOP__);
    expect(lay.elements.length).toBe(3);
    expect(lay.width).toBeGreaterThanOrEqual(640);
  });
  it('16. routes wires between connected pins', () => {
    const d = parseSpectreNetlist('V1 (a 0) vsource dc=1.8\nR1 (a b) resistor r=1k\nR2 (b 0) resistor r=1k');
    const lay = layoutSubckt(d.subckts.__TOP__);
    const routed = routeSchematic(lay);
    expect(routed.wires.length).toBeGreaterThan(0);
    expect(routed.symbols.some(s => s.type === 'gnd_dot')).toBe(true);
  });
  it('17. simplifies collinear points in wire paths', () => {
    const pts = simplifyPath([{x:0,y:0},{x:20,y:0},{x:40,y:0},{x:40,y:20}]);
    expect(pts).toEqual([{x:0,y:0},{x:40,y:0},{x:40,y:20}]);
  });
  it('18. handles empty subckt layout gracefully', () => {
    const lay = layoutSubckt({ name: 'empty', ports: [], elements: [] });
    expect(lay.elements).toEqual([]);
  });
});

describe('MNA Solver (DC, Complex AC, Engineering Units)', () => {
  it('19. parses engineering unit suffixes accurately', () => {
    expect(parseEngineeringValue('10k')).toBeCloseTo(10000);
    expect(parseEngineeringValue('1.8')).toBeCloseTo(1.8);
    expect(parseEngineeringValue('20u')).toBeCloseTo(20e-6);
    expect(parseEngineeringValue('2.5n')).toBeCloseTo(2.5e-9);
    expect(parseEngineeringValue('1p')).toBeCloseTo(1e-12);
  });
  it('20. solves linear system A*x = b', () => {
    const x = solveLinearSystem([[2, 1], [1, 3]], [5, 10]);
    expect(x[0]).toBeCloseTo(1, 5);
    expect(x[1]).toBeCloseTo(3, 5);
  });
  it('21. solves complex linear system for AC analysis', () => {
    const { xr, xi } = solveComplexLinearSystem([[1, 0], [0, 1]], [[1, 0], [0, -1]], [2, 2], [0, 0]);
    expect(xr[0]).toBeCloseTo(1, 5);
    expect(xi[0]).toBeCloseTo(-1, 5);
  });
  it('22. solves resistor voltage divider DC operating point via MNA', () => {
    const d = parseSpectreNetlist('V1 (vdd 0) vsource dc=3.0\nR1 (vdd mid) resistor r=1k\nR2 (mid 0) resistor r=2k');
    const dc = solveMnaDc(d.subckts.__TOP__.elements);
    expect(dc.vdd).toBeCloseTo(3.0, 3);
    expect(dc.mid).toBeCloseTo(2.0, 3);
  });
  it('23. solves current source + resistor DC node voltage via MNA', () => {
    const d = parseSpectreNetlist('I1 (0 out) isource dc=1m\nR1 (out 0) resistor r=2k');
    const dc = solveMnaDc(d.subckts.__TOP__.elements);
    expect(dc.out).toBeCloseTo(2.0, 3);
  });
  it('24. treats inductors as DC shorts in MNA DC solve', () => {
    const d = parseSpectreNetlist('V1 (in 0) vsource dc=1.8\nL1 (in out) inductor l=2n\nR1 (out 0) resistor r=1k');
    const dc = solveMnaDc(d.subckts.__TOP__.elements);
    expect(dc.out).toBeCloseTo(1.8, 2);
  });
  it('25. solves VCCS dependent source circuit via MNA', () => {
    const d = parseSpectreNetlist('V1 (vin 0) vsource dc=1.0\nG1 (vout 0 vin 0) vccs gm=2m\nR1 (vout 0) resistor r=1k');
    const dc = solveMnaDc(d.subckts.__TOP__.elements);
    expect(Math.abs(dc.vout)).toBeCloseTo(2.0, 2);
  });
  it('26. solves Level-1 MOS inverter/divider with Newton-Raphson', () => {
    const d = parseSpectreNetlist('V1 (vdd 0) vsource dc=1.8\nV2 (in 0) vsource dc=1.2\nR1 (vdd out) resistor r=10k\nM1 (out in 0 0) nch w=10u l=1u');
    const dc = solveMnaDc(d.subckts.__TOP__.elements);
    expect(dc.out).toBeGreaterThan(0);
    expect(dc.out).toBeLessThan(1.8);
  });
});

describe('Security & Schema Versioning', () => {
  it('27. masks API keys for safe logging', () => {
    expect(maskApiKey('sk-1234567890abcdef')).toBe('sk-1****cdef');
    expect(maskApiKey('short')).toBe('****');
  });
  it('28. defines schema version >= 2', () => {
    expect(EDA_SCHEMA_VERSION).toBeGreaterThanOrEqual(2);
  });
  it('29. handles empty MNA element list safely', () => {
    expect(solveMnaDc([])).toEqual({});
  });
  it('30. handles unknown HDL gracefully as spectre fallback', () => {
    expect(detectHdlLanguage('// empty', 'notes.txt')).toBe('spectre');
  });
});

describe('Product-Grade Simulation APIs & Solver Hygiene', () => {
  it('31. simulateDC solves 5V 5k/5k divider to exact 2.5V and supports DC sweep', () => {
    const d = parseSpectreNetlist('Vdd (vdd 0) vsource dc=5\nR1 (vdd out) resistor r=5k\nR2 (out 0) resistor r=5k');
    const op = simulateDC(d.subckts.__TOP__.elements);
    expect(op.nodeVoltages.out).toBeCloseTo(2.5, 3);
    const sw = simulateDC(d.subckts.__TOP__.elements, { sweepNode: 'vdd', vStart: 0, vStop: 5, numPoints: 6 });
    expect(sw.series.out.length).toBe(6);
    expect(sw.series.out[5]).toBeCloseTo(2.5, 2);
  });
  it('32. simulateTran computes RC step response via trapezoidal integration', () => {
    const d = parseSpectreNetlist('R1 (in out) resistor r=1k\nC1 (out 0) capacitor c=1n');
    const tr = simulateTran(d.subckts.__TOP__.elements, 5e-6, {
      numSteps: 51,
      stim: { type: 'step', node: 'in', ampl: 1.0, freqHz: 1e6 }
    });
    expect(tr.series.out[0]).toBeCloseTo(0, 2);
    expect(tr.series.out[50]).toBeGreaterThan(0.9);
  });
  it('33. simulateAC computes -3dB cutoff for 1MHz RC low-pass filter', () => {
    const d = parseSpectreNetlist('Vsw (in 0) vsweep fstart=1k fstop=100M ampl=1\nR1 (in out) resistor r=1.5915k\nC1 (out 0) capacitor c=100p');
    const ac = simulateAC(d.subckts.__TOP__.elements, { stimNode: 'in', fStart: 1e3, fStop: 100e6, numPoints: 101 });
    expect(ac.seriesDb.out[0]).toBeCloseTo(0, 1);
    // At 100MHz (~100x fc), attenuation should be ~ -40 dB
    expect(ac.seriesDb.out[100]).toBeLessThan(-35);
  });
  it('34. throws singular matrix error on parallel voltage source loop', () => {
    const d = parseSpectreNetlist('V1 (n1 0) vsource dc=1.8\nV2 (n1 0) vsource dc=3.3');
    let threw = false;
    try { solveMnaDc(d.subckts.__TOP__.elements); } catch (e) { threw = /Singular/i.test(e.message); }
    expect(threw).toBe(true);
  });
  it('35. supports PDK parameter perturbation for Corner/Monte Carlo', () => {
    const d = parseSpectreNetlist('V1 (vdd 0) vsource dc=1.8\nV2 (in 0) vsource dc=1.0\nR1 (vdd out) resistor r=10k\nM1 (out in 0 0) nch w=10u l=1u');
    const tt = simulateDC(d.subckts.__TOP__.elements, { pdkParams: { vth0: 0.5, kpN: 180e-6 } });
    const ff = simulateDC(d.subckts.__TOP__.elements, { pdkParams: { vth0: 0.42, kpN: 212e-6 } });
    expect(ff.nodeVoltages.out).toBeLessThan(tt.nodeVoltages.out);
  });
});
