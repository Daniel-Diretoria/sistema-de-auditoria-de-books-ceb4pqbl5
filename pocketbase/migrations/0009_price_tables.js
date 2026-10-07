// price_tables — preços de referência por SKU/rede/seção, importados da
// planilha de preços do Trade Marketing. Usado no price check da análise IA.
migrate(
  (app) => {
    const brandsCol = app.findCollectionByNameOrId('brands').id
    const skusCol = app.findCollectionByNameOrId('skus').id

    const pt = new Collection({
      name: 'price_tables',
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
          cascadeDelete: true,
        },
        {
          name: 'sku',
          type: 'relation',
          required: true,
          collectionId: skusCol,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'rede', type: 'text', required: true },
        { name: 'secao', type: 'text', required: false },
        { name: 'preco', type: 'number', required: true, min: 0 },
        { name: 'vigencia', type: 'date', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_price_tables_key ON price_tables (brand, sku, rede, secao)',
      ],
    })
    app.save(pt)
  },
  (app) => {
    try {
      const c = app.findCollectionByNameOrId('price_tables')
      app.delete(c)
    } catch (_) {}
  },
)
