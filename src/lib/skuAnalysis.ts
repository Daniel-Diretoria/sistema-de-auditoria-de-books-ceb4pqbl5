// SKU analysis engine — Etapa 1 do Programa de Automação de Auditoria.
// Avalia presença de produto, cobertura fotográfica, preço, rupturas,
// agenda de visita e matriz de sortimento em DIMENSÕES SEPARADAS.
//
// Regras obrigatórias:
// 1. "Não identificado na foto" NUNCA pode ser interpretado como "ausente da loja".
//    Gera "nao_identificado" ou "evidencia_insuficiente", NUNCA "ausente_cobrar".
// 2. Imagens indisponíveis, SKU sem foto de referência ou erros geram "nao_verificado".
// 3. Ausência de fotos não é escusada somente por relato de ruptura.
// 4. Ruptura antiga não justifica automaticamente visita atual (guarda explícita de data).
// 5. Ruptura declarada da marca (TradePRO): não é prova visual de falta de SKU individual.
// 6. Produto visível em fotos + ruptura declarada gera flag de DISCREPÂNCIA.
// 7. Matriz de sortimento: apenas SKUs obrigatórios/opcionais vigentes são esperados.
//    SKUs "não trabalhado" não geram falta nem penalidade.

import pb from '@/lib/pocketbase/client'
import {
  Book,
  BookPhoto,
  Brand,
  Store,
  SKU,
  RuptureReport,
  SkuCategory,
  ConfidenceLevel,
  PresenceDimension,
  CoverageDimension,
  PriceDimension,
  RuptureDimension,
  VisitDimension,
  AssortmentStatus,
  AssortmentMatrixItem,
  VisitSchedule,
} from '@/types'
import { ImageDescriptor, describeImageUrl, compareDescriptors } from '@/lib/imageCompare'
import { getFileUrl } from '@/services/api'

export interface AnalysisProgress {
  message: string
  pct: number
}

const PRESENCE_THRESHOLD = 0.55 // acima => alta confiança de presença
const REVIEW_THRESHOLD = 0.38 // acima => evidência parcial/insuficiente, precisa validação humana
const RUPTURE_OLD_DAYS = 15

export interface AnalysisResult {
  created: number
  updated: number
  byCategory: Record<SkuCategory, number>
}

/**
 * Consulta a Matriz de Sortimento Esperado para determinar o status do SKU na loja.
 * Prioridade:
 *  1. Regra específica para a loja (`store == store.id && sku == sku.id`)
 *  2. Regra por rede (`network == store.network && sku == sku.id && !store`)
 *  3. Default geral da marca se cadastrado
 *  4. Se não houver registro na matriz, assume 'obrigatorio' como compatibilidade padrão
 */
function resolveAssortmentStatus(
  skuId: string,
  store: Store,
  matrixItems: AssortmentMatrixItem[],
  auditDate?: string,
): { status: AssortmentStatus; isCarried: boolean; ruleNotes?: string } {
  const d = auditDate ? auditDate.slice(0, 10) : undefined

  // Filtrar apenas regras vigentes para a data
  const validItems = matrixItems.filter((item) => {
    if (item.sku !== skuId) return false
    if (d && item.start_date && d < item.start_date.slice(0, 10)) return false
    if (d && item.end_date && d > item.end_date.slice(0, 10)) return false
    return true
  })

  // 1. Exceção específica de loja
  const storeRule = validItems.find((it) => it.store === store.id)
  if (storeRule) {
    return {
      status: storeRule.status,
      isCarried: storeRule.status !== 'nao_trabalhado',
      ruleNotes: storeRule.notes ? `Regra da loja: ${storeRule.notes}` : undefined,
    }
  }

  // 2. Regra por rede
  if (store.network) {
    const networkRule = validItems.find(
      (it) => it.network && it.network.trim().toLowerCase() === store.network.trim().toLowerCase(),
    )
    if (networkRule) {
      return {
        status: networkRule.status,
        isCarried: networkRule.status !== 'nao_trabalhado',
        ruleNotes: networkRule.notes ? `Regra da rede: ${networkRule.notes}` : undefined,
      }
    }
  }

  // 3. Regra geral para a marca (sem loja e sem rede)
  const brandDefault = validItems.find((it) => !it.store && !it.network)
  if (brandDefault) {
    return {
      status: brandDefault.status,
      isCarried: brandDefault.status !== 'nao_trabalhado',
      ruleNotes: brandDefault.notes,
    }
  }

  // Se não há regra na matriz para este SKU nesta loja/rede, consideramos obrigatório
  return { status: 'obrigatorio', isCarried: true }
}

/**
 * Executa a análise corrigida do Book para todas as lojas da carteira da marca.
 */
export async function runBookAnalysis(
  bookId: string,
  onProgress?: (p: AnalysisProgress) => void,
): Promise<AnalysisResult> {
  onProgress?.({ message: 'Carregando dados do book...', pct: 2 })

  // 1. Carregar Book + Marca + Carteira de Lojas + SKUs + Fotos + Rupturas + Matriz + Agenda
  const book = await pb.collection('books').getOne<Book>(bookId, { expand: 'brand' })
  const brandId = book.brand
  const brand =
    book.expand?.brand ||
    (await pb.collection('brands').getOne<Brand>(brandId, { expand: 'stores' }))
  const walletStores: Store[] = brand.expand?.stores || []
  const auditDate = book.audit_date ? book.audit_date.slice(0, 10) : ''

  if (walletStores.length === 0) {
    const all = await pb.collection('stores').getFullList<Store>({ sort: 'number' })
    walletStores.push(...all)
  }

  // SKUs da marca
  const skus = await pb.collection('skus').getFullList<SKU>({
    filter: `brand = "${brandId}"`,
    sort: 'name',
  })

  // Fotos do book
  const photos = await pb.collection('book_photos').getFullList<BookPhoto>({
    filter: `book = "${bookId}"`,
    sort: 'slide_number,photo_index',
    expand: 'identified_store,corrected_store',
  })

  // Rupturas reportadas
  let ruptureReports: RuptureReport[] = []
  try {
    ruptureReports = await pb.collection('rupture_reports').getFullList<RuptureReport>({
      filter: `brand = "${brandId}"`,
      sort: '-report_date',
      expand: 'store,sku',
    })
  } catch {
    ruptureReports = []
  }

  // Matriz de sortimento
  let matrixItems: AssortmentMatrixItem[] = []
  try {
    matrixItems = await pb.collection('assortment_matrix').getFullList<AssortmentMatrixItem>({
      filter: `brand = "${brandId}"`,
    })
  } catch {
    matrixItems = []
  }

  // Agenda de visitas
  let schedules: VisitSchedule[] = []
  try {
    const scheduleFilter = auditDate ? `visit_date >= "${auditDate}"` : ''
    schedules = await pb.collection('visit_schedules').getFullList<VisitSchedule>({
      filter: scheduleFilter,
      expand: 'store,promoter',
    })
  } catch {
    schedules = []
  }

  onProgress?.({ message: 'Preparando fotos por loja...', pct: 8 })

  // 2. Agrupar fotos por loja
  const photosByStore = new Map<string, BookPhoto[]>()
  for (const p of photos) {
    const sid = p.corrected_store || p.identified_store
    if (!sid) continue
    if (!photosByStore.has(sid)) photosByStore.set(sid, [])
    photosByStore.get(sid)!.push(p)
  }

  // Agrupar agenda por loja
  const scheduleByStore = new Map<string, VisitSchedule>()
  for (const s of schedules) {
    const sDate = s.visit_date ? s.visit_date.slice(0, 10) : ''
    if (!auditDate || sDate === auditDate) {
      scheduleByStore.set(s.store, s)
    }
  }

  // Ruptura lookup:
  // - Por SKU específico: store|sku -> report
  // - Por Família / Marca: store|brand_total -> report
  const ruptureBySku = new Map<string, RuptureReport>()
  const ruptureByStoreTotal = new Map<string, RuptureReport>()

  for (const r of ruptureReports) {
    const rDate = r.report_date ? r.report_date.slice(0, 10) : ''
    const daysInRupture = r.days_in_rupture || 0

    // Guarda de data: ruptura só é válida se a data informada for compatível
    // (não usar automaticamente relatório antigo de data diferente sem flag de histórico)
    const isDateMatch = !auditDate || rDate === auditDate || daysInRupture > 0

    if (r.scope === 'brand_family' || r.brand_level_declared || !r.sku) {
      if (
        !ruptureByStoreTotal.has(r.store) ||
        (r.report_date || '') > (ruptureByStoreTotal.get(r.store)!.report_date || '')
      ) {
        if (isDateMatch) ruptureByStoreTotal.set(r.store, r)
      }
    } else if (r.sku) {
      const key = `${r.store}|${r.sku}`
      if (
        !ruptureBySku.has(key) ||
        (r.report_date || '') > (ruptureBySku.get(key)!.report_date || '')
      ) {
        if (isDateMatch) ruptureBySku.set(key, r)
      }
    }
  }

  // 3. Pre-calcular descritores visuais das fotos
  const photoDescriptors = new Map<string, ImageDescriptor>()
  let photoCount = 0
  const totalPhotos = photos.length
  for (const p of photos) {
    const url = p.image_data ? getFileUrl(p, p.image_data) : null
    if (url) {
      try {
        photoDescriptors.set(p.id, await describeImageUrl(url))
      } catch {
        // sem descritor
      }
    }
    photoCount++
    onProgress?.({
      message: `Analisando fotos do PDV (${photoCount}/${totalPhotos})...`,
      pct: 8 + Math.round((photoCount / Math.max(1, totalPhotos)) * 30),
    })
  }

  // 4. Pre-calcular descritores dos SKUs de referência
  const skuDescriptors = new Map<string, ImageDescriptor>()
  let skuCount = 0
  const totalSkus = skus.length
  for (const s of skus) {
    const url = s.image ? getFileUrl(s, s.image) : null
    if (url) {
      try {
        skuDescriptors.set(s.id, await describeImageUrl(url))
      } catch {
        // sem imagem de referência
      }
    }
    skuCount++
    onProgress?.({
      message: `Indexando imagens de referência (${skuCount}/${totalSkus})...`,
      pct: 38 + Math.round((skuCount / Math.max(1, totalSkus)) * 15),
    })
  }

  // 5. Marcar book em processamento
  await pb.collection('books').update(bookId, { analysis_status: 'processing' })

  // 6. Limpar classificações anteriores do book
  try {
    const existing = await pb
      .collection('sku_classifications')
      .getFullList({ filter: `book = "${bookId}"` })
    for (const e of existing) {
      // PRESERVAR revisões manuais humanas se existirem
      if (e.reviewer || e.reviewed_at) {
        continue
      }
      try {
        await pb.collection('sku_classifications').delete(e.id)
      } catch {
        // ignora erro pontual
      }
    }
  } catch {
    // ignora
  }

  // 7. Classificar por loja e SKU aplicando a Nova Lógica da Etapa 1
  onProgress?.({ message: 'Classificando SKUs por loja e dimensões...', pct: 55 })

  const classificationsToCreate: any[] = []
  let processed = 0
  const totalPairs = walletStores.length * skus.length

  for (const store of walletStores) {
    const storePhotos = photosByStore.get(store.id) || []
    const scheduled = scheduleByStore.get(store.id)

    // Dimensão de Visita da Loja
    let visitDim: VisitDimension = 'agenda_desconhecida'
    if (scheduled) {
      if (storePhotos.length > 0) {
        visitDim = 'visita_confirmada_evidencias'
      } else if (
        scheduled.status === 'visita_confirmada_fotos_pendentes' ||
        scheduled.checkin_time
      ) {
        visitDim = 'visita_confirmada_fotos_pendentes'
      } else {
        visitDim = 'visita_agendada_nao_confirmada'
      }
    } else {
      visitDim = storePhotos.length > 0 ? 'visita_confirmada_evidencias' : 'sem_visita_agendada'
    }

    // Se a loja não tem nenhuma foto neste book:
    if (storePhotos.length === 0) {
      for (const sku of skus) {
        const assortment = resolveAssortmentStatus(sku.id, store, matrixItems, auditDate)
        const brandRupture = ruptureByStoreTotal.get(store.id)

        // IMPORTANTE: Uma visita sem fotos NÃO é escusada somente porque foi relatada ruptura
        // Ausência de fotos = problema de cobertura, não falta do promotor nem ausência do SKU.
        const reason = brandRupture
          ? `Loja sem fotos no book. Há relato de ruptura geral (${brandRupture.rupture_type}), mas visita sem fotos requer evidência visual.`
          : 'Loja sem fotos neste book (problema de cobertura fotográfica / visita).'

        classificationsToCreate.push({
          book: bookId,
          store: store.id,
          sku: sku.id,
          category: 'sem_foto_loja',
          confidence: 'alta',
          reason_text: reason,
          notes: reason,
          assortment_status: assortment.status,
          presence_dimension: 'nao_verificado',
          coverage_dimension: 'sem_foto_loja',
          price_dimension: 'nao_verificado',
          rupture_dimension: brandRupture ? 'ruptura_declarada_marca' : 'sem_ruptura',
          visit_dimension: visitDim,
          is_inferred_link: !!brandRupture?.is_inferred,
          inferred_link_notes: brandRupture?.inference_notes,
          discrepancy_flag: false,
        })
      }
      processed += skus.length
      onProgress?.({
        message: `Classificando ${store.name}...`,
        pct: 55 + Math.round((processed / Math.max(1, totalPairs)) * 40),
      })
      continue
    }

    // Loja TEM fotos no book
    for (const sku of skus) {
      const assortment = resolveAssortmentStatus(sku.id, store, matrixItems, auditDate)
      const refDesc = skuDescriptors.get(sku.id)
      const hasRefImage = !!sku.image && !!refDesc

      let bestSim = 0
      let bestPhoto: BookPhoto | null = null

      if (refDesc) {
        for (const ph of storePhotos) {
          const phDesc = photoDescriptors.get(ph.id)
          if (!phDesc) continue
          const sim = compareDescriptors(refDesc, phDesc)
          if (sim > bestSim) {
            bestSim = sim
            bestPhoto = ph
          }
        }
      }

      // Checagem de rupturas da loja
      const skuRupture = ruptureBySku.get(`${store.id}|${sku.id}`)
      const brandRupture = ruptureByStoreTotal.get(store.id)

      let category: SkuCategory
      let confidence: ConfidenceLevel = 'media'
      let reasonText = ''
      let matchedPhotoId: string | undefined
      let evidenceUrl: string | undefined

      // Dimensões independentes
      let presenceDim: PresenceDimension = 'nao_verificado'
      let coverageDim: CoverageDimension = 'cobertura_completa'
      let priceDim: PriceDimension = 'nao_verificado'
      let ruptureDim: RuptureDimension = 'sem_ruptura'
      let discrepancyFlag = false
      let inferredLink = false
      let inferredNotes = ''

      // Verificação de preço
      let priceFields: {
        price_checked?: boolean
        price_match?: boolean | null
        price_observed?: string
        price_expected?: string
        missing_price_tag?: boolean
        missing_splash?: boolean
      } = {}

      // 1. Caso de SKU NÃO trabalhado na matriz
      if (assortment.status === 'nao_trabalhado') {
        category = 'nao_identificado'
        confidence = 'alta'
        presenceDim = 'nao_verificado'
        reasonText =
          `SKU não trabalhado nesta loja/rede conforme Matriz de Sortimento. ${assortment.ruleNotes || ''}`.trim()
      }
      // 2. Imagem de referência indisponível ou erro técnico
      else if (!hasRefImage) {
        category = 'nao_verificado'
        confidence = 'baixa'
        presenceDim = 'nao_verificado'
        reasonText =
          'SKU sem imagem de referência cadastrada no sistema. Não foi possível comparar visualmente.'
      }
      // 3. Detectado com evidência visual (alta similaridade)
      else if (bestSim >= PRESENCE_THRESHOLD && bestPhoto) {
        category = 'presente_pdv'
        confidence = bestSim >= 0.72 ? 'alta' : 'media'
        presenceDim = 'presente_com_evidencia'
        matchedPhotoId = bestPhoto.id
        evidenceUrl = bestPhoto.image_data ? getFileUrl(bestPhoto, bestPhoto.image_data) : undefined
        reasonText = `Similaridade visual de ${Math.round(bestSim * 100)}% identificada na foto do slide ${bestPhoto.slide_number}.`

        // DISCREPÂNCIA: se há relato de ruptura total declarada para a loja/marca E o produto está visível
        if (
          brandRupture ||
          (skuRupture &&
            (skuRupture.rupture_type === 'total' || skuRupture.rupture_type === 'zerado'))
        ) {
          discrepancyFlag = true
          ruptureDim = 'discrepancia_visivel_vs_declarada'
          reasonText +=
            ' ATENÇÃO: Discrepância detectada — produto identificado visualmente, porém há relato de ruptura total no sistema TradePRO.'
        }

        const expectedPrice = expectedPriceForSku(sku, auditDate)
        priceFields = {
          price_checked: true,
          price_expected: expectedPrice,
          price_match: null,
          price_observed: '',
          missing_price_tag: false,
          missing_splash: sku.requires_splash && isInPromotion(sku, auditDate) ? true : false,
        }
        priceDim = 'nao_verificado'
      }
      // 4. Detecção parcial / baixa confiança
      else if (bestSim >= REVIEW_THRESHOLD && bestPhoto) {
        category = 'evidencia_insuficiente'
        confidence = 'baixa'
        presenceDim = 'evidencia_insuficiente'
        matchedPhotoId = bestPhoto.id
        evidenceUrl = bestPhoto.image_data ? getFileUrl(bestPhoto, bestPhoto.image_data) : undefined
        reasonText = `Similaridade parcial (${Math.round(bestSim * 100)}%) no slide ${bestPhoto.slide_number}. Evidência insuficiente para confirmar presença ou ausência automática — requer validação humana.`
        priceFields = {
          price_checked: false,
          price_expected: expectedPriceForSku(sku, auditDate),
        }
      }
      // 5. Não identificado visualmente — checar justificativas de ruptura
      else {
        presenceDim = 'nao_identificado'

        // Checar ruptura específica de SKU
        if (skuRupture) {
          const days = skuRupture.days_in_rupture || 0
          const rDate = skuRupture.report_date ? skuRupture.report_date.slice(0, 10) : ''

          // Guarda de data: se for de data anterior (>15 dias), requer validar ruptura antiga
          if (days > RUPTURE_OLD_DAYS) {
            category = 'validar_ruptura_antiga'
            confidence = 'media'
            ruptureDim = 'validar_antiga'
            reasonText = `Ruptura informada há ${days} dias (${rDate}) — validar se ainda é estrutural ou se voltou ao estoque.`
          } else {
            category = 'ruptura_justificada'
            confidence = 'alta'
            ruptureDim = 'ruptura_justificada'
            reasonText = `Ruptura ${skuRupture.rupture_type} relatada para este SKU em ${rDate} (${days} dias).`
          }

          if (skuRupture.is_inferred) {
            inferredLink = true
            inferredNotes =
              skuRupture.inference_notes || 'Vínculo loja/data inferido sem identificador único.'
          }
        }
        // Checar ruptura declarada em nível de marca / família (TradePRO)
        else if (brandRupture) {
          category = 'ruptura_justificada'
          confidence = 'media'
          ruptureDim = 'ruptura_declarada_marca'
          inferredLink = true
          inferredNotes =
            'Ruptura declarada em nível de marca/família no TradePRO. Não é prova visual de falta de SKU individual.'
          reasonText = `Ruptura total da marca declarada no TradePRO em ${brandRupture.report_date} (${brandRupture.days_in_rupture || 0} dias). Registrado como declaração institucional, não como prova visual.`
        }
        // NÃO IDENTIFICADO NAS FOTOS:
        // REGRA DE OURO: "Produto não identificado na foto" NUNCA PODE SER INTERPRETADO COMO "ausente da loja".
        // Portanto, a engine marca como 'nao_identificado' (ou 'sem_foto_secao' se as fotos não cobrirem a seção),
        // NUNCA como 'ausente_cobrar'. Apenas o revisor humano com evidência genuína pode marcar 'ausente_cobrar'.
        else {
          category = 'nao_identificado'
          confidence = 'media'
          reasonText =
            'SKU não localizado nas fotos do PDV. Ausência não comprovada — classificado como Não Identificado para validação da auditoria.'
        }
      }

      classificationsToCreate.push({
        book: bookId,
        store: store.id,
        sku: sku.id,
        category,
        confidence,
        similarity: bestSim || undefined,
        matched_photo: matchedPhotoId,
        evidence_photo_url: evidenceUrl,
        reason_text: reasonText,
        notes: reasonText,
        presence_dimension: presenceDim,
        coverage_dimension: coverageDim,
        price_dimension: priceDim,
        rupture_dimension: ruptureDim,
        visit_dimension: visitDim,
        is_inferred_link: inferredLink,
        inferred_link_notes: inferredNotes,
        discrepancy_flag: discrepancyFlag,
        assortment_status: assortment.status,
        ...priceFields,
      })

      processed++
      if (processed % 15 === 0) {
        onProgress?.({
          message: `Classificando SKUs (${processed}/${totalPairs})...`,
          pct: 55 + Math.round((processed / Math.max(1, totalPairs)) * 40),
        })
      }
    }
  }

  // 8. Salvar no PocketBase (cria novas ou atualiza não revisadas)
  onProgress?.({ message: 'Persistindo classificações auditadas...', pct: 95 })
  let saved = 0

  for (const c of classificationsToCreate) {
    try {
      // Verificar se já existe (preservada de revisão manual)
      const existing = await pb
        .collection('sku_classifications')
        .getFirstListItem(`book = "${c.book}" && store = "${c.store}" && sku = "${c.sku}"`)
        .catch(() => null)

      if (existing) {
        // Se já foi revisada por humano, não sobrescreve category/notes
        if (existing.reviewer || existing.reviewed_at) {
          await pb.collection('sku_classifications').update(existing.id, {
            assortment_status: c.assortment_status,
            visit_dimension: c.visit_dimension,
            discrepancy_flag: c.discrepancy_flag,
          })
        } else {
          await pb.collection('sku_classifications').update(existing.id, c)
        }
      } else {
        await pb.collection('sku_classifications').create(c)
      }
      saved++
    } catch {
      // ignora erro pontual
    }
  }

  // 9. Construir resumo por categoria e atualizar book
  const byCategory: Record<SkuCategory, number> = {
    presente_pdv: 0,
    nao_identificado: 0,
    evidencia_insuficiente: 0,
    sem_foto_secao: 0,
    sem_foto_loja: 0,
    nao_verificado: 0,
    falha_tecnica: 0,
    ruptura_justificada: 0,
    validar_ruptura_antiga: 0,
    ausente_cobrar: 0,
  }

  for (const c of classificationsToCreate) {
    if (byCategory[c.category as SkuCategory] !== undefined) {
      byCategory[c.category as SkuCategory]++
    }
  }

  await pb.collection('books').update(bookId, {
    analysis_status: 'completed',
    analysis_summary: JSON.stringify(byCategory),
    analyzed_at: new Date().toISOString(),
  })

  onProgress?.({ message: 'Análise concluída com sucesso!', pct: 100 })

  return {
    created: saved,
    updated: 0,
    byCategory,
  }
}

// ---- Funções auxiliares de preço ----

function isInPromotion(sku: SKU, auditDate?: string): boolean {
  if (!sku.promo_price || sku.promo_price <= 0) return false
  if (!auditDate) return false
  const d = auditDate.slice(0, 10)
  if (sku.promo_start && d < sku.promo_start.slice(0, 10)) return false
  if (sku.promo_end && d > sku.promo_end.slice(0, 10)) return false
  return true
}

const PRICE_TOLERANCE = 0.01

function formatBRL(v: number): string {
  return (
    'R$ ' +
    Number(v || 0)
      .toFixed(2)
      .replace('.', ',')
  )
}

function expectedPriceForSku(sku: SKU, _auditDate?: string): string {
  const normal = Number(sku.normal_price || 0)
  const promo = Number(sku.promo_price || 0)
  if (promo > 0) {
    return `${formatBRL(normal)} (ou promo ${formatBRL(promo)})`
  }
  return formatBRL(normal)
}

export function priceMatchesExpected(sku: SKU, observed: string): boolean | null {
  const m = String(observed || '').match(/(\d{1,3}(?:\.\d{3})*,\d{2})/)
  if (!m) return null
  const value = Number(m[1].replace(/\./g, '').replace(',', '.'))
  if (!Number.isFinite(value) || value <= 0) return null
  const normal = Number(sku.normal_price || 0)
  const promo = Number(sku.promo_price || 0)
  const okNormal = normal > 0 && Math.abs(value - normal) <= PRICE_TOLERANCE
  const okPromo = promo > 0 && Math.abs(value - promo) <= PRICE_TOLERANCE
  return okNormal || okPromo
}
