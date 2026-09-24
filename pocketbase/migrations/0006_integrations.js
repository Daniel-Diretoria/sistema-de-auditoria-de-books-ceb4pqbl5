migrate(
  (app) => {
    // Collection INTEGRATIONS
    const integrations = new Collection({
      name: 'integrations',
      type: 'base',
      listRule: "@request.auth.role = 'administrator'",
      viewRule: "@request.auth.role = 'administrator'",
      createRule: "@request.auth.role = 'administrator'",
      updateRule: "@request.auth.role = 'administrator'",
      deleteRule: "@request.auth.role = 'administrator'",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'provider', type: 'text', required: true },
        { name: 'base_url', type: 'text' },
        { name: 'api_key', type: 'text' },
        {
          name: 'environment',
          type: 'select',
          values: ['producao', 'homologacao'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          values: ['conectado', 'nao_conectado', 'erro'],
          maxSelect: 1,
        },
        { name: 'config_json', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_integrations_provider ON integrations (provider)'],
    })
    app.save(integrations)

    // Seed default TradePRO record
    try {
      const rec = new Record(integrations)
      rec.set('name', 'TradePRO')
      rec.set('provider', 'tradepro')
      rec.set('base_url', '')
      rec.set('api_key', '')
      rec.set('environment', 'producao')
      rec.set('status', 'nao_conectado')
      rec.set(
        'config_json',
        JSON.stringify({
          description: 'Integração de dados de PDV, lojas, rotas e auditoria TradePRO',
          contact_email: 'comercial@tradepro.com.br',
          auto_sync_enabled: false,
        }),
      )
      app.save(rec)
    } catch (_) {}
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('integrations')
      app.delete(col)
    } catch (_) {}
  },
)
