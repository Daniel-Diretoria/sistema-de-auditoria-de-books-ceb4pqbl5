migrate(
  (app) => {
    // 1. Extend users auth collection
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    if (!users.fields.getByName('role')) {
      users.fields.add(
        new SelectField({
          name: 'role',
          required: true,
          values: ['administrator', 'analista_books', 'supervisor', 'gestor'],
          maxSelect: 1,
        }),
      )
    }

    if (!users.fields.getByName('active')) {
      users.fields.add(
        new BoolField({
          name: 'active',
        }),
      )
    }

    users.listRule = "@request.auth.role = 'administrator' || @request.auth.id = id"
    users.viewRule = "@request.auth.role = 'administrator' || @request.auth.id = id"
    users.createRule = "@request.auth.role = 'administrator'"
    users.updateRule = "@request.auth.role = 'administrator'"
    users.deleteRule = "@request.auth.role = 'administrator'"
    app.save(users)

    // 2. Collection STORES
    const stores = new Collection({
      name: 'stores',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.role = 'administrator'",
      updateRule: "@request.auth.role = 'administrator'",
      deleteRule: "@request.auth.role = 'administrator'",
      fields: [
        { name: 'number', type: 'text', required: true },
        { name: 'name', type: 'text', required: true },
        { name: 'address', type: 'text', required: true },
        { name: 'network', type: 'text', required: true },
        {
          name: 'region',
          type: 'select',
          required: true,
          values: ['Sul', 'Sudeste', 'Centro-Oeste', 'Nordeste', 'Norte'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_stores_number ON stores (number)'],
    })
    app.save(stores)
    const storesId = stores.id

    // 3. Collection BRANDS
    const brands = new Collection({
      name: 'brands',
      type: 'base',
      listRule:
        "@request.auth.role = 'administrator' || @request.auth.role = 'gestor' || (@request.auth.role = 'analista_books' && analysts ~ @request.auth.id) || (@request.auth.role = 'supervisor' && supervisors ~ @request.auth.id)",
      viewRule:
        "@request.auth.role = 'administrator' || @request.auth.role = 'gestor' || (@request.auth.role = 'analista_books' && analysts ~ @request.auth.id) || (@request.auth.role = 'supervisor' && supervisors ~ @request.auth.id)",
      createRule: "@request.auth.role = 'administrator'",
      updateRule: "@request.auth.role = 'administrator'",
      deleteRule: "@request.auth.role = 'administrator'",
      fields: [
        { name: 'name', type: 'text', required: true },
        {
          name: 'logo',
          type: 'file',
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
        },
        {
          name: 'frequency',
          type: 'select',
          required: true,
          values: ['diaria', 'seg_qua_sex', 'ter_qui_sab', 'seg_qua_sex_sab'],
          maxSelect: 1,
        },
        { name: 'stores', type: 'relation', collectionId: storesId, maxSelect: 500 },
        { name: 'analysts', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 50 },
        { name: 'supervisors', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 50 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_brands_name ON brands (name)'],
    })
    app.save(brands)
    const brandsId = brands.id

    // 4. Collection SKUS
    const skus = new Collection({
      name: 'skus',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule:
        "@request.auth.role = 'administrator' || (@request.auth.role = 'analista_books' && brand.analysts ~ @request.auth.id)",
      updateRule:
        "@request.auth.role = 'administrator' || (@request.auth.role = 'analista_books' && brand.analysts ~ @request.auth.id)",
      deleteRule:
        "@request.auth.role = 'administrator' || (@request.auth.role = 'analista_books' && brand.analysts ~ @request.auth.id)",
      fields: [
        { name: 'code', type: 'text', required: true },
        { name: 'name', type: 'text', required: true },
        {
          name: 'brand',
          type: 'relation',
          required: true,
          collectionId: brandsId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'image',
          type: 'file',
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        },
        { name: 'normal_price', type: 'number', required: true, min: 0 },
        { name: 'promo_price', type: 'number', min: 0 },
        { name: 'promo_start', type: 'date' },
        { name: 'promo_end', type: 'date' },
        { name: 'main_gondola', type: 'bool' },
        { name: 'min_quantity', type: 'number', min: 0 },
        { name: 'requires_splash', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_skus_brand_code ON skus (brand, code)'],
    })
    app.save(skus)

    // 5. Collection PROMOTERS
    const promoters = new Collection({
      name: 'promoters',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.role = 'administrator' || @request.auth.role = 'analista_books'",
      updateRule: "@request.auth.role = 'administrator' || @request.auth.role = 'analista_books'",
      deleteRule: "@request.auth.role = 'administrator' || @request.auth.role = 'analista_books'",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'phone', type: 'text' },
        { name: 'brands', type: 'relation', collectionId: brandsId, maxSelect: 50 },
        { name: 'stores', type: 'relation', collectionId: storesId, maxSelect: 200 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(promoters)

    // 6. Collection AUDIT_RULES
    const auditRules = new Collection({
      name: 'audit_rules',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule:
        "@request.auth.role = 'administrator' || (@request.auth.role = 'analista_books' && brand.analysts ~ @request.auth.id)",
      updateRule:
        "@request.auth.role = 'administrator' || (@request.auth.role = 'analista_books' && brand.analysts ~ @request.auth.id)",
      deleteRule:
        "@request.auth.role = 'administrator' || (@request.auth.role = 'analista_books' && brand.analysts ~ @request.auth.id)",
      fields: [
        {
          name: 'brand',
          type: 'relation',
          required: true,
          collectionId: brandsId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'title', type: 'text', required: true },
        { name: 'criteria', type: 'text' },
        { name: 'mandatory_layout', type: 'text' },
        { name: 'requires_splash', type: 'bool' },
        { name: 'min_facings', type: 'number', min: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_audit_rules_brand ON audit_rules (brand)'],
    })
    app.save(auditRules)
  },
  (app) => {
    const collections = ['audit_rules', 'promoters', 'skus', 'brands', 'stores']
    for (const name of collections) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }
  },
)
