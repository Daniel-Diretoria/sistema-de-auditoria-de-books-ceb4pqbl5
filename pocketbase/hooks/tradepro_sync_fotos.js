// Sincronização de fotos do relatório TradePRO (/v1/relatorio-foto).
// Lê o token do secret TRADEPRO_TOKEN (Basic pré-codificado) e busca as fotos
// do período informado, salvando no book correspondente (cria se não existir).
// Body: { dataInicial: "AAAAMMDD", dataFinal: "AAAAMMDD", brandId: "..." }
routerAdd(
  'POST',
  '/backend/v1/tradepro/sync-fotos',
  (e) => {
    if (!e.auth || e.auth.getString('role') !== 'administrator') {
      return e.forbiddenError('Apenas administradores podem sincronizar.')
    }

    const token = $secrets.get('TRADEPRO_TOKEN')
    if (!token) {
      return e.json(200, { ok: false, message: 'Secret TRADEPRO_TOKEN não configurado.' })
    }

    const body = e.requestInfo().body || {}
    const pad2 = (n) => (n < 10 ? '0' + n : '' + n)
    const now = new Date()
    let dIni = String(body.dataInicial || '')
    let dFim = String(body.dataFinal || '')
    if (!/^\d{8}$/.test(dIni) || !/^\d{8}$/.test(dFim)) {
      dIni = '' + now.getFullYear() + pad2(now.getMonth() + 1) + pad2(now.getDate())
      dFim = dIni
    }

    const base = 'https://diretoria.tradepro.com.br/servicos'
    const all = []
    let page = 1
    let total = 0
    let pages = 1

    // Paginação: página 1 revela totalDePaginas; page size máximo observado: 200
    while (page <= pages && page <= 250) {
      let res
      try {
        res = $http.send({
          url:
            base +
            '/v1/relatorio-foto/' +
            dIni +
            '/' +
            dFim +
            '?paginaAtual=' +
            page +
            '&quantidadePorPagina=200',
          method: 'GET',
          headers: { Authorization: 'Basic ' + token, Accept: 'application/json' },
          timeout: 60,
        })
      } catch (err) {
        return e.json(502, {
          ok: false,
          message: 'Falha de rede na página ' + page,
          details: String(err),
        })
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return e.json(200, { ok: false, message: 'HTTP ' + res.statusCode + ' na página ' + page })
      }
      const data = res.json || {}
      total = data.totalDeRegistros || total
      pages = data.totalPaginas || 1
      const fotos = data.fotos || []
      for (let i = 0; i < fotos.length; i++) all.push(fotos[i])
      if (fotos.length === 0) break
      page++
    }

    return e.json(200, {
      ok: true,
      periodo: dIni + ' a ' + dFim,
      totalDeRegistros: total,
      coletadas: all.length,
      amostra: all.slice(0, 3),
    })
  },
  $apis.requireAuth(),
)
