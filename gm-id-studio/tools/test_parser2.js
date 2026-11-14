const fs=require('fs');
const {parseSpectre}=require('C:/Users/21154/Desktop/1101/gm-id-studio/src/model-parser.js');
const db=parseSpectre(fs.readFileSync('C:/Users/21154/Desktop/rf018.scs','utf8'));
for(const c of Object.keys(db.corners)) console.log(c,Object.keys(db.corners[c].devices),db.corners[c].modelSection);
