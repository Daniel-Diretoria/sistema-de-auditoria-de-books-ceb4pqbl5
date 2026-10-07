// Piloto Pão e Arte — Book de amostra 07/10/2026 com fotos reais.
// Cria o book e anexa as fotos "Depois" de Pão e Arte da API TradePRO (download próprio).
// Idempotente: se o book já existir, não recria.
migrate(
  (app) => {
    let peaBrand
    try {
      peaBrand = app.findFirstRecordByData('brands', 'name', 'Pão e Arte')
    } catch (_) {
      return // marca não existe (migration 0007 não rodou?)
    }

    // Book já existe?
    let book
    try {
      book = app.findFirstRecordByData('books', 'title', 'Pão e Arte — Piloto — 07/10/2026')
      return // já criado
    } catch (_) {}

    const booksCol = app.findCollectionByNameOrId('books')
    const bookPhotosCol = app.findCollectionByNameOrId('book_photos')
    const storesCol = app.findCollectionByNameOrId('stores')

    // Analista: primeiro analista_books ou admin
    let analystId = ''
    try {
      const users = app.findRecordsByFilter(
        '_pb_users_auth_',
        "role = 'analista_books'",
        'created',
        1,
        0,
      )
      if (users.length) analystId = users[0].id
    } catch (_) {}
    if (!analystId) {
      try {
        const admins = app.findRecordsByFilter(
          '_pb_users_auth_',
          "role = 'administrator'",
          'created',
          1,
          0,
        )
        if (admins.length) analystId = admins[0].id
      } catch (_) {}
    }

    // Mapa loja (número -> record) da marca
    const storeByNum = {}
    const brandStoreIds = peaBrand.get('stores') || []
    for (const sid of brandStoreIds) {
      try {
        const s = app.findRecordById('stores', sid)
        storeByNum[s.getString('number').trim()] = s
      } catch (_) {}
    }

    // Fotografias reais (fotoId, loja número, tipo, path) coletadas da API hoje
    // -> caminhos baixados estão em work/tradepro/piloto/ (o hook fará isso em produção)
    const fotos = [
      {
        id: '565411',
        lojaNum: '480',
        tipo: 'Depois',
        path: 'https://diretoria.tradepro.com.br/visualizar-foto?id=wsyC7GHnaVYTVXZqyPS3Gm3bbBnnC4hrp_S_fBd04DfpTw',
      },
      {
        id: '565516',
        lojaNum: '325',
        tipo: 'Depois',
        path: 'https://diretoria.tradepro.com.br/visualizar-foto?id=3f4o9LKkFY3xJmk6yUEm8JVAyhK0ZCKfmPjlWg7BE5nkpQ',
      },
      {
        id: '565587',
        lojaNum: '220',
        tipo: 'Depois',
        path: 'https://diretoria.tradepro.com.br/visualizar-foto?id=WuePuDRSesl4F2SwXgYbisdSCINUYS2GjobgzmP2vxEcWw',
      },
      {
        id: '565608',
        lojaNum: '220',
        tipo: 'Depois',
        path: 'https://diretoria.tradepro.com.br/visualizar-foto?id=QdY47aRJvz_WNdWg2yS2x-SUkTk-tFUb2hG3dEIxzKXj4Q',
      },
      {
        id: '565683',
        lojaNum: '810',
        tipo: 'Depois',
        path: 'https://diretoria.tradepro.com.br/visualizar-foto?id=yPA9HisveYj7BpDc4VAHfHCVXDeJdBt50kCd-zPco2_cVw',
      },
    ]

    // Criar book
    const rec = new Record(booksCol)
    rec.set('title', 'Pão e Arte — Piloto — 07/10/2026')
    rec.set('brand', peaBrand.id)
    rec.set('analyst', analystId)
    rec.set('file_name', 'piloto_pao_e_arte_20261007')
    rec.set('file_size', fotos.length * 300000)
    rec.set('audit_date', '2026-10-07')
    rec.set('audit_frequency', 'daily')
    rec.set('total_slides', fotos.length)
    rec.set('total_photos', fotos.length)
    rec.set('identified_stores', fotos.length)
    rec.set('pending_review', 0)
    rec.set('missing_stores', 0)
    rec.set('status', 'completed')
    rec.set('analysis_status', 'completed')
    rec.set('analyzed_at', new Date().toISOString())
    rec.set(
      'analysis_summary',
      JSON.stringify({
        presente_pdv: 3,
        ausente_cobrar: 0,
        ruptura_justificada: 0,
        validar_ruptura_antiga: 0,
        sem_foto_secao: 0,
        sem_foto_loja: 2,
        lojas_com_foto: ['480', '325', '220', '810'],
        notas: 'Book piloto com fotos reais da API TradePRO. Preços pendentes de planilha.',
      }),
    )
    app.save(rec)

    // Anexar fotos (baixa da URL da API)
    let slide = 1
    for (const f of fotos) {
      const store = storeByNum[f.lojaNum]
      const p = new Record(bookPhotosCol)
      p.set('book', rec.id)
      p.set('slide_number', slide++)
      p.set('photo_index', 0)
      if (store) {
        p.set('identified_store', store.id)
        p.set('identified_store_name', store.getString('name'))
      }
      p.set('confidence', 0.9)
      p.set('needs_review', false)
      p.set('review_status', 'approved')
      p.set(
        'extracted_text',
        'TradePRO foto ' +
          f.id +
          ' | loja ' +
          (store ? store.getString('name') : f.lojaNum) +
          ' | ' +
          f.tipo +
          ' | ' +
          f.path,
      )
      // image_data fica vazio na migration (sem $filesystem);
      // o hook tradepro_attach_photo_image.js baixa e anexa a imagem após o create.
      app.save(p)
    }
  },
  (app) => {
    // down: remove o book piloto (cascade apaga fotos)
    try {
      const b = app.findFirstRecordByData('books', 'title', 'Pão e Arte — Piloto — 07/10/2026')
      app.delete(b)
    } catch (_) {}
  },
)
