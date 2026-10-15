// Hook temporário para aplicar redefinição de senha do admin e expor endpoint de teste/verificação
// NUNCA registra ou expõe o valor da senha em logs ou respostas.

onBootstrap((e) => {
  e.next()

  const newPass =
    $os.getenv('ADMIN_TEMP_PASSWORD') || ($secrets ? $secrets.get('ADMIN_TEMP_PASSWORD') : '')
  if (!newPass) {
    return
  }

  const email = 'suporte@diretoriapromocoes.com.br'
  let user
  try {
    user = $app.findAuthRecordByEmail('_pb_users_auth_', email)
  } catch (err) {
    $app.logger().error('admin password reset: user not found', 'email', email)
    return
  }

  try {
    if (user.validatePassword(newPass)) {
      $app.logger().info('senha do admin ja confere')
      return
    }
  } catch (_) {}

  try {
    user.setPassword(newPass)
    $app.save(user)
    $app.logger().info('senha do admin atualizada com sucesso')
  } catch (err) {
    $app.logger().error('admin password reset failed', 'error', String(err))
  }
})

// Endpoint público temporário para acionar a redefinição e testar autenticação real
routerAdd('POST', '/backend/v1/admin/apply-and-verify', (e) => {
  $app.logger().info('apply-and-verify called')
  const newPass =
    $os.getenv('ADMIN_TEMP_PASSWORD') || ($secrets ? $secrets.get('ADMIN_TEMP_PASSWORD') : '')
  if (!newPass) {
    return e.json(200, { ok: false, reason: 'ADMIN_TEMP_PASSWORD not set in env or secrets' })
  }

  const email = 'suporte@diretoriapromocoes.com.br'
  let user
  try {
    user = $app.findAuthRecordByEmail('_pb_users_auth_', email)
  } catch (err) {
    return e.json(200, { ok: false, reason: 'User not found' })
  }

  let resetApplied = false
  try {
    if (user.validatePassword(newPass)) {
      resetApplied = true
    } else {
      user.setPassword(newPass)
      $app.save(user)
      resetApplied = true
      $app.logger().info('senha do admin atualizada com sucesso')
    }
  } catch (err) {
    return e.json(200, { ok: false, reason: 'Failed saving password: ' + String(err) })
  }

  // Verifica se a autenticação confere
  let authValid = false
  try {
    const refreshed = $app.findAuthRecordByEmail('_pb_users_auth_', email)
    authValid = refreshed.validatePassword(newPass)
  } catch (err) {
    authValid = false
  }

  return e.json(200, {
    ok: true,
    resetApplied: resetApplied,
    authValid: authValid,
    user: {
      id: user.id,
      email: user.email(),
      active: user.getBool('active'),
      verified: user.verified(),
      role: user.getString('role'),
    },
  })
})
