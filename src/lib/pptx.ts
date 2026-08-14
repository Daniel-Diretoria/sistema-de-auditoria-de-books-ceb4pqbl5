import JSZip from 'jszip'
import { Store } from '@/types'

export interface ExtractedPhoto {
  blob: Blob
  dataUrl: string
  mimeType: string
  extension: string
}

export interface ParsedSlide {
  slideNumber: number
  texts: string[]
  notes: string[]
  photos: ExtractedPhoto[]
}

export interface ParsedPptx {
  slides: ParsedSlide[]
  totalSlides: number
  totalPhotos: number
}

/**
 * Carrega e parseia um arquivo .pptx (que é um ZIP contendo XMLs + medias).
 * Extrai textos de cada slide e imagens (ppt/media).
 */
export async function parsePptx(
  file: File,
  onProgress?: (msg: string, pct: number) => void,
): Promise<ParsedPptx> {
  onProgress?.('Lendo arquivo PPTX...', 5)
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)

  // Lista de arquivos de slide ordenados numericamente
  const slideFiles = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/)![1], 10)
      const nb = parseInt(b.match(/slide(\d+)\.xml/)![1], 10)
      return na - nb
    })

  if (slideFiles.length === 0) {
    throw new Error('Nenhum slide encontrado no arquivo PPTX. Verifique se o arquivo é válido.')
  }

  // Notas do orador
  const notesFiles = Object.keys(zip.files).filter((path) =>
    /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(path),
  )

  // Mapa de relacionamentos (rId -> media path) por slide
  const slides: ParsedSlide[] = []
  let totalPhotos = 0

  for (let i = 0; i < slideFiles.length; i++) {
    const slidePath = slideFiles[i]
    const slideNum = parseInt(slidePath.match(/slide(\d+)\.xml/)![1], 10)
    const pct = 10 + Math.round((i / slideFiles.length) * 70)
    onProgress?.(`Extraindo slide ${slideNum} de ${slideFiles.length}...`, pct)

    const xmlContent = await zip.files[slidePath].async('string')

    // Textos: <a:t>...</a:t>
    const texts = extractTextRuns(xmlContent)

    // Notas
    const notes: string[] = []
    const notesPath = `ppt/notesSlides/notesSlide${slideNum}.xml`
    if (zip.files[notesPath]) {
      const notesXml = await zip.files[notesPath].async('string')
      notes.push(...extractTextRuns(notesXml))
    }

    // Imagens: resolver relacionamentos do slide
    const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`
    const imageTargets: string[] = []
    if (zip.files[relsPath]) {
      const relsXml = await zip.files[relsPath].async('string')
      const relRegex = /Type="[^"]*image[^"]*"\s+Target="([^"]+)"/g
      const relRegex2 = /Target="([^"]+)"[^>]*Type="[^"]*image[^"]*"/g
      const seen = new Set<string>()
      let m: RegExpExecArray | null
      while ((m = relRegex.exec(relsXml)) !== null) {
        const target = m[1].replace(/^\.\.\//, 'ppt/')
        if (!seen.has(target)) {
          seen.add(target)
          imageTargets.push(target)
        }
      }
      while ((m = relRegex2.exec(relsXml)) !== null) {
        const target = m[1].replace(/^\.\.\//, 'ppt/')
        if (!seen.has(target)) {
          seen.add(target)
          imageTargets.push(target)
        }
      }
    }

    const photos: ExtractedPhoto[] = []
    for (const target of imageTargets) {
      const normalized = target.startsWith('ppt/') ? target : `ppt/${target}`
      const fileEntry = zip.files[normalized] || zip.files[target]
      if (!fileEntry) continue
      const blob = await fileEntry.async('blob')
      // Detectar mime pela extensão
      const ext = normalized.split('.').pop()?.toLowerCase() || 'png'
      const mimeType =
        ext === 'jpg' || ext === 'jpeg'
          ? 'image/jpeg'
          : ext === 'gif'
            ? 'image/gif'
            : ext === 'webp'
              ? 'image/webp'
              : 'image/png'
      // Filtrar imagens muito pequenas (prováveis ícones decorativos < 3KB)
      if (blob.size < 3000) continue
      const dataUrl = await blobToDataUrl(new Blob([blob], { type: mimeType }))
      photos.push({
        blob: new Blob([blob], { type: mimeType }),
        dataUrl,
        mimeType,
        extension: ext === 'jpeg' ? 'jpg' : ext,
      })
      totalPhotos++
    }

    slides.push({ slideNumber: slideNum, texts, notes, photos })
  }

  onProgress?.('Finalizando extração...', 95)

  return {
    slides,
    totalSlides: slideFiles.length,
    totalPhotos,
  }
}

/** Extrai todos os <a:t>...</a:t> de um XML de slide */
function extractTextRuns(xml: string): string[] {
  const result: string[] = []
  const regex = /<a:t>([\s\S]*?)<\/a:t>/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(xml)) !== null) {
    const text = decodeXmlEntities(m[1]).trim()
    if (text) result.push(text)
  }
  return result
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// ---------- FUZZY MATCHING ----------

/** Normaliza texto para comparação: lowercase, sem acentos, sem pontuação extra */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Distância de Levenshtein */
function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[m][n]
}

/** Similaridade 0..1 baseada em Levenshtein */
function similarity(a: string, b: string): number {
  const na = normalizeText(a)
  const nb = normalizeText(b)
  if (!na && !nb) return 1
  if (!na || !nb) return 0
  const dist = levenshtein(na, nb)
  const maxLen = Math.max(na.length, nb.length)
  return 1 - dist / maxLen
}

/** Verifica se uma string contém outra (substring normalizada) */
function contains(haystack: string, needle: string): boolean {
  const nh = normalizeText(haystack)
  const nn = normalizeText(needle)
  if (!nn) return false
  return nh.includes(nn)
}

export interface MatchResult {
  store: Store
  confidence: number
  matchedText: string
}

/**
 * Tenta identificar a loja de uma foto a partir dos textos extraídos do slide.
 * Compara número, nome e endereço da loja contra os textos.
 */
export function identifyStore(texts: string[], storeWallet: Store[]): MatchResult | null {
  if (storeWallet.length === 0) return null
  const combinedText = texts.join(' \n ')

  let best: MatchResult | null = null

  for (const store of storeWallet) {
    let confidence = 0
    let matchedText = ''

    // 1. Match por número exato da loja (token isolado)
    if (store.number) {
      const numNorm = normalizeText(store.number)
      const tokenRegex = new RegExp(`(^|\\s)${escapeRegex(numNorm)}(\\s|$)`, 'i')
      if (tokenRegex.test(normalizeText(combinedText))) {
        // Número encontrado como token isolado -> alta confiança
        confidence = Math.max(confidence, 0.9)
        matchedText = `número ${store.number}`
      }
    }

    // 2. Match por nome da loja
    if (store.name) {
      if (contains(combinedText, store.name)) {
        const lenScore = Math.min(1, normalizeText(store.name).length / 8)
        confidence = Math.max(confidence, 0.82 + lenScore * 0.13)
        matchedText = `nome "${store.name}"`
      } else {
        const sim = similarity(combinedText, store.name)
        if (sim > 0.6) {
          const c = sim * 0.85
          if (c > confidence) {
            confidence = c
            matchedText = `nome similar "${store.name}" (${Math.round(sim * 100)}%)`
          }
        }
      }
    }

    // 3. Match por endereço
    if (store.address && confidence < 0.8) {
      const addrParts = normalizeText(store.address)
        .split(' ')
        .filter((w) => w.length >= 4)
      if (addrParts.length >= 2) {
        const allPresent = addrParts.every((p) => contains(combinedText, p))
        if (allPresent) {
          confidence = Math.max(confidence, 0.78)
          matchedText = `endereço "${store.address}"`
        }
      }
    }

    if (confidence > (best?.confidence || 0)) {
      best = { store, confidence, matchedText }
    }
  }

  return best
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ---------- FREQUÊNCIA DE AUDITORIA ----------

export function isFrequencyDay(frequency: string, date: Date): boolean {
  const day = date.getDay() // 0=Dom, 1=Seg, ..., 6=Sáb
  switch (frequency) {
    case 'diaria':
    case 'daily':
      return true
    case 'seg_qua_sex':
      return day === 1 || day === 3 || day === 5
    case 'ter_qui_sab':
      return day === 2 || day === 4 || day === 6
    case 'seg_qua_sex_sab':
      return day === 1 || day === 3 || day === 5 || day === 6
    default:
      return true
  }
}
