import * as T from './vendor/three.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {Water} from './vendor/Water.js';
import {clamp,court,mix,pond,random,river,terrainAt} from './world.js';

const TAU=Math.PI*2;
const down=new T.Vector3(0,1,0);
const v=(x,y,z)=>new T.Vector3(x,y,z);
const color=(r)=>new T.Color(r);
const sample=(r,a,b)=>mix(a,b,r());
const temp=new T.Object3D();
function combine(geometries){
 const g=mergeGeometries(geometries);
 if(!g)throw Error('Nature geometry could not be combined');
 for(const x of geometries)x.dispose();
 return g;
}

function pineModel(seed,detail){
 const rng=random(seed),branches=[],needles=[];
 function branch(points,diameter){
   const pos=[],uv=[],idx=[];
   const sides=detail?8:6;
   for(let i=0;i<points.length;i++){
     const dir=points[Math.min(i+1,points.length-1)].clone().sub(points[Math.max(0,i-1)]).normalize();
     const q=new T.Quaternion().setFromUnitVectors(down,dir);
     const d=diameter[i];
     for(let j=0;j<=sides;j++){
       const a=j*TAU/sides,r=d*(1+Math.sin(3*a+i*.76)*.09);
       const p=v(r*Math.cos(a),0,r*Math.sin(a)).applyQuaternion(q).add(points[i]);
       pos.push(p.x,p.y,p.z);
       uv.push(j/sides,i*.44);
       if(i&&j){
         const k=i*(sides+1)+j;
         idx.push(k-sides-2,k-1,k,k-sides-2,k,k-sides-1);
       }
     }
   }
   const g=new T.BufferGeometry();
   g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
   branches.push(g.toNonIndexed());g.dispose();
 }
 function card(start,end,spin,tint,width){
   const direction=end.clone().sub(start);
   const n=direction.clone().normalize();
   const base=new T.Quaternion().setFromUnitVectors(down,n);
   const length=direction.length();
   const g=new T.PlaneGeometry(width,length,1,1);
   g.rotateY(spin);
   g.applyQuaternion(base);
   g.translate(...start.clone().lerp(end,.5).toArray());
   const col=[];
   for(let j=0;j<4;j++)col.push(tint.r,tint.g,tint.b);
   g.setAttribute('color',new T.Float32BufferAttribute(col,3));
   needles.push(g.toNonIndexed());g.dispose();
 }
 const top=[v(0,0,0),v(-.09,1.13,.08),v(.13,2.27,.03),v(.09,3.40,-.15),v(.35,4.40,-.26),v(.19,5.18,-.32),v(.34,5.88,-.29),v(.44,6.25,-.18)];
 branch(top,[.23,.17,.13,.105,.075,.055,.028,.008]);
 for(let j=0;j<6;j++){
   const a=j*TAU/6;
   branch([v(Math.cos(a)*.52,-.013,Math.sin(a)*.52),v(Math.cos(a)*.24,.07,Math.sin(a)*.24),v(0,.37,0)],[.018,.09,.15]);
 }
 const mainCount=detail?17:11;
 for(let i=0;i<mainCount;i++){
   const f=(i+.65)/mainCount;
   const h=2.1+f*3.95;
   const near=top.findIndex(p=>p.y>h);
   const start=top[near-1].clone().lerp(top[near],(h-top[near-1].y)/(top[near].y-top[near-1].y));
   const a=i*2.39996+sample(rng,-.39,.39);
   const dir=v(Math.cos(a),0,Math.sin(a));
   const side=v(-dir.z,0,dir.x);
   const length=(.56+2.32*(1-f)**.83)*sample(rng,.68,1.22);
   const mid=start.clone().addScaledVector(dir,length*.47).add(v(0,sample(rng,-.19,.19),0));
   const tip=start.clone().addScaledVector(dir,length).addScaledVector(side,sample(rng,-.45,.45)).add(v(0,sample(rng,.12,.54),0));
   branch([start,mid,tip],[.11*(1-f)+.029,.045*(1-f)+.014,.010]);
   const twigs=detail?12:7;
   for(let j=0;j<twigs;j++){
     const t=(j+.82)/(twigs+.2);
     const base=mid.clone().lerp(tip,t);
     const n=sample(rng,.22,.73)*(1-.46*t);
     const c=base.clone().addScaledVector(side,(j%2===0?-1:1)*n).addScaledVector(dir,n*.39).add(v(0,sample(rng,.06,.31),0));
     if(detail)branch([base,c],[.018,.004]);
     const sprouts=detail?7:4;
     for(let k=0;k<sprouts;k++){
       const m=(k+.42)/sprouts;
       const b=base.clone().lerp(c,m);
       b.addScaledVector(dir,sample(rng,-.14,.19));
       const angle=a+sample(rng,-1.75,1.75),sz=sample(rng,.31,.78);
       const e=b.clone().add(v(Math.cos(angle)*sz*.68,sz*sample(rng,.34,.74),Math.sin(angle)*sz*.68));
       const tint=color('#ffffff').multiplyScalar(sample(rng,.64,1.21));
       tint.g*=sample(rng,.96,1.06);
       card(b,e,rng()*TAU,tint,sz*.55);
       if(detail&&k%2===0)card(b,e,Math.PI/2+rng()*TAU,tint,sz*.48);
     }
   }
 }
 return {bark:combine(branches),needles:combine(needles)};
}

function instance(scene,geometry,material,items,shadow){
 if(!items.length)return;
 const mesh=new T.InstancedMesh(geometry,material,items.length);
 items.forEach(({x,y,z,scale,angle},i)=>{
   temp.position.set(x,y,z);temp.rotation.set(0,angle,0);temp.scale.setScalar(scale);temp.updateMatrix();
   mesh.setMatrixAt(i,temp.matrix);
 });
 mesh.castShadow=shadow;mesh.receiveShadow=true;
 mesh.computeBoundingSphere();
 scene.add(mesh);
}

function batchInstances(scene,geometry,material,items){
 const buckets=new Map();
 for(const item of items){
   const key=Math.floor(item.x/21)+','+Math.floor(item.z/21);
   if(!buckets.has(key))buckets.set(key,[]);
   buckets.get(key).push(item);
 }
 for(const chunk of buckets.values()){
   const shade=chunk.some(p=>Math.abs(p.x)<38&&Math.abs(p.z)<36);
   instance(scene,geometry,material,chunk,shade);
 }
}

function batchMaple(scene,model,positions){
 model.updateMatrixWorld(true);
 const bounds=new T.Box3().setFromObject(model);
 const center=bounds.getCenter(v(0,0,0));
 const byMaterial=new Map();
 model.traverse(obj=>{
   if(!obj.isMesh)return;
   const mat=obj.material;
   if(!byMaterial.has(mat.id))byMaterial.set(mat.id,{mat,geometries:[]});
   const g=obj.geometry.clone().applyMatrix4(obj.matrixWorld);
   g.translate(-center.x,-bounds.min.y,-center.z);
   if(g.getAttribute('tangent'))g.deleteAttribute('tangent');
   byMaterial.get(mat.id).geometries.push(g.index?g.toNonIndexed():g);
 });
 for(const {mat,geometries} of byMaterial.values()){
   const mesh=combine(geometries);
   mat.roughness=.82;
   mat.metalness=0;
   if(mat.name.includes('foliage'))mat.side=T.DoubleSide;
   batchInstances(scene,mesh,mat,positions);
 }
}

export function plantForest(scene,world,maps,maple){
 const rng=random(81205);
 const pinePositions=[[],[],[]],maples=[],trees=[];
 const place=(x,z,s,kind,near=false)=>{
   const inYard=x>court.left&&x<court.right&&z>court.north&&z<court.south;
   const y=inYard?1.11:terrainAt(x,z);
   const item={x,y,z,scale:s,angle:rng()*TAU};
   if(kind==='maple')maples.push(item);
   else pinePositions[near?(rng()<.5?0:1):2].push(item);
   const width=(kind==='maple'?.58:.49)*s;
   world.solids.push({x,z,w:width,d:width,door:null});
   trees.push([x,z]);
 };
 for(const [x,z,s,k] of [
   [-20,-18,.93,'pine'],[13,-19,.87,'pine'],[-21.2,8.2,1.13,'maple'],[-11.2,15.85,1.02,'maple'],[12.7,14.35,1.15,'maple'],
   [-17.25,-7.75,.78,'pine'],[5.45,-3.36,.79,'maple'],[-10.2,23.9,1.13,'pine'],[6.5,23.2,1.08,'maple'],[-25.4,19.4,1.17,'pine'],
   [18.8,8.7,.88,'pine'],[19.3,-13.3,1.01,'pine'],[-29.3,-9.0,.95,'maple'],[13.9,1.08,.70,'pine'],
   [-19.0,-3.7,.82,'pine'],[-25.7,-23.7,1.09,'pine'],[9.45,-25.4,1.10,'pine'],[-1.6,-29.9,1.09,'pine']
 ])place(x,z,s,k,true);
 for(let i=0;i<1600&&trees.length<159;i++){
   const x=sample(rng,-63,64),z=sample(rng,-65,58);
   if((court.left-2.4<x&&x<court.right+2.4&&court.north-2.4<z&&z<23)||(z>20&&x>-8&&x<8)||Math.abs(x-river(z))<7.3)continue;
   if(trees.some(([a,b])=>(a-x)**2+(b-z)**2<10.4))continue;
   const k=maples.length<11&&rng()<.13?'maple':'pine';
   place(x,z,sample(rng,.52,1.34),k,Math.abs(x)<32&&Math.abs(z)<36);
 }
 const bark=new T.MeshStandardMaterial({map:maps.bark,bumpMap:maps.bark,bumpScale:.067,roughness:.90,color:'#c7ac90'});
 const needles=new T.MeshStandardMaterial({map:maps.needles,alphaTest:.37,vertexColors:true,side:T.DoubleSide,roughness:.88,color:'#c5d69a'});
 for(let i=0;i<3;i++){
   const model=pineModel(1472+i*131,i!==2);
   batchInstances(scene,model.bark,bark,pinePositions[i]);
   batchInstances(scene,model.needles,needles,pinePositions[i]);
 }
 batchMaple(scene,maple,maples);
 return {pines:pinePositions.reduce((s,a)=>s+a.length,0),maples:maples.length};
}

function coloredSurface(segmentsU,segmentsV,pointAt){
 const ps=[],cs=[],uv=[],idx=[];
 for(let i=0;i<=segmentsU;i++)for(let j=0;j<=segmentsV;j++){
   const u=i/segmentsU,t=j/segmentsV;
   const [p,c]=pointAt(u,t);
   ps.push(p.x,p.y,p.z);cs.push(c.r,c.g,c.b);uv.push(u,t);
   if(i&&j){
     const k=i*(segmentsV+1)+j;
     idx.push(k-segmentsV-2,k-1,k,k-segmentsV-2,k,k-segmentsV-1);
   }
 }
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(ps,3));
 g.setAttribute('color',new T.Float32BufferAttribute(cs,3));
 g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 g.setIndex(idx);g.computeVertexNormals();
 const out=g.toNonIndexed();g.dispose();return out;
}
function plantLotus(scene){
 const rng=random(92710),leaves=[],petals=[],stems=[],seeds=[],pollen=[];
 const leafBase=color('#657d3e'),leafOuter=color('#365d39'),leafVein=color('#b1a75d');
 const petalBase=color('#f5d0a3'),petalMiddle=color('#f4b6bf'),petalTip=color('#b24f78'),cream=color('#f9ded1');
 const ring=new T.SphereGeometry(1,8,5);
 function rod(a,b,radius,set){
   const start=a.clone(),d=b.clone().sub(a);
   const g=new T.CylinderGeometry(radius*.64,radius,d.length(),6);
   g.applyQuaternion(new T.Quaternion().setFromUnitVectors(down,d.normalize())).translate(...start.add(b).multiplyScalar(.5).toArray());
   set.push(g.toNonIndexed());g.dispose();
 }
 function sphere(cx,cy,cz,a,b,c,set){
   const g=ring.clone().scale(a,b,c).translate(cx,cy,cz);
   set.push(g.toNonIndexed());g.dispose();
 }
 for(let i=0;i<36;i++){
   const angle=i*2.39996;
   const r=.17+.70*Math.sqrt((i+.4)/36);
   const x=pond.x+Math.cos(angle)*pond.rx*r,z=pond.z+Math.sin(angle)*pond.rz*r;
   if(Math.abs(x+15.68)<.78)continue;
   const radius=sample(rng,.21,.51),y=pond.y+sample(rng,.016,.19);
   const leanX=sample(rng,-.18,.18),leanZ=sample(rng,-.16,.16),rot=rng()*TAU;
   leaves.push(coloredSurface(38,8,(u,t)=>{
     const a=u*TAU;
     const gap=.82+.18*Math.sin(a*4.2+rot)**2;
     const dr=radius*t*(.93+.058*Math.cos(a*5+rot)+.035*Math.sin(a*11))*gap;
     const yy=y+.046*Math.sin(t*Math.PI)+.041*t**3*Math.cos(a*4.5+rot)+leanX*Math.cos(a)*t+leanZ*Math.sin(a)*t;
     const vein=Math.pow(Math.max(0,Math.cos(a*13+.40*Math.sin(t*3))),28)*(1-.29*t);
     const c=leafBase.clone().lerp(leafOuter,t*.66).lerp(leafVein,.27*vein);
     c.multiplyScalar(.94+.09*Math.cos(18*t+a*4)*(.35+.65*t));
     return [v(x+dr*Math.cos(a),yy,z+dr*Math.sin(a)),c];
   }));
   if(y>pond.y+.075)rod(v(x-.06,.89,z-.05),v(x,y,z),.013,stems);
 }
 const placements=[[-18.24,13.76,.97],[-17.44,15.76,1.06],[-14.23,13.52,.86],[-12.99,15.49,.91],[-16.75,16.59,.91],[-17.79,12.99,.70],[-13.43,14.41,.67],[-17.16,14.78,.69],[-14.19,16.25,.75]];
 for(const [x,z,scale] of placements){
   const y=pond.y+sample(rng,.25,.45),rot=rng()*TAU;
   rod(v(x-.15,.86,z+.09),v(x,y,z),.016*scale,stems);
   for(let layer=0;layer<4;layer++){
     const count=[12,11,9,7][layer];
     for(let j=0;j<count;j++){
       const angle=rot+(j+layer*.46)*TAU/count+sample(rng,-.066,.066);
       const length=scale*[.39,.337,.274,.185][layer]*sample(rng,.88,1.10);
       const rise=scale*[.101,.154,.205,.205][layer]*sample(rng,.91,1.11);
       const width=scale*[.087,.078,.068,.055][layer];
       const pink=sample(rng,.83,1.17);
       const tilt=sample(rng,-.075,.075);
       petals.push(coloredSurface(12,8,(u,s)=>{
         const v0=2*s-1;
         const outline=Math.max(.02,Math.sin(Math.PI*(u*.98+.008))**.89);
         const w=width*v0*outline;
         const radial=.027+length*(.12*u+.88*u**.85)-Math.abs(v0)**1.75*outline*.021;
         const lift=rise*(u*.55+u**2*.47)+w*w/(width+.001)*(.52+layer*.12);
         const motion=tilt*Math.sin(Math.PI*u)*v0+.004*Math.sin(u*21+s*12)*outline;
         const p=v(x+Math.cos(angle)*radial-Math.sin(angle)*w,y+.011*layer+lift+motion,z+Math.sin(angle)*radial+Math.cos(angle)*w);
         const c=petalBase.clone().lerp(petalMiddle,clamp(u*1.65,0,1));
         const ribs=Math.pow(Math.max(0,Math.cos(s*36+u*1.6)),10)*Math.sin(Math.PI*u);
         c.lerp(cream,.32*ribs+.23*Math.max(0,1-Math.abs(v0)*2)*(1-u));
         c.lerp(petalTip,clamp((u-.57)*1.37* pink+Math.abs(v0)**5*.15,0,.72));
         return [p,c];
       }));
     }
   }
   const core=y+.137*scale;
   const pod=new T.CylinderGeometry(.079*scale,.039*scale,.058*scale,16,2).translate(x,core,z);
   seeds.push(pod.toNonIndexed());pod.dispose();
   for(let j=0;j<28;j++){
     const angle=j*TAU/28;
     const rad=scale*(.099+sample(rng,-.015,.014));
     const a=v(x+Math.cos(angle)*rad*.65,y+.096*scale,z+Math.sin(angle)*rad*.65);
     const b=v(x+Math.cos(angle)*rad,y+.168*scale+sample(rng,.0,.041)*scale,z+Math.sin(angle)*rad);
     rod(a,b,.0029,pollen);
     sphere(b.x,b.y,b.z,.006,.009,.005,pollen);
   }
   for(let j=0;j<8;j++){
     const a=j*TAU/8;
     sphere(x+.053*Math.cos(a)*scale,core+.030*scale,z+.053*Math.sin(a)*scale,.008,.003,.008,stems);
   }
 }
 function add(geo,mat){
   const m=new T.Mesh(combine(geo),mat);
   m.castShadow=true;m.receiveShadow=true;scene.add(m);
 }
 add(leaves,new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.44,metalness:.02}));
 add(petals,new T.MeshPhysicalMaterial({vertexColors:true,side:T.DoubleSide,roughness:.67,sheen:.24,sheenColor:'#fed5d8',sheenRoughness:.79}));
 add(stems,new T.MeshStandardMaterial({color:'#68723f',roughness:.88}));
 add(seeds,new T.MeshStandardMaterial({color:'#bd9d52',roughness:.87}));
 add(pollen,new T.MeshStandardMaterial({color:'#eac469',roughness:.81}));
 return placements.length;
}

function riverPlane(){
 const pos=[],idx=[];
 for(let i=0;i<=112;i++){
   const z=-58+i;
   const center=river(z),w=5.18+.24*Math.sin(z*.49)+.16*Math.cos(z*.78);
   pos.push(center-w,-z,0,center+w,-z,0);
   if(i){const p=i*2;idx.push(p-2,p,p-1,p,p+1,p-1);}
 }
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
 g.setIndex(idx);g.computeVertexNormals();
 return g;
}

export function addWater(scene,maps,lightDirection){
 let reflectionPass=false;
 const waters=[];
 const lakeShape=new T.CircleGeometry(1,88).scale(pond.rx,pond.rz,1);
 const entries=[
   {shape:lakeShape,x:pond.x,y:pond.y,z:pond.z,alpha:.71,color:'#2e5c43',width:384,height:256,scale:1.5,rate:.46,near:23},
   {shape:riverPlane(),x:0,y:-.63,z:0,alpha:.78,color:'#4b7f69',width:384,height:208,scale:1.02,rate:.78,near:35}
 ];
 for(const data of entries){
   const water=new Water(data.shape,{textureWidth:data.width,textureHeight:data.height,clipBias:.0018,
     waterNormals:maps.ripples,sunDirection:lightDirection.clone(),sunColor:'#ffdfad',waterColor:data.color,
     distortionScale:data.scale,alpha:data.alpha,fog:true});
   water.rotation.x=-Math.PI/2;
   water.position.set(data.x,data.y,data.z);
   water.material.transparent=true;water.material.depthWrite=false;
   water.material.uniforms.size.value=data.rate;
   water.receiveShadow=true;
   water.renderOrder=2;
   water.userData.distance=data.near;
   scene.add(water);
   waters.push(water);
   const mirror=water.onBeforeRender;
   let lastFrame=-1;
   const lastPosition=new T.Vector3(Infinity,0,0);
   const lastRotation=new T.Quaternion(0,0,0,0);
   water.onBeforeRender=(renderer,scene0,camera)=>{
     if(reflectionPass)return;
     const frame=renderer.info.render.frame;
     const delta=lastPosition.distanceToSquared(camera.position);
     const turned=1-Math.abs(lastRotation.dot(camera.quaternion));
     const distance=water===waters[0]
       ?Math.hypot(camera.position.x-pond.x,camera.position.z-pond.z)
       :Math.abs(camera.position.x-river(camera.position.z));
     water.material.uniforms.eye.value.copy(camera.position);
     if(lastFrame>=0 && (frame-lastFrame<3 || (delta<.0006&&turned<.00003)))return;
     if(distance>water.userData.distance&&lastFrame>=0)return;
     reflectionPass=true;
     const other=waters.find(x=>x!==water);
     const wasVisible=other?.visible;
     if(other)other.visible=false;
     try{
       mirror(renderer,scene0,camera);
       lastPosition.copy(camera.position);lastRotation.copy(camera.quaternion);lastFrame=frame;
     }finally{
       if(other)other.visible=wasVisible;
       reflectionPass=false;
     }
   };
 }
 return {waters,lotusCount:plantLotus(scene)};
}
