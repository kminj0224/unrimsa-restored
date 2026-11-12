import {clamp,pond,pondBed,pondRadius,river,riverHalfWidth,riverY,rooms,spawn,terrainAt} from './world.js';

const radius=.255;
const bodyHeight=1.72;
const gravity=12.9;
const jumpSpeed=5.05;
const stepHeight=.28;
function hits(x,z,cx,cz,w,d){
 const dx=Math.max(0,Math.abs(x-cx)-w/2),dz=Math.max(0,Math.abs(z-cz)-d/2);
 return dx*dx+dz*dz<radius*radius;
}

export function walking(world){
 const states=new Map(rooms.map(r=>[r.id,{open:false,position:0}]));
 const cells=new Map();
 const player={...spawn,floor:.66,y:.66,feet:.66,vertical:0,grounded:true};
 const key=(x,z)=>Math.floor(x/4)+','+Math.floor(z/4);
 for(const c of world.solids){
   const pad=radius+(c.door?Math.abs(c.door.shift):0)+.025;
   for(let x=Math.floor((c.x-c.w/2-pad)/4);x<=Math.floor((c.x+c.w/2+pad)/4);x++){
     for(let z=Math.floor((c.z-c.d/2-pad)/4);z<=Math.floor((c.z+c.d/2+pad)/4);z++){
       const k=x+','+z;
       if(!cells.has(k))cells.set(k,[]);
       cells.get(k).push(c);
     }
   }
 }
 function groundAt(x,z){
   const radius=pondRadius(x,z);
   let top=radius<1?pondBed(radius):terrainAt(x,z);
   for(const [cx,cz,w,d,y] of world.floors){
     if(radius<1&&y<=1.11)continue;
     if(Math.abs(x-cx)<=w/2&&Math.abs(z-cz)<=d/2)top=Math.max(top,y);
   }
   return top;
 }
 function waterAt(x,z,feet){
   const surface=pondRadius(x,z)<1?pond.y:Math.abs(x-river(z))<riverHalfWidth(z)?riverY:-Infinity;
   return feet<surface-.025?surface:null;
 }
 function floorAt(x,z,limit=Infinity){
   let top=groundAt(x,z);
   for(const c of cells.get(key(x,z))||[]){
     if(c.top>top&&c.top<=limit&&hits(x,z,c.x,c.z,c.w,c.d))top=c.top;
   }
   return top;
 }
 function blocked(x,z,feet=player.feet){
   if(x<-53||x>53||z<-50||z>51)return true;
   for(const c of cells.get(key(x,z))||[]){
     if(c.top!==undefined&&feet>=c.top-.012)continue;
     const offset=c.door?states.get(c.door.room).position*c.door.shift:0;
     if(hits(x,z,c.x+offset,c.z,c.w,c.d))return true;
   }
   return false;
 }
 function roomAt(x,z){
   return rooms.find(r=>Math.abs(x-r.x)<r.w/2-.075&&Math.abs(z-r.z)<r.d/2-.10)||null;
 }
 function ceilingAt(x,z){
   const r=roomAt(x,z);
   return r?r.floor+r.h-.39:Infinity;
 }
 function tryMove(x,z){
   const support=groundAt(x,z),step=support-player.feet;
   if(step>(player.grounded?stepHeight:.022))return;
   const feet=player.grounded?Math.max(support,player.feet):player.feet;
   if(feet+bodyHeight>ceilingAt(x,z)+.018||blocked(x,z,feet))return;
   player.x=x;player.z=z;
   player.floor=floorAt(x,z,feet+.023);
   if(player.grounded){
     if(player.floor<player.feet-.095){
       player.grounded=false;
       player.vertical=0;
     }else player.feet=player.floor;
   }
 }
 function move(dx,dz){
   const count=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.075));
   dx/=count;dz/=count;
   for(let i=0;i<count;i++){
     if(dx)tryMove(player.x+dx,player.z);
     if(dz)tryMove(player.x,player.z+dz);
   }
 }
 function jump(){
   if(!player.grounded)return false;
   player.grounded=false;
   player.vertical=jumpSpeed;
   return true;
 }
 function integrateJump(dt){
   const {x,z}=player;
   const max=ceilingAt(x,z)-bodyHeight;
   const count=Math.max(1,Math.ceil(dt/.017));
   const part=dt/count;
   for(let i=0;i<count&&!player.grounded;i++){
     const next=player.feet+player.vertical*part-.5*gravity*part*part;
     player.vertical-=gravity*part;
     const support=floorAt(x,z,player.feet+.028);
     if(player.vertical<=0&&next<=support){
       player.feet=support;player.floor=support;player.vertical=0;player.grounded=true;
     }else if(next>max&&player.vertical>0){
       player.feet=max;player.vertical=0;
     }else{
       player.feet=next;player.floor=support;
     }
   }
 }
 function room(){return roomAt(player.x,player.z);}
 function action(){
   let score=-Infinity,best=null;
   const a=Math.sin(player.yaw),b=-Math.cos(player.yaw),here=room();
   for(const item of world.actions){
     if(item.room&&!item.id.startsWith('door:')&&item.room!==here?.id)continue;
     const dx=item.x-player.x,dz=item.z-player.z,distance=Math.hypot(dx,dz);
     if(distance>item.dist||Math.abs(item.y-player.feet-1.06)>1.63)continue;
     const direction=(dx*a+dz*b)/Math.max(.015,distance);
     if(direction<.12&&distance>1.02)continue;
     const quality=direction*.79-distance*.54;
     if(quality>score){score=quality;best=item;}
   }
   return best;
 }
 function toggleDoor(id){
   const state=states.get(id);
   if(!state)return false;
   if(state.open){
     for(const c of world.solids){
       if(c.door?.room!==id)continue;
       const shift=c.door.shift*state.position;
       if(hits(player.x,player.z,c.x+shift*.5,c.z,c.w+Math.abs(shift),c.d))return false;
     }
   }
   state.open=!state.open;
   return true;
 }
 function tick(dt){
   if(!player.grounded)integrateJump(dt);
   const dy=player.feet-player.y;
   player.y=Math.abs(dy)<.003?player.feet:player.y+dy*clamp(dt*(player.grounded?16:26),0,1);
   let moved=false;
   for(const state of states.values()){
     const target=Number(state.open);
     if(state.position===target)continue;
     state.position+=Math.sign(target-state.position)*Math.min(Math.abs(target-state.position),dt*2.6);
     if(Math.abs(target-state.position)<.001)state.position=target;
     moved=true;
   }
   for(const d of world.doors)d.mesh.position.x=states.get(d.room).position*d.shift;
   return moved;
 }
 function reset(){
   Object.assign(player,spawn);
   player.floor=floorAt(player.x,player.z);
   player.y=player.feet=player.floor;
   player.vertical=0;player.grounded=true;
   for(const s of states.values()){s.open=false;s.position=0;}
   for(const d of world.doors)d.mesh.position.x=0;
 }
 reset();
 return {player,states,floorAt,waterAt,blocked,move,jump,room,action,toggleDoor,tick,reset};
}
