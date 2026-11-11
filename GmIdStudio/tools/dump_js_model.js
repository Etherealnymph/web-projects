const fs=require('fs');
const {parseSpectre}=require('C:/Users/21154/Desktop/1101/GmIdStudio/src/model-parser.js');
const db=parseSpectre(fs.readFileSync('C:/Users/21154/Desktop/rf018.scs','utf8'),{file:'rf018.scs'});
fs.writeFileSync('C:/Users/21154/Desktop/1101/GmIdStudio/tools/js-model.json',JSON.stringify(db,null,1));
