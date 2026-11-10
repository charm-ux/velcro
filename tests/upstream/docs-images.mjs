// The two stand-in images the upstream runner serves for Shoelace's animated image test (see docs-images.json for what they
// are and make-docs-images.mjs for how they are generated), and the lookup the runner's middleware uses to serve them.
import { readFileSync } from 'node:fs';

/** The only URL directory the runner serves these from: Shoelace's own test requests `docs/assets/images/<name>`. */
export const DOCS_IMAGE_DIRECTORY = '/docs/assets/images/';
/** The content type served for each file extension; an image whose extension is not here is never served. */
export const CONTENT_TYPES = Object.freeze({ '.gif': 'image/gif', '.webp': 'image/webp' });

const file = JSON.parse(readFileSync(new URL('./docs-images.json', import.meta.url), 'utf8'));
const extension = name => name.slice(name.lastIndexOf('.'));

/** name -> { type, bytes }, from the committed base64 text. */
export const docsImages = Object.freeze(Object.fromEntries(Object.entries(file.images).map(([name, { base64 }]) => (
  [name, Object.freeze({ type: CONTENT_TYPES[extension(name)], bytes: Buffer.from(base64, 'base64') })]
))));

/**
 * The image served at a request path, or undefined. Exact lookup only: the path must be the directory above followed by one
 * file name that is a key of docsImages. There is no decoding, no normalization and no joining with a file system path, so
 * an unknown name, a name with a further segment, a `..` or an encoded one, a different case or an empty name is not served.
 */
export function docsImage(requestPath) {
  if (typeof requestPath !== 'string' || !requestPath.startsWith(DOCS_IMAGE_DIRECTORY)) return undefined;
  const name = requestPath.slice(DOCS_IMAGE_DIRECTORY.length);
  if (!Object.hasOwn(docsImages, name)) return undefined;
  const image = docsImages[name];
  return image.type === undefined ? undefined : image;
}

/** Serves the image for the request's path on a koa-style context and returns true; returns false, touching nothing, when there is none. */
export function serveDocsImage(ctx) {
  const image = docsImage(ctx.path);
  if (!image) return false;
  ctx.type = image.type;
  ctx.body = image.bytes;
  return true;
}
