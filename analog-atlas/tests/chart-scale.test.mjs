import test from 'node:test';
import assert from 'node:assert/strict';
import {chartDomain,axisLabels,NONNEGATIVE_UNITS} from '../chart-scale.mjs';
import {DEFAULTS,DEFAULT_PROCESS,NOMINAL_SCENARIO,sweep} from '../models.mjs';

test('default ring power remains unchanged and uses a legible centered view',()=>{
 const points=sweep('ring',DEFAULTS.ring,DEFAULT_PROCESS,NOMINAL_SCENARIO,'cap',20,300),power=points.map(p=>p.power),copy=[...power];
 const d=chartDomain(power,{padding:0,nonNegative:true});
 assert.equal(d.nearConstant,true);assert.deepEqual(power,copy);
 assert.ok(Math.abs(d.min/d.center-.95)<1e-12);assert.ok(Math.abs(d.max/d.center-1.05)<1e-12);
 const labels=axisLabels(Array.from({length:5},(_,i)=>d.min+i*(d.max-d.min)/4),'W');
 assert.equal(new Set(labels).size,5);
});
test('padding cannot produce negative ticks for nonnegative physical outputs',()=>{
 const points=sweep('ring',DEFAULTS.ring,DEFAULT_PROCESS,NOMINAL_SCENARIO,'cap',20,300);
 assert.ok(points.every(p=>p.y>0));const d=chartDomain(points.map(p=>p.y),{nonNegative:true});assert.equal(d.min,0);assert.ok(d.max>Math.max(...points.map(p=>p.y)));
});
test('signed sensitivity and phase domains preserve negative values',()=>{
 for(const unit of ['%','°','dB','°C'])assert.equal(NONNEGATIVE_UNITS.has(unit),false);
 const signed=chartDomain([-20,0,25]);assert.ok(signed.min< -20);assert.ok(signed.max>25);
 const negative=chartDomain([-180,-125],{nonNegative:true});assert.ok(negative.min< -180);
});
test('tick precision adapts instead of repeating rounded labels',()=>{
 const ticks=[1,1.00001,1.00002,1.00003,1.00004];
 assert.equal(new Set(axisLabels(ticks,'V')).size,5);
 assert.ok(axisLabels([-40,-20,1.42e-14,20,40],'dB').includes('0dB'));
});
test('genuine power variations keep their actual domain',()=>{
 const d=chartDomain([1e-3,2e-3,3e-3],{padding:0,nonNegative:true});assert.equal(d.nearConstant,false);assert.equal(d.min,.001);assert.equal(d.max,.003);
});
