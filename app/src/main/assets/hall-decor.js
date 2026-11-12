import * as T from './vendor/three.js';

const TAU=2*Math.PI;
const v=(x,y,z)=>new T.Vector3(x,y,z);

function ornaments(){
 if(typeof document==='undefined')return null;
 const canvas=document.createElement('canvas');
 canvas.width=canvas.height=256;
 const c=canvas.getContext('2d');
 if(!c)return null;
 c.fillStyle='#273b33';c.fillRect(0,0,256,256);
 for(const [inset,width,ink] of [[5,10,'#302923'],[15,5,'#aa8660'],[22,12,'#885243'],[35,3,'#b5a57a']]){
   c.strokeStyle=ink;c.lineWidth=width;c.strokeRect(inset,inset,256-inset*2,256-inset*2);
 }
 for(const [scale,ink] of [[1,'#28372c'],[.95,'#61775e'],[.78,'#aa7950'],[.62,'#9e5a46'],[.47,'#5a7971']]){
   c.fillStyle=ink;c.beginPath();
   for(let i=0;i<=240;i++){
     const a=i*TAU/240,r=(56+21*Math.cos(8*a))*scale;
     const x=128+Math.cos(a)*r,y=128+Math.sin(a)*r;
     if(i===0)c.moveTo(x,y);else c.lineTo(x,y);
   }
   c.fill();
 }
 c.fillStyle='#b79b65';c.beginPath();c.arc(128,128,10,0,TAU);c.fill();
 for(const x of [49,207])for(const y of [49,207]){
   c.fillStyle='#697b69';c.beginPath();c.ellipse(x,y,9,4,Math.PI/4,0,TAU);c.fill();
 }
 const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;return tex;
}

export function decorateHall(scene,room,altarZ,maps,{add,box,round,pipe,sweep}){
 const {x,z,w,d,h,floor:y}=room;
 const canopy=new T.MeshStandardMaterial({color:'#803e31',map:maps.wood,bumpMap:maps.wood,bumpScale:.016,roughness:.82});
 const shade=new T.MeshStandardMaterial({color:'#563327',map:maps.wood,roughness:.86});
 const bronze=new T.MeshStandardMaterial({color:'#9e8056',roughness:.43,metalness:.72});
 const trim=new T.MeshStandardMaterial({color:'#b08b56',map:maps.wood,roughness:.76});
 const teal=new T.MeshStandardMaterial({color:'#577967',map:maps.wood,roughness:.86});
 const cord=new T.MeshStandardMaterial({color:'#594832',roughness:.94});
 const silk=new T.MeshStandardMaterial({color:'#864736',map:maps.weave,roughness:.94});
 const goldThread=new T.MeshStandardMaterial({color:'#ba945e',roughness:.88});
 const patterned=new T.MeshStandardMaterial({color:'#bbae8d',map:ornaments(),roughness:.91});

 if(maps.tanghwa){
   // The painting surface stands in front of its backing and the rear wall.
   const artZ=z-d/2+.57,artH=5.57,artW=6.84,artBottom=y+.37,artY=artBottom+artH/2;
   box(x,artBottom-.19,artZ-.145,artW+.43,artH+.38,.16,silk);
   const art=new T.Mesh(new T.PlaneGeometry(artW,artH),new T.MeshStandardMaterial({
     map:maps.tanghwa,emissive:'#ccb28b',emissiveMap:maps.tanghwa,emissiveIntensity:.19,
     roughness:.92,side:T.FrontSide
   }));
   art.name='Yeongsan Hoesangdo';
   art.position.set(x,artY,artZ);scene.add(art);
   for(const bar of [-1,1]){
     const barY=artY+bar*(artH/2+.057);
     pipe([x-artW/2-.23,barY,artZ+.016],[x+artW/2+.23,barY,artZ+.016],.064,.064,shade,undefined,14);
   }
   for(const side of [-1,1]){
     box(x+side*(artW/2+.115),artBottom-.07,artZ-.039,.15,artH+.14,.085,canopy);
     pipe([x+side*(artW/2+.042),artBottom,artZ+.005],
       [x+side*(artW/2+.042),artBottom+artH,artZ+.005],.016,.016,goldThread);
     for(const bar of [-1,1]){
       const barY=artY+bar*(artH/2+.057);
       round(x+side*(artW/2+.21),barY-.047,artZ+.018,[[.053,0],[.075,.045],[.053,.094]],bronze,undefined,14);
     }
   }
   const paintingLight=new T.SpotLight('#fff0ce',92,11,.63,.67,1.8);
   paintingLight.position.set(x+1.03,y+5.38,artZ+3.83);
   paintingLight.target.position.set(x,artY+.54,artZ);
   scene.add(paintingLight,paintingLight.target);
 }

 const ceiling=y+h-.31;
 // Three stepped, curved eaves under the coffered ceiling.
 const canopyZ=altarZ-.08;
 for(let layer=0;layer<3;layer++){
   const width=5.34-layer*.67,depth=2.89-layer*.42;
   const height=y+5.27+layer*.25;
   box(x,height+.17,canopyZ,width-.24,.11,depth-.20,shade);
   for(const side of [-1,1]){
     const front=canopyZ+side*depth*.50;
     const corners=[[-1,.27],[-.73,.10],[-.38,.019],[0,0],[.38,.019],[.73,.10],[1,.27]];
     sweep(corners.map(([a,b])=>[x+a*width/2,height+b,front+side*b*.35]),.078,canopy,undefined,10);
     sweep(corners.map(([a,b])=>[x+a*width/2,height+b+.063,front+side*(b*.35+.018)]),.023,trim,undefined,7);
     const rafters=23-layer*2;
     for(let j=0;j<rafters;j++){
       const u=2*j/(rafters-1)-1,xx=x+u*width*.495;
       const yy=height+.274*Math.abs(u)**3.25;
       pipe([xx,height+.225,canopyZ+side*.27],[xx,yy+.018,front+side*.048],.043,.034,canopy,undefined,7);
       const tip=new T.SphereGeometry(.034,8,5).translate(xx,yy+.018,front+side*.055);
       add(tip,trim);
     }
   }
   for(const side of [-1,1]){
     const end=x+side*width*.50;
     sweep([[end,height+.24,canopyZ-depth*.52],[end-.05*side,height+.051,canopyZ],
       [end,height+.24,canopyZ+depth*.52]],.063,canopy);
   }
 }
 for(const side of [-1,1])for(const dx of [1.31,2.17]){
   const xx=x+side*dx;
   for(let k=0;k<3;k++){
     box(xx,y+4.98+k*.101,canopyZ+1.05,.17+k*.095,.083,.53+k*.16,k%2?teal:canopy);
   }
   round(xx,y+4.91,canopyZ+1.36,[[.031,0],[.072,.047],[.050,.097]],trim,undefined,16);
 }
 for(let j=-4;j<=4;j++)for(let k=0;k<6;k++){
   const cx=x+j*2.22,cz=z-5.34+k*1.94;
   box(cx,ceiling-.044,cz,2.15,.098,1.86,shade);
   const panel=new T.PlaneGeometry(1.77,1.52).rotateX(Math.PI/2).translate(cx,ceiling-.049,cz);
   add(panel,patterned);
 }
 for(const sign of [-1,1]){
   box(x+sign*3.15,ceiling-.28,z,.43,.26,d-.51,canopy);
   box(x+sign*3.15,ceiling-.303,z,.20,.027,d-.59,teal);
 }

 const petalColors=['#b84745','#d2b991'].map((color,i)=>new T.MeshStandardMaterial({
   color,emissive:i?'#d1914c':'#ba4030',emissiveIntensity:i?.39:.37,map:maps.paper,roughness:.89
 }));
 const leaf=new T.MeshStandardMaterial({color:'#477247',emissive:'#253d1c',emissiveIntensity:.20,roughness:.9});
 const paperTag=new T.MeshStandardMaterial({color:'#ddc89a',map:maps.paper,roughness:.91,side:T.DoubleSide});
 const petal=new T.SphereGeometry(1,11,8);
 function lotusLantern(lx,ly,lz,top,variant,angle){
   pipe([lx,ly+.31,lz],[lx,top,lz],.009,.009,cord,undefined,6);
   round(lx,ly-.12,lz,[[.107,0],[.207,.052],[.256,.127],[.267,.224],[.234,.30],[.144,.385],[.041,.423],[0,.43]],petalColors[variant],undefined,25);
   for(let i=0;i<8;i++){
     const a=i*TAU/8+angle;
     const green=petal.clone().scale(.086,.124,.049).rotateX(-.54).translate(0,.037,.202);
     green.rotateY(a).translate(lx,ly,lz);add(green,leaf);
     const colored=petal.clone().scale(.084,.131,.043).rotateX(.21).translate(0,.122,.242);
     colored.rotateY(a+.15).translate(lx,ly,lz);add(colored,petalColors[variant]);
   }
   const hook=new T.TorusGeometry(.100,.014,7,22).rotateX(-Math.PI/2).translate(lx,ly-.109,lz);
   add(hook,bronze);
   pipe([lx,ly-.116,lz],[lx,ly-.197,lz],.008,.008,cord,undefined,5);
   const tag=new T.PlaneGeometry(.10,.34,1,7);
   const p=tag.getAttribute('position');
   for(let j=0;j<p.count;j++){
     const a=.17-p.getY(j);
     p.setZ(j,.035*Math.sin(a*5.6+angle)-.035*Math.sin(angle));
   }
   tag.computeVertexNormals();
   tag.rotateY(angle*.42).translate(lx,ly-.36,lz);add(tag,paperTag);
 }
 for(const side of [-1,1])for(const [row,dx] of [4.59,5.91].entries()){
   const lx=x+side*dx,railY=ceiling-.09,first=z-3.84,last=z+5.18;
   box(lx,railY, (first+last)/2,.08,.078,last-first+.39,shade);
   for(let i=0;i<9;i++){
     const lz=first+i*(last-first)/8+(row===1?.22:0);
     const ly=y+4.15+(row===1?.21:0)+.06*Math.sin(i*1.5+side);
     lotusLantern(lx,ly,lz,railY,(i+row)%5===2?1:0,i*.77+side);
   }
   const lamp=new T.PointLight('#ffc48c',row===0?13:8,8.4,1.68);
   lamp.position.set(lx,y+4.0,z+(row===0?-1.6:2.4));
   scene.add(lamp);
 }
 const fill=new T.PointLight('#ffe4b2',12,12,1.57);
 fill.position.set(x,y+4.68,z+2.65);scene.add(fill);
}
