// Proxy genérico para a API privada da TradePRO.
// O frontend chama /backend/v1/tradepro/proxy?path=/recurso&method=GET
// e o backend repassa a chamada com o token cadastrado na collection `integrations`.
// Evita CORS e mantém a chave fora do navegador.
routerAdd(
  'POST',
  '/backend/v1/tradepro/proxy',
  (e) => {
    if (!e.auth || e.auth.getString('role') !== 'administrator') {
      return e.forbiddenError('Apenas administradores podem consultar a API TradePRO.')
    }

    const body = e.requestInfo().body || {}
    const path = String(body.path || '').trim()
    const method = String(body.method || 'GET').toUpperCase()
    const query = body.query || {}
    const payload = body.body

    if (!path) {
      return e.badRequestError('Informe o campo "path" do endpoint TradePRO (ex.: "/visitas").')
    }
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return e.badRequestError(
        'Informe apenas o caminho do endpoint (ex.: "/visitas"), não a URL completa.',
      )
    }
    const allowed = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    if (allowed.indexOf(method) === -1) {
      return e.badRequestError('Método HTTP não suportado: ' + method)
    }

    let integ
    try {
      integ = $app.findFirstRecordByFilter('integrations', "provider = 'tradepro'")
    } catch (_) {
      return e.json(200, {
        ok: false,
        message: 'Integração TradePRO não configurada. Salve URL e chave na página Integrações.',
      })
    }

    const baseUrl = (integ.getString('base_url') || '').trim()
    const apiKey = (integ.getString('api_key') || '').trim()
    if (!baseUrl || !apiKey) {
      return e.json(200, {
        ok: false,
        message: 'URL base ou chave de API vazias na integração TradePRO.',
      })
    }

    let qs = ''
    try {
      const parts = []
      for (const k in query) {
        if (Object.prototype.hasOwnProperty.call(query, k)) {
          parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(query[k])))
        }
      }
      if (parts.length > 0) qs = '?' + parts.join('&')
    } catch (_) {}

    const url = baseUrl.replace(/\/+$/, '') + (path.startsWith('/') ? path : '/' + path) + qs

    const headers = {
      Authorization: 'Bearer ' + apiKey,
      Accept: 'application/json',
    }
    let bodyStr = ''
    if (payload !== undefined && payload !== null && method !== 'GET') {
      headers['Content-Type'] = 'application/json'
      bodyStr = JSON.stringify(payload)
    }

    let res
    try {
      res = $http.send({
        url: url,
        method: method,
        headers: headers,
        body: bodyStr,
        timeout: 30,
      })
    } catch (err) {
      $app.logger().error('tradepro proxy: transport failure', 'url', url, 'error', String(err))
      return e.json(502, {
        ok: false,
        message: 'Falha de rede ao contatar a API TradePRO.',
        details: String(err),
      })
    }

    // Repassa a resposta da TradePRO como está (com metadados de status)
    let data = null
    let raw = ''
    try {
      if (res.json !== undefined && res.json !== null) {
        data = res.json
        raw = JSON.stringify(res.json)
      } else {
        raw = new TextDecoder().decode(res.body)
        try {
          data = JSON.parse(raw)
        } catch (_) {
          data = null
        }
      }
    } catch (_) {}

    $app.logger().info('tradepro proxy', 'method', method, 'url', url, 'status', res.statusCode)

    return e.json(200, {
      ok: res.statusCode >= 200 && res.statusCode < 300,
      status: res.statusCode,
      url: url,
      data: data,
      raw: raw.slice(0, 20000),
    })
  },
  $apis.requireAuth(),
)
