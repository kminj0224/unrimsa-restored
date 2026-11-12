import * as T from './vendor/three.js';

export const KST_OFFSET=9*3600000;
export const DAY_MS=86400000;
const DEG=Math.PI/180;
const SEOUL_LAT=37.5665*DEG;
const SEOUL_LON=126.9780;

export function kstTime(now=Date.now()){
 const shifted=now+KST_OFFSET;
 return {day:Math.floor(shifted/DAY_MS),ms:((shifted%DAY_MS)+DAY_MS)%DAY_MS};
}

export function solarState(now){
 const {day,ms}=kstTime(now);
 const date=new Date(day*DAY_MS);
 const ordinal=1+Math.round((day*DAY_MS-Date.UTC(date.getUTCFullYear(),0,1))/DAY_MS);
 const gamma=2*Math.PI/365*(ordinal-1+(ms/3600000-12)/24);
 const eq=229.18*(.000075+.001868*Math.cos(gamma)-.032077*Math.sin(gamma)-.014615*Math.cos(2*gamma)-.040849*Math.sin(2*gamma));
 const decl=.006918-.399912*Math.cos(gamma)+.070257*Math.sin(gamma)-.006758*Math.cos(2*gamma)+
   .000907*Math.sin(2*gamma)-.002697*Math.cos(3*gamma)+.00148*Math.sin(3*gamma);
 const angle=(ms/240000+eq+SEOUL_LON-135-180)*DEG;
 const east=-Math.cos(decl)*Math.sin(angle);
 const north=Math.cos(SEOUL_LAT)*Math.sin(decl)-Math.sin(SEOUL_LAT)*Math.cos(decl)*Math.cos(angle);
 const up=Math.sin(SEOUL_LAT)*Math.sin(decl)+Math.cos(SEOUL_LAT)*Math.cos(decl)*Math.cos(angle);
 const elevation=Math.asin(T.MathUtils.clamp(up,-1,1))/DEG;
 const hour=ms/3600000;
 const {daylight,sun,ambient,environment,exposure,lamps,birds}=lightAt(hour);
 const night=1-T.MathUtils.smoothstep(daylight,.045,.44);
 const twilight=(1-T.MathUtils.smoothstep(daylight,.35,.75))*T.MathUtils.smoothstep(daylight,.015,.115);
 const period=hour<4.5||hour>=20?'밤':hour<6.5?'새벽':hour<10.5?'아침':hour<16?'한낮':'저녁';
 return {east,north,up,daylight,night,twilight,period,ms,elevation,hour,sun,ambient,environment,exposure,lamps,birds};
}

// Sky, direct sun, ambient fill, reflected light, exposure, lamps, dawn chorus.
const profiles=[
 [0,.013,.016,.033,.027,.54,1,0],
 [4.4,.013,.016,.033,.027,.54,1,0],
 [5.25,.10,.044,.092,.061,.69,.92,.82],
 [6.45,.30,.26,.26,.17,.88,.46,1],
 [8.15,.68,.94,.56,.39,1.00,0,.04],
 [11,.99,2.05,.94,.68,1.10,0,0],
 [14.3,.99,2.05,.94,.68,1.10,0,0],
 [16,.77,1.41,.71,.50,1.03,0,0],
 [17.7,.42,.63,.37,.24,.89,.26,0],
 [18.9,.13,.083,.11,.075,.68,.92,0],
 [20.1,.013,.016,.033,.027,.54,1,0],
 [24,.013,.016,.033,.027,.54,1,0]
];

function lightAt(hour){
 const i=profiles.findIndex(p=>p[0]>hour);
 const a=profiles[i-1],b=profiles[i];
 const amount=T.MathUtils.smoothstep(hour,a[0],b[0]);
 const [daylight,sun,ambient,environment,exposure,lamps,birds]=a.slice(1).map((n,j)=>T.MathUtils.lerp(n,b[j+1],amount));
 return {daylight,sun,ambient,environment,exposure,lamps,birds};
}

export function templeLighting(scene,renderer,sun,ambient,sky,waters,hallLights){
 const direction=new T.Vector3(),lit=new T.Color(),fog=new T.Color();
 const dayFog=new T.Color('#a5aca6'),nightFog=new T.Color('#121b25'),duskFog=new T.Color('#81766b');
 const daySun=new T.Color('#fff1de'),warmSun=new T.Color('#e9b58d'),moon=new T.Color('#9caec6');
 const daySky=new T.Color('#dce3e6'),nightSky=new T.Color('#8795aa');
 const dayGround=new T.Color('#726a59'),nightGround=new T.Color('#303037');
 let last=-Infinity,lastShadow=-Infinity,state;
 return now=>{
   if(Math.abs(now-last)<500)return state;
   state=solarState(now);
   const {east,north,up,daylight,night,twilight}=state;
   direction.set(east,Math.max(.045,up),-north).normalize();
   sun.position.copy(direction).multiplyScalar(46);
   sun.intensity=state.sun;
   sun.color.copy(lit.copy(moon).lerp(daySun,daylight).lerp(warmSun,twilight*.61));
   ambient.intensity=state.ambient;
   ambient.color.copy(nightSky).lerp(daySky,daylight);
   ambient.groundColor.copy(nightGround).lerp(dayGround,daylight);
   scene.environmentIntensity=state.environment;
   renderer.toneMappingExposure=state.exposure;
   fog.copy(nightFog).lerp(dayFog,daylight).lerp(duskFog,twilight*.46);
   scene.background.copy(fog);
   scene.fog.color.copy(fog);
   scene.fog.density=.0095+.002*night;
   const uniforms=sky.material.uniforms;
   uniforms.sun.value.copy(direction);
   uniforms.daylight.value=daylight;
   uniforms.night.value=night;
   uniforms.twilight.value=twilight;
   for(const water of waters){
     const u=water.material.uniforms;
     u.sunDirection.value.copy(direction);
     u.daylight.value=daylight;
     u.sunColor.value.copy(lit).multiplyScalar(.032+.86*daylight);
     u.waterColor.value.copy(water.userData.dayColor).multiplyScalar(.07+.86*daylight);
   }
   for(const light of hallLights)light.intensity=light.userData.dayIntensity*(.16+.84*daylight);
   if(daylight>.16&&Math.abs(now-lastShadow)>=45000){renderer.shadowMap.needsUpdate=true;lastShadow=now;}
   last=now;
   return state;
 };
}
