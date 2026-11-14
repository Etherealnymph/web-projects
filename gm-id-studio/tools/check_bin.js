const fs=require('fs');
const {parseSpectre}=require('C:/Users/21154/Desktop/1101/gm-id-studio/src/model-parser.js');
const E=require('C:/Users/21154/Desktop/1101/gm-id-studio/src/engine.js');
const db=parseSpectre(fs.readFileSync('C:/Users/21154/Desktop/rf018.scs','utf8'));
const bins=db.corners.TT.devices.nch;
bins.forEach((b,i)=>console.log(i+1,b.lmin,b.lmax,b.wmin,b.wmax,b.vth0));
const p=E.simulate(db,{corner:'TT',domain:'1.8',device:'n',L:0.18e-6,W:10e-6,Vgs:0.7,Vds:0.9});
console.log('picked',p.bin.lmin,p.bin.lmax,p.bin.wmin,p.bin.wmax,'index',bins.indexOf(p.bin)+1);
