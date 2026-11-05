import {evaluate,DEFAULT_PROCESS,NOMINAL_SCENARIO,KQ,validateProcess} from './models.mjs';
const n=x=>Number(x).toExponential(9);
export function teachingNetlist(id,a,p=DEFAULT_PROCESS,s=NOMINAL_SCENARIO){
 const d=evaluate(id,a,p,s),sc={...NOMINAL_SCENARIO,...s};
 let lines=[`* Analog Atlas - ${id} - GENERIC TEACHING MODEL`,`* No foundry devices. Not TSMC / PDK validation.`,`* Analytic and behavioral assumptions are documented in Analog Atlas.`,'.options reltol=1e-8 abstol=1e-14 vntol=1e-10'];
 if(id==='ring'||id==='starved'){
  const count=a.stages,v=a.vdd*sc.supply,c=a.cap*1e-15*sc.capacitance;
  lines.push(`.param VDD=${n(v)}`);
  for(let k=0;k<count;k++){
   let prev=k===0?count:k;
   if(id==='ring')lines.push(`B${k+1} d${k+1} 0 V={VDD/2*(1-tanh((V(n${prev})-VDD/2)*20))}`,`R${k+1} d${k+1} n${k+1} ${n(d.resistance)}`);
   else lines.push(`B${k+1} 0 n${k+1} I={${n(a.current*1e-6)}*(tanh((VDD/2-V(n${prev}))*40)-100*(max(V(n${k+1})-VDD,0)+min(V(n${k+1}),0)))}`);
   lines.push(`C${k+1} n${k+1} 0 ${n(c)} IC=${n(k===0?.01:v/2)}`);
  }
  lines.push(`* Starved export assumes crossing excursion = 0.5 VDD (UI input: ${a.swing??'n/a'}).`,`* Behavioral saturation/clamps cause small departures from ideal timing.`,`.tran ${n(1/d.frequency/150)} ${n(25/d.frequency)} UIC`,'.save v(n1) v(n2)');
 }else if(id==='lc'){
  lines.push('* Differential equivalent tank; cubic limiting conductance is pedagogical.',`L1 out 0 ${n(a.inductance*1e-9)} IC=0`,`C1 out 0 ${n(a.cap*1e-12*sc.capacitance)} IC=0.001`,`Rloss out 0 ${n(d.rp)}`,`Bneg out 0 I={-${n(a.gm*1e-3/2)}*V(out)+${n(a.gm*1e-3/2/.25)}*V(out)^3}`,`.tran ${n(1/d.frequency/100)} ${n(200/d.frequency)} UIC`,'.save v(out)');
 }else if(id==='relaxation'){
  const v=a.vdd*sc.supply,f=1/(2*a.cap*1e-12*sc.capacitance*(a.high-a.low)/(a.current*1e-6));
  lines.push('* Ideal hysteretic switch: zero comparator delay; no modeled IQ.',`Vdd vdd 0 ${n(v)}`,'Rpull vdd out 1k','Scomp out 0 cap 0 HYST',`.model HYST SW(Ron=0.001 Roff=1e12 Vt=${n((a.high+a.low)/2)} Vh=${n((a.high-a.low)/2)})`,`Bcharge 0 cap I={${n(a.current*1e-6)}*(2*V(out)/${n(v)}-1)}`,`Ctim cap 0 ${n(a.cap*1e-12*sc.capacitance)} IC=${n(a.low-.01)}`,`.tran ${n(1/f/400)} ${n(12/f)} UIC`,'.save v(cap) v(out)');
 }else if(['bandgap','ptat','ctat','beta'].includes(id)){
  const t0=p.nominal.temperatureC,dt=`(V(temperature)-${n(t0)})`,t='(V(temperature)+273.15)',res=`(${n(a.r*1e3*sc.resistance)}*(1+${n(a.rtc*1e-6)}*${dt}))`;
  const vb=`(${n(a.vbe??.65)}+${n((a.slope??-1.8)*1e-3)}*${dt}+${n((a.curvature??0)*1e-6)}*${dt}^2)`;
  const dv=`(${n(KQ*Math.log(a.area??8))}*${t})`;
  lines.push('* Behavioral temperature transfer only, not a transistor reference circuit.',`Vtemp temperature 0 ${n(a.temp)}`);
  if(id==='bandgap')lines.push(`Breference out 0 V={${vb}+${n(a.ratio)}*${dv}}`,'Rload out 0 1G');
  else{
   let expr=id==='ptat'?`${dv}/${res}`:id==='ctat'?`${vb}/${res}`:`${n(2*(1-1/Math.sqrt(a.ratio))**2)}/(${n(p.nominal.muN_uA_V2*1e-6*sc.mobility*a.wl)}*(${n(t0+273.15)}/${t})^${n(p.nominal.mobilityExponent)}*${res}^2)`;
   lines.push(`Breference 0 out I={${expr}}`,'Rreadout out 0 1k','* Iref = V(out)/1000; no compliance or load regulation model.');
  }
  lines.push('.dc Vtemp -40 125 1','.save v(out) v(temperature)');
 }else if(id==='pll'){
  const rise=1/(d.fc*1000);
  lines.push('* Locked-state linear phase model. Voltages ref/y represent phase in rad.',`Vref ref 0 PWL(0 0 ${n(rise)} 1) AC 1`,`Bcp 0 control I={${n(d.icp/(2*Math.PI))}*(V(ref)-V(y))}`,`C1 control 0 ${n(d.C1)} IC=0`,`Rfilter control c2 ${n(d.R)}`,`C2 c2 0 ${n(d.C2)} IC=0`,`Bphase 0 y I={${n(2*Math.PI*d.kv/d.N)}*V(control)}`,'Cphase y 0 1 IC=0',`.tran ${n(Math.min(d.tp/20,rise))} ${n(8/d.fc)} UIC`,'.save v(ref) v(y) v(control)');
 }
 lines.push('.end');return lines.join('\n')+'\n';
}
export function processTemplate(a,p=DEFAULT_PROCESS){
 validateProcess(p);
 const hasModels=p.devices.nmos.model&&p.devices.pmos.model&&p.spice.libraryPath;
 const lines=['* Analog Atlas - process-mapped ring oscillator TEMPLATE','* UNVALIDATED. Verify license, device syntax, pin order, voltage and geometry.','* This template only wires a CMOS ring. It is not a foundry-approved design.',`* Config label: ${p.name.replace(/[\r\n]/g,' ')}`];
 if(p.spice.libraryPath){lines.push(p.spice.section?`.lib "${p.spice.libraryPath}" ${p.spice.section}`:`.include "${p.spice.libraryPath}"`);}else lines.push('* REQUIRED: insert local .lib or .include after receiving authorized PDK.');
 const mos=(type,i,nodes,w)=>{const m=p.devices[type];return `${m.kind}${i} ${m.pinOrder.map(k=>nodes[k]).join(' ')} ${m.model||`UNMAPPED_${type.toUpperCase()}`} W=${n(w)} L=${n(p.nominal.minLengthUm*1e-6)}`;};
 const l=p.nominal.minLengthUm*1e-6,v=a.vdd??p.nominal.vddV,stages=a.stages??5,wl=a.wl??4;
 lines.push(`Vdd vdd 0 ${n(v)}`);
 for(let k=1;k<=stages;k++){const prev=k===1?stages:k-1;lines.push(mos('nmos',`n${k}`,{D:`n${k}`,G:`n${prev}`,S:'0',B:'0'},wl*l),mos('pmos',`p${k}`,{D:`n${k}`,G:`n${prev}`,S:'vdd',B:'vdd'},wl*l*2),`Cload${k} n${k} 0 ${n((a.cap??100)*1e-15)}`);}
 lines.push('* Geometry/PMOS ratio are teaching seeds, not PDK sizing results.','.ic V(n1)=0.01','.tran 1p 100n UIC','.save v(n1)','.end');
 return {ready:Boolean(hasModels),text:lines.join('\n')+'\n'};
}
