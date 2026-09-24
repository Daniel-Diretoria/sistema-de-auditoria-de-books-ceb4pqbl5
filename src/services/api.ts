import pb from '@/lib/pocketbase/client'
import {
  Brand,
  Store,
  SKU,
  Promoter,
  AuditRule,
  User,
  Book,
  BookPhoto,
  SkuClassification,
  RuptureReport,
  Integration,
} from '@/types'

// Helper for file URLs
export function getFileUrl(
  record: { collectionId?: string; collectionName?: string; id: string },
  filename: string | undefined,
): string | null {
  if (!filename) return null
  return pb.files.getUrl(record, filename)
}

// Formatters
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)
}

export function formatDate(dateString: string | undefined): string {
  if (!dateString) return '—'
  try {
    const d = new Date(dateString)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('pt-BR')
  } catch (_) {
    return '—'
  }
}

// MARCAS (BRANDS)
export async function getBrands(filter?: string): Promise<Brand[]> {
  const records = await pb.collection('brands').getFullList<Brand>({
    filter,
    sort: 'name',
    expand: 'stores,analysts,supervisors',
  })
  return records
}

export async function getBrandById(id: string): Promise<Brand> {
  return await pb.collection('brands').getOne<Brand>(id, {
    expand: 'stores,analysts,supervisors',
  })
}

export async function createBrand(data: FormData | Partial<Brand>): Promise<Brand> {
  return await pb.collection('brands').create<Brand>(data)
}

export async function updateBrand(id: string, data: FormData | Partial<Brand>): Promise<Brand> {
  return await pb.collection('brands').update<Brand>(id, data)
}

export async function deleteBrand(id: string): Promise<boolean> {
  return await pb.collection('brands').delete(id)
}

// LOJAS (STORES)
export async function getStores(
  filter?: string,
  page = 1,
  perPage = 50,
): Promise<{ items: Store[]; totalItems: number; totalPages: number }> {
  const result = await pb.collection('stores').getList<Store>(page, perPage, {
    filter,
    sort: 'number',
  })
  return { items: result.items, totalItems: result.totalItems, totalPages: result.totalPages }
}

export async function getAllStores(): Promise<Store[]> {
  return await pb.collection('stores').getFullList<Store>({
    sort: 'number',
  })
}

export async function createStore(data: Partial<Store>): Promise<Store> {
  return await pb.collection('stores').create<Store>(data)
}

export async function updateStore(id: string, data: Partial<Store>): Promise<Store> {
  return await pb.collection('stores').update<Store>(id, data)
}

export async function deleteStore(id: string): Promise<boolean> {
  return await pb.collection('stores').delete(id)
}

// SKUS
export async function getSKUs(filter?: string): Promise<SKU[]> {
  return await pb.collection('skus').getFullList<SKU>({
    filter,
    sort: 'name',
    expand: 'brand',
  })
}

export async function createSKU(data: FormData | Partial<SKU>): Promise<SKU> {
  return await pb.collection('skus').create<SKU>(data)
}

export async function updateSKU(id: string, data: FormData | Partial<SKU>): Promise<SKU> {
  return await pb.collection('skus').update<SKU>(id, data)
}

export async function deleteSKU(id: string): Promise<boolean> {
  return await pb.collection('skus').delete(id)
}

// PROMOTORES (PROMOTERS)
export async function getPromoters(filter?: string): Promise<Promoter[]> {
  return await pb.collection('promoters').getFullList<Promoter>({
    filter,
    sort: 'name',
    expand: 'brands,stores',
  })
}

export async function createPromoter(data: Partial<Promoter>): Promise<Promoter> {
  return await pb.collection('promoters').create<Promoter>(data)
}

export async function updatePromoter(id: string, data: Partial<Promoter>): Promise<Promoter> {
  return await pb.collection('promoters').update<Promoter>(id, data)
}

export async function deletePromoter(id: string): Promise<boolean> {
  return await pb.collection('promoters').delete(id)
}

// REGRAS DE AUDITORIA (AUDIT RULES)
export async function getAuditRules(filter?: string): Promise<AuditRule[]> {
  return await pb.collection('audit_rules').getFullList<AuditRule>({
    filter,
    sort: 'title',
    expand: 'brand',
  })
}

export async function createAuditRule(data: Partial<AuditRule>): Promise<AuditRule> {
  return await pb.collection('audit_rules').create<AuditRule>(data)
}

export async function updateAuditRule(id: string, data: Partial<AuditRule>): Promise<AuditRule> {
  return await pb.collection('audit_rules').update<AuditRule>(id, data)
}

export async function deleteAuditRule(id: string): Promise<boolean> {
  return await pb.collection('audit_rules').delete(id)
}

// USERS (Admin Only)
export async function getUsers(): Promise<User[]> {
  return await pb.collection('users').getFullList<User>({
    sort: 'name',
  })
}

export async function createUser(data: Record<string, any>): Promise<User> {
  return await pb.collection('users').create<User>(data)
}

export async function updateUser(id: string, data: Record<string, any>): Promise<User> {
  return await pb.collection('users').update<User>(id, data)
}

export async function deleteUser(id: string): Promise<boolean> {
  return await pb.collection('users').delete(id)
}

// BOOKS
export async function getBooks(filter?: string): Promise<Book[]> {
  return await pb.collection('books').getFullList<Book>({
    filter,
    sort: '-created',
    expand: 'brand,analyst',
  })
}

export async function getBookById(id: string): Promise<Book> {
  return await pb.collection('books').getOne<Book>(id, {
    expand: 'brand,analyst',
  })
}

export async function createBook(data: FormData | Partial<Book>): Promise<Book> {
  return await pb.collection('books').create<Book>(data)
}

export async function updateBook(id: string, data: FormData | Partial<Book>): Promise<Book> {
  return await pb.collection('books').update<Book>(id, data)
}

export async function deleteBook(id: string): Promise<boolean> {
  return await pb.collection('books').delete(id)
}

// BOOK PHOTOS
export async function getBookPhotos(bookId: string): Promise<BookPhoto[]> {
  return await pb.collection('book_photos').getFullList<BookPhoto>({
    filter: `book = "${bookId}"`,
    sort: 'slide_number,photo_index',
    expand: 'identified_store,corrected_store,reviewed_by',
  })
}

export async function createBookPhoto(data: FormData | Partial<BookPhoto>): Promise<BookPhoto> {
  return await pb.collection('book_photos').create<BookPhoto>(data)
}

export async function updateBookPhoto(
  id: string,
  data: FormData | Partial<BookPhoto>,
): Promise<BookPhoto> {
  return await pb.collection('book_photos').update<BookPhoto>(id, data)
}

export async function deleteBookPhoto(id: string): Promise<boolean> {
  return await pb.collection('book_photos').delete(id)
}

// SKU CLASSIFICATIONS
export async function getSkuClassifications(bookId: string): Promise<SkuClassification[]> {
  return await pb.collection('sku_classifications').getFullList<SkuClassification>({
    filter: `book = "${bookId}"`,
    sort: 'store,sku',
    expand: 'store,sku,matched_photo,reviewer',
  })
}

export async function updateSkuClassification(
  id: string,
  data: FormData | Partial<SkuClassification>,
): Promise<SkuClassification> {
  return await pb.collection('sku_classifications').update<SkuClassification>(id, data)
}

// RUPTURE REPORTS
export async function getRuptureReports(filter?: string): Promise<RuptureReport[]> {
  return await pb.collection('rupture_reports').getFullList<RuptureReport>({
    filter,
    sort: '-report_date',
    expand: 'brand,store,sku',
  })
}

export async function createRuptureReport(
  data: FormData | Partial<RuptureReport>,
): Promise<RuptureReport> {
  return await pb.collection('rupture_reports').create<RuptureReport>(data)
}

export async function deleteRuptureReport(id: string): Promise<boolean> {
  return await pb.collection('rupture_reports').delete(id)
}

// INTEGRAÇÕES (INTEGRATIONS)
export async function getIntegrations(): Promise<Integration[]> {
  return await pb.collection('integrations').getFullList<Integration>({
    sort: 'name',
  })
}

export async function getIntegrationByProvider(provider: string): Promise<Integration | null> {
  try {
    return await pb
      .collection('integrations')
      .getFirstListItem<Integration>(`provider = "${provider}"`)
  } catch (_) {
    return null
  }
}

export async function saveIntegration(
  data: Partial<Integration> & { provider: string; name: string },
): Promise<Integration> {
  const existing = await getIntegrationByProvider(data.provider)
  if (existing) {
    return await pb.collection('integrations').update<Integration>(existing.id, data)
  }
  return await pb.collection('integrations').create<Integration>(data)
}
