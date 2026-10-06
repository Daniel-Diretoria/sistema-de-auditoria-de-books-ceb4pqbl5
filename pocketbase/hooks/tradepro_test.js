// Testa a conexão com a API TradePRO usando as credenciais cadastradas na
// collection `integrations` (provider = 'tradepro').
// Autenticação: Basic Auth ("usuario:senha" salvo no campo api_key), conforme
// o apidocs oficial (diretoria.tradepro.com.br/servicos/swagger.json).
// Testa um endpoint real (relatorio-visitas) e tenta os dois hosts conhecidos.
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
          'Preencha a URL base e a credencial (usuario:senha) na página Integrações e salve antes de testar.',
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

    // Basic Auth se a credencial é "usuario:senha"; senão, Bearer (fallback)
    const hasColon = cred.indexOf(':') >= 0
    const authHeader = hasColon ? 'Basic ' + b64enc(cred) : 'Bearer ' + cred

    // Datas AAAAMMDD (formato oficial TradePRO): ontem até hoje
    const pad2 = (n) => (n < 10 ? '0' + n : '' + n)
    const now = new Date()
    const yest = new Date(now.getTime() - 86400000)
    const dIni = '' + yest.getFullYear() + pad2(yest.getMonth() + 1) + pad2(yest.getDate())
    const dFim = '' + now.getFullYear() + pad2(now.getMonth() + 1) + pad2(now.getDate())
    const testPath = '/v1/relatorio-visitas/' + dIni + '/' + dFim

    // Hosts candidatos: o configurado + o host alternativo conhecido da TradePRO
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

    for (let i = 0; i < candidates.length; i++) {
      const url = candidates[i] + testPath
      tried.push(url)
      let res
      try {
        res = $http.send({
          url: url,
          method: 'GET',
          headers: { Authorization: authHeader, Accept: 'application/json' },
          timeout: 20,
        })
      } catch (err) {
        lastErr = String(err)
        $app.logger().error('tradepro test: transport failure', 'url', url, 'error', String(err))
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
        // Sucesso: garante base_url correta no registro e marca conectado
        try {
          integ.set('base_url', candidates[i])
          integ.set('status', 'conectado')
          $app.save(integ)
        } catch (_) {}
        $app.logger().info('tradepro test ok', 'url', url, 'status', res.statusCode)
        return e.json(200, {
          ok: true,
          status: res.statusCode,
          url: url,
          message: 'Conexão estabelecida! A API TradePRO respondeu com dados.',
          details: 'URL validada: ' + url + (sample ? ' · Resposta: ' + sample : ''),
        })
      }

      // 401 = credencial recusada; não adianta testar outro host com a mesma credencial...
      // mas testamos mesmo assim (pode ser host errado + credencial certa em outro).
      if (res.statusCode === 401) {
        $app.logger().warn('tradepro test: 401', 'url', url)
      }
    }

    // Nenhum candidato funcionou
    try {
      integ.set('status', 'erro')
      $app.save(integ)
    } catch (_) {}

    let message = 'A API TradePRO recusou a chamada.'
    let hint = ''
    if (lastStatus === 401) {
      message = 'Autenticação recusada (HTTP 401).'
      hint =
        'A credencial deve estar no formato usuario:senha (as mesmas do login do sistema TradePRO). Confira também se o acesso à API está liberado para esse usuário.'
    } else if (lastStatus === 404 || lastStatus === 405) {
      message =
        'Servidor respondeu, mas o endpoint de teste não foi encontrado (HTTP ' + lastStatus + ').'
      hint =
        'A URL base provavelmente está errada. Tente: https://cliente.tradepro.com.br/servicos ou https://diretoria.tradepro.com.br/servicos'
    } else if (lastErr) {
      message = 'Falha de rede ao contatar a API TradePRO.'
      hint = 'URLs testadas: ' + tried.join(' | ') + ' · Erro: ' + lastErr
    }

    $app.logger().warn('tradepro test failed', 'status', lastStatus, 'tried', tried.join(' | '))
    return e.json(200, {
      ok: false,
      status: lastStatus,
      message: message,
      details: hint + (lastBody ? ' · Resposta: ' + lastBody : ''),
    })
  },
  $apis.requireAuth(),
)
