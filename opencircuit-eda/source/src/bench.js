import './bench.css';
import { formatSI, nearestIndex, spectrum, statistics, triggerCrossing } from './bench-measure.js';
import { makeGenerator, buildGenerator } from './bench-generator.js';
import { drawPlot, plotRange } from './bench-plot.js';
import { experiments } from './bench-experiments.js';
export { experiments, buildGenerator };

const tabs = { scope:'示波器 / 曲线', spectrum:'频谱分析仪', meters:'数字表', generator:'函数发生器', experiments:'经典实验' };
function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}
function button(label, action) {
  const node = el('button','ob-button',label);
  node.type = 'button'; node.onclick = action; return node;
}
function block(host, cls) { const node = el('div',cls); host.append(node); return node; }
function opts(values) { return values.map(x=>[String(x),String(x)]); }
function heading(host, name, detail) {
  const row = block(host,'ob-head');
  row.append(el('h3','',name));
  if (detail) row.append(el('span','ob-meta',detail));
}
function detail(host, text) { host.append(el('p','ob-detail',text)); }
function select(host, label, pairs, value, onChange) {
  const field = el('label','ob-field'), box = el('select');
  field.append(el('span','',label),box); box.dataset.control = label; box.setAttribute('aria-label',label);
  for (const [v,name] of pairs) box.add(new Option(name,String(v)));
  box.value = String(value);
  if (box.selectedIndex < 0 && box.options.length) box.selectedIndex = 0;
  box.onchange = () => onChange(box.value);
  host.append(field);
  return box;
}
function input(host, label, value, onChange, {type='number', placeholder='', min, max, step='any'} = {}) {
  const field = el('label','ob-field'), box = el('input');
  box.type = type; box.value = value; box.dataset.control = label; box.setAttribute('aria-label',label); box.placeholder = placeholder;
  if (type === 'number' || type === 'range') { box.step = step; if (min != null) box.min=min; if (max != null) box.max=max; }
  field.append(el('span','',label),box);
  box.onchange = () => { if (box.reportValidity()) onChange(box.value); };
  host.append(field);
  return box;
}
function readCard(host, title, value, annotation) {
  const card = block(host,'ob-card');
  card.append(el('span','ob-meta',title),el('strong','ob-digits',value),el('span','ob-meta',annotation));
}
function analysisLabel(result) {
  return `${result.analysis.toUpperCase()} · ${result.points ?? result.x.values.length} 点`;
}
function preferredTrace(list) {
  return list.find(t=>/^(v\(out\)|out)$/i.test(t.name)) || list.find(t=>t.unit === 'V') || list[0];
}

export function mountBench(container, { onInsert, onExperiment } = {}) {
  let result = null, active = 'scope', fftCache = null, autoSecondChannel = true;
  const settings = { chA:'', chB:'', scaleA:'',scaleB:'',centerA:'',centerB:'',timeDiv:'',slope:'free',trigger:'0',
    acView:'mag',freqCh:'',win:'hann',fftSize:'8192',freqStart:'',freqStop:'',freqMarker:'',ampl:'db',
    volt:'', ref:'',current:'', mode:'mean', point:'0', wave:'sine',name:'GEN',positive:'in',negative:'0',frequency:'1000',
    amplitude:'1',offset:'0',phase:'0',duty:'50',harmonics:'1:1:0,3:0.25:0',equation:'sin(2*pi*f*t)+0.25*sin(6*pi*f*t)' };
  const shell = el('section','oc-bench'), nav = el('nav','ob-tabs'), body = el('div','ob-body');
  nav.setAttribute('aria-label','实验台工具');
  shell.append(nav,body); container.replaceChildren(shell);
  function show(tab) {
    if (!Object.hasOwn(tabs,tab)) throw new Error('未知仪表');
    active = tab; render();
  }
  for (const [key,title] of Object.entries(tabs)) {
    const item = button(title,()=>show(key)); item.dataset.tab=key; nav.append(item);
  }
  function set(key) { return value => { settings[key] = value; if (key==='chB') autoSecondChannel=false; render(); }; }
  function menu(field,label,key,pairs) { return select(field,label,pairs,settings[key],set(key)); }
  function field(row,label,key,options) { return input(row,label,settings[key],set(key),options); }
  function choices(list) { return list.map(t=>[t.name,t.name]); }
  function trace(key) { return result?.traces.find(t=>t.name===settings[key]); }
  function empty(text) { detail(body,text); }
  function scope() {
    heading(body,result?.analysis==='tran'?'双通道数字示波器':'分析曲线',result ? analysisLabel(result) : 'CH1 · CH2');
    if (!result) return empty('运行瞬态仿真后可设置时基与触发。工作点、直流扫描和交流扫描也可在此查看。');
    if (!result.traces.length) return empty('该次分析没有可显示的探针。');
    const data = result.x.values, a = trace('chA'), b = trace('chB');
    if (!a || !data.length) return;
    const controls = block(body,'ob-controls');
    menu(controls,'CH1','chA',choices(result.traces));
    menu(controls,'CH2','chB',[['','关闭'],...choices(result.traces)]);
    if (result.analysis==='ac') menu(controls,'显示量','acView',[['mag','幅值'],['db','幅值 dB（参考 1 单位）'],['phase','相位 °']]);
    const channels = [a,b].filter(Boolean).map((ch,i) => {
      const tag = i ? 'B':'A';
      let values = ch.values, unit = ch.unit;
      if (result.analysis==='ac') {
        const kind = settings.acView;
        values = ch.values.map((v,j) => {
          const im = ch.imag?.[j] ?? 0;
          if (kind==='phase') return Math.atan2(im,v)*180/Math.PI;
          const mag = Math.hypot(v,im);
          return kind==='db' ? 20*Math.log10(Math.max(mag,1e-15)) : mag;
        });
        unit = kind==='phase' ? '°' : kind==='db' ? 'dB' : unit;
      }
      field(controls,`CH${i+1} ${unit}/格`,'scale'+tag,{min:'1e-30',placeholder:'自动'});
      field(controls,`CH${i+1} 中心 ${unit}`,'center'+tag,{placeholder:'自动'});
      return {name:ch.name, unit,values,...plotRange(values,settings['scale'+tag],settings['center'+tag])};
    });
    let xMin = Math.min(data[0],data.at(-1)), xMax = Math.max(data[0],data.at(-1)), marker;
    if (result.analysis === 'tran' && xMax>xMin) {
      field(controls,'时基 s/格','timeDiv',{min:'1e-30',placeholder:'自动'});
      menu(controls,'CH1 触发','slope',[['free','自由运行'],['rise','上升沿'],['fall','下降沿']]);
      if (settings.slope!=='free') field(controls,`触发电平 ${a.unit}`,'trigger');
      const span = Number(settings.timeDiv)>0 ? 10*Number(settings.timeDiv) : (xMax-xMin)/(settings.slope==='free'?1:3);
      let begin = xMin;
      if (settings.slope!=='free') {
        marker = triggerCrossing(data,a.values,Number(settings.trigger),settings.slope);
        if (marker == null) detail(body,'当前记录中未找到指定方向的阈值交叉。');
        else begin = Math.max(xMin,marker-0.15*span);
      }
      xMax = begin + span; xMin = begin;
    }
    if (xMax===xMin) { xMin-=0.5; xMax+=0.5; }
    drawPlot(body,{x:data, channels, xMin,xMax,xUnit:result.x.unit,log:result.analysis==='ac' && xMin>0,label:'双通道采样曲线',marker});
    if (result.analysis==='tran') {
      const stats = statistics(data,a.values);
      detail(body,`CH1 全记录峰峰值 ${formatSI(stats.pp,a.unit)}　有效值 ${formatSI(stats.rms,a.unit)}　平均值 ${formatSI(stats.mean,a.unit)}`);
    }
  }
  function frequency() {
    heading(body,'数字频谱分析仪',result ? analysisLabel(result) : 'FFT');
    if (result?.analysis!=='tran') return empty('请运行瞬态分析。频谱使用瞬态波形的实际时间戳和测量值。');
    const ch = trace('freqCh');
    if (!ch) return empty('该次分析没有可显示的探针。');
    const controls = block(body,'ob-controls');
    menu(controls,'频谱通道','freqCh',choices(result.traces));
    menu(controls,'采样窗','win',[['hann','Hann'],['rect','矩形']]);
    menu(controls,'最多 FFT 点数','fftSize',opts([128,256,512,1024,2048,4096,8192,16384]));
    menu(controls,'幅度','ampl',[['db',`dB re 1 ${ch.unit} RMS`],['rms',`${ch.unit} RMS`]]);
    field(controls,'起始 Hz','freqStart',{min:0,placeholder:'0'});
    field(controls,'终止 Hz','freqStop',{min:'1e-30',placeholder:'奈奎斯特频率'});
    field(controls,'标记 Hz','freqMarker',{min:0,placeholder:'区间峰值'});
    const key = [ch.name,settings.win,settings.fftSize].join('|');
    if (fftCache?.key!==key) fftCache = {key, spec:spectrum(result.x.values,ch.values,{window:settings.win,size:Number(settings.fftSize)})};
    const {frequencies:x,rms,df,rbw,fs,size} = fftCache.spec;
    const low = Number(settings.freqStart)||0, high = Math.min(Number(settings.freqStop)||fs/2,fs/2);
    if (!(low<high)) return empty('起始频率应低于终止频率及奈奎斯特频率。');
    const first = Math.ceil(low/df), last = Math.min(rms.length-1,Math.floor(high/df));
    if (first>last) return empty('所选频率区间内没有 FFT 频点。');
    let peak = first;
    for (let i=first+1;i<=last;i++) if (rms[i]>rms[peak]) peak=i;
    const idx = settings.freqMarker==='' ? peak : Math.max(first,Math.min(last,nearestIndex(x,Number(settings.freqMarker))));
    const db = settings.ampl==='db';
    const values = db ? rms.map(v=>20*Math.log10(Math.max(v,1e-15))) : rms;
    const unit = db?'dB':ch.unit;
    const max = db ? 10*Math.ceil((values[peak]+1)/10) : Math.max(1e-15,values[peak]*1.12);
    const channel = {name:ch.name,unit,values,min: db?max-100:0,max};
    drawPlot(body,{x,channels:[channel],xMin:low,xMax:high,xUnit:'Hz',label:'单边 RMS 频谱',marker:x[idx],
      onCoordinate:value=>{settings.freqMarker=String(value);render();}});
    detail(body,`标记 ${formatSI(x[idx],'Hz')} · ${formatSI(rms[idx],ch.unit)} RMS · ${(20*Math.log10(Math.max(rms[idx],1e-15))).toFixed(2)} dB re 1 ${ch.unit} RMS`);
    detail(body,`${size} 点 · 采样率 ${formatSI(fs,'Hz')} · 频点间隔 ${formatSI(df,'Hz')} · 等效噪声带宽 ${formatSI(rbw,'Hz')}。点击曲线可移动标记。`);
  }
  function meters() {
    heading(body,'数字电压表与电流表',result ? analysisLabel(result) : 'DVM · DMM');
    if (!result) return empty('运行仿真后，选择两端节点测电压，选择已保存的支路测电流。');
    const controls=block(body,'ob-controls');
    const vs = result.traces.filter(t=>t.unit==='V'), cs = result.traces.filter(t=>t.unit==='A');
    menu(controls,'电压表正端','volt',choices(vs));
    menu(controls,'电压表负端','ref',[['','GND (0)'],...choices(vs)]);
    menu(controls,'电流支路','current',choices(cs));
    if (result.analysis==='tran') menu(controls,'读数','mode',[['mean','直流平均值'],['rms','总有效值 AC+DC'],['acRms','交流分量有效值'],['point','采样点']]);
    const sampled = result.analysis !== 'tran' || settings.mode==='point';
    const count = result.x.values.length;
    const index = Math.max(0,Math.min(count-1,Number(settings.point)));
    if (sampled && count>1) {
      field(controls,'采样点序号','point',{min:0,max:count-1,step:1});
      detail(body,`${result.x.name} = ${formatSI(result.x.values[index],result.x.unit)}`);
    }
    const resultRow=block(body,'ob-cards'), pos=trace('volt'), neg=trace('ref'), current=trace('current');
    function measurement(ch, ref) {
      if (!ch) return '无探针';
      if (sampled) {
        const real = ch.values[index] - (ref?.values[index] ?? 0);
        if (result.analysis !== 'ac') return formatSI(real,ch.unit,6);
        const im = (ch.imag?.[index] ?? 0) - (ref?.imag?.[index] ?? 0);
        return `${formatSI(Math.hypot(real,im),ch.unit,5)} ∠ ${(Math.atan2(im,real)*180/Math.PI).toFixed(1)}°`;
      }
      const values = ref ? ch.values.map((v,i)=>v-ref.values[i]) : ch.values;
      return formatSI(statistics(result.x.values,values)[settings.mode],ch.unit,6);
    }
    readCard(resultRow,'电压 / V',measurement(pos,neg),`${pos?.name ?? '—'} − ${neg?.name ?? 'GND'}`);
    readCard(resultRow,'电流 / A',measurement(current),current?.name ?? '在待测支路串联一个 0 V 电压源');
    detail(body,'电压源支路电流以流入正端为正。瞬态平均值和有效值按照采样时间间隔加权。');
  }
  function generator() {
    heading(body,'函数发生器','电压输出');
    const controls=block(body,'ob-controls');
    function edit(label,key,options) {
      const box=input(controls,label,settings[key],()=>{},options);
      box.onchange=null;
      box.oninput=()=>{ settings[key]=box.value; updatePreview(); };
    }
    menu(controls,'波形','wave',Object.entries({sine:'正弦波',square:'方波',triangle:'三角波',harmonics:'多谐波',equation:'方程'}));
    edit('源标识','name',{type:'text'});
    edit('正端节点','positive',{type:'text'}); edit('负端节点','negative',{type:'text'});
    edit('频率 Hz','frequency',{min:'1e-12',max:'1e15'});
    edit('峰值系数 V','amplitude',{min:0}); edit('偏置 V','offset');
    if (settings.wave==='sine') edit('相位 °','phase');
    if (settings.wave==='square') edit('占空比 %','duty',{min:'0.01',max:'99.99'});
    if (settings.wave==='harmonics') {
      edit('谐波项','harmonics',{type:'text'});
      detail(body,'每项填写 次数:相对幅值:相位度，用逗号分隔。');
    }
    if (settings.wave==='equation') {
      edit('方程 g(t)','equation',{type:'text'});
      detail(body,'输出 = 偏置 + 峰值系数 × g(t)。可用 t（秒）、f（Hz）、pi、四则运算、整数幂 ^ 和 sin、cos、tan、abs、sqrt、exp。');
    }
    const preview=block(body,'ob-generator-preview');
    function updatePreview() {
      preview.replaceChildren();
      try {
        const generated=makeGenerator(settings);
        const x=Array.from({length:257},(_,i)=>i*generated.period/128), y=x.map(generated.at);
        if (y.some(v=>!Number.isFinite(v))) throw new Error('当前方程在预览时段产生无穷大或未定义值，请调整表达式。');
        drawPlot(preview,{x,channels:[{name:'源输出预览',unit:'V',values:y,...plotRange(y)}],xMin:0,xMax:x.at(-1),xUnit:'s',label:'发生器理想电压的两个周期预览'});
        const row=block(preview,'ob-source');
        row.append(el('code','',generated.line));
        if (onInsert) row.append(button('插入当前网表',async e=>{
          const target=e.currentTarget;
          target.disabled=true;
          try { await onInsert(generated.line); }
          catch(err) { detail(preview,err.message); }
          finally { target.disabled=false; }
        }));
      } catch(err) {
        const msg=el('p','ob-error',err.message);
        msg.setAttribute('role','alert');
        preview.append(msg);
      }
    }
    updatePreview();
  }
  function library() {
    heading(body,'经典电路实验',`${experiments.length} 项`);
    const grid=block(body,'ob-labs');
    for (const lab of experiments) {
      const card=block(grid,'ob-lab');
      card.append(el('span','ob-meta',lab.config.type.toUpperCase()),el('h4','',lab.name),el('p','',lab.description),el('p','ob-expected',lab.expected));
      if (onExperiment) card.append(button('载入并运行',async e=>{
        const target=e.currentTarget; target.disabled=true;
        try { await onExperiment(lab.id); } catch(err) { detail(card,err.message); }
        finally { target.disabled=false; }
      }));
    }
  }
  function render() {
    const previous = body.contains(document.activeElement) ? document.activeElement.dataset.control : null;
    body.replaceChildren();
    for (const item of nav.children) item.setAttribute('aria-pressed',String(item.dataset.tab===active));
    try { ({scope,spectrum:frequency,meters,generator,experiments:library})[active](); }
    catch (err) { const msg=el('p','ob-error',err.message); msg.setAttribute('role','alert'); body.append(msg); }
    if (previous) Array.from(body.querySelectorAll('[data-control]')).find(x=>x.dataset.control===previous)?.focus({preventScroll:true});
  }
  function setResult(next) {
    result=next; fftCache=null;
    if (next) {
      const list=next.traces;
      for (const key of ['chA','freqCh']) if (!trace(key)) settings[key]=preferredTrace(list)?.name ?? '';
      if (!trace('chB')) settings.chB='';
      if (autoSecondChannel) settings.chB=list.find(t=>/^v\(in\)$/i.test(t.name) && t.name!==settings.chA)?.name ?? '';
      const volts=list.filter(t=>t.unit==='V');
      if (!trace('volt')) settings.volt=preferredTrace(volts)?.name ?? '';
      if (!trace('ref')) settings.ref='';
      const amps=list.filter(t=>t.unit==='A');
      if (!trace('current')) settings.current=(amps.find(t=>/sense/i.test(t.name))||amps[0])?.name ?? '';
      settings.point='0';
    }
    render();
  }
  render();
  // Result curves may be prepared while the instruments pane is hidden.
  // Redraw when it opens or a splitter changes the actual available chart width.
  let measuredWidth = Math.round(container.getBoundingClientRect().width);
  const observer = new ResizeObserver(entries=>{
    const width = Math.round(entries[0].contentRect.width);
    if (width === measuredWidth) return;
    measuredWidth = width;
    if (width>0) render();
  });
  observer.observe(container);
  return {show,setResult,clear:()=>setResult(null),destroy:()=>observer.disconnect()};
}
