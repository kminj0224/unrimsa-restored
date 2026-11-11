import * as T from './vendor/three.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';

export const sanctuary={id:'main',name:'대웅전',x:-4,z:-16.55,w:22.4,d:13.4,h:6.55,floor:2.40};
export const rooms=[
 sanctuary,
 {id:'west',name:'요사채',x:-17.4,z:2.4,w:6.2,d:5.7,h:2.86,floor:1.95},
 {id:'east',name:'선방',x:12.45,z:-12.5,w:5.4,d:4.7,h:2.70,floor:1.95}
];
export const court={left:-23.58,right:17.32,north:-28.70,south:19.57};
export const pond={x:-16,z:14.7,rx:4.25,rz:2.77,y:1.20};
export const spawn={x:-3.5,z:26,yaw:0,pitch:-.035};
export const river=z=>29+5*Math.sin(z*.066+.7);
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const mix=(a,b,v)=>a+(b-a)*v;
export const random=(seed)=>{
 return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
};
const rand=random(6726);
const TAU=Math.PI*2;
export function height(x,z){
 const dist=Math.abs(x-river(z));
 const wave=.56*Math.sin(x*.15+z*.19)+.36*Math.cos(x*.39-z*.13)+.29*Math.sin(z*.47+x*.37);
 const hill=(cx,cz,a,b,h)=>h*Math.exp(-((x-cx)**2/a+(z-cz)**2/b));
 const heights=hill(-43,-15,160,540,8)+hill(-32,-47,320,270,13)+hill(-4,-52,510,200,10)+hill(46,-38,170,360,12)+hill(-49,34,180,230,5);
 const bank=clamp((dist-2.5)/6,0,1);
 const yard=clamp(Math.max(Math.abs(x+3.4)-22.6,z-24,-z-31,0)/6,0,1);
 const far=clamp((Math.max(Math.abs(x),Math.abs(z))-52)/32,0,1);
 const remote=hill(-87,-91,1160,840,22)+hill(-15,-113,1750,1610,34)+hill(42,-125,1940,2120,45)+hill(115,-48,2600,1600,26)+hill(-103,21,1800,1800,30)+hill(60,102,2100,1400,27);
 const close=mix(.66,mix(-1.63+wave*.20,.4+wave+heights,bank),yard)+yard*.12*Math.sin(x*1.31-z*.94);
 return mix(close,remote+3+3*Math.sin(x*.045-z*.034),far);
}
export function terrainAt(x,z){
 const gx=Math.floor(x/2)*2,gz=Math.floor(z/2)*2,u=(x-gx)/2,v=(z-gz)/2;
 const a=height(gx,gz),c=height(gx+2,gz+2);
 return u<v?a*(1-v)+c*u+height(gx,gz+2)*(v-u):a*(1-u)+c*v+height(gx+2,gz)*(u-v);
}

function terrain(){
 const ps=[],ns=[],uv=[],colors=[],indices=[];
 const s=162,n=s+1;
 const grass=new T.Color('#78885b'),soil=new T.Color('#a69570'),pine=new T.Color('#546c4c'),tmp=new T.Color();
 for(let j=0;j<n;j++) for(let i=0;i<n;i++){
   const x=(i-s/2)*2,z=(j-s/2)*2,y=height(x,z);
   ps.push(x,y,z);
   const normal=new T.Vector3(height(x-.3,z)-height(x+.3,z),.6,height(x,z-.3)-height(x,z+.3)).normalize();
   ns.push(normal.x,normal.y,normal.z);
   uv.push(x/4,z/4);
   const t=clamp(y*.017+.09*Math.sin(x*.142+z*.193)+.12,0,.66);
   tmp.copy(grass).lerp(pine,t).lerp(soil,1-clamp((Math.abs(x-river(z))-3.8)/3,0,1));
   tmp.multiplyScalar(.91+.13*(Math.sin(x*.41+z*.22)*Math.cos(x*.26-z*.24)+1)/2);
   colors.push(tmp.r,tmp.g,tmp.b);
   if(i<s&&j<s){const k=j*n+i;indices.push(k,k+n,k+n+1,k,k+n+1,k+1);}
 }
 const g=new T.BufferGeometry();
 for(const [name,arr,k] of [['position',ps,3],['normal',ns,3],['uv',uv,2],['color',colors,3]]) g.setAttribute(name,new T.Float32BufferAttribute(arr,k));
 g.setIndex(indices);
 return g;
}

function lathe(points,segments=32){
 return new T.LatheGeometry(points.map(([r,h])=>new T.Vector2(r,h)),segments);
}
const boxGeometry=new T.BoxGeometry(1,1,1);
const columnGeometry=new T.CylinderGeometry(.45,.5,1,16,1);
const rockGeometry=new T.IcosahedronGeometry(1,2);
const tr=new T.Matrix4(),q=new T.Quaternion(),sy=new T.Vector3(0,1,0);
const p=new T.Vector3(),scale=new T.Vector3();
function transform(g,x,y,z,sx,sy,sz,angle=0){
 q.setFromAxisAngle(new T.Vector3(0,1,0),angle);
 tr.compose(p.set(x,y,z),q,scale.set(sx,sy,sz));
 return g.clone().applyMatrix4(tr);
}
function tiledGeometry(w,d,peak){
 const pos=[],uv=[],col=[],idx=[];
 const shades=['#6f7071','#68696a','#747672','#747573','#646767','#67696b','#767571'].map(x=>new T.Color(x));
 const hip=.63;
 const strips=[0,.13,.25,.41,.65,.85,1];
 const offsets=[.017,.072,.085,.034,.012,.014,.017];
 function plane(u,v,end,side){
   const a=end?side*w*(hip+(1-hip)*v)/2:u*w*(hip+(1-hip)*v)/2;
   const z=end?u*d*v/2:side*d*v/2;
   return [a,peak*(1-v)**1.34+.62*(Math.abs(u)*v)**6,z];
 }
 for(const end of [false,true])for(const side of [-1,1]){
   const rows=Math.max(8,Math.round((end?w*(1-hip):d)*1.3));
   const columns=Math.max(11,Math.round((end?d:w)*2.9));
   for(let i=0;i<columns;i++)for(let j=0;j<rows;j++){
     const a=j/rows,b=(j+1)/rows;
     const color=shades[Math.floor(rand()*shades.length)];
     for(let k=0;k<strips.length;k++){
       const u=-1+2*(i+strips[k])/columns;
       const start=plane(u,a,end,side),finish=plane(u,b,end,side);
       const c=pos.length/3;
       start[1]+=offsets[k]+.028;
       finish[1]+=offsets[k]-.007;
       pos.push(...start,...finish);
       uv.push((start[0]+start[2])*.30,start[1]*.3+a*.8,(finish[0]+finish[2])*.30,finish[1]*.3+b*.8);
       col.push(color.r,color.g,color.b,color.r,color.g,color.b);
       if(k){
         const outward=end?side===1:side===-1;
         if(outward)idx.push(c-2,c,c+1,c-2,c+1,c-1);
         else idx.push(c-2,c+1,c,c-2,c-1,c+1);
       }
     }
   }
 }
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
 g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 g.setAttribute('color',new T.Float32BufferAttribute(col,3));
 g.setIndex(idx);
 g.computeVertexNormals();
 return g;
}

export function buildWorld(scene,maps){
 const floors=[],solids=[],actions=[],doors=[],batches=new Map();
 const stone=new T.MeshStandardMaterial({color:'#bcb4a3',map:maps.stone,bumpMap:maps.stone,bumpScale:.044,roughness:.92});
 const stones=['#8d8a77','#a8a08c','#a59c88','#bbb39d','#9f9c8b'].map(c=>new T.MeshStandardMaterial({color:c,map:maps.stone,bumpMap:maps.stone,bumpScale:.065,roughness:.97}));
 const wood=new T.MeshStandardMaterial({color:'#9a704e',map:maps.wood,bumpMap:maps.wood,bumpScale:.028,roughness:.78});
 const red=new T.MeshStandardMaterial({color:'#9c5141',map:maps.wood,bumpMap:maps.wood,bumpScale:.023,roughness:.74});
 const teal=new T.MeshStandardMaterial({color:'#507f6a',map:maps.wood,bumpMap:maps.wood,bumpScale:.024,roughness:.78});
 const tan=new T.MeshStandardMaterial({color:'#a6834f',map:maps.wood,roughness:.72});
 const dark=new T.MeshStandardMaterial({color:'#49352b',map:maps.wood,roughness:.81});
 const paper=new T.MeshStandardMaterial({color:'#e1c99e',map:maps.paper,bumpMap:maps.paper,bumpScale:.012,roughness:.84});
 const slate=new T.MeshStandardMaterial({vertexColors:true,map:maps.clay,bumpMap:maps.clay,bumpScale:.08,roughness:.91,side:T.DoubleSide});
 const ridge=new T.MeshStandardMaterial({color:'#656662',map:maps.clay,roughness:.86,bumpMap:maps.clay,bumpScale:.052});
 const bronze=new T.MeshStandardMaterial({color:'#957d51',map:maps.clay,bumpMap:maps.clay,bumpScale:.073,metalness:.63,roughness:.48});
 const brass=new T.MeshStandardMaterial({color:'#c3a56b',metalness:.65,roughness:.43});
 const fabric=new T.MeshStandardMaterial({color:'#777253',map:maps.paper,bumpMap:maps.paper,bumpScale:.023,roughness:.97});
 const hemp=new T.MeshStandardMaterial({color:'#b5a17b',map:maps.paper,bumpMap:maps.paper,bumpScale:.029,roughness:1});
 const bedding=new T.MeshStandardMaterial({color:'#63777a',map:maps.paper,bumpMap:maps.paper,bumpScale:.024,roughness:1});
 const ceramic=new T.MeshStandardMaterial({color:'#798475',map:maps.clay,roughness:.54});
 const clay=new T.MeshStandardMaterial({color:'#745344',map:maps.clay,bumpMap:maps.clay,bumpScale:.032,roughness:.82});
 const waterGlaze=new T.MeshStandardMaterial({color:'#687a76',metalness:.15,roughness:.14});
 const shadowMesh=(g,m)=>{
   const o=new T.Mesh(g,m);o.castShadow=true;o.receiveShadow=true;return o;
 };
 let section='yard';
 function add(g,m,parent){
   if(parent){const object=shadowMesh(g,m);parent.add(object);return object;}
   const key=section+':'+m.id;
   if(!batches.has(key))batches.set(key,{g:[],m});
   batches.get(key).g.push(g.index?g.toNonIndexed():g);
 }
 function box(x,y,z,w,h,d,m,angle=0,parent){
   add(transform(boxGeometry,x,y+h/2,z,w,h,d,angle),m,parent);
 }
 function column(x,y,z,r,h,m,parent){
   add(transform(columnGeometry,x,y+h/2,z,r*2,h,r*2),m,parent);
 }
 function pipe(a,b,r1,r2,m,parent,seg=10){
   const v1=new T.Vector3(...a),v2=new T.Vector3(...b),delta=v2.clone().sub(v1);
   const g=new T.CylinderGeometry(r2,r1,delta.length(),seg);
   const orient=new T.Quaternion().setFromUnitVectors(sy,delta.normalize());
   g.applyQuaternion(orient);g.translate(...v1.add(v2).multiplyScalar(.5).toArray());
   add(g,m,parent);
 }
 function sweep(points,r,m,parent,seg=8){
   const curve=new T.CatmullRomCurve3(points.map(a=>new T.Vector3(...a)));
   add(new T.TubeGeometry(curve,Math.max(8,points.length*3),r,seg,false),m,parent);
 }
 function round(x,y,z,profile,m,parent,segments=32){
   const g=lathe(profile,segments);
   g.translate(x,y,z);add(g,m,parent);
 }
 function solid(x,z,w,d,door=null){solids.push({x,z,w,d,door});}
 function lowSolid(x,z,w,d,top){solids.push({x,z,w,d,top});}
 function floor(x,z,w,d,y){floors.push([x,z,w,d,y]);}
 function use(id,name,x,y,z,dist,room=null){actions.push({id,name,x,y,z,dist,room});}
 function platform(x,z,w,d,y,h){
   box(x,y,z,w,h,d,stones[1]);box(x,y+h,z,w+.15,.12,d+.15,stone);
   floor(x,z,w+.15,d+.15,y+h+.12);
   for(let i=0;i<Math.floor(w/.85);i++){
     const xx=x-w/2+(i+.5)*.85;
     for(const sign of [-1,1])box(xx,y+.015,z+sign*(d/2+.015),.81,h-.025,.13,stones[i%stones.length],(rand()-.5)*.023);
   }
 }
 function stairs(x,z,w,y,n,depth,rise){
   for(let i=0;i<n;i++){
     const top=y+(i+1)*rise,zz=z-i*depth;
     box(x,y,zz,w,top-y,depth+.029,stones[i%stones.length]);
     box(x,top-.037,zz+depth*.40,w+.045,.049,.13,stone);
     floor(x,zz,w+.07,depth+.063,top+.011);
   }
 }
 function roof(x,y,z,w,d,peak){
   const g=tiledGeometry(w,d,peak);
   const m=shadowMesh(g,slate);m.position.set(x,y,z);scene.add(m);
   const h=w*.315;
   sweep([[x-h-.17,y+peak+.28,z],[x-h+.65,y+peak+.10,z],[x,y+peak+.095,z],[x+h-.65,y+peak+.10,z],[x+h+.17,y+peak+.28,z]],.102,ridge);
   for(const sx of [-1,1])for(const sz of [-1,1]){
     const points=[];
     for(let i=0;i<=12;i++){
       const t=i/12;
       points.push([x+sx*w*(.63+.37*t)/2,y+peak*(1-t)**1.34+.62*t**6+.064,z+sz*d*t/2]);
     }
     sweep(points,.082,ridge);
   }
   for(const sign of [-1,1]){
     const pts=[];
     for(let i=0;i<=16;i++){
       const u=(i-8)/8;
       pts.push([x+u*w/2,y+.62*Math.abs(u)**6-.09,z+sign*d/2]);
     }
     sweep(pts,.081,red);
     for(let i=0;i<Math.floor(w*2.86);i++){
       const u=-1+(i+.42)*2/Math.floor(w*2.86),xx=x+u*w/2;
       const yy=y+.62*Math.abs(u)**6;
       pipe([xx,yy+.052,z+sign*(d/2-.10)],[xx,yy+.038,z+sign*(d/2+.025)],.050,.053,ridge,undefined,8);
     }
   }
 }
 function panel(x,y,z,w,h,material,parent){
   box(x,y,z,w,h,.10,material,0,parent);
   for(const face of [-1,1]){
     box(x,y,z+face*.063,w,.15,.05,red,0,parent);
     box(x,y+h-.13,z+face*.063,w,.13,.05,red,0,parent);
     for(let i=0;i<=7;i++)box(x-w/2+i*w/7,y+.07,z+face*.066,.034,h-.13,.036,dark,0,parent);
     for(let i=1;i<=5;i++)box(x,y+i*h/6,z+face*.069,w,.037,.03,dark,0,parent);
   }
 }
 function plaque(text,x,y,z,w,h){
   box(x,y-h/2,z,w,h,.14,dark);
   if(typeof document==='undefined')return;
   const img=document.createElement('canvas');img.width=512;img.height=144;
   const ctx=img.getContext('2d');
   if(!ctx)return;
   ctx.fillStyle='#213f36';ctx.fillRect(0,0,512,144);ctx.strokeStyle='#bc9b61';ctx.lineWidth=6;ctx.strokeRect(11,11,490,122);
   ctx.fillStyle='#e4c386';ctx.font='bold 71px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,79);
   const tex=new T.CanvasTexture(img);tex.colorSpace=T.SRGBColorSpace;
   const m=new T.Mesh(new T.PlaneGeometry(w-.11,h-.10),new T.MeshStandardMaterial({map:tex,roughness:.75}));
   m.position.set(x,y,z+.076);scene.add(m);
 }

 const turf=new T.Mesh(terrain(),new T.MeshStandardMaterial({vertexColors:true,map:maps.earth,roughness:.98,bumpMap:maps.earth,bumpScale:.13}));
 turf.receiveShadow=true;scene.add(turf);
 const {left,right,north,south}=court;
 const cx=(left+right)/2,cz=(north+south)/2;
 const cw=right-left,cd=south-north;
 box(cx,.55,cz,cw,.18,cd,stones[1]);
 const yard=new T.Shape();
 yard.moveTo(left,-south);yard.lineTo(right,-south);yard.lineTo(right,-north);yard.lineTo(left,-north);yard.closePath();
 const hole=new T.Path();
 hole.absellipse(pond.x,-pond.z,pond.rx,pond.rz,0,TAU,true);
 yard.holes.push(hole);
 const paving=new T.ShapeGeometry(yard,64).rotateX(-Math.PI/2).translate(0,1.11,0);
 const texCoords=paving.getAttribute('uv');
 for(let i=0;i<texCoords.count;i++)texCoords.setXY(i,texCoords.getX(i)/3.2,texCoords.getY(i)/3.2);
 add(paving,stones[1]);
 floor(cx,cz,cw,cd,1.11);
 for(const edge of [left,right])box(edge,.73,cz,.20,.38,cd,stones[1]);
 for(const zz of [north,south])for(let i=0;i<Math.floor(cw/.85);i++){
   box(left+.42+i*.85,.73,zz,.82,.38,.24,stones[i%stones.length],(rand()-.5)*.041);
 }
 stairs(-4,21.65,5.4,.66,5,.52,.095);
 for(let iz=0;iz<44;iz++){
   const z=19-iz*.93;
   for(let ix=-14;ix<=14;ix++){
     if(Math.abs(ix)>3 && !(z>=-12&&z<10))continue;
     const x=-4+ix*.93+(iz%2)*.16;
     box(x,1.108,z,.898,.027+rand()*.01,.895,stones[(rand()*stones.length)|0],(rand()-.5)*.032);
   }
 }
 for(let i=0;i<16;i++){
   const z=22.6+i*1.28,x=-4+5*Math.sin(i*.104);
   for(let j=-1;j<=1;j++)box(x+j*.88,terrainAt(x+j*.88,z)-.058,z,.80,.13,.94,stones[(i+j+stones.length)%stones.length],(rand()-.5)*.23);
 }

 const flames=new T.Group(),incense=new T.Group();
 const smokeOrigin=new T.Vector3(),statueBase=new T.Vector3();
 flames.visible=false;incense.visible=false;scene.add(flames,incense);
 const flameMat=new T.MeshBasicMaterial({color:'#ffcb76',toneMapped:false});
 const flameShape=new T.LatheGeometry([[0,0],[.035,.02],[.049,.075],[.038,.119],[.017,.165],[0,.213]].map(a=>new T.Vector2(...a)),14);
 const lamps=[];
 for(const r of rooms){
   section=r.id;
   const {x,z,w,d,h,id,floor:y}=r;
   const main=id==='main',front=z+d/2;
   const base=y-.14,stoneHeight=base-1.25;
   platform(x,z,w+1.76,d+1.82,1.13,stoneHeight);
   if(main) stairs(x,front+3.74,w*.57,1.13,8,.40,.141);
   else stairs(x,front+2.48,w*.55,1.13,5,.38,.137);
   box(x,base,z,w+.31,.14,d+.34,dark);
   floor(x,z,w+.31,d+.34,y);
   for(let i=0;i<Math.floor(w/.24);i++)box(x-w/2+.128+i*.24,y-.009,z,.236,.022,d-.10,i%6===0?tan:wood);
   box(x,y+h-.22,z,w-.07,.15,d-.12,wood);
   const rafters=main?15:8;
   for(let j=0;j<rafters;j++){
     box(x+(j-(rafters-1)/2)*w/rafters,y+h-.34,z,main?.18:.115,.18,d-.10,dark);
   }
   for(const dz of [-.34,-.17,0,.17,.34]){
     if(!main&&Math.abs(dz)===.17)continue;
     box(x,y+h-.39,z+dz*d,w-.10,.21,main?.32:.22,teal);
   }
   if(main){
     for(const side of [-1,1])for(const dz of [-.31,0,.31]){
       const px=x+side*w*.35,pz=z+dz*d;
       round(px,y,pz,[[.43,0],[.44,.065],[.40,.15],[.33,.24]],stones[0],undefined,16);
       column(px,y+.19,pz,.27,h-.59,red);
       box(px,y+h-.55,pz,.86,.16,.89,teal);
       box(px,y+h-.41,pz,1.14,.11,1.10,tan);
       solid(px,pz,.72,.72);
     }
   }
   for(let i=0;i<5;i++){
     const xx=x+(i-2)*w/4;
     for(const face of [-1,1]){
       const zz=z+face*d/2;
       const pillar=main?1.42:1;
       round(xx,y,zz,[[.29*pillar,0],[.32*pillar,.055],[.28*pillar,.13],[.23*pillar,.18]],stones[0],undefined,16);
       column(xx,y+.15,zz,.18*pillar,h-.36,red);
       box(xx,y+h-.54,zz,.53,.17,.51,teal);
       box(xx,y+h-.36,zz,.74,.14,.76,red);
       if(face===1&&(i===0||i===2||i===4))solid(xx,zz,.50*pillar,.46*pillar);
     }
   }
   solid(x,z-d/2,w,.24);
   for(const side of [-1,1]){
     box(x+side*(w/2-.06),y,z,.16,h-.23,d-.12,paper);
     solid(x+side*(w/2-.06),z,.23,d);
     panel(x+side*w*.375,y,front-.075,w*.25-.25,h-.40,paper);
     solid(x+side*w*.375,front,w*.25,.24);
   }
   for(let i=0;i<4;i++)panel(x+(i-1.5)*w/4,y,z-d/2+.08,w/4-.28,h-.39,i%2===0?paper:teal);
   for(const face of [-1,1]){
     const zz=z+face*(d/2+.05);
     box(x,y+h-.40,zz,w+.66,.29,.35,teal);
     box(x,y+h-.42,zz,w+.66,.05,.36,tan);
     for(let j=0;j<Math.floor(w/.33);j++){
       const xx=x-w*.49+j*.33;
       box(xx,y+h-.28,zz+face*.18,.107,.12,.055,j%2===0?tan:red);
       box(xx,y+h-.19,zz,.108,.14,.61,teal);
     }
   }
   plaque({main:'大雄殿',west:'寮舍',east:'禪房'}[id],x,y+h-.43,front+.31,main?3.84:1.38,main?.86:.44);
   roof(x,y+h+.075,z,w+(main?3.05:2.26),d+(main?2.63:2.01),h*.56);
   for(const sign of [-1,1]){
     const group=new T.Group(),cx=x+sign*w/8;
     const width=w/4-.20,dh=Math.min(h-.37,main?4.33:2.65);
     panel(cx,y,front-.19,width,dh,paper,group);
     if(main)panel(cx,y+dh+.10,front-.076,width,h-dh-.48,teal);
     box(cx-sign*(width*.34),y+.90,front-.17,.071,.18,.14,brass,0,group);
     scene.add(group);
     const door={room:id,mesh:group,shift:sign*(width+.12)};
     doors.push(door);
     solid(cx,front-.19,width,.18,door);
     use('door:'+id,'미닫이문 열기',cx,y+1.04,front-.10,2.30,id);
   }
   const sh=z-d*.31;
   if(main){
     const pedestal=1.29;
     box(x,y,sh,8.72,.22,2.97,dark);
     box(x,y+.22,sh,8.28,.91,2.63,red);
     box(x,y+1.13,sh,8.53,.16,2.83,tan);
     statueBase.set(x,y+pedestal,sh);
     for(let i=-6;i<=6;i++){
       const xx=x+i*.60;
       box(xx,y+.38,sh+1.323,.50,.55,.035,tan);
       box(xx,y+.428,sh+1.344,.39,.454,.036,wood);
       round(xx,y+.54,sh+1.37,[[.087,0],[.073,.038],[.051,.087],[0,.14]],brass,undefined,12);
     }
     solid(x,sh,8.72,2.97);
     for(const sign of [-1,1]){
       const lx=x+sign*3.12,lz=sh+.90;
       round(lx,y+pedestal,lz,[[.21,0],[.17,.07],[.08,.145],[.068,.25],[.12,.28]],bronze);
       column(lx,y+pedestal+.28,lz,.062,.36,paper);
       const mesh=new T.Mesh(flameShape,flameMat);
       mesh.position.set(lx,y+pedestal+.62,lz);mesh.scale.setScalar(1.25);flames.add(mesh);
       const light=new T.PointLight('#ffb164',6.2,4.7,1.72);
       light.position.set(lx,y+pedestal+.69,lz+.13);flames.add(light);lamps.push(light);
     }
     const sz=z+.84;
     box(x,y,sz,1.62,.79,.86,dark);
     box(x,y+.75,sz,1.78,.13,1.02,wood);
     round(x,y+.87,sz,[[.16,0],[.23,.028],[.28,.12],[.324,.19],[.332,.24],[.310,.25],[.277,.185],[.18,.10],[.035,.10]],bronze);
     solid(x,sz,1.78,1.02);
     for(const ix of [-1,0,1])pipe([x+ix*.079,y+1.04,sz],[x+ix*.079+.032,y+1.46,sz],.009,.008,tan,incense,6);
     smokeOrigin.set(x,y+1.46,sz);
     use('incense','향 피우기',x,y+1.08,sz,2.06,id);
     use('lamp','촛불 밝히기',x-3.12,y+pedestal+.24,sh+1.04,2.35,id);
     for(const side of [-1,1])for(const dz of [1.8,3.02,4.25]){
       box(x+side*2.38,y+.02,z+dz,1.21,.085,.84,fabric,.01*side);
     }
   }else if(id==='west'){
     const sz=z-.64;
     box(x,y,sz,1.32,.40,.79,dark);box(x,y+.40,sz,1.51,.11,.93,wood);
     for(const side of [-1,1]){
       box(x+side*.204,y+.54,sz,.40,.028,.52,paper,.026*side);
       for(let j=0;j<8;j++)box(x+side*.204,y+.569,sz+(j-3.5)*.051,.275,.003,.007,dark);
     }
     solid(x,sz,1.51,.93);
     use('read','필사본 펼쳐 보기',x,y+.60,sz,1.85,id);
     for(const sign of [-1,1]){
       const xx=x+sign*w*.38,zz=z-d*.27;
       box(xx,y,zz,.62,1.07,.54,wood);solid(xx,zz,.62,.54);
       for(let j=1;j<4;j++)box(xx,y+j*.26,zz+.28,.58,.04,.033,dark);
     }
     // The west hall is the monks' living quarters. Leave the centre aisle open.
     const matX=x-1.88,matZ=z+.52;
     box(matX,y+.012,matZ,1.22,.022,2.09,hemp);
     for(const edge of [-1,1]){
       box(matX+edge*.594,y+.034,matZ,.027,.012,2.09,dark);
       box(matX,y+.034,matZ+edge*1.029,1.20,.012,.029,dark);
     }
     for(let i=0;i<23;i++)box(matX,y+.033,matZ-.97+i*.087,1.13,.004,.010,tan);
     box(matX,y+.038,matZ-.19,1.04,.075,1.40,bedding);
     box(matX,y+.112,matZ-.71,.63,.123,.33,hemp);
     box(matX,y+.103,matZ+.31,1.05,.055,.60,fabric);
     for(const offset of [.08,.19,.29])box(matX,y+.157,matZ+offset,1.04,.007,.015,hemp);
     use('bedding','자리 살펴보기',matX,y+.23,matZ,1.62,id);

     const chestX=x+.92,chestZ=z-2.31;
     box(chestX,y,chestZ,2.14,.83,.68,dark);
     box(chestX,y+.82,chestZ,2.22,.093,.74,wood);
     for(const side of [-1,1]){
       const panelX=chestX+side*.55;
       box(panelX,y+.18,chestZ+.35,1.04,.59,.061,wood);
       box(panelX,y+.25,chestZ+.386,.83,.44,.028,tan);
       box(panelX,y+.43,chestZ+.407,.096,.13,.026,brass);
       const handle=new T.TorusGeometry(.033,.006,6,14).translate(panelX,y+.42,chestZ+.43);
       add(handle,brass);
     }
     solid(chestX,chestZ,2.22,.74);
     for(let i=0;i<3;i++){
       box(chestX+.62,y+.925+i*.067,chestZ,.67-i*.045,.062,.49,i%2===0?fabric:bedding,.035*i);
     }
     round(chestX-.66,y+.92,chestZ,[[.10,0],[.135,.035],[.137,.16],[.10,.23],[.08,.25],[.08,.275]],clay);

     const teaX=x+1.84,teaZ=z+.39,teaY=y+.40;
     box(teaX,y+.29,teaZ,1.08,.095,.69,wood);
     for(const dx of [-.40,.40])for(const dz of [-.24,.24])box(teaX+dx,y,teaZ+dz,.082,.30,.082,dark);
     box(teaX,teaY-.014,teaZ,.87,.023,.51,dark);
     round(teaX-.14,teaY,teaZ-.038,[[.066,0],[.102,.025],[.128,.087],[.120,.147],[.089,.186],[.060,.197]],ceramic);
     round(teaX-.14,teaY+.193,teaZ-.038,[[.080,0],[.078,.019],[.030,.030],[.025,.056],[.012,.061]],ceramic);
     pipe([teaX-.24,teaY+.082,teaZ-.038],[teaX-.365,teaY+.17,teaZ-.038],.033,.020,ceramic);
     sweep([[teaX-.044,teaY+.08,teaZ-.04],[teaX+.046,teaY+.105,teaZ-.04],[teaX+.030,teaY+.174,teaZ-.04],[teaX-.067,teaY+.166,teaZ-.04]],.015,ceramic);
     for(const dz of [-.12,.11])round(teaX+.228,teaY,teaZ+dz,[[.034,0],[.059,.012],[.076,.070],[.071,.074],[.064,.067],[.042,.025]],ceramic);
     solid(teaX,teaZ,1.08,.69);
     use('tea','다구 살펴보기',teaX,teaY+.17,teaZ,1.50,id);
     for(const side of [-1,1])box(teaX,y+.014,teaZ+side*.70,.60,.054,.51,fabric,side*.04);

     const shelfX=x-2.65,shelfZ=z-1.27;
     for(const dz of [-.34,.34])box(shelfX,y,shelfZ+dz,.30,1.56,.073,dark);
     for(const level of [.24,.68,1.14])box(shelfX,y+level,shelfZ,.35,.05,.75,wood);
     for(const [dz,h,r] of [[-.23,.19,.095],[.03,.24,.119],[.23,.17,.079]]){
       round(shelfX,y+.73,shelfZ+dz,[[r*.60,0],[r,.05],[r,h*.57],[r*.73,h*.85],[r*.63,h],[r*.49,h]],clay);
     }
     box(shelfX,y+1.20,shelfZ,.25,.092,.44,hemp);
     solid(shelfX,shelfZ,.35,.75);
     const light=new T.PointLight('#ffd1a1',2.8,4.0,2);
     light.position.set(x+.66,y+2.23,z+.54);
     scene.add(light);
   }else{
     const sz=z-.81;
     box(x,y,sz,1.04,.34,.70,dark);box(x,y+.34,sz,1.13,.082,.76,wood);
     const gg=new T.SphereGeometry(1,30,18);
     add(transform(gg,x,y+.71,sz,.32,.28,.26),red);
     box(x,y+.66,sz+.245,.47,.048,.046,dark);
     pipe([x+.45,y+.49,sz+.25],[x+.30,y+.70,sz+.06],.022,.033,tan);
     solid(x,sz,1.13,.76);use('moktak','목탁 두드리기',x,y+.76,sz,1.87,id);
     for(const sign of [-1,1])box(x+sign*1.19,y+.013,z+.54,.73,.058,.64,fabric);
   }
 }

 section='living-yard';
 const pegX=-20.11,pegZ=-5.03;
 column(pegX,1.11,pegZ,.09,.57,wood);
 round(pegX,1.48,pegZ,[[.091,0],[.106,.026],[.106,.088],[.091,.112]],bronze,undefined,14);
 solid(pegX,pegZ,.19,.19);
 const kennelX=-19.96,kennelZ=-6.30;
 box(kennelX,1.11,kennelZ,1.45,.12,1.28,dark);
 for(const side of [-1,1])box(kennelX+side*.64,1.23,kennelZ,.15,.77,1.27,wood);
 box(kennelX,1.23,kennelZ-.60,1.44,.79,.14,wood);
 for(const side of [-1,1])box(kennelX+side*.51,1.23,kennelZ+.57,.36,.76,.12,wood);
 box(kennelX,1.84,kennelZ+.57,1.39,.21,.12,dark);
 for(const side of [-1,1]){
   const plank=new T.BoxGeometry(.99,.11,1.56).rotateZ(-side*.31).translate(kennelX+side*.46,2.14,kennelZ);
   add(plank,ridge);
 }
 pipe([kennelX,2.33,kennelZ-.79],[kennelX,2.33,kennelZ+.79],.057,.057,dark);
 box(kennelX,1.23,kennelZ+.10,1.10,.028,.90,hemp);
 solid(kennelX,kennelZ,1.45,1.28);
 const bowlX=-18.49,bowlZ=-5.55;
 round(bowlX,1.11,bowlZ,[[.115,0],[.137,.022],[.173,.102],[.169,.119],[.154,.117],[.137,.054],[.044,.035]],clay);
 round(bowlX,1.198,bowlZ,[[0,0],[.149,0]],waterGlaze);
 for(const [xx,zz,r] of [[-21.50,-4.85,.27],[-21.51,-5.49,.31],[-22.09,-5.25,.20]]){
   round(xx,1.11,zz,[[r*.62,0],[r*.89,.09],[r,.32],[r*.84,.50],[r*.66,.57]],clay);
   round(xx,1.68,zz,[[r*.69,0],[r*.70,.027],[r*.46,.056],[r*.13,.079]],dark);
   solid(xx,zz,r*2,r*2);
 }
 for(const dz of [-.44,0,.44])box(-21.51,1.105,-5.20+dz,1.87,.048,.43,stone);

 section='gate';
 for(const x of [-7.55,-.45]){
   round(x,1.13,17.5,[[.47,0],[.46,.10],[.39,.25],[.32,.29]],stones[1],undefined,18);
   column(x,1.42,17.5,.28,3.28,red);
   box(x,4.31,17.5,.93,.22,1.22,teal);
   box(x,4.52,17.5,1.28,.23,1.58,red);
   solid(x,17.5,.79,.79);
 }
 box(-4,4.43,17.5,8.32,.35,.66,teal);
 plaque('雲林寺',-4,4.32,17.94,2.38,.57);
 roof(-4,4.88,17.5,10.95,4.79,1.76);

 section='bell';
 const bx=10.5,bz=5;
 platform(bx,bz,6.0,5.7,1.13,.42);
 stairs(bx,8.83,2.68,1.13,4,.35,.133);
 for(const dx of [-2.07,2.07])for(const dz of [-1.85,1.85]){
   round(bx+dx,1.67,bz+dz,[[.30,0],[.31,.09],[.26,.20]],stones[0],undefined,12);
   column(bx+dx,1.84,bz+dz,.15,2.89,red);
   box(bx+dx,4.42,bz+dz,.52,.32,.53,teal);
   solid(bx+dx,bz+dz,.55,.55);
 }
 box(bx,4.66,bz,5.22,.25,4.56,teal);
 roof(bx,5.02,bz,7.12,6.24,1.62);
 round(bx,2.08,bz,[[.73,0],[.86,.011],[.92,.067],[.87,.134],[.78,.275],[.69,.58],[.625,.98],[.58,1.28],[.46,1.46],[.32,1.59],[.01,1.64]],bronze,undefined,52);
 for(const [y,r] of [[2.17,.915],[2.41,.79],[3.39,.568],[3.45,.515]]){
   const g=new T.TorusGeometry(r,.026,8,52).rotateX(-Math.PI/2).translate(bx,y,bz);
   add(g,brass);
 }
 for(let i=0;i<24;i++){
   const t=i*TAU/24;
   round(bx+.668*Math.cos(t),2.91,bz+.668*Math.sin(t),[[.019,0],[.031,.027],[.022,.062],[0,.071]],brass,undefined,8);
 }
 pipe([bx,3.68,bz],[bx,4.65,bz],.109,.073,bronze);
 solid(bx,bz,1.78,1.78);
 const mallet=new T.Group();mallet.position.set(bx,4.54,6.76);scene.add(mallet);
 pipe([0,-1.65,-.64],[0,-1.65,.64],.132,.146,wood,mallet,18);
 for(const zz of [-.41,.41])pipe([0,-1.60,zz],[0,0,zz],.017,.013,tan,mallet,7);
 solid(bx,6.76,.33,1.31);
 use('bell','범종 울리기',bx,2.86,6.68,2.48);

 section='pagoda';
 const tx=-4,tz=-2.4;
 platform(tx,tz,4.29,4.29,1.13,.35);
 for(const [size,y,h] of [[3.18,1.60,.32],[2.73,1.92,.49],[2.79,2.41,.15]])box(tx,y,tz,size,h,size,stones[2]);
 for(let i=0;i<3;i++){
   const size=2.53-i*.52,y=2.53+i*1.24;
   box(tx,y,tz,size*.65,.85,size*.65,stones[2]);
   for(const side of [-1,1])box(tx,y+.17,tz+side*size*.332,size*.32,.54,.023,stones[0]);
   for(const [w,h,t] of [[size*.77,.83,.10],[size,.93,.13],[size*.89,1.06,.11],[size*.74,1.17,.074]])box(tx,y+h,tz,w,t,w,stones[3]);
 }
 round(tx,6.17,tz,[[.34,0],[.41,.08],[.30,.21],[.23,.40],[.13,.59],[0,.73]],stone);
 solid(tx,tz,4.45,4.45);

 section='stone-detail';
 for(const z of [12,4,-6,-18])for(const x of [-9,1]){
   round(x,1.13,z,[[.43,0],[.46,.08],[.34,.21],[.17,.28],[.17,.83],[.33,.91]],stones[2],undefined,12);
   box(x,2.04,z,.36,.25,.35,stones[0]);box(x,2.29,z,.56,.085,.56,stones[1]);
   round(x,2.375,z,[[.29,0],[.27,.068],[.13,.18],[0,.23]],stones[2],undefined,8);
   solid(x,z,.83,.83);
 }
 for(let i=0;i<42;i++){
   const x=left+.48+i*.97;
   box(x,1.11,north+.22,.95,1.32,.47,stones[i%stones.length],(rand()-.5)*.06);
   box(x,2.43,north+.22,.99,.14,.66,ridge);
 }
 solid(cx,north+.22,cw,.58);

 section='low-stonework';
 for(const [x,z,w,d,h] of [[-13.35,9.70,2.52,.62,.43],[3.75,9.8,2.20,.64,.46],[-11.87,-4.13,1.53,.83,.51]]){
   box(x,1.11,z,w-.08,h-.08,d-.08,stones[1]);
   box(x,1.11+h-.08,z,w,.08,d,stone);
   lowSolid(x,z,w,d,1.11+h);
 }

 section='pond';
 const {x:px,z:pz,rx,rz}=pond;
 const wall=new T.CylinderGeometry(1,.96,.42,88,1,true).scale(rx,1,rz).translate(px,.96,pz);
 add(wall,new T.MeshStandardMaterial({color:'#746e59',map:maps.stone,roughness:.95,side:T.DoubleSide}));
 const bed=new T.CircleGeometry(1,88).rotateX(-Math.PI/2).scale(rx*.998,1,rz*.998).translate(px,.76,pz);
 add(bed,new T.MeshStandardMaterial({color:'#766e51',map:maps.pond,roughness:.9}));
 for(let i=0;i<62;i++){
   const t=i*TAU/62,xx=px+rx*Math.cos(t),zz=pz+rz*Math.sin(t);
   const sx=.20+rand()*.15,sz=.16+rand()*.11;
   add(transform(rockGeometry,xx,1.18+rand()*.03,zz,sx,.12+rand()*.05,sz,rand()*TAU),stones[i%stones.length]);
 }
 for(let i=0;i<22;i++){
   const z=pz-3.28+i*.312,y=1.16+.52*Math.sin(Math.PI*i/21);
   box(px+.32,y,z,1.36,.105,.318,stone);
   floor(px+.32,z,1.37,.36,y+.106);
   for(const sign of [-1,1]){
     const x=px+.32+sign*.69;
     solid(x,z,.081,.321);
     if(i%4===0)column(x,y+.105,z,.055,.45,red);
     if(i){
       const last=1.16+.52*Math.sin(Math.PI*(i-1)/21);
       pipe([x,last+.51,z-.312],[x,y+.51,z],.040,.040,red,undefined,8);
     }
   }
 }
 for(let i=0;i<44;i++){
   const angle=rand()*TAU,r=Math.sqrt(rand())*.90;
   const x=px+rx*r*Math.cos(angle),z=pz+rz*r*Math.sin(angle);
   add(transform(rockGeometry,x,.82,z,.10+rand()*.28,.044+rand()*.065,.09+rand()*.20,angle),stones[i%stones.length]);
 }
 section='shore';
 for(let i=0;i<154;i++){
   const z=-56+rand()*109,x=river(z)+(rand()<.5?-1:1)*(3.5+rand()*3.25);
   const r=.12+rand()**2*.58;
   add(transform(rockGeometry,x,terrainAt(x,z)+r*.05,z,r,r*.57,r*(.60+rand()*.48),rand()*TAU),stones[i%stones.length]);
   if(r>.47)solid(x,z,r*1.7,r*1.4);
 }
 for(let i=0;i<85;i++){
   const x=-55+rand()*109,z=-52+rand()*101;
   if((left-.65<x&&x<right+.65&&north-.65<z&&z<22)||(z>20&&x>-8&&x<8)||Math.abs(x-river(z))<6)continue;
   const r=.27+rand()**2*1.02;
   add(transform(rockGeometry,x,terrainAt(x,z)+r*.15,z,r,r*.64,r*(.6+rand()*.49),rand()*TAU),stones[i%stones.length]);
   if(r>.54){
     const top=terrainAt(x,z)+r*.73;
     lowSolid(x,z,r*1.62,r*1.39,top);
   }
 }
 for(const {g,m} of batches.values()){
   const merged=mergeGeometries(g);
   if(!merged)throw Error('Static scene geometry could not be combined');
   const mesh=shadowMesh(merged,m);scene.add(mesh);
   for(const geometry of g)geometry.dispose();
 }
 return {floors,solids,actions,doors,flames,incense,lamps,smokeOrigin,mallet,statueBase};
}
