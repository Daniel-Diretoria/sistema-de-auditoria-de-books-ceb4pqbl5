// Scoring engine: computes store notes and promoter rankings from
// sku_classifications according to the business rules.
//
// Nota da Loja = (SKUs_presentes_e_conformes) / (SKUs_elegiveis) × 10
//
// SKUs elegíveis = total - ruptura_justificada - sem_foto_secao - sem_foto_loja
// SKUs presentes e conformes = presente_pdv - penalidades
//   - sem preço exposto (missing_price_tag): -1
//   - promoção sem splash (missing_splash): -1
//   - preço divergente (price_match === false): -0.5
// AUSENTE_COBRAR conta no denominador mas não no numerador.

import { SkuClassification, StoreScore, PromoterScore, Store, Promoter, Brand } from '@/types'

export function computeStoreScore(
  storeId: string,
  classifications: SkuClassification[],
  store?: Store,
): StoreScore {
  let present = 0
  let absent = 0
  let justifiedRupture = 0
  let validarAntiga = 0
  let semFotoSecao = 0
  let semFotoLoja = 0
  let penalties = 0

  for (const c of classifications) {
    switch (c.category) {
      case 'presente_pdv':
        present++
        if (c.missing_price_tag) penalties += 1
        if (c.missing_splash) penalties += 1
        if (c.price_checked && c.price_match === false) penalties += 0.5
        break
      case 'ausente_cobrar':
        absent++
        break
      case 'ruptura_justificada':
        justifiedRupture++
        break
      case 'validar_ruptura_antiga':
        validarAntiga++
        break
      case 'sem_foto_secao':
        semFotoSecao++
        break
      case 'sem_foto_loja':
        semFotoLoja++
        break
    }
  }

  const total = classifications.length
  const eligible = total - justifiedRupture - semFotoSecao - semFotoLoja
  const presentAndConform = Math.max(0, present - penalties)
  const score = eligible > 0 ? Math.min(10, Math.max(0, (presentAndConform / eligible) * 10)) : 0

  return {
    storeId,
    store,
    present,
    absent,
    justifiedRupture,
    penalties,
    eligible,
    score: Math.round(score * 10) / 10,
    classifications,
  }
}

export function computeBookScores(
  classifications: SkuClassification[],
  stores: Store[],
): StoreScore[] {
  const storeMap = new Map<string, Store>()
  for (const s of stores) storeMap.set(s.id, s)

  const byStore = new Map<string, SkuClassification[]>()
  for (const c of classifications) {
    if (!byStore.has(c.store)) byStore.set(c.store, [])
    byStore.get(c.store)!.push(c)
  }

  const scores: StoreScore[] = []
  for (const [storeId, items] of byStore) {
    scores.push(computeStoreScore(storeId, items, storeMap.get(storeId)))
  }
  // sort by store number
  scores.sort((a, b) => (a.store?.number || '').localeCompare(b.store?.number || ''))
  return scores
}

export function bookAverageScore(storeScores: StoreScore[]): number {
  if (storeScores.length === 0) return 0
  const sum = storeScores.reduce((acc, s) => acc + s.score, 0)
  return Math.round((sum / storeScores.length) * 10) / 10
}

/**
 * Compute promoter ranking by averaging the store scores of the stores
 * each promoter tends, for a given set of books.
 */
export function computePromoterScores(
  promoters: Promoter[],
  storeScoresByStore: Map<string, StoreScore>,
  brands: Brand[],
): PromoterScore[] {
  const result: PromoterScore[] = []
  for (const p of promoters) {
    const storeIds = p.stores || []
    const relevant = storeIds
      .map((sid) => storeScoresByStore.get(sid))
      .filter((s): s is StoreScore => !!s)
    if (relevant.length === 0) continue
    const avg = relevant.reduce((acc, s) => acc + s.score, 0) / relevant.length

    const brandNames = (p.brands || [])
      .map((bid) => brands.find((b) => b.id === bid)?.name)
      .filter((n): n is string => !!n)

    result.push({
      promoterId: p.id,
      promoter: p,
      brandNames,
      storeCount: relevant.length,
      avgScore: Math.round(avg * 10) / 10,
      trend: 'stable',
      storeScores: relevant,
    })
  }
  result.sort((a, b) => b.avgScore - a.avgScore)
  return result
}
