import {parseHdl} from './design-hdl.js';
export {renderLayerSvg} from './design-drawing.js';
export {exportDesign} from './design-export.js';
export {componentCatalog, validateComponent, instantiateComponent} from './design-catalog.js';

const pinTypes = {
  R: ['resistor','1','2'], C: ['capacitor','1','2'], L: ['inductor','1','2'],
  V: ['voltage','+','−'], I: ['current','+','−'], B: ['behavioral','+','−'],
  D: ['diode','A','K'], Q: ['bjt','C','B','E'], M: ['mosfet','D','G','S','B'],
  J: ['jfet','D','G','S'], Z: ['mesfet','D','G','S'], S: ['switch','1','2','C+','C−'],
  W: ['cswitch','1','2'], E: ['vcvs','+','−','C+','C−'], G: ['vccs','+','−','C+','C−'],
  F: ['cccs','+','−'], H: ['ccvs','+','−'], T: ['tline','1+','1−','2+','2−'],
  O: ['lossyline','1+','1−','2+','2−']
};
const spectreTypes = {resistor:'R',capacitor:'C',inductor:'L',vsource:'V',vsin:'V',vpulse:'V',vsweep:'V',isource:'I',vcvs:'E',vccs:'G',cccs:'F',ccvs:'H',bsource:'B',diode:'D'};
const modelKinds = new Set(['D','Q','M','J','Z','S','W','O']);
const norm = s => s.toLowerCase();
const split = s => s.trim().split(/\s+/).filter(Boolean);
export function makeLayer(name, file, line, ports, language, kind) {
  return {id:JSON.stringify([file,line,name]), name, file, line, ports, language, kind, components:[], nets:[]};
}
export function addComponent(layer, name, type, nodes, pinNames, value, model, file, line) {
  const pins = nodes.map((net,i)=>({name:pinNames[i] || String(i+1), number:i+1, net}));
  const component = {id:JSON.stringify([file,line,name,layer.components.length]),name,type,nodes,pins,value,model,
    source:{file,line},definition:null,targetLayerId:null};
  layer.components.push(component);
  return component;
}
function analogInstance(layer, text, file, line, diagnose) {
  const spectre = text.match(/^(\S+)\s*\(\s*([^)]*?)\s*\)\s+(\S+)(?:\s+(.*))?$/);
  if (spectre) {
    const [,name,netText,master,raw=''] = spectre;
    const nodes = split(netText);
    const code = spectreTypes[norm(master)];
    const spec = pinTypes[code] || [];
    const suffix = {R:'r',C:'c',L:'l'}[code];
    const simple = suffix && raw.match(new RegExp('(?:^|\\s)'+suffix+'\\s*=\\s*(\\S+)','i'));
    const c = addComponent(layer,name,spec[0] || 'instance',nodes,spec.slice(1),simple?.[1] || raw,code ? '' : master,file,line);
    if (!code) c.resolveKind = 'any';
    return true;
  }
  const [name,...args] = split(text);
  const code = name[0].toUpperCase();
  if (code==='X') {
    const end = args.findIndex((arg,i)=>/^(params?:|[^=]+=)/i.test(arg) || args[i+1]==='=');
    const terminals = args.slice(0,end<0 ? args.length : end);
    if (terminals.length<2) return false;
    const model = terminals.pop();
    const c=addComponent(layer,name,'instance',terminals,[],end<0?'':args.slice(end).join(' '),model,file,line);
    c.resolveKind='subckt'; return true;
  }
  const spec=pinTypes[code];
  if (!spec) return false;
  let count=spec.length-1, pins=spec.slice(1);
  if ((code==='E' || code==='G') && /^(value\b|vol\b|cur\b|table\b|poly\b|laplace\b)/i.test(args[2] || '')) {
    diagnose(file,line,'行为受控源的表达式未展开'); return true;
  }
  if (code==='Q' && args.length>=5 && !/^(area=|off$|[a-z]+=|[+.-]?\d)/i.test(args[4])) {
    count=4; pins.push('S');
  }
  if (args.length<count+(code==='V'||code==='I'?0:1)) return false;
  const tail=args.slice(count);
  let model='';
  if (modelKinds.has(code)) model=tail[code==='W'?1:0] || '';
  if (code==='R' || code==='C' || code==='L') {
    const candidate = tail.find(t=>/^[a-z_][\w.$:-]*$/i.test(t) && !/^off$/i.test(t));
    if (candidate) model=candidate;
  }
  const c=addComponent(layer,name,spec[0],args.slice(0,count),pins,tail.join(' '),model,file,line);
  if (model) c.resolveKind='model';
  return true;
}
function filePath(from, path, files) {
  const parts=(from.slice(0,from.lastIndexOf('/')+1)+path.replaceAll('\\','/')).split('/');
  const result=[];
  for(const p of parts) { if(p==='..') {if(!result.length)return null;result.pop()} else if(p && p!=='.') result.push(p); }
  const relative=result.join('/');
  if(files.has(relative)) return relative;
  return null;
}
function spiceRecords(text) {
  const records=[];
  const lines=text.split(/\r?\n/);
  let pending=false;
  for(let i=0;i<lines.length;i++) {
    const s=lines[i].replace(/\s*(?:\/\/|\s\$|\s;).*$/,'').trim();
    if(!s || s.startsWith('*')) continue;
    const continuation = s.startsWith('+');
    if(records.length && (pending || continuation)) records.at(-1).text+=' '+(continuation?s.slice(1):s);
    else records.push({line:i+1,text:s});
    pending=records.at(-1).text.endsWith('\\');
    if(pending) records.at(-1).text=records.at(-1).text.slice(0,-1);
  }
  return records;
}
function readAnalog(files, entry, diagnose, options) {
  const top=makeLayer('TOP',entry,1,[],'analog','top'), layers=[top], definitions=[], stack=[top];
  const ancestry=new Set(), recordsByFile=new Map();
  let expandedChars=0;
  function read(file,corner,depth) {
    const visitKey=JSON.stringify([file,corner]);
    if(depth>64 || ancestry.has(visitKey)) { diagnose(file,1,'工艺库包含循环或嵌套过深');return; }
    expandedChars+=files.get(file).length;
    if(expandedChars>48000000)throw new Error('展开的原理图输入超过 48 M 字符，请选择需要的模型角与器件');
    ancestry.add(visitKey);
    let section='', matched=false, modelBody=false, inControl=false;
    if(!recordsByFile.has(file)) recordsByFile.set(file,spiceRecords(files.get(file)));
    for(const {line,text} of recordsByFile.get(file)) {
      const active=stack.at(-1);
      if(/^\.control\b/i.test(text)){inControl=true;continue}
      if(/^\.endc\b/i.test(text)){inControl=false;continue}
      if(inControl)continue;
      if (/^\.(?:endl)\b|^endsection\b/i.test(text)){section='';continue}
      const sect=text.match(/^(?:\.lib|section)\s+([^\s'"]+)\s*$/i);
      if(sect) { section=norm(sect[1]); if(section===corner) matched=true;continue }
      if(corner && section!==corner) continue;
      if(section && !corner && depth>0) continue;
      if(modelBody){ if(text.includes('}')) modelBody=false;continue }
      const inc=text.match(/^(\.inc(?:lude)?|include|\.lib)\s+(?:"([^"]+)"|'([^']+)'|(\S+))(?:\s+(?:section\s*=\s*)?([\w.-]+))?/i);
      if(inc) {
        const path=inc[2] || inc[3] || inc[4], target=filePath(file,path,files);
        if(target) read(target,norm(inc[5] || ''),depth+1);
        else diagnose(file,line,'缺少引用的库文件 '+path);
        continue;
      }
      const sub=text.match(/^(?:inline\s+)?\.?subckt\s+(\S+?)(?:\s*\(([^)]*)\)|\s+(.+)|$)/i);
      if(sub) {
        const ports=[];
        for(const arg of split(sub[2] || sub[3] || '')) { if(/=|^param/i.test(arg))break;ports.push(arg); }
        const l=makeLayer(sub[1],file,line,ports,'analog','subckt');
        layers.push(l);definitions.push({name:l.name,file,line,kind:'subckt',layer:l,scope:active===top?null:active.id});stack.push(l);continue;
      }
      if(/^\.?ends(?:\s|$)/i.test(text)) {if(stack.length>1)stack.pop();continue}
      const model=text.match(/^\.?model\s+(\S+)\s+([^\s({]+)/i);
      if(model) {
        const definition={name:model[1],file,line,kind:'model',modelType:model[2],scope:active===top?null:active.id};
        if(/\.\d+$/.test(model[1])) {
          const bounds=Object.fromEntries([...text.matchAll(/\b(lmin|lmax|wmin|wmax)\s*=\s*([^\s)]+)/gi)].map(m=>[norm(m[1]),m[2]]));
          definition.bin={name:model[1],file,line,...bounds};
        }
        definitions.push(definition);
        modelBody=text.includes('{')&&!text.includes('}');continue;
      }
      if (/^\.end(?:\s|$)/i.test(text)) break;
      if(/^[.]/.test(text)||/^(?:simulator|parameters?|global|library|endlibrary|save|saveOptions|ahdl_include)\b/i.test(text)
        || /^\S+\s+(?:tran|dc|ac|noise|options|info|sweep)\b/i.test(text)) continue;
      if(!analogInstance(active,text,file,line,diagnose)) diagnose(file,line,'未映射至原理图的语句 '+text.slice(0,72));
    }
    ancestry.delete(visitKey);
    if(corner && !matched) diagnose(file,1,'未找到指定的工艺角 '+corner);
  }
  read(entry,norm(options.corner || ''),0);
  if(!top.components.length && layers.length>1) layers.shift();
  return {layers,definitions,top};
}
const modelSymbols={nmos:'mosfet',pmos:'mosfet',npn:'bjt',pnp:'bjt',d:'diode',njf:'jfet',pjf:'jfet',bsim4:'mosfet',bsim3v3:'mosfet'};
function languageOf(path, text) {
  if(/\.(?:v|sv|vh|svh)$/i.test(path))return 'verilog';
  if(/\.(?:vhd|vhdl)$/i.test(path))return 'vhdl';
  if(/^\s*module\s+\w+/m.test(text))return 'verilog';
  if(/^\s*entity\s+\w+\s+is\b/im.test(text))return 'vhdl';
  return 'analog';
}
export function buildDesign(input,entry,options={}) {
  const files=new Map();
  for(const [key,value] of (input instanceof Map? input : Object.entries(input || {}))) {
    const path=typeof value==='string'?key:(value.path || value.name || key);
    files.set(path,typeof value==='string'?value:(value.content ?? value.text ?? ''));
  }
  if(!files.has(entry))throw new Error('找不到入口文件 '+entry);
  const diagnostics=[];
  const diagnose=(file,line,message)=>diagnostics.push({file,line,message});
  const language=languageOf(entry,files.get(entry));
  let layers,definitions;
  if(language==='analog') ({layers,definitions}=readAnalog(files,entry,diagnose,options));
  else {
    layers=[];
    for(const [path,source] of files) {
      if(languageOf(path,source)===language) layers.push(...parseHdl(source,path,language,diagnose));
    }
    definitions=layers.map(layer=>({file:layer.file,line:layer.line,name:layer.name,kind:layer.kind,layer,scope:null}));
  }
  const keyed=s=>language==='verilog'?s:norm(s);
  const index=new Map(),families=new Map();
  function indexDef(d){const k=keyed(d.name);if(!index.has(k))index.set(k,[]);index.get(k).push(d)}
  for(const d of definitions){
    indexDef(d);
    if(!d.bin)continue;
    const name=d.name.replace(/\.\d+$/,''),key=JSON.stringify([keyed(name),d.scope,norm(d.modelType)]);
    if(!families.has(key))families.set(key,{...d,name,bins:[]});
    families.get(key).bins.push(d.bin);
  }
  for(const family of families.values())indexDef(family);
  for(const l of layers) {
    const nets=new Map(), referenced=new Set();
    for(const c of l.components) {
      if(c.resolveKind) {
        const candidates=(index.get(keyed(c.model)) || []).filter(d=>(!d.scope|| d.scope===l.id) && (c.resolveKind==='any'||c.resolveKind===d.kind));
        const local=candidates.filter(d=>d.scope===l.id), resolved=local.length?local:candidates;
        if(resolved.length===1) {
          const d=resolved[0]; c.definition={file:d.file,line:d.line,name:d.name,kind:d.kind};
          if(d.bins)Object.assign(c.definition,{kind:'model-family',binCount:d.bins.length,bins:d.bins});
          if(d.layer) {
            c.targetLayerId=d.layer.id;
            for(const pin of c.pins) {
              if(c.namedPins) {
                const i=d.layer.ports.findIndex(p=>keyed(p)===keyed(pin.name));
                if(i>=0) pin.number=i+1; else diagnose(c.source.file,c.source.line,'未声明的引脚 '+pin.name);
              } else pin.name=d.layer.ports[pin.number-1] || pin.name;
            }
            if(!c.namedPins && c.pins.length!==d.layer.ports.length) diagnose(c.source.file,c.source.line,c.name+' 的连接数与定义端口数不符');
          } else if(c.type==='instance') {
            c.type=modelSymbols[norm(d.modelType)] || 'device';
            const pinNames={mosfet:pinTypes.M,bjt:pinTypes.Q,diode:pinTypes.D,jfet:pinTypes.J}[c.type];
            if(pinNames) c.pins.forEach((p,i)=>p.name=pinNames[i+1] || p.name);
          }
        } else diagnose(c.source.file,c.source.line,(resolved.length?'匹配多个模型或模块，请指定工艺角或唯一模块 ':'找不到模型或模块 ')+c.model);
      }
      if(referenced.has(keyed(c.name))) diagnose(c.source.file,c.source.line,'同层位号重复 '+c.name);
      referenced.add(keyed(c.name));
      for(const p of c.pins) {
        if(!p.net || p.open)continue;
        const k=keyed(p.net);
        if(!nets.has(k)) nets.set(k,{name:p.net,pins:[]});
        const n=nets.get(k);p.net=n.name;n.pins.push({componentId:c.id,ref:c.name,pin:p.number,pinName:p.name});
      }
      c.nodes=c.pins.map(p=>p.net);
    }
    l.nets=[...nets.values()];
  }
  const inEntry=layers.filter(l=>l.file===entry), targets=new Set(layers.flatMap(l=>l.components.map(c=>c.targetLayerId)));
  const primary=inEntry.find(l=>!targets.has(l.id)) || inEntry[0] || layers[0];
  if(language!=='analog' && primary) {
    const reachable=new Set(),byId=new Map(layers.map(l=>[l.id,l]));
    const pending=inEntry.slice();
    while(pending.length){const l=pending.pop();if(reachable.has(l.id))continue;reachable.add(l.id);for(const c of l.components)if(c.targetLayerId)pending.push(byId.get(c.targetLayerId))}
    layers=layers.filter(l=>reachable.has(l.id));
  }
  if(!layers.length){layers=[makeLayer('TOP',entry,1,[],language,'top')];diagnose(entry,1,'未解析到模块或实体声明')}
  const activeFiles=new Set([entry,...layers.map(l=>l.file)]);
  return {entry,source:files.get(entry),language,layers,entryLayerId:primary?.id || layers[0].id,
    diagnostics:language==='analog'?diagnostics:diagnostics.filter(d=>activeFiles.has(d.file))};
}
