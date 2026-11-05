/** Analytic teaching models. All internal calculations use SI units. */
export const KQ = 1.380649e-23 / 1.602176634e-19;
export const DEFAULT_PROCESS = {
  schemaVersion: 1,
  name: '通用 0.18 µm 教学参数',
  mode: 'teaching',
  target: 'tsmc180nmrf · 待授权 PDK',
  provenance: '人为设置的教学数值，不是 TSMC 工艺数据。',
  nominal: { vddV: 1.8, temperatureC: 27, muN_uA_V2: 100, vthN_V: 0.45, vthTemp_mV_C: -1, mobilityExponent: 1.5, minLengthUm: 0.18 },
  devices: { nmos: { model: '', kind: 'M', pinOrder: ['D','G','S','B'] }, pmos: { model: '', kind: 'M', pinOrder: ['D','G','S','B'] } },
  spice: { libraryPath: '', section: '' }
};
export const NOMINAL_SCENARIO = { mobility: 1, capacitance: 1, resistance: 1, supply: 1 };
export const DEFAULTS = {
  ring: { stages: 5, wl: 4, cap: 100, vdd: 1.8, temp: 27 },
  starved: { stages: 5, current: 50, cap: 100, vdd: 1.8, swing: 0.5 },
  lc: { inductance: 5, cap: 1, q: 10, gm: 3, vov: 0.2, vdd: 1.8 },
  relaxation: { current: 10, cap: 10, low: 0.6, high: 1.2, delay: 5, iq: 5, vdd: 1.8 },
  bandgap: { area: 8, ratio: 10.05, vbe: 0.65, slope: -1.8, curvature: -0.4, temp: 27, r: 10, rtc: 0 },
  ptat: { area: 8, r: 10, rtc: 100, temp: 27 },
  ctat: { vbe: 0.65, slope: -1.8, curvature: -0.4, r: 10, rtc: 100, temp: 27 },
  beta: { ratio: 4, wl: 4, r: 10, rtc: 100, temp: 27, vdd: 1.8 },
  pll: { reference: 20, divider: 50, bandwidth: 200, pm: 55, current: 100, kvco: 100 }
};
function finite(v,name){ if(!Number.isFinite(v)) throw new RangeError(`${name}必须是有限数值`); return v; }
function positive(v,name){ finite(v,name); if(v<=0) throw new RangeError(`${name}必须大于 0`); return v; }
export function validateProcess(p){
  if(!p || p.schemaVersion!==1) throw new Error('需要 schemaVersion: 1 的工艺配置。');
  if(typeof p.name!=='string' || !p.name.trim() || p.name.length>120) throw new Error('name 必须是 1–120 字的名称。');
  if(!['teaching','user-supplied'].includes(p.mode)) throw new Error('mode 仅支持 teaching 或 user-supplied。');
  if(p.target!==undefined&&typeof p.target!=='string')throw new Error('target 必须是文本。');
  if(typeof p.provenance!=='string' || !p.provenance.trim()) throw new Error('请在 provenance 中记录参数来源。');
  for(const k of ['vddV','muN_uA_V2','minLengthUm']) positive(p.nominal?.[k],`nominal.${k}`);
  for(const k of ['temperatureC','vthN_V','vthTemp_mV_C','mobilityExponent']) finite(p.nominal?.[k],`nominal.${k}`);
  if(p.nominal.temperatureC<=-273.15 || p.nominal.vthN_V<0 || p.nominal.mobilityExponent<0) throw new Error('温度、阈值或迁移率指数超出模型范围。');
  for(const key of ['nmos','pmos']){
    const d=p.devices?.[key];
    if(!d || !['M','X'].includes(d.kind) || typeof d.model!=='string' || !/^[A-Za-z0-9_.-]*$/.test(d.model)) throw new Error(`${key} 的 model 或 kind 无效。`);
    if(!Array.isArray(d.pinOrder)||d.pinOrder.length!==4||[...d.pinOrder].sort().join('')!=='BDGS') throw new Error(`${key} pinOrder 必须包含 D/G/S/B 各一次。`);
    if(d.kind==='M' && d.pinOrder.join('')!=='DGSB') throw new Error('原生 M 器件的端子顺序固定为 D/G/S/B。');
  }
  if(!p.spice || typeof p.spice.libraryPath!=='string' || typeof p.spice.section!=='string' || /[\r\n"\x00]/.test(p.spice.libraryPath) || !/^[A-Za-z0-9_.-]*$/.test(p.spice.section||'')) throw new Error('spice.libraryPath 或 section 无效。');
  return structuredClone(p);
}
function temperature(temp,p){ const t=finite(temp,'温度')+273.15; if(t<=0 || t>1000) throw new RangeError('教学温度范围为 −273.15°C 以上、726.85°C 以下。'); return {t,t0:p.nominal.temperatureC+273.15,dt:temp-p.nominal.temperatureC}; }
function resistance(v,rtc,temp,p,s){ const {dt}=temperature(temp,p); return positive(v*1e3*s.resistance*(1+rtc*1e-6*dt),'温度修正后的电阻'); }
function vbeAt(a,p){const {dt}=temperature(a.temp,p); return a.vbe+a.slope*1e-3*dt+a.curvature*1e-6*dt*dt;}
function inputChecks(a,s){ for(const [k,v] of Object.entries(a)) finite(v,k); for(const [k,v] of Object.entries(s)) positive(v,k); }
const metric=(label,value,unit,detail='')=>({label,value,unit,detail});
export function evaluate(id,a,process=DEFAULT_PROCESS,scenario=NOMINAL_SCENARIO){
  const p=process,s={...NOMINAL_SCENARIO,...scenario};inputChecks(a,s); let r={id,warnings:[],metrics:[]};
  if(id==='ring'||id==='starved'){
    if(!Number.isInteger(a.stages)||a.stages<3||a.stages%2!==1) throw new RangeError('环形振荡器需要至少 3 个奇数级。');
    const c=positive(a.cap*1e-15*s.capacitance,'负载电容'),v=positive(a.vdd*s.supply,'供电');let td,req;
    if(id==='ring'){
      const {t,t0,dt}=temperature(a.temp,p); const mu=p.nominal.muN_uA_V2*1e-6*s.mobility*(t0/t)**p.nominal.mobilityExponent;
      const vth=p.nominal.vthN_V+p.nominal.vthTemp_mV_C*1e-3*dt;
      const over=positive(v-vth,'VDD − VTH（此模型要求强反型）');
      req=1/(mu*positive(a.wl,'W/L')*over); td=.69*req*c;
    }else{ if(a.swing<=0||a.swing>=1) throw new RangeError('有效翻转行程需在 0 与 1 倍 VDD 之间。'); td=c*(v*a.swing)/positive(a.current*1e-6,'限流电流'); }
    const frequency=1/(2*a.stages*td),power=a.stages*c*v*v*frequency;
    Object.assign(r,{frequency,power,delay:td,resistance:req,metrics:[metric('振荡频率',frequency,'Hz'),metric('单级延时',td,'s'),metric('动态功耗估计',power,'W','不含偏置、短路与输出缓冲')]});
    if(id==='ring')r.metrics.push(metric('等效导通电阻',req,'Ω'));
    else r.metrics.push(metric('每级限流',a.current*1e-6,'A'));
    r.warnings.push(id==='ring'?'等效 RC 模型不包含非线性充放电、输出负载与寄生；需晶体管级瞬态校准。':'ΔV 是翻转到接收门阈值的有效行程，不等于默认全摆幅；偏置及镜像误差未建模。');
  }else if(id==='lc'){
    const l=positive(a.inductance*1e-9,'差分等效电感'),c=positive(a.cap*1e-12*s.capacitance,'差分等效电容'),q=positive(a.q,'Q');
    const frequency=1/(2*Math.PI*Math.sqrt(l*c)),rp=q*2*Math.PI*frequency*l,gm=positive(a.gm*1e-3,'每管 gm'),startup=gm*rp/2;
    const power=gm*positive(a.vov,'过驱动电压')*positive(a.vdd*s.supply,'VDD');
    Object.assign(r,{frequency,power,rp,startup,metrics:[metric('理想谐振频率',frequency,'Hz'),metric('起振裕量 gm·Rp/2',startup,'×'),metric('差分并联损耗 Rp',rp,'Ω'),metric('平方律偏置功耗',power,'W')]});
    r.warnings.push(startup>1?'小信号负阻超过损耗；这不是起振时间或稳态振幅验证。':'起振条件不满足：gm·Rp/2 必须大于 1。');
    r.warnings.push('L、C、Rp 均按差分端口定义。功耗使用 I_tail≈gm·Vov；未计算相位噪声或器件可靠性。');
  }else if(id==='relaxation'){
    const v=positive(a.vdd*s.supply,'VDD'); if(a.low<=0||a.high<=a.low||a.high>=v)throw new RangeError('阈值必须满足 0 < 下阈值 < 上阈值 < VDD。');
    const c=positive(a.cap*1e-12*s.capacitance,'定时电容'),i=positive(a.current*1e-6,'定时电流'); if(a.delay<0||a.iq<0)throw new RangeError('延时和静态电流不能为负。');
    const frequency=1/(2*c*(a.high-a.low)/i+2*a.delay*1e-9),power=v*(i/2+a.iq*1e-6);
    Object.assign(r,{frequency,power,metrics:[metric('振荡频率',frequency,'Hz'),metric('半周期',1/frequency/2,'s'),metric('供电功耗估计',power,'W','定时支路 + 输入的比较器 Iq'),metric('阈值间距',a.high-a.low,'V')]});
    r.warnings.push('假定充放电电流相等；每半周期计入一次比较器延时。导出的开关模型采用理想零延时，便于检查解析基线。');
  }else if(['bandgap','ptat','ctat','beta'].includes(id)){
    const {t,t0}=temperature(a.temp,p);const res=resistance(positive(a.r,'R'),a.rtc,a.temp,p,s); let current,voltage;
    if(id==='bandgap'||id==='ptat'){
      if(a.area<=1)throw new RangeError('BJT 电流密度比 / 面积比必须大于 1。');
      const dv=KQ*t*Math.log(a.area); current=dv/res;
      if(id==='bandgap'){
        positive(a.ratio,'加权系数');voltage=vbeAt(a,p)+a.ratio*dv;
        const cancel=-a.slope*1e-3/(KQ*Math.log(a.area));
        r.metrics=[metric('参考电压',voltage,'V'),metric('ΔVBE',dv,'V'),metric('一阶补偿系数',cancel,''),metric('PTAT 支路电流',current,'A')];
        r.warnings.push('线性温度系数只在基准温度附近抵消；曲率由显式输入项描述。未包含失调、失配、PSRR、启动或负载调节。');
      }else{r.metrics=[metric('PTAT 电流',current,'A'),metric('ΔVBE',dv,'V'),metric('热电压 kT/q',KQ*t,'V'),metric('温度修正 R',res,'Ω')];r.warnings.push('两 BJT 具有相同电流且电流密度比为 n；电阻温度系数使输出不再严格正比于绝对温度。');}
    }else if(id==='ctat'){
      voltage=vbeAt(a,p); if(voltage<=0)throw new RangeError('此温度下 VBE≤0，一阶/二阶近似已失效。'); current=voltage/res;
      r.metrics=[metric('CTAT 电流',current,'A'),metric('VBE 近似',voltage,'V'),metric('温度修正 R',res,'Ω'),metric('局部 VBE 温度斜率',(a.slope*1e-3+2*a.curvature*1e-6*(t-t0)),'V/K')];
      r.warnings.push('VBE 为固定偏置下的局部多项式近似，不是完整结方程；实际电流、电阻与 BJT 偏置相互耦合。');
    }else{
      if(a.ratio<=1)throw new RangeError('β 倍率 K 必须大于 1。');
      const beta=p.nominal.muN_uA_V2*1e-6*s.mobility*(t0/t)**p.nominal.mobilityExponent*positive(a.wl,'W/L');
      current=2*(1-1/Math.sqrt(a.ratio))**2/(beta*res*res);const gm=Math.sqrt(2*beta*current),power=2*current*positive(a.vdd*s.supply,'VDD');
      r.power=power;r.metrics=[metric('非零平衡支路电流',current,'A'),metric('M1 跨导 gm',gm,'S'),metric('两支路功耗估计',power,'W'),metric('gm·R',gm*res,'')];
      r.warnings.push('匹配阈值、强反型平方律、等电流且忽略体效应/沟道调制。零电流同样是平衡点，必须另设计启动支路；此计算未验证电压余量。');
    }
    Object.assign(r,{current,voltage});
  }else if(id==='pll')return designPLL(a);
  else throw new Error('未知拓扑');
  return r;
}
export function designPLL(a){
  inputChecks(a,NOMINAL_SCENARIO);
  for(const k of ['reference','bandwidth','current','kvco'])positive(a[k],k);
  if(!Number.isInteger(a.divider)||a.divider<1)throw new RangeError('整数 N 分频比必须是正整数。');
  if(a.pm<20||a.pm>85)throw new RangeError('相位裕度设计范围为 20°–85°。');
  const fc=a.bandwidth*1e3,wc=2*Math.PI*fc,phi=a.pm*Math.PI/180,alpha=(1+Math.sin(phi))/(1-Math.sin(phi));
  const icp=a.current*1e-6,kv=a.kvco*1e6,K=icp*kv/a.divider,Ctotal=K*Math.sqrt(alpha)/(wc*wc),C1=Ctotal/alpha,C2=Ctotal-C1,R=Math.sqrt(alpha)/wc/C2,tz=R*C2,tp=R*C1*C2/Ctotal;
  return {id:'pll',frequency:a.reference*1e6*a.divider,fc,wc,alpha,icp,kv,N:a.divider,K,C1,C2,Ctotal,R,tz,tp,pm:a.pm,warnings:[...(fc>a.reference*1e6/10?['环路交越频率大于参考频率的 1/10，连续时间近似可信度下降。']:[]),'连续时间、线性小信号、理想电荷泵 / VCO。相位阶跃响应不是频率捕获或非线性锁定时间；未包含死区、饱和、杂散与噪声。'],metrics:[metric('输出频率 N·fref',a.reference*1e6*a.divider,'Hz'),metric('单位增益交越频率',fc,'Hz'),metric('相位裕度',a.pm,'°'),metric('环路电阻 R',R,'Ω'),metric('直连电容 C₁',C1,'F'),metric('串联支路电容 C₂',C2,'F')]};
}
export function pllResponse(d,f){
  const w=2*Math.PI*positive(f,'频率'),m=d.K*Math.hypot(1,w*d.tz)/(d.Ctotal*w*w*Math.hypot(1,w*d.tp));
  const phase=-Math.PI+Math.atan(w*d.tz)-Math.atan(w*d.tp),re=m*Math.cos(phase),im=m*Math.sin(phase),den=(1+re)**2+im*im;
  return {magnitude:20*Math.log10(m),phase:phase*180/Math.PI,closedMagnitude:20*Math.log10(m/Math.sqrt(den))};
}
export function pllStep(d,{points=501,periods=8}={}){
  const end=periods/d.fc,dtMax=Math.min(d.tp/20,1/(d.fc*1500)),dt=end/Math.ceil(end/dtMax),steps=Math.round(end/dt),stride=Math.max(1,Math.floor(steps/(points-1)));
  if(steps>300000)throw new RangeError('积分步数超限。请降低相位裕度或缩短范围。');
  // v = control voltage, z = series capacitor voltage, y = divided output phase.
  const rhs=([v,z,y])=>[(d.icp/(2*Math.PI)*(1-y)-(v-z)/d.R)/d.C1,(v-z)/(d.R*d.C2),2*Math.PI*d.kv/d.N*v];
  let state=[0,0,0],out=[{x:0,y:0}],lastOutside=0,max=0;
  for(let i=1;i<=steps;i++){
    const k1=rhs(state),k2=rhs(state.map((v,j)=>v+dt*k1[j]/2)),k3=rhs(state.map((v,j)=>v+dt*k2[j]/2)),k4=rhs(state.map((v,j)=>v+dt*k3[j]));
    state=state.map((v,j)=>v+dt/6*(k1[j]+2*k2[j]+2*k3[j]+k4[j]));
    if(!state.every(Number.isFinite))throw new Error('积分不收敛');
    if(Math.abs(state[2]-1)>.02)lastOutside=i*dt;max=Math.max(max,state[2]);
    if(i%stride===0||i===steps)out.push({x:i*dt,y:state[2]});
  }
  return {points:out,overshoot:Math.max(0,max-1),settling:lastOutside<end*.98?lastOutside:null,final:state[2]};
}
export function sweep(id,a,p,s,key,start,end,count=81){
  return Array.from({length:count},(_,i)=>{const x=start+(end-start)*i/(count-1);try{const r=evaluate(id,{...a,[key]:x},p,s);return{x,y:r.frequency??(id==='bandgap'?r.voltage:r.current),power:r.power,result:r};}catch{return{x,y:null};}});
}
export function format(value,unit='',digits=3){
  if(value==null||!Number.isFinite(value))return '—';
  if(['°','×','','%','V/K'].includes(unit))return `${Number(value.toPrecision(digits))}${unit?' '+unit:''}`;
  const units=[[-15,'f'],[-12,'p'],[-9,'n'],[-6,'µ'],[-3,'m'],[0,''],[3,'k'],[6,'M'],[9,'G'],[12,'T']];
  let pair=units.findLast(([e])=>Math.abs(value)>=10**e)??[0,''];if(value===0)pair=[0,''];
  return `${Number((value/10**pair[0]).toPrecision(digits))} ${pair[1]}${unit}`;
}

/** Invert one explicitly chosen analytic relation; not a multi-objective optimizer. */
export function solveTarget(id,a,target,process=DEFAULT_PROCESS,scenario=NOMINAL_SCENARIO){
 positive(target,'目标');const d=evaluate(id,a,process,scenario),s={...NOMINAL_SCENARIO,...scenario};let key,value;
 if(id==='ring'){key='cap';value=a.cap*d.frequency/target;}
 else if(id==='starved'){key='current';value=a.current*target/d.frequency;}
 else if(id==='lc'){key='cap';value=a.cap*(d.frequency/target)**2;}
 else if(id==='relaxation'){
  const available=1/target-2*a.delay*1e-9;if(available<=0)throw new RangeError('目标频率超过比较器延时允许的上限。');
  key='current';value=2*a.cap*1e-12*s.capacitance*(a.high-a.low)/available*1e6;
 }else if(id==='bandgap'){key='ratio';value=(target-vbeAt(a,process))/(KQ*(a.temp+273.15)*Math.log(a.area));if(value<=0)throw new RangeError('正加权带隙模型的目标电压必须高于当前 VBE。');}
 else if(id==='ptat'||id==='ctat'){key='r';value=a.r*d.current/target;}
 else if(id==='beta'){key='r';value=a.r*Math.sqrt(d.current/target);}
 else throw new RangeError('PLL 请直接设置交越频率、相位裕度与分频比。');
 const result={...a,[key]:value};evaluate(id,result,process,scenario);return {params:result,key,value};
}
