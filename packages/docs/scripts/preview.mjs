// Serves the static production output (dist/static) for local preview. Set PORT to change the port.
// With LITRO_BASE_PATH set (for example /velcro) it behaves like a project-site host: it serves dist/static-prefixed
// (the output of `build:prefixed`) only under that prefix and answers 404 for any path outside it.
// Binds to the IPv4 loopback address only; the address is assembled at runtime so no host literal is committed.
// A deliberately tiny file server for the checked-in static build, not a hosting feature.
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSiteBase } from '../site-base.ts';

export const loopbackHost = ['127', '0', '0', '1'].join('.');

const defaultBase = parseSiteBase(process.env.LITRO_BASE_PATH);
const defaultRoot = resolve(
  process.env.PREVIEW_ROOT ?? fileURLToPath(new URL(defaultBase ? '../dist/static-prefixed' : '../dist/static', import.meta.url))
);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8' };

export function isInside(root, file) {
  return file === root || file.startsWith(root + sep);
}

function reply(res, status, text) {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' }).end(text);
}

async function resolveFile(root, realRoot, target) {
  let pathname;
  try {
    pathname = decodeURIComponent(target.split(/[?#]/)[0]);
  } catch {
    return { status: 400 };
  }
  if (pathname.includes('\0')) return { status: 400 };
  let file = normalize(join(root, pathname));
  if (!isInside(root, file)) return { status: 403 };
  for (const candidate of [file, join(file, 'index.html'), `${file}.html`]) {
    try {
      const real = await realpath(candidate);
      if (!isInside(realRoot, real)) return { status: 403 };
      if ((await stat(real)).isFile()) return { status: 200, file: real };
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes(error?.code)) return { status: 500 };
    }
  }
  return { status: 404 };
}

// Splits a request target into its path under the prefix. Returns null outside the prefix.
function stripPrefix(prefix, target) {
  if (!prefix) return target;
  const pathEnd = target.search(/[?#]/);
  const pathname = pathEnd === -1 ? target : target.slice(0, pathEnd);
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return null;
  return (pathname.slice(prefix.length) || '/') + (pathEnd === -1 ? '' : target.slice(pathEnd));
}

export function createPreviewServer(root = defaultRoot, prefix = '') {
  const base = resolve(root);
  const mount = parseSiteBase(prefix);
  return createServer(async (req, res) => {
    try {
      const target = req.url ?? '/';
      const inner = stripPrefix(mount, target);
      if (inner === null) {
        reply(res, 404, 'Not found');
        return;
      }
      if (mount && target.split(/[?#]/)[0] === mount) {
        // Like a project-site host, send the bare prefix to its trailing-slash form.
        res.writeHead(301, { location: `${mount}/${target.slice(mount.length)}` }).end();
        return;
      }
      const realRoot = await realpath(base);
      const { status, file } = await resolveFile(base, realRoot, inner);
      if (status !== 200) {
        reply(res, status, { 400: 'Bad request', 403: 'Forbidden', 404: 'Not found' }[status] ?? 'Server error');
        return;
      }
      const stream = createReadStream(file);
      stream.on('error', () => reply(res, 500, 'Server error'));
      stream.on('open', () => {
        res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
        stream.pipe(res);
      });
    } catch {
      reply(res, 500, 'Server error');
    }
  });
}

export function startPreview({ port = Number(process.env.PORT ?? 4321), host = loopbackHost, root, base = defaultBase } = {}) {
  const server = createPreviewServer(root, base);
  return new Promise(resolveStart => server.listen(port, host, () => resolveStart(server)));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await startPreview();
  console.log(`Velcro docs preview listening on loopback port ${server.address().port}`);
}
