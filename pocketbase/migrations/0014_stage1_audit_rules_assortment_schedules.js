migrate(
  (app) => {
    const brandsCol = app.findCollectionByNameOrId('brands').id
    const storesCol = app.findCollectionByNameOrId('stores').id
    const skusCol = app.findCollectionByNameOrId('skus').id
    const promotersCol = app.findCollectionByNameOrId('promoters').id
    const usersCol = '_pb_users_auth_'
    const booksCol = app.findCollectionByNameOrId('books').id
    const bookPhotosCol = app.findCollectionByNameOrId('book_photos').id

    // 1. Atualizar collection `stores`: adicionar api_identifier (identificador oficial do TradePRO / API)
    const storesCollection = app.findCollectionByNameOrId('stores')
    if (!storesCollection.fields.getByName('api_identifier')) {
      storesCollection.fields.add(
        new TextField({
          name: 'api_identifier',
          required: false,
        }),
      )
      app.save(storesCollection)
    }

    // 2. Atualizar collection `rupture_reports`:
    //    - sku relation: tornar opcional (pois TradePRO reporta por família/marca, nem sempre por SKU individual)
    //    - adicionar fields: scope ('sku' | 'brand_family'), brand_level_declared (bool), requires_clarification (bool),
    //      clarification_reason (text), is_inferred (bool), inference_notes (text)
    const ruptureCol = app.findCollectionByNameOrId('rupture_reports')
    const skuField = ruptureCol.fields.getByName('sku')
    if (skuField) {
      skuField.required = false
    }
    if (!ruptureCol.fields.getByName('scope')) {
      ruptureCol.fields.add(
        new SelectField({
          name: 'scope',
          required: false,
          values: ['sku', 'brand_family'],
        }),
      )
    }
    if (!ruptureCol.fields.getByName('brand_level_declared')) {
      ruptureCol.fields.add(new BoolField({ name: 'brand_level_declared', required: false }))
    }
    if (!ruptureCol.fields.getByName('requires_clarification')) {
      ruptureCol.fields.add(new BoolField({ name: 'requires_clarification', required: false }))
    }
    if (!ruptureCol.fields.getByName('clarification_reason')) {
      ruptureCol.fields.add(new TextField({ name: 'clarification_reason', required: false }))
    }
    if (!ruptureCol.fields.getByName('is_inferred')) {
      ruptureCol.fields.add(new BoolField({ name: 'is_inferred', required: false }))
    }
    if (!ruptureCol.fields.getByName('inference_notes')) {
      ruptureCol.fields.add(new TextField({ name: 'inference_notes', required: false }))
    }
    app.save(ruptureCol)

    // 3. Atualizar collection `sku_classifications`:
    //    Expandir values da category com novos estados:
    //    presente_pdv, nao_identificado, evidencia_insuficiente, sem_foto_secao,
    //    sem_foto_loja, nao_verificado, falha_tecnica, ruptura_justificada,
    //    validar_ruptura_antiga, ausente_cobrar
    //    Adicionar dimensões separadas e campos de justificativa/evidência
    const skuClassCol = app.findCollectionByNameOrId('sku_classifications')
    const catField = skuClassCol.fields.getByName('category')
    if (catField) {
      catField.values = [
        'presente_pdv',
        'nao_identificado',
        'evidencia_insuficiente',
        'sem_foto_secao',
        'sem_foto_loja',
        'nao_verificado',
        'falha_tecnica',
        'ruptura_justificada',
        'validar_ruptura_antiga',
        'ausente_cobrar',
      ]
    }
    if (!skuClassCol.fields.getByName('reason_text')) {
      skuClassCol.fields.add(new TextField({ name: 'reason_text', required: false }))
    }
    if (!skuClassCol.fields.getByName('evidence_photo_url')) {
      skuClassCol.fields.add(new TextField({ name: 'evidence_photo_url', required: false }))
    }
    // Dimensões separadas
    if (!skuClassCol.fields.getByName('presence_dimension')) {
      skuClassCol.fields.add(
        new SelectField({
          name: 'presence_dimension',
          required: false,
          values: [
            'presente_com_evidencia',
            'nao_identificado',
            'evidencia_insuficiente',
            'nao_verificado',
            'ausente_confirmado',
          ],
        }),
      )
    }
    if (!skuClassCol.fields.getByName('coverage_dimension')) {
      skuClassCol.fields.add(
        new SelectField({
          name: 'coverage_dimension',
          required: false,
          values: ['cobertura_completa', 'secao_parcial', 'sem_foto_secao', 'sem_foto_loja'],
        }),
      )
    }
    if (!skuClassCol.fields.getByName('price_dimension')) {
      skuClassCol.fields.add(
        new SelectField({
          name: 'price_dimension',
          required: false,
          values: ['conforme', 'divergente', 'sem_etiqueta', 'sem_splash', 'nao_verificado'],
        }),
      )
    }
    if (!skuClassCol.fields.getByName('rupture_dimension')) {
      skuClassCol.fields.add(
        new SelectField({
          name: 'rupture_dimension',
          required: false,
          values: [
            'sem_ruptura',
            'ruptura_justificada',
            'ruptura_declarada_marca',
            'validar_antiga',
            'discrepancia_visivel_vs_declarada',
          ],
        }),
      )
    }
    if (!skuClassCol.fields.getByName('visit_dimension')) {
      skuClassCol.fields.add(
        new SelectField({
          name: 'visit_dimension',
          required: false,
          values: [
            'visita_confirmada_evidencias',
            'visita_confirmada_fotos_pendentes',
            'visita_agendada_nao_confirmada',
            'sem_visita_agendada',
            'agenda_desconhecida',
          ],
        }),
      )
    }
    if (!skuClassCol.fields.getByName('is_inferred_link')) {
      skuClassCol.fields.add(new BoolField({ name: 'is_inferred_link', required: false }))
    }
    if (!skuClassCol.fields.getByName('inferred_link_notes')) {
      skuClassCol.fields.add(new TextField({ name: 'inferred_link_notes', required: false }))
    }
    if (!skuClassCol.fields.getByName('discrepancy_flag')) {
      skuClassCol.fields.add(new BoolField({ name: 'discrepancy_flag', required: false }))
    }
    if (!skuClassCol.fields.getByName('assortment_status')) {
      skuClassCol.fields.add(
        new SelectField({
          name: 'assortment_status',
          required: false,
          values: ['obrigatorio', 'opcional', 'nao_trabalhado', 'aguardando_confirmacao'],
        }),
      )
    }
    app.save(skuClassCol)

    // 4. Remapear dados existentes em sku_classifications de forma segura:
    //    - As linhas com ausente_cobrar geradas automaticamente por falta de identificação
    //      (sem reviewer humano) viram "nao_identificado"
    //    - Linhas com reviewer humano PRESERVAM suas notas, reviewed_at e reviewer.
    app
      .db()
      .newQuery(`
      UPDATE sku_classifications
      SET category = 'nao_identificado',
          reason_text = 'Classificação automática remapeada para Não Identificado (ausência não provada visualmente)'
      WHERE category = 'ausente_cobrar'
        AND (reviewer IS NULL OR reviewer = '')
    `)
      .execute()

    // 5. Nova collection: `assortment_matrix` (Matriz de Sortimento Esperado)
    //    marca × rede/loja × SKU com vigência início/fim e status (obrigatorio, opcional, nao_trabalhado, aguardando_confirmacao)
    //    Suporta default de rede (store = null) com exceções por loja específica (store preenchida)
    const assortmentMatrix = new Collection({
      name: 'assortment_matrix',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule:
        "@request.auth.role = 'administrator' || @request.auth.role = 'analista_books' || @request.auth.role = 'gestor'",
      updateRule:
        "@request.auth.role = 'administrator' || @request.auth.role = 'analista_books' || @request.auth.role = 'gestor'",
      deleteRule:
        "@request.auth.role = 'administrator' || @request.auth.role = 'analista_books' || @request.auth.role = 'gestor'",
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
          name: 'sku',
          type: 'relation',
          required: true,
          collectionId: skusCol,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'network',
          type: 'text',
          required: false,
        },
        {
          name: 'store',
          type: 'relation',
          required: false,
          collectionId: storesCol,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['obrigatorio', 'opcional', 'nao_trabalhado', 'aguardando_confirmacao'],
        },
        {
          name: 'start_date',
          type: 'date',
          required: false,
        },
        {
          name: 'end_date',
          type: 'date',
          required: false,
        },
        {
          name: 'min_facings',
          type: 'number',
          required: false,
          onlyInt: true,
          min: 0,
        },
        {
          name: 'notes',
          type: 'text',
          required: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_assortment_brand ON assortment_matrix (brand)',
        'CREATE INDEX idx_assortment_sku ON assortment_matrix (sku)',
        'CREATE INDEX idx_assortment_store ON assortment_matrix (store)',
        'CREATE INDEX idx_assortment_network ON assortment_matrix (network)',
        'CREATE INDEX idx_assortment_status ON assortment_matrix (status)',
      ],
    })
    app.save(assortmentMatrix)

    // 6. Nova collection: `visit_schedules` (Agenda de Visitas)
    //    store, date, promoter, brand, status da visita, origem (importado_planilha, manual, api_tradepro),
    //    is_inferred (bool), ambiguous_conflict (bool), conflict_notes (text)
    const visitSchedules = new Collection({
      name: 'visit_schedules',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule:
        "@request.auth.role = 'administrator' || @request.auth.role = 'analista_books' || @request.auth.role = 'supervisor'",
      updateRule:
        "@request.auth.role = 'administrator' || @request.auth.role = 'analista_books' || @request.auth.role = 'supervisor'",
      deleteRule:
        "@request.auth.role = 'administrator' || @request.auth.role = 'analista_books' || @request.auth.role = 'supervisor'",
      fields: [
        {
          name: 'store',
          type: 'relation',
          required: true,
          collectionId: storesCol,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'visit_date',
          type: 'date',
          required: true,
        },
        {
          name: 'promoter',
          type: 'relation',
          required: false,
          collectionId: promotersCol,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'brand',
          type: 'relation',
          required: false,
          collectionId: brandsCol,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: [
            'sem_visita_agendada',
            'agenda_desconhecida',
            'visita_agendada_nao_confirmada',
            'visita_confirmada_fotos_pendentes',
            'visita_confirmada_evidencias',
          ],
        },
        {
          name: 'shift',
          type: 'select',
          required: false,
          values: ['manha', 'tarde', 'integral'],
        },
        {
          name: 'origin',
          type: 'select',
          required: false,
          values: ['manual', 'import_planilha', 'api_tradepro'],
        },
        {
          name: 'checkin_time',
          type: 'text',
          required: false,
        },
        {
          name: 'checkout_time',
          type: 'text',
          required: false,
        },
        {
          name: 'is_inferred',
          type: 'bool',
          required: false,
        },
        {
          name: 'ambiguous_conflict',
          type: 'bool',
          required: false,
        },
        {
          name: 'conflict_notes',
          type: 'text',
          required: false,
        },
        {
          name: 'notes',
          type: 'text',
          required: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_visit_schedules_store ON visit_schedules (store)',
        'CREATE INDEX idx_visit_schedules_date ON visit_schedules (visit_date)',
        'CREATE INDEX idx_visit_schedules_promoter ON visit_schedules (promoter)',
        'CREATE INDEX idx_visit_schedules_brand ON visit_schedules (brand)',
        'CREATE INDEX idx_visit_schedules_status ON visit_schedules (status)',
      ],
    })
    app.save(visitSchedules)

    // 7. Atualizar collection `book_photos`:
    //    Adicionar is_inferred, ambiguous_match, inferred_notes
    const bookPhotosCollection = app.findCollectionByNameOrId('book_photos')
    if (!bookPhotosCollection.fields.getByName('is_inferred')) {
      bookPhotosCollection.fields.add(new BoolField({ name: 'is_inferred', required: false }))
    }
    if (!bookPhotosCollection.fields.getByName('ambiguous_match')) {
      bookPhotosCollection.fields.add(new BoolField({ name: 'ambiguous_match', required: false }))
    }
    if (!bookPhotosCollection.fields.getByName('inferred_notes')) {
      bookPhotosCollection.fields.add(new TextField({ name: 'inferred_notes', required: false }))
    }
    app.save(bookPhotosCollection)
  },
  (app) => {
    try {
      const vs = app.findCollectionByNameOrId('visit_schedules')
      app.delete(vs)
    } catch (_) {}
    try {
      const am = app.findCollectionByNameOrId('assortment_matrix')
      app.delete(am)
    } catch (_) {}
  },
)
