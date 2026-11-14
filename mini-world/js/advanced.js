/* Bounded sandbox systems: rail transport, cooperative machines, drone formations,
   interception and carrier operations. Combat remains a fictional training game. */
(function () {
  'use strict';
  const MW = window.MW, V = THREE.Vector3;
  const clamp = MW.clamp;

  class Machine {
    constructor(system, type, position, team) {
      this.system = system; this.game = system.game; this.type = type; this.team = team || 'friendly';
      this.pos = position.clone(); this.anchor = position.clone();
      this.model = MW.Models.vehicle(type); this.model.group.position.copy(this.pos);
      this.game.scene.add(this.model.group);
      this.radius = type === 'mech' ? 0.85 : 1.1; this.height = type === 'mech' ? 3.3 : type === 'aa' ? 2.3 : 0.6;
      this.hp = this.maxHp = type === 'mech' ? 450 : type === 'aa' ? 600 : 140;
      this.dead = false; this.cooldown = 0; this.scanTimer = 0; this.target = null;
      this.index = system.sequence++; this.phase = this.index * 2.4; this.speed = 0;
      this.bar = MW.makeHealthBar(this.team === 'enemy' ? 0xff695d : 0x64dfd5);
      this.bar.position.y = this.height + 0.7; this.model.group.add(this.bar);
    }
    center() { return this.pos.clone().add(new V(0, this.height * 0.5, 0)); }
    damage(amount) {
      if (this.dead || amount <= 0) return;
      this.hp -= amount;
      if (this.hp > 0) return;
      this.dead = true;
      this.game.combat.explode(this.center(), 3.5, 0, { source: 'support', visualOnly: true });
      this.game.scene.remove(this.model.group); MW.Models.disposeVehicle(this.model);
      if (this.team === 'enemy') { this.system.destroyed++; this.game.addCoins(25); this.game.ui.toast('演练目标已击落 · +25 金币', 'good'); }
    }
    update(dt) {
      if (this.dead) return;
      const g = this.game, sys = this.system, distance = this.pos.distanceTo(g.player.pos);
      this.model.group.visible = distance < 1500;
      if (distance > 1600) return; // Far units sleep; the simulated population is bounded.
      this.cooldown = Math.max(0, this.cooldown - dt); this.scanTimer -= dt; this.phase += dt;
      const air = this.type === 'drone';
      if (this.scanTimer <= 0) {
        this.scanTimer = 0.2; this.target = sys.targetFor(this);
      }
      let destination = this.anchor;
      if (this.team === 'friendly' && sys.order === 'follow' && this.type !== 'aa') {
        const a = this.index * 2.39996 + (air ? g.time * 0.13 : 0);
        destination = g.player.pos.clone().add(new V(Math.cos(a) * (air ? 11 : 7), 0, Math.sin(a) * (air ? 11 : 7)));
      } else if (this.team === 'enemy') {
        destination = this.anchor.clone().add(new V(Math.sin(this.phase * 0.35) * 18, 0, Math.cos(this.phase * 0.35) * 18));
      }
      if (this.type !== 'aa') {
        const dx = destination.x-this.pos.x, dz = destination.z-this.pos.z, dist = Math.hypot(dx,dz);
        const speed = air ? 15 : 4.2, step = Math.min(dist, speed * dt);
        this.speed = dist > 1 ? speed : 0;
        if (dist > 1) {
          const nx = clamp(this.pos.x+dx/dist*step,-g.travelBounds,g.travelBounds);
          const zBounds = g.travelBoundsZ || g.travelBounds;
          const nz = clamp(this.pos.z+dz/dist*step,-zBounds,zBounds);
          if (air) {
            const y = Math.max(g.world.surfaceAt(nx,nz) + 12, g.player.pos.y + (this.team === 'enemy' ? 24 : 10));
            this.pos.y += (y-this.pos.y)*Math.min(1,dt*2);
            if (!g.world.collidesBox(nx,this.pos.y,nz,1,0.8)) { this.pos.x=nx; this.pos.z=nz; }
          } else {
            const y = g.world.surfaceAt(nx,nz);
            if (Math.abs(y-this.pos.y)<1.2 && !g.world.collidesBox(nx,y+0.05,nz,0.7,3.3) && !g.collidesDoor(nx,y+0.05,nz,0.7,3.3)) this.pos.set(nx,y,nz);
          }
          this.model.group.rotation.y = Math.atan2(-dx,-dz);
        }
      }
      if (air) for (let i=0;i<this.model.wheels.length;i++) this.model.wheels[i].rotation.y += dt*32*(i%2 ? -1:1);
      MW.Models.animateVehicle(this.model, dt, this.speed, g.time);
      if (this.target && !this.target.dead && this.cooldown <= 0 && g.mode === 'combat' && !g.combatPaused) {
        const origin = this.center(), target = this.target.pos.clone().add(new V(0,(this.target.height || 2)*0.5,0));
        if (!g.world.lineBlocked(origin,target) && !g.doorLineBlocked(origin,target)) {
          if (this.type === 'aa') {
            sys.launch(origin.add(new V(0,2,0)),this.target,'support'); this.cooldown=2.8;
          } else {
            g.combat.tracer(origin,target,this.team === 'enemy' ? 0xff7868 : 0x6be5ff,0.12,true);
            if (this.target.damage) this.target.damage(this.team === 'enemy' ? 3 : air ? 14 : 32, { sourcePos: this.pos });
            else if (this.target.hit) this.target.hit(air ? 14:32,target.sub(origin).normalize());
            MW.SFX.at(this.pos,()=>MW.SFX.shoot('laser',true)); this.cooldown=air ? 0.85 : 1.25;
          }
        }
      }
      this.model.group.position.copy(this.pos);
      this.bar.visible = distance<90 && (this.hp<this.maxHp || this.team==='enemy');
      this.bar.userData.fill.scale.x = Math.max(0.001,this.hp/this.maxHp);
      this.bar.quaternion.copy(g.camera.quaternion);
    }
  }

  class RailService {
    constructor(system, points) {
      this.system=system; this.game=system.game; this.type='train'; this.name='环线列车';
      this.points=points.map(p=>new V(p[0],this.game.world.surfaceAt(p[0],p[1]),p[1]));
      this.segments=[]; this.length=0;
      for(let i=0;i<this.points.length;i++) {
        const a=this.points[i],b=this.points[(i+1)%this.points.length], length=a.distanceTo(b);
        if(length>0.1) { this.segments.push({a,b,length,start:this.length}); this.length+=length; }
      }
      this.model=MW.Models.vehicle('train'); this.pos=this.points[0].clone(); this.yaw=0;
      this.game.scene.add(this.model.group); this.dead=false; this.speed=24; this.currentSpeed=0;
      this.radius=1.6; this.maxHp=this.hp=2000; this.fpv=false; this.driver=null; this.travel=0; this.wait=4;
      this.seatHeight=2.6;
      this.cars=[MW.Models.vehicle('train'),MW.Models.vehicle('train')]; this.cars.forEach(m=>this.game.scene.add(m.group));
      const positions=[];
      for(const segment of this.segments) {
        const n=Math.max(1,Math.ceil(segment.length/4));
        const dx=segment.b.x-segment.a.x,dz=segment.b.z-segment.a.z,len=Math.hypot(dx,dz)||1;
        for(let i=0;i<n;i++) for(const offset of [-0.78,0.78]) {
          for(const t of [i/n,(i+1)/n]) {
            const x=MW.lerp(segment.a.x,segment.b.x,t)+dz/len*offset;
            const z=MW.lerp(segment.a.z,segment.b.z,t)-dx/len*offset;
            positions.push(x,this.game.world.surfaceAt(x,z)+0.10,z);
          }
        }
      }
      this.track=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3)),new THREE.LineBasicMaterial({color:0x8eabb9}));
      this.game.scene.add(this.track); this.update(0);
    }
    sample(distance) {
      distance=((distance%this.length)+this.length)%this.length;
      const s=this.segments.find(s=>distance<s.start+s.length)||this.segments[this.segments.length-1];
      const pos=s.a.clone().lerp(s.b,(distance-s.start)/s.length); pos.y=this.game.world.surfaceAt(pos.x,pos.z)+0.03;
      return {pos,yaw:Math.atan2(s.a.x-s.b.x,s.a.z-s.b.z)};
    }
    update(dt) {
      const g=this.game;
      if(this.wait>0) { this.wait-=dt; this.currentSpeed=0; }
      else {
        const target=g.inVehicle===this && g.keys.space ? 0 : this.speed;
        this.currentSpeed=MW.lerp(this.currentSpeed,target,Math.min(1,dt*1.2));
        const before=Math.floor(this.travel/this.length); this.travel+=this.currentSpeed*dt;
        if(Math.floor(this.travel/this.length)!==before) this.wait=5;
      }
      const s=this.sample(this.travel); this.pos.copy(s.pos); this.yaw=s.yaw;
      this.model.group.position.copy(this.pos); this.model.group.rotation.y=this.yaw;
      MW.Models.animateVehicle(this.model,dt,this.currentSpeed,g.time);
      this.cars.forEach((car,i)=>{ const p=this.sample(this.travel-(i+1)*10.8); car.group.position.copy(p.pos); car.group.rotation.y=p.yaw; MW.Models.animateVehicle(car,dt,this.currentSpeed,g.time); });
      if(g.inVehicle===this) { g.player.pos.copy(this.pos).add(new V(0,2.6,0)); g.player.yaw=this.yaw; }
    }
    enter() {
      this.driver=this.game.player; this.game.inVehicle=this;
      this.game.player.pos.copy(this.pos).add(new V(0,2.6,0));
      this.game.player.vel.set(0,0,0);
      this.game.camera.position.copy(this.game.player.eyePos);
      this.game.world.prepareAt(this.pos.x,this.pos.z);
      this.game.ui.toast('已登上环线列车 · 自动巡航 · Space 刹车 · E 下车','good');
    }
    exit() {
      const g=this.game; let pos=null;
      search: for(const distance of [3.5,6,10,16]) for(const angle of [0,Math.PI,Math.PI/2,-Math.PI/2,Math.PI/4,-Math.PI/4]) {
        const x=this.pos.x+Math.cos(this.yaw+angle)*distance, z=this.pos.z-Math.sin(this.yaw+angle)*distance;
        if(Math.abs(x)>g.travelBounds-1 || Math.abs(z)>(g.travelBoundsZ || g.travelBounds)-1) continue;
        const y=g.world.surfaceAt(x,z)+0.06;
        if(g.world.meta.waterLevel!=null && y<g.world.meta.waterLevel+0.3) continue;
        if(Math.abs(y-this.pos.y)>4 || g.world.collidesBox(x,y,z,g.player.radius,g.player.height)
          || g.collidesDoor(x,y,z,g.player.radius,g.player.height)) continue;
        pos=new V(x,y,z); break search;
      }
      if(!pos) { g.ui.toast('车旁暂时没有安全落点，请到开阔处或车站下车','info'); return false; }
      g.inVehicle=null; this.driver=null;
      g.player.pos.copy(pos); g.player.vel.set(0,0,0); g.ui.updateVehicleHUD(null);
      return true;
    }
    fire() {}
    damage() {} // Public transport is a sandbox service, not a combat target.
    dispose() {
      for(const model of [this.model,...this.cars]) { this.game.scene.remove(model.group); MW.Models.disposeVehicle(model); }
      this.game.scene.remove(this.track); this.track.geometry.dispose(); this.track.material.dispose();
    }
  }

  class Advanced {
    constructor(game) {
      this.game=game; this.units=[]; this.order='follow'; this.sequence=0; this.destroyed=0; this.wave=0; this.train=null; this.carrier=null;
      const spec=game.world.meta.advanced || {};
      if(Array.isArray(spec.rail) && spec.rail.length>1 && spec.rail.length<=20) {
        // Imported metadata must not create degenerate routes or unbounded track geometry.
        const points=spec.rail.filter(p=>Array.isArray(p) && p.length>=2 && p.slice(0,2).every(Number.isFinite)
          && Math.abs(p[0])<=game.travelBounds && Math.abs(p[1])<=(game.travelBoundsZ || game.travelBounds));
        const length=points.reduce((total,p,i)=>total+Math.hypot(p[0]-points[(i+1)%points.length][0],p[1]-points[(i+1)%points.length][1]),0);
        if(points.length===spec.rail.length && length>1 && length<=30000) {
          this.train=new RailService(this,points); game.vehicles.push(this.train);
        }
      }
      if(spec.carrier) this.createCarrier(spec.carrier[0],spec.carrier[1]);
      this.statusTimer=0;
    }
    createCarrier(x,z) {
      const g=this.game, water=g.world.meta.waterLevel;
      if(water==null || !Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x)>g.travelBounds-30 || Math.abs(z)>(g.travelBoundsZ || g.travelBounds)-30) return false;
      // All four corners must be over water, so a carrier cannot cover a town.
      for(const dx of [-9,0,9]) for(const dz of [-25,0,25]) if(g.world.surfaceAt(x+dx,z+dz)>water+0.5) return false;
      const model=MW.Models.vehicle('carrier'), deck=Math.ceil(water+3.1), pos=new V(x,deck-3.04,z);
      model.group.position.copy(pos); g.scene.add(model.group); this.carrier={model,pos,deck}; return true;
    }
    findGround(offset, radius) {
      const g=this.game,p=g.player.pos;
      for(let i=0;i<24;i++) {
        const a=i*2.39996+offset, r=radius+Math.floor(i/8)*4;
        const x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r,y=g.world.surfaceAt(x,z);
        if(Math.abs(x)>g.travelBounds-4 || Math.abs(z)>(g.travelBoundsZ || g.travelBounds)-4) continue;
        if(g.world.meta.waterLevel!=null && y<g.world.meta.waterLevel+0.3) continue;
        if(Math.abs(y-p.y)>6 || g.world.collidesBox(x,y+0.05,z,1.5,4) || g.collidesDoor(x,y+0.05,z,1.5,4)) continue;
        if(this.units.some(u=>!u.dead&&u.pos.distanceTo(new V(x,y,z))<3)) continue;
        return new V(x,y,z);
      }
      return null;
    }
    deploy(type) {
      const alive=this.units.filter(u=>!u.dead&&u.team==='friendly');
      const count=type==='drone'?4:1;
      if(alive.length+count>12) return this.game.ui.toast('支援单位已达到 12 个上限，请先召回','info');
      let created=0;
      for(let i=0;i<count;i++) {
        let pos=this.findGround(this.sequence+i,7+i*2);
        if(type==='drone') { pos=pos||this.game.player.pos.clone(); pos.y=Math.max(pos.y,this.game.player.pos.y)+12; }
        if(pos) { this.units.push(new Machine(this,type,pos,'friendly')); created++; }
      }
      this.game.ui.toast(created?`已部署 ${created} 个${type==='drone'?'编队无人机':type==='aa'?'防空单元':'机械队员'}`:'附近没有足够的安全空地',created?'good':'info');
      this.render();
    }
    targetFor(unit) {
      const g=this.game;
      let best=null,bestD=unit.type==='aa'?190:85;
      const candidates=unit.team==='enemy'?[...this.units.filter(u=>u.team==='friendly'),g.player]:[...this.units.filter(u=>u.team==='enemy'),...g.zombies];
      for(const target of candidates) {
        if(target.dead || target.alive===false || (unit.type==='aa'&&target.type!=='drone')) continue;
        const d=unit.pos.distanceTo(target.pos); if(d<bestD) { best=target; bestD=d; }
      }
      return best;
    }
    launch(origin,target,source) {
      if(this.game.projectiles.length>=60) return;
      const dir=target.pos.clone().add(new V(0,(target.height||2)*0.5,0)).sub(origin).normalize();
      const missile=new MW.Entities.Projectile(this.game,origin,dir.multiplyScalar(55),{type:'missile',homing:target,source,fuse:7,radius:5,damage:140,gravity:0});
      missile.gravity=0; missile.advanced=true; this.game.projectiles.push(missile); MW.SFX.at(origin,()=>MW.SFX.shoot('missile',true));
    }
    startExercise() {
      if(this.units.some(u=>!u.dead&&u.team==='enemy')) return this.game.ui.toast('当前空防演练仍在进行','info');
      this.wave++; const p=this.game.player.pos;
      for(let i=0;i<3;i++) {
        const a=i*2.094+this.wave;
        const x=clamp(p.x+Math.cos(a)*65,-this.game.travelBounds+30,this.game.travelBounds-30);
        const zBounds=this.game.travelBoundsZ || this.game.travelBounds;
        const z=clamp(p.z+Math.sin(a)*65,-zBounds+30,zBounds-30);
        this.units.push(new Machine(this,'drone',new V(x,Math.max(p.y,this.game.world.surfaceAt(x,z))+27,z),'enemy'));
      }
      this.game.setMode('combat'); this.game.closeAllPanels(); this.game.ui.toast('空防演练开始：3 个空中目标 · 防空单元会自动拦截','info');
    }
    recall() {
      for(const unit of this.units) { unit.dead=true; this.game.scene.remove(unit.model.group); MW.Models.disposeVehicle(unit.model); }
      for(let i=this.game.projectiles.length-1;i>=0;i--) if(this.game.projectiles[i].advanced) this.game.projectiles[i].remove();
      this.units=[]; this.render(); this.game.ui.toast('机械单位已召回，演练已结束','info');
    }
    visitCarrier() {
      if(!this.carrier) {
        const p=this.game.player.pos;
        search: for(const radius of [100,250,500,1000]) for(let i=0;i<16;i++) {
          if(this.createCarrier(p.x+Math.cos(i*Math.PI/8)*radius,p.z+Math.sin(i*Math.PI/8)*radius)) break search;
        }
      }
      if(!this.carrier) return this.game.ui.toast('附近没有足够开阔的海域，请前往 Tokyo 或大陆海岸','info');
      const g=this.game,c=this.carrier;
      if(g.inVehicle) { g.inVehicle.exit(); if(g.inVehicle) return; }
      g.player.pos.set(c.pos.x-1.4,c.deck+0.08,c.pos.z+12); g.player.vel.set(0,0,0); g.player.yaw=0;
      g.camera.position.copy(g.player.eyePos); g.world.prepareAt(g.player.pos.x,g.player.pos.z);
      g.player.spawnProtect=5; g.closeAllPanels(); g.ui.toast('已抵达航母甲板 · U 打开指挥台可起飞舰载机','good');
    }
    launchJet() {
      if(!this.carrier) { this.visitCarrier(); if(!this.carrier) return; }
      const g=this.game,c=this.carrier;
      if(g.vehicles.filter(v=>!v.dead).length>=30) return g.ui.toast('载具已达上限，请使用已有载具','info');
      if(g.inVehicle) { g.inVehicle.exit(); if(g.inVehicle) return; }
      const jet=new MW.Entities.Vehicle(g,'jet',c.pos.x-1.4,c.pos.z-12,'舰载战斗机');
      jet.pos.y=c.deck+2; jet.yaw=0; jet.airSpeed=20; jet.currentSpeed=20; jet.throttle=1; jet.airborne=true;
      jet.model.group.position.copy(jet.pos); jet.model.group.rotation.y=0; g.vehicles.push(jet);
      jet.enter(); g.player.pitch=0.18; g.closeAllPanels();
      g.world.prepareAt(jet.pos.x,jet.pos.z);
      g.ui.toast('舰载机弹射起飞 · W/S 油门 · Space 爬升 · E 降落离机','good');
    }
    groundAt(x,z) {
      const c=this.carrier;
      return c&&Math.abs(x-c.pos.x)<6.7&&Math.abs(z-c.pos.z)<21?c.deck:null;
    }
    collidesBox(x,y,z,r,h) {
      const c=this.carrier;
      return !!(c&&Math.abs(x-c.pos.x)<6.7+r&&Math.abs(z-c.pos.z)<21+r&&y<c.deck-0.001&&y+h>c.deck-0.3);
    }
    update(dt) {
      for(const unit of this.units) unit.update(dt);
      this.units=this.units.filter(u=>!u.dead);
      if(this.carrier) MW.Models.animateVehicle(this.carrier.model,dt,0,this.game.time);
    }
    render() {
      const el=document.getElementById('operations-status'); if(!el) return;
      const friendly=this.units.filter(u=>!u.dead&&u.team==='friendly').length;
      const enemies=this.units.filter(u=>!u.dead&&u.team==='enemy').length;
      el.textContent=`友方 ${friendly}/12 · 空中目标 ${enemies} · 已击落 ${this.destroyed} · 指令：${this.order==='follow'?'跟随':'驻守'}`;
      const rail=document.getElementById('operations-rail'); if(rail) { rail.disabled=!this.train; rail.textContent=this.train?'搭乘环线列车':'此地图没有铁路'; }
    }
    command(action) {
      if(action==='drone'||action==='mech'||action==='aa') this.deploy(action);
      else if(action==='follow'||action==='hold') { this.order=action; this.units.forEach(u=>u.anchor.copy(u.pos)); this.render(); }
      else if(action==='exercise') this.startExercise();
      else if(action==='recall') this.recall();
      else if(action==='carrier') this.visitCarrier();
      else if(action==='jet') this.launchJet();
      else if(action==='train'&&this.train) { if(this.game.inVehicle) { this.game.inVehicle.exit(); if(this.game.inVehicle) return; } this.train.enter(); this.game.closeAllPanels(); }
    }
    dispose() {
      for(const unit of this.units) { unit.dead=true; this.game.scene.remove(unit.model.group); MW.Models.disposeVehicle(unit.model); }
      this.units=[];
      if(this.train) this.train.dispose();
      if(this.carrier) { this.game.scene.remove(this.carrier.model.group); MW.Models.disposeVehicle(this.carrier.model); }
    }
  }
  MW.Advanced=Advanced;
})();
