(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))o(e);new MutationObserver(e=>{for(const r of e)if(r.type==="childList")for(const n of r.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&o(n)}).observe(document,{childList:!0,subtree:!0});function i(e){const r={};return e.integrity&&(r.integrity=e.integrity),e.referrerPolicy&&(r.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?r.credentials="include":e.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function o(e){if(e.ep)return;e.ep=!0;const r=i(e);fetch(e.href,r)}})();const m=`#version 300 es
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
uniform float u_mirrors;     // 6, 8, 12 etc
uniform float u_speed;       // forward flight speed
uniform float u_zoom;        // zoom speed
uniform float u_rot;         // rotation speed
uniform float u_bright;
uniform float u_contrast;
uniform float u_hueShift;
uniform vec3 u_bg1;
uniform vec3 u_bg2;
uniform float u_seed;

// hash for noise
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

// Hexagonal / N-fold kaleidoscope fold
// The technique: take UV, convert to polar, fold angle by N segments with mirror reflection
// Then sample a procedural source at the folded position.
vec2 kaleido(vec2 p, float n) {
  float r = length(p);
  float a = atan(p.y, p.x);
  float seg = 6.2831853 / n;
  a = mod(a + u_time * 0.05, seg);
  // mirror fold
  a = abs(a - seg * 0.5);
  return vec2(cos(a), sin(a)) * r;
}

// Optional rotation for variety
vec2 rot(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c) * p;
}

// Color palette generator
vec3 palette(float t) {
  // Neon rainbow palette: red->orange->yellow->green->cyan->blue->magenta
  vec3 a = vec3(0.5);
  vec3 b = vec3(0.5);
  vec3 c = vec3(1.0);
  vec3 d = vec3(0.0, 0.33, 0.67);
  return a + b * cos(6.2832 * (c * t + d));
}

void main() {
  vec2 uv = (v_uv - 0.5) * 2.0;
  uv.x *= u_resolution.x / u_resolution.y;

  // Continuous zoom + rotation + translation (infinity effect)
  float t = u_time * u_speed;
  vec2 p = uv;
  p = rot(p, t * u_rot);
  // The classic "infinite zoom" technique: scale up exponentially with time
  // and sample a self-similar source at the zoomed-in coords
  float zoom = pow(1.4, t * u_zoom);
  p *= zoom;
  // The zoom + kaleido combo: sample fbm at the folded, zoomed position
  vec2 k = kaleido(p, u_mirrors);

  // Layered FBM for the "particle cluster" look
  vec2 q = k * 1.5 + vec2(u_seed * 7.13, u_seed * 3.91);
  float n = fbm(q);
  float n2 = fbm(q * 3.7 + 13.0);
  float n3 = fbm(q * 7.3 + 27.0);

  // "Particle cluster" effect: bright outlines where fbm has steep gradient
  float grad = abs(fbm(q * 2.0) - n);
  float cluster = 1.0 - smoothstep(0.0, 0.15, grad);
  cluster = pow(cluster, 1.8);

  // Edge detection for sharp hex outlines (the bright outlines in the video)
  float edge = 1.0 - smoothstep(0.0, 0.04, abs(n2 - n3));

  // Combine
  float t_pal = n + u_time * 0.03 + u_hueShift / 6.2832;
  vec3 col = palette(t_pal);

  // Bright neon glow
  float glow = pow(n, 4.0) * 1.5;
  glow += cluster * 0.8;
  glow += edge * 1.2;

  vec3 finalColor = col * glow;

  // Add some warm highlights
  finalColor += vec3(1.0, 0.8, 0.4) * cluster * 0.3;

  // Background gradient
  vec2 bgUV = v_uv;
  float bgT = bgUV.y;
  vec3 bg = mix(u_bg2, u_bg1, bgT);
  bg += col * glow * 0.1; // subtle color in background

  // Composite
  vec3 final = bg + finalColor * u_bright * u_contrast;

  // Vignette
  float vig = smoothstep(1.4, 0.5, length(uv));
  final *= vig;

  fragColor = vec4(final, 1.0);
}
`;class v{constructor(){if(this.canvas=document.getElementById("gl"),this.gl=this.canvas.getContext("webgl2")||this.canvas.getContext("webgl"),this.state={mirrors:6,speed:.6,zoom:.3,rot:.1,bright:.85,contrast:1.4,hueShift:0,bg1:[.04,0,.06],bg2:[.1,0,.12],seed:Math.random()*100,palette:"neon"},this.SYNC_KEY=new URLSearchParams(location.search).get("stream")||"default",this.IS_ADMIN=new URLSearchParams(location.search).has("admin"),this.IS_ADMIN&&document.body.classList.add("admin"),!this.gl){document.body.innerHTML='<div style="color:#f55;padding:20px">WebGL not supported</div>';return}this.init()}hexToRgb(t){return[parseInt(t.slice(1,3),16)/255,parseInt(t.slice(3,5),16)/255,parseInt(t.slice(5,7),16)/255]}init(){const t=this.gl;this.prog=this.createProgram(m,p),this.uTime=t.getUniformLocation(this.prog,"u_time"),this.uRes=t.getUniformLocation(this.prog,"u_resolution"),this.uMirrors=t.getUniformLocation(this.prog,"u_mirrors"),this.uSpeed=t.getUniformLocation(this.prog,"u_speed"),this.uZoom=t.getUniformLocation(this.prog,"u_zoom"),this.uRot=t.getUniformLocation(this.prog,"u_rot"),this.uBright=t.getUniformLocation(this.prog,"u_bright"),this.uContrast=t.getUniformLocation(this.prog,"u_contrast"),this.uHueShift=t.getUniformLocation(this.prog,"u_hueShift"),this.uBg1=t.getUniformLocation(this.prog,"u_bg1"),this.uBg2=t.getUniformLocation(this.prog,"u_bg2"),this.uSeed=t.getUniformLocation(this.prog,"u_seed");const i=t.createBuffer();t.bindBuffer(t.ARRAY_BUFFER,i),t.bufferData(t.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),t.STATIC_DRAW);const o=t.createVertexArray();t.bindVertexArray(o);const e=t.getAttribLocation(this.prog,"a_pos");t.enableVertexAttribArray(e),t.vertexAttribPointer(e,2,t.FLOAT,!1,0,0),this.resize(),window.addEventListener("resize",()=>this.resize())}createProgram(t,i){const o=this.gl,e=this.compileShader(o.VERTEX_SHADER,t),r=this.compileShader(o.FRAGMENT_SHADER,i),n=o.createProgram();if(o.attachShader(n,e),o.attachShader(n,r),o.linkProgram(n),!o.getProgramParameter(n,o.LINK_STATUS)){const s=o.getProgramInfoLog(n);throw document.body.innerHTML=`<pre style="color:#f55;padding:20px">Link failed: ${s}</pre>`,new Error(s)}return n}compileShader(t,i){const o=this.gl,e=o.createShader(t);if(o.shaderSource(e,i),o.compileShader(e),!o.getShaderParameter(e,o.COMPILE_STATUS)){const r=o.getShaderInfoLog(e);throw document.body.innerHTML=`<pre style="color:#f55;padding:20px;font-size:11px">Shader compile failed: ${r}</pre>`,new Error(r)}return e}resize(){const t=Math.min(window.devicePixelRatio||1,2);this.canvas.width=window.innerWidth*t,this.canvas.height=window.innerHeight*t,this.canvas.style.width=window.innerWidth+"px",this.canvas.style.height=window.innerHeight+"px"}render(t){const i=this.gl;i.viewport(0,0,this.canvas.width,this.canvas.height),i.useProgram(this.prog),i.uniform1f(this.uTime,t),i.uniform2f(this.uRes,this.canvas.width,this.canvas.height),i.uniform1f(this.uMirrors,this.state.mirrors),i.uniform1f(this.uSpeed,this.state.speed),i.uniform1f(this.uZoom,this.state.zoom),i.uniform1f(this.uRot,this.state.rot),i.uniform1f(this.uBright,this.state.bright),i.uniform1f(this.uContrast,this.state.contrast),i.uniform1f(this.uHueShift,this.state.hueShift),i.uniform3fv(this.uBg1,this.state.bg1),i.uniform3fv(this.uBg2,this.state.bg2),i.uniform1f(this.uSeed,this.state.seed),i.drawArrays(i.TRIANGLES,0,6)}}const a=new v;function f(c){a.render(c/1e3),requestAnimationFrame(f)}requestAnimationFrame(f);const l={neon:[[1,0,.43],[.98,.23,.05],[1,.75,0],[.4,1,0],[.05,.95,.5]],fire:[[1,0,0],[1,.45,0],[1,.85,0],[1,1,.2],[1,.5,0]],ocean:[[0,.05,.2],[0,.2,.6],[0,.5,.85],[.2,.85,.95],[.5,.95,1]],matrix:[[.1,1,.3],[.2,1,.5],[.4,1,.7],[.6,.95,.3],[0,.8,.2]],purple:[[.4,0,.6],[.6,.1,.8],[.8,.2,1],[.5,0,.9],[.3,.1,.7]]};function d(){const c=document.getElementById("palettes");Object.keys(l).forEach(i=>{const o=document.createElement("button");o.style.background=`linear-gradient(90deg, ${l[i].map(e=>`rgb(${Math.round(e[0]*255)},${Math.round(e[1]*255)},${Math.round(e[2]*255)})`).join(", ")})`,o.title=i,i===a.state.palette&&o.classList.add("active"),o.onclick=()=>{a.state.palette=i,document.querySelectorAll("#palettes button").forEach(s=>s.classList.remove("active")),o.classList.add("active");const[e,r]=l[i];document.getElementById("bg1").value="#"+[e[0]*255,e[1]*255,e[2]*255].map(s=>Math.round(s).toString(16).padStart(2,"0")).join("");const n=l[i][3];document.getElementById("bg2").value="#"+[n[0]*255,n[1]*255,n[2]*255].map(s=>Math.round(s).toString(16).padStart(2,"0")).join(""),a.state.bg1=a.hexToRgb(document.getElementById("bg1").value),a.state.bg2=a.hexToRgb(document.getElementById("bg2").value),u()},c.appendChild(o)});const t=[["mirrors","mirrors","vMirrors",parseInt],["speed","speed","vSpeed",parseFloat],["zoom","zoom","vZoom",parseFloat],["rot","rot","vRot",parseFloat],["bright","bright","vBright",parseFloat],["contrast","contrast","vContrast",parseFloat],["hueShift","hueShift","vHueShift",parseFloat],["bg1","bg1",null,null],["bg2","bg2",null,null]];for(const[i,o,e,r]of t){const n=document.getElementById(i);n&&(n.value=a.state[o],e&&(document.getElementById(e).textContent=String(a.state[o])),n.addEventListener("input",s=>{const h=r?r(s.target.value):s.target.value;a.state[o]=h,e&&(document.getElementById(e).textContent=String(h)),(o==="bg1"||o==="bg2")&&(a.state[o]=a.hexToRgb(s.target.value)),u()}))}document.getElementById("seedBtn").onclick=()=>{a.state.seed=Math.random()*1e3,u()}}async function u(){try{await fetch("/api/state",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:a.SYNC_KEY,state:a.state})})}catch{}}async function g(){try{const c=await fetch(`/api/state?key=${encodeURIComponent(a.SYNC_KEY)}`);if(!c.ok)return;const t=await c.json();t&&t.state&&(Object.assign(a.state,t.state),a.IS_ADMIN&&d())}catch{}}a.IS_ADMIN&&d();g();setInterval(g,2e3);
