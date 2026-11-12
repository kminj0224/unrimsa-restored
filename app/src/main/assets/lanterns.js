import * as T from './vendor/three.js';

export function nightLanterns(scene,fixtures,paper){
 const lights=Array.from({length:3},()=>{
   const light=new T.PointLight('#ffc17a',0,9.4,1.85);
   light.visible=false;scene.add(light);
   return light;
 });
 const ranked=fixtures.map(position=>({position,distance:0}));
 let refresh=0;
 return (now,viewer,amount)=>{
   const lit=amount>.006;
   paper.emissiveIntensity=amount*2.2;
   if(lit&&now>=refresh){
     for(const entry of ranked)entry.distance=(viewer.x-entry.position.x)**2+(viewer.z-entry.position.z)**2;
     ranked.sort((a,b)=>a.distance-b.distance);
     for(const [i,light] of lights.entries())light.position.copy(ranked[i].position);
     refresh=now+460;
   }
   if(!lit)refresh=0;
   for(const [i,light] of lights.entries()){
     light.visible=lit&&ranked[i].distance<360;
     light.intensity=amount*(11.7+.22*Math.sin(now*.004+i*2.71));
   }
 };
}
