import * as T from './vendor/three.js';
import {kstTime} from './temple-time.js';

const SECOND=1000,HOUR=3600*SECOND;
const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const smooth=T.MathUtils.smoothstep;
const minMax=T.MathUtils.clamp;
const ROUTE=[[-17.28,7.04],[-17.02,8.60],[-13.22,8.59],[-8.05,8.54],
 [-2.13,8.44],[3.35,8.42],[8.85,8.69],[10.50,8.90],[10.50,7.84]];
const PATH=ROUTE.map(([x,z])=>v(x,0,z));
const lengths=[0];
for(let i=1;i<PATH.length;i++)lengths.push(lengths[i-1]+PATH[i-1].distanceTo(PATH[i]));
const WALK_TIME=31*SECOND;
const PREPARE=3100;
const REST=4200;

function rhythm(count){
 const times=[0];
 const middle=[3400,3100,2850,3500,3030,3180,3650];
 for(let i=1;i<count;i++)times.push(times[i-1]+(i<3?4450:i>=count-3?4900:middle[(i-3)%middle.length]));
 return times;
}
const rituals=[{hour:3,times:rhythm(28)},{hour:18,times:rhythm(33)}];
export function bellPlan(now){
 const {day,ms}=kstTime(now);
 for(const {hour,times} of rituals){
   const elapsed=ms-hour*HOUR,last=times.at(-1);
   if(elapsed>=-WALK_TIME-PREPARE&&elapsed<=last+REST+WALK_TIME){
     const phase=elapsed<-PREPARE?'approach':elapsed<=last+REST?'ring':'return';
     return {key:day+':'+hour,hour,times,phase,elapsed,last};
   }
 }
 return null;
}

export function bellSequence(){
 const counts=new Map();
 let lastTime=null;
 return now=>{
   const plan=bellPlan(now),play=[];
   if(plan){
     const {elapsed,key,times}=plan;
     let next=counts.get(key)??0;
     while(next<times.length&&times[next]<=elapsed){
       const age=elapsed-times[next];
       if(age<=570&&(lastTime===null||now>=lastTime))play.push(next+1);
       next++;
     }
     counts.set(key,next);
     for(const old of counts.keys())if(Number(old.split(':')[0])<kstTime(now).day-2)counts.delete(old);
   }
   lastTime=now;
   return {plan,play};
 };
}

export function malletAngle(plan){
 if(!plan||plan.phase!=='ring')return 0;
 const t=plan.elapsed;
 for(const mark of plan.times){
   const d=t-mark;
   if(d>=-1850&&d<0){
     if(d< -310)return -.218*smooth(d,-1850,-370);
     return T.MathUtils.lerp(-.218,.102,smooth(d,-310,0));
   }
   if(d>=0&&d<850)return .102*Math.cos(d*.0115)*Math.exp(-d*.0043);
 }
 return 0;
}

function routeAt(fraction,point,heading){
 const target=minMax(fraction,0,1)*lengths.at(-1);
 let i=1;while(i<lengths.length-1&&lengths[i]<target)i++;
 point.copy(PATH[i-1]).lerp(PATH[i],(target-lengths[i-1])/(lengths[i]-lengths[i-1]));
 heading.subVectors(PATH[i],PATH[i-1]).normalize();
}

function weightedMesh(geometry,material,body,weights){
 const skinIndex=[],skinWeight=[];
 const attr=geometry.getAttribute('position');
 for(let i=0;i<attr.count;i++){
   const values=weights(attr.getX(i),attr.getY(i),attr.getZ(i));
   let sum=0;
   for(const [bone,f] of values)sum+=f;
   for(let j=0;j<4;j++){
     const item=values[j];
     skinIndex.push(item?body.skeleton.bones.indexOf(item[0]):0);
     skinWeight.push(item?item[1]/sum:0);
   }
 }
 geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(skinIndex,4));
 geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(skinWeight,4));
 const mesh=new T.SkinnedMesh(geometry,material);
 mesh.bind(body.skeleton,body.bindMatrix);
 mesh.frustumCulled=false;
 mesh.receiveShadow=true;
 return mesh;
}
function garmentTube(levels,n=40){
 const positions=[],uv=[],idx=[];
 for(const [i,[x,y,z,rx,rz]] of levels.entries()){
   for(let j=0;j<=n;j++){
     const a=j/n*Math.PI*2,f=1+.028*Math.cos(a*5+i*.41)+.033*Math.sin(a*9+i*.29);
     positions.push(x+rx*f*Math.cos(a),y+.009*Math.sin(a*6+i*.23),z+rz*f*Math.sin(a));
     uv.push(j/n*2.6,i/(levels.length-1)*2.8);
     if(i&&j){const k=i*(n+1)+j;idx.push(k-n-2,k-1,k,k-n-2,k,k-n-1);}
   }
 }
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 g.setIndex(idx);g.computeVertexNormals();return g;
}
function sleeve(points,radii){
 const curve=new T.CatmullRomCurve3(points),pos=[],uv=[],idx=[],n=28,levels=17;
 const profile=new T.SplineCurve(radii.map((r,i)=>new T.Vector2(i/(radii.length-1),r)));
 for(let i=0;i<=levels;i++){
   const f=i/levels,center=curve.getPoint(f),t=curve.getTangent(f);
   const a=v(0,0,1).cross(t).normalize(),b=t.clone().cross(a).normalize();
   const r=profile.getPoint(f).y;
   for(let j=0;j<=n;j++){
     const phi=j/n*Math.PI*2;
     const radius=r*(1+.034*Math.cos(phi*5+f*5)+.032*Math.sin(phi*8-f*7));
     const p=center.clone().addScaledVector(a,Math.cos(phi)*radius).addScaledVector(b,Math.sin(phi)*radius*.87);
     pos.push(...p.toArray());uv.push(j/n*1.7,f*1.8);
     if(i&&j){const k=i*(n+1)+j;idx.push(k-n-2,k-1,k,k-n-2,k,k-n-1);}
   }
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
 g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
function lapel(points,width){
 const curve=new T.CatmullRomCurve3(points.map(p=>v(...p)));
 const positions=[],uv=[],indices=[];
 for(let i=0;i<=26;i++){
   const f=i/26,p=curve.getPoint(f),dir=curve.getTangent(f);
   const side=v(-dir.y,dir.x,0).normalize().multiplyScalar(width*.5);
   positions.push(...p.clone().sub(side).toArray(),...p.add(side).toArray());uv.push(0,f*2,1,f*2);
   if(i){const j=i*2;indices.push(j-2,j-1,j,j-1,j+1,j);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 g.setIndex(indices);g.computeVertexNormals();return g;
}

function portrait(mesh,isEye){
 const geometry=mesh.geometry,positions=geometry.getAttribute('position'),colors=[];
 const base=new T.Color('#bd8e73'),ear=new T.Color('#ba7c68'),lip=new T.Color('#a46b5e');
 const scalp=new T.Color('#7c6c67'),brow=new T.Color('#594439');
 const white=new T.Color('#dfd8c8'),brown=new T.Color('#544031'),black=new T.Color('#241a14');
 for(let i=0;i<positions.count;i++){
   const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),side=Math.abs(x);
   let c;
   if(isEye){
     const irisDistance=Math.hypot((side-.0308)*.97,(y-1.6754)*.96);
     c=white.clone().lerp(brown,(1-smooth(irisDistance,.0058,.0084))*smooth(z,.136,.142));
     c.lerp(black,(1-smooth(irisDistance,.0025,.0039))*smooth(z,.142,.145));
   }else{
     const shaved=smooth(y,1.719+.010*(1-smooth(z,.081,.14)),1.747)*.76;
     const lipMask=Math.exp(-(((y-1.602)*187)**2+((z-.150)*113)**2))*smooth(side,0,.006)*(1-smooth(side,.022,.033));
     const browLine=1.7005+.003*Math.sin((side-.02)*77);
     const browMask=Math.exp(-(((y-browLine)*390)**2))*smooth(z,.121,.138)*
       smooth(side,.015,.026)*(1-smooth(side,.046,.053));
     const warm=smooth(side,.053,.093)*smooth(y,1.55,1.66)*(1-smooth(y,1.688,1.734));
     const mottling=1+.023*Math.sin(x*1241+y*641+z*1504)+.032*Math.sin(y*113-z*144);
     c=base.clone().lerp(ear,warm*.58).lerp(scalp,shaved).lerp(lip,lipMask*.86).lerp(brow,browMask*.68).multiplyScalar(mottling);
   }
   colors.push(c.r,c.g,c.b);
 }
 geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
}

function garment(model,maps){
 const bone=n=>model.getObjectByName(n);
 const body=model.getObjectByName('base');
 const robe=new T.MeshStandardMaterial({color:'#777678',map:maps.weave,normalMap:maps.weaveNormal,
   normalScale:new T.Vector2(.29,.29),roughness:.96,side:T.DoubleSide});
 const inner=robe.clone();inner.color.set('#aaa6a0');
 const edge=robe.clone();edge.color.set('#6a6666');
 const shoe=robe.clone();shoe.color.set('#393533');
 const skin=new T.MeshStandardMaterial({vertexColors:true,roughness:.62});
 const eyes=new T.MeshStandardMaterial({vertexColors:true,roughness:.34});
 model.traverse(o=>{
   if(!o.isMesh)return;
   const eye=o.name.includes('high-poly');
   portrait(o,eye);
   o.material=eye?eyes:skin;
   o.receiveShadow=true;o.frustumCulled=false;
 });
 const chest=bone('spine01'),waist=bone('spine04'),hip=bone('spine05');
 const torsoWeights=(x,y)=>y>1.23?[[chest,1]]:y>.91?[[chest,smooth(y,.98,1.24)],[waist,1-smooth(y,.98,1.24)]]:
   [[hip,.78],[bone(x>0?'upperleg01L':'upperleg01R'),.22]];
 function add(g,m,w){model.add(weightedMesh(g,m,body,w));}
 add(garmentTube([
   [0,.65,.016,.255,.178],[0,.70,.014,.255,.179],[0,.80,.010,.242,.161],[0,.95,.004,.207,.150],
   [0,1.02,.003,.186,.141],[0,1.11,.009,.193,.149],[0,1.25,.015,.221,.160],[0,1.35,.014,.243,.155],
   [0,1.45,.013,.207,.134],[0,1.50,.007,.124,.096],[0,1.527,.014,.083,.072]
 ]),robe,torsoWeights);
 for(const [curve,width,m] of [
   [[[-.084,1.521,.066],[-.101,1.451,.116],[-.074,1.355,.167],[.004,1.256,.178],[.112,1.165,.142]],.055,inner],
   [[[.075,1.522,.073],[.087,1.448,.132],[.053,1.353,.174],[-.018,1.275,.182],[-.108,1.178,.155],[-.144,.990,.122],[-.171,.689,.156]],.041,edge]
 ])add(lapel(curve,width),m,torsoWeights);
 for(const side of [-1,1]){
   const L=side>0?'L':'R';
   const upper=bone('upperarm01'+L),lower=bone('lowerarm01'+L),wrist=bone('wrist'+L);
   const a=upper.getWorldPosition(v()),b=lower.getWorldPosition(v()),c=wrist.getWorldPosition(v());
   add(sleeve([a,b,c],[.112,.137,.135,.116,.094]),robe,(x,y,z)=>{
     const f=minMax((Math.abs(x)-.275)/.18,0,1);
     return [[upper,1-f],[lower,f]];
   });
   const thigh=bone('upperleg01'+L),shin=bone('lowerleg01'+L),foot=bone('foot'+L);
   add(garmentTube([
     [side*.197,.082,.012,.056,.052],[side*.190,.17,.013,.069,.064],
     [side*.175,.32,.026,.096,.091],[side*.153,.50,.030,.107,.101],
     [side*.128,.69,.023,.114,.114],[side*.113,.91,-.008,.119,.124]
   ],32),robe,(x,y)=>{
     const f=smooth(y,.41,.59);return [[thigh,f],[shin,1-f]];
   });
   const footwear=new T.SphereGeometry(1,28,16).scale(.078,.051,.141).translate(side*.200,.052,.101);
   add(footwear,shoe,()=>[[foot,1]]);
 }
 return bone;
}

function boneDriver(bone,axis){
 const inverse=bone.getWorldQuaternion(new T.Quaternion()).invert(),rest=bone.quaternion.clone();
 const local=v(...axis).applyQuaternion(inverse),q=new T.Quaternion();
 return angle=>bone.quaternion.copy(rest).multiply(q.setFromAxisAngle(local,angle));
}
function alignBone(bone,child,target){
 const from=bone.getWorldPosition(v()),a=child.getWorldPosition(v()).sub(from).normalize(),b=target.clone().sub(from).normalize();
 const delta=new T.Quaternion().setFromUnitVectors(a,b);
 const q=bone.parent.getWorldQuaternion(new T.Quaternion());
 bone.quaternion.premultiply(q.clone().invert().multiply(delta).multiply(q));
 bone.updateMatrixWorld(true);
}
function reach(upper,lower,wrist,target,side){
 const a=upper.getWorldPosition(v()),b=lower.getWorldPosition(v()),c=wrist.getWorldPosition(v());
 const l=a.distanceTo(b),r=b.distanceTo(c);
 const line=target.clone().sub(a),d=minMax(line.length(),.16,l+r-.005);
 line.normalize();
 const forward=(d*d+l*l-r*r)/(2*d);
 const bend=v(side*.30,-1,.14);
 bend.addScaledVector(line,-bend.dot(line)).normalize();
 const elbow=a.clone().addScaledVector(line,forward).addScaledVector(bend,Math.sqrt(Math.max(.001,l*l-forward*forward)));
 alignBone(upper,lower,elbow);
 alignBone(lower,wrist,a.clone().addScaledVector(line,d));
}

export function addMonk(scene,model,maps,floorAt,mallet){
 const root=new T.Group();root.name='Temple monk';scene.add(root);
 root.add(model);model.updateMatrixWorld(true);
 const bone=garment(model,maps);
 const torso=boneDriver(bone('spine02'),[0,0,1]);
 const head=boneDriver(bone('head'),[1,0,0]);
 const arms=[['L',1],['R',-1]].map(([id,s])=>{
   const upper=bone('upperarm01'+id),lower=bone('lowerarm01'+id),wrist=bone('wrist'+id);
   return {s,upper,lower,wrist,upperRest:upper.quaternion.clone(),lowerRest:lower.quaternion.clone(),
     down:boneDriver(upper,[0,0,1]),forward:boneDriver(lower,[1,0,0]),
     leg:boneDriver(bone('upperleg01'+id),[1,0,0]),knee:boneDriver(bone('lowerleg01'+id),[1,0,0]),
     foot:boneDriver(bone('foot'+id),[1,0,0])};
 });
 const point=v(),heading=v(),shadow=new T.Mesh(new T.CircleGeometry(.39,32).rotateX(-Math.PI/2),
   new T.MeshBasicMaterial({color:'#29251e',transparent:true,opacity:.23,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
 shadow.position.y=.009;root.add(shadow);
 const schedule=bellSequence();
 function tick(now,frame,emit){
   const {plan,play}=schedule(now);
   const walking=plan&&plan.phase!=='ring';
   const phase=plan?.phase;
   const move=phase==='approach'?(plan.elapsed+WALK_TIME+PREPARE)/WALK_TIME:
     phase==='return'?1-(plan.elapsed-plan.last-REST)/WALK_TIME:phase==='ring'?1:0;
   routeAt(move,point,heading);
   const rhythm=walking?((phase==='return'?1-move:move)*lengths.at(-1))*8.1:0;
   const amount=walking?smooth(move,0,.055)*(1-smooth(move,.965,1)):0;
   root.position.set(point.x,floorAt(point.x,point.z),point.z);
   root.rotation.y=plan?(phase==='ring'?Math.PI:Math.atan2(heading.x,heading.z)+(phase==='return'?Math.PI:0)):1.0;
   model.position.y=amount*.024*Math.abs(Math.sin(rhythm));
   torso(.037*Math.sin(rhythm)*amount);
   head((phase==='ring'?.055:0)+.031*Math.sin(frame*.0019));
   const resting=phase==='ring';
   for(const limb of arms){
     limb.upper.quaternion.copy(limb.upperRest);
     limb.lower.quaternion.copy(limb.lowerRest);
     limb.down(-limb.s*.62);
     limb.forward(.10+amount*Math.sin(rhythm+limb.s*1.57)*.14);
     const stride=Math.sin(rhythm+limb.s*1.57);
     limb.leg(stride*.28*amount);
     limb.knee(Math.max(0,-stride)*.40*amount);
     limb.foot(-Math.max(0,stride)*.13*amount);
   }
   if(resting){
     root.updateMatrixWorld(true);
     for(const limb of arms){
       const grip=mallet.localToWorld(v(limb.s*.073,-1.62,.49+(limb.s>0?.05:-.033)));
       reach(limb.upper,limb.lower,limb.wrist,grip,-limb.s);
     }
   }
   for(const hit of play)emit(hit,plan.times.length,plan.hour);
   return plan;
 }
 return {root,tick};
}
