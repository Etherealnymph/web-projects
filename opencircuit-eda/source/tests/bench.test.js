import { describe, it, expect } from 'vitest';
import ngspice from '../public/engine/ngspice.mjs';
import { executeAnalysis } from '../src/analysis-engine.js';
import { experiments } from '../src/bench-experiments.js';
import { buildGenerator, makeGenerator } from '../src/bench-generator.js';
import { spectrum, nearestIndex, statistics, triggerCrossing } from '../src/bench-measure.js';

async function runExperiment(id) {
  const lab=experiments.find(x=>x.id===id);
  const files=lab.files.map(({name:path, content})=>({path,content}));
  return executeAnalysis({entry:lab.entry,config:lab.config,files},ngspice);
}
const trace = (r,name) => r.traces.find(t=>t.name===name);

describe('SPICE instrument bench', () => {
  it('time-weights DC and true RMS for nonuniform samples',()=>{
    const s=statistics([0,0.1,1],[0,0.1,1]);
    expect(s.mean).toBeCloseTo(.5,10);
    expect(s.rms).toBeCloseTo(Math.sqrt(1/3),10);
    expect(s.acRms).toBeCloseTo(Math.sqrt(1/12),10);
    expect(triggerCrossing([0,.1,1],[0,.1,1],.5)).toBeCloseTo(.5,10);
    expect(triggerCrossing([0,.1,1],[1,.9,0],.5,'fall')).toBeCloseTo(.5,10);
  });
  it('retrieves bin-centered sine RMS, DC and Nyquist without doubling either endpoint',()=>{
    const n=1024, times=Array.from({length:n},(_,i)=>i/1024);
    const y=times.map((t,i)=>2+Math.sin(20*2*Math.PI*t)+0.1*(-1)**i);
    for (const window of ['hann','rect']) {
      const spec=spectrum(times,y,{window,size:n});
      expect(spec.rms[0]).toBeCloseTo(2,10);
      expect(spec.rms[20]).toBeCloseTo(1/Math.sqrt(2),10);
      expect(spec.rms[512]).toBeCloseTo(.1,10);
      expect(spec.rbw).toBeCloseTo(window==='hann'?1.5:1,10);
    }
  });
  it('runs the included two-tone source and recovers both RMS spectral lines',async()=>{
    const r=await runExperiment('tone'), spec=spectrum(r.x.values,trace(r,'v(out)').values,{size:8192});
    expect(spec.df).toBeCloseTo(125,4);
    for (const [f,amp] of [[1000,1],[3000,.25]]) {
      const index=nearestIndex(spec.frequencies,f);
      expect(spec.frequencies[index]).toBeCloseTo(f,4);
      expect(Math.abs(spec.rms[index]-amp/Math.sqrt(2))).toBeLessThan(0.001);
    }
  });
  it('runs the remaining six decks and checks expected physical responses',async()=>{
    const d=await runExperiment('divider');
    expect(trace(d,'v(out)').values[0]).toBeCloseTo(10/3,6);
    expect(trace(d,'i(vsense)').values[0]).toBeCloseTo(5/3000,8);
    const b=await runExperiment('bridge');
    expect(trace(b,'v(left)').values[0]-trace(b,'v(right)').values[0]).toBeCloseTo(-.119048,5);
    const dc=await runExperiment('diode-dc');
    expect(trace(dc,'i(vsense)').values.at(-1)).toBeCloseTo((1-trace(dc,'v(anode)').values.at(-1))/100,8);
    const rc=await runExperiment('rc-step');
    const k=nearestIndex(rc.x.values,199.1e-6);
    expect(trace(rc,'v(out)').values[k]).toBeCloseTo(3.2673*(1-Math.exp(-1)),1);
    const ac=await runExperiment('rc-bode'), fc=1/(2*Math.PI*1e3*1e-7), i=nearestIndex(ac.x.values,fc);
    const curve=trace(ac,'v(out)');
    expect(Math.hypot(curve.values[i],curve.imag[i])).toBeCloseTo(1/Math.sqrt(2),2);
    const rlc=await runExperiment('rlc'), t=trace(rlc,'v(out)');
    const mag=t.values.map((v,i)=>Math.hypot(v,t.imag[i]));
    expect(Math.abs(rlc.x.values[mag.indexOf(Math.max(...mag))]-5033)).toBeLessThan(100);
  });
  it.each(['sine','square','triangle','harmonics','equation'])('generator preview matches ngspice for %s',async wave=>{
    const g=makeGenerator({wave,positive:'out',equation:'sin(2*pi*f*t)^3+0.1'});
    const r=await executeAnalysis({entry:'gen.cir',config:{type:'tran',step:'1u',stop:'2m',maxStep:'1u'},files:[{path:'gen.cir',content:'* Generated voltage source\n'+g.line+'\nRload out 0 1k\n.end'}]},ngspice);
    const values=trace(r,'v(out)').values;
    let maxError=0;
    r.x.values.forEach((t,i)=>{maxError=Math.max(maxError,Math.abs(g.at(t)-values[i]));});
    expect(maxError).toBeLessThan(1e-6);
  });
  it('rejects invalid netlist tokens and malformed arithmetic',()=>{
    expect(()=>buildGenerator({positive:'out\n.end'})).toThrow();
    expect(()=>buildGenerator({wave:'equation',equation:'sin(t)+.end'})).toThrow();
    expect(()=>buildGenerator({wave:'equation',equation:'f(t)'})).toThrow();
    expect(()=>buildGenerator({wave:'equation',equation:'sin(t)^t'})).toThrow();
  });
});
