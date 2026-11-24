export const xml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export const palettes={
  dark:{bg:'#111923',grid:'#263447',ink:'#ebf0f8',muted:'#a9b8ca',wire:'#50ceb6',device:'#95befe',accent:'#facb82',body:'#1b293c',selected:'#f2bd68'},
  light:{bg:'#ffffff',grid:'#dbe3e9',ink:'#202c3d',muted:'#4b5e70',wire:'#167260',device:'#275d9d',accent:'#86561c',body:'#edf3fa',selected:'#a45300'}
};
const shorten=(s,limit)=>s.length>limit?s.slice(0,limit-1)+'…':s;
const points=(...args)=>args;
function draft(layer,selectedId) {
  const d={elements:[],width:640,height:320,group:null};
  function add(kind,attrs){d.elements.push({kind,group:d.group,...attrs})}
  d.line=(pts,color='wire',weight=2)=>add('line',{pts,color,weight});
  d.text=(x,y,text,color='ink',size=14,align='start')=>add('text',{x,y,text:String(text || ''),color,size,align});
  d.rect=(x,y,w,h,stroke='device',fill='body',radius=5)=>add('rect',{x,y,w,h,stroke,fill,radius});
  d.circle=(x,y,r,stroke='wire',fill='wire')=>add('circle',{x,y,r,stroke,fill});
  d.start=(c,x,y,w,h)=>{d.group=c;add('hit',{x,y,w,h,selected:c.id===selectedId})};
  d.end=()=>{d.group=null};
  return d;
}
function valueLabel(c) {
  const v=c.value || c.model || '';
  if(/PULSE\s*\(/i.test(v)){const m=v.match(/PULSE\s*\(\s*(\S+)\s+(\S+)/i);if(m)return m[1]+' → '+m[2]+' V'}
  if(c.type==='voltage' && /^0(?:\.0+)?$/.test(v))return '0 V';
  if(c.type==='voltage' && /^[\d.+-]+$/.test(v))return v+' V';
  if(c.type==='current' && /^[\d.eE+-]+[munpkMGT]?$/.test(v))return v+' A';
  const units={resistor:'Ω',capacitor:'F',inductor:'H'};
  if(units[c.type] && /^[\d.+-]+(?:e[+-]?\d+)?(?:meg|[a-zµ])?$/i.test(v))return v+' '+units[c.type];
  return shorten(v.replace(/\s+/g,' '),22);
}
// The symbol axis follows pin 1 to pin 2; orientation also sets diode and source polarity.
function symbol(d,c,x,y,dx,dy) {
  const local=(u,v)=>[x+dx*u-dy*v,y+dy*u+dx*v];
  const path=pts=>d.line(pts.flatMap(([u,v])=>local(u,v)),'device',2.4);
  const lead=(a,b)=>d.line([...local(a,0),...local(b,0)],'wire');
  const circle=r=>d.circle(x,y,r,'device','bg');
  switch(c.type) {
    case 'resistor':
      lead(-40,-25);lead(25,40);
      path([[-25,0],[-20,-8],[-12,8],[-4,-8],[4,8],[12,-8],[20,8],[25,0]]);break;
    case 'capacitor':
      lead(-40,-5);lead(5,40);path([[-5,-16],[-5,16]]);path([[5,-16],[5,16]]);break;
    case 'inductor': {
      lead(-40,-24);lead(24,40);
      const coil=[];
      for(let i=0;i<=32;i++)coil.push([-24+i*1.5,-Math.abs(Math.sin(i*Math.PI/8))*12]);
      path(coil);break;
    }
    case 'diode':
      lead(-40,-13);lead(13,40);
      path([[-13,-13],[12,0],[-13,13],[-13,-13]]);path([[13,-13],[13,13]]);break;
    case 'voltage': case 'current': case 'behavioral':
      lead(-40,-19);lead(19,40);circle(19);
      if(c.type==='current'){path([[-10,0],[10,0],[5,-4]]);path([[10,0],[5,4]])}
      else if(c.type==='behavioral'){path([[-12,3],[-6,-6],[0,0],[6,6],[12,-3]])}
      else {const [ax,ay]=local(-8,0),[bx,by]=local(8,0);d.line([ax-3.5,ay,ax+3.5,ay],'device',2);d.line([ax,ay-3.5,ax,ay+3.5],'device',2);d.line([bx-3.5,by,bx+3.5,by],'device',2)}
      break;
    default:
      lead(-40,-24);lead(24,40);path([[-24,-11],[24,-11],[24,11],[-24,11],[-24,-11]]);
  }
}
function chainInfo(l) {
  if(l.language!=='analog' || !l.components.length)return;
  const reference=(l.nets.find(n=>n.name==='0') || l.nets.find(n=>/^(ref|gnd|vss)$/i.test(n.name)))?.name;
  if(!reference)return;
  const links=new Map(),shunts=new Map();
  for(const c of l.components) {
    if(c.nodes.length!==2 && !(c.type==='instance' && c.nodes.length===3 && c.nodes[2]===reference))return;
    const [a,b]=c.nodes;if(a===b)return;
    if(a===reference || b===reference) {
      const node=a===reference?b:a;
      if(shunts.has(node))return;
      shunts.set(node,c);
      if(!links.has(node))links.set(node,[]);
    } else {
      for(const [from,to] of [[a,b],[b,a]]){if(!links.has(from))links.set(from,[]);links.get(from).push({to,c})}
    }
  }
  const starts=[...links].filter(([,v])=>v.length<2).map(([k])=>k);
  if(!starts.length || [...links.values()].some(v=>v.length>2))return;
  const first=starts.find(n=>['voltage','current','behavioral'].includes(shunts.get(n)?.type)) || starts[0];
  const order=[first],visited=new Set(order),edges=[];
  let previous;
  while(true){const node=order.at(-1), edge=links.get(node).find(e=>e.to!==previous);if(!edge)break;
    if(visited.has(edge.to))return;visited.add(edge.to);edges.push(edge.c);order.push(edge.to);previous=node;
  }
  if(order.length===links.size) return {order,edges,shunts,reference};
}
function drawChain(d,chain) {
  const {order,edges,shunts,reference}=chain;
  const pitch=205,layoutWidth=(order.length-1)*pitch;
  d.width=Math.max(660,layoutWidth+222);d.height=315;
  const left=(d.width-layoutWidth)/2,railY=106,groundY=249,cY=174;
  let minGround=Infinity,maxGround=-Infinity;
  const grounds=[];
  function ground(x){minGround=Math.min(x,minGround);maxGround=Math.max(x,maxGround);grounds.push(x)}
  order.forEach((net,i)=>{
    const x=left+i*pitch;
    const c=shunts.get(net), next=edges[i];
    if(c) {
      d.start(c,x-32,railY+21,141,103);
      d.line(points(x,railY,x,cY-40));d.line(points(x,cY+40,x,groundY));ground(x);
      symbol(d,c,x,cY,0,c.nodes[0]===net?1:-1);
      d.text(x+30,cY-3,c.name,'ink',15);d.text(x+30,cY+18,valueLabel(c),'muted',13);d.end();
    }
    if(next) {
      const center=x+pitch/2;
      const box=next.type==='instance';
      d.start(next,center-51,railY-52,102,box?103:81);
      const half=box?46:40;
      d.line([x,railY,center-half,railY]);d.line([center+half,railY,x+pitch,railY]);
      if(box) {
        d.rect(center-half,railY-21,half*2,42);
        d.text(center,railY+5,shorten(next.model,13),'device',13,'middle');
        d.line([center,railY+21,center,groundY]);ground(center);
        d.text(center+7,railY+41,shorten(next.pins[2]?.name || '',10),'muted',10);
      } else symbol(d,next,center,railY,next.nodes[0]===net?1:-1,0);
      d.text(center,railY-(box?34:29),next.name,'ink',15,'middle');
      if(!box)d.text(center,railY+32,valueLabel(next),'muted',13,'middle');
      d.end();
    }
    d.circle(x,railY,3.2);d.text(x,railY-15,shorten(net,19),'wire',13,'middle');
  });
  if(grounds.length) {
    const center=(minGround+maxGround)/2;
    d.line([minGround,groundY,maxGround,groundY]);d.line([center,groundY,center,groundY+10]);
    if(reference==='0') {for(let j=0;j<3;j++)d.line([center-12+j*4,groundY+10+j*4,center+12-j*4,groundY+10+j*4]);}
    else d.circle(center,groundY+13,3,'wire','bg');
    d.text(center+19,groundY+18,reference,'wire',13);
    for(const x of grounds)if(x>minGround && x<maxGround)d.circle(x,groundY,3.2);
  }
}
const isTwoPole=c=>c.pins.length===2 && ['resistor','capacitor','inductor','diode','voltage','current','behavioral'].includes(c.type);
const pinX=(c,x,w,i)=>isTwoPole(c)?x+w/2+(i===0?-45:45):x+(i+1)*w/(c.pins.length+1);
function drawGroup(d,group,top) {
  const nets=new Map(),devices=[];
  let x=132;
  for(const c of group){
    const width=Math.max(128,c.pins.length*34+26);
    const dev={c,x,width};devices.push(dev);
    c.pins.forEach((p,i)=>{
      if(!p.net || p.open)return;
      const px=pinX(c,x,width,i);
      if(!nets.has(p.net))nets.set(p.net,[]);
      nets.get(p.net).push(px);
    });
    x+=width+44;
  }
  const coord=new Map(), y0=top+24;
  let i=0;
  for(const [net,xs] of nets) {
    const y=y0+(i++)*22;coord.set(net,y);
    d.text(26,y+4,shorten(net,14),'wire',12);
    d.line([119,y,Math.max(...xs),y],'wire',1.35);
  }
  const bodyTop=y0+nets.size*22+14;
  for(const {c,x,width} of devices) {
    const center=x+width/2;
    const two=isTwoPole(c);
    const y=bodyTop+22;
    d.start(c,x-8,bodyTop-7,width+16,91);
    c.pins.forEach((p,i)=>{
      const px=pinX(c,x,width,i),ny=coord.get(p.net);
      if(ny!=null && !p.open){d.line([px,ny,px,two?y:bodyTop],'wire',1.5);d.circle(px,ny,2.7)}
    });
    if(two) {
      d.line([pinX(c,x,width,0),y,center-40,y]);d.line([center+40,y,pinX(c,x,width,1),y]);
      symbol(d,c,center,y,1,0);d.text(center,y+40,c.name,'ink',15,'middle');
      d.text(center,y+59,valueLabel(c),'muted',12,'middle');
    } else {
      d.rect(x,bodyTop,width,62);
      c.pins.forEach((p,i)=>d.text(x+(i+1)*width/(c.pins.length+1),bodyTop+16,shorten(p.name,8),'muted',10,'middle'));
      d.text(center,bodyTop+37,shorten(c.name,20),'ink',15,'middle');
      d.text(center,bodyTop+53,shorten(c.model || c.type,22),'device',12,'middle');
    }
    d.end();
  }
  return {width:x,height:bodyTop+103};
}
export function createDrawing(layer,options={}) {
  const d=draft(layer,options.selectedId);
  const chain=chainInfo(layer);
  if(chain)drawChain(d,chain);
  else {
    let bottom=45;
    for(let i=0;i<layer.components.length;i+=4){const group=drawGroup(d,layer.components.slice(i,i+4),bottom);d.width=Math.max(d.width,group.width);bottom=group.height}
    d.height=Math.max(230,bottom+22);
  }
  if(!layer.components.length)d.text(34,120,'此层没有可绘制的电路实例','muted',15);
  return d;
}
export function renderLayerSvg(layer,options={}) {
  const d=createDrawing(layer,options), p=palettes[options.theme==='light'?'light':'dark'];
  const out=[`<svg xmlns="http://www.w3.org/2000/svg" width="${d.width}" height="${d.height}" viewBox="0 0 ${d.width} ${d.height}" role="img" aria-label="${xml(layer.name)}" font-family="ui-monospace, Menlo, monospace"><defs><pattern id="oc-grid" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".85" fill="${p.grid}"/></pattern></defs><rect width="100%" height="100%" fill="${p.bg}"/><rect width="100%" height="100%" fill="url(#oc-grid)"/>`];
  let group=null;
  for(const e of d.elements) {
    if(e.group!==group){if(group)out.push('</g>');group=e.group;if(group)out.push(`<g data-component-id="${xml(group.id)}" tabindex="0" role="button" style="cursor:pointer" aria-label="${xml(group.name)}"><title>${xml(group.name+' · '+group.source.file+':'+group.source.line)}</title>`)}
    const f=e.fill?p[e.fill]:'none',s=p[e.stroke];
    if(e.kind==='hit')out.push(`<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" rx="7" fill="${e.selected?p.body:'transparent'}" stroke="${e.selected?p.selected:'none'}" stroke-dasharray="4 3"/>`);
    if(e.kind==='line')out.push(`<polyline points="${e.pts.join(' ')}" fill="none" stroke="${p[e.color]}" stroke-width="${e.weight}" stroke-linecap="round" stroke-linejoin="round"/>`);
    if(e.kind==='circle')out.push(`<circle cx="${e.x}" cy="${e.y}" r="${e.r}" stroke="${s}" fill="${f}" stroke-width="2"/>`);
    if(e.kind==='text')out.push(`<text x="${e.x}" y="${e.y}" font-size="${e.size}" text-anchor="${e.align}" fill="${p[e.color]}">${xml(e.text)}</text>`);
    if(e.kind==='rect')out.push(`<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" rx="${e.radius}" stroke="${s}" fill="${f}" stroke-width="1.8"/>`);
  }
  if(group)out.push('</g>');out.push('</svg>');return out.join('');
}
