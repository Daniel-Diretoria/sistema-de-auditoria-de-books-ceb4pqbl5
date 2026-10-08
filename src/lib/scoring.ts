// Scoring engine: computa notas de loja e ranking de promotores
// baseado nas classificações de SKU e na Matriz de Sortimento.
//
// Regras da Etapa 1:
// - Apenas SKUs obrigatórios e elegíveis compõem a base do cálculo.
// - SKUs "não trabalhado" na matriz são excluídos do cálculo.
// - "Não identificado" / "Evidência insuficiente" / "Sem foto de seção" / "Sem foto de loja"
//   NÃO são penalizados automaticamente como ausência culposa nem punem o promotor
//   sem verificação de agenda/cobertura.
// - AUSENTE_COBRAR confirmado por evidência conta no denominador como ausência comprovada.
// - Ruptura justificada é excluída do denominador.

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
  let naoIdentificado = 0
  let evidenciaInsuficiente = 0
  let naoVerificado = 0
  let naoTrabalhado = 0
  let penalties = 0

  for (const c of classifications) {
    // Se o SKU não é trabalhado na loja conforme a matriz, desconsidera
    if (c.assortment_status === 'nao_trabalhado') {
      naoTrabalhado++
      continue
    }

    switch (c.category) {
      case 'presente_pdv':
        present++
        if (c.missing_price_tag) penalties += 1
        if (c.missing_splash) penalties += 1
        if (c.price_checked && c.price_match === false) penalties += 0.5
        break
      case 'ausente_cobrar':
        // Apenas ausência comprovada conta contra o promotor
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
      case 'nao_identificado':
        naoIdentificado++
        break
      case 'evidencia_insuficiente':
        evidenciaInsuficiente++
        break
      case 'nao_verificado':
      case 'falha_tecnica':
        naoVerificado++
        break
    }
  }

  const total = classifications.length
  // Itens excluídos do denominador de elegibilidade direta:
  // rupturas justificadas, ausências de fotos (cobertura), itens não trabalhados,
  // e itens pendentes de identificação que ainda não foram convertidos em ausência comprovada
  const excludedFromEligible =
    justifiedRupture + semFotoSecao + semFotoLoja + naoTrabalhado + naoVerificado

  const eligible = Math.max(0, total - excludedFromEligible)
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
  // Ordena por número de loja
  scores.sort((a, b) => (a.store?.number || '').localeCompare(b.store?.number || ''))
  return scores
}

export function bookAverageScore(storeScores: StoreScore[]): number {
  if (storeScores.length === 0) return 0
  const sum = storeScores.reduce((acc, s) => acc + s.score, 0)
  return Math.round((sum / storeScores.length) * 10) / 10
}

/**
 * Computa ranking de promotores agregando a pontuação média das lojas atendidas.
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
