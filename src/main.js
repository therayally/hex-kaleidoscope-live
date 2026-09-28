// Hex Kaleidoscope Live - WebGL fragment shader
// Real-time 6-fold mirror fold on procedural noise, animated

const vertexSrc = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = (a_pos + 1.0) * 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const fragmentSrc = `#version 300 es
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
`;

class HexKaleido {
  constructor() {
    this.canvas = document.getElementById('gl');
    this.gl = this.canvas.getContext('webgl2') || this.canvas.getContext('webgl');

    this.state = {
      mirrors: 6,
      speed: 0.6,
      zoom: 0.3,
      rot: 0.1,
      bright: 0.85,
      contrast: 1.4,
      hueShift: 0,
      bg1: [0.04, 0.0, 0.06],
      bg2: [0.10, 0.0, 0.12],
      seed: Math.random() * 100,
      palette: 'neon',
    };

    this.SYNC_KEY = new URLSearchParams(location.search).get('stream') || 'default';
    this.IS_ADMIN = new URLSearchParams(location.search).has('admin');
    if (this.IS_ADMIN) document.body.classList.add('admin');

    if (!this.gl) {
      document.body.innerHTML = '<div style="color:#f55;padding:20px">WebGL not supported</div>';
      return;
    }

    this.init();
  }

  hexToRgb(hex) {
    return [
      parseInt(hex.slice(1, 3), 16) / 255,
      parseInt(hex.slice(3, 5), 16) / 255,
      parseInt(hex.slice(5, 7), 16) / 255,
    ];
  }

  init() {
    const gl = this.gl;
    this.prog = this.createProgram(vertexSrc, fragmentSrc);
    this.uTime = gl.getUniformLocation(this.prog, 'u_time');
    this.uRes = gl.getUniformLocation(this.prog, 'u_resolution');
    this.uMirrors = gl.getUniformLocation(this.prog, 'u_mirrors');
    this.uSpeed = gl.getUniformLocation(this.prog, 'u_speed');
    this.uZoom = gl.getUniformLocation(this.prog, 'u_zoom');
    this.uRot = gl.getUniformLocation(this.prog, 'u_rot');
    this.uBright = gl.getUniformLocation(this.prog, 'u_bright');
    this.uContrast = gl.getUniformLocation(this.prog, 'u_contrast');
    this.uHueShift = gl.getUniformLocation(this.prog, 'u_hueShift');
    this.uBg1 = gl.getUniformLocation(this.prog, 'u_bg1');
    this.uBg2 = gl.getUniformLocation(this.prog, 'u_bg2');
    this.uSeed = gl.getUniformLocation(this.prog, 'u_seed');

    // Fullscreen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1
    ]), gl.STATIC_DRAW);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const aPos = gl.getAttribLocation(this.prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  createProgram(vs, fs) {
    const gl = this.gl;
    const v = this.compileShader(gl.VERTEX_SHADER, vs);
    const f = this.compileShader(gl.FRAGMENT_SHADER, fs);
    const p = gl.createProgram();
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(p);
      document.body.innerHTML = `<pre style="color:#f55;padding:20px">Link failed: ${log}</pre>`;
      throw new Error(log);
    }
    return p;
  }

  compileShader(type, src) {
    const gl = this.gl;
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      document.body.innerHTML = `<pre style="color:#f55;padding:20px;font-size:11px">Shader compile failed: ${log}</pre>`;
      throw new Error(log);
    }
    return s;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
  }

  render(t) {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.prog);
    gl.uniform1f(this.uTime, t);
    gl.uniform2f(this.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uMirrors, this.state.mirrors);
    gl.uniform1f(this.uSpeed, this.state.speed);
    gl.uniform1f(this.uZoom, this.state.zoom);
    gl.uniform1f(this.uRot, this.state.rot);
    gl.uniform1f(this.uBright, this.state.bright);
    gl.uniform1f(this.uContrast, this.state.contrast);
    gl.uniform1f(this.uHueShift, this.state.hueShift);
    gl.uniform3fv(this.uBg1, this.state.bg1);
    gl.uniform3fv(this.uBg2, this.state.bg2);
    gl.uniform1f(this.uSeed, this.state.seed);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}

// Boot
const app = new HexKaleido();

// Render loop
function loop(t) {
  app.render(t / 1000);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ===== Admin UI =====
const PALETTES = {
  neon:    [[1.0, 0.0, 0.43], [0.98, 0.23, 0.05], [1.0, 0.75, 0.0], [0.4, 1.0, 0.0], [0.05, 0.95, 0.5]],
  fire:    [[1.0, 0.0, 0.0], [1.0, 0.45, 0.0], [1.0, 0.85, 0.0], [1.0, 1.0, 0.2], [1.0, 0.5, 0.0]],
  ocean:   [[0.0, 0.05, 0.2], [0.0, 0.2, 0.6], [0.0, 0.5, 0.85], [0.2, 0.85, 0.95], [0.5, 0.95, 1.0]],
  matrix:  [[0.1, 1.0, 0.3], [0.2, 1.0, 0.5], [0.4, 1.0, 0.7], [0.6, 0.95, 0.3], [0.0, 0.8, 0.2]],
  purple:  [[0.4, 0.0, 0.6], [0.6, 0.1, 0.8], [0.8, 0.2, 1.0], [0.5, 0.0, 0.9], [0.3, 0.1, 0.7]],
};

function setupAdmin() {
  const paletteDiv = document.getElementById('palettes');
  Object.keys(PALETTES).forEach(name => {
    const btn = document.createElement('button');
    btn.style.background = `linear-gradient(90deg, ${PALETTES[name].map(c => `rgb(${Math.round(c[0]*255)},${Math.round(c[1]*255)},${Math.round(c[2]*255)})`).join(', ')})`;
    btn.title = name;
    if (name === app.state.palette) btn.classList.add('active');
    btn.onclick = () => {
      app.state.palette = name;
      document.querySelectorAll('#palettes button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Apply first 3 colors as background hint
      const [c1, c2] = PALETTES[name];
      document.getElementById('bg1').value = '#' + [c1[0]*255, c1[1]*255, c1[2]*255].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
      const c3 = PALETTES[name][3];
      document.getElementById('bg2').value = '#' + [c3[0]*255, c3[1]*255, c3[2]*255].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
      app.state.bg1 = app.hexToRgb(document.getElementById('bg1').value);
      app.state.bg2 = app.hexToRgb(document.getElementById('bg2').value);
      pushState();
    };
    paletteDiv.appendChild(btn);
  });

  const bindings = [
    ['mirrors', 'mirrors', 'vMirrors', parseInt],
    ['speed', 'speed', 'vSpeed', parseFloat],
    ['zoom', 'zoom', 'vZoom', parseFloat],
    ['rot', 'rot', 'vRot', parseFloat],
    ['bright', 'bright', 'vBright', parseFloat],
    ['contrast', 'contrast', 'vContrast', parseFloat],
    ['hueShift', 'hueShift', 'vHueShift', parseFloat],
    ['bg1', 'bg1', null, null],
    ['bg2', 'bg2', null, null],
  ];
  for (const [id, key, valId, parser] of bindings) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.value = app.state[key];
    if (valId) document.getElementById(valId).textContent = String(app.state[key]);
    el.addEventListener('input', (e) => {
      const v = parser ? parser(e.target.value) : e.target.value;
      app.state[key] = v;
      if (valId) document.getElementById(valId).textContent = String(v);
      if (key === 'bg1' || key === 'bg2') {
        app.state[key] = app.hexToRgb(e.target.value);
      }
      pushState();
    });
  }

  document.getElementById('seedBtn').onclick = () => {
    app.state.seed = Math.random() * 1000;
    pushState();
  };
}

async function pushState() {
  try {
    await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: app.SYNC_KEY, state: app.state }),
    });
  } catch (e) {}
}

async function pullState() {
  try {
    const r = await fetch(`/api/state?key=${encodeURIComponent(app.SYNC_KEY)}`);
    if (!r.ok) return;
    const data = await r.json();
    if (data && data.state) {
      Object.assign(app.state, data.state);
      if (app.IS_ADMIN) setupAdmin();
    }
  } catch (e) {}
}

if (app.IS_ADMIN) setupAdmin();
pullState();
setInterval(pullState, 2000);
