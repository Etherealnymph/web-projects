const fs=require('fs'); const {parseSpectre}=require('C:/Users/21154/Desktop/1101/gm-id-studio/src/model-parser.js'); const E=require('C:/Users/21154/Desktop/1101/gm-id-studio/src/engine.js');
const db=parseSpectre(fs.readFileSync('C:/Users/21154/Desktop/rf018.scs','utf8'));
for (const v of [0.8,0.9,1.0,1.1,1.2,1.3,1.4,1.45,1.48,1.49,1.5,1.55,1.6]) {
 const p=E.simulate(db,{corner:'TT',domain:'1.8',device:'n',L:2e-6,W:10e-6,Vgs:v,Vds:0.9});
 console.log(v,p.Id,p.gmid,p.gmro,p.region,p.Vdsat);
}
