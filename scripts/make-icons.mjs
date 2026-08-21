// Generates the PWA icons as real PNGs, no image libraries required.
// A rounded-square amber mark with a checkmark knocked out of it.
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const BG = [11, 13, 16]
const FG = [224, 163, 62]

const dist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function render(size) {
  const s = size / 512
  const radius = 112 * s
  const stroke = 46 * s
  const pts = [
    [148 * s, 262 * s],
    [222 * s, 340 * s],
    [370 * s, 178 * s],
  ]

  // Signed distance to a rounded square inset from the edges.
  const inset = 26 * s
  const half = size / 2 - inset
  const sdRounded = (x, y) => {
    const qx = Math.abs(x - size / 2) - (half - radius)
    const qy = Math.abs(y - size / 2) - (half - radius)
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
  }

  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1)
    raw[row] = 0 // PNG filter type: none
    for (let x = 0; x < size; x++) {
      const cx = x + 0.5
      const cy = y + 0.5

      const plate = Math.max(0, Math.min(1, 0.5 - sdRounded(cx, cy)))
      const check = Math.max(
        0,
        Math.min(
          1,
          stroke / 2 -
            Math.min(
              dist(cx, cy, pts[0][0], pts[0][1], pts[1][0], pts[1][1]),
              dist(cx, cy, pts[1][0], pts[1][1], pts[2][0], pts[2][1]),
            ) +
            0.5,
        ),
      )

      // Amber plate over dark ground, dark checkmark cut back out of the plate.
      const mix = (i) => {
        const base = BG[i] + (FG[i] - BG[i]) * plate
        return Math.round(base + (BG[i] - base) * check)
      }

      const o = row + 1 + x * 4
      raw[o] = mix(0)
      raw[o + 1] = mix(1)
      raw[o + 2] = mix(2)
      raw[o + 3] = 255
    }
  }
  return raw
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(render(size), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const size of [192, 512]) {
  writeFileSync(new URL(`../public/icon-${size}.png`, import.meta.url), png(size))
  console.log(`wrote public/icon-${size}.png`)
}
