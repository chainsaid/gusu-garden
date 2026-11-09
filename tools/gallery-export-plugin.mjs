// Dev-only endpoint for the asset gallery: the page POSTs the GLB it just
// exported from the current parameters, plus a human-readable spec, and this
// middleware writes both under exports/gallery/. Nothing here runs in a build.
import fs from 'node:fs';
import path from 'node:path';

const MIME = {
  '.glb': 'model/gltf-binary',
  '.md': 'text/markdown; charset=utf-8',
};

function fail(res, code, message) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: message }));
}

function safeName(raw) {
  return String(raw || '').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80);
}

function readBody(req, limit = 200 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default function galleryExportPlugin(outDir) {
  const dir = path.resolve(outDir);
  return {
    name: 'gallery-export',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__gallery/export', async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        const name = safeName(url.searchParams.get('name'));
        if (!name) return fail(res, 400, 'missing name');

        if (req.method === 'GET') {
          if (!/^[A-Za-z0-9._-]+$/.test(name)) return fail(res, 400, 'bad name');
          const file = path.join(dir, name);
          if (!file.startsWith(dir + path.sep) || !fs.existsSync(file)) return fail(res, 404, 'not found');
          res.setHeader('content-type', MIME[path.extname(file)] || 'application/octet-stream');
          res.setHeader('cache-control', 'no-store');
          fs.createReadStream(file).pipe(res);
          return;
        }

        if (req.method === 'POST') {
          const kind = url.searchParams.get('kind') === 'spec' ? 'spec' : 'model';
          const ext = kind === 'spec' ? '.md' : '.glb';
          try {
            const body = await readBody(req);
            fs.mkdirSync(dir, { recursive: true });
            const base = name.replace(/\.(glb|md)$/i, '');
            const file = path.join(dir, base + ext);
            fs.writeFileSync(file, body);
            res.setHeader('content-type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({
              file: `exports/gallery/${base}${ext}`,
              bytes: body.length,
              url: `/__gallery/export?name=${encodeURIComponent(base + ext)}`,
            }));
          } catch (e) {
            fail(res, 500, e.message);
          }
          return;
        }

        next();
      });
    },
  };
}
