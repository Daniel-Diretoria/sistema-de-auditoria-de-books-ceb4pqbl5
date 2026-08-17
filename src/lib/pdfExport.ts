// PDF Report generation for a Book.
// Uses jsPDF + jspdf-autotable. Embeds PDV photos as JPEG data URLs.

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  Book,
  BookPhoto,
  SkuClassification,
  Store,
  Brand,
  SKU,
  SKU_CATEGORY_LABELS,
  SkuCategory,
} from '@/types'
import { computeBookScores, bookAverageScore } from '@/lib/scoring'
import { getFileUrl, formatDate, formatCurrency } from '@/services/api'

// Brand color palette (indigo/dourado theme)
const COLORS = {
  indigo: [79, 70, 229] as [number, number, number],
  indigoDark: [49, 46, 129] as [number, number, number],
  gold: [217, 119, 6] as [number, number, number],
  slate: [100, 116, 139] as [number, number, number],
  slateLight: [226, 232, 240] as [number, number, number],
  slateDark: [30, 41, 59] as [number, number, number],
  emerald: [16, 185, 129] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
  amber: [245, 158, 11] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  bg: [248, 250, 252] as [number, number, number],
}

const CATEGORY_COLOR: Record<SkuCategory, [number, number, number]> = {
  presente_pdv: COLORS.emerald,
  ruptura_justificada: COLORS.amber,
  ausente_cobrar: COLORS.red,
  validar_ruptura_antiga: [249, 115, 22],
  sem_foto_secao: COLORS.slate,
  sem_foto_loja: [63, 63, 70],
}

function priceLabel(c: SkuClassification): string {
  if (c.category !== 'presente_pdv') return '—'
  if (c.missing_price_tag) return 'Sem preço exposto'
  if (c.price_checked && c.price_match === false) return `Divergente (${c.price_observed || '?'})`
  if (c.price_checked && c.price_match === true) return 'Conforme'
  if (!c.price_checked) return 'Não verificado'
  return '—'
}

function splashLabel(c: SkuClassification): string {
  const sku = c.expand?.sku
  if (!sku?.requires_splash) return 'Não se aplica'
  if (c.missing_splash) return 'Faltando'
  return 'OK'
}

function recommendedActions(classifications: SkuClassification[]): string[] {
  const actions: string[] = []
  const bySku = new Map<string, SkuClassification>()
  for (const c of classifications) bySku.set(c.sku, c)
  for (const c of classifications) {
    const sku = c.expand?.sku
    const skuName = sku ? `${sku.name} (${sku.code})` : c.sku
    if (c.category === 'ausente_cobrar') {
      actions.push(`Cobrar promotor — SKU Ausente: ${skuName}`)
    } else if (c.category === 'validar_ruptura_antiga') {
      actions.push(`Verificar ruptura antiga — SKU ${skuName}`)
    } else if (c.category === 'presente_pdv' && c.missing_price_tag) {
      actions.push(`Corrigir preço — SKU ${skuName} (sem preço exposto)`)
    } else if (c.category === 'presente_pdv' && c.price_checked && c.price_match === false) {
      actions.push(`Corrigir preço — SKU ${skuName} (preço divergente)`)
    } else if (c.category === 'presente_pdv' && c.missing_splash) {
      actions.push(`Cobrar splash — SKU ${skuName}`)
    } else if (c.category === 'sem_foto_loja') {
      actions.push(`Loja não auditada — SKU ${skuName}`)
    }
  }
  return actions
}

/** Fetch an image URL and return it as a JPEG data URL (for embedding in jsPDF). */
async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export interface PdfExportData {
  book: Book
  brand?: Brand
  classifications: SkuClassification[]
  photos: BookPhoto[]
  stores: Store[]
  skus: SKU[]
}

export async function exportBookPdf(data: PdfExportData): Promise<void> {
  const { book, brand, classifications, photos, stores, skus } = data

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 40
  const contentW = pageW - margin * 2

  // ---- Cover / Header ----
  let y = margin
  doc.setFillColor(...COLORS.indigoDark)
  doc.rect(0, 0, pageW, 90, 'F')
  doc.setTextColor(...COLORS.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Relatório de Auditoria de Book', margin, 38)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(book.title, margin, 58)
  doc.setFontSize(9)
  const subtitle = [
    `Marca: ${brand?.name || '—'}`,
    `Data: ${formatDate(book.audit_date)}`,
    `Analista: ${book.expand?.analyst?.name || '—'}`,
  ].join('   ·   ')
  doc.text(subtitle, margin, 74)

  y = 110
  doc.setTextColor(...COLORS.slateDark)

  // ---- Compute scores ----
  const storeMap = new Map<string, Store>()
  for (const s of stores) storeMap.set(s.id, s)
  const scores = computeBookScores(classifications, stores)
  const avg = bookAverageScore(scores)
  const unauditedCount = classifications.filter((c) => c.category === 'sem_foto_loja').length

  // Summary card
  doc.setFillColor(...COLORS.bg)
  doc.roundedRect(margin, y, contentW, 56, 6, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.slateDark)
  doc.text('Resumo Geral do Book', margin + 14, y + 20)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.slate)
  const summaryLine1 = `Nota média: ${avg.toFixed(1)}/10   ·   Lojas: ${scores.length}   ·   SKUs analisados: ${classifications.length}   ·   Lojas não auditadas: ${unauditedCount}`
  doc.text(summaryLine1, margin + 14, y + 38)
  const summaryLine2 = `Status: ${book.status}   ·   Total de fotos: ${photos.length}   ·   Gerado em: ${new Date().toLocaleString('pt-BR')}`
  doc.text(summaryLine2, margin + 14, y + 50)
  y += 72

  // ---- Preload photos grouped by store ----
  const photosByStore = new Map<string, BookPhoto[]>()
  for (const p of photos) {
    const sid = p.corrected_store || p.identified_store
    if (!sid) continue
    if (!photosByStore.has(sid)) photosByStore.set(sid, [])
    photosByStore.get(sid)!.push(p)
  }

  const classByStore = new Map<string, SkuClassification[]>()
  for (const c of classifications) {
    if (!classByStore.has(c.store)) classByStore.set(c.store, [])
    classByStore.get(c.store)!.push(c)
  }

  // ---- Per-store sections ----
  const sortedScores = [...scores].sort((a, b) =>
    (a.store?.number || '').localeCompare(b.store?.number || ''),
  )

  for (const score of sortedScores) {
    const store = score.store
    const storeClasses = classByStore.get(score.storeId) || []
    const storePhotos = photosByStore.get(score.storeId) || []

    // Page break check
    if (y > pageH - 180) {
      doc.addPage()
      y = margin
    }

    // Store header band
    doc.setFillColor(...COLORS.indigo)
    doc.rect(margin, y, contentW, 28, 'F')
    doc.setTextColor(...COLORS.white)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    const storeTitle = store ? `${store.number} — ${store.name}` : `Loja ${score.storeId}`
    doc.text(storeTitle, margin + 12, y + 18)
    // score badge on right
    const scoreColor =
      score.score >= 8 ? COLORS.emerald : score.score >= 6 ? COLORS.amber : COLORS.red
    doc.setFillColor(...scoreColor)
    doc.roundedRect(margin + contentW - 70, y + 5, 58, 18, 4, 4, 'F')
    doc.setTextColor(...COLORS.white)
    doc.setFontSize(10)
    doc.text(`${score.score.toFixed(1)}/10`, margin + contentW - 41, y + 17, { align: 'center' })
    y += 36

    // Store quick summary
    doc.setTextColor(...COLORS.slateDark)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const storeSummary = `Total SKUs: ${storeClasses.length}   ·   Presentes: ${score.present}   ·   Ausentes: ${score.absent}   ·   Rupturas just.: ${score.justifiedRupture}   ·   Sem foto: ${storeClasses.filter((c) => c.category === 'sem_foto_loja' || c.category === 'sem_foto_secao').length}`
    doc.text(storeSummary, margin, y)
    y += 14

    // SKU table
    const tableRows = storeClasses.map((c) => {
      const sku = c.expand?.sku
      return [
        sku?.name || '—',
        sku?.code || '—',
        SKU_CATEGORY_LABELS[c.category as SkuCategory],
        priceLabel(c),
        splashLabel(c),
      ]
    })

    autoTable(doc, {
      startY: y,
      head: [['SKU', 'Código', 'Categoria', 'Preço', 'Splash']],
      body: tableRows,
      theme: 'grid',
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 4, textColor: COLORS.slateDark as any },
      headStyles: {
        fillColor: COLORS.slateLight as any,
        textColor: COLORS.slateDark as any,
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: contentW * 0.32 },
        1: { cellWidth: contentW * 0.14 },
        2: { cellWidth: contentW * 0.24 },
        3: { cellWidth: contentW * 0.16 },
        4: { cellWidth: contentW * 0.14 },
      },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.column.index === 2) {
          const cat = storeClasses[hookData.row.index]?.category as SkuCategory
          if (cat && CATEGORY_COLOR[cat]) {
            const col = CATEGORY_COLOR[cat]
            hookData.cell.styles.textColor = col as any
            hookData.cell.styles.fontStyle = 'bold'
          }
        }
      },
    })
    // lastAutoTable is added by the autotable plugin at runtime
    y = (doc as any).lastAutoTable.finalY + 12

    // Recommended actions
    const actions = recommendedActions(storeClasses)
    if (actions.length > 0) {
      if (y > pageH - 80) {
        doc.addPage()
        y = margin
      }
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...COLORS.gold)
      doc.text('Ações recomendadas:', margin, y)
      y += 12
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COLORS.slateDark)
      actions.slice(0, 12).forEach((a) => {
        if (y > pageH - 40) {
          doc.addPage()
          y = margin
        }
        doc.text(`• ${a}`, margin + 8, y, { maxWidth: contentW - 16 })
        y += 12
      })
      y += 6
    }

    // Photos
    if (storePhotos.length > 0) {
      if (y > pageH - 120) {
        doc.addPage()
        y = margin
      }
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...COLORS.indigo)
      doc.text(`Fotos do PDV (${storePhotos.length})`, margin, y)
      y += 10

      const thumbW = 110
      const thumbH = 80
      const gap = 8
      const perRow = Math.floor((contentW + gap) / (thumbW + gap))
      let x = margin
      let placed = 0
      for (const p of storePhotos) {
        const url = p.image_data ? getFileUrl(p, p.image_data) : null
        if (!url) continue
        if (x + thumbW > margin + contentW) {
          x = margin
          y += thumbH + gap + 12
          placed = 0
        }
        if (y + thumbH > pageH - margin) {
          doc.addPage()
          y = margin
          x = margin
        }
        // placeholder frame
        doc.setDrawColor(...COLORS.slateLight)
        doc.setFillColor(...COLORS.bg)
        doc.roundedRect(x, y, thumbW, thumbH, 3, 3, 'FD')
        try {
          const dataUrl = await fetchImageAsDataUrl(url)
          if (dataUrl) {
            doc.addImage(dataUrl, 'JPEG', x, y, thumbW, thumbH, undefined, 'FAST')
          } else {
            doc.setTextColor(...COLORS.slate)
            doc.setFontSize(7)
            doc.text('foto', x + thumbW / 2, y + thumbH / 2, { align: 'center' })
          }
        } catch {
          doc.setTextColor(...COLORS.slate)
          doc.setFontSize(7)
          doc.text('foto', x + thumbW / 2, y + thumbH / 2, { align: 'center' })
        }
        // slide label
        doc.setTextColor(...COLORS.slate)
        doc.setFontSize(7)
        doc.text(`Slide ${p.slide_number ?? '—'}`, x, y + thumbH + 9)
        x += thumbW + gap
        placed++
      }
      y += thumbH + 24
    }

    y += 8
  }

  // ---- Final summary page ----
  doc.addPage()
  y = margin
  doc.setFillColor(...COLORS.indigoDark)
  doc.rect(0, 0, pageW, 50, 'F')
  doc.setTextColor(...COLORS.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Resumo Final', margin, 32)
  y = 70

  doc.setTextColor(...COLORS.slateDark)
  doc.setFontSize(10)
  const finalRows: [string, string][] = [
    ['Nota média do book', `${avg.toFixed(1)}/10`],
    ['Total de lojas auditadas', String(scores.length)],
    ['Total de SKUs analisados', String(classifications.length)],
    ['Lojas não auditadas (sem foto)', String(unauditedCount)],
    ['Marca', brand?.name || '—'],
    ['Data da auditoria', formatDate(book.audit_date)],
    ['Analista responsável', book.expand?.analyst?.name || '—'],
    ['Status do book', book.status],
    ['Total de fotos', String(photos.length)],
  ]
  for (const [label, value] of finalRows) {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.slate)
    doc.text(label, margin, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.slateDark)
    doc.text(value, margin + 220, y)
    y += 18
  }

  // Category breakdown
  y += 10
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...COLORS.indigo)
  doc.text('Distribuição de classificações', margin, y)
  y += 16
  const catCounts: Record<string, number> = {}
  for (const c of classifications) catCounts[c.category] = (catCounts[c.category] || 0) + 1
  for (const cat of Object.keys(SKU_CATEGORY_LABELS)) {
    const count = catCounts[cat] || 0
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.slateDark)
    doc.text(SKU_CATEGORY_LABELS[cat as SkuCategory], margin, y)
    doc.setTextColor(...(CATEGORY_COLOR[cat as SkuCategory] || COLORS.slate))
    doc.setFont('helvetica', 'bold')
    doc.text(String(count), margin + 220, y)
    y += 14
  }

  // Footer page numbers
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.slate)
    doc.text(
      `Sistema de Auditoria de Books — ${brand?.name || ''} — Página ${i}/${pageCount}`,
      pageW / 2,
      pageH - 16,
      { align: 'center' },
    )
  }

  // Suppress unused import warning for formatCurrency (kept for potential price formatting)
  void formatCurrency

  const fileName = `relatorio-${(book.title || book.id).replace(/[^a-zA-Z0-9]+/g, '-')}.pdf`
  doc.save(fileName)
}
