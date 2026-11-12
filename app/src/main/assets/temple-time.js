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
 const daylight=T.MathUtils.smoothstep(elevation,-7,11);
 const night=1-T.MathUtils.smoothstep(elevation,-13,-3);
 const twilight=T.MathUtils.smoothstep(elevation,-13,-3)*(1-T.MathUtils.smoothstep(elevation,0,11));
 const period=elevation>9?'낮':elevation>-.8?(east>0?'아침':'저녁'):elevation>-13?(east>0?'새벽':'해질녘'):'밤';
 return {east,north,up,daylight,night,twilight,period,ms,elevation};
}

export function templeLighting(scene,renderer,sun,ambient,sky,waters,lanterns){
 const direction=new T.Vector3(),lit=new T.Color(),fog=new T.Color();
 const dayFog=new T.Color('#a5b6ae'),nightFog=new T.Color('#18283f'),duskFog=new T.Color('#a1776d');
 const daySun=new T.Color('#ffedcb'),warmSun=new T.Color('#ffac70'),moon=new T.Color('#91b2e9');
 const daySky=new T.Color('#d6e6eb'),nightSky=new T.Color('#819dce');
 const dayGround=new T.Color('#74664e'),nightGround=new T.Color('#39364c');
 let last=-Infinity,lastShadow=-Infinity;
 return now=>{
   const state=solarState(now);
   if(Math.abs(now-last)<1600)return state;
   const {east,north,up,daylight,night,twilight}=state;
   direction.set(east,Math.max(.045,up),-north).normalize();
   sun.position.copy(direction).multiplyScalar(46);
   sun.intensity=.14+2.04*daylight+.28*twilight;
   sun.color.copy(lit.copy(moon).lerp(daySun,daylight).lerp(warmSun,twilight*.82));
   ambient.intensity=.37+.82*daylight+.12*twilight;
   ambient.color.copy(nightSky).lerp(daySky,daylight);
   ambient.groundColor.copy(nightGround).lerp(dayGround,daylight);
   scene.environmentIntensity=.30+.59*daylight+.12*twilight;
   renderer.toneMappingExposure=.94+.25*daylight;
   fog.copy(nightFog).lerp(dayFog,daylight).lerp(duskFog,twilight*.74);
   scene.background.copy(fog);
   scene.fog.color.copy(fog);
   scene.fog.density=.0092+.0024*night;
   const uniforms=sky.material.uniforms;
   uniforms.sun.value.copy(direction);
   uniforms.daylight.value=daylight;
   uniforms.night.value=night;
   uniforms.twilight.value=twilight;
   for(const water of waters){
     const u=water.material.uniforms;
     u.sunDirection.value.copy(direction);
     u.sunColor.value.copy(lit).multiplyScalar(.16+.84*daylight+.30*twilight);
     u.waterColor.value.copy(water.userData.dayColor).multiplyScalar(.25+.75*daylight+.12*twilight);
   }
   for(const light of lanterns)light.intensity=(1-T.MathUtils.smoothstep(daylight,.18,.61))*light.userData.maximum;
   if(Math.abs(now-lastShadow)>=30000){renderer.shadowMap.needsUpdate=true;lastShadow=now;}
   last=now;
   return state;
 };
}
