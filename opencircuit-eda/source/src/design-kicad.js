import {xml} from './design-drawing.js';

const q=value=>'"'+String(value).replaceAll('\\','\\\\').replaceAll('"','\\"').replace(/[\r\n]/g,' ')+'"';
const num=value=>Number(value.toFixed(3));
function uuid(seed) {
  // Stable instance IDs keep repeated exports of an unchanged design comparable.
  const hash=i=>{
    let h=(2166136261^i)>>>0;
    for(const ch of seed){h=Math.imul(h^ch.codePointAt(0),16777619)>>>0}
    return h.toString(16).padStart(8,'0');
  };
  const h=[0,1,2,3].map(hash).join('');
  return h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20);
}
function refMap(layer) {
  const valid=ref=>/^[A-Za-z][\w.-]*\d+$/.test(ref);
  const reserved=new Set(layer.components.filter(c=>valid(c.name)).map(c=>c.name.toUpperCase()));
  const used=new Set(), counters=new Map(),refs=new Map();
  for(const c of layer.components){
    let ref=c.name;
    if(!valid(ref) || used.has(ref.toUpperCase())) {
      const prefix=layer.language==='analog' && /^[a-z]/i.test(ref)?ref[0].toUpperCase():'U';
      let serial=counters.get(prefix) || 0;
      do{ref=prefix+(++serial)}while(reserved.has(ref) || used.has(ref));
      counters.set(prefix,serial);
    }
    used.add(ref.toUpperCase());refs.set(c.id,ref);
  }
  return refs;
}
export function kicadXml(layer) {
  const refs=refMap(layer);
  const components=layer.components.map(c=>`<comp ref="${xml(refs.get(c.id))}"><value>${xml(c.value || c.model || c.name)}</value><fields><field name="Source">${xml(c.name)} ${xml(c.source.file)}#${c.source.line}</field></fields><libsource lib="OpenCircuit" part="${xml(c.model || c.type)}"/><sheetpath names="/" tstamps="/"/><tstamps>${uuid(c.id)}</tstamps></comp>`).join('\n');
  const nets=layer.nets.map((n,i)=>`<net code="${i+1}" name="${xml(n.name)}">${n.pins.map(p=>`<node ref="${xml(refs.get(p.componentId))}" pin="${p.pin}"/>`).join('')}</net>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<export version="D"><design><source>${xml(layer.file)}</source><tool>OpenCircuit EDA</tool></design><components>\n${components}\n</components><libparts/><libraries/><nets>\n${nets}\n</nets></export>\n`;
}
export function kicadSchematic(layer,projectName) {
  const refs=refMap(layer),sheetId=uuid(layer.id),symbols=[],items=[], libBySignature=new Map();
  const effects='(effects (font (size 1.27 1.27)))',stroke='(stroke (width 0) (type default))';
  let placed=0,x=49.53,y=30.48,rowHeight=0;
  for(const c of layer.components) {
    const pins=c.pins, span=Math.max(1,pins.length-1)*2.54, top=Math.ceil((span/2)/1.27)*1.27;
    const bodyY=top+2.54,bodyX=8.89, pinX=-12.7;
    const signature=JSON.stringify([c.type,c.model,pins.map(p=>[p.name,p.number])]);
    let symbol=libBySignature.get(signature);
    if(!symbol){
      symbol='OC_'+(libBySignature.size+1);
      const libPins=pins.map((p,i)=>`(pin passive line (at ${pinX} ${num(top-i*2.54)} 0) (length 3.81) (name ${q(p.name)} ${effects}) (number "${p.number}" ${effects}))`);
      const refPrefix=(refs.get(c.id).match(/^[a-z]+/i) || ['U'])[0];
      symbols.push(`(symbol "OpenCircuit:${symbol}" (pin_names (offset 0.508)) (in_bom yes) (on_board yes)
        (property "Reference" ${q(refPrefix)} (at 0 ${num(bodyY+2.54)} 0) ${effects})
        (property "Value" ${q(c.model || c.type)} (at 0 ${num(-bodyY-2.54)} 0) ${effects})
        (symbol "${symbol}_0_1" (rectangle (start ${-bodyX} ${num(bodyY)}) (end ${bodyX} ${num(-bodyY)}) (stroke (width 0.254) (type default)) (fill (type background))))
        (symbol "${symbol}_1_1" ${libPins.join('\n')}))`);
      libBySignature.set(signature,symbol);
    }
    const instanceId=uuid(layer.id+'instance'+c.id),ref=refs.get(c.id), centerY=num(y+bodyY);
    const value=(c.model || c.value || c.type).slice(0,128);
    items.push(`(symbol (lib_id "OpenCircuit:${symbol}") (at ${num(x)} ${centerY} 0) (unit 1) (in_bom yes) (on_board yes) (dnp no)
      (uuid ${instanceId}) (property "Reference" ${q(ref)} (at ${num(x)} ${num(y-2.54)} 0) ${effects})
      (property "Value" ${q(value)} (at ${num(x)} ${num(centerY+bodyY+2.54)} 0) ${effects})
      (property "Source" ${q(c.name+' '+c.source.file+'#'+c.source.line)} (at ${num(x)} ${centerY} 0) (effects (font (size 1.27 1.27)) (hide yes)))
      ${pins.map((p,i)=>`(pin "${p.number}" (uuid ${uuid(instanceId+'pin'+i)}))`).join('\n')}
      (instances (project ${q(projectName)} (path "/${sheetId}" (reference ${q(ref)}) (unit 1)))))`);
    for(const [i,p] of pins.entries()) {
      const px=num(x+pinX),py=num(centerY-top+i*2.54);
      if(!p.net || p.open){items.push(`(no_connect (at ${px} ${py}) (uuid ${uuid(instanceId+'open'+i)}))`);continue}
      const lx=num(px-8.89);
      items.push(`(wire (pts (xy ${px} ${py}) (xy ${lx} ${py})) ${stroke} (uuid ${uuid(instanceId+'wire'+i)}))
      (label ${q(p.net)} (at ${lx} ${py} 0) (effects (font (size 1.27 1.27)) (justify left bottom)) (uuid ${uuid(instanceId+'label'+i)}))`);
    }
    rowHeight=Math.max(rowHeight,bodyY*2+16.51);
    if(++placed%3===0){x=49.53;y+=rowHeight;rowHeight=0}else x+=80.01;
  }
  const pageHeight=Math.max(210,Math.ceil(y+rowHeight+25));
  return `(kicad_sch (version 20231120) (generator "opencircuit") (uuid ${sheetId}) (paper "User" 297 ${pageHeight})
    (lib_symbols ${symbols.join('\n')})\n${items.join('\n')}\n(sheet_instances (path "/" (page "1"))))\n`;
}
