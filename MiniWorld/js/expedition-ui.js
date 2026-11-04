/* Atlas raster cost is fixed, regardless of the geographic extent of a world. */
(function () {
  'use strict';
  const MW=window.MW, UI=MW.UI.prototype, baseInit=UI.init;
  UI.init=function () {
    baseInit.call(this);
    for(const input of document.querySelectorAll('[id^="set-volume-"]')) input.addEventListener('input',()=>{
      document.getElementById(input.id.replace('set-volume-','volume-value-')).textContent=input.value+'%';
    });
    for(const button of document.querySelectorAll('[data-operation]')) button.addEventListener('click',()=>this.g.advanced?.command(button.dataset.operation));
  };
  UI.renderDestinations=function () {
    this.mapPan={x:0,y:0}; this.mapZoom=1; this.mapRaster=null;
    const host=this.$('atlas-destinations'); if(!host)return; host.replaceChildren();
    for(const destination of this.g.world?.meta.destinations || []) {
      const b=document.createElement('button'); b.className='btn ghost'; b.textContent=destination.name;
      b.addEventListener('click',()=>this.g.travelTo(destination)); host.appendChild(b);
    }
    const note=document.createElement('small'); note.textContent=this.g.world?.meta.terrain ? '米制程序化地形 · 点击地点快速旅行' : '点击“定位我”查看周边'; host.appendChild(note);
  };
  UI.requestMapDraw=function () {
    if(this.mapFrame)return;
    this.mapFrame=requestAnimationFrame(()=>{this.mapFrame=null;this.drawWorldMap();});
  };
  UI.zoomMapAt=function (nextZoom, anchorX, anchorY) {
    const canvas=this.$('world-map-canvas');if(!canvas)return;
    const oldZoom=this.mapZoom||1,limit=this.g.world?.meta.terrain?32768:12;
    nextZoom=MW.clamp(nextZoom,0.6,limit);
    const ratio=nextZoom/oldZoom,pan=this.mapPan||{x:0,y:0};
    const x=(anchorX==null?canvas.width/2:anchorX)-canvas.width/2;
    const y=(anchorY==null?canvas.height/2:anchorY)-canvas.height/2;
    // Keep the exact world coordinate under the pointer (or view centre).
    // This matters at continental coordinates, where an unchanged pan would
    // otherwise send a centred player thousands of kilometres off screen.
    this.mapPan={x:x-(x-pan.x)*ratio,y:y-(y-pan.y)*ratio};
    this.mapZoom=nextZoom;this.requestMapDraw();
  };
  UI.bindMapEvents=function () {
    const canvas=this.$('world-map-canvas'); if(!canvas)return;
    if(this.boundMapCanvas===canvas)return;
    this.boundMapCanvas=canvas;
    const maxZoom=()=>this.g.world?.meta.terrain ? 32768 : 12;
    let dragging=false,lx=0,ly=0;
    canvas.addEventListener('wheel',e=>{
      e.preventDefault();
      const rect=canvas.getBoundingClientRect();
      const unit=e.deltaMode===1?16:e.deltaMode===2?rect.height:1;
      this.zoomMapAt((this.mapZoom||1)*Math.exp(-e.deltaY*unit*0.0012),
        (e.clientX-rect.left)*canvas.width/Math.max(1,rect.width),
        (e.clientY-rect.top)*canvas.height/Math.max(1,rect.height));
    },{passive:false});
    canvas.addEventListener('pointerdown',e=>{dragging=true;lx=e.clientX;ly=e.clientY;canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{
      if(!dragging)return;
      const rect=canvas.getBoundingClientRect();
      this.mapPan=this.mapPan||{x:0,y:0};
      this.mapPan.x+=(e.clientX-lx)*canvas.width/Math.max(1,rect.width);
      this.mapPan.y+=(e.clientY-ly)*canvas.height/Math.max(1,rect.height);
      lx=e.clientX;ly=e.clientY;this.requestMapDraw();
    });
    for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{dragging=false;});
    this.$('map-zoom-in')?.addEventListener('click',()=>this.zoomMapAt((this.mapZoom||1)*1.5));
    this.$('map-zoom-out')?.addEventListener('click',()=>this.zoomMapAt((this.mapZoom||1)/1.5));
    this.$('map-reset')?.addEventListener('click',()=>{this.mapZoom=1;this.mapPan={x:0,y:0};this.requestMapDraw();});
    this.$('map-center')?.addEventListener('click',()=>{
      const g=this.g;if(!g.world||!g.player)return;
      const bounds=g.world.meta.mapBounds||g.world.meta.travelBounds||g.world.meta.bounds||74;
      this.mapZoom=MW.clamp(bounds/(g.world.meta.terrain?600:90),1,maxZoom());
      const scale=(Math.min(canvas.width,canvas.height)-42)/(2*bounds+2)*this.mapZoom;
      this.mapPan={x:-g.player.pos.x*scale,y:-g.player.pos.z*scale};this.requestMapDraw();
    });
  };
  UI.drawWorldMap=function () {
    const g=this.g,canvas=this.$('world-map-canvas');if(!g.world||!g.player||!canvas)return;
    const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height,w=g.world;
    const bounds=w.meta.mapBounds||w.meta.travelBounds||w.meta.bounds||74;
    this.mapZoom=this.mapZoom||1;this.mapPan=this.mapPan||{x:0,y:0};
    const scale=(Math.min(W,H)-42)/(2*bounds+2)*this.mapZoom,cx=W/2+this.mapPan.x,cy=H/2+this.mapPan.y;
    const key=[w.meta.id,w.blockCount,w.revision||0,scale,cx,cy].join(':');
    if(!this.mapRaster||this.mapRaster.world!==w||this.mapRaster.key!==key) {
      const raster=document.createElement('canvas');raster.width=raster.height=192;
      const rc=raster.getContext('2d'),img=rc.createImageData(192,192);
      for(let iz=0;iz<192;iz++)for(let ix=0;ix<192;ix++) {
        const x=((ix+0.5)*W/192-cx)/scale,z=((iz+0.5)*H/192-cy)/scale;
        const outside=w.meta.terrain&&(Math.abs(x)>(w.meta.travelBounds||w.meta.bounds)||Math.abs(z)>(w.meta.travelBoundsZ||w.meta.travelBounds||w.meta.bounds));
        const top=outside?null:(w.mapSampleAt?w.mapSampleAt(x,z):w.topBlock(x,z));
        const c=outside?0x081925:(top?.c??(w.meta.waterLevel!=null?0x214d66:w.meta.fallbackColor??0x648f62)),i=(iz*192+ix)*4;
        img.data[i]=(c>>16)&255;img.data[i+1]=(c>>8)&255;img.data[i+2]=c&255;img.data[i+3]=255;
      }
      rc.putImageData(img,0,0);this.mapRaster={world:w,key,canvas:raster};
    }
    ctx.clearRect(0,0,W,H);ctx.imageSmoothingEnabled=true;ctx.drawImage(this.mapRaster.canvas,0,0,W,H);
    const point=(x,z)=>[cx+x*scale,cy+z*scale];
    const dot=(x,z,color,r)=>{const [sx,sy]=point(x,z);ctx.fillStyle=color;ctx.beginPath();ctx.arc(sx,sy,r,0,Math.PI*2);ctx.fill();};
    for(const zone of g.zones){const [x,z]=point(zone.def.x,zone.def.z),r=Math.max(5,zone.def.r*scale);ctx.strokeStyle=zone.captured?'#67d391':'#ffd193';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,z,r,0,Math.PI*2);ctx.stroke();}
    for(const v of g.vehicles)if(!v.dead)dot(v.pos.x,v.pos.z,'#ffe2a1',3);
    for(const s of g.ships)if(!s.dead)dot(s.pos.x,s.pos.z,'#ff695d',4);
    for(const u of g.advanced?.units||[])if(!u.dead)dot(u.pos.x,u.pos.z,u.team==='enemy'?'#ff695d':'#67e1da',3);
    for(const destination of w.meta.destinations||[]) {
      const [x,y]=point(destination.x,destination.z);if(x<10||x>W-10||y<15||y>H-10)continue;
      dot(destination.x,destination.z,'#f3e6bf',3);ctx.font='13px sans-serif';ctx.lineWidth=3;ctx.strokeStyle='#10242e';ctx.strokeText(destination.name,x+7,y-6);ctx.fillStyle='#fff4da';ctx.fillText(destination.name,x+7,y-6);
    }
    const [px,pz]=point(g.player.pos.x,g.player.pos.z);
    ctx.save();ctx.translate(px,pz);ctx.rotate(-g.player.yaw);ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(6,7);ctx.lineTo(0,4);ctx.lineTo(-6,7);ctx.closePath();ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle='#103344';ctx.lineWidth=2;ctx.stroke();ctx.restore();
    ctx.fillStyle='rgba(8,22,31,.82)';ctx.fillRect(14,14,Math.min(450,W-28),61);ctx.fillStyle='#e6f3f2';ctx.font='bold 16px sans-serif';ctx.fillText(w.meta.name||'世界',26,38);
    ctx.font='12px monospace';ctx.fillStyle='#b6cfd0';const span=W/scale;
    ctx.fillText(`${Math.round(g.player.pos.x)}, ${Math.round(g.player.pos.z)} m · 视野 ${span>=1000?(span/1000).toFixed(1)+' km':Math.round(span)+' m'}`,26,60);
  };
})();
