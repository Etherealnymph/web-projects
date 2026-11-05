const par=(key,label,unit,min,max,step)=>({key,label,unit,min,max,step});
const temp=par('temp','环境温度','°C',-100,200,1),vdd=par('vdd','供电电压','V',.1,10,.05),r=par('r','基准电阻 R','kΩ',.01,1000,.1),rtc=par('rtc','电阻温度系数','ppm/°C',-2000,2000,10);
const vbe=[par('vbe','基准 VBE','V',.2,1.2,.005),par('slope','VBE 一阶斜率','mV/°C',-4,-.1,.05),par('curvature','VBE 曲率系数','µV/°C²',-10,10,.1)];
const area=par('area','电流密度比 n','×',1.1,64,.1);
export const SOURCES={
  ring:{title:'北海道大学 · Ring / current-starved VCO, §2.3',url:'https://eprints.lib.hokudai.ac.jp/repo/huscap/all/89865/Pitchayapatchaya_SRIKRAM.pdf'},
  lc:{title:'P. E. Allen · Georgia Tech, Lecture 130: VCOs',url:'https://pallen.ece.gatech.edu/Academic/ECE_6440/Summer_2003/L130-VCO-I%282UP%29.pdf'},
  relaxation:{title:'TI · Relaxation oscillator, SNOA998A',url:'https://www.ti.com/document-viewer/lit/html/SNOA998'},
  reference:{title:'Analog Devices · Chapter 14: Voltage References',url:'https://wiki.analog.com/university/courses/electronics/text/chapter-14'},
  beta:{title:'University of Rostock · Beta multiplier / startup',url:'https://www.cld.uni-rostock.de/storages/uni-rostock/Alle_IEF/IGS/Schaltungen/Uebung_Grundlagen_Elektronik_2/Konstantstrom_Loesung.pdf'},
  pll:{title:'TI · Dean Banerjee, PLL Performance, Simulation, and Design',url:'https://www.ti.com/lit/ml/snaa106c/snaa106c.pdf'}
};
export const CATALOG=[
 {id:'ring',family:'osc',name:'CMOS 环形振荡器',en:'Ring oscillator',code:'OSC · 01',tag:'结构紧凑',desc:'用奇数级反相延时建立周期。从负载、供电与驱动能力开始探索。',formula:'f ≈ 1 / (2N·0.69ReqCL)',explain:'RC 翻转近似取 tpd≈0.69ReqCL；Req≈1/[μnCox(W/L)(VDD−VTH)]。动态能耗按每级每周期一次充电估计 P≈NCLVDD²f。该等效电阻仅是教学近似。',params:[par('stages','反相器级数 N','',3,15,2),par('wl','NMOS W/L','',.5,100,.5),par('cap','每级负载 CL','fF',1,10000,5),vdd,temp],sweep:{key:'cap',min:20,max:300,label:'每级电容',unit:'fF'},source:'ring',guide:'级数须为奇数。加大 W/L 可以提高电流，但真实栅电容也会增加；这里把负载作为独立输入，不能把扫描结果直接当作尺寸优化。'},
 {id:'starved',family:'osc',name:'电流饥饿环振',en:'Current-starved ring',code:'OSC · 02',tag:'电流可调',desc:'以可控充放电电流调频，直观看到偏置、负载与速度的联系。',formula:'f ≈ I / (2NCLΔV)',explain:'由电荷守恒 I·tpd=CLΔV，再使用 T≈2Ntpd。ΔV 表示从前级翻转到后级触发的有效电压行程，默认取 0.5VDD。实际延时还包含限流管的电压余量。',params:[par('stages','反相器级数 N','',3,15,2),par('current','每级限流 I','µA',.1,2000,1),par('cap','每级负载 CL','fF',1,10000,5),par('swing','有效行程 / VDD','',.1,.9,.05),vdd],sweep:{key:'current',min:5,max:200,label:'限流电流',unit:'µA'},source:'ring',guide:'理想限流不代表实际电流镜。进入低电压或低电流区后，需检查器件饱和、上升下降时间、偏置启动和调谐曲线。'},
 {id:'lc',family:'osc',name:'交叉耦合 LC 振荡器',en:'Cross-coupled LC',code:'OSC · 03',tag:'谐振选频',desc:'在差分谐振端口平衡储能、损耗与负阻，检查小信号起振条件。',formula:'f₀ = 1/(2π√LC) · gmRp/2 > 1',explain:'L、C 与 Rp 均为差分端口等效量。Rp≈Qω₀L；一对匹配 NMOS 提供 −2/gm 的差分电阻。每管 gm 应满足 gmRp/2>1，后续仍需非线性瞬态和噪声分析。',params:[par('inductance','差分等效 L','nH',.1,100,.1),par('cap','差分总 C','pF',.01,100,.05),par('q','电感品质因数 Q','',1,100,1),par('gm','每只 NMOS 的 gm','mS',.01,100,.1),par('vov','过驱动 Vov','V',.05,1,.01),vdd],sweep:{key:'cap',min:.2,max:4,label:'差分总电容',unit:'pF'},source:'lc',guide:'gm 是漏电流对栅源电压的局部斜率 ∂ID/∂VGS，单位 S。负阻只是补偿损耗的局部条件；振幅受限后 gm 会改变。Q、寄生电容与电感必须来自可信器件或 EM 模型。'},
 {id:'relaxation',family:'osc',name:'恒流张弛振荡器',en:'Relaxation oscillator',code:'OSC · 04',tag:'阈值计时',desc:'让电容在上下阈值之间线性往返，观察比较器延时带来的偏移。',formula:'T ≈ 2C(VH−VL)/I + 2td',explain:'每半周期由 ΔQ=C(VH−VL) 得到充放电时间 ΔQ/I，再计一次比较器延时。TI 文档讲解阈值与电容计时；本页采用自行推导的恒流变体，而非其电阻充电公式。',params:[par('current','定时电流 I','µA',.01,1000,.1),par('cap','定时电容 C','pF',.1,10000,1),par('low','下阈值 VL','V',.01,5,.05),par('high','上阈值 VH','V',.02,5,.05),par('delay','单次比较器延时','ns',0,1000,1),par('iq','比较器静态电流','µA',0,1000,1),vdd],sweep:{key:'current',min:1,max:100,label:'定时电流',unit:'µA'},source:'relaxation',guide:'增大电流可以提高速度，但频率最终受比较器延时限制。输出开关模型忽略延时，只用于验证恒流与阈值的基础关系；不预测真实比较器性能。'},
 {id:'bandgap',family:'ref',name:'一阶带隙参考',en:'First-order bandgap',code:'REF · 01',tag:'温度补偿',desc:'叠加 CTAT 的 VBE 与 PTAT 的 ΔVBE，寻找一阶温度补偿点。',formula:'VREF = VBE + a·(kT/q)ln(n)',explain:'VBE 由用户给定的基准值、一阶斜率和二阶曲率构成。令 a=−(dVBE/dT)/[(k/q)ln(n)] 可在基准温度抵消一阶项。R 只决定示意 PTAT 支路电流；系数 a 视为温度不变。',params:[area,par('ratio','PTAT 加权系数 a','',1,30,.01),...vbe,r,rtc,temp],sweep:{key:'temp',min:-40,max:125,label:'环境温度',unit:'°C'},source:'reference',guide:'一阶温漂变小不等于精密参考已完成。器件失配、放大器失调、曲率、启动、供电抑制和封装应力需要单独研究。扫温结果仅反映输入的多项式。'},
 {id:'ptat',family:'ref',name:'PTAT 电流参考',en:'PTAT current reference',code:'REF · 02',tag:'温度正相关',desc:'从热电压和电流密度比出发，构建与绝对温度相关的偏置。',formula:'IPTAT = (kT/q)ln(n) / R(T)',explain:'两只匹配 BJT 的集电极电流相等，发射结面积比 n 给出 ΔVBE=(kT/q)ln(n)。若 R 无温度系数，电流正比于绝对温度；本页允许显式输入电阻温度系数。',params:[area,r,rtc,temp],sweep:{key:'temp',min:-40,max:125,label:'环境温度',unit:'°C'},source:'reference',guide:'PTAT 中的 T 是开尔文，不是摄氏度。只有电流密度的比值决定 ΔVBE；若偏置电流不等，应把其影响并入密度比。'},
 {id:'ctat',family:'ref',name:'CTAT 电流参考',en:'CTAT current reference',code:'REF · 03',tag:'温度负相关',desc:'用结电压的温度变化建立对照，理解补偿前的温度敏感性。',formula:'ICTAT ≈ VBE(T) / R(T)',explain:'VBE(T)=VBE,0+s(T−T₀)+c(T−T₀)²；R(T)=R₀[1+TC·(T−T₀)]。这是局部特性函数的组合，不能外推至任意温度或任意偏置。',params:[...vbe,r,rtc,temp],sweep:{key:'temp',min:-40,max:125,label:'环境温度',unit:'°C'},source:'reference',guide:'CTAT 表示量值通常随绝对温度升高而降低。电阻温度系数、BJT 电流变化与反馈都会改变真实斜率。'},
 {id:'beta',family:'ref',name:'β 倍增电流参考',en:'Beta-multiplier reference',code:'REF · 04',tag:'恒 gm 偏置',desc:'使用 MOS 尺寸比和源极电阻设定非零平衡电流，显式保留启动问题。',formula:'I = 2(1−1/√K)² / (β₁R²)',explain:'等电流、匹配阈值时，IR=VGS1−VGS2=√(2I/β₁)(1−1/√K)，β₁=μnCox(W/L)₁。式子仅描述非零解；I=0 也是自偏置电路的解。',params:[par('ratio','尺寸倍率 K','',1.1,32,.1),par('wl','M1 W/L','',.5,100,.5),r,rtc,temp,vdd],sweep:{key:'r',min:2,max:50,label:'基准电阻',unit:'kΩ'},source:'beta',guide:'K=4 时 gm1·R=1。这里采用强反型平方律；体效应、有限输出电阻和实际启动支路会改变结果。不能仅凭 DC 求得非零工作点就宣称上电可靠。'},
 {id:'pll',family:'pll',name:'Type-II 电荷泵 PLL',en:'Charge-pump phase-locked loop',code:'PLL · 01',tag:'三阶闭环',desc:'从参考频率与环路目标合成无源滤波器，并计算频域与小信号瞬态。',formula:'L(s) = IcpKvco·Z(s) / (N·s)',explain:'此式 Kvco 使用 Hz/V，Icp 为 A，Kpd=Icp/(2π)，VCO 为 2πKvco/s。滤波器为 C₁ ∥ (R+C₂)，Z(s)=(1+sRC₂)/[s(C₁+C₂)(1+sRC₁C₂/(C₁+C₂))]。在单位增益频率处安排最大相位超前。',params:[par('reference','参考频率 fref','MHz',.001,1000,1),par('divider','整数分频比 N','',1,10000,1),par('bandwidth','单位增益交越频率','kHz',.01,100000,10),par('pm','目标相位裕度','°',20,85,1),par('current','电荷泵电流 Icp','µA',.1,10000,10),par('kvco','VCO 增益 Kvco','MHz/V',.01,10000,10)],sweep:{key:'bandwidth',min:20,max:1000,label:'单位增益频率',unit:'kHz'},source:'pll',guide:'这里的“带宽”指开环单位增益交越频率，不等于闭环 −3 dB 带宽。积分器来自环路滤波器和 VCO，所以称 Type II；C₁ 加入第三个极点。图中的阶跃为已锁定附近的相位小扰动。'}
];
export const BY_ID=Object.fromEntries(CATALOG.map(c=>[c.id,c]));
const box=(x,y,w,h,t)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7"/><text x="${x+w/2}" y="${y+h/2+4}" text-anchor="middle">${t}</text>`;
const wire=(d)=>`<path d="${d}"/>`;
export function diagram(id){
 let v='';
 if(id==='ring'||id==='starved'){
  for(let i=0;i<3;i++){let x=60+i*110;v+=`<path d="M${x} 57 L${x+49} 85 L${x} 113 Z"/><circle cx="${x+55}" cy="85" r="5"/>`;if(i<2)v+=wire(`M${x+60} 85 H${x+110}`);}
  v+=wire('M340 85 H370 V145 H35 V85 H60')+'<circle cx="355" cy="85" r="3"/><path d="M355 85 V40 H405"/><text x="365" y="30">OUT</text><text x="200" y="177" text-anchor="middle">N = 3, 5, 7 …</text>';
  if(id==='starved')v+='<path class="accent" d="M60 28 H315 M85 28 V57 M195 28 V57 M305 28 V57"/><text x="205" y="17" text-anchor="middle">I BIAS · 可控充放电</text>';
 }else if(id==='lc'){
  v+=wire('M95 43 H325 M95 43 V65 M325 43 V65 M95 105 V130 M325 105 V130 M95 130 H150 M270 130 H325 M150 130 V165 H270 V130');
  v+='<path d="M95 65 q-16 5 0 10 q-16 5 0 10 q-16 5 0 10 q-16 5 0 10 M325 65 q16 5 0 10 q16 5 0 10 q16 5 0 10 q16 5 0 10"/>';
  v+=box(165,115,90,30,'−2/gm')+'<path d="M210 43 V67 M188 67 H232 M188 77 H232 M210 77 V115"/><text x="242" y="76">Cdiff</text><text x="55" y="91">L/2</text><text x="345" y="91">L/2</text><text x="210" y="32" text-anchor="middle">差分谐振端口</text><text x="210" y="187" text-anchor="middle">gm · Rp / 2 > 1</text>';
 }else if(id==='relaxation'){
  v+=box(36,65,82,42,'± I')+wire('M118 86 H180 M180 50 V86 H240 M180 86 V115 M163 115 H197 M163 125 H197 M180 125 V151 H200');
  v+=box(240,65,100,42,'VH / VL')+wire('M340 86 H390 M365 86 V158 H80 V107')+'<text x="156" y="40">VC</text><text x="350" y="68">OUT</text><text x="200" y="181" text-anchor="middle">电流积分 → 阈值翻转 → 反向</text>';
 }else if(id==='pll'){
  v+=box(32,62,73,42,'PFD / CP')+box(137,62,72,42,'Z(s)')+box(244,62,73,42,'VCO')+box(170,138,68,32,'÷ N');
  v+=wire('M7 82 H32 M105 82 H137 M209 82 H244 M317 82 H402 M359 82 V154 H238 M170 154 H55 V104')+'<text x="13" y="49">REF</text><text x="350" y="65">OUT</text><text x="212" y="39" text-anchor="middle">连续时间小信号模型</text>';
 }else{
  const label=id==='beta'?'VGS₁ − VGS₂':id==='ctat'?'VBE(T)':'ΔVBE = VT ln(n)';
  v+=box(35,65,140,45,label)+wire('M175 87 H225')+box(225,65,78,45,id==='bandgap'?'× a':'÷ R(T)')+wire('M303 87 H380');
  if(id==='bandgap')v+=box(128,140,85,30,'VBE(T)')+wire('M213 155 H337 V87')+'<circle cx="337" cy="87" r="12"/><text x="337" y="91" text-anchor="middle">+</text>';
  else v+='<text x="210" y="160" text-anchor="middle">'+(id==='beta'?'非零解须由启动电路建立':'基准温度 T₀ + 显式温度模型')+'</text>';
  v+='<text x="349" y="66">'+(id==='bandgap'?'VREF':'IREF')+'</text>';
 }
 return `<svg viewBox="0 0 420 200" role="img" aria-label="${BY_ID[id].name} 功能示意图"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${v}</g></svg>`;
}
