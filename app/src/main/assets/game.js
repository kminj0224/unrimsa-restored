import * as T from './vendor/three.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {RoomEnvironment} from './vendor/RoomEnvironment.js';
import {buildWorld,clamp,pond,random,river,sanctuary} from './world.js';
import {addWater,plantForest} from './nature.js';
import {walking} from './walk.js';

const $=id=>document.getElementById(id);
const canvas=$('map');
const direction=new T.Vector3(-.51,.74,.43).normalize();
const keys=new Set();
const audio=Object.fromEntries(['bell','moktak','door','water'].map(n=>[n,new Audio('/'+n+'.ogg')]));
for(const [key,vol] of Object.entries({bell:.81,moktak:.64,door:.41,water:.12}))audio[key].volume=vol;
audio.water.loop=true;
let world,walk,renderer,scene,camera,water,smoke;
let muted=false,audioStarted=false,started=false,running=false,request=0,previous=0;
let dragMove=null,dragLook=null,moveOrigin=[0,0],lookOrigin=[0,0],stick=[0,0];
let active=null,lastActionText='',lastSite='',feedbackUntil=0,bellAt=-Infinity,incenseAt=-Infinity;
const rotation=new T.Euler(0,0,0,'YXZ');
const rng=random(3111);

function modalOpen(){return !$('guide').hidden||!$('book').hidden;}
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
 if(muted||audioStarted)return;
 audioStarted=true;
 audio.water.play().catch(()=>{audioStarted=false;});
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
   bellAt=now;sound('bell');report('범종을 울렸습니다.');
 }else if(a.id==='moktak'){
   sound('moktak');report('목탁을 두드렸습니다.');
 }else if(a.id==='lamp'){
   world.flames.visible=!world.flames.visible;
   report(world.flames.visible?'촛불을 밝혔습니다.':'촛불을 껐습니다.');
 }else if(a.id==='incense'){
   incenseAt=now;world.incense.visible=true;
   report('향을 피웠습니다.');
 }else if(a.id==='read'){
   neutral();$('book').hidden=false;
 }
}
function labelSite(player,room){
 if(room)return room.name+' 내부';
 const {x,z}=player;
 if(z>20.0)return '사찰로 오르는 산길';
 if(z>14.9&&Math.abs(x+4)<6.4)return '일주문';
 if(Math.hypot(x-pond.x,(z-pond.z)*1.14)<5.43)return '연꽃 연못';
 if(Math.abs(x-10.5)<3.7&&Math.abs(z-5)<3.8)return '범종각';
 if(Math.abs(x+4)<4.9&&Math.abs(z+2.4)<5.6)return '삼층석탑 마당';
 if(Math.abs(x-sanctuary.x)<sanctuary.w*.51&&z<-6&&z>sanctuary.z)return '대웅전 앞';
 if(Math.abs(x-river(z))<11)return '계곡 산책로';
 return '운림사 마당';
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
   side:T.BackSide,depthWrite:false,uniforms:{sun:{value:direction}},
   vertexShader:`
     varying vec3 dome;
     void main(){
       dome=normalize(position);
       gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
     }`,
   fragmentShader:`
     uniform vec3 sun;
     varying vec3 dome;
     float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
     float noise(vec2 p){
       vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
       return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
     }
     void main(){
       vec3 d=normalize(dome);
       float y=max(0.,d.y);
       vec3 light=mix(vec3(.59,.66,.65),vec3(.19,.35,.49),pow(y,.71));
       vec2 p=d.xz/(y+.31)*4.8;
       float cloud=noise(p)*.61+noise(p*2.1)*.27+noise(p*4.3)*.12;
       float glow=max(0.,dot(d,sun));
       light=mix(light,vec3(.82,.84,.80),smoothstep(.52,.79,cloud)*.48*smoothstep(.02,.17,y));
       light+=vec3(.28,.20,.105)*pow(glow,8.)+vec3(1.2,.84,.40)*smoothstep(.9989,.9998,glow);
       gl_FragColor=vec4(light,1.);
       #include <tonemapping_fragment>
       #include <colorspace_fragment>
     }`
 }));
 sky.renderOrder=-10;sky.frustumCulled=false;
 scene.add(sky);
}
function resize(){
 if(!renderer)return;
 const w=canvas.clientWidth,h=canvas.clientHeight;
 if(!w||!h)return;
 const aspect=w/h,pixel=Math.min(devicePixelRatio,1.38,Math.sqrt(835000/(w*h)));
 if(camera.aspect===aspect&&canvas.width===Math.floor(w*pixel)&&canvas.height===Math.floor(h*pixel))return;
 renderer.setPixelRatio(pixel);renderer.setSize(w,h,false);
 camera.aspect=aspect;camera.updateProjectionMatrix();
}
function update(now){
 request=0;
 if(!running)return;
 request=requestAnimationFrame(update);
 // Rendering at up to 30 fps leaves GPU time for the real-time water mirrors.
 if(now-previous<31)return;
 const dt=clamp((now-previous)/1000,.001,.063);
 previous=now;
 const p=walk.player;
 if(!modalOpen()){
   const x=stick[0]+Number(keys.has('d'))-Number(keys.has('a'));
   const z=-stick[1]+Number(keys.has('w')||keys.has('arrowup'))-Number(keys.has('s')||keys.has('arrowdown'));
   if(Math.abs(x)+Math.abs(z)>.034){
     const a=Math.sin(p.yaw),b=Math.cos(p.yaw),pace=3.05*dt/Math.max(1,Math.hypot(x,z));
     walk.move((x*b+z*a)*pace,(x*a-z*b)*pace);
   }
   p.yaw+=(Number(keys.has('arrowright'))-Number(keys.has('arrowleft')))*dt*1.6;
 }
 const doorMotion=walk.tick(dt);
 if(doorMotion&&Math.floor(now/83)%2===0)renderer.shadowMap.needsUpdate=true;
 const room=walk.room(),name=labelSite(p,room);
 $('jump').hidden=modalOpen();
 $('jump').dataset.airborne=String(!p.grounded);
 if(name!==lastSite){$('place').textContent=name;lastSite=name;}
 active=modalOpen()?null:walk.action();
 $('action').hidden=!active;
 $('aim').classList.toggle('ready',Boolean(active));
 if(active){
   const label=actionLabel(active);
   if(label!==lastActionText){$('action').textContent=label;lastActionText=label;}
 }
 if(now>=feedbackUntil)$('status').hidden=true;
 if(audioStarted){
   const d=Math.abs(p.x-river(p.z)),vol=(.04+.42*Math.exp(-d*.105))*(room ? .26 : 1);
   if(Math.abs(audio.water.volume-vol)>.007)audio.water.volume=vol;
 }
 const bellTime=(now-bellAt)*.001;
 world.mallet.rotation.x=bellTime<2.9?.29*Math.sin(bellTime*10.4)*Math.exp(-bellTime*2.72):0;
 const age=(now-incenseAt)*.001;
 if(world.incense.visible&&age>27)world.incense.visible=false;
 animateSmoke(age);
 if(world.flames.visible){
   for(const [i,light] of world.lamps.entries())light.intensity=4.2+.6*Math.sin(now*.014+i*2.1)+.24*rng();
 }
 const t=now*.001;
 for(const surface of water.waters)surface.material.uniforms.time.value=t;
 camera.position.set(p.x,p.y+1.66,p.z);
 rotation.set(p.pitch,-p.yaw,0,'YXZ');camera.quaternion.setFromEuler(rotation);
 renderer.render(scene,camera);
}
function loop(){
 if(!running||request)return;
 previous=performance.now();
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
 for(const clip of Object.values(audio))clip.pause();
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
 for(const clip of Object.values(audio))clip.muted=muted;
 if(muted){audio.water.pause();audioStarted=false;}else ambient();
};

function loadTexture(loader,key,path,isColor){
 return loader.loadAsync(path).then(t=>{
   if(isColor)t.colorSpace=T.SRGBColorSpace;
   if(key!=='needles')t.wrapS=t.wrapT=T.RepeatWrapping;
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
 const figureHeight=4.48;
 const factor=figureHeight/(box.max.y-box.min.y);
 const holder=new T.Group();
 model.position.set(-center.x*factor,-box.min.y*factor,-center.z*factor);
 model.scale.setScalar(factor);
 holder.add(model);
 holder.position.copy(world.statueBase);
 scene.add(holder);
 const base=world.statueBase;
 const key=new T.SpotLight('#fff1d4',88,20,.49,.64,1.7);
 key.position.copy(base).add(new T.Vector3(-3.6,4.42,5.3));
 key.target.position.copy(base).add(new T.Vector3(0,figureHeight*.60,.19));
 scene.add(key,key.target);
 const fill=new T.PointLight('#e5eef1',30,14,1.64);
 fill.position.copy(base).add(new T.Vector3(3.55,3.00,3.64));
 const warmRim=new T.PointLight('#ffe0a1',12,8,1.61);
 warmRim.position.copy(base).add(new T.Vector3(-2.02,3.65,-1.38));
 scene.add(fill,warmRim);
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
 camera=new T.PerspectiveCamera(61,1,.08,230);
 camera.position.set(-3.5,2.3,26);
 resize();
 new ResizeObserver(resize).observe(canvas);
 const textures=new T.TextureLoader(), gltf=new GLTFLoader();
 const paths=[
   ['stone','stone.jpg',true],['wood','wood.jpg',true],['paper','paper.jpg',true],
   ['clay','clay.jpg',true],['earth','earth.jpg',true],['pond','pond.jpg',true],
   ['bark','bark.jpg',true],['needles','needles.png',true],['ripples','ripples.png',false]
 ];
 const [items,buddha,maple]=await Promise.all([
   Promise.all(paths.map(([key,path,flag])=>loadTexture(textures,key,'/'+path,flag))),
   gltf.loadAsync('/buddha.glb'),gltf.loadAsync('/maple.glb')
 ]);
 const maps=Object.fromEntries(items);
 const sun=new T.DirectionalLight('#ffdfb3',2.26);
 sun.position.copy(direction).multiplyScalar(44);
 sun.castShadow=true;
 sun.shadow.mapSize.set(1536,1536);
 Object.assign(sun.shadow.camera,{left:-31,right:31,top:33,bottom:-33,near:2,far:106});
 sun.shadow.camera.updateProjectionMatrix();
 sun.shadow.normalBias=.032;sun.shadow.bias=-.0001;
 scene.add(sun,new T.HemisphereLight('#d6e4e4','#69594d',1.16));
 const environment=new RoomEnvironment(renderer);
 const pmrem=new T.PMREMGenerator(renderer);
 scene.environment=pmrem.fromScene(environment,.15,.1,100).texture;
 environment.dispose();pmrem.dispose();
 sky();
 world=buildWorld(scene,maps);
 statue(buddha);
 plantForest(scene,world,maps,maple.scene);
 water=addWater(scene,maps,direction);
 smoke=createSmoke();
 walk=walking(world);
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
