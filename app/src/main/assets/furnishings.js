import * as T from './vendor/three.js';

const TAU=Math.PI*2;
const point=(x,y,z)=>new T.Vector3(x,y,z);

export function textiles(add,maps){
 const cloth=(color,roughness)=>new T.MeshStandardMaterial({
   color,map:maps.weave,normalMap:maps.weaveNormal,normalScale:new T.Vector2(.66,.66),roughness
 });
 const flax=cloth('#c4ad85',.96);
 const ivory=cloth('#e8d7b5',.92);
 const indigo=cloth('#687f86',.94);
 const garnet=cloth('#91514a',.93);
 const teaGreen=cloth('#6f7755',.95);
 const cord=new T.MeshStandardMaterial({color:'#95836e',roughness:.96});

 function padded(x,y,z,w,d,h,material,rotation=0,channels=0){
   const segments=48,rings=10;
   const positions=[],uvs=[],indices=[];
   const turn=new T.Matrix4().makeRotationY(rotation).setPosition(x,y,z);
   const transform=(a,b,c)=>point(a,b,c).applyMatrix4(turn);
   function dimensions(angle,r){
     const a=Math.cos(angle),b=Math.sin(angle);
     const squircle=(1/(a**8+b**8))**.125;
     return [a*squircle*r,b*squircle*r];
   }
   function shape(u,v,r,angle,top){
     const crown=(1-r*r)**.60;
     const gathered=(.018*Math.sin(angle*12+1.7)+.027*Math.sin(angle*7-.4))*
       Math.sin(Math.PI*r)**1.2+.035*Math.sin(u*7-v*3)*crown;
     const quilting=channels?(.07*Math.cos((v+.08)*channels*Math.PI)**8)*crown:0;
     return h*(.38+(top?(.62+gathered-quilting)*crown:-(.34+gathered*.45)*crown));
   }
   for(const top of [true,false]){
     const start=positions.length/3;
     for(let i=0;i<=rings;i++){
       const r=Math.max(.001,i/rings);
       for(let j=0;j<segments;j++){
         const angle=j*TAU/segments;
         const [u,v]=dimensions(angle,r);
         const xx=u*w/2,zz=v*d/2;
         positions.push(...transform(xx,shape(u,v,r,angle,top),zz).toArray());
         uvs.push(xx/.34+.54,zz/.34+.28);
         if(i){
           const a=start+(i-1)*segments+j,b=start+(i-1)*segments+(j+1)%segments;
           const c=start+i*segments+j,e=start+i*segments+(j+1)%segments;
           if(top)indices.push(a,b,c,b,e,c);
           else indices.push(a,c,b,b,c,e);
         }
       }
     }
   }
   const geo=new T.BufferGeometry();
   geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
   geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
   geo.setIndex(indices);geo.computeVertexNormals();add(geo,material);
   const edge=[];
   for(let j=0;j<segments;j++){
     const [u,v]=dimensions(j*TAU/segments,1);
     edge.push(transform(u*w/2,.38*h,v*d/2));
   }
   add(new T.TubeGeometry(new T.CatmullRomCurve3(edge,true),64,Math.min(.009,h*.13),5,true),cord);
 }
 function cushion(x,y,z,w,d,rotation=0,tea=false){
   padded(x,y,z,w,d,tea?.092:.114,tea?teaGreen:garnet,rotation);
 }
 function bedding(x,y,z){
   padded(x,y,z,1.22,2.09,.035,flax,-.018);
   padded(x-.012,y+.035,z-.14,1.045,1.66,.101,indigo,.008,9);
   padded(x+.018,y+.137,z-.71,.66,.375,.142,ivory,-.07);
   padded(x+.014,y+.141,z+.34,1.04,.65,.107,flax,.033,4);
   padded(x+.039,y+.233,z+.43,1.00,.46,.063,indigo,.038,4);
 }
 function folded(x,y,z,i){
   padded(x+(i-1)*.019,y,z,.65-i*.029,.47,.076,i===1?ivory:indigo,.06*i,3);
 }
 return {cushion,bedding,folded};
}
