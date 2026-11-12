import * as T from './vendor/three.js';

export function makeWaterSurface(geometry,normalMap,lightDirection,{x,y,z,alpha,color,size}){
 const waterColor=new T.Color(color);
 const material=new T.ShaderMaterial({
   transparent:true,depthWrite:false,fog:true,
   uniforms:T.UniformsUtils.merge([T.UniformsLib.fog,{
     waterNormals:{value:normalMap},time:{value:0},size:{value:size},opacity:{value:alpha},
     waterColor:{value:waterColor},sunColor:{value:new T.Color('#ffdfad')},
     sunDirection:{value:lightDirection},daylight:{value:1}
   }]),
   vertexShader:`
     varying vec3 worldPoint;
     #include <fog_pars_vertex>
     void main(){
       worldPoint=(modelMatrix*vec4(position,1.)).xyz;
       vec4 mvPosition=modelViewMatrix*vec4(position,1.);
       gl_Position=projectionMatrix*mvPosition;
       #include <fog_vertex>
     }`,
   fragmentShader:`
     uniform sampler2D waterNormals;
     uniform float time,size,opacity,daylight;
     uniform vec3 waterColor,sunColor,sunDirection;
     varying vec3 worldPoint;
     #include <fog_pars_fragment>
     void main(){
       vec2 p=worldPoint.xz*size;
       vec2 a=texture2D(waterNormals,p*.39+time*vec2(.039,.014)).rg;
       vec2 b=texture2D(waterNormals,p*.83+time*vec2(-.019,.032)).rg;
       vec2 ripple=(a+b-1.)*.36;
       vec3 n=normalize(vec3(ripple.x,1.,ripple.y));
       vec3 v=normalize(cameraPosition-worldPoint);
       float f=.035+.965*pow(1.-clamp(dot(v,n),0.,1.),4.5);
       vec3 r=reflect(-v,n);
       vec3 sky=mix(vec3(.016,.025,.041),mix(vec3(.31,.35,.31),vec3(.12,.20,.26),
         clamp(r.y*1.15,0.,1.)),daylight);
       float sparkle=pow(max(0.,dot(r,sunDirection)),52.);
       vec3 color=mix(waterColor*(.41+.15*max(0.,dot(n,sunDirection))),sky,clamp(f*.86+.11,0.,1.));
       color+=sunColor*sparkle*.58;
       gl_FragColor=vec4(color,clamp(opacity*.71+f*.42,.35,.93));
       #include <tonemapping_fragment>
       #include <colorspace_fragment>
       #include <fog_fragment>
     }`
 });
 const mesh=new T.Mesh(geometry,material);
 mesh.rotation.x=-Math.PI/2;
 mesh.position.set(x,y,z);
 mesh.renderOrder=2;
 mesh.userData.dayColor=waterColor;
 return mesh;
}
