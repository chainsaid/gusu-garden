// ---------------------------------------------------------------------------
// sky.js — 姑苏园林物理大气散射与程序化夕阳云霞系统
// 移植自电影级母本 (Nishita 物理单散射 Rayleigh/Mie/Ozone + 晨暮高积云 Altocumulus + 边缘变暗太阳光球)
// ---------------------------------------------------------------------------
import * as THREE from 'three';

const NOISE_GLSL = /* glsl */ `
#ifndef N_NOISE_LIB
#define N_NOISE_LIB
float n_hash11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float n_hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float n_hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec2 n_hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }

// Simplex 2D (Ashima / Stefan Gustavson)
vec3 n_permute(vec3 x){ return mod(((x * 34.0) + 1.0) * x, 289.0); }
float n_snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy)); vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod(i, 289.0);
  vec3 p = n_permute(n_permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0); m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float n_fbm(vec2 p, int oct){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 8; i++){
    if (i >= oct) break;
    s += a * n_snoise(p);
    p = p * 2.03 + vec2(17.1, 9.7);
    a *= 0.5;
  }
  return s;
}

vec2 n_worley(vec2 p){
  vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec2 g = vec2(float(x), float(y)); vec2 o = n_hash22(i + g); vec2 r = g + o - f; float d = dot(r, r);
    if (d < d1){ d2 = d1; d1 = d; } else if (d < d2){ d2 = d; }
  }
  return sqrt(vec2(d1, d2));
}
#endif
`;

const SKY_GLSL = /* glsl */ `
${NOISE_GLSL}
const float Re = 6360e3;
const float Ra = 6420e3;
const vec3 bR = vec3(5.802e-6, 13.558e-6, 33.1e-6);
const vec3 bO = vec3(0.650e-6, 1.881e-6, 0.085e-6);
const float bM = 11e-6;
const float Hr = 7994.0;
const float Hm = 1200.0;
const float gM = 0.78;

vec2 raySphere(vec3 ro, vec3 rd, float r){
  float b = dot(ro, rd); float c = dot(ro, ro) - r * r; float d = b * b - c;
  if (d < 0.0) return vec2(-1.0); d = sqrt(d); return vec2(-b - d, -b + d);
}

vec3 sunTransmittance(vec3 p, vec3 sun){
  vec2 t = raySphere(p, sun, Ra);
  float L = max(t.y, 0.0);
  float odR = 0.0, odM = 0.0;
  const int NL = 8;
  for (int j = 0; j < NL; j++){
    float s = (float(j) + 0.5) / float(NL);
    float tt = L * s * s; float dt = L * 2.0 * s / float(NL);
    float h = length(p + sun * tt) - Re;
    if (h < -50.0) return vec3(0.0);
    h = max(h, 0.0);
    odR += exp(-h / Hr) * dt; odM += exp(-h / Hm) * dt;
  }
  return exp(-(bR * odR + bO * odR * 2.0 + bM * 1.1 * odM));
}

vec3 atmosphere(vec3 dir, vec3 sun, float sunI, out vec3 transmit){
  vec3 ro = vec3(0.0, Re + 60.0, 0.0);
  vec2 t = raySphere(ro, dir, Ra);
  float L = t.y;
  vec2 tg = raySphere(ro, dir, Re);
  if (tg.x > 0.0) L = tg.x;
  const int N = 16;
  vec3 sumR = vec3(0.0), sumM = vec3(0.0);
  float odR = 0.0, odM = 0.0;
  for (int i = 0; i < N; i++){
    float s = (float(i) + 0.5) / float(N);
    float tt = L * s * s; float dt = L * 2.0 * s / float(N);
    vec3 p = ro + dir * tt;
    float h = max(length(p) - Re, 0.0);
    float hr = exp(-h / Hr) * dt; float hm = exp(-h / Hm) * dt;
    odR += hr; odM += hm;
    vec3 tl = sunTransmittance(p, sun);
    vec3 tv = exp(-(bR * odR + bO * odR * 2.0 + bM * 1.1 * odM));
    vec3 att = tl * tv;
    sumR += att * hr; sumM += att * hm;
  }
  transmit = exp(-(bR * odR + bO * odR * 2.0 + bM * 1.1 * odM));
  float mu = dot(dir, sun);
  float pR = 3.0 / (16.0 * 3.14159265) * (1.0 + mu * mu);
  float g2 = gM * gM;
  float pM = 3.0 / (8.0 * 3.14159265) * ((1.0 - g2) * (1.0 + mu * mu)) / ((2.0 + g2) * pow(1.0 + g2 - 2.0 * gM * mu, 1.5));
  return sunI * (sumR * bR * pR + sumM * bM * pM);
}

uniform float uCloudCover;
uniform float uCloudOpacity;
uniform float uCloudScale;
uniform vec2 uCloudOffset;

float cloudDensity(vec2 p){
  vec2 q = p * uCloudScale;
  float cov = n_fbm(q * vec2(0.16, 0.28) + 2.0, 4) * 0.5 + 0.5;
  cov = smoothstep(1.0 - uCloudCover - 0.12, 1.0 - uCloudCover + 0.28, cov);
  vec2 w = vec2(n_snoise(q * 0.8 + 5.2), n_snoise(q * 0.8 + 1.3)) * 0.22;
  vec2 c1 = n_worley(q * 2.4 + w * 2.0);
  float puff = 1.0 - c1.x * 1.2;
  vec2 c2 = n_worley(q * 6.3 + w * 5.0 + 9.0);
  puff = puff * 0.72 + (1.0 - c2.x) * 0.38;
  float detail = n_fbm(q * 11.0 + w * 4.0, 2) * 0.12;
  float d = cov * (puff + detail) - 0.36;
  return clamp(d * 2.6, 0.0, 1.0);
}

vec3 skyColor(vec3 dir, vec3 sun, float sunI, float disc){
  vec3 d = dir;
  float below = smoothstep(0.0, -0.08, d.y);
  d.y = max(d.y, 0.0005);
  d = normalize(d);
  vec3 tr;
  vec3 col = atmosphere(d, sun, sunI, tr);
  vec3 sunCol = sunTransmittance(vec3(0.0, Re + 60.0, 0.0), sun);

  // 太阳光球与边缘变暗 (Limb darkening)
  float cosA = dot(d, sun);
  float ang = acos(clamp(cosA, -1.0, 1.0));
  float R = 0.0095;
  if (disc > 0.0) {
    float m = 1.0 - smoothstep(R * 0.92, R, ang);
    float r = clamp(ang / R, 0.0, 1.0);
    float limb = 1.0 - 0.6 * (1.0 - sqrt(max(1.0 - r * r, 0.0)));
    // Web 渲染端太阳光球强度适度收敛，避免无 Karis 加权下过曝死白
    col += sunCol * m * limb * sunI * 80.0 * disc;
    col += sunCol * sunI * 0.45 * exp(-ang * 45.0) * disc;
  }

  // 夕阳金色高积云 (Altocumulus)
  if (dir.y > 0.003) {
    float Hc = 2600.0;
    float tc = Hc / d.y;
    vec2 cp = (d.xz * tc) / 1000.0 + uCloudOffset;
    float den = cloudDensity(cp);
    if (den > 0.001) {
      vec2 sd = normalize(sun.xz + 1e-5);
      float od = cloudDensity(cp + sd * 0.06) * 0.6 + cloudDensity(cp + sd * 0.16) * 1.0
               + cloudDensity(cp + sd * 0.34) * 1.0 + cloudDensity(cp + sd * 0.65) * 0.8;
      float shadow = exp(-od * 1.15);
      vec3 sunAtCloud = sunTransmittance(vec3(0.0, Re + Hc, 0.0), sun) * vec3(1.0, 0.84, 0.64);
      float mu = dot(d, sun);
      float g1 = 0.65, g2 = -0.2;
      float hg1 = (1.0 - g1*g1) / pow(1.0 + g1*g1 - 2.0*g1*mu, 1.5);
      float hg2 = (1.0 - g2*g2) / pow(1.0 + g2*g2 - 2.0*g2*mu, 1.5);
      float phase = mix(hg2, hg1, 0.5) / 12.566;
      float powder = 1.0 - exp(-den * 3.0);
      vec3 lit = sunAtCloud * sunI * 0.16 * (phase * 7.0 + 0.3) * (shadow * 0.9 + 0.1) * (0.4 + 0.6 * powder);
      lit += sunAtCloud * sunI * 0.1 * pow(max(mu, 0.0), 10.0) * (1.0 - den) * 3.0;
      vec3 trz;
      vec3 zen = atmosphere(vec3(0.0, 1.0, 0.0), sun, sunI, trz);
      vec3 amb = zen * 0.95 + col * 0.2;
      vec3 ccol = lit + amb * (0.35 + 0.5 * (1.0 - den));
      float alpha = smoothstep(0.0, 0.55, den) * uCloudOpacity;
      float fade = exp(-tc / 52000.0);
      alpha *= smoothstep(0.003, 0.06, d.y);
      ccol = mix(col, ccol, fade);
      col = mix(col, ccol, alpha);
    }
  }

  // 地平线下与远山微暖灰晕染
  col = mix(col, col * 0.55 + vec3(0.12, 0.11, 0.10), below);
  return col;
}
`;

export function createProceduralSky(sunPosition) {
  const geo = new THREE.SphereGeometry(4500, 48, 24);
  const uniforms = {
    uSunDir: { value: sunPosition ? sunPosition.clone().normalize() : new THREE.Vector3(-0.932, 0.118, 0.337).normalize() },
    uSunI: { value: 18.0 },
    uSunDisc: { value: 1.0 },
    uCloudCover: { value: 0.50 },
    uCloudOpacity: { value: 1.0 },
    uCloudScale: { value: 1.0 },
    uCloudOffset: { value: new THREE.Vector2(0.15, 0.08) },
    uSkyTint: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * p;
        gl_Position.z = gl_Position.w * 0.99999;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      uniform float uSunI;
      uniform float uSunDisc;
      uniform vec3 uSkyTint;
      varying vec3 vDir;
      ${SKY_GLSL}
      void main(){
        vec3 d = normalize(vDir);
        vec3 c = skyColor(d, normalize(uSunDir), uSunI, uSunDisc) * uSkyTint;
        gl_FragColor = vec4(c, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'jiangnan_procedural_sky';
  mesh.frustumCulled = false;
  mesh.renderOrder = 1000;
  mesh.onBeforeRender = (r, s, cam) => {
    mesh.position.copy(cam.position);
    mesh.updateMatrixWorld();
  };

  return mesh;
}
