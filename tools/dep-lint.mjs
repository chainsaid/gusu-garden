// Dependency-rule report for the target architecture (docs/TARGET_ARCHITECTURE.md).
//
// usage: node tools/dep-lint.mjs [--strict]
//
// Layers:
//   mechanism = src/core
//   domain    = src/world
//   data      = src/data/**, shared/**
//   app       = src/app/**, tools/**
//   web       = web/**
//
// Rules: mechanism -> mechanism only; domain -> mechanism/domain; data -> data;
// app -> anything; web -> its own files plus shared/data/** only (phase 1, §7.3 B).
//
// Pre-existing web -> domain imports of the vegetation generators are listed in
// KNOWN and reported as debt; they do not fail the gate. Any other violation is
// reported as new.
// Default is report-only (exit 0). --strict exits 1 when new violations exist.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STRICT = process.argv.includes('--strict');

const SCAN = ['src/core', 'src/world', 'src/data', 'shared', 'web/src'];
const EXT = new Set(['.js', '.mjs']);
const IMPORT_RE = /(?:from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;

// web/ 复用离线植被生成器的既有依赖（docs §7.3 方案 B 的存量债）。
const KNOWN = new Set([
  'web/src/scene/backdrop-forest.js|../../../src/world/vegetation-tree.js',
  'web/src/scene/backdrop-forest.js|../../../src/world/vegetation-tex.js',
  'web/src/scene/trees.js|../../../src/world/vegetation-tree.js',
  'web/src/scene/trees.js|../../../src/world/vegetation-core.js',
  'web/src/scene/trees.js|../../../src/world/vegetation-willow.js',
  'web/src/scene/trees.js|../../../src/world/vegetation-tex.js',
  'web/src/scene/vegetation.js|../../../src/world/vegetation-tex.js',
]);

function walk(p, out = []) {
  if (!fs.existsSync(p)) return out;
  const st = fs.statSync(p);
  if (st.isFile()) { if (EXT.has(path.extname(p))) out.push(p); return out; }
  if (/node_modules|dist|dist-web|\.git/.test(p)) return out;
  for (const e of fs.readdirSync(p)) walk(path.join(p, e), out);
  return out;
}

function relOf(abs) {
  return path.relative(ROOT, abs).split(path.sep).join('/');
}

function layerOf(abs) {
  const r = relOf(abs);
  if (r.startsWith('src/core/')) return 'mechanism';
  if (r.startsWith('src/world/')) return 'domain';
  if (r.startsWith('src/data/') || r.startsWith('shared/')) return 'data';
  if (r.startsWith('web/')) return 'web';
  if (r.startsWith('src/app/') || r.startsWith('tools/')) return 'app';
  return 'unknown';
}

function resolveSpec(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  let p = path.resolve(path.dirname(fromFile), spec.split('?')[0]);
  if (!path.extname(p)) { if (fs.existsSync(p + '.js')) p += '.js'; else if (fs.existsSync(path.join(p, 'index.js'))) p = path.join(p, 'index.js'); }
  return p;
}

const ALLOWED = {
  mechanism: new Set(['mechanism']),
  domain: new Set(['mechanism', 'domain']),
  data: new Set(['data']),
  app: new Set(['mechanism', 'domain', 'data', 'app']),
  // web 是独立应用：只允许自己的文件和 shared/data/**（阶段一）。
  web: new Set(['data', 'web']),
};

const rows = [];
for (const entry of SCAN) {
  for (const file of walk(path.join(ROOT, entry))) {
    const fromLayer = layerOf(file);
    const isWeb = relOf(file).startsWith('web/');
    const key = isWeb ? 'web' : fromLayer;
    const src = fs.readFileSync(file, 'utf8');
    const lines = src.split('\n');
    lines.forEach((line, idx) => {
      IMPORT_RE.lastIndex = 0;
      let m;
      while ((m = IMPORT_RE.exec(line))) {
        const spec = m[1] || m[2] || m[3];
        const target = resolveSpec(file, spec);
        if (!target) continue;
        const targetLayer = layerOf(target);
        if (targetLayer === 'unknown') continue;
        const targetRel = relOf(target);
        const allowed = ALLOWED[key];
        const layerOk = allowed && allowed.has(targetLayer);
        const sharedDataOk = key !== 'web' || targetLayer !== 'data' || targetRel.startsWith('shared/data/');
        if (!layerOk || !sharedDataOk) {
          const from = relOf(file);
          rows.push({
            from,
            line: idx + 1,
            spec,
            fromLayer: key,
            toLayer: targetLayer,
            known: KNOWN.has(`${from}|${spec}`),
            text: line.trim().slice(0, 110),
          });
        }
      }
    });
  }
}

const fresh = rows.filter((r) => !r.known);

if (rows.length) {
  console.log(`dep-lint: ${fresh.length} new violation(s), ${rows.length - fresh.length} known\n`);
  for (const r of rows) console.log(`${r.from}:${r.line}  ${r.fromLayer} -> ${r.toLayer}${r.known ? '  [known]' : ''}  ${r.spec}\n    ${r.text}`);
} else {
  console.log('dep-lint: no violations');
}
console.log('\nAllowed matrix (target): mechanism->mechanism; domain->mechanism|domain; data->data; app->all; web->own files|shared/data/**.');

if (STRICT && fresh.length) process.exitCode = 1;
