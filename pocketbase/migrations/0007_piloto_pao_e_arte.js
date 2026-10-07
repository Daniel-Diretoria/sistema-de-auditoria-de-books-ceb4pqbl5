// Piloto Pão e Arte: cadastro da marca, lojas FORT ATACADISTA e SKUs.
// Idempotente — cria apenas o que não existir.
migrate(
  (app) => {
    const storesCol = app.findCollectionByNameOrId('stores')
    const brandsCol = app.findCollectionByNameOrId('brands')
    const skusCol = app.findCollectionByNameOrId('skus')

    // ---- 1. Lojas FORT ATACADISTA (amostra piloto) ----
    // [numero, nome, cidade]
    const lojas = [
      ['085', 'FORT ATACADISTA JARAGUÁ DO SUL', 'Jaraguá do Sul'],
      ['115', 'FORT ATACADISTA BALNEARIO CAMBORIU', 'Balneário Camboriú'],
      ['145', 'FORT ATACADISTA CAMPECHE', 'Florianópolis'],
      ['220', 'FORT ATACADISTA TUBARÃO', 'Tubarão'],
      ['250', 'FORT ATACADISTA FLORESTA', 'Joinville'],
      ['270', 'FORT ATACADISTA INDAIAL', 'Indaial'],
      ['325', 'FORT ATACADISTA ITAJAI SÃO JOÃO', 'Itajaí'],
      ['385', 'FORT ATACADISTA SÃO BENTO DO SUL', 'São Bento do Sul'],
      ['395', 'FORT ATACADISTA SÃO FRANCISCO DO SUL', 'São Francisco do Sul'],
      ['420', 'FORT ATACADISTA PENHA', 'Penha'],
      ['480', 'FORT ATACADISTA BLUMENAU', 'Blumenau'],
      ['810', 'FORT ATACADISTA FLORIANÓPOLIS', 'Florianópolis'],
    ]
    const lojaIds = []
    for (const [num, nome, cidade] of lojas) {
      let rec
      try {
        rec = app.findFirstRecordByData('stores', 'number', num)
      } catch (_) {
        rec = new Record(storesCol)
        rec.set('number', num)
        rec.set('name', nome)
        rec.set('address', cidade + ' - SC')
        rec.set('network', 'FORT ATACADISTA')
        rec.set('region', 'Sul')
        app.save(rec)
      }
      lojaIds.push(rec.id)
    }

    // ---- 2. Marca Pão e Arte ----
    let peaBrand
    try {
      peaBrand = app.findFirstRecordByData('brands', 'name', 'Pão e Arte')
    } catch (_) {
      // analista padrão: primeiro usuário analista_books ou admin
      let analyst = ''
      let supervisor = ''
      try {
        const users = app.findRecordsByFilter(
          '_pb_users_auth_',
          "role = 'analista_books'",
          'created',
          1,
          0,
        )
        if (users.length) analyst = users[0].id
      } catch (_) {}
      try {
        const sups = app.findRecordsByFilter(
          '_pb_users_auth_',
          "role = 'supervisor'",
          'created',
          1,
          0,
        )
        if (sups.length) supervisor = sups[0].id
      } catch (_) {}
      peaBrand = new Record(brandsCol)
      peaBrand.set('name', 'Pão e Arte')
      peaBrand.set('frequency', 'diaria')
      peaBrand.set('stores', lojaIds)
      if (analyst) peaBrand.set('analysts', [analyst])
      if (supervisor) peaBrand.set('supervisors', [supervisor])
      app.save(peaBrand)
    }

    // ---- 3. SKUs Pão e Arte ----
    // Preços são PLACEHOLDER até Gabriel enviar a planilha de preços por rede/seção.
    // [code, name, normal_price, main_gondola, min_qty]
    const skus = [
      ['SKU-PEA-001', 'Pão de Queijo Tradicional 800g', 19.9, true, 4],
      ['SKU-PEA-002', 'Pão de Queijo Coquetel 800g', 18.9, true, 4],
      ['SKU-PEA-003', 'Pão de Queijo Lanche 1kg', 24.9, true, 4],
      ['SKU-PEA-004', 'Pão de Queijo Ponto Natural 800g', 20.9, true, 4],
      ['SKU-PEA-005', 'Pão Francês 3kg', 22.9, true, 3],
    ]
    for (const [code, name, price, gondola, minQty] of skus) {
      try {
        app.findFirstRecordByData('skus', 'code', code)
      } catch (_) {
        const rec = new Record(skusCol)
        rec.set('code', code)
        rec.set('name', name)
        rec.set('brand', peaBrand.id)
        rec.set('normal_price', price)
        rec.set('main_gondola', gondola)
        rec.set('min_quantity', minQty)
        rec.set('requires_splash', false)
        app.save(rec)
      }
    }
  },
  (app) => {
    // down: remove piloto (SKUs -> marca -> lojas da amostra)
    try {
      const b = app.findFirstRecordByData('brands', 'name', 'Pão e Arte')
      const skuList = app.findRecordsByFilter('skus', "brand = '" + b.id + "'", 'created', 100, 0)
      for (const s of skuList) app.delete(s)
      const stIds = b.get('stores') || []
      app.delete(b)
      for (const sid of stIds) {
        try {
          app.delete(app.findRecordById('stores', sid))
        } catch (_) {}
      }
    } catch (_) {}
  },
)
