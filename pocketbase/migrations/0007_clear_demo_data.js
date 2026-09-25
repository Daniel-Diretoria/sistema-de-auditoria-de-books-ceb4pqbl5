migrate(
  (app) => {
    // 1. Deletar registros que dependem de books e marcas/lojas/skus
    // sku_classifications
    app.db().newQuery('DELETE FROM sku_classifications').execute()

    // book_photos
    app.db().newQuery('DELETE FROM book_photos').execute()

    // rupture_reports
    app.db().newQuery('DELETE FROM rupture_reports').execute()

    // books
    app.db().newQuery('DELETE FROM books').execute()

    // audit_rules
    app.db().newQuery('DELETE FROM audit_rules').execute()

    // promoters
    app.db().newQuery('DELETE FROM promoters').execute()

    // skus
    app.db().newQuery('DELETE FROM skus').execute()

    // brands
    app.db().newQuery('DELETE FROM brands').execute()

    // stores
    app.db().newQuery('DELETE FROM stores').execute()

    // 2. Limpar usuários seed/demo criados na migração 0002_seed.js
    // PRESERVAR estritamente:
    // - suporte@diretoriapromocoes.com.br (admin real do cliente)
    // - rhuan.marx@diretoriapromocoes.com.br (usuário real cadastrado)
    const seedEmails = [
      'ana.books@diretoriapromocoes.com.br',
      'bruno.books@diretoriapromocoes.com.br',
      'camila.books@diretoriapromocoes.com.br',
      'supervisor1@diretoriapromocoes.com.br',
      'supervisor2@diretoriapromocoes.com.br',
      'gestor@diretoriapromocoes.com.br',
    ]

    for (let i = 0; i < seedEmails.length; i++) {
      try {
        const u = app.findAuthRecordByEmail('_pb_users_auth_', seedEmails[i])
        app.delete(u)
      } catch (_) {}
    }
  },
  (app) => {
    // Down migration: reversão não repopula automaticamente dados fictícios
  },
)
