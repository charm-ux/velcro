// Readers for the structure of the two stand-in image formats (a GIF and an animated WebP): size, number of frames, looping and
// frame durations. They throw on anything that is not the expected structure, so a corrupt or truncated file fails loudly.

/** A GIF's logical screen size, loop count (0 = forever; undefined without the NETSCAPE extension), frames and frame delays (hundredths of a second). */
export function readGif(buffer) {
  if (buffer.toString('latin1', 0, 6) !== 'GIF89a') throw new Error('not a GIF89a');
  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  const packed = buffer[10];
  let at = 13 + (packed & 0x80 ? 3 * 2 ** ((packed & 7) + 1) : 0);
  const skipBlocks = () => {
    while (buffer[at] !== 0) at += buffer[at] + 1;
    at += 1;
  };
  let frames = 0;
  let loops;
  const delays = [];
  while (buffer[at] !== 0x3b) {
    if (at >= buffer.length) throw new Error('GIF without a trailer');
    if (buffer[at] === 0x21) {
      const label = buffer[at + 1];
      if (label === 0xf9) delays.push(buffer.readUInt16LE(at + 4));
      if (label === 0xff && buffer.toString('latin1', at + 3, at + 14) === 'NETSCAPE2.0') loops = buffer.readUInt16LE(at + 16);
      at += 2;
      skipBlocks();
    } else if (buffer[at] === 0x2c) {
      frames += 1;
      const local = buffer[at + 9];
      at += 10 + (local & 0x80 ? 3 * 2 ** ((local & 7) + 1) : 0) + 1;
      skipBlocks();
    } else throw new Error('unexpected GIF block');
  }
  return { width, height, frames, loops, delays };
}

/** An animated WebP's canvas size, animation flag, loop count (0 = forever) and frames as [codec chunk, duration in ms]. */
export function readWebp(buffer) {
  if (buffer.toString('latin1', 0, 4) !== 'RIFF' || buffer.toString('latin1', 8, 12) !== 'WEBP') throw new Error('not a WebP');
  if (buffer.readUInt32LE(4) !== buffer.length - 8) throw new Error('WebP size does not match its RIFF header');
  const out = { width: 0, height: 0, animated: false, loops: undefined, frames: [] };
  for (let at = 12; at < buffer.length;) {
    const id = buffer.toString('latin1', at, at + 4);
    const size = buffer.readUInt32LE(at + 4);
    if (id === 'VP8X') {
      out.animated = (buffer[at + 8] & 0x02) !== 0;
      out.width = buffer.readUIntLE(at + 12, 3) + 1;
      out.height = buffer.readUIntLE(at + 15, 3) + 1;
    }
    if (id === 'ANIM') out.loops = buffer.readUInt16LE(at + 12);
    if (id === 'ANMF') out.frames.push([buffer.toString('latin1', at + 8 + 16, at + 8 + 20), buffer.readUIntLE(at + 8 + 12, 3)]);
    at += 8 + size + (size & 1);
  }
  return out;
}
