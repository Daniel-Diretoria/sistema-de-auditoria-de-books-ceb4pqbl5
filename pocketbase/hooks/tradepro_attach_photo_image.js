// Baixa a imagem de uma book_photo a partir da URL TradePRO gravada no
// extracted_text e anexa ao campo image_data. Dispara somente para fotos que
// venham da sincronização TradePRO (extracted_text com 'TradePRO foto').
onRecordAfterCreateSuccess((e) => {
  const rec = e.record
  const text = rec.getString('extracted_text') || ''
  if (text.indexOf('TradePRO foto') === -1) {
    return e.next()
  }
  // imagem já anexada? (também pode ter vindo de atualização)
  if (rec.getString('image_data')) {
    return e.next()
  }

  // Extrai a URL: padrão ' | https://...'
  const m = text.match(/https:\/\/[^\s|]+/)
  if (!m) {
    return e.next()
  }
  const url = m[0]

  try {
    const file = $filesystem.fileFromURL(url, 60)
    const updated = $app.findRecordById('book_photos', rec.id)
    updated.set('image_data', file)
    $app.save(updated)
  } catch (err) {
    $app.logger().warn('tradepro attach photo failed', 'photo', rec.id, 'error', String(err))
  }
  return e.next()
}, 'book_photos')
