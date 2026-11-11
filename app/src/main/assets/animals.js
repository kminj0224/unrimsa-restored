import * as T from './vendor/three.js';

const TAU=Math.PI*2;
const UP=new T.Vector3(0,1,0);
const surface=(color,roughness=.84)=>new T.MeshStandardMaterial({color,roughness});
const eyes=surface('#18100d',.24);
const nose=surface('#27201b',.43);
const whisker=surface('#b9a997',.75);
const sphere=new T.SphereGeometry(1,18,12);
const shaft=new T.CylinderGeometry(1,1,1,8);
const shadowGeo=new T.CircleGeometry(1,32).rotateX(-Math.PI/2);
const coat=new T.MeshStandardMaterial({vertexColors:true,roughness:.94});
const pigment=new Map();
function color(value){
 if(!pigment.has(value))pigment.set(value,new T.Color(value));
 return pigment.get(value);
}
function mesh(parent,geometry,material){
 const object=new T.Mesh(geometry,material);parent.add(object);object.receiveShadow=true;return object;
}
function oval(parent,material,x,y,z,sx,sy,sz){
 const object=mesh(parent,sphere,material);
 object.position.set(x,y,z);object.scale.set(sx,sy,sz);return object;
}
function line(parent,material,r=.012){
 const part=mesh(parent,shaft,material);
 const direction=new T.Vector3();
 return (a,b)=>{
   direction.subVectors(b,a);
   const length=direction.length();
   part.position.copy(a).lerp(b,.5);
   part.quaternion.setFromUnitVectors(UP,direction.divideScalar(Math.max(length,.0001)));
   part.scale.set(r,length,r);
 };
}
const v=(x,y,z)=>new T.Vector3(x,y,z);
function tuft(parent,sections,dye,sides=24){
 // Closed elliptical cross sections perpendicular to the spine.
 const positions=[],indices=[],colors=[];
 for(let j=0;j<sections.length;j++){
   const [z,y,rx,ry]=sections[j];
   for(let i=0;i<sides;i++){
     const theta=TAU*i/sides, s=Math.sin(theta),c=Math.cos(theta);
     positions.push(rx*c,y+ry*s,z);
     const grain=1+.035*Math.sin(i*31+j*67)+.026*Math.cos(i*17-j*49);
     const shade=dye(rx*c,s,z,j).clone().multiplyScalar(grain);
     colors.push(shade.r,shade.g,shade.b);
     if(j){
       const a=(j-1)*sides+i,b=(j-1)*sides+(i+1)%sides,c=j*sides+i,d=j*sides+(i+1)%sides;
       indices.push(a,b,c,b,d,c);
     }
   }
 }
 const geo=new T.BufferGeometry();
 geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
 geo.setIndex(indices);geo.computeVertexNormals();
 return mesh(parent,geo,coat);
}
function furOval(parent,y,z,rx,ry,rz,dye){
 const object=tuft(parent,Array.from({length:15},(_,i)=>{
   const a=Math.PI*i/14;
   return [z-rz*Math.cos(a),y,Math.max(.0003,rx*Math.sin(a)),Math.max(.0003,ry*Math.sin(a))];
 }),dye);
 return object;
}
function ear(head,side,dog,outer,inner){
 const pivot=new T.Group();
 pivot.position.set(side*(dog?.112:.077),dog?.070:.062,dog?-.06:-.040);
 pivot.rotation.z=-side*.15;head.add(pivot);
 const earShape=new T.Shape();
 const w=dog?.092:.057,h=dog?.204:.119;
 earShape.moveTo(-w,0);
 earShape.quadraticCurveTo(-w*.79,h*.63,side*w*.18,h);
 earShape.quadraticCurveTo(w*.92,h*.62,w,0);
 earShape.quadraticCurveTo(0,-.026,-w,0);
 const shell=mesh(pivot,new T.ExtrudeGeometry(earShape,{depth:.023,bevelEnabled:true,bevelThickness:.010,bevelSize:.010,bevelSegments:2,curveSegments:8,steps:1}),outer);
 shell.rotation.x=-.09;
 const inset=mesh(pivot,new T.ShapeGeometry(earShape,10),inner);
 inset.scale.set(.73,.76,1);inset.position.set(0,.014,.035);inset.rotation.x=-.09;
 return pivot;
}
function curvedTail(parent,dog,material){
 const points=dog
   ?[[0,0,0],[0,.14,-.10],[.016,.32,-.15],[.05,.44,-.09],[.065,.45,.03],[.049,.37,.096],[.02,.29,.075]]
   :[[0,0,0],[0,.05,-.14],[.013,.135,-.27],[.027,.24,-.37],[.035,.33,-.41],[.038,.38,-.40]];
 const curve=new T.CatmullRomCurve3(points.map(p=>v(...p)));
 const geometry=new T.TubeGeometry(curve,24,dog?.081:.032,12,false);
 const positions=geometry.getAttribute('position');
 for(let j=0;j<=24;j++){
   const t=j/24,center=curve.getPointAt(t);
   const scale=(dog?.73+.55*Math.sin(Math.PI*t):1.05-.32*t)*Math.min(1,(1-t)*6+.10);
   for(let i=0;i<=12;i++){
     const n=j*13+i;
     positions.setXYZ(n,center.x+(positions.getX(n)-center.x)*scale,
       center.y+(positions.getY(n)-center.y)*scale,center.z+(positions.getZ(n)-center.z)*scale);
   }
 }
 geometry.computeVertexNormals();
 return mesh(parent,geometry,material);
}
function contact(parent,x,z,w,d,opacity){
 const material=new T.MeshBasicMaterial({color:'#322519',transparent:true,depthWrite:false,opacity,polygonOffset:true,polygonOffsetFactor:-1});
 for(let j=0;j<3;j++){
   const o=mesh(parent,shadowGeo,material);
   o.position.set(x,.005+j*.0005,z);o.scale.set(w*(1-j*.19),1,d*(1-j*.19));
 }
}
function quadruped(parent,dog){
 const animal=new T.Group();animal.name=dog?'Jindo':'Tabby cat';parent.add(animal);
 const body=new T.Group();animal.add(body);
 contact(animal,0,0,dog?.28:.16,dog?.56:.34,.075);
 const buff=dog?'#dfcdb0':'#997c56',pale=dog?'#f3e7cc':'#d7c6a4';
 const dark=dog?'#a48764':'#45342a';
 const dye=(x,s,z,j)=>{
   if(s<-.39)return color(pale);
   if(!dog&&Math.sin(j*2.46+x*24+s*4)>.43)return color(dark);
   return color(buff).clone().lerp(color(dark),Math.max(0,s)*.38);
 };
 const fur=surface(buff),light=surface(pale),shaded=surface(dark);
 const size=dog?1:.59;
 body.scale.setScalar(size);
 tuft(body,[[-.48,.54,.001,.001],[-.43,.54,.10,.105],[-.34,.57,.158,.177],[-.24,.575,.158,.187],
   [-.13,.59,.135,.155],[-.01,.60,.134,.174],[.12,.61,.159,.194],[.23,.61,.179,.211],
   [.32,.62,.141,.182],[.40,.64,.085,.114],[.43,.65,.001,.001]],dye);
 furOval(body,.68,.287,.136,.226,.153,dye);
 const tail=new T.Group();tail.position.set(0,.656,-.427);body.add(tail);
 curvedTail(tail,dog,dog?light:shaded);
 const head=new T.Group();
 head.position.set(0,dog?.844:.793,dog?.352:.364);body.add(head);
 furOval(head,0,.034,dog?.145:.126,dog?.138:.119,dog?.147:.119,dye);
 const muzzle=dog?.243:.161;
 furOval(head,-.052,muzzle-.065,dog?.093:.089,.066,dog?.117:.074,(x,s)=>s<-.18?color(pale):color(buff));
 oval(head,shaded,0,-.087,muzzle-.030,dog?.071:.065,.014,.060);
 oval(head,nose,0,-.035,muzzle+.042,dog?.050:.029,dog?.030:.019,.029);
 const eyelids=[],ears=[];
 for(const side of [-1,1]){
   const eye=new T.Group();head.add(eye);
   eye.position.set(side*(dog?.094:.083),.016,dog?.132:.117);
   eye.rotation.y=side*.57;
   oval(eye,shaded,0,0,0,.048,.028,.020);
   const lid=new T.Group();eye.add(lid);eyelids.push(lid);
   oval(lid,eyes,0,0,.011,.039,.022,.016);
   oval(lid,surface(dog?'#65472a':'#aca052',.34),0,0,.023,.020,.019,.009);
   oval(lid,eyes,0,0,.030,dog?.012:.006,.016,.006);
   oval(lid,light,-.009,.010,.034,.005,.004,.003);
   ears.push(ear(head,side,dog,fur,surface(dog?'#9b7665':'#a87e73')));
   oval(head,light,side*.049,-.070,muzzle+.006,.046,.035,.051);
   if(!dog)for(let j=0;j<4;j++){
     line(head,whisker,.0015)(v(side*.067,-.063+j*.010,muzzle+.015),v(side*(.155+j*.009),-.081+j*.024,muzzle+.054-j*.011));
   }
 }
 const limbs=[];
 for(const side of [-1,1])for(const front of [true,false]){
   const xx=side*(front?.119:.127),zz=front?.233:-.312;
   const upper=oval(body,front?fur:shaded,0,0,0,1,1,1);
   const lower=oval(body,light,0,0,0,1,1,1);
   const paw=oval(body,light,xx,.036,zz+.041,front?.059:.061,.041,.095);
   const hip=v(xx,front?.58:.55,zz);
   const knee=v(xx,.275,zz+(front?-.021:.106));
   const ankle=v(xx,.058,zz+.018);
   const segment=(object,a,b,width,depth)=>{
     const along=v(0,0,0).subVectors(b,a);
     object.position.copy(a).lerp(b,.5);
     object.scale.set(width,along.length()*.60,depth);
     object.quaternion.setFromUnitVectors(UP,along.normalize());
   };
   limbs.push((phase,move)=>{
     const s=Math.sin(phase+(side===1?Math.PI:0)+(front?0:Math.PI));
     const swing=Math.cos(phase+(side===1?Math.PI:0)+(front?0:Math.PI));
     ankle.z=zz+.018+s*.19*move;
     ankle.y=.054+Math.max(0,swing)*.112*move;
     knee.z=zz+(front?-.021:.106)+s*.091*move;
     knee.y=.273+Math.max(0,swing)*.054*move;
     segment(upper,hip,knee,front?.074:.100,front?.083:.119);
     segment(lower,knee,ankle,front?.043:.049,front?.053:.060);
     paw.position.set(xx,ankle.y-.018,ankle.z+.041);
   });
 }
 const collar=new T.Group();
 if(dog){
   collar.position.set(0,.724,.301);
   collar.rotation.x=.18;body.add(collar);
   const strap=mesh(collar,new T.TorusGeometry(.137,.017,9,32),surface('#785b3b',.88));
   strap.scale.y=1.22;
   oval(collar,surface('#98896a',.40),.115,.062,-.019,.024,.024,.024);
 }
 return {
   animal,collar,
   pose(t,moving,look=0){
     const phase=t*(dog?9:13);
     body.position.y=.006*Math.sin(t*4)+.015*moving*Math.abs(Math.sin(phase));
     head.rotation.x=look+.042*Math.sin(t*2.31)-.045*moving;
     head.rotation.y=.14*Math.sin(t*.92);
     tail.rotation.y=(dog?.33:.24)*Math.sin(t*(dog?4:2.7));
     tail.rotation.x=.10*Math.sin(t*2.1);
     for(const [i,pivot] of ears.entries())pivot.rotation.y=.09*Math.sin(t*2.2+i*2);
     const blink=Math.abs(Math.sin(t*.53+.3));
     for(const lid of eyelids)lid.scale.y=blink<.035?.14:1;
     for(const pose of limbs)pose(phase,moving);
   }
 };
}

function bird(parent,x,y,z,seed){
 const root=new T.Group();root.name='Tree sparrow';root.position.set(x,y,z);parent.add(root);
 const torso=new T.Group();root.add(torso);
 const warm=surface('#8d7862'),crown=surface('#604534'),brown=surface('#665545');
 const cream=surface('#b8ab90'),black=surface('#352c23'),beak=surface('#a67b54');
 oval(torso,warm,0,.122,0,.067,.077,.121);
 oval(torso,cream,0,.102,.054,.058,.057,.063);
 const head=new T.Group();head.position.set(0,.176,.071);torso.add(head);
 oval(head,crown,0,0,0,.055,.054,.061);
 for(const side of [-1,1]){
   oval(head,cream,side*.043,-.008,.016,.014,.028,.029);
   oval(head,black,side*.049,-.015,.008,.010,.012,.013);
   oval(head,eyes,side*.044,.008,.025,.013,.011,.013);
 }
 const bill=mesh(head,new T.ConeGeometry(.019,.046,9),beak);
 bill.rotation.x=Math.PI/2;bill.position.set(0,-.008,.075);bill.scale.z=.78;
 const tail=new T.Group();torso.add(tail);tail.position.set(0,.119,-.075);
 tail.rotation.x=-.21;
 for(let j=-2;j<=2;j++)oval(tail,brown,j*.011,0,-.071,.014,.007,.075).rotation.y=j*.07;
 const wings=[];
 for(const side of [-1,1]){
   const wing=new T.Group();torso.add(wing);
   wing.position.set(side*.051,.135,.018);wings.push(wing);
   oval(wing,warm,side*.061,0,-.023,.078,.018,.075);
   for(let j=0;j<7;j++){
     const feather=oval(wing,j%3===0?crown:brown,side*(.076+j*.012),-.004,-.028-j*.005,.014,.009,.072-j*.005);
     feather.rotation.y=-side*(.29+j*.066);
   }
   oval(wing,cream,side*.058,.011,-.026,.046,.008,.016).rotation.y=-side*.22;
   const foot=v(side*.027,.012,.017);
   line(torso,beak,.0055)(v(side*.030,.081,-.006),foot);
   for(let j=-1;j<=1;j++)line(torso,beak,.003)(foot,v(side*.027+j*.014,.007,.047));
 }
 return (t)=>{
   const elapsed=(t+seed)%21;
   const flight=elapsed>10.5?(elapsed-10.5)/10.5:0;
   const sweep=flight*TAU;
   const hop=Math.max(0,Math.sin(elapsed*6.2))**12*.039;
   const altitude=flight?1.18*Math.sin(Math.PI*flight)**1.35:hop;
   const movement=flight?1:0;
   root.position.set(x+Math.sin(sweep)*1.92,y+altitude,z+(1-Math.cos(sweep))*1.55);
   root.rotation.y=flight?Math.atan2(1.92*Math.cos(sweep),1.55*Math.sin(sweep)):seed+.26*Math.sin(elapsed*1.7);
   torso.rotation.x=flight?-.17*Math.cos(Math.PI*flight):.09;
   head.rotation.x=flight?0:.56*Math.max(0,Math.sin(elapsed*3.2))**5;
   head.rotation.y=.31*Math.sin(t*2.8+seed);
   for(const [i,wing] of wings.entries()){
     const side=i===0?-1:1;
     wing.rotation.y=side*(1.12*(1-movement)+.12);
     wing.rotation.z=side*(flight?.67*Math.sin(t*26)+.13:-.18);
   }
 };
}

export function addAnimals(scene,ground){
 const group=new T.Group();group.name='Temple animals';scene.add(group);
 const dog=quadruped(group,true);
 const cat=quadruped(group,false);
 const peg=v(-20.11,ground(-20.11,-5.03)+.42,-5.03);
 const tetherMaterial=surface('#7f6a47');
 const rope=Array.from({length:15},()=>line(group,tetherMaterial,.010));
 const points=Array.from({length:rope.length+1},()=>new T.Vector3());
 const end=new T.Vector3();
 const sparrows=[
   bird(group,-12.02,ground(-12.02,12.20),12.20,1.6),
   bird(group,-10.75,ground(-10.75,11.30),11.30,4.2),
   bird(group,2.20,ground(2.20,8.70),8.70,6.9)
 ];
 let t=0;
 function tick(dt){
   t+=dt;
   const da=t*.26, dx=-19.57+.83*Math.cos(da), dz=-3.91+.45*Math.sin(da);
   dog.animal.position.set(dx,ground(dx,dz),dz);
   dog.animal.rotation.y=Math.atan2(-.83*Math.sin(da),.45*Math.cos(da));
   dog.pose(t,.46,.10+.14*Math.sin(t*.76));
   dog.collar.localToWorld(end.set(.115,.062,-.019));
   const slack=.23+Math.max(0,1.55-peg.distanceTo(end))*.18;
   for(const [i,point] of points.entries()){
     const ratio=i/rope.length;
     point.copy(peg).lerp(end,ratio);
     point.y=Math.max(ground(point.x,point.z)+.025,point.y-slack*Math.sin(Math.PI*ratio));
   }
   for(const [i,segment] of rope.entries())segment(points[i],points[i+1]);
   const a=t*.29, cx=-13.7+1.13*Math.cos(a),cz=7.94+.74*Math.sin(a);
   cat.animal.position.set(cx,ground(cx,cz),cz);
   cat.animal.rotation.y=Math.atan2(-1.13*Math.sin(a),.74*Math.cos(a));
   cat.pose(t,.60,.19*Math.max(0,Math.sin(t*1.23))**5);
   for(const animate of sparrows)animate(t);
 }
 tick(0);
 return {tick};
}
