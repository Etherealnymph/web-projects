const fs=require('fs');
const {parseSpectre}=require('C:/Users/21154/Desktop/1101/gm-id-studio/src/model-parser.js');
const t=fs.readFileSync('C:/Users/21154/Desktop/rf018.scs','utf8');
console.time('parse'); const db=parseSpectre(t,{file:'rf018.scs'}); console.timeEnd('parse');
console.log(Object.keys(db.corners));
for (const c of ['TT','TT_3V']) for (const d of (c.endsWith('3V') ? ['nch3','pch3'] : ['nch','pch'])) {
  const arr=db.corners[c].devices[d]; console.log(c,d,arr.length,arr[3].type,arr[3].vth0,arr[3].tox,arr[3].u0,arr[3].lmin,arr[3].wmin);
}
console.log('TT nch bins');
for (const b of db.corners.TT.devices.nch) console.log([b.lmin,b.lmax,b.wmin,b.wmax,b.vth0,b.u0,b.tox].join(' '));
