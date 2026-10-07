// Testa a conexão com a API TradePRO usando as credenciais cadastradas na
// collection `integrations` (provider = 'tradepro').
// Rodolfo (suporte TradePRO) confirmou: a credencial é o TOKEN gerado no
// cadastro do usuário ao ativar a API (campo "Authorization").
// Como o formato exato do header pode variar (Basic com token, Bearer, raw,
// Basic usuario:token), este teste tenta as variantes e SALVA qual funcionou
// em config_json.auth_scheme para o proxy usar.
routerAdd(
  'POST',
  '/backend/v1/tradepro/test',
  (e) => {
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

    const baseUrl = (integ.getString('base_url') || '').trim().replace(/\/+$/, '')
    const cred = (integ.getString('api_key') || '').trim()

    if (!baseUrl || !cred) {
      return e.json(200, {
        ok: false,
        message: 'URL base ou credencial vazias.',
        details:
          'Preencha a URL base (https://diretoria.tradepro.com.br/servicos) e o token da API na página Integrações e salve antes de testar.',
      })
    }

    // Codificador Base64 (btoa com fallback puro-JS)
    const b64enc = (input) => {
      try {
        return btoa(input)
      } catch (_) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
        let out = ''
        for (let i = 0; i < input.length; i += 3) {
          const b1 = input.charCodeAt(i)
          const b2 = i + 1 < input.length ? input.charCodeAt(i + 1) : 0
          const b3 = i + 2 < input.length ? input.charCodeAt(i + 2) : 0
          out += chars[b1 >> 2] + chars[((b1 & 3) << 4) | (b2 >> 4)]
          out += i + 1 < input.length ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '='
          out += i + 2 < input.length ? chars[b3 & 63] : '='
        }
        return out
      }
    }

    // Variantes de autenticação a testar, em ordem
    const variants = []
    if (cred.indexOf(':') >= 0) {
      // usuário:senha ou usuário:token
      variants.push({ scheme: 'basic_user_pass', header: 'Basic ' + b64enc(cred) })
      variants.push({ scheme: 'bearer', header: 'Bearer ' + cred })
    } else {
      // token puro gerado no cadastro do usuário
      variants.push({ scheme: 'basic_preencoded', header: 'Basic ' + cred })
      variants.push({ scheme: 'bearer', header: 'Bearer ' + cred })
      variants.push({ scheme: 'basic_token', header: 'Basic ' + b64enc(cred) })
      variants.push({ scheme: 'raw', header: cred })
    }

    // Endpoint de teste real: relatorio-visitas de ontem até hoje (datas AAAAMMDD)
    const pad2 = (n) => (n < 10 ? '0' + n : '' + n)
    const now = new Date()
    const yest = new Date(now.getTime() - 86400000)
    const dIni = '' + yest.getFullYear() + pad2(yest.getMonth() + 1) + pad2(yest.getDate())
    const dFim = '' + now.getFullYear() + pad2(now.getMonth() + 1) + pad2(now.getDate())
    const testPath = '/v1/relatorio-visitas/' + dIni + '/' + dFim

    // Hosts candidatos: o configurado + o host alternativo conhecido
    const candidates = [baseUrl]
    if (baseUrl.indexOf('cliente.tradepro.com.br') >= 0) {
      candidates.push(baseUrl.replace('cliente.tradepro.com.br', 'diretoria.tradepro.com.br'))
    } else if (baseUrl.indexOf('diretoria.tradepro.com.br') >= 0) {
      candidates.push(baseUrl.replace('diretoria.tradepro.com.br', 'cliente.tradepro.com.br'))
    }

    let lastStatus = 0
    let lastBody = ''
    let lastErr = ''
    let tried = []

    for (let c = 0; c < candidates.length; c++) {
      for (let v = 0; v < variants.length; v++) {
        const url = candidates[c] + testPath
        const header = variants[v].header
        tried.push(url + ' [' + variants[v].scheme + ']')

        let res
        try {
          res = $http.send({
            url: url,
            method: 'GET',
            headers: { Authorization: header, Accept: 'application/json' },
            timeout: 20,
          })
        } catch (err) {
          lastErr = String(err)
          continue
        }

        lastStatus = res.statusCode
        let sample = ''
        try {
          if (res.json !== undefined && res.json !== null)
            sample = JSON.stringify(res.json).slice(0, 400)
          else sample = new TextDecoder().decode(res.body).slice(0, 400)
        } catch (_) {}
        lastBody = sample

        if (res.statusCode >= 200 && res.statusCode < 300) {
          // Sucesso: persiste URL correta, status conectado e o esquema que funcionou
          try {
            integ.set('base_url', candidates[c])
            integ.set('status', 'conectado')
            let cfg = {}
            try {
              cfg = JSON.parse(integ.getString('config_json') || '{}') || {}
            } catch (_) {}
            cfg.auth_scheme = variants[v].scheme
            integ.set('config_json', JSON.stringify(cfg))
            $app.save(integ)
          } catch (_) {}
          $app
            .logger()
            .info(
              'tradepro test ok',
              'url',
              url,
              'scheme',
              variants[v].scheme,
              'status',
              res.statusCode,
            )
          return e.json(200, {
            ok: true,
            status: res.statusCode,
            url: url,
            scheme: variants[v].scheme,
            message:
              'Conexão estabelecida! Autenticação funcionou no formato "' +
              variants[v].scheme +
              '".',
            details: 'URL validada: ' + url + (sample ? ' · Resposta: ' + sample : ''),
          })
        }
      }
    }

    // Nada funcionou
    try {
      integ.set('status', 'erro')
      $app.save(integ)
    } catch (_) {}

    let message = 'A API TradePRO recusou todas as tentativas de autenticação.'
    let hint = ''
    if (lastStatus === 401) {
      message = 'Token recusado (HTTP 401 em todas as variantes).'
      hint =
        'Confira se copiou o token COMPLETO do campo "Authorization" no cadastro do usuário TradePRO (Status API = Ativo). Se copiou do print do WhatsApp, o valor pode ter vindo cortado — copie direto da tela do sistema deles.'
    } else if (lastStatus === 404 || lastStatus === 405) {
      message =
        'Servidor respondeu, mas o endpoint de teste não foi encontrado (HTTP ' + lastStatus + ').'
      hint = 'A URL base deve ser https://diretoria.tradepro.com.br/servicos'
    } else if (lastErr) {
      message = 'Falha de rede ao contatar a API TradePRO.'
      hint = 'Erro: ' + lastErr
    }

    $app.logger().warn('tradepro test failed', 'status', lastStatus, 'tried', tried.join(' | '))
    return e.json(200, {
      ok: false,
      status: lastStatus,
      message: message,
      details: hint + (lastBody ? ' · Última resposta: ' + lastBody : ''),
    })
  },
  $apis.requireAuth(),
)
