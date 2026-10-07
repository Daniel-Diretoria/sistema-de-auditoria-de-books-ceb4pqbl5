// Correção (feedback Gabriel 07/10): Pão e Arte tem APENAS 2 SKUs —
// Pão de Queijo Top e Pão Francês. Os demais criados no piloto eram de
// outra família (Sertãozinho). Remove os incorretos e ajusta o cadastro.
migrate(
  (app) => {
    let peaBrand
    try {
      peaBrand = app.findFirstRecordByData('brands', 'name', 'Pão e Arte')
    } catch (_) {
      return // marca ainda não existe — nada a corrigir
    }

    const skusCol = app.findCollectionByNameOrId('skus')
    const targets = ['SKU-PEA-001', 'SKU-PEA-002', 'SKU-PEA-003', 'SKU-PEA-004', 'SKU-PEA-005']

    for (const code of targets) {
      try {
        const sku = app.findFirstRecordByData('skus', 'code', code)
        // Remove apenas se for da marca Pão e Arte
        if (sku.getString('brand') === peaBrand.id) {
          app.delete(sku)
        }
      } catch (_) {}
    }

    // Recria apenas os 2 corretos (idempotente)
    const createSku = (code, name, price) => {
      try {
        app.findFirstRecordByData('skus', 'code', code)
        return // já existe
      } catch (_) {}
      const rec = new Record(skusCol)
      rec.set('code', code)
      rec.set('name', name)
      rec.set('brand', peaBrand.id)
      rec.set('normal_price', price)
      rec.set('main_gondola', true)
      rec.set('min_quantity', 3)
      rec.set('requires_splash', false)
      app.save(rec)
    }

    // Preços são placeholder até Gabriel enviar a planilha real.
    createSku('SKU-PEA-001', 'Pão de Queijo Top', 22.9)
    createSku('SKU-PEA-002', 'Pão Francês', 14.9)
  },
  (app) => {
    // down: sem ação (idempotente por natureza)
  },
)
