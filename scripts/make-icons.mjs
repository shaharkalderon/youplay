// Generates the PWA icon set with no image dependencies: we rasterise a play
// glyph into an RGBA buffer and encode it as PNG using node's zlib.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Signed distance from p to the triangle abc; negative inside.
function triangleSdf(px, py, tri) {
  let inside = true
  let best = Infinity
  for (let i = 0; i < 3; i++) {
    const [ax, ay] = tri[i]
    const [bx, by] = tri[(i + 1) % 3]
    const ex = bx - ax
    const ey = by - ay
    const wx = px - ax
    const wy = py - ay
    const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey)))
    const dx = wx - ex * t
    const dy = wy - ey * t
    best = Math.min(best, Math.hypot(dx, dy))
    if (ex * wy - ey * wx > 0) inside = false
  }
  return inside ? -best : best
}

function roundedBoxSdf(px, py, size, radius) {
  const qx = Math.abs(px - size / 2) - (size / 2 - radius)
  const qy = Math.abs(py - size / 2) - (size / 2 - radius)
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
  return outside + Math.min(Math.max(qx, qy), 0) - radius
}

// coverage from a signed distance, antialiased over roughly one pixel
const cover = (d) => Math.max(0, Math.min(1, 0.5 - d))

function draw(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4)
  const radius = maskable ? size / 2 : size * 0.225
  const inset = maskable ? 0 : 0
  const glyphScale = maskable ? 0.62 : 0.8 // maskable art stays in the safe zone

  const s = size * glyphScale
  const off = (size - s) / 2
  const tri = [
    [off + s * 0.36, off + s * 0.26],
    [off + s * 0.36, off + s * 0.74],
    [off + s * 0.74, off + s * 0.5],
  ]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5
      const py = y + 0.5
      const i = (y * size + x) * 4

      const bg = cover(roundedBoxSdf(px, py, size - inset * 2, radius))
      const glyph = cover(triangleSdf(px, py, tri))

      // Dark shell. The glyph is split hard down the middle into YouTube red and
      // Spotify green: interpolating between those two hues in RGB would pass
      // through olive, so we keep it a two-tone mark with one antialiased seam.
      const seam = Math.max(0, Math.min(1, (px - (off + s * 0.55)) / 2 + 0.5))
      const gr = Math.round(255 * (1 - seam) + 29 * seam)
      const gg = Math.round(0 * (1 - seam) + 215 * seam)
      const gb = Math.round(51 * (1 - seam) + 96 * seam)

      const outR = Math.round(15 * (1 - glyph) + gr * glyph)
      const outG = Math.round(15 * (1 - glyph) + gg * glyph)
      const outB = Math.round(17 * (1 - glyph) + gb * glyph)

      rgba[i] = outR
      rgba[i + 1] = outG
      rgba[i + 2] = outB
      rgba[i + 3] = Math.round(255 * bg)
    }
  }
  return encodePng(size, size, rgba)
}

mkdirSync(new URL('../public/icons/', import.meta.url), { recursive: true })
const out = (name, buf) => {
  writeFileSync(new URL(`../public/icons/${name}`, import.meta.url), buf)
  console.log(`wrote public/icons/${name} (${buf.length} bytes)`)
}
out('icon-192.png', draw(192))
out('icon-512.png', draw(512))
out('icon-512-maskable.png', draw(512, { maskable: true }))
