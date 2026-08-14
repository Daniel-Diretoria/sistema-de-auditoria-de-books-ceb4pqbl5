// Pragmatic visual recognition: perceptual hash (pHash) + color histogram.
// No external AI APIs. Used to compare a SKU reference image against PDV photos
// and decide whether the product is likely present in a given photo.

// ---- pHash (DCT-based perceptual hash) ----

function toGrayscale(data: Uint8ClampedArray, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h)
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    out[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  return out
}

function resizeGrayscale(
  src: Float32Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Float32Array {
  const out = new Float32Array(dstW * dstH)
  const xRatio = srcW / dstW
  const yRatio = srcH / dstH
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      // nearest-neighbor — cheap, good enough for hashing
      const sx = Math.floor(x * xRatio)
      const sy = Math.floor(y * yRatio)
      out[y * dstW + x] = src[sy * srcW + sx] || 0
    }
  }
  return out
}

// 1D DCT-II for a square matrix of size n.
function dct1d(vec: Float32Array, n: number): Float32Array {
  const out = new Float32Array(n)
  const factor = Math.PI / n
  for (let k = 0; k < n; k++) {
    let sum = 0
    const ck = Math.cos(((2 * k + 1) * k * factor) / 2)
    // This is a simplified separable DCT — compute via straightforward nested sum instead below.
    void ck
    for (let i = 0; i < n; i++) {
      sum += vec[i] * Math.cos(((2 * i + 1) * k * factor) / 2)
    }
    out[k] = sum
  }
  return out
}

// 2D DCT using separable row/col passes on an n*n matrix.
function dct2d(matrix: Float32Array, n: number): Float32Array {
  const tmp = new Float32Array(n * n)
  // rows
  for (let r = 0; r < n; r++) {
    const row = matrix.subarray(r * n, r * n + n)
    const d = dct1d(row, n)
    tmp.set(d, r * n)
  }
  // cols
  const out = new Float32Array(n * n)
  const col = new Float32Array(n)
  for (let c = 0; c < n; c++) {
    for (let r = 0; r < n; r++) col[r] = tmp[r * n + c]
    const d = dct1d(col, n)
    for (let r = 0; r < n; r++) out[r * n + c] = d[r]
  }
  return out
}

/**
 * Compute a 64-bit perceptual hash (returned as a hex string).
 * Based on the classic pHash: resize to 32x32 grayscale, 2D DCT, keep the
 * top-left 8x8 low-frequency coefficients (excluding the DC term), threshold
 * by their mean.
 */
export function computePHash(img: HTMLImageElement | HTMLCanvasElement): string {
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, size, size)
  const imgData = ctx.getImageData(0, 0, size, size)
  const gray = toGrayscale(imgData.data, size, size)
  const dct = dct2d(gray, size)

  // top-left 8x8 block, skip DC (index 0)
  const low: number[] = []
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (r === 0 && c === 0) continue
      low.push(dct[r * size + c])
    }
  }
  const mean = low.reduce((a, b) => a + b, 0) / low.length
  let bits = ''
  for (const v of low) bits += v > mean ? '1' : '0'
  // pack into hex
  let hex = ''
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4).padEnd(4, '0'), 2).toString(16)
  }
  return hex
}

// Hamming distance between two hex hashes.
export function hashDistance(a: string, b: string): number {
  const len = Math.min(a.length, b.length)
  let dist = 0
  for (let i = 0; i < len; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16)
    while (x) {
      dist += x & 1
      x >>= 1
    }
  }
  return dist
}

// Normalized similarity from Hamming distance (0..1, higher = more similar).
export function hashSimilarity(a: string, b: string): number {
  const bits = Math.min(a.length, b.length) * 4
  if (bits === 0) return 0
  return 1 - hashDistance(a, b) / bits
}

// ---- Color histogram ----

export interface ColorHistogram {
  r: Float32Array
  g: Float32Array
  b: Float32Array
}

const HIST_BINS = 8

export function computeHistogram(img: HTMLImageElement | HTMLCanvasElement): ColorHistogram {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, size, size)
  const data = ctx.getImageData(0, 0, size, size).data
  const r = new Float32Array(HIST_BINS)
  const g = new Float32Array(HIST_BINS)
  const b = new Float32Array(HIST_BINS)
  const binSize = 256 / HIST_BINS
  let count = 0
  for (let i = 0; i < data.length; i += 4) {
    r[Math.min(HIST_BINS - 1, Math.floor(data[i] / binSize))]++
    g[Math.min(HIST_BINS - 1, Math.floor(data[i + 1] / binSize))]++
    b[Math.min(HIST_BINS - 1, Math.floor(data[i + 2] / binSize))]++
    count++
  }
  // normalize
  for (let i = 0; i < HIST_BINS; i++) {
    r[i] /= count
    g[i] /= count
    b[i] /= count
  }
  return { r, g, b }
}

// Bhattacharyya-like coefficient (0..1, higher = more similar).
export function histogramSimilarity(a: ColorHistogram, b: ColorHistogram): number {
  let sum = 0
  for (let i = 0; i < HIST_BINS; i++) {
    sum += Math.sqrt(a.r[i] * b.r[i]) + Math.sqrt(a.g[i] * b.g[i]) + Math.sqrt(a.b[i] * b.b[i])
  }
  // sum ranges 0..3 (3 channels), normalize to 0..1
  return Math.min(1, sum / 3)
}

// ---- High-level descriptors & comparison ----

export interface ImageDescriptor {
  hash: string
  hist: ColorHistogram
}

export function describeImage(img: HTMLImageElement | HTMLCanvasElement): ImageDescriptor {
  return {
    hash: computePHash(img),
    hist: computeHistogram(img),
  }
}

/**
 * Combined similarity score (0..1) between a SKU reference image descriptor
 * and a PDV photo descriptor. Weighted: pHash contributes 60%, color histogram 40%.
 */
export function compareDescriptors(ref: ImageDescriptor, photo: ImageDescriptor): number {
  const hSim = hashSimilarity(ref.hash, photo.hash)
  const cSim = histogramSimilarity(ref.hist, photo.hist)
  return 0.6 * hSim + 0.4 * cSim
}

// ---- Image loading ----

export function loadImage(src: string, timeoutMs = 12000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const timer = setTimeout(() => {
      reject(new Error('timeout carregando imagem'))
    }, timeoutMs)
    img.onload = () => {
      clearTimeout(timer)
      resolve(img)
    }
    img.onerror = () => {
      clearTimeout(timer)
      reject(new Error('erro ao carregar imagem'))
    }
    img.src = src
  })
}

export async function describeImageUrl(url: string): Promise<ImageDescriptor> {
  const img = await loadImage(url)
  return describeImage(img)
}
