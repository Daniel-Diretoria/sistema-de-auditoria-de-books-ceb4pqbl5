// Reordena as fotos do book piloto Pão e Arte pelo número da loja (085 → 960),
// e dentro da mesma loja: Fachada → Antes → Depois. Fotos sem loja vão ao final.
migrate(
  (app) => {
    let book
    try {
      book = app.findFirstRecordByData('books', 'title', 'Pão e Arte — Piloto — 07/10/2026')
    } catch (_) {
      return // book não existe
    }

    const photos = app.findRecordsByFilter('book_photos', 'book = {:b}', 'created', 1000, 0, {
      b: book.id,
    })
    if (!photos.length) return

    const rows = []
    for (const p of photos) {
      let num = 99999 // sem loja vai pro final
      const sid = p.getString('identified_store')
      if (sid) {
        try {
          const store = app.findRecordById('stores', sid)
          const n = parseInt(store.getString('number'), 10)
          if (!isNaN(n)) num = n
        } catch (_) {}
      }
      const txt = p.getString('extracted_text') || ''
      let tipoOrd = 3
      if (txt.indexOf('Fachada') !== -1) tipoOrd = 0
      else if (txt.indexOf('Antes') !== -1) tipoOrd = 1
      else if (txt.indexOf('Depois') !== -1) tipoOrd = 2
      rows.push({ rec: p, num, tipoOrd, created: p.getString('created') })
    }

    rows.sort((a, b) => {
      if (a.num !== b.num) return a.num - b.num
      if (a.tipoOrd !== b.tipoOrd) return a.tipoOrd - b.tipoOrd
      return a.created > b.created ? 1 : -1
    })

    let slide = 1
    for (const r of rows) {
      r.rec.set('slide_number', slide++)
      app.save(r.rec)
    }
  },
  (app) => {
    // down: sem ação (ordenação não é destrutiva de dados)
  },
)
