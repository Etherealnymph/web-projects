const fs=require('fs');
const {parseSpectre}=require('C:/Users/21154/Desktop/1101/GmIdStudio/src/model-parser.js');
const E=require('C:/Users/21154/Desktop/1101/GmIdStudio/src/engine.js');
const db=parseSpectre(fs.readFileSync('C:/Users/21154/Desktop/rf018.scs','utf8'));
for(const dev of ['n','p']){
  console.log(dev);
  for(const v of [0,0.4,0.5,0.6,0.8,1.0,1.2,1.5,1.8]){
    const r=E.simulate(db,{device:dev,L:0.18e-6,W:10e-6,Vgs:v,Vds:0.9});
    console.log(v, r.Vth.toFixed(3), (r.Id*1e6).toFixed(3), r.gmid.toFixed(2), r.gmro.toFixed(1), r.IdW.toFixed(3), (r.fT/1e9).toFixed(2), r.region, (r.gds*1e6).toFixed(3));
  }
}
