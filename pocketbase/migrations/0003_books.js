migrate(
  (app) => {
    const brandsCol = app.findCollectionByNameOrId('brands').id
    const usersCol = '_pb_users_auth_'
    const storesCol = app.findCollectionByNameOrId('stores').id

    // ---- books ----
    const books = new Collection({
      name: 'books',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.role = 'administrator' || @request.auth.role = 'analista_books'",
      updateRule:
        "@request.auth.role = 'administrator' || (@request.auth.role = 'analista_books' && analyst = @request.auth.id)",
      deleteRule:
        "@request.auth.role = 'administrator' || (@request.auth.role = 'analista_books' && analyst = @request.auth.id)",
      fields: [
        { name: 'title', type: 'text', required: true },
        {
          name: 'brand',
          type: 'relation',
          required: true,
          collectionId: brandsCol,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'analyst',
          type: 'relation',
          required: true,
          collectionId: usersCol,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'file_name', type: 'text', required: true },
        { name: 'file_size', type: 'number', required: false, onlyInt: true },
        { name: 'audit_date', type: 'date', required: true },
        {
          name: 'audit_frequency',
          type: 'select',
          required: false,
          values: ['daily', 'seg_qua_sex', 'ter_qui_sab', 'seg_qua_sex_sab'],
        },
        { name: 'total_slides', type: 'number', required: false, onlyInt: true },
        { name: 'total_photos', type: 'number', required: false, onlyInt: true },
        { name: 'identified_stores', type: 'number', required: false, onlyInt: true },
        { name: 'pending_review', type: 'number', required: false, onlyInt: true },
        { name: 'missing_stores', type: 'number', required: false, onlyInt: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['processing', 'pending_review', 'reviewed', 'completed'],
        },
        { name: 'missing_store_ids', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_books_brand ON books (brand)',
        'CREATE INDEX idx_books_analyst ON books (analyst)',
        'CREATE INDEX idx_books_status ON books (status)',
        'CREATE INDEX idx_books_created ON books (created DESC)',
      ],
    })
    app.save(books)

    const booksCol = app.findCollectionByNameOrId('books').id

    // ---- book_photos ----
    const bookPhotos = new Collection({
      name: 'book_photos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.role = 'administrator' || @request.auth.role = 'analista_books'",
      updateRule:
        "@request.auth.role = 'administrator' || (@request.auth.role = 'analista_books' && book.analyst = @request.auth.id)",
      deleteRule:
        "@request.auth.role = 'administrator' || (@request.auth.role = 'analista_books' && book.analyst = @request.auth.id)",
      fields: [
        {
          name: 'book',
          type: 'relation',
          required: true,
          collectionId: booksCol,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'slide_number', type: 'number', required: false, onlyInt: true },
        { name: 'photo_index', type: 'number', required: false, onlyInt: true },
        {
          name: 'image_data',
          type: 'file',
          required: false,
          maxSelect: 1,
          maxSize: 10485760,
          mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        },
        { name: 'extracted_text', type: 'text', required: false },
        {
          name: 'identified_store',
          type: 'relation',
          required: false,
          collectionId: storesCol,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'identified_store_name', type: 'text', required: false },
        { name: 'confidence', type: 'number', required: false, min: 0, max: 1 },
        { name: 'needs_review', type: 'bool', required: false },
        {
          name: 'review_status',
          type: 'select',
          required: false,
          values: ['pending', 'approved', 'corrected'],
        },
        {
          name: 'reviewed_by',
          type: 'relation',
          required: false,
          collectionId: usersCol,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'review_notes', type: 'text', required: false },
        {
          name: 'corrected_store',
          type: 'relation',
          required: false,
          collectionId: storesCol,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_book_photos_book ON book_photos (book)',
        'CREATE INDEX idx_book_photos_store ON book_photos (identified_store)',
        'CREATE INDEX idx_book_photos_review ON book_photos (needs_review)',
      ],
    })
    app.save(bookPhotos)
  },
  (app) => {
    try {
      const bp = app.findCollectionByNameOrId('book_photos')
      app.delete(bp)
    } catch (_) {}
    try {
      const b = app.findCollectionByNameOrId('books')
      app.delete(b)
    } catch (_) {}
  },
)
