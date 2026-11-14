// No GPU is mocked as a passing renderer: these are actual Three.js geometry
// and gameplay-state tests. Real WebGL/browser frame-rate QA is a separate gate.
const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const THREE=require('../vendor/three.min.js');
const root=path.resolve(__dirname,'..');
const noop=()=>{};
const paint=new Proxy({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),createRadialGradient:()=>({addColorStop:noop}),createLinearGradient:()=>({addColorStop:noop}),measureText:s=>({width:s.length*8})},{get:(obj,k)=>k in obj?obj[k]:noop});
const element=()=>({getContext:()=>paint,classList:{add:noop,remove:noop,toggle:noop},style:{},setAttribute:noop,appendChild:noop,addEventListener:noop,remove:noop,children:[]});
const storage=new Map();
const context=vm.createContext({THREE,console,performance,Date,Math,Map,Set,Uint8Array,Uint8ClampedArray,Float32Array,URLSearchParams,setTimeout:()=>0,clearTimeout:noop,requestAnimationFrame:()=>0,
  document:{readyState:'loading',hidden:false,createElement:element,getElementById:element,addEventListener:noop,body:element()},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},location:{search:'',pathname:'/'}});
context.window=context;
for(const file of ['data','util','geography','terrain','circulation','fine-build','world','places','worldgen','models','vehicle-models','audio','entities','advanced','combat','player','game'])vm.runInContext(fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'),context,{filename:file+'.js'});
const MW=context.MW;
function game(meta={}) {
  const g=Object.create(MW.Game.prototype);
  Object.assign(g,{scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),world:new MW.VoxelWorld({bounds:200,spawn:[0,0,0],...meta}),settings:{...MW.DEFAULT_SETTINGS},time:0,mode:'explore',state:'playing',season:'summer',keys:{},travelBounds:16000,bounds:200,
    ui:new Proxy({toast:noop},{get:(o,k)=>o[k]||noop}),zombies:[],soldiers:[],ships:[],vehicles:[],doors:[],projectiles:[],pickups:[],mines:[],notes:[],zones:[],labels:[],inVehicle:null,paused:false,combatPaused:false,
    closeAllPanels:noop,shake:noop,saveLater:noop,checkVictory:noop,updateLabels:noop,updateDanger:noop,setMode(mode){this.mode=mode;}});
  g.player=new MW.Player(g);g.player.pos.set(0,0,0);g.player.spawnPoint.copy(g.player.pos);g.combat=new MW.Combat(g);g.advanced=new MW.Advanced(g);
  return g;
}
function finite(v){return [v.x,v.y,v.z].every(Number.isFinite);}

test('all upgraded vehicles have finite geometry, separate animation pivots and a cheaper LOD',()=>{
  for(const type of ['car','apc','tank','jet','boat','warship','drone','train','carrier','mech','aa']){
    const model=MW.Models.vehicle(type);assert.equal(model.group.isLOD,true,type);
    let near=0,far=0;
    model.body.traverse(o=>{if(o.isMesh){near++;assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite),type);}});
    model.group.levels[1].object.traverse(o=>{if(o.isMesh)far++;});
    assert.ok(near>far,type);assert.ok(near<65,type+' draw-call budget');
    const box=new THREE.Box3().setFromObject(model.group),size=box.getSize(new THREE.Vector3());
    assert.ok(finite(size)&&size.x>0&&size.y>0&&size.z>0,type);
    MW.Models.animateVehicle(model,0.1,10,1);MW.Models.disposeVehicle(model);
  }
});
test('zombies pursue the player without NaN positions at different simulation rates',()=>{
  for(const hz of [30,60,120]){
    const g=game();g.player.pos.set(12,0,0);
    const zombie=new MW.Entities.Zombie(g,0,0,0);g.zombies.push(zombie);
    for(let i=0;i<hz;i++)zombie.update(1/hz);
    assert.ok(finite(zombie.pos));assert.ok(zombie.pos.x>1);assert.ok(zombie.pos.x<4);
  }
});
test('support caps, hold/follow orders and complete recall are enforced',()=>{
  const g=game();for(let i=0;i<5;i++)g.advanced.deploy('drone');
  assert.equal(g.advanced.units.length,12);
  g.advanced.command('hold');assert.equal(g.advanced.order,'hold');
  const before=g.advanced.units[0].anchor.clone();g.player.pos.x+=100;
  g.advanced.update(0.2);assert.equal(g.advanced.units[0].anchor.x,before.x);
  g.advanced.command('follow');g.advanced.update(0.2);
  assert.ok(g.advanced.units.every(u=>finite(u.pos)));
  g.advanced.recall();assert.equal(g.advanced.units.length,0);
});
test('air-defence exercise is opt-in, bounded and missiles intercept actual targets',()=>{
  const g=game();assert.equal(g.advanced.units.length,0);
  g.advanced.deploy('aa');g.advanced.startExercise();g.advanced.startExercise();
  assert.equal(g.advanced.units.filter(u=>u.team==='enemy').length,3);
  for(let i=0;i<1500;i++){
    g.time+=1/60;g.advanced.update(1/60);
    for(let j=g.projectiles.length-1;j>=0;j--)g.projectiles[j].update(1/60);
    g.combat.update(1/60);
  }
  assert.ok(g.advanced.destroyed>0,'at least one airborne training target intercepted');
  assert.ok(g.projectiles.length<=60);assert.ok(g.combat.particles.length<=220);
});
test('support explosions spare the player and transport while damaging hostile machines',()=>{
  const g=game();g.advanced.startExercise();const enemy=g.advanced.units.find(u=>u.team==='enemy');
  enemy.pos.set(2,0,0);const health=g.player.health,hp=enemy.hp;
  g.combat.explode(new THREE.Vector3(2,0,0),6,60,{source:'support'});
  assert.equal(g.player.health,health);assert.ok(enemy.hp<hp);
});
test('rail service moves, accepts a passenger, brakes and exits cleanly',()=>{
  const g=game({advanced:{rail:[[0,0],[60,0],[60,60],[0,60]]}}),train=g.advanced.train;
  assert.ok(train);train.enter();train.wait=0;
  for(let i=0;i<180;i++)train.update(1/60);
  assert.ok(train.travel>20);assert.equal(g.inVehicle,train);assert.ok(finite(train.pos));
  const speed=train.currentSpeed;g.keys.space=true;for(let i=0;i<60;i++)train.update(1/60);
  assert.ok(train.currentSpeed<speed);train.exit();assert.equal(g.inVehicle,null);assert.ok(finite(g.player.pos));
  train.dispose();
});
test('carrier validates water, has a walkable deck and launches a controllable jet',()=>{
  const g=game({waterLevel:4,advanced:{carrier:[0,90]}});
  assert.ok(g.advanced.carrier);const c=g.advanced.carrier;
  assert.equal(g.advanced.groundAt(c.pos.x,c.pos.z),c.deck);
  assert.ok(g.advanced.collidesBox(c.pos.x,c.deck-0.1,c.pos.z,0.3,1.8));
  assert.equal(g.advanced.collidesBox(c.pos.x,c.deck+0.01,c.pos.z,0.3,1.8),false);
  g.advanced.launchJet();assert.equal(g.inVehicle.type,'jet');assert.ok(g.inVehicle.airSpeed>0);
  for(let i=0;i<90;i++)g.inVehicle?.update(1/60);
  assert.ok(g.inVehicle&&!g.inVehicle.dead,'launched jet remains airborne');
  assert.ok(finite(g.player.pos));
});
test('projectiles honour zero damage and zero gravity and remain finite',()=>{
  const g=game();const p=new MW.Entities.Projectile(g,new THREE.Vector3(0,30,0),new THREE.Vector3(0,0,-20),{type:'missile',damage:0,gravity:0});
  g.projectiles.push(p);p.update(0.1);assert.equal(p.damage,0);assert.equal(p.vel.y,0);assert.ok(finite(p.pos));
});
test('particle and tracer resources are bounded under sustained firing',()=>{
  const g=game();const p=new THREE.Vector3(0,3,0);
  for(let i=0;i<500;i++){g.combat.spawnParticle(p,p,0xffffff,0.02,1);g.combat.tracer(p,p,0xffffff,0.02);}
  assert.equal(g.combat.particles.length,220);assert.equal(g.combat.tracers.length,96);
  g.combat.update(0.1);assert.equal(g.combat.particles.length,0);assert.equal(g.combat.tracers.length,0);assert.equal(g.combat.pool.length,220);
});

test('global travel respects the shorter north/south boundary and preserves valid underwater positions',()=>{
  const g=game({fallbackY:-128,waterLevel:0.25});g.travelBoundsZ=8000;
  const before=g.player.pos.clone();g.travelTo({name:'invalid pole',x:10,z:9000});assert.ok(g.player.pos.equals(before));
  g.travelTo({name:'valid',x:20,z:7000});assert.equal(g.player.pos.z,7000);
  g.player.pos.set(2,-40,7999.9);g.player.vel.set(0,0,20);g.player.update(1/60,{s:true});
  assert.ok(g.player.pos.y < -18,'underwater exploration does not trigger the legacy -18m reset');
  assert.ok(g.player.pos.z<=8000);
  g.player.pos.y=-200;g.player.update(1/60,{});assert.ok(g.player.pos.y>=g.world.fallbackY,'invalid depth recovers to a safe surface');
});
test('malformed or oversized imported rail metadata is ignored without constructing unbounded geometry',()=>{
  for(const rail of [[[0,0],[0,0]],[[NaN,0],[1,1]],[[0,0],[Infinity,1]],[[0,0],[15000,15000]],[null,[0,0]]]){
    const g=game({advanced:{rail}});assert.equal(g.advanced.train,null);
  }
  const valid=game({advanced:{rail:[[0,0],[0,0],[20,0]]}});assert.ok(valid.advanced.train);assert.ok(finite(valid.advanced.train.pos));
});
test('recall marks targets inactive and removes outstanding interception missiles',()=>{
  const g=game();g.advanced.deploy('aa');g.advanced.startExercise();
  const unit=g.advanced.units.find(u=>u.team==='enemy');g.advanced.launch(new THREE.Vector3(0,4,0),unit,'support');
  assert.equal(g.projectiles.length,1);g.advanced.recall();assert.equal(unit.dead,true);assert.equal(g.projectiles.length,0);
});

test('train passenger height is stable and blocked exits keep the passenger safely aboard',()=>{
  const g=game({advanced:{rail:[[0,0],[60,0],[60,60],[0,60]]}}),train=g.advanced.train;
  train.enter();train.update(0);const seatY=g.player.pos.y;g.player.update(1/60,{});assert.equal(g.player.pos.y,seatY);
  const collision=g.world.collidesBox;g.world.collidesBox=()=>true;
  assert.equal(train.exit(),false);assert.equal(g.inVehicle,train);assert.ok(finite(g.player.pos));
  g.world.collidesBox=collision;assert.equal(train.exit(),true);assert.equal(g.inVehicle,null);
});
