(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))o(e);new MutationObserver(e=>{for(const i of e)if(i.type==="childList")for(const s of i.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&o(s)}).observe(document,{childList:!0,subtree:!0});function r(e){const i={};return e.integrity&&(i.integrity=e.integrity),e.referrerPolicy&&(i.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?i.credentials="include":e.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function o(e){if(e.ep)return;e.ep=!0;const i=r(e);fetch(e.href,i)}})();const m=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = (a_pos + 1.0) * 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,p=`#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_mirrors;
uniform float u_speed;
uniform float u_zoom;
uniform float u_rot;
uniform float u_bright;
uniform float u_contrast;
uniform float u_hueShift;
uniform vec3 u_bg1;
uniform vec3 u_bg2;
uniform float u_seed;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

vec2 kaleido(vec2 p, float n) {
  float r = length(p);
  float a = atan(p.y, p.x);
  float seg = 6.2831853 / n;
  a = mod(a + u_time * 0.05, seg);
  a = abs(a - seg * 0.5);
  return vec2(cos(a), sin(a)) * r;
}

vec2 rot(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c) * p;
}

vec3 palette(float t) {
  vec3 a = vec3(0.5);
  vec3 b = vec3(0.5);
  vec3 c = vec3(1.0);
  vec3 d = vec3(0.0, 0.33, 0.67);
  return a + b * cos(6.2832 * (c * t + d));
}

void main() {
  vec2 uv = (v_uv - 0.5) * 2.0;
  uv.x *= u_resolution.x / u_resolution.y;

  float t = u_time * u_speed;
  vec2 p = uv;
  p = rot(p, t * u_rot);
  float zoom = pow(1.4, t * u_zoom);
  p *= zoom;
  vec2 k = kaleido(p, u_mirrors);

  // SHARP LINES: thinner sample, harder edge detection, minimal blur
  vec2 q = k * 1.2 + vec2(u_seed * 7.13, u_seed * 3.91);

  // Higher-frequency FBM - more detail in the patterns
  float n = fbm(q);
  float n2 = fbm(q * 3.0 + 13.0);
  float n3 = fbm(q * 6.5 + 27.0);

  // Sharp hex outlines: difference between detail levels, very tight threshold
  float edge = 1.0 - smoothstep(0.005, 0.04, abs(n2 - n));
  float edge2 = 1.0 - smoothstep(0.005, 0.03, abs(n3 - n2));
  float lines = max(edge, edge2 * 0.8);

  // Sparse bright points (the particle clusters from the video)
  float cluster = 1.0 - smoothstep(0.0, 0.08, abs(fbm(q * 1.5) - n));
  cluster = pow(cluster, 3.0) * 0.4;  // less blurry, smaller

  // Color from palette - hue based on position + time
  float t_pal = length(k) * 0.3 + n * 0.4 + u_time * 0.04 + u_hueShift / 6.2832;
  vec3 col = palette(t_pal);

  // SHARP final: just lines + sparse clusters, no broad glow
  vec3 finalColor = col * lines * 1.6;
  finalColor += col * cluster * 1.0;

  // Background gradient
  vec3 bg = mix(u_bg2, u_bg1, v_uv.y);
  bg += col * lines * 0.04;  // very subtle color hint

  vec3 final = bg + finalColor * u_bright * u_contrast;

  // Tight vignette
  float vig = smoothstep(1.6, 0.4, length(uv));
  final *= vig;

  fragColor = vec4(final, 1.0);
}
`;class v{constructor(){if(this.canvas=document.getElementById("gl"),this.gl=this.canvas.getContext("webgl2")||this.canvas.getContext("webgl"),this.state={mirrors:6,speed:.6,zoom:.3,rot:.1,bright:.85,contrast:1.4,hueShift:0,bg1:[.04,0,.06],bg2:[.1,0,.12],seed:Math.random()*100,palette:"neon"},this.SYNC_KEY=new URLSearchParams(location.search).get("stream")||"default",this.IS_ADMIN=new URLSearchParams(location.search).has("admin"),this.IS_ADMIN&&document.body.classList.add("admin"),!this.gl){document.body.innerHTML='<div style="color:#f55;padding:20px">WebGL not supported</div>';return}this.init()}hexToRgb(t){return[parseInt(t.slice(1,3),16)/255,parseInt(t.slice(3,5),16)/255,parseInt(t.slice(5,7),16)/255]}init(){const t=this.gl;this.prog=this.createProgram(m,p),this.uTime=t.getUniformLocation(this.prog,"u_time"),this.uRes=t.getUniformLocation(this.prog,"u_resolution"),this.uMirrors=t.getUniformLocation(this.prog,"u_mirrors"),this.uSpeed=t.getUniformLocation(this.prog,"u_speed"),this.uZoom=t.getUniformLocation(this.prog,"u_zoom"),this.uRot=t.getUniformLocation(this.prog,"u_rot"),this.uBright=t.getUniformLocation(this.prog,"u_bright"),this.uContrast=t.getUniformLocation(this.prog,"u_contrast"),this.uHueShift=t.getUniformLocation(this.prog,"u_hueShift"),this.uBg1=t.getUniformLocation(this.prog,"u_bg1"),this.uBg2=t.getUniformLocation(this.prog,"u_bg2"),this.uSeed=t.getUniformLocation(this.prog,"u_seed");const r=t.createBuffer();t.bindBuffer(t.ARRAY_BUFFER,r),t.bufferData(t.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),t.STATIC_DRAW);const o=t.createVertexArray();t.bindVertexArray(o);const e=t.getAttribLocation(this.prog,"a_pos");t.enableVertexAttribArray(e),t.vertexAttribPointer(e,2,t.FLOAT,!1,0,0),this.resize(),window.addEventListener("resize",()=>this.resize())}createProgram(t,r){const o=this.gl,e=this.compileShader(o.VERTEX_SHADER,t),i=this.compileShader(o.FRAGMENT_SHADER,r),s=o.createProgram();if(o.attachShader(s,e),o.attachShader(s,i),o.linkProgram(s),!o.getProgramParameter(s,o.LINK_STATUS)){const n=o.getProgramInfoLog(s);throw document.body.innerHTML=`<pre style="color:#f55;padding:20px">Link failed: ${n}</pre>`,new Error(n)}return s}compileShader(t,r){const o=this.gl,e=o.createShader(t);if(o.shaderSource(e,r),o.compileShader(e),!o.getShaderParameter(e,o.COMPILE_STATUS)){const i=o.getShaderInfoLog(e);throw document.body.innerHTML=`<pre style="color:#f55;padding:20px;font-size:11px">Shader compile failed: ${i}</pre>`,new Error(i)}return e}resize(){const t=Math.min(window.devicePixelRatio||1,2);this.canvas.width=window.innerWidth*t,this.canvas.height=window.innerHeight*t,this.canvas.style.width=window.innerWidth+"px",this.canvas.style.height=window.innerHeight+"px"}render(t){const r=this.gl;r.viewport(0,0,this.canvas.width,this.canvas.height),r.useProgram(this.prog),r.uniform1f(this.uTime,t),r.uniform2f(this.uRes,this.canvas.width,this.canvas.height),r.uniform1f(this.uMirrors,this.state.mirrors),r.uniform1f(this.uSpeed,this.state.speed),r.uniform1f(this.uZoom,this.state.zoom),r.uniform1f(this.uRot,this.state.rot),r.uniform1f(this.uBright,this.state.bright),r.uniform1f(this.uContrast,this.state.contrast),r.uniform1f(this.uHueShift,this.state.hueShift),r.uniform3fv(this.uBg1,this.state.bg1),r.uniform3fv(this.uBg2,this.state.bg2),r.uniform1f(this.uSeed,this.state.seed),r.drawArrays(r.TRIANGLES,0,6)}}const a=new v;function f(c){a.render(c/1e3),requestAnimationFrame(f)}requestAnimationFrame(f);const u={neon:[[1,0,.43],[.98,.23,.05],[1,.75,0],[.4,1,0],[.05,.95,.5]],fire:[[1,0,0],[1,.45,0],[1,.85,0],[1,1,.2],[1,.5,0]],ocean:[[0,.05,.2],[0,.2,.6],[0,.5,.85],[.2,.85,.95],[.5,.95,1]],matrix:[[.1,1,.3],[.2,1,.5],[.4,1,.7],[.6,.95,.3],[0,.8,.2]],purple:[[.4,0,.6],[.6,.1,.8],[.8,.2,1],[.5,0,.9],[.3,.1,.7]]};function d(){const c=document.getElementById("palettes");Object.keys(u).forEach(r=>{const o=document.createElement("button");o.style.background=`linear-gradient(90deg, ${u[r].map(e=>`rgb(${Math.round(e[0]*255)},${Math.round(e[1]*255)},${Math.round(e[2]*255)})`).join(", ")})`,o.title=r,r===a.state.palette&&o.classList.add("active"),o.onclick=()=>{a.state.palette=r,document.querySelectorAll("#palettes button").forEach(n=>n.classList.remove("active")),o.classList.add("active");const[e,i]=u[r];document.getElementById("bg1").value="#"+[e[0]*255,e[1]*255,e[2]*255].map(n=>Math.round(n).toString(16).padStart(2,"0")).join("");const s=u[r][3];document.getElementById("bg2").value="#"+[s[0]*255,s[1]*255,s[2]*255].map(n=>Math.round(n).toString(16).padStart(2,"0")).join(""),a.state.bg1=a.hexToRgb(document.getElementById("bg1").value),a.state.bg2=a.hexToRgb(document.getElementById("bg2").value),l()},c.appendChild(o)});const t=[["mirrors","mirrors","vMirrors",parseInt],["speed","speed","vSpeed",parseFloat],["zoom","zoom","vZoom",parseFloat],["rot","rot","vRot",parseFloat],["bright","bright","vBright",parseFloat],["contrast","contrast","vContrast",parseFloat],["hueShift","hueShift","vHueShift",parseFloat],["bg1","bg1",null,null],["bg2","bg2",null,null]];for(const[r,o,e,i]of t){const s=document.getElementById(r);s&&(s.value=a.state[o],e&&(document.getElementById(e).textContent=String(a.state[o])),s.addEventListener("input",n=>{const h=i?i(n.target.value):n.target.value;a.state[o]=h,e&&(document.getElementById(e).textContent=String(h)),(o==="bg1"||o==="bg2")&&(a.state[o]=a.hexToRgb(n.target.value)),l()}))}document.getElementById("seedBtn").onclick=()=>{a.state.seed=Math.random()*1e3,l()}}async function l(){try{await fetch("/api/state",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:a.SYNC_KEY,state:a.state})})}catch{}}async function g(){try{const c=await fetch(`/api/state?key=${encodeURIComponent(a.SYNC_KEY)}`);if(!c.ok)return;const t=await c.json();t&&t.state&&(Object.assign(a.state,t.state),a.IS_ADMIN&&d())}catch{}}a.IS_ADMIN&&d();g();setInterval(g,2e3);
