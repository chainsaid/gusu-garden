// Golden-frame baseline capture & verification.
//
// usage:
//   node tools/golden.mjs capture [tag] [--only S1,S2,S3,S4] [--film]
//   node tools/golden.mjs verify  [tag] [--only S1,S2,S3,S4]
//
// Writes out/golden/<tag>/<set>/*.png and manifest.json (HEAD, three version, hashes).
// `verify` re-captures into out/golden/<tag>_verify and compares SHA-256; mismatches
// fall back to ffmpeg PSNR/SSIM. Needs `npm run dev` (port 5173) and ffmpeg.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TAG_DEFAULT = 'baseline';
const SHOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const TIMES = [0, 3.5, 6.9];

const SETS = {
  S1: {
    note: 'preview, 960x540, spp=4, 10 shots x 3 times',
    base: 'w=960&h=540&spp=4&q=preview&smap=1024',
    views: SHOTS.flatMap((s) => TIMES.map((t) => ({ q: `shot=${s}&t=${t}`, name: `s${s}_t${String(t).replace('.', '')}.png` }))),
  },
  S2: {
    note: 'final, 1280x720, spp=1, smap=4096, 10 shots at t=3.5',
    base: 'w=1280&h=720&spp=1&q=final&smap=4096',
    views: SHOTS.map((s) => ({ q: `shot=${s}&t=3.5`, name: `s${s}_t35.png` })),
  },
  S3: {
    note: 'realtime detail=0.5, 960x540, 10 shots at t=3.5',
    base: 'w=960&h=540&spp=1&q=realtime&detail=0.5&smap=1024',
    views: SHOTS.map((s) => ({ q: `shot=${s}&t=3.5`, name: `s${s}_t35.png` })),
  },
  S4: {
    note: 'sun override ?sunelev=30&sunaz=180, shot 0 @3.5s',
    base: 'w=960&h=540&spp=4&q=preview&smap=1024&shot=0&t=3.5&sunelev=30&sunaz=180',
    views: [{ q: '', name: 's0_t35_sun30az180.png' }],
  },
};

const argv = process.argv.slice(2);
const cmd = argv[0];
let tag = TAG_DEFAULT;
let only = Object.keys(SETS);
let withFilm = false;
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--only')) {
    only = String(argv[++i] || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  } else if (a === '--film') withFilm = true;
  else if (!a.startsWith('--')) tag = a;
}
if (!cmd || !['capture', 'verify'].includes(cmd)) {
  console.error('usage: node tools/golden.mjs capture|verify [tag] [--only S1,S2] [--film]');
  process.exit(1);
}
const dirFor = (t) => path.join(ROOT, 'out', 'golden', t);
const rel = (p) => path.relative(ROOT, p);

function head() {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : '';
}

function threeVersion() {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/three/package.json'), 'utf8')).version; }
  catch { return 'unknown'; }
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function runSet(setName, targetDir) {
  const set = SETS[setName];
  const dir = path.join(targetDir, setName);
  fs.mkdirSync(dir, { recursive: true });
  const args = ['tools/snap.mjs', set.base];
  for (const v of set.views) {
    if (v.q) args.push('--view', v.q, path.join(dir, v.name));
    else args.push(path.join(dir, v.name));
  }
  console.log(`[golden] ${setName}: ${set.views.length} views — ${set.note}`);
  const r = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit', timeout: 1800 * 1000 });
  if (r.status !== 0) throw new Error(`${setName} capture failed (status ${r.status})`);
  return set.views.map((v) => path.join(dir, v.name));
}

function ffmpegMetric(kind, a, b) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', a, '-i', b, '-lavfi', kind, '-f', 'null', '-'], { encoding: 'utf8' });
  const text = (r.stderr || '') + (r.stdout || '');
  if (kind === 'psnr') {
    const m = text.match(/average:([0-9.]+|inf)/);
    return m ? m[1] : 'n/a';
  }
  const m = text.match(/All:([0-9.]+)/);
  return m ? m[1] : 'n/a';
}

function capture() {
  const targetDir = dirFor(tag);
  fs.mkdirSync(targetDir, { recursive: true });
  const files = [];
  for (const name of only) {
    if (!SETS[name]) throw new Error(`unknown set ${name}`);
    files.push(...runSet(name, targetDir));
  }
  const manifest = {
    tag,
    capturedAt: new Date().toISOString(),
    head: head(),
    three: threeVersion(),
    machine: `${process.platform}/${process.arch} ${os.cpus()[0]?.model || ''}`,
    sets: {},
    files: {},
  };
  for (const name of only) manifest.sets[name] = SETS[name].note;
  for (const f of files) manifest.files[rel(f)] = sha256(f);
  fs.writeFileSync(path.join(targetDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`[golden] manifest: ${rel(path.join(targetDir, 'manifest.json'))}`);

  if (withFilm) {
    console.log('[golden] capturing F2 film (960x540, spp=2, full 70 s)…');
    const out = path.join(targetDir, 'film.mp4');
    const r = spawnSync(process.execPath, ['tools/render.mjs', '--w', '960', '--h', '540', '--fps', '60', '--spp', '2', '--out', rel(out)], {
      cwd: ROOT, stdio: 'inherit', timeout: 3600 * 1000,
    });
    if (r.status !== 0) throw new Error('film capture failed');
    const metrics = {};
    for (const [name, tool, extra] of [
      ['lumaflicker', 'tools/lumaflicker.mjs', []],
      ['flickercheck', 'tools/flickercheck.mjs', ['0', '70']],
      ['mcflicker_s0', 'tools/mcflicker.mjs', ['0', '7']],
    ]) {
      const mr = spawnSync(process.execPath, [tool, rel(out), ...extra], { cwd: ROOT, encoding: 'utf8', timeout: 1200 * 1000 });
      const txt = (mr.stdout || '') + (mr.stderr || '');
      fs.writeFileSync(path.join(targetDir, `${name}.txt`), txt);
      metrics[name] = txt.trim().split('\n').slice(-3).join(' | ');
      console.log(`[golden] ${name}: ${metrics[name]}`);
    }
    manifest.film = { file: rel(out), metrics };
    fs.writeFileSync(path.join(targetDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  }
  return targetDir;
}

function verify() {
  const baseDir = dirFor(tag);
  const baselineManifestPath = path.join(baseDir, 'manifest.json');
  if (!fs.existsSync(baselineManifestPath)) throw new Error(`baseline manifest missing: ${rel(baselineManifestPath)}`);
  const baseline = JSON.parse(fs.readFileSync(baselineManifestPath, 'utf8'));
  const verifyTag = `${tag}_verify`;
  const verifyDir = dirFor(verifyTag);
  fs.rmSync(verifyDir, { recursive: true, force: true });
  fs.mkdirSync(verifyDir, { recursive: true });

  const mismatches = [];
  let compared = 0;
  for (const name of only) {
    if (!baseline.sets[name]) continue;
    for (const f of runSet(name, verifyDir)) {
      const key = rel(f).replace(`golden/${verifyTag}/`, 'golden/' + tag + '/');
      const expected = baseline.files[key];
      if (!expected) { mismatches.push({ file: key, reason: 'missing in baseline' }); continue; }
      const actual = sha256(f);
      compared++;
      if (actual !== expected) {
        const a = path.join(ROOT, key);
        const b = f;
        mismatches.push({
          file: key,
          psnr: fs.existsSync(a) ? ffmpegMetric('psnr', a, b) : 'n/a',
          ssim: fs.existsSync(a) ? ffmpegMetric('ssim', a, b) : 'n/a',
        });
      }
    }
  }

  const report = [
    `golden verify: ${tag}`,
    `head: ${head()}  baseline head: ${baseline.head}`,
    `compared: ${compared}`,
    `mismatches: ${mismatches.length}`,
    ...mismatches.map((m) => `  ${m.file}${m.psnr ? `  psnr=${m.psnr} ssim=${m.ssim}` : ''}${m.reason ? `  (${m.reason})` : ''}`),
  ].join('\n') + '\n';
  fs.writeFileSync(path.join(verifyDir, 'report.txt'), report);
  console.log(report);
  if (mismatches.length) {
    console.log(`[golden] FAIL — ${mismatches.length} mismatched frame(s); report: ${rel(path.join(verifyDir, 'report.txt'))}`);
    process.exitCode = 1;
  } else {
    console.log('[golden] PASS — all frames byte-identical');
  }
}

try {
  if (cmd === 'capture') capture();
  else verify();
} catch (e) {
  console.error('[golden] FAILED:', e.message);
  process.exitCode = 1;
}
