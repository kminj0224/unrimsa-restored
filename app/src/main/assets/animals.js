import * as T from './vendor/three.js';

const TAU=Math.PI*2;
const UP=new T.Vector3(0,1,0);
const shaft=new T.CylinderGeometry(1,1,1,9);
const shadow=new T.CircleGeometry(1,32).rotateX(-Math.PI/2);
const furTone=new T.Color('#e9dcca');

function contacts(parent,w,d,opacity){
 for(let i=0;i<4;i++){
   const material=new T.MeshBasicMaterial({
     color:'#28231d',transparent:true,depthWrite:false,opacity:opacity*(1+i*.19),
     polygonOffset:true,polygonOffsetFactor:-1
   });
   const mesh=new T.Mesh(shadow,material);
   mesh.position.y=.009+i*.001;
   mesh.scale.set(w*(1-i*.17),1,d*(1-i*.17));
   parent.add(mesh);
 }
}
function makeRoot(scene,name){
 const root=new T.Group();root.name=name;scene.add(root);return root;
}
function finishModel(model){
 model.traverse(object=>{
   if(!object.isMesh)return;
   object.receiveShadow=true;
 });
}
function weight(x,y,z,dog){
 const leg=1-T.MathUtils.smoothstep(y,dog?.09:.054,dog?.455:.229);
 const side=x>(dog?0:-.023);
 const front=z>0;
 return {leg,diagonal:side===front?1:-1};
}
function gait(mesh,dog){
 const geometry=mesh.geometry;
 const positions=geometry.getAttribute('position');
 const count=positions.count;
 const stride=new Float32Array(count*3),leftLift=new Float32Array(count*3),rightLift=new Float32Array(count*3);
 for(let i=0;i<count;i++){
   const {leg,diagonal}=weight(positions.getX(i),positions.getY(i),positions.getZ(i),dog);
   stride[i*3+2]=leg*diagonal*(dog?.112:.068);
   (diagonal===1?leftLift:rightLift)[i*3+1]=leg*(dog?.092:.061);
 }
 geometry.morphTargetsRelative=true;
 geometry.morphAttributes.position=[stride,leftLift,rightLift].map(data=>new T.BufferAttribute(data,3));
 mesh.updateMorphTargets();
 return (phase,pace)=>{
   const wave=Math.sin(phase),lift=Math.cos(phase);
   mesh.morphTargetInfluences[0]=wave*pace;
   mesh.morphTargetInfluences[1]=Math.max(0,lift)*pace;
   mesh.morphTargetInfluences[2]=Math.max(0,-lift)*pace;
 };
}
function catModel(parent,source){
 const root=makeRoot(parent,'Tabby cat');
 const body=source.clone(true);
 const skin=body.getObjectByName('cat');
 skin.geometry=skin.geometry.clone().rotateY(.78);
 const step=gait(skin,false);
 root.add(body);
 finishModel(body);
 contacts(root,.16,.26,.068);
 return {root,pose(t,pace,near,reaction=0){
   const phase=t*9.2;
   step(phase,pace);
   body.position.y=.004*Math.sin(t*2.5)+.008*pace*Math.abs(Math.cos(phase));
   body.rotation.z=.025*Math.sin(phase)*pace;
   body.rotation.x=reaction*.14;
   body.scale.y=1+.015*Math.sin(t*2.2);
 }};
}
function guardHair(material,texture,coatPhoto){
 material.color.copy(furTone);
 material.roughness=.89;
 material.onBeforeCompile=shader=>{
   shader.uniforms.coatMap={value:texture};
   shader.uniforms.coatPhoto={value:coatPhoto??texture};
   shader.uniforms.coatPhotoWeight={value:coatPhoto?1:0};
   shader.vertexShader=shader.vertexShader
     .replace('#include <common>','#include <common>\nvarying vec3 furPosition;')
     .replace('#include <begin_vertex>','#include <begin_vertex>\nfurPosition = position;');
   shader.fragmentShader=shader.fragmentShader
     .replace('#include <common>','#include <common>\nvarying vec3 furPosition;\nuniform sampler2D coatMap;\nuniform sampler2D coatPhoto;\nuniform float coatPhotoWeight;')
     .replace('#include <color_fragment>',`#include <color_fragment>
       vec3 p=furPosition;
       vec3 coatNormal=normalize(cross(dFdx(p),dFdy(p)));
       float u=p.x*1840.0+p.y*120.0+sin(p.z*50.0)*.85;
       float v=p.z*1550.0-p.y*245.0+sin(p.x*37.0)*1.3;
       float f1=sin(u+sin(p.z*120.0)*1.5);
       float f2=sin(v+sin(p.x*145.0)*1.4);
       float detail=mix(f1,f2,smoothstep(.2,.7,abs(coatNormal.x)));
       float fade=1.0-smoothstep(.65,5.0,max(fwidth(u),fwidth(v)));
       float lowerBand=sin(p.z*230.0+p.x*190.0+sin(p.y*95.0)*2.0);
       vec3 blend=pow(abs(coatNormal)+.001,vec3(4.0));
       blend/=dot(blend,vec3(1.0));
       vec3 strandX=texture2D(coatMap,vec2(p.z*3.6,p.y*2.9-p.z*.7)).rgb;
       vec3 strandY=texture2D(coatMap,vec2(p.x*3.6,p.z*2.9)).rgb;
       vec3 strandZ=texture2D(coatMap,vec2(p.x*3.6,p.y*2.9)).rgb;
       vec3 albedo=strandX*blend.x+strandY*blend.y+strandZ*blend.z;
       float fine=dot(albedo,vec3(.24,.65,.11));
       vec2 sideUV=clamp(vec2((p.z+.50)/1.24,p.y/1.15),.003,.997);
       vec2 faceUV=clamp(vec2((p.x+.205)/.410,(p.y-.64)/.51),.003,.997);
       vec3 sideCoat=texture2D(coatPhoto,vec2(sideUV.x,.5+sideUV.y*.5)).rgb;
       vec3 faceCoat=texture2D(coatPhoto,vec2(faceUV.x,faceUV.y*.5)).rgb;
       float front=smoothstep(.30,.86,coatNormal.z)*smoothstep(.31,.55,p.z)*smoothstep(.64,.77,p.y);
       vec3 photoCoat=mix(sideCoat,faceCoat,front);
       diffuseColor.rgb=mix(diffuseColor.rgb,photoCoat,coatPhotoWeight*.83);
       diffuseColor.rgb*=(.76+.43*fine)*(1.0+fade*.045*detail+lowerBand*.011);
     `);
 };
 return material;
}
function coatStrands(skin,count,tail=false){
 const vertices=skin.geometry.getAttribute('position'),normals=skin.geometry.getAttribute('normal');
 const positions=[],colors=[];
 const p=new T.Vector3(),n=new T.Vector3(),tangent=new T.Vector3(),cross=new T.Vector3();
 let seed=1913;
 const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 for(let i=0;i<count;i++){
   const index=Math.floor(rand()*vertices.count);
   p.fromBufferAttribute(vertices,index);
   n.fromBufferAttribute(normals,index);
   if(!tail&&(p.y<.095||(p.z>.50&&p.y>.72)))continue;
   const long=tail?.014+rand()*.018:.004+rand()*.010*(p.y>.43?1:.46);
   tangent.set(0,-.69,-.72).addScaledVector(n,-(n.y*-.69+n.z*-.72));
   tangent.normalize();
   cross.crossVectors(tangent,n).normalize().multiplyScalar(long*.074);
   const base=p.clone().addScaledVector(n,.0007);
   const tip=base.clone().addScaledVector(tangent,long).addScaledVector(n,long*(tail?.41:.28));
   positions.push(...base.clone().sub(cross).toArray(),...base.add(cross).toArray(),...tip.toArray());
   const gray=.72+rand()*.19;
   colors.push(gray,gray*.92,gray*.78,gray,gray*.92,gray*.78,gray*1.1,gray*1.03,gray*.89);
 }
 const geo=new T.BufferGeometry();
 geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
 geo.computeVertexNormals();
 const material=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.91});
 const coat=new T.Mesh(geo,material);coat.receiveShadow=true;
 skin.add(coat);
 return coat;
}
function reshapeJindo(mesh){
 mesh.geometry=mesh.geometry.clone();
 const points=mesh.geometry.getAttribute('position');
 for(let i=0;i<points.count;i++){
   const x=points.getX(i),y=points.getY(i),z=points.getZ(i);
   const ear=T.MathUtils.smoothstep(y,.916,1.14);
   const cheek=T.MathUtils.smoothstep(y,.62,.83)*(1-T.MathUtils.smoothstep(y,.88,.98));
   const face=T.MathUtils.smoothstep(z,.35,.51);
   points.setXYZ(i,x*(1+.10*cheek*face)-Math.sign(x)*ear*.024,y-ear*.032,z-ear*.027);
 }
 mesh.geometry.computeVertexNormals();
 mesh.geometry.computeBoundingSphere();
}
function dogModel(parent,source,texture,coatPhoto){
 const root=makeRoot(parent,'Jindo');
 const body=source.clone(true);
 const skin=body.getObjectByName('JindoBody');
 reshapeJindo(skin);
 body.traverse(mesh=>{
   if(!mesh.isMesh)return;
   if(mesh.name.startsWith('Pinna inset')){
     reshapeJindo(mesh);
     mesh.material=mesh.material.clone();
     mesh.material.color.set('#947a67');
     mesh.material.roughness=.94;
   }
   if(mesh.name.startsWith('Eye')||mesh.name.startsWith('Pupil')||mesh.name.startsWith('Upper and lower eye rim')){
     const side=Math.sign(mesh.position.x);
     mesh.position.x+=side*.009;
     mesh.scale.y*=.75;
     mesh.scale.z*=.76;
     mesh.rotateZ(side*.18);
   }
   if(mesh.name==='Nose leather'){
     mesh.material=mesh.material.clone();
     mesh.material.roughness=.51;
     mesh.scale.y*=.90;
   }
 });
 const step=gait(skin,true);
 const tail=body.getObjectByName('JindoTail');
 const pivot=new T.Group();
 pivot.position.set(0,.624,-.423);
 body.add(pivot);
 pivot.attach(tail);
 skin.material=guardHair(skin.material.clone(),texture,coatPhoto);
 tail.material=guardHair(tail.material.clone(),texture);
 const strands=coatStrands(skin,9200),tailStrands=coatStrands(tail,2300,true);
 const moveStrands=gait(strands,true);
 const claws=[];
 body.traverse(o=>{
   if(o.name.startsWith('Claw'))claws.push([o,o.position.clone()]);
 });
 finishModel(body);
 body.scale.setScalar(.87);
 root.add(body);
 contacts(root,.25,.50,.070);
 const collar=new T.Group();
 collar.position.set(0,.719,.369);
 collar.rotation.x=.42;
 const leather=new T.MeshStandardMaterial({color:'#574030',roughness:.8});
 const brass=new T.MeshStandardMaterial({color:'#ab9870',roughness:.42,metalness:.64});
 const band=new T.Mesh(new T.TorusGeometry(.134,.017,10,42),leather);
 band.scale.y=1.17;collar.add(band);
 const metalRing=new T.Mesh(new T.TorusGeometry(.023,.004,8,18),brass);
 metalRing.position.set(.111,.083,-.025);metalRing.rotation.y=.5;collar.add(metalRing);
 body.add(collar);
 return {root,ring:metalRing,pose(t,pace,near,reaction=0){
   const phase=t*7.2;
   step(phase,pace);
   strands.visible=tailStrands.visible=near;
   if(near)moveStrands(phase,pace);
   for(const [n,base] of claws){
     const {leg,diagonal}=weight(base.x,base.y,base.z,true);
     n.position.set(base.x,base.y+Math.max(0,Math.cos(phase)*diagonal)*leg*.092*pace,
       base.z+Math.sin(phase)*leg*.112*pace*diagonal);
   }
   body.position.y=.005*Math.sin(t*3)+Math.abs(Math.cos(phase))*.011*pace;
   body.rotation.z=Math.sin(phase)*.016*pace;
   body.rotation.x=reaction*.12;
   pivot.rotation.y=(.24+.16*reaction)*Math.sin(t*(4.5+reaction*2.7));
   pivot.rotation.x=.066*Math.sin(t*3.4);
 }};
}
function sparrowPlumage(material){
 material.onBeforeCompile=shader=>{
   shader.vertexShader=shader.vertexShader
     .replace('#include <common>','#include <common>\nvarying vec3 plumagePosition;')
     .replace('#include <begin_vertex>','#include <begin_vertex>\nplumagePosition=position;');
   shader.fragmentShader=shader.fragmentShader
     .replace('#include <common>','#include <common>\nvarying vec3 plumagePosition;')
     .replace('#include <color_fragment>',`#include <color_fragment>
       vec3 p=plumagePosition;
       float head=smoothstep(.012,.032,p.x);
       float crown=head*smoothstep(.067,.080,p.y);
       float cheeks=head*smoothstep(.008,.015,abs(p.z))*smoothstep(.051,.059,p.y)*(1.0-smoothstep(.071,.078,p.y));
       vec3 spot=(vec3(p.x,p.y,abs(p.z))-vec3(.035,.063,.018))/vec3(.0059,.0052,.013);
       float cheekMark=(1.0-smoothstep(.72,1.25,length(spot)))*cheeks;
       vec3 warm=vec3(.251,.103,.047);
       diffuseColor.rgb=mix(diffuseColor.rgb,warm,crown*.84);
       diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.61,.53,.42),cheeks*.90);
       diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.043,.030,.022),cheekMark*.94);
       float fibers=sin(p.x*4060.0+p.y*1680.0+sin(p.z*1170.0)*1.2);
       float row=sin(p.y*1650.0+p.z*2200.0+sin(p.x*690.0)*1.1);
       float fade=1.0-smoothstep(.05,.78,max(fwidth(fibers),fwidth(row)));
       diffuseColor.rgb*=1.0+(.075*fibers+.055*row)*fade;
     `);
 };
}
function birdModel(parent,source,x,y,z,seed){
 const root=makeRoot(parent,'Tree sparrow');
 const body=source.clone(true);
 body.rotation.y=-Math.PI/2;
 body.scale.setScalar(1.22);
 root.add(body);finishModel(body);
 body.traverse(object=>{
   if(object.isMesh&&object.material.name.startsWith('Authored sparrow coat'))sparrowPlumage(object.material);
 });
 const wings=[];
 for(const name of ['WingLeft','WingRight']){
   const wing=body.getObjectByName(name);
   // The downloaded bird's beak is on +X, with its wings on the two sides of Z.
   wing.geometry?.computeBoundingBox();
   const local=wing.geometry?.boundingBox;
   const side=local?Math.sign(local.min.z+local.max.z):name==='WingLeft'?-1:1;
   const hinge=new T.Group();
   hinge.position.set(.009,.053,side*.012);
   body.add(hinge);
   body.updateMatrixWorld(true);
   hinge.attach(wing);
   wings.push({hinge,side});
 }
 return t=>{
   const elapsed=(t+seed)%23;
   const flying=elapsed>11.3;
   const phase=flying?(elapsed-11.3)/11.7:0;
   const theta=phase*TAU;
   const hop=Math.max(0,Math.sin(elapsed*5.0))**14*.033;
   const altitude=flying?1.06*Math.sin(Math.PI*phase)**1.25:hop;
   const extension=flying?Math.min(1,phase*13,(1-phase)*15):0;
   root.position.set(x+Math.sin(theta)*1.76,y+altitude,z+(1-Math.cos(theta))*1.28);
   root.rotation.y=flying?Math.atan2(1.76*Math.cos(theta),1.28*Math.sin(theta)):
     seed+.36*Math.sin(elapsed*1.4);
   const peck=Math.max(0,Math.sin(elapsed*3.1))**9;
   root.rotation.x=flying?-.19*Math.cos(Math.PI*phase):.18*peck;
   for(const {hinge,side} of wings){
     hinge.rotation.y=side*1.27*extension;
     hinge.rotation.x=-side*(.74*Math.sin(t*33.0)+.13)*extension;
   }
 };
}

export function addAnimals(scene,ground,models,furTexture,actions=[],coatPhoto){
 const group=makeRoot(scene,'Temple animals');
 const dog=dogModel(group,models.jindo,furTexture,coatPhoto);
 const cat=catModel(group,models.cat);
 const peg=new T.Vector3(-20.11,ground(-20.11,-5.03)+.42,-5.03);
 const ropeMaterial=new T.MeshStandardMaterial({color:'#776544',roughness:1});
 const rope=Array.from({length:20},()=>{
   const mesh=new T.Mesh(shaft,ropeMaterial);
   mesh.receiveShadow=true;group.add(mesh);return mesh;
 });
 const ropePoints=Array.from({length:rope.length+1},()=>new T.Vector3());
 const end=new T.Vector3(),axis=new T.Vector3();
 const sparrows=[
   birdModel(group,models.sparrow,-11.37,ground(-11.37,12.2),12.2,1.5),
   birdModel(group,models.sparrow,-10.75,ground(-10.75,11.3),11.3,4.2),
   birdModel(group,models.sparrow,2.2,ground(2.2,8.7),8.7,6.9)
 ];
 const pets=[
   {id:'dog',label:'진돗개',animal:dog,x:-19.57,z:-3.91,rx:.83,rz:.45,speed:.26,pace:.48,clock:0},
   {id:'cat',label:'고양이',animal:cat,x:-13.7,z:7.94,rx:1.13,rz:.74,speed:.31,pace:.66,clock:0}
 ];
 const food=new T.Group();scene.add(food);food.visible=false;
 const plate=new T.Mesh(new T.LatheGeometry([[.015,0],[.075,0],[.103,.019],[.098,.027],[.088,.028],[.074,.008]]
   .map(([x,y])=>new T.Vector2(x,y)),28),new T.MeshStandardMaterial({color:'#79765d',roughness:.56}));
 food.add(plate);
 const bites=new T.Group();food.add(bites);
 const kibble=new T.MeshStandardMaterial({color:'#875430',roughness:.92});
 const nugget=new T.DodecahedronGeometry(.011,0);
 for(let i=0;i<11;i++){
   const piece=new T.Mesh(nugget,kibble),a=i*2.39996,r=.016+.005*i;
   piece.position.set(Math.cos(a)*r,.017,Math.sin(a)*r);piece.rotation.set(i*.77,i*1.37,i*.6);
   bites.add(piece);
 }
 for(const pet of pets){
   pet.action={id:'pet:'+pet.id,name:pet.label+'와 교감하기',x:pet.x,z:pet.z,y:1.5,dist:2.0};
   actions.push(pet.action);
 }
 let t=0,feeding=null;
 function interact(id,kind,viewer){
   const pet=pets.find(p=>p.id===id);
   if(!pet||!viewer||Math.hypot(viewer.x-pet.action.x,viewer.z-pet.action.z)>pet.action.dist+.2)return null;
   if(pet.until>t)return '잠시 기다려 주세요.';
   if(kind==='feed'&&feeding)return '다른 동물이 먹이를 먹고 있습니다.';
   pet.kind=kind;pet.begin=t;pet.until=t+(kind==='feed'?4.7:2.4);
   pet.look=Math.atan2(viewer.x-pet.action.x,viewer.z-pet.action.z);
   if(kind==='feed'){
     feeding=pet;
     const dist=id==='dog'?.65:.31;
     const x=pet.action.x+Math.sin(pet.look)*dist,z=pet.action.z+Math.cos(pet.look)*dist;
     food.position.set(x,ground(x,z)+.017,z);
     for(const piece of bites.children)piece.visible=true;
     food.visible=true;
   }
   return kind==='feed'?(id==='dog'?'진돗개가 사료 냄새를 맡고 먹기 시작합니다.':'고양이가 먹이 쪽으로 고개를 숙입니다.'):
     (id==='dog'?'진돗개가 꼬리를 흔듭니다.':'고양이가 손 쪽으로 몸을 기울입니다.');
 }
 function tick(dt,viewer){
   t+=dt;
   for(const pet of pets){
     const reacting=t<(pet.until??0),a=pet.clock*pet.speed;
     if(!reacting)pet.clock+=dt;
     const {root,pose}=pet.animal;
     const x=pet.x+pet.rx*Math.cos(a),z=pet.z+pet.rz*Math.sin(a);
     const y=ground(x,z);
     root.position.set(x,y,z);
     const facing=reacting?pet.look:Math.atan2(-pet.rx*Math.sin(a),pet.rz*Math.cos(a));
     const turn=Math.atan2(Math.sin(facing-root.rotation.y),Math.cos(facing-root.rotation.y));
     root.rotation.y+=dt?turn*Math.min(1,dt*9):turn;
     const age=t-(pet.begin??0);
     const response=reacting?(pet.kind==='feed'?.72+.26*Math.sin(age*12):.42*Math.sin(age*3.4)**2)*
       Math.min(1,age*3,(pet.until-t)*3):0;
     pose(t,reacting?0:pet.pace,!viewer||Math.hypot(viewer.x-x,viewer.z-z)<8.6,response);
     Object.assign(pet.action,{x,y:y+.4,z});
   }
   if(feeding){
     const fraction=(t-feeding.begin)/(feeding.until-feeding.begin);
     for(const [i,piece] of bites.children.entries())piece.visible=i>=Math.floor(fraction*12);
     if(t>=feeding.until){feeding=null;food.visible=false;}
   }
   dog.ring.getWorldPosition(end);
   const sag=.17+Math.max(0,1.63-peg.distanceTo(end))*.21;
   for(const [i,point] of ropePoints.entries()){
     const u=i/rope.length;
     point.copy(peg).lerp(end,u);
     point.y=Math.max(ground(point.x,point.z)+.019,point.y-sag*Math.sin(Math.PI*u));
   }
   for(const [i,mesh] of rope.entries()){
     const a=ropePoints[i],b=ropePoints[i+1];
     axis.subVectors(b,a);
     const length=axis.length();
     mesh.position.copy(a).lerp(b,.5);
     mesh.quaternion.setFromUnitVectors(UP,axis.divideScalar(Math.max(length,.0001)));
     mesh.scale.set(.008,length,.008);
   }
   for(const animate of sparrows)animate(t);
 }
 tick(0);
 return {tick,interact};
}
