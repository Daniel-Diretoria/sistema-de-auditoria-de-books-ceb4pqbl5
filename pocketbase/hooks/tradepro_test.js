// Testa a conexão com a API privada da TradePRO usando as credenciais
// cadastradas na collection `integrations` (provider = 'tradepro').
// Atualiza o status da integração (conectado / erro) conforme o resultado.
routerAdd(
  'POST',
  '/backend/v1/tradepro/test',
  (e) => {
    // Apenas administradores podem testar a integração
    if (!e.auth || e.auth.getString('role') !== 'administrator') {
      return e.forbiddenError('Apenas administradores podem testar a integração.')
    }

    let integ
    try {
      integ = $app.findFirstRecordByFilter('integrations', "provider = 'tradepro'")
    } catch (_) {
      return e.json(200, {
        ok: false,
        message: 'Integração TradePRO não encontrada no banco.',
        details: 'Abra a página Integrações e salve as credenciais primeiro.',
      })
    }

    const baseUrl = (integ.getString('base_url') || '').trim()
    const apiKey = (integ.getString('api_key') || '').trim()

    if (!baseUrl || !apiKey) {
      return e.json(200, {
        ok: false,
        message: 'URL base ou chave de API vazias.',
        details:
          'Preencha a URL base e a chave de API na página Integrações e salve antes de testar.',
      })
    }

    // Caminho opcional de teste (config_json.test_path), ex.: "/status" ou "/ping"
    let testPath = ''
    try {
      const cfg = JSON.parse(integ.getString('config_json') || '{}')
      if (cfg && typeof cfg.test_path === 'string') testPath = cfg.test_path.trim()
    } catch (_) {}

    const url = baseUrl.replace(/\/+$/, '') + testPath

    let res
    try {
      res = $http.send({
        url: url,
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + apiKey,
          Accept: 'application/json',
        },
        timeout: 15,
      })
    } catch (err) {
      try {
        integ.set('status', 'erro')
        $app.save(integ)
      } catch (_) {}
      $app.logger().error('tradepro test: transport failure', 'url', url, 'error', String(err))
      return e.json(200, {
        ok: false,
        message: 'Falha de rede ao contatar a API TradePRO.',
        details: 'URL testada: ' + url + ' · Erro: ' + String(err),
      })
    }

    const ok = res.statusCode >= 200 && res.statusCode < 300

    // Amostra da resposta para ajudar a identificar o formato da API
    let sample = ''
    try {
      if (res.json !== undefined && res.json !== null) {
        sample = JSON.stringify(res.json).slice(0, 500)
      } else {
        sample = new TextDecoder().decode(res.body).slice(0, 500)
      }
    } catch (_) {}

    try {
      integ.set('status', ok ? 'conectado' : 'erro')
      $app.save(integ)
    } catch (_) {}

    $app.logger().info('tradepro test', 'url', url, 'status', res.statusCode)

    return e.json(200, {
      ok: ok,
      status: res.statusCode,
      message: ok
        ? 'Conexão estabelecida! A API TradePRO respondeu com sucesso.'
        : 'A API TradePRO respondeu, mas recusou a chamada (HTTP ' + res.statusCode + ').',
      details:
        'URL testada: ' +
        url +
        (sample ? ' · Resposta: ' + sample : '') +
        (ok
          ? ''
          : ' · Se for 401/403, confirme o formato do token com o suporte TradePRO (Bearer, X-API-Key, etc.).'),
    })
  },
  $apis.requireAuth(),
)
