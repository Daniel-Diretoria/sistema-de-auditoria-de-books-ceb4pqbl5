// SKU analysis engine: runs visual recognition + business rules to classify
// each SKU of a brand's wallet per store present in a book.

import pb from '@/lib/pocketbase/client'
import {
  Book,
  BookPhoto,
  Brand,
  Store,
  SKU,
  RuptureReport,
  SkuClassification,
  SkuCategory,
  ConfidenceLevel,
} from '@/types'
import { ImageDescriptor, describeImageUrl, compareDescriptors } from '@/lib/imageCompare'
import { getFileUrl } from '@/services/api'

export interface AnalysisProgress {
  message: string
  pct: number
}

const PRESENCE_THRESHOLD = 0.55 // above => likely present, alta confiança
const REVIEW_THRESHOLD = 0.38 // above => possible presence, baixa confiança (REVISAR)
const RUPTURE_OLD_DAYS = 15

export interface AnalysisResult {
  created: number
  updated: number
  byCategory: Record<SkuCategory, number>
}

/**
 * Run the full analysis for a book. Classifies every SKU of the brand's
 * wallet against every store that has at least one photo in the book.
 *
 * Stores with NO photos in the book get all their SKUs classified as
 * `sem_foto_loja`.
 */
export async function runBookAnalysis(
  bookId: string,
  onProgress?: (p: AnalysisProgress) => void,
): Promise<AnalysisResult> {
  onProgress?.({ message: 'Carregando dados do book...', pct: 2 })

  // 1. Load book + brand + wallet (stores + SKUs) + photos + rupture reports
  const book = await pb.collection('books').getOne<Book>(bookId, { expand: 'brand' })
  const brandId = book.brand
  const brand =
    book.expand?.brand ||
    (await pb.collection('brands').getOne<Brand>(brandId, { expand: 'stores' }))
  const walletStores: Store[] = brand.expand?.stores || []
  if (walletStores.length === 0) {
    // re-fetch stores via relation
    const all = await pb.collection('stores').getFullList<Store>({ sort: 'number' })
    walletStores.push(...all)
  }

  // SKUs of the brand
  const skus = await pb.collection('skus').getFullList<SKU>({
    filter: `brand = "${brandId}"`,
    sort: 'name',
  })

  // Photos of the book (already reviewed — identified store assigned)
  const photos = await pb.collection('book_photos').getFullList<BookPhoto>({
    filter: `book = "${bookId}"`,
    sort: 'slide_number,photo_index',
    expand: 'identified_store,corrected_store',
  })

  // Rupture reports for this brand around the audit date
  const ruptureReports = await pb.collection('rupture_reports').getFullList<RuptureReport>({
    filter: `brand = "${brandId}"`,
    sort: '-report_date',
    expand: 'store,sku',
  })

  onProgress?.({ message: 'Preparando fotos por loja...', pct: 8 })

  // 2. Group photos by store (use corrected_store if present, else identified_store)
  const photosByStore = new Map<string, BookPhoto[]>()
  for (const p of photos) {
    const sid = p.corrected_store || p.identified_store
    if (!sid) continue
    if (!photosByStore.has(sid)) photosByStore.set(sid, [])
    photosByStore.get(sid)!.push(p)
  }

  // Rupture lookup: store+sku -> latest report
  const ruptureByKey = new Map<string, RuptureReport>()
  for (const r of ruptureReports) {
    const key = `${r.store}|${r.sku}`
    // keep the most recent
    if (
      !ruptureByKey.has(key) ||
      (r.report_date || '') > (ruptureByKey.get(key)!.report_date || '')
    ) {
      ruptureByKey.set(key, r)
    }
  }

  // 3. Pre-compute image descriptors for every photo (cache by photo id)
  const photoDescriptors = new Map<string, ImageDescriptor>()
  let photoCount = 0
  const totalPhotos = photos.length
  for (const p of photos) {
    const url = p.image_data ? getFileUrl(p, p.image_data) : null
    if (url) {
      try {
        photoDescriptors.set(p.id, await describeImageUrl(url))
      } catch {
        // skip — treat as no descriptor
      }
    }
    photoCount++
    onProgress?.({
      message: `Analisando fotos do PDV (${photoCount}/${totalPhotos})...`,
      pct: 8 + Math.round((photoCount / Math.max(1, totalPhotos)) * 32),
    })
  }

  // 4. Pre-compute descriptors for every SKU reference image (cache by sku id)
  const skuDescriptors = new Map<string, ImageDescriptor>()
  let skuCount = 0
  const totalSkus = skus.length
  for (const s of skus) {
    const url = s.image ? getFileUrl(s, s.image) : null
    if (url) {
      try {
        skuDescriptors.set(s.id, await describeImageUrl(url))
      } catch {
        // no reference image
      }
    }
    skuCount++
    onProgress?.({
      message: `Indexando imagens de referência (${skuCount}/${totalSkus})...`,
      pct: 40 + Math.round((skuCount / Math.max(1, totalSkus)) * 15),
    })
  }

  // 5. Mark book as processing
  await pb.collection('books').update(bookId, { analysis_status: 'processing' })

  // 6. Build classifications
  onProgress?.({ message: 'Classificando SKUs por loja...', pct: 58 })

  // Delete previous classifications for this book (idempotent re-run)
  try {
    const existing = await pb
      .collection('sku_classifications')
      .getFullList({ filter: `book = "${bookId}"` })
    for (const e of existing) {
      try {
        await pb.collection('sku_classifications').delete(e.id)
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }

  const classifications: Array<{
    book: string
    store: string
    sku: string
    category: SkuCategory
    confidence: ConfidenceLevel
    similarity?: number
    matched_photo?: string
    notes?: string
  }> = []

  let processed = 0
  const totalPairs = walletStores.length * skus.length

  for (const store of walletStores) {
    const storePhotos = photosByStore.get(store.id) || []

    // Loja inteira sem foto no book
    if (storePhotos.length === 0) {
      for (const sku of skus) {
        classifications.push({
          book: bookId,
          store: store.id,
          sku: sku.id,
          category: 'sem_foto_loja',
          confidence: 'alta',
          notes: 'Loja sem fotos neste book.',
        })
      }
      processed += skus.length
      onProgress?.({
        message: `Classificando ${store.name}...`,
        pct: 58 + Math.round((processed / Math.max(1, totalPairs)) * 38),
      })
      continue
    }

    for (const sku of skus) {
      const refDesc = skuDescriptors.get(sku.id)
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

      let category: SkuCategory
      let confidence: ConfidenceLevel
      let matchedPhotoId: string | undefined
      let notes: string | undefined

      if (bestSim >= PRESENCE_THRESHOLD && bestPhoto) {
        category = 'presente_pdv'
        confidence = bestSim >= 0.72 ? 'alta' : 'media'
        matchedPhotoId = bestPhoto.id
        notes = `Similaridade ${Math.round(bestSim * 100)}% com foto do slide ${bestPhoto.slide_number}.`
      } else if (bestSim >= REVIEW_THRESHOLD && bestPhoto) {
        // baixa confiança — precisa revisão manual; marcamos como presente
        // em revisão (category presente_pdv, confidence baixa) para o analista
        // confirmar. Se o analista rejeitar, reclassifica.
        category = 'presente_pdv'
        confidence = 'baixa'
        matchedPhotoId = bestPhoto.id
        notes = `Baixa confiança (${Math.round(bestSim * 100)}%) — revisar manualmente.`
      } else {
        // Não detectado — checar ruptura
        const rupture = ruptureByKey.get(`${store.id}|${sku.id}`)
        const days = rupture?.days_in_rupture || 0
        const ruptureTypeOk =
          rupture && (rupture.rupture_type === 'total' || rupture.rupture_type === 'zerado')
        if (rupture && ruptureTypeOk && days > RUPTURE_OLD_DAYS) {
          category = 'validar_ruptura_antiga'
          confidence = 'media'
          notes = `Ruptura há ${days} dias — validar se ainda é estrutural.`
        } else if (rupture && ruptureTypeOk) {
          category = 'ruptura_justificada'
          confidence = 'alta'
          notes = `Ruptura ${rupture.rupture_type} reportada em ${rupture.report_date} (${days} dias).`
        } else {
          // seção fotografada? todas as fotos desta loja já foram comparadas,
          // então consideramos a seção capturada.
          category = 'ausente_cobrar'
          confidence = refDesc ? 'media' : 'baixa'
          notes = refDesc
            ? 'SKU não identificado nas fotos da seção.'
            : 'SKU sem imagem de referência — não foi possível comparar.'
        }
      }

      classifications.push({
        book: bookId,
        store: store.id,
        sku: sku.id,
        category,
        confidence,
        similarity: bestSim || undefined,
        matched_photo: matchedPhotoId,
        notes,
      })

      processed++
      if (processed % 10 === 0) {
        onProgress?.({
          message: `Classificando SKUs (${processed}/${totalPairs})...`,
          pct: 58 + Math.round((processed / Math.max(1, totalPairs)) * 38),
        })
      }
    }
  }

  // 7. Persist classifications in batches
  onProgress?.({ message: 'Salvando classificações...', pct: 96 })
  let saved = 0
  for (const c of classifications) {
    try {
      await pb.collection('sku_classifications').create(c)
      saved++
    } catch (err) {
      // ignore individual errors
    }
  }

  // 8. Build summary + update book
  const byCategory: Record<SkuCategory, number> = {
    presente_pdv: 0,
    ruptura_justificada: 0,
    ausente_cobrar: 0,
    validar_ruptura_antiga: 0,
    sem_foto_secao: 0,
    sem_foto_loja: 0,
  }
  for (const c of classifications) byCategory[c.category]++
  const summary = JSON.stringify(byCategory)

  await pb.collection('books').update(bookId, {
    analysis_status: 'completed',
    analysis_summary: summary,
    analyzed_at: new Date().toISOString(),
  })

  onProgress?.({ message: 'Análise concluída!', pct: 100 })

  return {
    created: saved,
    updated: 0,
    byCategory,
  }
}
