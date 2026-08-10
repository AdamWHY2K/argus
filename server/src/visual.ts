import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

export type Box = { x: number; y: number; w: number; h: number }

export type VisualDiff = {
  changedPct: number
  changedPixels: number
  width: number
  height: number
  boxes: Box[]
  /** The "after" frame, changed pixels tinted and changed regions boxed. */
  overlay: Buffer
}

const CELL = 16
const MIN_CELLS = 2
const TINT: [number, number, number] = [255, 32, 96]

export function visualDiff(beforePng: Buffer, afterPng: Buffer, threshold = 0.12): VisualDiff {
  const rawA = PNG.sync.read(beforePng)
  const rawB = PNG.sync.read(afterPng)
  const width = Math.max(rawA.width, rawB.width)
  const height = Math.max(rawA.height, rawB.height)
  const a = pad(rawA, width, height)
  const b = pad(rawB, width, height)

  const mask = new PNG({ width, height })
  const changedPixels = pixelmatch(a.data, b.data, mask.data, width, height, {
    threshold,
    includeAA: false,
    diffMask: true,
  })

  const boxes = cluster(mask.data, width, height)
  const overlay = new PNG({ width, height })
  b.data.copy(overlay.data)
  tint(overlay.data, mask.data)
  for (const box of boxes) stroke(overlay.data, width, height, box)

  return {
    changedPct: (changedPixels / Math.max(width * height, 1)) * 100,
    changedPixels,
    width,
    height,
    boxes,
    overlay: PNG.sync.write(overlay),
  }
}

/** Grow a frame onto a white canvas so mismatched page heights still diff. */
function pad(src: PNG, width: number, height: number): PNG {
  if (src.width === width && src.height === height) return src
  const out = new PNG({ width, height })
  out.data.fill(255)
  for (let y = 0; y < src.height; y++) {
    const from = y * src.width * 4
    src.data.copy(out.data, y * width * 4, from, from + src.width * 4)
  }
  return out
}

function tint(data: Buffer, mask: Buffer) {
  for (let i = 0; i < mask.length; i += 4) {
    if (mask[i + 3] === 0) continue
    data[i] = Math.round(data[i] * 0.35 + TINT[0] * 0.65)
    data[i + 1] = Math.round(data[i + 1] * 0.35 + TINT[1] * 0.65)
    data[i + 2] = Math.round(data[i + 2] * 0.35 + TINT[2] * 0.65)
  }
}

/**
 * Group changed pixels into regions on a coarse grid, then keep each connected
 * component's bounding box. Cheaper than per-pixel components and the boxes
 * land where a human would draw them.
 */
function cluster(mask: Buffer, width: number, height: number): Box[] {
  const cols = Math.ceil(width / CELL)
  const rows = Math.ceil(height / CELL)
  const hit = new Uint8Array(cols * rows)

  for (let y = 0; y < height; y++) {
    const row = Math.floor(y / CELL) * cols
    for (let x = 0; x < width; x++) {
      if (mask[(y * width + x) * 4 + 3] === 0) continue
      hit[row + Math.floor(x / CELL)] = 1
    }
  }

  const seen = new Uint8Array(cols * rows)
  const boxes: Box[] = []
  const stack: number[] = []

  for (let start = 0; start < hit.length; start++) {
    if (!hit[start] || seen[start]) continue
    stack.length = 0
    stack.push(start)
    seen[start] = 1
    let minC = cols
    let maxC = 0
    let minR = rows
    let maxR = 0
    let count = 0

    while (stack.length) {
      const idx = stack.pop()!
      const c = idx % cols
      const r = (idx - c) / cols
      count++
      if (c < minC) minC = c
      if (c > maxC) maxC = c
      if (r < minR) minR = r
      if (r > maxR) maxR = r

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nc = c + dc
          const nr = r + dr
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue
          const n = nr * cols + nc
          if (!hit[n] || seen[n]) continue
          seen[n] = 1
          stack.push(n)
        }
      }
    }

    if (count < MIN_CELLS) continue
    boxes.push({
      x: minC * CELL,
      y: minR * CELL,
      w: Math.min(width, (maxC + 1) * CELL) - minC * CELL,
      h: Math.min(height, (maxR + 1) * CELL) - minR * CELL,
    })
  }

  return boxes.sort((p, q) => q.w * q.h - p.w * p.h).slice(0, 60)
}

function stroke(data: Buffer, width: number, height: number, box: Box, weight = 2) {
  const put = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const i = (y * width + x) * 4
    data[i] = TINT[0]
    data[i + 1] = TINT[1]
    data[i + 2] = TINT[2]
    data[i + 3] = 255
  }
  for (let t = 0; t < weight; t++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      put(x, box.y + t)
      put(x, box.y + box.h - 1 - t)
    }
    for (let y = box.y; y < box.y + box.h; y++) {
      put(box.x + t, y)
      put(box.x + box.w - 1 - t, y)
    }
  }
}
