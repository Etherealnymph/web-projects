const fs=require('fs'); const {parseSpectre}=require('C:/Users/21154/Desktop/1101/gm-id-studio/src/model-parser.js'); const E=require('C:/Users/21154/Desktop/1101/gm-id-studio/src/engine.js');
const db=parseSpectre(fs.readFileSync('C:/Users/21154/Desktop/rf018.scs','utf8'));
const pts=E.sweepVgs(db,{corner:'TT',domain:'1.8',device:'n',L:2e-6,W:10e-6,Vds:0.9},301).filter(p=>p.Id>1e-8&&p.gmid>1.2&&p.gmro>0&&p.region!=='triode');
console.log('n',pts.length);
for(let i=0;i<8;i++) console.log('start',i,pts[i].Vgs,pts[i].gmid,pts[i].gmro,pts[i].region);
for(let i=pts.length-8;i<pts.length;i++) console.log('end',i,pts[i].Vgs,pts[i].gmid,pts[i].gmro,pts[i].region);
let min=1e9, max=-1; for(const p of pts){min=Math.min(min,p.gmro);max=Math.max(max,p.gmro);} console.log('gain',min,max);
