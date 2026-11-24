import {describe,it,expect} from 'vitest';
import {buildDesign,renderLayerSvg,exportDesign,validateComponent,instantiateComponent,componentCatalog} from '../src/design.js';
import {readFileSync} from 'node:fs';
import {storedZip} from '../src/design-export.js';

describe('Circuit hierarchy and source provenance',()=>{
  it('resolves actual section, nested relative path and source lines',()=>{
    const files={'lab/top.cir':'* circuit\n.lib "../pdk/models.lib" tt\nX1 in mid 0 filter\nM1 mid in 0 0 nt w=10u l=1u',
      'pdk/models.lib':'.lib ff\n.model nt PMOS\n.endl\n.lib tt\n.include "cell.inc"\n.model nt NMOS\n.endl tt',
      'pdk/cell.inc':'.subckt filter a z ref\nR1 a z 1k\nC1 z ref 1n\n.ends filter'};
    const d=buildDesign(files,'lab/top.cir');
    expect(d.diagnostics).toEqual([]);
    const [top,cell]=d.layers,[x,m]=top.components;
    expect(x.targetLayerId).toBe(cell.id);expect(x.pins.map(p=>p.name)).toEqual(['a','z','ref']);
    expect(x.definition.file).toBe('pdk/cell.inc');expect(x.source.line).toBe(3);
    expect(m.definition).toMatchObject({file:'pdk/models.lib',line:6,kind:'model'});
    expect(top.nets.find(n=>n.name==='0').pins.map(p=>p.pin)).toEqual([3,3,4]);
  });
  it('traces SKY130 dimension bins to the declared model family',()=>{
    const base=new URL('../public/engine/sky130/',import.meta.url);
    const manifest=JSON.parse(readFileSync(new URL('manifest.json',base),'utf8'));
    const files=Object.fromEntries(manifest.files.map(path=>[path,readFileSync(new URL(path,base),'utf8')]));
    const d=buildDesign(files,manifest.entry);
    expect(d.diagnostics).toEqual([]);
    const cell=d.layers.find(l=>l.name==='sky130_fd_pr__nfet_01v8');
    expect(cell.components[0].definition).toMatchObject({kind:'model-family',binCount:180,line:32,
      file:'sky130_fd_pr__nfet_01v8__tt.pm3.spice'});
    expect(cell.components[0].definition.bins[0].lmin).toBe('2.0e-05');
  });
  it('reports a missing subcircuit without inventing a library',()=>{
    const d=buildDesign({'dir/t.sp':'X1 a b GONE\n.include "missing.lib"','other.lib':'.subckt GONE a b\n.ends'},'dir/t.sp');
    expect(d.layers[0].components[0].definition).toBeNull();
    expect(d.diagnostics.map(m=>m.message).join(' ')).toMatch(/missing.lib.*GONE/);
  });
  it('resolves Spectre primitive parameters and model-file provenance',()=>{
    const d=buildDesign({'main.scs':'include "p.scs" section=tt\nM0 (d g 0 0) core L=1u\nR0 (d 0) resistor r=1k',
      'p.scs':'library proc\nsection tt\nmodel core bsim4 { type=n }\nendsection tt\nendlibrary proc'},'main.scs');
    expect(d.diagnostics).toEqual([]);
    expect(d.layers[0].components[0]).toMatchObject({type:'mosfet',definition:{line:3,file:'p.scs'}});
    expect(d.layers[0].components[1].value).toBe('1k');
  });
  it('shows case-sensitive named Verilog instances with actual port numbering',()=>{
    const src='// lead\nmodule main(input A, input a, output z);\nchild u(.y(z), .x(A));\nassign unused = A ^ a;\nendmodule';
    const d=buildDesign({'main.v':src,'lib/child.v':'module child(input x, output y); assign y = ~x; endmodule'},'main.v');
    expect(d.diagnostics).toEqual([]);const l=d.layers[0],c=l.components[0];
    expect(c.source.line).toBe(3);expect(c.definition.file).toBe('lib/child.v');expect(c.pins.map(p=>p.number)).toEqual([2,1]);
    expect(l.nets.map(n=>n.name)).toEqual(['z','A','a','unused']);expect(l.components[1].type).toBe('xor');
  });
  it('maps grouped VHDL ports, instances, and source lines across files',()=>{
    const top='entity top is port(a,b: in bit; z: out bit); end top;\narchitecture rtl of top is\nbegin\n U1: entity work.child port map(y => z, p => a, q => b);\nend rtl;';
    const child='entity child is port(p,q : in bit; y : out bit); end entity child;\narchitecture rtl of child is begin\n y <= p and q;\nend architecture rtl;';
    const d=buildDesign({'top.vhd':top,'child.vhd':child},'top.vhd');
    expect(d.diagnostics).toEqual([]);expect(d.layers[0].ports).toEqual(['a','b','z']);
    expect(d.layers[0].components[0].pins.map(p=>p.number)).toEqual([3,1,2]);expect(d.layers[0].components[0].source.line).toBe(4);
    expect(d.layers[1].components[0]).toMatchObject({type:'and',source:{line:3}});
  });
  it('preserves connectivity at explicit unconnected HDL ports',()=>{
    const d=buildDesign({'a.v':'module u(input x, output y); endmodule\nmodule top(input d); u U(.x(d), .y()); endmodule'},'a.v');
    const l=d.layers.find(l=>l.id===d.entryLayerId);
    expect(l.name).toBe('top');expect(l.nets.map(n=>n.name)).toEqual(['d']);
  });
  it('retains uninterpreted HDL procedures and reports scope',()=>{
    const d=buildDesign({'main.v':'module main(input a, output reg b); always @(posedge a) begin b <= ~b; end endmodule'},'main.v');
    expect(d.layers[0].components[0].type).toBe('process');expect(d.diagnostics[0].message).toContain('综合');
  });
});
describe('Schematic output and component definitions',()=>{
  const src='* input\nV1 in 0 5\nX1 in out 0 cell\nR1 out 0 1k\n.subckt cell a b ref\nR2 a b 1k\nC1 b ref 1u\n.ends\n.end\n';
  const d=buildDesign({'entry.cir':src},'entry.cir');
  it('includes all devices and the actual reference pin in SVG',()=>{
    const svg=renderLayerSvg(d.layers[0]);expect(svg.match(/data-component-id=/g)).toHaveLength(3);
    expect(svg).toContain('cell');expect(svg).toContain('ref');
  });
  it('writes source without changing directives, comments or line endings',async()=>{
    const doc=await exportDesign(d,d.entryLayerId,'native');expect(doc.name).toBe('entry.cir');expect(await doc.blob.text()).toBe(src);
  });
  it('emits one vector page per layer and all KiCad pins including reference',async()=>{
    const pdf=await (await exportDesign(d,d.entryLayerId,'pdf')).blob.text();
    expect(pdf.match(/\/Type \/Page\b/g)).toHaveLength(2);expect(pdf).not.toContain('/Image');
    const x=await (await exportDesign(d,d.entryLayerId,'kicad-xml')).blob.text();
    expect(x).toContain('<node ref="X1" pin="3"/>');
    const sch=await (await exportDesign(d,d.entryLayerId,'kicad')).blob.text();
    expect(sch).toContain('(kicad_sch (version 20231120)');expect(sch.match(/\(wire \(pts/g)).toHaveLength(7);
  });
  it('retains independent UTF-8 ZIP entries and the end directory',async()=>{
    const zip=await storedZip([{name:'电路.png',blob:new Blob(['abc'])},{name:'layer.png',blob:new Blob(['def'])}]);
    const data=new DataView(await zip.arrayBuffer());expect(data.getUint32(0,true)).toBe(0x04034b50);
    expect(data.getUint32(data.byteLength-22,true)).toBe(0x06054b50);expect(data.getUint16(data.byteLength-12,true)).toBe(2);
  });
  it('creates usable SPICE instances and deduplicates model definitions',()=>{
    for(const d of componentCatalog)expect(validateComponent(d).id).toBe(d.id);
    const diode=componentCatalog.find(x=>x.id==='diode');
    expect(instantiateComponent(diode,{name:'D1',nodes:['a','0']})).toContain('.model D_OC');
    expect(instantiateComponent(diode,{name:'D2',nodes:['b','0'],existingSource:diode.definition})).toBe('D2 b 0 D_OC');
    expect(()=>instantiateComponent(diode,{name:'R1',nodes:['a','0']})).toThrow();
  });
});
