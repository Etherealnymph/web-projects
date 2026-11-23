import {addComponent,makeLayer} from './design.js';

const spaces = s=>s.replace(/[^\n]/g,' ');
function lineLocator(text) {
  const stops=[0];
  for(let i=0;i<text.length;i++)if(text[i]==='\n')stops.push(i+1);
  return pos=>{let lo=0,hi=stops.length;while(lo+1<hi){const m=(lo+hi)>>1;if(stops[m]<=pos)lo=m;else hi=m}return lo+1};
}
function argumentsOf(text) {
  let level=0,start=0;
  const args=[];
  for(let i=0;i<text.length;i++) {
    const ch=text[i];
    if('([{'.includes(ch))level++;
    if(')]}'.includes(ch))level--;
    if(ch===',' && level===0){args.push(text.slice(start,i).trim());start=i+1}
  }
  return args.concat(text.slice(start).trim());
}
function simpleNet(value,vhdl) {
  if(vhdl)return /^[a-z]\w*(?:\(\s*\d+\s*\))?$|^'[01UXZWLH-]'$|^"[01UXZWLH-]+"$/i.test(value);
  return /^[a-zA-Z_$][\w$]*(?:\[\s*\d+(?::\d+)?\s*\])?$|^(?:\d+)?'[bBoOdDhH][0-9a-fA-FxXzZ_]+$|^\d+$/.test(value);
}
function instance(l,type,model,name,args,file,line,vhdl,diagnose) {
  const names=[],nets=[],open=[];
  let named=false;
  for(const [i,raw] of argumentsOf(args).entries()) {
    const m=vhdl?raw.match(/^(\w+)\s*=>\s*([\s\S]*)$/):raw.match(/^\.([\w$]+)\s*\(([\s\S]*)\)$/);
    let net=(m?m[2]:raw).trim();
    if(m)named=true;
    names.push(m?m[1]:type==='gate'?(i===0?'Y':'I'+i):'P'+(i+1));
    if(net==='' || (vhdl && /^open$/i.test(net))) {open.push(i);net=''}
    else if(!simpleNet(net,vhdl)){diagnose(file,line,'引脚连接表达式未展开 '+net); open.push(i)}
    nets.push(net);
  }
  const c=addComponent(l,name,type==='gate'?model:'instance',nets,names,'',model,file,line);
  if(type!=='gate')c.resolveKind=vhdl?'entity':'module';
  c.namedPins=named;
  open.forEach(i=>c.pins[i].open=true);
}
function assign(l,lhs,rhs,file,line,vhdl,diagnose) {
  const term=vhdl?"(?:[a-z]\\w*(?:\\(\\d+\\))?|'[01]')":"(?:[a-zA-Z_$][\\w$]*(?:\\[\\d+(?::\\d+)?\\])?|(?:\\d+)?'[bBoOdDhH][0-9a-fA-FxXzZ_]+|\\d+)";
  const bin=vhdl?'and|or|xor|nand|nor|xnor':'&|\\||\\^|~\\^|\\^~';
  const flags=vhdl?'i':'';
  let nets,op;
  if(simpleNet(rhs,vhdl)){nets=[rhs];op='buf'}
  let m;
  if(!op && (m=rhs.match(new RegExp('^(?:'+(vhdl?'not\\s+':'[~!]')+')\\s*('+term+')$',flags)))){nets=[m[1]];op='not'}
  if(!op && (m=rhs.match(new RegExp('^('+term+')\\s*('+bin+')\\s*('+term+')$',flags)))) {
    nets=[m[1],m[3]];op=({'&':'and','|':'or','^':'xor','~^':'xnor','^~':'xnor'})[m[2]] || m[2].toLowerCase();
  }
  if(!op && (m=rhs.match(new RegExp(vhdl?"^("+term+")\\s+when\\s+("+term+")\\s*=\\s*'1'\\s+else\\s+("+term+")$":'^('+term+')\\s*\\?\\s*('+term+')\\s*:\\s*('+term+')$',flags)))) {
    nets=vhdl?[m[2],m[1],m[3]]:[m[1],m[2],m[3]];op='mux';
  }
  if(!op) {diagnose(file,line,'赋值保留为表达式块，内部依赖未展开 '+lhs);
    addComponent(l,'assign '+lhs,'expression',[lhs],['Y'],rhs,'',file,line);return}
  addComponent(l,'assign '+lhs,op,[...nets,lhs],op==='mux'?['SEL','D1','D0','Y']:[...nets.map((_,i)=>'I'+(i+1)),'Y'],rhs,'',file,line);
}
function verilog(text,file,at,diagnose) {
  const layers=[];
  for(const m of text.matchAll(/\bmodule\s+([\w$]+)\s*(?:#\s*\((?:[^()]|\([^()]*\))*\)\s*)?(?:\(([\s\S]*?)\))?\s*;([\s\S]*?)\bendmodule\b/g)) {
    const body=m[3],base=m.index+m[0].indexOf(';')+1;
    const ports=argumentsOf(m[2]||'').map(p=>p.match(/([\w$]+)\s*$/)?.[1]).filter(Boolean);
    const l=makeLayer(m[1],file,at(m.index),ports,'verilog','module');layers.push(l);
    let stripped=body.replace(/\bgenerate\b[\s\S]*?\bendgenerate\b/g,(raw,pos)=>{diagnose(file,at(base+pos),'generate 的参数展开需 HDL 综合器');return spaces(raw)});
    // Keep procedural bodies as source-linked behavioral blocks, without inferring gates.
    const procedural=/\b(always(?:_ff|_comb|_latch)?|initial)\b/g;
    let search;
    while((search=procedural.exec(stripped))) {
      const begin=search.index;
      const tail=stripped.slice(begin), beginMatch=/\bbegin\b/.exec(tail), semicolon=tail.indexOf(';');
      let end=semicolon<0?stripped.length:begin+semicolon+1;
      if(beginMatch && (semicolon<0 || beginMatch.index<semicolon)) {
        const boundaries=/\b(begin|end)\b/g;
        boundaries.lastIndex=beginMatch.index;
        let token,depth=0;
        while((token=boundaries.exec(tail))) {
          depth+=token[1]==='begin'?1:-1;
          if(!depth){end=begin+boundaries.lastIndex;break}
        }
      }
      addComponent(l,search[1]+' L'+at(base+begin),'process',[],[],stripped.slice(begin,end).trim(),'',
        file,at(base+begin));diagnose(file,at(base+begin),'过程块以源码块显示，时序逻辑未经综合');
      stripped=stripped.slice(0,begin)+spaces(stripped.slice(begin,end))+stripped.slice(end);
      procedural.lastIndex=end;
    }
    for(const s of stripped.matchAll(/([^;]+)(?:;|$)/g)) {
      const raw=s[1].trim();if(!raw)continue;
      const line=at(base+s.index+s[1].indexOf(raw));
      if(/^(?:input|output|inout|wire|reg|logic|localparam|parameter|integer|genvar)\b/.test(raw)) {
        if(raw.includes('=') && !/^(?:localparam|parameter)\b/.test(raw))diagnose(file,line,'声明中的初始赋值未展开');
        continue;
      }
      const a=raw.match(/^assign\s+([\w$]+(?:\[\d+(?::\d+)?\])?)\s*=\s*([\s\S]+)$/);
      if(a){assign(l,a[1],a[2].trim(),file,line,false,diagnose);continue}
      const inst=raw.match(/^([\w$]+)\s*(?:#\s*\((?:[^()]|\([^()]*\))*\)\s*)?\s*([\w$]+)?\s*\(([\s\S]*)\)$/);
      if(inst) {
        const gate=/^(and|nand|or|nor|xor|xnor|not|buf)$/.test(inst[1]);
        if(gate || inst[2]) {instance(l,gate?'gate':'module',inst[1],inst[2] || inst[1]+'@'+line,inst[3],file,line,false,diagnose);continue}
      }
      diagnose(file,line,'未映射至结构图的语句 '+raw.slice(0,64));
    }
  }
  return layers;
}
function vhdl(text,file,at,diagnose) {
  const layers=[],entities=new Map();
  for(const m of text.matchAll(/\bentity\s+(\w+)\s+is\b([\s\S]*?)\bend\s*(?:entity\s*)?(?:\1\s*)?;/gi)) {
    const ports=[];
    const sec=m[2].match(/\bport\s*\(([\s\S]*)\)\s*;/i);
    for(const decl of (sec?.[1] || '').split(';')){
      const pm=decl.trim().match(/^([\w\s,]+)\s*:\s*(?:inout|out|in|buffer)\b/i);
      if(pm)ports.push(...pm[1].split(',').map(p=>p.trim()));
    }
    const l=makeLayer(m[1],file,at(m.index),ports,'vhdl','entity');layers.push(l);entities.set(m[1].toLowerCase(),l);
  }
  for(const m of text.matchAll(/\barchitecture\s+(\w+)\s+of\s+(\w+)\s+is\b([\s\S]*?)\bbegin\b([\s\S]*?)\bend\s*(?:architecture\s*(?:\1\s*)?|\1\s*|(?=;));/gi)) {
    let l=entities.get(m[2].toLowerCase());
    if(!l) {l=makeLayer(m[2],file,at(m.index),[],'vhdl','entity');layers.push(l);diagnose(file,at(m.index),'同文件未找到实体端口声明 '+m[2])}
    if(l.architecture){diagnose(file,at(m.index),'多个 architecture，当前显示 '+l.architecture);continue}
    l.architecture=m[1];
    const base=m.index+m[0].lastIndexOf(m[4]);
    const body=m[4].replace(/(?:\b\w+\s*:\s*)?\bprocess\b[\s\S]*?\bend\s+process(?:\s+\w+)?\s*;/gi,(raw,pos)=>{
      addComponent(l,'process L'+at(base+pos),'process',[],[],raw.trim(),'',file,at(base+pos));
      diagnose(file,at(base+pos),'process 以源码块显示，时序逻辑未经综合');return spaces(raw);
    });
    for(const s of body.matchAll(/([^;]+)(?:;|$)/g)) {
      const raw=s[1].trim();if(!raw)continue;
      const line=at(base+s.index+s[1].indexOf(raw));
      const inst=raw.match(/^(\w+)\s*:\s*(?:entity\s+(?:work\.)?)?(\w+)(?:\s*\(\w+\))?\s*(?:generic\s+map\s*\((?:[^()]|\([^()]*\))*\)\s*)?port\s+map\s*\(([\s\S]*)\)$/i);
      if(inst){instance(l,'entity',inst[2],inst[1],inst[3],file,line,true,diagnose);continue}
      const a=raw.match(/^(\w+(?:\(\d+\))?)\s*<=\s*([\s\S]*)$/);
      if(a){assign(l,a[1],a[2].trim(),file,line,true,diagnose);continue}
      diagnose(file,line,'未展开的并发语句 '+raw.slice(0,64));
    }
  }
  return layers;
}
export function parseHdl(source,file,language,diagnose) {
  const v=language==='verilog';
  const text=source.replace(v?/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g:/--[^\n]*/g,spaces);
  return (v?verilog:vhdl)(text,file,lineLocator(text),diagnose);
}
