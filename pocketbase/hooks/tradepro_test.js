// Testa a conexão com a API da TradePRO.
// Pode receber base_url e api_key no corpo da requisição ou ler do registro da integração existente.
// NUNCA cria novo registro na coleção `integrations` (evita conflito com idx_integrations_provider).
// Se o registro existente 'tradepro' existir, atualiza seu status de forma tolerante a falhas.
// Identifica adequadamente os tipos de resposta:
// (a) Falha de rede / DNS
// (b) Resposta HTTP recebida, mas formato não é JSON da API (ex.: página HTML de documentação)
// (c) Erro de autenticação (HTTP 401 / 403)
// (d) Sucesso da API (HTTP 2xx com JSON)
routerAdd(
  'POST',
  '/backend/v1/tradepro/test',
  (e) => {
    // Apenas administradores podem testar a integração
    if (!e.auth || e.auth.getString('role') !== 'administrator') {
      return e.forbiddenError('Apenas administradores podem testar a integração.')
    }

    const reqBody = e.requestInfo().body || {}
    let baseUrl = typeof reqBody.base_url === 'string' ? reqBody.base_url.trim() : ''
    let apiKey = typeof reqBody.api_key === 'string' ? reqBody.api_key.trim() : ''

    // Busca o registro existente da integração TradePRO no banco (se houver)
    let integ = null
    try {
      integ = $app.findFirstRecordByFilter('integrations', "provider = 'tradepro'")
    } catch (_) {}

    // Se baseUrl ou apiKey não vieram no body da requisição, usa os valores persistidos
    if (!baseUrl && integ) {
      baseUrl = (integ.getString('base_url') || '').trim()
    }
    if (!apiKey && integ) {
      apiKey = (integ.getString('api_key') || '').trim()
    }

    if (!baseUrl || !apiKey) {
      return e.json(200, {
        ok: false,
        category: 'missing_credentials',
        message: 'URL Base da API ou Chave de API não informadas.',
        details: 'Preencha a URL Base e a Chave de API antes de testar a conexão.',
      })
    }

    // Caminho opcional de teste (ex: /status, /ping, ou vindo do config_json)
    let testPath = ''
    if (typeof reqBody.test_path === 'string' && reqBody.test_path.trim()) {
      testPath = reqBody.test_path.trim()
    } else if (integ) {
      try {
        const cfg = JSON.parse(integ.getString('config_json') || '{}')
        if (cfg && typeof cfg.test_path === 'string') {
          testPath = cfg.test_path.trim()
        }
      } catch (_) {}
    }

    const url =
      baseUrl.replace(/\/+$/, '') +
      (testPath ? (testPath.startsWith('/') ? testPath : '/' + testPath) : '')

    let res
    try {
      res = $http.send({
        url: url,
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + apiKey,
          Accept: 'application/json, text/plain, */*',
        },
        timeout: 15,
      })
    } catch (err) {
      // Atualização resiliente do status da integração existente
      if (integ) {
        try {
          integ.set('status', 'erro')
          $app.save(integ)
        } catch (_) {}
      }
      $app.logger().error('tradepro test: transport failure', 'url', url, 'error', String(err))

      return e.json(200, {
        ok: false,
        category: 'network_error',
        message: 'Falha de rede ao conectar com a TradePRO.',
        details:
          'Não foi possível estabelecer contato com o servidor (' +
          url +
          '). Verifique se o endereço está correto e se o servidor está acessível na internet. Erro: ' +
          String(err),
      })
    }

    const statusCode = res.statusCode || 0
    const contentTypeHeader =
      (res.headers && (res.headers['Content-Type'] || res.headers['content-type'])) || ''
    const contentType = Array.isArray(contentTypeHeader)
      ? contentTypeHeader.join('; ')
      : String(contentTypeHeader)

    // Extrai amostra textual do corpo da resposta
    let rawBody = ''
    let isJson = false
    try {
      if (res.json !== undefined && res.json !== null) {
        rawBody = JSON.stringify(res.json)
        isJson = true
      } else if (res.body) {
        rawBody = new TextDecoder().decode(res.body)
        try {
          JSON.parse(rawBody)
          isJson = true
        } catch (_) {
          isJson = false
        }
      }
    } catch (_) {}

    const sample = rawBody.slice(0, 300)
    const isHtml =
      contentType.toLowerCase().indexOf('text/html') !== -1 ||
      rawBody.trim().toLowerCase().startsWith('<!doctype html') ||
      rawBody.trim().toLowerCase().startsWith('<html')

    // Análise da resposta conforme as especificações:
    // (a) Erro de Autenticação (401 / 403)
    if (statusCode === 401 || statusCode === 403) {
      if (integ) {
        try {
          integ.set('status', 'erro')
          $app.save(integ)
        } catch (_) {}
      }
      $app.logger().warn('tradepro test: auth error', 'url', url, 'status', statusCode)
      return e.json(200, {
        ok: false,
        status: statusCode,
        category: 'auth_error',
        message: 'Erro de autenticação na TradePRO (HTTP ' + statusCode + ').',
        details:
          'A chave de API ou token informado foi recusado pelo servidor da TradePRO. Verifique se o token é válido ou consulte o suporte TradePRO sobre o esquema de autenticação (Bearer ou X-API-Key).',
      })
    }

    // (b) Retorno que não é uma API JSON (ex.: HTML de página ou apidocs)
    if (isHtml || (!isJson && contentType.toLowerCase().indexOf('json') === -1)) {
      if (integ) {
        try {
          integ.set('status', 'erro')
          $app.save(integ)
        } catch (_) {}
      }
      $app
        .logger()
        .info(
          'tradepro test: non-api response',
          'url',
          url,
          'contentType',
          contentType,
          'status',
          statusCode,
        )
      return e.json(200, {
        ok: false,
        status: statusCode,
        category: 'html_response',
        message:
          'Conexão estabelecida, mas o endereço não respondeu como uma API (recebido HTML/página web).',
        details:
          'A URL informada (' +
          url +
          ') parece ser uma página web ou documentação técnica (Swagger/Apidocs), e não o endpoint REST da API da TradePRO. Verifique a URL do endpoint da API com a equipe técnica da TradePRO.',
      })
    }

    // (c) HTTP 2xx com API JSON válida
    const isSuccess = statusCode >= 200 && statusCode < 300
    if (integ) {
      try {
        integ.set('status', isSuccess ? 'conectado' : 'erro')
        $app.save(integ)
      } catch (_) {}
    }

    $app
      .logger()
      .info('tradepro test: completed', 'url', url, 'status', statusCode, 'ok', isSuccess)

    if (isSuccess) {
      return e.json(200, {
        ok: true,
        status: statusCode,
        category: 'success',
        message: 'Conexão bem-sucedida! A API TradePRO respondeu normalmente.',
        details:
          'Resposta recebida em formato JSON (HTTP ' +
          statusCode +
          ').' +
          (sample ? ' Amostra: ' + sample : ''),
      })
    }

    // (d) Outros códigos de erro HTTP (ex: 404, 500)
    return e.json(200, {
      ok: false,
      status: statusCode,
      category: 'http_error',
      message: 'A API TradePRO respondeu com erro (HTTP ' + statusCode + ').',
      details:
        'O servidor TradePRO foi localizado, mas o recurso retornou código ' +
        statusCode +
        '.' +
        (sample ? ' Detalhes: ' + sample : ''),
    })
  },
  $apis.requireAuth(),
)
