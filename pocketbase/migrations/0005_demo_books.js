migrate(
  (app) => {
    // ---- 1. Add price-verification fields to sku_classifications ----
    const skuClassCol = app.findCollectionByNameOrId('sku_classifications')
    if (!skuClassCol.fields.getByName('price_checked')) {
      skuClassCol.fields.add(new BoolField({ name: 'price_checked', required: false }))
    }
    if (!skuClassCol.fields.getByName('price_match')) {
      skuClassCol.fields.add(new BoolField({ name: 'price_match', required: false }))
    }
    if (!skuClassCol.fields.getByName('price_observed')) {
      skuClassCol.fields.add(new TextField({ name: 'price_observed', required: false }))
    }
    if (!skuClassCol.fields.getByName('price_expected')) {
      skuClassCol.fields.add(new TextField({ name: 'price_expected', required: false }))
    }
    if (!skuClassCol.fields.getByName('missing_price_tag')) {
      skuClassCol.fields.add(new BoolField({ name: 'missing_price_tag', required: false }))
    }
    if (!skuClassCol.fields.getByName('missing_splash')) {
      skuClassCol.fields.add(new BoolField({ name: 'missing_splash', required: false }))
    }
    app.save(skuClassCol)

    // ---- 2. Resolve reference records ----
    const brandsCol = app.findCollectionByNameOrId('brands')
    const storesCol = app.findCollectionByNameOrId('stores')
    const skusCol = app.findCollectionByNameOrId('skus')
    const booksCol = app.findCollectionByNameOrId('books')
    const bookPhotosCol = app.findCollectionByNameOrId('book_photos')
    const ruptureCol = app.findCollectionByNameOrId('rupture_reports')
    const classificationsCol = app.findCollectionByNameOrId('sku_classifications')

    function findBrand(name) {
      try {
        return app.findFirstRecordByData('brands', 'name', name)
      } catch (_) {
        return null
      }
    }

    const cscBrand = findBrand('Café Santa Clara')
    const mimBrand = findBrand('Leite Mimosa')
    const vovBrand = findBrand('Biscoitos Creme da Vovó')
    if (!cscBrand || !mimBrand || !vovBrand) {
      // Required seed data not present — skip seeding safely.
      return
    }

    // Analyst lookup
    function findUser(email) {
      try {
        return app.findAuthRecordByEmail('_pb_users_auth_', email)
      } catch (_) {
        return null
      }
    }
    const ana = findUser('ana.books@diretoriapromocoes.com.br')
    const bruno = findUser('bruno.books@diretoriapromocoes.com.br')
    const camila = findUser('camila.books@diretoriapromocoes.com.br')

    // Helper to fetch brand store ids
    function brandStoreIds(brand) {
      const ids = brand.get('stores') || []
      return ids
    }
    function brandSkuIds(brandId) {
      const list = app.findRecordsByFilter('skus', "brand = '" + brandId + "'", 'name', 100, 0)
      return list
    }

    function findBookByTitle(title) {
      try {
        return app.findFirstRecordByData('books', 'title', title)
      } catch (_) {
        return null
      }
    }

    function findSkuByCode(code) {
      try {
        return app.findFirstRecordByData('skus', 'code', code)
      } catch (_) {
        return null
      }
    }

    function findStoreByNumber(number) {
      try {
        return app.findFirstRecordByData('stores', 'number', number)
      } catch (_) {
        return null
      }
    }

    // Idempotent: skip if all three demo books already exist.
    const existingCSC = findBookByTitle('Demo — Café Santa Clara — Agosto 2026')
    const existingMIM = findBookByTitle('Demo — Leite Mimosa — Agosto 2026')
    const existingVOV = findBookByTitle('Demo — Biscoitos Creme da Vovó — Agosto 2026')
    if (existingCSC && existingMIM && existingVOV) {
      return
    }

    // Helper to create a book photo record (no real image; uses placeholder URL
    // for extracted_text only — image_data left empty so it stays valid).
    function createBookPhoto(
      book,
      slideNumber,
      photoIndex,
      store,
      storeName,
      confidence,
      needsReview,
      reviewStatus,
      extractedText,
    ) {
      const rec = new Record(bookPhotosCol)
      rec.set('book', book)
      rec.set('slide_number', slideNumber)
      rec.set('photo_index', photoIndex)
      rec.set('extracted_text', extractedText || '')
      if (store) {
        rec.set('identified_store', store)
        rec.set('identified_store_name', storeName || '')
      }
      rec.set('confidence', confidence)
      rec.set('needs_review', !!needsReview)
      rec.set('review_status', reviewStatus || 'approved')
      app.save(rec)
      return rec
    }

    function createClassification(
      book,
      store,
      sku,
      category,
      confidence,
      similarity,
      notes,
      priceFields,
    ) {
      const rec = new Record(classificationsCol)
      rec.set('book', book)
      rec.set('store', store)
      rec.set('sku', sku)
      rec.set('category', category)
      rec.set('confidence', confidence || 'media')
      if (similarity != null) rec.set('similarity', similarity)
      if (notes) rec.set('notes', notes)
      if (priceFields) {
        if (priceFields.price_checked != null) rec.set('price_checked', priceFields.price_checked)
        if (priceFields.price_match != null) rec.set('price_match', priceFields.price_match)
        if (priceFields.price_observed) rec.set('price_observed', priceFields.price_observed)
        if (priceFields.price_expected) rec.set('price_expected', priceFields.price_expected)
        if (priceFields.missing_price_tag != null)
          rec.set('missing_price_tag', priceFields.missing_price_tag)
        if (priceFields.missing_splash != null)
          rec.set('missing_splash', priceFields.missing_splash)
      }
      app.save(rec)
      return rec
    }

    function createRupture(brand, store, sku, reportDate, ruptureType, days) {
      const rec = new Record(ruptureCol)
      rec.set('brand', brand)
      rec.set('store', store)
      rec.set('sku', sku)
      rec.set('report_date', reportDate)
      rec.set('rupture_type', ruptureType)
      if (days != null) rec.set('days_in_rupture', days)
      app.save(rec)
      return rec
    }

    const auditDateRecent = '2026-08-13'
    const auditDateOld = '2026-07-20'

    // =========================================================
    // BOOK 1 — Café Santa Clara — completed
    // =========================================================
    if (!existingCSC) {
      const cscStoreIds = brandStoreIds(cscBrand)
      const cscSkus = brandSkuIds(cscBrand.id)
      // Take 12 stores for photos, 3 absent
      const photoStoreIds = cscStoreIds.slice(0, 12)
      const absentStoreIds = cscStoreIds.slice(12, 15)

      const book1 = new Record(booksCol)
      book1.set('title', 'Demo — Café Santa Clara — Agosto 2026')
      book1.set('brand', cscBrand.id)
      book1.set('analyst', ana ? ana.id : cscBrand.get('analysts')[0])
      book1.set('file_name', 'demo_cafe_santa_clara.pptx')
      book1.set('file_size', 2400000)
      book1.set('audit_date', auditDateRecent)
      book1.set('audit_frequency', 'daily')
      book1.set('total_slides', 12)
      book1.set('total_photos', 12)
      book1.set('identified_stores', 12)
      book1.set('pending_review', 0)
      book1.set('missing_stores', absentStoreIds.length)
      book1.set('status', 'completed')
      book1.set('analysis_status', 'completed')
      book1.set('analyzed_at', new Date().toISOString())
      book1.set('missing_store_ids', absentStoreIds.join(','))
      const cscSummary = {
        presente_pdv: 24,
        ruptura_justificada: 3,
        ausente_cobrar: 5,
        validar_ruptura_antiga: 2,
        sem_foto_secao: 2,
        sem_foto_loja: 9,
      }
      book1.set('analysis_summary', JSON.stringify(cscSummary))
      app.save(book1)

      // 12 book photos (one per store, identified & approved)
      for (let i = 0; i < photoStoreIds.length; i++) {
        const sid = photoStoreIds[i]
        createBookPhoto(
          book1.id,
          i + 1,
          0,
          sid,
          'Loja ' + (i + 1),
          0.93,
          false,
          'approved',
          'Loja - seção cafés - foto ' + (i + 1),
        )
      }

      // Build classifications: per store x sku, mixed realistic
      // Use store helper
      const cscSkuRecs = cscSkus
      for (let s = 0; s < photoStoreIds.length; s++) {
        const storeId = photoStoreIds[s]
        for (let k = 0; k < cscSkuRecs.length; k++) {
          const sku = cscSkuRecs[k]
          // Distribute categories across stores
          let category
          let confidence = 'alta'
          let similarity = 0.78
          let notes = ''
          let priceFields = null
          if (s === 2 && k === 1) {
            category = 'ausente_cobrar'
            confidence = 'media'
            similarity = 0.2
            notes = 'SKU não identificado nas fotos da seção.'
          } else if (s === 5 && k === 2) {
            category = 'sem_foto_secao'
            confidence = 'baixa'
            similarity = 0
            notes = 'Seção não capturada nesta loja.'
          } else if (s === 7 && k === 0) {
            category = 'ruptura_justificada'
            confidence = 'alta'
            similarity = 0
            notes = 'Ruptura total reportada em ' + auditDateRecent + ' (3 dias).'
            // Create matching rupture report
            createRupture(cscBrand.id, storeId, sku.id, auditDateRecent, 'total', 3)
          } else if (s === 9 && k === 1) {
            category = 'validar_ruptura_antiga'
            confidence = 'media'
            similarity = 0
            notes = 'Ruptura há 18 dias — validar se ainda é estrutural.'
            createRupture(cscBrand.id, storeId, sku.id, auditDateOld, 'zerado', 18)
          } else {
            category = 'presente_pdv'
            confidence = k === 0 ? 'alta' : 'media'
            similarity = 0.6 + k * 0.05
            notes = 'Similaridade ' + Math.round(similarity * 100) + '%.'
            // Price checks for present SKUs
            const promoPrice = sku.get('promo_price') || 0
            const normalPrice = sku.get('normal_price') || 0
            const expected = promoPrice > 0 ? promoPrice : normalPrice
            if (s === 0 && k === 0) {
              // price divergent
              priceFields = {
                price_checked: true,
                price_match: false,
                price_observed: 'R$ 16,90',
                price_expected: 'R$ ' + expected.toFixed(2).replace('.', ','),
                missing_price_tag: false,
                missing_splash: false,
              }
            } else if (s === 3 && k === 0) {
              // missing price tag
              priceFields = {
                price_checked: true,
                price_match: null,
                price_observed: '',
                price_expected: 'R$ ' + expected.toFixed(2).replace('.', ','),
                missing_price_tag: true,
                missing_splash: false,
              }
            } else if (s === 1 && k === 0 && sku.get('requires_splash')) {
              // missing splash
              priceFields = {
                price_checked: true,
                price_match: true,
                price_observed: 'R$ ' + expected.toFixed(2).replace('.', ','),
                price_expected: 'R$ ' + expected.toFixed(2).replace('.', ','),
                missing_price_tag: false,
                missing_splash: true,
              }
            } else if (k === 0 || k === 2) {
              priceFields = {
                price_checked: true,
                price_match: true,
                price_observed: 'R$ ' + expected.toFixed(2).replace('.', ','),
                price_expected: 'R$ ' + expected.toFixed(2).replace('.', ','),
                missing_price_tag: false,
                missing_splash: false,
              }
            }
          }
          createClassification(
            book1.id,
            storeId,
            sku.id,
            category,
            confidence,
            similarity,
            notes,
            priceFields,
          )
        }
      }

      // Absent stores -> sem_foto_loja for all SKUs
      for (let a = 0; a < absentStoreIds.length; a++) {
        const storeId = absentStoreIds[a]
        for (let k = 0; k < cscSkuRecs.length; k++) {
          createClassification(
            book1.id,
            storeId,
            cscSkuRecs[k].id,
            'sem_foto_loja',
            'alta',
            0,
            'Loja sem fotos neste book.',
            null,
          )
        }
      }
    }

    // helper closure needs to be accessible — redefine inline above instead
    function findStoreByNumberStoreId(sid) {
      try {
        return app.findFirstRecordByData('stores', 'id', sid)
      } catch (_) {
        // fallback: firstRecordByData doesn't support id field reliably; use findFirst
        return null
      }
    }

    // =========================================================
    // BOOK 2 — Leite Mimosa — pending_review
    // =========================================================
    if (!existingMIM) {
      const mimStoreIds = brandStoreIds(mimBrand)
      const photoStoreIds2 = mimStoreIds.slice(0, 8)
      const absentStoreIds2 = mimStoreIds.slice(8, 15)
      const mimSkus = brandSkuIds(mimBrand.id)

      const book2 = new Record(booksCol)
      book2.set('title', 'Demo — Leite Mimosa — Agosto 2026')
      book2.set('brand', mimBrand.id)
      book2.set('analyst', bruno ? bruno.id : mimBrand.get('analysts')[0])
      book2.set('file_name', 'demo_leite_mimosa.pptx')
      book2.set('file_size', 1800000)
      book2.set('audit_date', auditDateRecent)
      book2.set('audit_frequency', 'seg_qua_sex')
      book2.set('total_slides', 8)
      book2.set('total_photos', 8)
      book2.set('identified_stores', 5)
      book2.set('pending_review', 3)
      book2.set('missing_stores', absentStoreIds2.length)
      book2.set('status', 'pending_review')
      book2.set('analysis_status', 'pending')
      book2.set('missing_store_ids', absentStoreIds2.join(','))
      app.save(book2)

      // 5 identified photos + 3 needs_review
      for (let i = 0; i < photoStoreIds2.length; i++) {
        const sid = photoStoreIds2[i]
        const needsReview = i >= 5
        const conf = needsReview ? 0.55 : 0.9
        createBookPhoto(
          book2.id,
          i + 1,
          0,
          sid,
          '',
          conf,
          needsReview,
          needsReview ? 'pending' : 'approved',
          'Slide ' + (i + 1) + ' - loja pendente de confirmação',
        )
      }
    }

    // =========================================================
    // BOOK 3 — Biscoitos Creme da Vovó — processing (no analysis yet)
    // =========================================================
    if (!existingVOV) {
      const vovStoreIds = brandStoreIds(vovBrand)
      const photoStoreIds3 = vovStoreIds.slice(0, 10)

      const book3 = new Record(booksCol)
      book3.set('title', 'Demo — Biscoitos Creme da Vovó — Agosto 2026')
      book3.set('brand', vovBrand.id)
      book3.set('analyst', camila ? camila.id : vovBrand.get('analysts')[0])
      book3.set('file_name', 'demo_biscoitos_vovo.pptx')
      book3.set('file_size', 2100000)
      book3.set('audit_date', auditDateRecent)
      book3.set('audit_frequency', 'ter_qui_sab')
      book3.set('total_slides', 10)
      book3.set('total_photos', 10)
      book3.set('identified_stores', 10)
      book3.set('pending_review', 0)
      book3.set('missing_stores', 0)
      book3.set('status', 'processing')
      book3.set('analysis_status', 'pending')
      app.save(book3)

      for (let i = 0; i < photoStoreIds3.length; i++) {
        const sid = photoStoreIds3[i]
        createBookPhoto(book3.id, i + 1, 0, sid, '', 0.88, false, 'approved', 'Slide ' + (i + 1))
      }
    }
  },
  (app) => {
    // down: remove demo books + their cascade (book_photos, sku_classifications)
    const titles = [
      'Demo — Café Santa Clara — Agosto 2026',
      'Demo — Leite Mimosa — Agosto 2026',
      'Demo — Biscoitos Creme da Vovó — Agosto 2026',
    ]
    for (const t of titles) {
      try {
        const rec = app.findFirstRecordByData('books', 'title', t)
        app.delete(rec) // cascadeDelete on book_photos & sku_classifications
      } catch (_) {}
    }
    // Note: price fields left in place (forward-only).
  },
)
