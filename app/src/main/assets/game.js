import * as T from './vendor/three.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {RoomEnvironment} from './vendor/RoomEnvironment.js';
import {buildWorld,clamp,pond,random,river,rooms,sanctuary} from './world.js';
import {addWater,plantForest} from './nature.js';
import {walking} from './walk.js';
import {addAnimals} from './animals.js';
import {templeLighting} from './temple-time.js';
import {addMonk,bellPlan,malletAngle} from './monk.js';
import {aquaticLife} from './fish.js';
import {nightLanterns} from './lanterns.js';
import {streamLife} from './stream-life.js';

const $=id=>document.getElementById(id);
const canvas=$('map');
const direction=new T.Vector3(-.51,.74,.43).normalize();
const keys=new Set();
const audio=Object.fromEntries(['bell','moktak','door','water','dawn-birds'].map(n=>[n,new Audio('./'+n+'.ogg')]));
for(const [key,vol] of Object.entries({bell:.81,moktak:.64,door:.41,water:.12}))audio[key].volume=vol;
audio.water.loop=true;
const dawnBirds=audio['dawn-birds'];
dawnBirds.loop=true;dawnBirds.volume=0;
let world,walk,renderer,scene,camera,water,smoke,animals,wake,monk,fish,lightCycle,skyDome,lanternCycle,stream;
let muted=false,audioStarted=false,started=false,running=false,request=0,previous=0;
let hallLights=[],hallLighting=false,doorShadowPending=false;
const renderBudgets=[500000,360000,256000,180000];
let renderLevel=0,frameCount=0,frameTotal=0,fastWindows=0;
let dragMove=null,dragLook=null,moveOrigin=[0,0],lookOrigin=[0,0],stick=[0,0];
let active=null,lastActionText='',lastSite='',feedbackUntil=0,bellAt=-Infinity,incenseAt=-Infinity;
const rotation=new T.Euler(0,0,0,'YXZ');
const rng=random(3111);
let selectedPet=null,bookPage=1,shownMinute=-1,bellContext,bellBuffer,bellMaster,bellPan;
const bellVoices=Array.from({length:6},()=>new Audio('./bell.ogg'));
let voice=0;

function enableBellAudio(){
 if(muted)return;
 const AudioEngine=window.AudioContext||window.webkitAudioContext;
 if(!AudioEngine)return;
 if(!bellContext){
   try{
     bellContext=new AudioEngine();
     bellMaster=bellContext.createGain();
     bellMaster.connect(bellContext.destination);
     bellPan=bellContext.createStereoPanner();
     bellPan.connect(bellMaster);
     fetch('./bell.ogg').then(r=>r.arrayBuffer()).then(b=>bellContext.decodeAudioData(b))
       .then(b=>{bellBuffer=b;}).catch(()=>{});
   }catch{}
 }
 if(bellContext?.state==='suspended')bellContext.resume().catch(()=>{});
}
function strikeSound(){
 if(muted)return;
 const p=walk.player;
 const dist=Math.hypot(p.x-10.5,p.z-5);
 const volume=(walk.room()?.72:1)*.83/(1+dist*.025+dist*dist*.00071);
 if(bellBuffer&&bellContext.state==='running'){
   const clip=bellContext.createBufferSource(),gain=bellContext.createGain();
   clip.buffer=bellBuffer;gain.gain.value=volume;
   const side=((10.5-p.x)*Math.cos(p.yaw)+(5-p.z)*Math.sin(p.yaw))/Math.max(2,dist);
   if(bellPan){
     bellPan.pan.setTargetAtTime(clamp(side*.76,-.76,.76),bellContext.currentTime,.08);
     clip.connect(gain).connect(bellPan);
   }else clip.connect(gain).connect(bellMaster);
   clip.start();
   clip.onended=()=>{clip.disconnect();gain.disconnect();};
 }else{
   const item=bellVoices[voice++%bellVoices.length];
   item.currentTime=0;item.volume=volume;
   item.play().catch(()=>{});
 }
}
function showBook(page){
 bookPage=page;
 $('bookImage').src='./sutra-'+page+'.jpg';
 $('bookImage').alt=page===1?'묘법연화경 권2의 변상도와 권수':'묘법연화경 권2의 펼친 면';
 $('bookPage').textContent=page+' / 2';
 $('bookPrevious').disabled=page===1;
 $('bookNext').disabled=page===2;
}
function finishPet(kind){
 if(selectedPet&&kind){
   const result=animals.interact(selectedPet,kind,walk.player);
   if(result)report(result);
 }
 selectedPet=null;$('pet').hidden=true;
}


function modalOpen(){return !$('guide').hidden||!$('book').hidden||!$('pet').hidden;}
function neutral(){
 dragMove=dragLook=null;stick=[0,0];keys.clear();
 for(const key of ['left','top','bottom'])$('stick').style[key]='';
 $('knob').style.transform='';
}
function sound(name){
 if(muted)return;
 const item=audio[name];item.currentTime=0;
 item.play().catch(()=>{});
}
function ambient(){
 enableBellAudio();
 if(muted||audioStarted)return;
 audioStarted=true;
 audio.water.play().catch(()=>{audioStarted=false;});
 dawnBirds.play().catch(()=>{});
}
function report(text){
 $('status').textContent=text;$('status').hidden=false;
 feedbackUntil=performance.now()+2250;
}
function actionLabel(a){
 if(a.id.startsWith('door:'))return walk.states.get(a.room).open?'미닫이문 닫기':'미닫이문 열기';
 if(a.id==='lamp'&&world.flames.visible)return '촛불 끄기';
 return a.name;
}
function use(){
 if(!active||modalOpen())return;
 ambient();
 const a=active;
 const now=performance.now();
 if(a.id.startsWith('door:')){
   if(!walk.toggleDoor(a.room)){report('문에서 한 걸음 물러나 주세요.');return;}
   sound('door');
 }else if(a.id==='bell'){
   if(bellPlan(Date.now())?.phase==='ring'){report('스님이 범종을 울리고 있습니다.');return;}
   bellAt=now;strikeSound();report('범종을 울렸습니다.');
 }else if(a.id==='moktak'){
   sound('moktak');report('목탁을 두드렸습니다.');
 }else if(a.id==='lamp'){
   world.flames.visible=!world.flames.visible;
   report(world.flames.visible?'촛불을 밝혔습니다.':'촛불을 껐습니다.');
 }else if(a.id==='incense'){
   incenseAt=now;world.incense.visible=true;
   report('향을 피웠습니다.');
 }else if(a.id==='read'){
   neutral();showBook(1);$('book').hidden=false;
 }else if(a.id.startsWith('pet:')){
   neutral();selectedPet=a.id.slice(4);
   $('petTitle').textContent=selectedPet==='dog'?'진돗개':'고양이';
   $('pet').hidden=false;
 }else if(a.id==='bedding'){
   report('돗자리 위에 요와 접은 이불이 놓여 있습니다.');
 }else if(a.id==='tea'){
   report('낮은 상에 찻주전자와 잔 두 개가 놓여 있습니다.');
 }
}
function labelSite(player,room,wet){
 if(room)return room.name+' 내부';
 if(wet!==null)return wet>0?'연꽃 연못 물속':'계곡 물속';
 const {x,z}=player;
 if(z>20.0)return '사찰로 오르는 산길';
 if(z>14.9&&Math.abs(x+4)<6.4)return '일주문';
 if(x<-17.3&&x>-23&&z>-7.8&&z<-1.5)return '요사채 뒷마당';
 if(Math.hypot(x-pond.x,(z-pond.z)*1.14)<5.43)return '연꽃 연못';
 if(Math.abs(x-10.5)<3.7&&Math.abs(z-5)<3.8)return '범종각';
 if(Math.abs(x+4)<4.9&&Math.abs(z+2.4)<5.6)return '삼층석탑 마당';
 if(Math.abs(x-sanctuary.x)<sanctuary.w*.51&&z<-6&&z>sanctuary.z)return '대웅전 앞';
 if(Math.abs(x-river(z))<11)return '계곡 산책로';
 return '운림사 마당';
}

function waterWake(scene){
 const shape=new T.RingGeometry(.93,1,48).rotateX(-Math.PI/2);
 const circles=Array.from({length:10},()=>{
   const material=new T.MeshBasicMaterial({color:'#c3ddd3',transparent:true,depthWrite:false,opacity:0,side:T.DoubleSide});
   const ring=new T.Mesh(shape,material);
   ring.visible=false;ring.renderOrder=4;scene.add(ring);
   return {ring,age:1.5};
 });
 let next=0,traveled=0;
 return (dt,x,z,level,distance)=>{
   if(level===null)traveled=0;
   else if((traveled+=distance)>.34){
     traveled=0;
     const wave=circles[next++%circles.length];
     wave.age=0;
     wave.ring.position.set(x,level+.012,z);
     wave.ring.visible=true;
   }
   for(const wave of circles){
     if(!wave.ring.visible)continue;
     wave.age+=dt;
     wave.ring.scale.setScalar(.106+wave.age*.55);
     wave.ring.material.opacity=.25*Math.max(0,1-wave.age/1.30)**1.7;
     wave.ring.visible=wave.age<1.30;
   }
 };
}

function createSmoke(){
 const c=document.createElement('canvas');c.width=c.height=64;
 const ctx=c.getContext('2d');
 const g=ctx.createRadialGradient(32,31,2,32,32,30);
 g.addColorStop(0,'rgba(218,216,201,.64)');
 g.addColorStop(.48,'rgba(216,211,196,.36)');
 g.addColorStop(1,'rgba(210,207,185,0)');
 ctx.fillStyle=g;ctx.fillRect(0,0,64,64);
 const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;
 return Array.from({length:15},()=>{
   const m=new T.SpriteMaterial({map,transparent:true,depthWrite:false,opacity:0,fog:true});
   const sprite=new T.Sprite(m);sprite.visible=false;scene.add(sprite);return sprite;
 });
}
function animateSmoke(age){
 for(let i=0;i<smoke.length;i++){
   const s=smoke[i],t=(age+i*.27)%4.05/4.05;
   s.visible=age>0&&age<27;
   if(!s.visible)continue;
   const size=.07+t*.29;
   s.material.opacity=Math.sin(Math.PI*t)*.20*clamp(age*.55,0,1)*clamp((27-age)*.75,0,1);
   s.position.copy(world.smokeOrigin);
   s.position.x+=Math.sin(t*8+age*.75)*(.017+t*.15);
   s.position.z+=Math.sin(t*9+age*.92)*(.012+t*.15);
   s.position.y+=.11+t*1.04;
   s.scale.set(size*.76,size,1);
   s.material.rotation=age*.24+i*.59;
 }
}
function sky(){
 const sky=new T.Mesh(new T.SphereGeometry(149,28,14),new T.ShaderMaterial({
   side:T.BackSide,depthWrite:false,uniforms:{sun:{value:direction.clone()},daylight:{value:1},night:{value:0},twilight:{value:0}},
   vertexShader:`
     varying vec3 dome;
     void main(){
       dome=normalize(position);
       gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
     }`,
   fragmentShader:`
     uniform vec3 sun;
     uniform float daylight,night,twilight;
     varying vec3 dome;
     float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
     float noise(vec2 p){
       vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
       return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
     }
     void main(){
       vec3 d=normalize(dome);
       float y=max(0.,d.y);
       vec3 dayColor=mix(vec3(.59,.62,.62),vec3(.25,.35,.44),pow(y,.71));
       vec3 darkColor=mix(vec3(.022,.035,.066),vec3(.006,.011,.029),pow(y,.44));
       vec2 p=d.xz/(y+.31)*4.8;
       float cloud=noise(p)*.61+noise(p*2.1)*.27+noise(p*4.3)*.12;
       float glow=max(0.,dot(d,sun));
       float cover=smoothstep(.52,.79,cloud)*.48*smoothstep(.02,.17,y);
       dayColor=mix(dayColor,vec3(.82,.84,.80),cover);
       vec3 light=mix(darkColor,dayColor,daylight);
       light+=vec3(.35,.182,.119)*pow(glow,3.)*pow(1.-y,3.)*twilight;
       light+=(vec3(.28,.20,.105)*pow(glow,8.)+vec3(1.2,.84,.40)*smoothstep(.9989,.9998,glow))*daylight;
       vec2 starGrid=vec2(atan(d.z,d.x),asin(clamp(d.y,-1.,1.)))*156.;
       vec2 cell=floor(starGrid),spot=vec2(hash(cell+vec2(12.6,28.)),hash(cell+vec2(3.2,17.)));
       float star=(1.-smoothstep(.021,.127,length(fract(starGrid)-spot)))*smoothstep(.989,1.,hash(cell))*smoothstep(.11,.38,y);
       light+=vec3(.63,.73,.95)*star*night*(1.-cover);
       vec3 lunar=normalize(vec3(.44,.52,-.67));
       float moonSpot=max(0.,dot(d,lunar));
       light+=(vec3(.16,.22,.38)*pow(moonSpot,340.)+vec3(.72,.78,.83)*smoothstep(.99991,.99997,moonSpot))*night;
       gl_FragColor=vec4(light,1.);
       #include <tonemapping_fragment>
       #include <colorspace_fragment>
     }`
 }));
 sky.renderOrder=-10;sky.frustumCulled=false;
 scene.add(sky);
 return sky;
}
function resize(){
 if(!renderer)return;
 const w=canvas.clientWidth,h=canvas.clientHeight;
 if(!w||!h)return;
 const aspect=w/h,pixel=Math.min(devicePixelRatio,1.22,Math.sqrt(renderBudgets[renderLevel]/(w*h)));
 if(camera.aspect===aspect&&canvas.width===Math.floor(w*pixel)&&canvas.height===Math.floor(h*pixel))return;
 renderer.setPixelRatio(pixel);renderer.setSize(w,h,false);
 camera.aspect=aspect;camera.updateProjectionMatrix();
}
function adaptResolution(interval){
 if(interval>800)return;
 frameTotal+=Math.min(interval,170);
 if(++frameCount<18)return;
 const mean=frameTotal/frameCount;
 frameCount=0;frameTotal=0;
 if(mean>39&&renderLevel<renderBudgets.length-1){
   renderLevel++;fastWindows=0;resize();
 }else if(mean<35&&renderLevel>0){
   if(++fastWindows>=10){renderLevel--;fastWindows=0;resize();}
 }else fastWindows=0;
}
function update(now){
 request=0;
 if(!running)return;
 request=requestAnimationFrame(update);
 // Keep the renderer near 30 FPS and adapt resolution if the device falls behind.
 if(now-previous<31)return;
 const interval=now-previous;
 adaptResolution(interval);
 const dt=clamp(interval/1000,.001,.085);
 previous=now;
 const p=walk.player,oldX=p.x,oldZ=p.z;
 const wallTime=Date.now(),time=lightCycle(wallTime);
 const minute=Math.floor(time.ms/60000);
 if(minute!==shownMinute){
   shownMinute=minute;
   const hh=String(Math.floor(minute/60)).padStart(2,'0'),mm=String(minute%60).padStart(2,'0');
   $('clock').textContent=hh+':'+mm+' 한국 · '+time.period;
 }
 const waterBefore=walk.waterAt(p.x,p.z,p.feet);
 if(!modalOpen()){
   const x=stick[0]+Number(keys.has('d'))-Number(keys.has('a'));
   const z=-stick[1]+Number(keys.has('w')||keys.has('arrowup'))-Number(keys.has('s')||keys.has('arrowdown'));
   if(Math.abs(x)+Math.abs(z)>.034){
     const a=Math.sin(p.yaw),b=Math.cos(p.yaw),pace=(waterBefore===null?3.05:1.88)*dt/Math.max(1,Math.hypot(x,z));
     walk.move((x*b+z*a)*pace,(x*a-z*b)*pace);
   }
   p.yaw+=(Number(keys.has('arrowright'))-Number(keys.has('arrowleft')))*dt*1.6;
 }
 const doorMotion=walk.tick(dt);
 if(doorMotion)doorShadowPending=true;
 else if(doorShadowPending){
   renderer.shadowMap.needsUpdate=time.daylight>.23;
   doorShadowPending=false;
 }
 const room=walk.room(),wet=walk.waterAt(p.x,p.z,p.feet),name=labelSite(p,room,wet);
 const hallDistance=Math.max(Math.abs(p.x-sanctuary.x)-sanctuary.w/2,
   Math.abs(p.z-sanctuary.z)-sanctuary.d/2);
 for(const roomInfo of rooms){
   const distance=Math.max(Math.abs(p.x-roomInfo.x)-roomInfo.w/2,
     Math.abs(p.z-roomInfo.z)-roomInfo.d/2);
   world.interiors[roomInfo.id].visible=distance<(roomInfo.id==='main'?14:8);
 }
 const nearHall=hallDistance<(hallLighting?8:6);
 if(nearHall!==hallLighting){
   hallLighting=nearHall;
   for(const light of hallLights)light.visible=nearHall;
 }
 wake(dt,p.x,p.z,wet,Math.hypot(p.x-oldX,p.z-oldZ));
 $('jump').hidden=modalOpen();
 $('jump').dataset.airborne=String(!p.grounded);
 if(name!==lastSite){$('place').textContent=name;lastSite=name;}
 animals.tick(dt,p);
 active=modalOpen()?null:walk.action();
 $('action').hidden=!active;
 $('aim').classList.toggle('ready',Boolean(active));
 if(active){
   const label=actionLabel(active);
   if(label!==lastActionText){$('action').textContent=label;lastActionText=label;}
 }
 if(now>=feedbackUntil)$('status').hidden=true;
 if(audioStarted){
   const d=Math.abs(p.x-river(p.z)),vol=(wet===null?.04+.42*Math.exp(-d*.105):.43)*(room ? .26 : 1);
   if(Math.abs(audio.water.volume-vol)>.007)audio.water.volume=vol;
   const birds=time.birds*(room?.070:.30);
   if(Math.abs(dawnBirds.volume-birds)>.003)dawnBirds.volume=birds;

 }
 const ritual=bellPlan(wallTime),bellTime=(now-bellAt)*.001;
 world.mallet.rotation.x=ritual?.phase==='ring'?malletAngle(ritual):
   bellTime<2.9?.29*Math.sin(bellTime*10.4)*Math.exp(-bellTime*2.72):0;
 monk.tick(wallTime,now,(index,total,hour)=>{
   strikeSound();
   if(!modalOpen()&&Math.hypot(p.x-10.5,p.z-5)<26)report((hour===3?'새벽 타종':'저녁 타종')+' '+index+' / '+total);
 },p);
 const age=(now-incenseAt)*.001;
 if(world.incense.visible&&age>27)world.incense.visible=false;
 animateSmoke(age);
 if(world.flames.visible){
   for(const [i,light] of world.lamps.entries())light.intensity=4.2+.6*Math.sin(now*.014+i*2.1)+.24*rng();
 }
 const t=now*.001;
 for(const surface of water.waters)surface.material.uniforms.time.value=t;
 fish(dt,p);
 stream(dt,p,time.daylight);
 lanternCycle(now,p,time.lamps);
 camera.position.set(p.x,p.y+1.66,p.z);
 skyDome.position.copy(camera.position);
 rotation.set(p.pitch,-p.yaw,0,'YXZ');camera.quaternion.setFromEuler(rotation);
 renderer.render(scene,camera);
}
function loop(){
 if(!running||request)return;
 previous=performance.now();
 frameCount=0;frameTotal=0;
 request=requestAnimationFrame(update);
}
function release(e){
 if(e.pointerId===dragMove){
   dragMove=null;stick=[0,0];
   for(const key of ['left','top','bottom'])$('stick').style[key]='';
   $('knob').style.transform='';
 }
 if(e.pointerId===dragLook)dragLook=null;
}
canvas.addEventListener('pointerdown',e=>{
 if(!started||modalOpen()||e.button>0)return;
 if(e.clientX<canvas.clientWidth*.47&&dragMove===null){
   dragMove=e.pointerId;moveOrigin=[e.clientX,e.clientY];
   $('stick').style.left=clamp(e.clientX-42,7,canvas.clientWidth*.47-45)+'px';
   $('stick').style.top=clamp(e.clientY-42,48,canvas.clientHeight-94)+'px';
   $('stick').style.bottom='auto';
 }else if(e.clientX>=canvas.clientWidth*.47&&dragLook===null){
   dragLook=e.pointerId;lookOrigin=[e.clientX,e.clientY];
 }else return;
 canvas.setPointerCapture(e.pointerId);
 ambient();
});
canvas.addEventListener('pointermove',e=>{
 if(e.pointerId===dragMove){
   const x=(e.clientX-moveOrigin[0])/38,y=(e.clientY-moveOrigin[1])/38,r=Math.max(1,Math.hypot(x,y));
   stick=[x/r,y/r];
   $('knob').style.transform='translate('+stick[0]*28+'px,'+stick[1]*28+'px)';
 }else if(e.pointerId===dragLook){
   const p=walk.player;
   p.yaw+=(e.clientX-lookOrigin[0])*.0055;
   p.pitch=clamp(p.pitch-(e.clientY-lookOrigin[1])*.00445,-1.31,1.31);
   lookOrigin=[e.clientX,e.clientY];
 }
});
for(const evt of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(evt,release);
function jump(){
 if(started&&!modalOpen())walk.jump();
}
$('jump').addEventListener('pointerdown',e=>{
 if(e.button===0){e.preventDefault();jump();}
});
$('jump').addEventListener('click',e=>{if(e.detail===0)jump();});
window.addEventListener('keydown',e=>{
 const k=e.key.toLowerCase();
 if(!started||modalOpen()||!['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','e',' '].includes(k))return;
 e.preventDefault();ambient();
 if(k==='e'){if(!e.repeat)use();}
 else if(k===' '){if(!e.repeat)jump();}
 else keys.add(k);
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',neutral);
window.pauseTemple=()=>{
 neutral();
 for(const clip of [...Object.values(audio),...bellVoices])clip.pause();
 bellContext?.suspend().catch(()=>{});
 audioStarted=false;
};
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){running=false;if(request)cancelAnimationFrame(request);request=0;window.pauseTemple();}
 else if(started){running=true;loop();}
});
$('action').onclick=use;
$('help').onclick=()=>{if(started){neutral();$('guide').hidden=false;}};
$('resume').onclick=()=>{
 $('guide').hidden=true;
 try{localStorage.setItem('unrimsa-seen','1');}catch{}
 ambient();
};
$('bookClose').onclick=()=>{$('book').hidden=true;};
$('bookPrevious').onclick=()=>showBook(Math.max(1,bookPage-1));
$('bookNext').onclick=()=>showBook(Math.min(2,bookPage+1));
$('petTouch').onclick=()=>finishPet('touch');
$('petFeed').onclick=()=>finishPet('feed');
$('petClose').onclick=()=>finishPet(null);
$('reset').onclick=()=>{
 if(!started)return;
 walk.reset();neutral();bellAt=incenseAt=-Infinity;world.flames.visible=world.incense.visible=false;
 audio.bell.pause();audio.door.pause();audio.moktak.pause();
 renderer.shadowMap.needsUpdate=true;
 $('guide').hidden=true;
 ambient();
};
$('sound').onclick=()=>{
 muted=!muted;$('sound').textContent=muted?'소리 끔':'소리 켬';
 $('sound').setAttribute('aria-pressed',String(muted));
 for(const clip of [...Object.values(audio),...bellVoices])clip.muted=muted;
 if(bellMaster)bellMaster.gain.value=Number(!muted);
 if(muted){audio.water.pause();dawnBirds.pause();audioStarted=false;}else ambient();
};

function loadTexture(loader,key,path,isColor){
 return loader.loadAsync(path).then(t=>{
   if(isColor)t.colorSpace=T.SRGBColorSpace;
   if(!['needles','jindoCoat','tanghwa'].includes(key))t.wrapS=t.wrapT=T.RepeatWrapping;
   t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
   return [key,t];
 });
}
function statue(gltf){
 const model=gltf.scene;
 model.updateMatrixWorld(true);
 model.traverse(obj=>{
   if(!obj.isMesh)return;
   if(obj.geometry.getAttribute('position').count<10){obj.visible=false;return;}
   obj.castShadow=true;obj.receiveShadow=true;
   const mat=obj.material;
   mat.roughness=.96;mat.metalness=.79;mat.envMapIntensity=1.42;
 });
 const box=new T.Box3().setFromObject(model);
 const center=box.getCenter(new T.Vector3());
 const figureHeight=3.46;
 const factor=figureHeight/(box.max.y-box.min.y);
 const holder=new T.Group();
 model.position.set(-center.x*factor,-box.min.y*factor,-center.z*factor);
 model.scale.setScalar(factor);
 holder.add(model);
 holder.position.copy(world.statueBase).z+=.19;
 world.interiors.main.add(holder);
 const base=world.statueBase;
 const key=new T.SpotLight('#fff1d4',66,18,.50,.70,1.7);
 key.position.copy(base).add(new T.Vector3(-3.6,4.42,5.3));
 key.target.position.copy(base).add(new T.Vector3(0,figureHeight*.60,.19));
 scene.add(key,key.target);
 const fill=new T.PointLight('#e5eef1',30,14,1.64);
 fill.position.copy(base).add(new T.Vector3(3.55,3.00,3.64));
 const warmRim=new T.PointLight('#ffe0a1',12,8,1.61);
 warmRim.position.copy(base).add(new T.Vector3(-2.02,3.65,-1.38));
 scene.add(fill,warmRim);
 for(const light of [key,fill,warmRim])light.userData.hallOnly=true;
}

async function boot(){
 renderer=new T.WebGLRenderer({canvas,powerPreference:'high-performance',antialias:false,alpha:false});
 renderer.outputColorSpace=T.SRGBColorSpace;
 renderer.toneMapping=T.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.19;
 renderer.shadowMap.enabled=true;
 renderer.shadowMap.type=T.PCFSoftShadowMap;
 renderer.shadowMap.autoUpdate=false;
 renderer.shadowMap.needsUpdate=true;
 scene=new T.Scene();
 scene.background=new T.Color('#98aca7');
 scene.fog=new T.FogExp2('#9fb2a9',.0102);
 camera=new T.PerspectiveCamera(61,1,.08,182);
 camera.position.set(-3.5,2.3,26);
 resize();
 new ResizeObserver(resize).observe(canvas);
 const textures=new T.TextureLoader(), gltf=new GLTFLoader();
 const paths=[
   ['stone','stone.jpg',true],['wood','wood.jpg',true],['paper','paper.jpg',true],
   ['clay','clay.jpg',true],['earth','earth.jpg',true],['pond','pond.jpg',true],
   ['bark','bark.jpg',true],['needles','needles.png',true],['ripples','ripples.png',false],
   ['weave','weave.jpg',true],['weaveNormal','weave-normal.jpg',false],['fur','jindo-fur.jpg',true],['jindoCoat','jindo-coat.jpg',true],
   ['tanghwa','tanghwa.jpg',true],['sutra1','sutra-1.jpg',true],['carpScales','carp-scales.jpg',true]
 ];
 const [items,buddha,maple,...animalsAndProps]=await Promise.all([
   Promise.all(paths.map(([key,path,flag])=>loadTexture(textures,key,'./'+path,flag))),
   gltf.loadAsync('./buddha.glb'),gltf.loadAsync('./maple.glb'),
   ...['cat','jindo','sparrow','teapot','monk-rig','mallard','stream-frog'].map(name=>gltf.loadAsync('./'+name+'.glb').then(asset=>[name,asset.scene]))
 ]);
 const maps=Object.fromEntries(items),models=Object.fromEntries(animalsAndProps);
 const sun=new T.DirectionalLight('#ffdfb3',2.26);
 sun.position.copy(direction).multiplyScalar(44);
 sun.castShadow=true;
 sun.shadow.mapSize.set(768,768);
 Object.assign(sun.shadow.camera,{left:-31,right:31,top:33,bottom:-33,near:2,far:106});
 sun.shadow.camera.updateProjectionMatrix();
 sun.shadow.normalBias=.032;sun.shadow.bias=-.0001;
 const ambientLight=new T.HemisphereLight('#d6e4e4','#69594d',1.16);
 scene.add(sun,ambientLight);
 const environment=new RoomEnvironment(renderer);
 const pmrem=new T.PMREMGenerator(renderer);
 scene.environment=pmrem.fromScene(environment,.15,.1,100).texture;
 environment.dispose();pmrem.dispose();
 skyDome=sky();
 world=buildWorld(scene,maps,models);
 statue(buddha);
 hallLights=scene.children.filter(object=>object.userData.hallOnly);
 for(const light of hallLights){light.userData.dayIntensity=light.intensity;light.visible=false;}
 lanternCycle=nightLanterns(scene,world.eaveLamps,world.lanternPaper);
 const forest=plantForest(scene,world,maps,maple.scene);
 water=addWater(scene,maps,direction);
 wake=waterWake(scene);
 smoke=createSmoke();
 walk=walking(world);
 animals=addAnimals(scene,walk.floorAt,models,maps.fur,world.actions,maps.jindoCoat);
 fish=aquaticLife(scene,maps.carpScales);
 stream=streamLife(scene,models);
 monk=addMonk(scene,models['monk-rig'],maps,walk.floorAt,world.mallet,walk.holdDoor);
 lightCycle=templeLighting(scene,renderer,sun,ambientLight,skyDome,water.waters,hallLights,forest.lighting);
 lightCycle(Date.now());
 try{$('guide').hidden=localStorage.getItem('unrimsa-seen')==='1';}catch{$('guide').hidden=false;}
 $('loading').hidden=true;
 started=running=true;
 loop();
}
canvas.addEventListener('webglcontextlost',event=>{
 event.preventDefault();running=false;if(request)cancelAnimationFrame(request);request=0;
 $('loadText').textContent='3D 화면을 복구하는 중';$('loading').hidden=false;
});
canvas.addEventListener('webglcontextrestored',()=>{
 $('loading').hidden=true;
 if(started){renderer.shadowMap.needsUpdate=true;running=true;loop();}
});
boot().catch(error=>{
 console.error(error);
 $('loadText').textContent='3D 장면을 열 수 없습니다. Android System WebView를 업데이트한 뒤 앱을 다시 실행해 주세요.';
});
