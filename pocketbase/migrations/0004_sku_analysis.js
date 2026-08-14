migrate(
  (app) => {
    const brandsCol = app.findCollectionByNameOrId('brands').id
    const storesCol = app.findCollectionByNameOrId('stores').id
    const skusCol = app.findCollectionByNameOrId('skus').id
    const usersCol = '_pb_users_auth_'
    const booksCol = app.findCollectionByNameOrId('books').id

    // ---- add analysis fields to books ----
    const booksCollection = app.findCollectionByNameOrId('books')
    if (!booksCollection.fields.getByName('analysis_status')) {
      booksCollection.fields.add(
        new SelectField({
          name: 'analysis_status',
          required: false,
          values: ['pending', 'processing', 'completed'],
        }),
      )
    }
    if (!booksCollection.fields.getByName('analysis_summary')) {
      booksCollection.fields.add(new TextField({ name: 'analysis_summary', required: false }))
    }
    if (!booksCollection.fields.getByName('analyzed_at')) {
      booksCollection.fields.add(new DateField({ name: 'analyzed_at', required: false }))
    }
    app.save(booksCollection)

    // ---- rupture_reports ----
    const ruptureReports = new Collection({
      name: 'rupture_reports',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.role = 'administrator' || @request.auth.role = 'analista_books'",
      updateRule: "@request.auth.role = 'administrator' || @request.auth.role = 'analista_books'",
      deleteRule: "@request.auth.role = 'administrator' || @request.auth.role = 'analista_books'",
      fields: [
        {
          name: 'brand',
          type: 'relation',
          required: true,
          collectionId: brandsCol,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'store',
          type: 'relation',
          required: true,
          collectionId: storesCol,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'sku',
          type: 'relation',
          required: true,
          collectionId: skusCol,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'report_date', type: 'date', required: true },
        {
          name: 'rupture_type',
          type: 'select',
          required: true,
          values: ['total', 'parcial', 'zerado'],
        },
        { name: 'days_in_rupture', type: 'number', required: false, onlyInt: true, min: 0 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_rupture_reports_brand ON rupture_reports (brand)',
        'CREATE INDEX idx_rupture_reports_store ON rupture_reports (store)',
        'CREATE INDEX idx_rupture_reports_sku ON rupture_reports (sku)',
        'CREATE INDEX idx_rupture_reports_date ON rupture_reports (report_date)',
      ],
    })
    app.save(ruptureReports)

    // ---- sku_classifications ----
    const skuClassifications = new Collection({
      name: 'sku_classifications',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule:
        "@request.auth.role = 'administrator' || (@request.auth.role = 'analista_books' && book.analyst = @request.auth.id)",
      updateRule:
        "@request.auth.role = 'administrator' || (@request.auth.role = 'analista_books' && book.analyst = @request.auth.id)",
      deleteRule:
        "@request.auth.role = 'administrator' || (@request.auth.role = 'analista_books' && book.analyst = @request.auth.id)",
      fields: [
        {
          name: 'book',
          type: 'relation',
          required: true,
          collectionId: booksCol,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'store',
          type: 'relation',
          required: true,
          collectionId: storesCol,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'sku',
          type: 'relation',
          required: true,
          collectionId: skusCol,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'category',
          type: 'select',
          required: true,
          values: [
            'presente_pdv',
            'ruptura_justificada',
            'ausente_cobrar',
            'validar_ruptura_antiga',
            'sem_foto_secao',
            'sem_foto_loja',
          ],
        },
        {
          name: 'confidence',
          type: 'select',
          required: false,
          values: ['alta', 'media', 'baixa'],
        },
        { name: 'similarity', type: 'number', required: false, min: 0, max: 1 },
        {
          name: 'matched_photo',
          type: 'relation',
          required: false,
          collectionId: app.findCollectionByNameOrId('book_photos').id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'reviewer',
          type: 'relation',
          required: false,
          collectionId: usersCol,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'reviewed_at', type: 'date', required: false },
        { name: 'notes', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_sku_classifications_book ON sku_classifications (book)',
        'CREATE INDEX idx_sku_classifications_store ON sku_classifications (store)',
        'CREATE INDEX idx_sku_classifications_sku ON sku_classifications (sku)',
        'CREATE INDEX idx_sku_classifications_category ON sku_classifications (category)',
        'CREATE INDEX idx_sku_classifications_confidence ON sku_classifications (confidence)',
        'CREATE UNIQUE INDEX idx_sku_classifications_unique ON sku_classifications (book, store, sku)',
      ],
    })
    app.save(skuClassifications)
  },
  (app) => {
    try {
      const c = app.findCollectionByNameOrId('sku_classifications')
      app.delete(c)
    } catch (_) {}
    try {
      const c = app.findCollectionByNameOrId('rupture_reports')
      app.delete(c)
    } catch (_) {}
    try {
      const col = app.findCollectionByNameOrId('books')
      const fa = col.fields.getByName('analysis_status')
      const fb = col.fields.getByName('analysis_summary')
      const fc = col.fields.getByName('analyzed_at')
      if (fa) col.fields.remove(fa.id)
      if (fb) col.fields.remove(fb.id)
      if (fc) col.fields.remove(fc.id)
      app.save(col)
    } catch (_) {}
  },
)
