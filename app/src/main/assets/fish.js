import * as T from './vendor/three.js';
import {pond,pondBed,pondRadius,river,riverHalfWidth,riverY,terrainAt} from './world.js';

const TAU=Math.PI*2;
const profile=[[-.54,.002,.003],[-.49,.030,.037],[-.38,.052,.071],[-.24,.076,.114],
 [-.08,.101,.142],[.10,.108,.141],[.25,.098,.119],[.37,.072,.087],[.46,.049,.055],[.51,.018,.026],[.52,.003,.012]];
const finish=new T.MeshStandardMaterial({color:'#201818',roughness:.28});
const iris=new T.MeshStandardMaterial({color:'#aa8954',metalness:.3,roughness:.39});
const eyeShape=new T.SphereGeometry(1,12,8);
const barbel=new T.MeshStandardMaterial({color:'#b38964',roughness:.69});
const rgb=h=>new T.Color(h);
const palettes=[
 ['#e4dac7','#c1411e','#272321'],
 ['#ddd5b9','#d07822','#29271f'],
 ['#e9d6b3','#b43026','#302d2b'],
 ['#7e7960','#555b46','#565949']
].map(p=>p.map(rgb));
const blend=T.MathUtils.lerp, smooth=T.MathUtils.smoothstep;

function tone(palette,style,x,y,z){
 const [light,mark,ink]=palette;
 const sides=Math.abs(x);
 const belly=smooth(y,-.14,.10);
 const salt=Math.sin(z*29+Math.sin(x*38)*1.8+style*2)+.49*Math.sin(z*54-y*24)+.32*Math.sin(x*61+y*27);
 if(style===3)return light.clone().lerp(ink,belly*.60).multiplyScalar(.83+.13*salt+.08*(1-belly));
 const mottled=smooth(salt,.18,.50)*smooth(y,-.09,.01);
 const spots=smooth(Math.sin(z*23+x*37+style*2.5)+Math.sin(z*29-y*61),1.36,1.70);
 return light.clone().lerp(mark,mottled*.96).lerp(ink,spots*smooth(y,-.044,.075)*.91)
   .multiplyScalar(.88+.16*smooth(sides,.01,.08));
}

function bodyGeometry(style){
 const palette=palettes[style],segments=28,rings=50;
 const pos=[],uv=[],colors=[],idx=[];
 for(let i=0;i<=rings;i++){
   const t=i/rings,z=blend(-.54,.52,t);
   let j=1;while(j<profile.length-1&&profile[j][0]<z)j++;
   const a=profile[j-1],b=profile[j],f=(z-a[0])/(b[0]-a[0]);
   const width=blend(a[1],b[1],f),height=blend(a[2],b[2],f);
   for(let k=0;k<=segments;k++){
     const ang=TAU*k/segments;
     const x=Math.cos(ang)*width,y=Math.sin(ang)*height+.016*Math.sin(Math.PI*t);
     pos.push(x,y,z);uv.push(t*2.05,k/segments*1.15);
     const c=tone(palette,style,x,y,z);
     colors.push(c.r,c.g,c.b);
     if(i&&k){const q=i*(segments+1)+k;idx.push(q-segments-2,q-segments-1,q-1,q-segments-1,q,q-1);}
   }
 }
 const geo=new T.BufferGeometry();
 for(const [key,buffer,itemSize] of [['position',pos,3],['color',colors,3],['uv',uv,2]])
   geo.setAttribute(key,new T.Float32BufferAttribute(buffer,itemSize));
 geo.setIndex(idx);geo.computeVertexNormals();
 const fins=[];
 function fin(name,root,edge,tail=false){
   const points=[...root];
   const rays=[];
   for(const [j,p] of edge.entries()){
     points.push(...p);
     if(j<edge.length-1)rays.push(0,j+1,j+2);
   }
   const g=new T.BufferGeometry();
   g.setAttribute('position',new T.Float32BufferAttribute(points,3));
   g.setIndex(rays);g.computeVertexNormals();
   fins.push({name,g,tail});
 }
 fin('forked tail',[0,0,-.472],[[0,.142,-.687],[0,.102,-.737],[0,.044,-.673],[0,0,-.599],
   [0,-.045,-.662],[0,-.115,-.718],[0,-.136,-.667],[0,-.034,-.494],[0,.035,-.494]],true);
 fin('dorsal fin',[0,.11,.18],[[0,.207,.065],[0,.183,-.046],[0,.166,-.153],[0,.126,-.281],[0,.072,-.349],[0,.103,-.13]]);
 fin('anal fin',[0,-.067,-.245],[[0,-.137,-.335],[0,-.133,-.387],[0,-.062,-.426]]);
 for(const s of [-1,1]){
   fin('pectoral fin',[s*.074,-.042,.223],[[s*.168,-.071,.130],[s*.199,-.086,.016],[s*.147,-.108,.008],[s*.073,-.086,.121]]);
   fin('pelvic fin',[s*.055,-.089,-.062],[[s*.115,-.127,-.157],[s*.108,-.145,-.227],[s*.055,-.097,-.181]]);
 }
 return {geo,fins};
}

function fishForm(style,scales){
 const {geo,fins}=bodyGeometry(style);
 const group=new T.Group();
 const skin=new T.MeshPhysicalMaterial({vertexColors:true,map:scales,bumpMap:scales,bumpScale:.004,
   roughness:.44,clearcoat:.29,clearcoatRoughness:.34,metalness:.12});
 const finMat=new T.MeshStandardMaterial({color:style===3?'#83785a':style===1?'#bc9359':'#c67852',side:T.DoubleSide,
   transparent:true,opacity:.91,roughness:.57,depthWrite:false});
 group.add(new T.Mesh(geo,skin));
 for(const {g} of fins)group.add(new T.Mesh(g,finMat));
 for(const s of [-1,1]){
   const eye=new T.Mesh(eyeShape,iris);
   eye.position.set(s*.068,.038,.359);eye.scale.set(.013,.020,.021);
   const pupil=new T.Mesh(eyeShape,finish);
   pupil.position.set(s*.079,.038,.366);pupil.scale.set(.008,.013,.013);
   group.add(eye,pupil);
   const whisker=new T.CatmullRomCurve3([[s*.027,-.023,.479],[s*.049,-.041,.492],[s*.074,-.051,.469]].map(p=>new T.Vector3(...p)));
   group.add(new T.Mesh(new T.TubeGeometry(whisker,6,.0035,5,false),barbel));
 }
 const patches=group.children.slice(0,fins.length+1);
 const pose=[];
 for(const m of patches){
   const att=m.geometry.getAttribute('position');
   const xyz=att.array.slice();
   pose.push({att,xyz});
 }
 return {group,swim(t,phase){
   for(const {att,xyz} of pose){
     for(let i=0;i<att.count;i++){
       const j=i*3,z=xyz[j+2],a=smooth(-z,-.04,.65);
       att.setX(i,xyz[j]+Math.sin(t*7.8+z*7.4+phase)*a*a*.11);
     }
     att.needsUpdate=true;
   }
 }};
}

export function aquaticLife(scene,scales){
 const population=new T.Group();population.name='Freshwater fish';scene.add(population);
 const pondFish=[0,1,2].map((style,i)=>{
   const item=fishForm(style,scales);
   item.group.name='Koi '+(i+1);
   item.group.scale.setScalar([.53,.46,.60][i]);population.add(item.group);return item;
 });
 const streamFish=Array.from({length:8},(_,i)=>{
   const item=fishForm(3,scales);
   item.group.name='Stream carp '+(i+1);
   item.group.scale.setScalar(.27+(i%4)*.043);population.add(item.group);return item;
 });
 let t=0;
 return (dt,viewer)=>{
   t+=dt;
   for(const [i,item] of pondFish.entries()){
     const a=t*(.24+i*.018)+i*TAU/3,x=pond.x+Math.cos(a)*(2.69-i*.19),
       z=pond.z+Math.sin(a)*(1.51-i*.08);
     const bottom=pondBed(pondRadius(x,z));
     item.group.position.set(x,Math.max(bottom+.086,pond.y-.175-.031*Math.sin(t*.72+i)),z);
     item.group.rotation.y=Math.atan2(-Math.sin(a)*(2.69-i*.19),Math.cos(a)*(1.51-i*.08));
     const visible=!viewer||Math.hypot(viewer.x-x,viewer.z-z)<20;
     item.group.visible=visible;
     if(visible)item.swim(t,i);
   }
   for(const [i,item] of streamFish.entries()){
     const phase=t*(.205+(i%3)*.029)+i*.77;
     const z=12.1+(i%4)*5.6-8.4+Math.cos(phase)*(2.85+i%3);
     const x=river(z)+Math.sin(phase+i*.63)*riverHalfWidth(z)*.48;
     item.group.position.set(x,Math.min(riverY-.14,Math.max(terrainAt(x,z)+.15,riverY-.44+.15*Math.sin(t*.63+i))),z);
     const nextZ=12.1+(i%4)*5.6-8.4+Math.cos(phase+.02)*(2.85+i%3);
     const nextX=river(nextZ)+Math.sin(phase+i*.63+.02)*riverHalfWidth(nextZ)*.48;
     item.group.rotation.y=Math.atan2(nextX-x,nextZ-z);
     const visible=!viewer||Math.hypot(viewer.x-x,viewer.z-z)<23;
     item.group.visible=visible;
     if(visible)item.swim(t,i*1.81);
   }
 };
}
