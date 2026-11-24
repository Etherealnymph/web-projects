const loaders={
  core:()=>import('./core.js'),
  u0:()=>import('./u0.js'),
  u2:()=>import('./u2.js'),
  u3:()=>import('./u3.js'),
  u4:()=>import('./u4.js'),
  u5:()=>import('./u5.js'),
  u6:()=>import('./u6.js'),
  u7:()=>import('./u7.js'),
  u8:()=>import('./u8.js'),
  u9:()=>import('./u9.js'),
  uf:()=>import('./uf.js'),
};

const binary=s=>Uint8Array.from(atob(s),v=>v.charCodeAt(0));
const cache=new Map();
async function group(key) {
  if(!loaders[key])return;
  if(!cache.has(key))cache.set(key,loaders[key]().then(({metrics,program})=>{
    const binaryMetrics=binary(metrics),view=new DataView(binaryMetrics.buffer);
    const glyphs=new Map();
    for(let i=0;i<view.byteLength;i+=6)glyphs.set(String.fromCharCode(view.getUint16(i)),[view.getUint16(i+2),view.getUint16(i+4)]);
    return {glyphs,program:binary(program),key};
  }));
  return cache.get(key);
}
export async function fontFor(characters) {
  const core=await group('core'),keys=new Set();
  for(const c of characters) if(!core.glyphs.has(c))keys.add('u'+(c.codePointAt(0)>>>12).toString(16));
  const available=[core,...(await Promise.all([...keys].map(group))).filter(Boolean)];
  const result=new Map(),used=new Map();
  for(const c of characters) {
    for(const font of available){
      const glyph=font.glyphs.get(c);if(!glyph)continue;
      if(!used.has(font.key))used.set(font.key,{...font,id:'F'+(used.size+1),usage:new Map()});
      const subset=used.get(font.key);subset.usage.set(glyph[0],c);
      result.set(c,{id:subset.id,cid:glyph[0],width:glyph[1]});break;
    }
  }
  return {lookup:result,fonts:[...used.values()]};
}
