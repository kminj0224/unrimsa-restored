import * as T from './vendor/three.js';
import {river,riverHalfWidth,riverY,terrainAt,clamp} from './world.js';

const TAU=2*Math.PI;

function animal(scene,source,name){
 const root=new T.Group(),body=source.clone(true);
 root.name=name;root.add(body);scene.add(root);
 return {root,body};
}
function duckPoint(time,index,daylight){
 const a=time*.104+index*.52;
 const z=11.6+Math.sin(a)*(6.4+index*.75);
 const bank=riverHalfWidth(z);
 const offset=-(1.5+1.5*(1-daylight))+Math.cos(a)*(1.11+index*.29);
 return [river(z)+clamp(offset,-bank+.52,bank-.52),z];
}

export function streamLife(scene,models){
 const ducks=Array.from({length:2},(_,i)=>{
   const item=animal(scene,models.mallard,'Mallard '+(i+1));
   item.body.rotation.y=-Math.PI/2;
   item.root.scale.setScalar(i===0?.94:.84);
   return item;
 });
 const frogs=Array.from({length:5},(_,i)=>{
   const item=animal(scene,models['stream-frog'],'Stream frog '+(i+1));
   const bounds=new T.Box3().setFromObject(item.body),center=bounds.getCenter(new T.Vector3());
   item.body.position.set(-center.x,-bounds.min.y,-center.z);
   item.root.scale.setScalar(1.31+i*.084);
   return item;
 });
 let time=0,duckTime=0;
 return (dt,viewer,daylight)=>{
   time+=dt;duckTime+=dt*(.31+.69*daylight);
   for(const [i,{root,body}] of ducks.entries()){
     const [x,z]=duckPoint(duckTime,i,daylight);
     const [nextX,nextZ]=duckPoint(duckTime+.07,i,daylight);
     root.visible=Math.hypot(viewer.x-x,viewer.z-z)<35;
     if(!root.visible)continue;
     root.position.set(x,riverY-.137+.012*Math.sin(time*3.3+i),z);
     root.rotation.y=Math.atan2(nextX-x,nextZ-z);
     body.rotation.z=.037*Math.sin(time*4+i*2.3);
     body.rotation.x=.028*Math.sin(time*2.7+i);
   }
   for(const [i,{root,body}] of frogs.entries()){
     const pulse=(time+i*3.83)/(7.8+i*.87),turn=Math.floor(pulse),step=pulse-turn;
     const a=clamp(step*17,0,1);
     const z=4.3+i*3.31+.64*Math.sin(turn*1.53+i)*(1-a)+.64*Math.sin((turn+1)*1.53+i)*a;
     const x=river(z)-riverHalfWidth(z)-(.21+.34*(i%3));
     root.visible=Math.hypot(viewer.x-x,viewer.z-z)<19;
     if(!root.visible)continue;
     const jump=Math.sin(Math.PI*a);
     root.position.set(x,Math.max(riverY+.014,terrainAt(x,z))+.006+jump*.18,z);
     root.rotation.y=Math.PI/2+.38*Math.sin(turn*1.53+i);
     body.rotation.x=-.30*jump*Math.cos(a*Math.PI);
     body.scale.y=1+.045*Math.sin(time*4.1+i*TAU/5);
   }
 };
}
