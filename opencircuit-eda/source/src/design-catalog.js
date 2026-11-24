const rows=[
  ['resistor','电阻','R','1 2','1k'],
  ['capacitor','电容','C','1 2','100n'],
  ['inductor','电感','L','1 2','1m'],
  ['vdc','直流电压源','V','+ -','DC 5'],
  ['idc','直流电流源','I','+ -','DC 1m'],
  ['sine','正弦电压源','V','+ -','SIN(0 1 1k)'],
  ['pulse','脉冲电压源','V','+ -','PULSE(0 5 0 1u 1u 0.5m 1m)'],
  ['triangle','三角波电压源','V','+ -','PULSE(-1 1 0 0.5m 0.5m 0 1m)'],
  ['pwl','分段线性源','V','+ -','PWL(0 0 1m 1 2m 0)'],
  ['vac','小信号交流源','V','+ -','DC 0 AC 1'],
  ['ammeter','电流探针 · 0 V','V','+ -','0'],
  ['vcvs','电压控制电压源','E','+ - C+ C-','10'],
  ['vccs','电压控制电流源','G','+ - C+ C-','1m'],
  ['cccs','电流控制电流源','F','+ -','Vsense 2'],
  ['ccvs','电流控制电压源','H','+ -','Vsense 1k'],
  ['bvoltage','行为电压源','B','+ -','V=sin(2*pi*1k*time)'],
  ['bcurrent','行为电流源','B','+ -','I=1m*sin(2*pi*1k*time)'],
  ['diode','二极管','D','A K','D_OC','.model D_OC D(Is=2n N=1.7)'],
  ['zener','稳压二极管','D','A K','DZ_OC','.model DZ_OC D(Is=1n BV=5.1 IBV=1m)'],
  ['npn','NPN 三极管','Q','C B E','NPN_OC','.model NPN_OC NPN(Is=1e-15 BF=120)'],
  ['pnp','PNP 三极管','Q','C B E','PNP_OC','.model PNP_OC PNP(Is=1e-15 BF=100)'],
  ['nmos','NMOS','M','D G S B','NM_OC W=10u L=1u','.model NM_OC NMOS(Level=1 VTO=0.5 KP=100u)'],
  ['pmos','PMOS','M','D G S B','PM_OC W=20u L=1u','.model PM_OC PMOS(Level=1 VTO=-0.5 KP=50u)'],
  ['jfet','N 沟道 JFET','J','D G S','NJ_OC','.model NJ_OC NJF(VTO=-2 BETA=1m)'],
  ['switch','电压控制开关','S','1 2 C+ C-','SW_OC','.model SW_OC SW(Ron=1 Roff=1G Vt=2 Vh=0.1)'],
  ['tline','无损传输线','T','1+ 1- 2+ 2-','Z0=50 TD=10n'],
  ['opamp','运放 · 有限开环增益','X','IN+ IN- OUT','OP_OC','.subckt OP_OC plus minus out\nEOL out 0 plus minus 100k\n.ends OP_OC']
];
export const componentCatalog = rows.map(([id,label,prefix,pins,value,definition=''])=>({
  id,label,name:label,prefix,pins:pins.split(' '),value,definition
}));
export function validateComponent(input) {
  const d=typeof input==='string'?JSON.parse(input):input;
  if(!d || typeof d!=='object')throw new Error('元件定义需要 JSON 对象');
  if(!/^[a-z][a-z0-9_-]{0,63}$/i.test(d.id || ''))throw new Error('id 需要以字母开头');
  const label=d.label || d.name;
  if(typeof label!=='string' || !label.trim() || label.length>100)throw new Error('请填写元件显示名称 label');
  if(!/^[RCLVIDQMJZSEGFHWTOBX]$/i.test(d.prefix || ''))throw new Error('prefix 需要一个支持的 SPICE 位号前缀');
  if(!Array.isArray(d.pins)||!d.pins.length||d.pins.length>128||d.pins.some(p=>typeof p!=='string'||!/^\S{1,40}$/.test(p))||new Set(d.pins).size!==d.pins.length)throw new Error('pins 需要按网表顺序列出唯一的引脚名称');
  if(typeof d.value!=='string'||/[\n\r]/.test(d.value))throw new Error('value 需要单行 SPICE 值或模型调用');
  if(d.definition && typeof d.definition!=='string')throw new Error('definition 需要 SPICE 模型或子电路文本');
  return {id:d.id,label:label.trim(),name:label.trim(),prefix:d.prefix.toUpperCase(),pins:d.pins.slice(),value:d.value,definition:d.definition || ''};
}
export function instantiateComponent(input,{name,nodes,value,existingSource=''}={}) {
  const d=validateComponent(input);
  if(typeof name!=='string' || !/^[a-z][\w.$:-]*$/i.test(name) || name[0].toUpperCase()!==d.prefix)throw new Error('位号需要以 '+d.prefix+' 开头');
  if(!Array.isArray(nodes)||nodes.length!==d.pins.length||nodes.some(v=>!v||!/^[-\w.:+!#[\]$]+$/.test(v)))throw new Error('按 '+d.pins.join(', ')+' 提供 '+d.pins.length+' 个节点名');
  const tail=value ?? d.value;
  if(typeof tail!=='string'||/[\r\n]/.test(tail))throw new Error('位号值只能占一行');
  const card=[name,...nodes,tail].filter(Boolean).join(' ');
  return d.definition && !existingSource.includes(d.definition)?card+'\n'+d.definition:card;
}
