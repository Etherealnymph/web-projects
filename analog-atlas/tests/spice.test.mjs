import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {DEFAULTS,evaluate,pllStep} from '../models.mjs';
import {teachingNetlist} from '../netlists.mjs';
import {simulate} from '../../circuit-lab/js/engine.mjs';
for(const [id,a] of Object.entries(DEFAULTS))test(`ngspice WASM executes generic ${id} netlist`,async()=>{
 const netlist=teachingNetlist(id,a),d=evaluate(id,a);
 await mkdir(new URL('../examples/',import.meta.url),{recursive:true});await writeFile(new URL(`../examples/${id}-teaching.cir`,import.meta.url),netlist);
 let config;
 if(['bandgap','ptat','ctat','beta'].includes(id))config={type:'dc',source:'Vtemp',start:'-40',end:'125',step:'1'};
 else{const f=id==='pll'?d.fc:d.frequency,stop=(id==='lc'?200:id==='pll'?8:25)/f;config={type:'tran',step:String(1/f/(id==='pll'?2000:400)),stop:String(stop),uic:true};}
 const result=await simulate({files:[{path:'main.cir',content:netlist}],entry:'main.cir',config});
 assert.ok(result.variables.length>0);
 const vector=name=>result.variables.find(v=>v.name===name)?.real;
 for(const v of result.variables)assert.ok(v.real.every(Number.isFinite),'finite output '+v.name);
 if(['bandgap','ptat','ctat','beta'].includes(id)){
   const temps=vector('v(temperature)'),ys=vector('v(out)');
   for(let i=0;i<temps.length;i++){const model=evaluate(id,{...a,temp:temps[i]}),expected=id==='bandgap'?model.voltage:model.current*1000;assert.ok(Math.abs(ys[i]-expected)<=1e-6*Math.max(Math.abs(expected),1e-12),id+' reference transfer vs analytic');}
 }else if(id==='pll'){
   const ys=vector('v(y)'),ref=pllStep(d),max=Math.max(...ys);assert.ok(Math.abs(ys.at(-1)-1)<1e-5);assert.ok(Math.abs(max-1-ref.overshoot)<.005,'ngspice vs RK4 overshoot absolute tolerance .005');
 }else{
   const ts=vector('time'),ys=vector(id==='lc'?'v(out)':id==='relaxation'?'v(cap)':'v(n1)'),threshold=id==='lc'?0:id==='relaxation'?(a.low+a.high)/2:a.vdd/2;
   const crossings=[];
   for(let i=1;i<ys.length;i++)if(ts[i]>ts.at(-1)*.5&&ys[i-1]<threshold&&ys[i]>=threshold)crossings.push(ts[i-1]+(ts[i]-ts[i-1])*(threshold-ys[i-1])/(ys[i]-ys[i-1]));
   assert.ok(crossings.length>=3,'sustained periodic crossings');
   const measured=(crossings.length-1)/(crossings.at(-1)-crossings[0]);
   const ideal=id==='relaxation'?evaluate(id,{...a,delay:0}).frequency:d.frequency;
   const tolerance={ring:.15,starved:.1,lc:.01,relaxation:.01}[id];
   assert.ok(Math.abs(measured/ideal-1)<tolerance,`${id}: frequency ${measured} vs analytic ${ideal}, tolerance ${tolerance}`);
 }
 console.log(id+': '+result.points+' finite points; analytic behavior checked');
});
