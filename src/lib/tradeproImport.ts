/**
 * Adaptador dedicado para exportações do TradePRO (tradepro.com.br).
 * Suporta três formatos de exportação:
 *  1. Lojas / Rotas (lojas, promotor, bandeira, endereço, região)
 *  2. Visitas / Fotos (visitas, fotos, URLs de imagem, checagens PDV)
 *  3. Ruptura (loja, SKU/código, motivo, data, observação)
 */

import { Store, SKU, Promoter, Brand, Region } from '@/types'
import { normalizeText, identifyStore } from '@/lib/pptx'
import {
  createStore,
  updateStore,
  createPromoter,
  updatePromoter,
  createBook,
  createBookPhoto,
  updateBook,
} from '@/services/api'
import { batchImportRuptures, RuptureImportRow, RuptureImportResult } from '@/services/scoringApi'

export type TradeProExportType = 'stores_routes' | 'visits_photos' | 'rupture'

export interface TradeProDetectionResult {
  detectedType: TradeProExportType
  confidence: number
  matchedKeywords: string[]
  description: string
}

export interface TradeProColumnField {
  key: string
  label: string
  required: boolean
  description?: string
}

export const TRADEPRO_FIELDS_BY_TYPE: Record<TradeProExportType, TradeProColumnField[]> = {
  stores_routes: [
    { key: 'storeNumber', label: 'Número / Código da Loja', required: true },
    { key: 'storeName', label: 'Nome Fantasia da Loja', required: true },
    { key: 'network', label: 'Rede / Bandeira', required: false },
    { key: 'address', label: 'Endereço / Cidade', required: false },
    { key: 'region', label: 'Região (Sul, Sudeste, etc.)', required: false },
    { key: 'promoterName', label: 'Promotor / Rota', required: false },
    { key: 'promoterPhone', label: 'Telefone do Promotor', required: false },
  ],
  visits_photos: [
    { key: 'storeRef', label: 'Loja (Número ou Nome)', required: true },
    { key: 'visitDate', label: 'Data da Visita', required: true },
    { key: 'photoUrl', label: 'URL / Arquivo da Foto', required: true },
    { key: 'promoterName', label: 'Promotor', required: false },
    { key: 'section', label: 'Seção / Ponto de Contato', required: false },
    { key: 'notes', label: 'Observações / Check', required: false },
  ],
  rupture: [
    { key: 'storeRef', label: 'Loja (número ou nome)', required: true },
    { key: 'skuRef', label: 'SKU / Código do produto', required: true },
    { key: 'motive', label: 'Motivo da ruptura', required: true },
    { key: 'date', label: 'Data do relato', required: true },
    { key: 'observation', label: 'Observação', required: false },
  ],
}

export const TRADEPRO_TYPE_LABELS: Record<TradeProExportType, string> = {
  stores_routes: 'Lojas e Rotas de Promotores',
  visits_photos: 'Visitas e Fotos de PDV',
  rupture: 'Relatório de Ruptura',
}

/**
 * Analisa os cabeçalhos de uma planilha para identificar qual formato TradePRO está sendo importado.
 */
export function detectTradeProExportType(headers: string[]): TradeProDetectionResult {
  const normalized = headers.map((h) => normalizeText(h))
  const joined = normalized.join(' ')

  let storesScore = 0
  const storesMatches: string[] = []
  const storesKeywords = [
    { key: 'rota', weight: 3 },
    { key: 'pdv', weight: 2 },
    { key: 'loja', weight: 2 },
    { key: 'promotor', weight: 3 },
    { key: 'bandeira', weight: 2 },
    { key: 'rede', weight: 2 },
    { key: 'cnpj', weight: 3 },
    { key: 'endereco', weight: 2 },
    { key: 'bairro', weight: 1 },
    { key: 'cidade', weight: 1 },
    { key: 'uf', weight: 1 },
    { key: 'regiao', weight: 2 },
  ]
  for (const item of storesKeywords) {
    if (joined.includes(item.key)) {
      storesScore += item.weight
      storesMatches.push(item.key)
    }
  }

  let photosScore = 0
  const photosMatches: string[] = []
  const photosKeywords = [
    { key: 'foto', weight: 4 },
    { key: 'imagem', weight: 4 },
    { key: 'url', weight: 3 },
    { key: 'visita', weight: 3 },
    { key: 'checkin', weight: 3 },
    { key: 'checkout', weight: 3 },
    { key: 'secao', weight: 2 },
    { key: 'gondola', weight: 2 },
    { key: 'pesquisa', weight: 2 },
    { key: 'auditoria', weight: 2 },
  ]
  for (const item of photosKeywords) {
    if (joined.includes(item.key)) {
      photosScore += item.weight
      photosMatches.push(item.key)
    }
  }

  let ruptureScore = 0
  const ruptureMatches: string[] = []
  const ruptureKeywords = [
    { key: 'ruptura', weight: 5 },
    { key: 'falta', weight: 3 },
    { key: 'motivo', weight: 3 },
    { key: 'zerado', weight: 3 },
    { key: 'sku', weight: 3 },
    { key: 'codigo de barras', weight: 3 },
    { key: 'ean', weight: 3 },
    { key: 'produto', weight: 2 },
    { key: 'dias', weight: 2 },
  ]
  for (const item of ruptureKeywords) {
    if (joined.includes(item.key)) {
      ruptureScore += item.weight
      ruptureMatches.push(item.key)
    }
  }

  // Desempate e decisão
  if (ruptureScore >= photosScore && ruptureScore >= storesScore && ruptureScore > 2) {
    return {
      detectedType: 'rupture',
      confidence: Math.min(1, ruptureScore / 10),
      matchedKeywords: ruptureMatches,
      description:
        'Exportação TradePRO de Ocorrências / Rupturas identificada pelos termos de produto e motivos de falta.',
    }
  }

  if (photosScore >= storesScore && photosScore > 2) {
    return {
      detectedType: 'visits_photos',
      confidence: Math.min(1, photosScore / 10),
      matchedKeywords: photosMatches,
      description:
        'Exportação TradePRO de Visitas e Fotos identificada por colunas de fotos, URLs e registros de visita.',
    }
  }

  // Padrão lojas / rotas
  return {
    detectedType: 'stores_routes',
    confidence: storesScore > 0 ? Math.min(1, storesScore / 10) : 0.5,
    matchedKeywords: storesMatches.length > 0 ? storesMatches : ['loja/pdv'],
    description:
      'Exportação TradePRO de Lojas e Roteiro de Promotores identificada por dados cadastrais de PDV.',
  }
}

/**
 * Mapeia automaticamente as colunas da planilha para o tipo selecionado.
 */
export function autoMapTradeProHeaders(
  type: TradeProExportType,
  headers: string[],
): Record<string, string> {
  const fields = TRADEPRO_FIELDS_BY_TYPE[type]
  const mapping: Record<string, string> = {}
  const lowerHeaders = headers.map((h) => normalizeText(h))

  for (const field of fields) {
    const matchIndex = lowerHeaders.findIndex((h) => {
      switch (field.key) {
        case 'storeNumber':
          return (
            h === 'numero' ||
            h === 'codigo pdv' ||
            h === 'cod pdv' ||
            h === 'cod loja' ||
            h === 'codigo loja' ||
            h.includes('codigo') ||
            h.includes('id pdv')
          )
        case 'storeName':
          return (
            h.includes('nome fantasia') ||
            h.includes('razao social') ||
            h.includes('nome loja') ||
            h.includes('pdv') ||
            h === 'loja' ||
            h === 'nome'
          )
        case 'network':
          return h.includes('rede') || h.includes('bandeira') || h.includes('grupo')
        case 'address':
          return (
            h.includes('endereco') ||
            h.includes('logradouro') ||
            h.includes('cidade') ||
            h.includes('bairro')
          )
        case 'region':
          return h.includes('regiao') || h.includes('uf') || h.includes('estado')
        case 'promoterName':
          return (
            h.includes('promotor') ||
            h.includes('rota') ||
            h.includes('consultor') ||
            h.includes('usuario')
          )
        case 'promoterPhone':
          return (
            h.includes('telefone') ||
            h.includes('celular') ||
            h.includes('whatsapp') ||
            h.includes('contato')
          )
        case 'storeRef':
          return h.includes('loja') || h.includes('pdv') || h.includes('store') || h.includes('cod')
        case 'visitDate':
        case 'date':
          return h.includes('data') || h.includes('date') || h.includes('horario')
        case 'photoUrl':
          return (
            h.includes('foto') ||
            h.includes('imagem') ||
            h.includes('url') ||
            h.includes('anexo') ||
            h.includes('link')
          )
        case 'section':
          return h.includes('secao') || h.includes('categoria') || h.includes('ponto')
        case 'skuRef':
          return (
            h.includes('sku') ||
            h.includes('ean') ||
            h.includes('barras') ||
            h.includes('codigo') ||
            h.includes('produto')
          )
        case 'motive':
          return (
            h.includes('motivo') ||
            h.includes('tipo') ||
            h.includes('ruptura') ||
            h.includes('status')
          )
        case 'notes':
        case 'observation':
          return (
            h.includes('obs') || h.includes('nota') || h.includes('coment') || h.includes('detalhe')
          )
        default:
          return false
      }
    })

    if (matchIndex >= 0) {
      mapping[field.key] = headers[matchIndex]
    }
  }

  return mapping
}

// ============================================================================
// PROCESSADORES POR TIPO DE DADO
// ============================================================================

export interface TradeProImportResult {
  createdCount: number
  updatedCount: number
  ignoredCount: number
  errors: { row: number; reason: string }[]
  details?: Record<string, any>
}

function parseRegion(val: string): Region {
  const norm = normalizeText(val)
  if (norm.includes('sul') && !norm.includes('sudeste')) return 'Sul'
  if (
    norm.includes('sudeste') ||
    norm.includes('sp') ||
    norm.includes('rj') ||
    norm.includes('mg') ||
    norm.includes('es')
  )
    return 'Sudeste'
  if (
    norm.includes('centro') ||
    norm.includes('oeste') ||
    norm.includes('df') ||
    norm.includes('go') ||
    norm.includes('mt')
  )
    return 'Centro-Oeste'
  if (
    norm.includes('nordeste') ||
    norm.includes('ba') ||
    norm.includes('ce') ||
    norm.includes('pe')
  )
    return 'Nordeste'
  if (norm.includes('norte') || norm.includes('am') || norm.includes('pa')) return 'Norte'
  return 'Sudeste'
}

/**
 * 1. Processar exportação de Lojas e Rotas TradePRO
 */
export async function processTradeProStores(
  rows: string[][],
  headers: string[],
  mapping: Record<string, string>,
  existingStores: Store[],
  existingPromoters: Promoter[],
  selectedBrand?: Brand,
): Promise<TradeProImportResult> {
  let createdCount = 0
  let updatedCount = 0
  let ignoredCount = 0
  const errors: { row: number; reason: string }[] = []

  const getColVal = (row: string[], key: string): string => {
    const colHeader = mapping[key]
    if (!colHeader) return ''
    const idx = headers.indexOf(colHeader)
    return idx >= 0 ? (row[idx] || '').trim() : ''
  }

  const storesByNumber = new Map<string, Store>()
  for (const s of existingStores) {
    if (s.number) storesByNumber.set(normalizeText(s.number), s)
  }

  const promoterByName = new Map<string, Promoter>()
  for (const p of existingPromoters) {
    promoterByName.set(normalizeText(p.name), p)
  }

  // Agrupar lojas por promotor durante a importação
  const promoterStoreMap = new Map<string, { phone: string; storeIds: Set<string> }>()

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const rowNum = i + 2
    const numberRaw = getColVal(r, 'storeNumber')
    const nameRaw = getColVal(r, 'storeName')
    const network = getColVal(r, 'network') || 'Geral'
    const address = getColVal(r, 'address') || 'Não informado'
    const regionVal = getColVal(r, 'region')
    const region = parseRegion(regionVal)
    const promoterRaw = getColVal(r, 'promoterName')
    const promoterPhone = getColVal(r, 'promoterPhone')

    if (!numberRaw && !nameRaw) {
      ignoredCount++
      errors.push({ row: rowNum, reason: 'Linha sem número ou nome de loja.' })
      continue
    }

    const number = numberRaw || `TP-${i + 1}`
    const name = nameRaw || `Loja ${number}`
    const normNum = normalizeText(number)

    let storeRecord: Store | null = null

    try {
      if (storesByNumber.has(normNum)) {
        // Atualizar loja existente
        const current = storesByNumber.get(normNum)!
        storeRecord = await updateStore(current.id, {
          name,
          network: network || current.network,
          address: address !== 'Não informado' ? address : current.address,
          region: region || current.region,
        })
        updatedCount++
      } else {
        // Fuzzy check por nome para evitar duplicação acidental
        const fuzzyMatch = identifyStore([name], existingStores)
        if (fuzzyMatch && fuzzyMatch.confidence >= 0.88) {
          storeRecord = await updateStore(fuzzyMatch.store.id, {
            name,
            network: network || fuzzyMatch.store.network,
            address: address !== 'Não informado' ? address : fuzzyMatch.store.address,
          })
          updatedCount++
          storesByNumber.set(normNum, storeRecord)
        } else {
          // Criar nova loja
          storeRecord = await createStore({
            number,
            name,
            network,
            address,
            region,
          })
          createdCount++
          storesByNumber.set(normNum, storeRecord)
        }
      }

      // Se houver promotor vinculado à linha
      if (promoterRaw && storeRecord) {
        const normP = normalizeText(promoterRaw)
        if (!promoterStoreMap.has(normP)) {
          promoterStoreMap.set(normP, { phone: promoterPhone, storeIds: new Set() })
        }
        promoterStoreMap.get(normP)!.storeIds.add(storeRecord.id)
      }
    } catch (err: any) {
      ignoredCount++
      errors.push({ row: rowNum, reason: `Erro ao salvar loja: ${err.message}` })
    }
  }

  // Atualizar/criar promotores e associar lojas
  for (const [normPromoter, info] of promoterStoreMap.entries()) {
    try {
      const existing = promoterByName.get(normPromoter)
      const currentStoreIds = existing?.stores ? new Set(existing.stores) : new Set<string>()
      for (const sid of info.storeIds) currentStoreIds.add(sid)

      const brandIds = existing?.brands ? new Set(existing.brands) : new Set<string>()
      if (selectedBrand) brandIds.add(selectedBrand.id)

      if (existing) {
        await updatePromoter(existing.id, {
          phone: info.phone || existing.phone,
          stores: Array.from(currentStoreIds),
          brands: Array.from(brandIds),
        })
      } else {
        // Encontrar nome capitalizado original
        const origName = normPromoter
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
        await createPromoter({
          name: origName,
          phone: info.phone || '',
          stores: Array.from(currentStoreIds),
          brands: Array.from(brandIds),
        })
      }
    } catch (_) {
      // Falha secundária ao vincular promotor não cancela o import das lojas
    }
  }

  return { createdCount, updatedCount, ignoredCount, errors }
}

/**
 * 2. Processar exportação de Visitas e Fotos TradePRO
 */
export async function processTradeProVisits(
  rows: string[][],
  headers: string[],
  mapping: Record<string, string>,
  selectedBrand: Brand,
  brandStores: Store[],
  analystId: string,
): Promise<TradeProImportResult> {
  let createdCount = 0
  let ignoredCount = 0
  const errors: { row: number; reason: string }[] = []

  const getColVal = (row: string[], key: string): string => {
    const colHeader = mapping[key]
    if (!colHeader) return ''
    const idx = headers.indexOf(colHeader)
    return idx >= 0 ? (row[idx] || '').trim() : ''
  }

  // Agrupar visitas válidas
  const validPhotos: {
    rowNum: number
    storeRef: string
    date: string
    photoUrl: string
    promoter: string
    section: string
    notes: string
  }[] = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const rowNum = i + 2
    const storeRef = getColVal(r, 'storeRef')
    const visitDate = getColVal(r, 'visitDate') || new Date().toISOString().slice(0, 10)
    const photoUrl = getColVal(r, 'photoUrl')
    const promoter = getColVal(r, 'promoterName')
    const section = getColVal(r, 'section')
    const notes = getColVal(r, 'notes')

    if (!photoUrl) {
      ignoredCount++
      errors.push({ row: rowNum, reason: 'Linha sem URL ou referência de foto.' })
      continue
    }

    validPhotos.push({
      rowNum,
      storeRef,
      date: visitDate,
      photoUrl,
      promoter,
      section,
      notes,
    })
  }

  if (validPhotos.length === 0) {
    return {
      createdCount: 0,
      updatedCount: 0,
      ignoredCount,
      errors: errors.length > 0 ? errors : [{ row: 1, reason: 'Nenhuma foto válida encontrada.' }],
    }
  }

  // Criar um book unificado para esta importação de auditoria TradePRO
  const auditDate = validPhotos[0].date.slice(0, 10) || new Date().toISOString().slice(0, 10)
  const bookTitle = `TradePRO — ${selectedBrand.name} — ${auditDate}`

  let bookId: string
  try {
    const newBook = await createBook({
      title: bookTitle,
      brand: selectedBrand.id,
      analyst: analystId,
      file_name: `tradepro_export_${auditDate}.xlsx`,
      file_size: rows.length * 512,
      audit_date: auditDate,
      audit_frequency: 'daily',
      total_slides: validPhotos.length,
      total_photos: validPhotos.length,
      identified_stores: 0,
      pending_review: 0,
      missing_stores: 0,
      status: 'pending_review',
    })
    bookId = newBook.id
  } catch (err: any) {
    throw new Error(`Falha ao criar Book para auditoria TradePRO: ${err.message}`)
  }

  const identifiedStoreIds = new Set<string>()
  let pendingCount = 0
  let identifiedCount = 0

  for (let idx = 0; idx < validPhotos.length; idx++) {
    const item = validPhotos[idx]
    const match = identifyStore([item.storeRef, item.section, item.notes], brandStores)
    const identified = match && match.confidence >= 0.8
    const confidence = match?.confidence || 0

    const photoData = new FormData()
    photoData.append('book', bookId)
    photoData.append('slide_number', String(idx + 1))
    photoData.append('photo_index', '0')
    photoData.append(
      'extracted_text',
      `TradePRO PDV: ${item.storeRef} | Seção: ${item.section || 'Geral'} | Promotor: ${item.promoter || '—'} | Foto: ${item.photoUrl} | Obs: ${item.notes || '—'}`,
    )

    if (identified && match?.store) {
      photoData.append('identified_store', match.store.id)
      photoData.append(
        'identified_store_name',
        `${match.store.name} (${Math.round(confidence * 100)}%)`,
      )
      photoData.append('confidence', String(confidence))
      photoData.append('needs_review', 'false')
      photoData.append('review_status', 'approved')
      identifiedStoreIds.add(match.store.id)
      identifiedCount++
    } else {
      if (match?.store) {
        photoData.append('identified_store', match.store.id)
        photoData.append('identified_store_name', `${match.store.name} (baixa confiança)`)
      }
      photoData.append('confidence', String(confidence))
      photoData.append('needs_review', 'true')
      photoData.append('review_status', 'pending')
      pendingCount++
    }

    try {
      await createBookPhoto(photoData)
      createdCount++
    } catch (err: any) {
      ignoredCount++
      errors.push({ row: item.rowNum, reason: `Falha ao salvar foto do PDV: ${err.message}` })
    }
  }

  // Calcular lojas ausentes na carteira da marca
  const missingStores = brandStores.filter((s) => !identifiedStoreIds.has(s.id))
  await updateBook(bookId, {
    identified_stores: identifiedCount,
    pending_review: pendingCount,
    missing_stores: missingStores.length,
    missing_store_ids: missingStores.map((s) => s.id).join(','),
    status: pendingCount > 0 ? 'pending_review' : 'completed',
  })

  return {
    createdCount,
    updatedCount: 0,
    ignoredCount,
    errors,
    details: {
      bookId,
      bookTitle,
      identifiedCount,
      pendingCount,
      missingStoresCount: missingStores.length,
    },
  }
}

/**
 * 3. Processar exportação de Ruptura TradePRO
 * Reaproveita as regras de negócio de batchImportRuptures
 */
export async function processTradeProRuptures(
  rows: string[][],
  headers: string[],
  mapping: Record<string, string>,
  brandId: string,
  stores: Store[],
  skus: SKU[],
): Promise<RuptureImportResult> {
  const getColVal = (row: string[], key: string): string => {
    const colHeader = mapping[key]
    if (!colHeader) return ''
    const idx = headers.indexOf(colHeader)
    return idx >= 0 ? (row[idx] || '').trim() : ''
  }

  const ruptureRows: RuptureImportRow[] = rows.map((r) => ({
    storeRef: getColVal(r, 'storeRef'),
    skuRef: getColVal(r, 'skuRef'),
    motive: getColVal(r, 'motive'),
    date: getColVal(r, 'date'),
    observation: getColVal(r, 'observation'),
  }))

  return await batchImportRuptures(brandId, ruptureRows, stores, skus)
}
