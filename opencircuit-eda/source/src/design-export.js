import {createDrawing,renderLayerSvg,palettes} from './design-drawing.js';
import {kicadXml,kicadSchematic} from './design-kicad.js';
import {fontFor} from './design-font/index.js';
const utf8=new TextEncoder();
const safeName=s=>String(s).replace(/[\u0000-\u001f<>:"/\\|?*]/g,'_').slice(0,130) || 'schematic';
const textBlob=(text,type)=>new Blob([text],{type});
const num=n=>Number(n.toFixed(4));
const crcTable=Array.from({length:256},(_,i)=>{
  for(let b=0;b<8;b++)i=(i>>>1)^((i&1)?0xedb88320:0);
  return i>>>0;
});
function crc32(data){let v=-1;for(const b of data)v=(v>>>8)^crcTable[(v^b)&255];return (v^-1)>>>0}
export async function storedZip(files) {
  let offset=0,size=0;
  const entries=[],central=[];
  const parts=(bytes,fields)=>{
    const a=new Uint8Array(bytes),view=new DataView(a.buffer);
    for(const [p,w,v] of fields)w===4?view.setUint32(p,v,true):view.setUint16(p,v,true);
    return a;
  };
  for(const {name,blob} of files){
    const data=new Uint8Array(await blob.arrayBuffer()),n=utf8.encode(name),crc=crc32(data);
    const h=parts(30,[[0,4,0x04034b50],[4,2,20],[6,2,2048],[12,2,33],[14,4,crc],[18,4,data.length],[22,4,data.length],[26,2,n.length]]);
    const c=parts(46,[[0,4,0x02014b50],[4,2,20],[6,2,20],[8,2,2048],[14,2,33],[16,4,crc],[20,4,data.length],[24,4,data.length],[28,2,n.length],[42,4,offset]]);
    entries.push(h,n,data);central.push(c,n);size+=46+n.length;offset+=30+n.length+data.length;
  }
  const end=parts(22,[[0,4,0x06054b50],[8,2,files.length],[10,2,files.length],[12,4,size],[16,4,offset]]);
  return new Blob([...entries,...central,end],{type:'application/zip'});
}
async function png(layer) {
  const canvas=document.createElement('canvas'),img=new Image();
  const svg=renderLayerSvg(layer,{theme:'light'}),url=URL.createObjectURL(textBlob(svg,'image/svg+xml'));
  try{
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('原理图光栅化失败'));img.src=url});
    const scale=Math.min(2,8192/img.naturalWidth,8192/img.naturalHeight,Math.sqrt(16e6/(img.naturalWidth*img.naturalHeight)));
    canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height);
    return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG 编码失败')),'image/png'));
  } finally {URL.revokeObjectURL(url);canvas.width=canvas.height=0}
}
const hex16=value=>value.toString(16).padStart(4,'0');
function textRuns(text,lookup) {
  const runs=[];
  for(const ch of text) {
    const glyph=lookup.get(ch),font=glyph?.id || 'CJK';
    let run=runs.at(-1);if(run?.font!==font){run={font,hex:'',width:0};runs.push(run)}
    if(glyph){run.hex+=hex16(glyph.cid);run.width+=glyph.width/1000}
    else {for(let i=0;i<ch.length;i++)run.hex+=hex16(ch.charCodeAt(i));run.width+=1}
  }
  return runs;
}
function pdfStream(d,layer,ph,scale,lookup) {
  const rgb=hex=>[1,3,5].map(pos=>num(parseInt(hex.slice(pos,pos+2),16)/255)).join(' ');
  const p=palettes.light,parts=[`q ${num(scale)} 0 0 ${num(-scale)} 14 ${ph-41} cm 1 J 1 j`];
  const text=(x,y,s,color,size,align)=>{
    const runs=textRuns(s,lookup),width=runs.reduce((sum,r)=>sum+r.width,0)*size;
    let tx=align==='middle'?x-width/2:x;
    const lines=[];
    for(const r of runs){lines.push(`${rgb(p[color])} rg BT /${r.font} ${size} Tf 1 0 0 -1 ${num(tx)} ${num(y)} Tm <${r.hex}> Tj ET`);tx+=r.width*size}
    return lines.join('\n');
  };
  for(const e of d.elements) {
    if(e.kind==='hit')continue;
    if(e.kind==='text'){parts.push(text(e.x,e.y,e.text,e.color,e.size,e.align));continue}
    const stroke=rgb(p[e.color || e.stroke]),fill=e.fill?rgb(p[e.fill]):'';
    parts.push(stroke+' RG '+(e.weight || 1.8)+' w'+(fill?' '+fill+' rg':''));
    if(e.kind==='line') {
      const cmds=[];
      for(let i=0;i<e.pts.length;i+=2)cmds.push(num(e.pts[i])+' '+num(e.pts[i+1])+(i?' l':' m'));
      parts.push(cmds.join(' ')+' S');
    } else if(e.kind==='rect')parts.push(`${num(e.x)} ${num(e.y)} ${num(e.w)} ${num(e.h)} re B`);
    else if(e.kind==='circle'){
      const {x,y,r}=e,k=r*0.55228475;
      const curve=(...a)=>a.map(num).join(' ')+' c';
      parts.push(`${num(x+r)} ${num(y)} m`,curve(x+r,y+k,x+k,y+r,x,y+r),curve(x-k,y+r,x-r,y+k,x-r,y),
        curve(x-r,y-k,x-k,y-r,x,y-r),curve(x+k,y-r,x+r,y-k,x+r,y),'h B');
    }
  }
  parts.push('Q',`q 1 0 0 -1 0 ${ph} cm`,text(21,24,layer.name+'   /   '+layer.file,'ink',12,'start'),'Q');
  return parts.join('\n')+'\n';
}
function toUnicode(used) {
  const mappings=[...used].map(([cid,c])=>'<'+hex16(cid)+'> <'+hex16(c.charCodeAt(0))+'>');
  const lines=['/CIDInit /ProcSet findresource begin','12 dict begin','begincmap','/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
    '/CMapName /OCUnicode def','/CMapType 2 def','1 begincodespacerange','<0000> <FFFF>','endcodespacerange'];
  for(let i=0;i<mappings.length;i+=100){const chunk=mappings.slice(i,i+100);lines.push(chunk.length+' beginbfchar',...chunk,'endbfchar')}
  lines.push('endcmap','CMapName currentdict /CMap defineresource pop','end','end');
  return lines.join('\n')+'\n';
}
export async function vectorPdf(layers) {
  const objects=[],add=(...parts)=>(objects.push(parts),objects.length);
  const stream=(data,dict='')=>add(`<< /Length ${data.length} ${dict} >>\nstream\n`,data,'\nendstream');
  add('<< /Type /Catalog /Pages 2 0 R >>');add('');
  const drawings=layers.map(l=>createDrawing(l)), characters=new Set();
  for(const [i,l] of layers.entries()) {
    for(const s of [l.name+'   /   '+l.file,...drawings[i].elements.filter(e=>e.kind==='text').map(e=>e.text)])for(const ch of s)characters.add(ch);
  }
  const {lookup,fonts}=await fontFor(characters),fontResources=[];
  for(const [i,f] of fonts.entries()) {
    const name='OCEDA'+String.fromCharCode(65+i)+'+SourceHanSansCN-Regular';
    const ff=stream(f.program,'/Subtype /CIDFontType0C /Filter /FlateDecode');
    const descriptor=add(`<< /Type /FontDescriptor /FontName /${name} /Flags 4 /FontBBox [-1002 -1048 2928 1808] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 733 /StemV 80 /FontFile3 ${ff} 0 R >>`);
    const widths=[...f.usage].sort((a,b)=>a[0]-b[0]).map(([cid,c])=>cid+' ['+lookup.get(c).width+']').join(' ');
    const descendant=add(`<< /Type /Font /Subtype /CIDFontType0 /BaseFont /${name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /DW 1000 /W [${widths}] /FontDescriptor ${descriptor} 0 R >>`);
    const unicode=stream(toUnicode(f.usage));
    const type0=add(`<< /Type /Font /Subtype /Type0 /BaseFont /${name} /Encoding /Identity-H /DescendantFonts [${descendant} 0 R] /ToUnicode ${unicode} 0 R >>`);
    fontResources.push('/'+f.id+' '+type0+' 0 R');
  }
  if([...characters].some(ch=>!lookup.has(ch))){
    const desc=add('<< /Type /FontDescriptor /FontName /STSong-Light /Flags 6 /FontBBox [-25 -254 1000 880] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 700 /StemV 80 >>');
    const cid=add(`<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 4 >> /DW 1000 /FontDescriptor ${desc} 0 R >>`);
    const fallback=add(`<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [${cid} 0 R] >>`);
    fontResources.push('/CJK '+fallback+' 0 R');
  }
  const pages=[];
  for(const [i,layer] of layers.entries()){
    const d=drawings[i],scale=Math.min(0.85,14000/Math.max(d.width,d.height));
    const w=Math.ceil(d.width*scale)+28,h=Math.ceil(d.height*scale)+53;
    const content=stream(pdfStream(d,layer,h,scale,lookup));
    pages.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /Font << ${fontResources.join(' ')} >> >> /Contents ${content} 0 R >>`));
  }
  objects[1]=[`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map(n=>n+' 0 R').join(' ')}] >>`];
  const out=['%PDF-1.4\n'],offsets=[0];let length=out[0].length;
  objects.forEach((parts,i)=>{const obj=[(i+1)+' 0 obj\n',...parts,'\nendobj\n'];offsets.push(length);
    for(const part of obj){out.push(part);length+=part.length}});
  out.push('xref\n0 '+offsets.length+'\n0000000000 65535 f \n',...offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n'),
    'trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+length+'\n%%EOF\n');
  return new Blob(out,{type:'application/pdf'});
}
export async function exportDesign(design,layerId,format) {
  const layer=design.layers.find(l=>l.id===layerId);
  if(!layer)throw new Error('图层不存在');
  const base=safeName(layer.name==='TOP'?design.entry.split('/').at(-1).replace(/\.[^.]+$/,''):layer.name);
  if(format==='svg')return {name:base+'.svg',blob:textBlob(renderLayerSvg(layer,{theme:'light'}),'image/svg+xml')};
  if(format==='png')return {name:base+'.png',blob:await png(layer)};
  if(format==='all-png'){
    const files=[];
    for(const [i,l] of design.layers.entries())files.push({name:String(i+1).padStart(3,'0')+'-'+safeName(l.name)+'.png',blob:await png(l)});
    return {name:base+'-layers.zip',blob:await storedZip(files)};
  }
  if(format==='pdf')return {name:base+'-layers.pdf',blob:await vectorPdf(design.layers)};
  if(format==='kicad')return {name:base+'.kicad_sch',blob:textBlob(kicadSchematic(layer,base),'text/plain;charset=utf-8')};
  if(format==='kicad-xml')return {name:base+'-netlist.xml',blob:textBlob(kicadXml(layer),'application/xml')};
  if(format==='native')return {name:safeName(design.entry.split('/').at(-1)),blob:textBlob(design.source,'text/plain;charset=utf-8')};
  throw new Error('未知导出格式 '+format);
}
