export type UserRole = 'administrator' | 'analista_books' | 'supervisor' | 'gestor'

export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  role: UserRole
  active: boolean
  created: string
  updated: string
}

export type AuditFrequency = 'diaria' | 'seg_qua_sex' | 'ter_qui_sab' | 'seg_qua_sex_sab'

export interface Brand {
  id: string
  name: string
  logo?: string
  frequency: AuditFrequency
  stores?: string[]
  analysts?: string[]
  supervisors?: string[]
  expand?: {
    stores?: Store[]
    analysts?: User[]
    supervisors?: User[]
  }
  created: string
  updated: string
}

export type Region = 'Sul' | 'Sudeste' | 'Centro-Oeste' | 'Nordeste' | 'Norte'

export interface Store {
  id: string
  number: string
  name: string
  address: string
  network: string
  region: Region
  api_identifier?: string
  created: string
  updated: string
}

export interface SKU {
  id: string
  code: string
  name: string
  brand: string
  image?: string
  normal_price: number
  promo_price?: number
  promo_start?: string
  promo_end?: string
  main_gondola: boolean
  min_quantity: number
  requires_splash: boolean
  expand?: {
    brand?: Brand
  }
  created: string
  updated: string
}

export interface Promoter {
  id: string
  name: string
  phone?: string
  brands?: string[]
  stores?: string[]
  expand?: {
    brands?: Brand[]
    stores?: Store[]
  }
  created: string
  updated: string
}

export interface AuditRule {
  id: string
  brand: string
  title: string
  criteria?: string
  mandatory_layout?: string
  requires_splash: boolean
  min_facings: number
  expand?: {
    brand?: Brand
  }
  created: string
  updated: string
}

export const ROLE_LABELS: Record<UserRole, string> = {
  administrator: 'Administrador',
  analista_books: 'Analista de Books',
  supervisor: 'Supervisor',
  gestor: 'Gestor',
}

export const FREQUENCY_LABELS: Record<AuditFrequency, string> = {
  diaria: 'Diária',
  seg_qua_sex: 'Seg / Qua / Sex',
  ter_qui_sab: 'Ter / Qui / Sáb',
  seg_qua_sex_sab: 'Seg / Qua / Sex / Sáb',
}

export const FREQUENCY_BADGE_CLASSES: Record<AuditFrequency, string> = {
  diaria:
    'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300',
  seg_qua_sex: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
  ter_qui_sab: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
  seg_qua_sex_sab:
    'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300',
}

export const ROLE_BADGE_CLASSES: Record<UserRole, string> = {
  administrator:
    'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950 dark:text-violet-300',
  analista_books: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-300',
  supervisor: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
  gestor: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300',
}

// ---- BOOKS ----
export type BookStatus = 'processing' | 'pending_review' | 'reviewed' | 'completed'
export type PhotoReviewStatus = 'pending' | 'approved' | 'corrected'
export type StoredFrequency = 'daily' | 'seg_qua_sex' | 'ter_qui_sab' | 'seg_qua_sex_sab'

export const FREQUENCY_TO_STORED: Record<AuditFrequency, StoredFrequency> = {
  diaria: 'daily',
  seg_qua_sex: 'seg_qua_sex',
  ter_qui_sab: 'ter_qui_sab',
  seg_qua_sex_sab: 'seg_qua_sex_sab',
}

export const BOOK_STATUS_LABELS: Record<BookStatus, string> = {
  processing: 'Processando',
  pending_review: 'Revisão Pendente',
  reviewed: 'Revisado',
  completed: 'Concluído',
}

export const BOOK_STATUS_BADGE: Record<BookStatus, string> = {
  processing: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300',
  pending_review:
    'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
  reviewed:
    'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300',
  completed:
    'bg-slate-200 text-emerald-900 border-emerald-300 dark:bg-emerald-900 dark:text-emerald-200',
}

export const REVIEW_STATUS_LABELS: Record<PhotoReviewStatus, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  corrected: 'Corrigido',
}

export interface Book {
  id: string
  title: string
  brand: string
  analyst: string
  file_name: string
  file_size?: number
  audit_date: string
  audit_frequency?: StoredFrequency
  total_slides?: number
  total_photos?: number
  identified_stores?: number
  pending_review?: number
  missing_stores?: number
  status: BookStatus
  analysis_status?: AnalysisStatus
  analysis_summary?: string
  analyzed_at?: string
  missing_store_ids?: string
  expand?: {
    brand?: Brand
    analyst?: User
  }
  created: string
  updated: string
}

export interface BookPhoto {
  id: string
  book: string
  slide_number?: number
  photo_index?: number
  image_data?: string
  extracted_text?: string
  identified_store?: string
  identified_store_name?: string
  confidence?: number
  needs_review?: boolean
  review_status?: PhotoReviewStatus
  reviewed_by?: string
  review_notes?: string
  corrected_store?: string
  is_inferred?: boolean
  ambiguous_match?: boolean
  inferred_notes?: string
  expand?: {
    identified_store?: Store
    corrected_store?: Store
    reviewed_by?: User
  }
  created: string
  updated: string
}

// ---- SKU ANALYSIS ----
export type AnalysisStatus = 'pending' | 'processing' | 'completed'

export type SkuCategory =
  | 'presente_pdv'
  | 'nao_identificado'
  | 'evidencia_insuficiente'
  | 'sem_foto_secao'
  | 'sem_foto_loja'
  | 'nao_verificado'
  | 'falha_tecnica'
  | 'ruptura_justificada'
  | 'validar_ruptura_antiga'
  | 'ausente_cobrar'

export type ConfidenceLevel = 'alta' | 'media' | 'baixa'

export type RuptureType = 'total' | 'parcial' | 'zerado'

export const ANALYSIS_STATUS_LABELS: Record<AnalysisStatus, string> = {
  pending: 'Pendente',
  processing: 'Em Processamento',
  completed: 'Concluída',
}

export const ANALYSIS_STATUS_BADGE: Record<AnalysisStatus, string> = {
  pending: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300',
  processing: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300',
  completed:
    'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300',
}

export const SKU_CATEGORY_LABELS: Record<SkuCategory, string> = {
  presente_pdv: 'Presente com Evidência',
  nao_identificado: 'Não Identificado',
  evidencia_insuficiente: 'Evidência Insuficiente',
  sem_foto_secao: 'Seção não Fotografada',
  sem_foto_loja: 'Sem Foto — Loja não Auditada',
  nao_verificado: 'Não Verificado',
  falha_tecnica: 'Falha Técnica',
  ruptura_justificada: 'Ruptura Justificada',
  validar_ruptura_antiga: 'Validar Ruptura Antiga',
  ausente_cobrar: 'Ausente Comprovado — Cobrar',
}

export const SKU_CATEGORY_SHORT: Record<SkuCategory, string> = {
  presente_pdv: 'Presente',
  nao_identificado: 'Não Identif.',
  evidencia_insuficiente: 'Evid. Insuf.',
  sem_foto_secao: 'Sem Foto Seção',
  sem_foto_loja: 'Sem Foto Loja',
  nao_verificado: 'Não Verificado',
  falha_tecnica: 'Falha Técnica',
  ruptura_justificada: 'Ruptura Justif.',
  validar_ruptura_antiga: 'Validar Antiga',
  ausente_cobrar: 'Ausente — Cobrar',
}

export const SKU_CATEGORY_BADGE: Record<SkuCategory, string> = {
  presente_pdv:
    'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300',
  nao_identificado: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-300',
  evidencia_insuficiente:
    'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
  sem_foto_secao:
    'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300',
  sem_foto_loja: 'bg-zinc-200 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300',
  nao_verificado:
    'bg-neutral-100 text-neutral-700 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-300',
  falha_tecnica:
    'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300',
  ruptura_justificada:
    'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
  validar_ruptura_antiga:
    'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-300',
  ausente_cobrar: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300',
}

// ---- AUDIT DIMENSIONS ----
export type PresenceDimension =
  | 'presente_com_evidencia'
  | 'nao_identificado'
  | 'evidencia_insuficiente'
  | 'nao_verificado'
  | 'ausente_confirmado'

export type CoverageDimension =
  | 'cobertura_completa'
  | 'secao_parcial'
  | 'sem_foto_secao'
  | 'sem_foto_loja'

export type PriceDimension =
  | 'conforme'
  | 'divergente'
  | 'sem_etiqueta'
  | 'sem_splash'
  | 'nao_verificado'

export type RuptureDimension =
  | 'sem_ruptura'
  | 'ruptura_justificada'
  | 'ruptura_declarada_marca'
  | 'validar_antiga'
  | 'discrepancia_visivel_vs_declarada'

export type VisitDimension =
  | 'visita_confirmada_evidencias'
  | 'visita_confirmada_fotos_pendentes'
  | 'visita_agendada_nao_confirmada'
  | 'sem_visita_agendada'
  | 'agenda_desconhecida'

export const PRESENCE_DIMENSION_LABELS: Record<PresenceDimension, string> = {
  presente_com_evidencia: 'Presente com Evidência',
  nao_identificado: 'Não Identificado',
  evidencia_insuficiente: 'Evidência Insuficiente',
  nao_verificado: 'Não Verificado',
  ausente_confirmado: 'Ausência Confirmada',
}

export const COVERAGE_DIMENSION_LABELS: Record<CoverageDimension, string> = {
  cobertura_completa: 'Cobertura Completa',
  secao_parcial: 'Seção Parcial',
  sem_foto_secao: 'Sem Foto da Seção',
  sem_foto_loja: 'Sem Foto da Loja',
}

export const PRICE_DIMENSION_LABELS: Record<PriceDimension, string> = {
  conforme: 'Preço Conforme',
  divergente: 'Preço Divergente',
  sem_etiqueta: 'Sem Etiqueta Exposta',
  sem_splash: 'Sem Splash Promocional',
  nao_verificado: 'Preço Não Verificado',
}

export const RUPTURE_DIMENSION_LABELS: Record<RuptureDimension, string> = {
  sem_ruptura: 'Sem Ruptura Relatada',
  ruptura_justificada: 'Ruptura Justificada',
  ruptura_declarada_marca: 'Ruptura Declarada Marca (Não Prova Visual)',
  validar_antiga: 'Validar Ruptura Antiga',
  discrepancia_visivel_vs_declarada: 'Discrepância: Visível vs Declarada',
}

export const VISIT_DIMENSION_LABELS: Record<VisitDimension, string> = {
  visita_confirmada_evidencias: 'Visita Confirmada, Evidências Recebidas',
  visita_confirmada_fotos_pendentes: 'Visita Confirmada, Fotos Pendentes',
  visita_agendada_nao_confirmada: 'Visita Agendada, Conclusão Não Confirmada',
  sem_visita_agendada: 'Sem Visita Agendada',
  agenda_desconhecida: 'Agenda Desconhecida',
}

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa / Revisar',
}

export const CONFIDENCE_BADGE: Record<ConfidenceLevel, string> = {
  alta: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300',
  media: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
  baixa: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300',
}

export const RUPTURE_TYPE_LABELS: Record<RuptureType, string> = {
  total: 'Ruptura Total',
  parcial: 'Ruptura Parcial',
  zerado: 'Estoque Zerado',
}

export type RuptureScope = 'sku' | 'brand_family'

export interface RuptureReport {
  id: string
  brand: string
  store: string
  sku?: string
  report_date: string
  rupture_type: RuptureType
  days_in_rupture?: number
  scope?: RuptureScope
  brand_level_declared?: boolean
  requires_clarification?: boolean
  clarification_reason?: string
  is_inferred?: boolean
  inference_notes?: string
  expand?: {
    brand?: Brand
    store?: Store
    sku?: SKU
  }
  created: string
  updated: string
}

export interface SkuClassification {
  id: string
  book: string
  store: string
  sku: string
  category: SkuCategory
  confidence?: ConfidenceLevel
  similarity?: number
  matched_photo?: string
  reviewer?: string
  reviewed_at?: string
  notes?: string
  reason_text?: string
  evidence_photo_url?: string
  // Dimensions
  presence_dimension?: PresenceDimension
  coverage_dimension?: CoverageDimension
  price_dimension?: PriceDimension
  rupture_dimension?: RuptureDimension
  visit_dimension?: VisitDimension
  is_inferred_link?: boolean
  inferred_link_notes?: string
  discrepancy_flag?: boolean
  assortment_status?: AssortmentStatus
  // Price verification fields
  price_checked?: boolean
  price_match?: boolean | null
  price_observed?: string
  price_expected?: string
  missing_price_tag?: boolean
  missing_splash?: boolean
  expand?: {
    book?: Book
    store?: Store
    sku?: SKU
    matched_photo?: BookPhoto
    reviewer?: User
  }
  created: string
  updated: string
}

// ---- ASSORTMENT MATRIX ----
export type AssortmentStatus =
  | 'obrigatorio'
  | 'opcional'
  | 'nao_trabalhado'
  | 'aguardando_confirmacao'

export const ASSORTMENT_STATUS_LABELS: Record<AssortmentStatus, string> = {
  obrigatorio: 'Obrigatório',
  opcional: 'Opcional',
  nao_trabalhado: 'Não Trabalhado',
  aguardando_confirmacao: 'Aguardando Confirmação',
}

export const ASSORTMENT_STATUS_BADGE: Record<AssortmentStatus, string> = {
  obrigatorio:
    'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300',
  opcional: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300',
  nao_trabalhado:
    'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300',
  aguardando_confirmacao:
    'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
}

export interface PriceTable {
  id: string
  brand: string
  sku: string
  rede: string
  secao?: string
  preco: number
  vigencia?: string
  store?: string
  network?: string
  normal_price?: number
  promo_price?: number
  promo_start?: string
  promo_end?: string
  requires_splash?: boolean
  notes?: string
  expand?: {
    brand?: Brand
    sku?: SKU
    store?: Store
  }
  created: string
  updated: string
}

export interface AssortmentMatrixItem {
  id: string
  brand: string
  sku: string
  network?: string
  store?: string
  status: AssortmentStatus
  start_date?: string
  end_date?: string
  min_facings?: number
  notes?: string
  expand?: {
    brand?: Brand
    sku?: SKU
    store?: Store
  }
  created: string
  updated: string
}

// ---- VISIT SCHEDULE ----
export type VisitScheduleStatus =
  | 'sem_visita_agendada'
  | 'agenda_desconhecida'
  | 'visita_agendada_nao_confirmada'
  | 'visita_confirmada_fotos_pendentes'
  | 'visita_confirmada_evidencias'

export type VisitShift = 'manha' | 'tarde' | 'integral'
export type VisitOrigin = 'manual' | 'import_planilha' | 'api_tradepro'

export const VISIT_SCHEDULE_STATUS_LABELS: Record<VisitScheduleStatus, string> = {
  sem_visita_agendada: 'Sem visita agendada',
  agenda_desconhecida: 'Agenda desconhecida',
  visita_agendada_nao_confirmada: 'Visita agendada, conclusão não confirmada',
  visita_confirmada_fotos_pendentes: 'Visita confirmada, fotos pendentes',
  visita_confirmada_evidencias: 'Visita confirmada, evidências recebidas',
}

export const VISIT_SCHEDULE_STATUS_BADGE: Record<VisitScheduleStatus, string> = {
  sem_visita_agendada:
    'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300',
  agenda_desconhecida:
    'bg-zinc-200 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300',
  visita_agendada_nao_confirmada:
    'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
  visita_confirmada_fotos_pendentes:
    'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300',
  visita_confirmada_evidencias:
    'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300',
}

export interface VisitSchedule {
  id: string
  store: string
  visit_date: string
  promoter?: string
  brand?: string
  status: VisitScheduleStatus
  shift?: VisitShift
  origin?: VisitOrigin
  checkin_time?: string
  checkout_time?: string
  is_inferred?: boolean
  ambiguous_conflict?: boolean
  conflict_notes?: string
  notes?: string
  expand?: {
    store?: Store
    promoter?: Promoter
    brand?: Brand
  }
  created: string
  updated: string
}

// ---- STORE SCORE / PROMOTER RANKING ----
export interface StoreScore {
  storeId: string
  store?: Store
  present: number
  absent: number
  justifiedRupture: number
  penalties: number
  eligible: number
  score: number // 0..10
  classifications: SkuClassification[]
}

export interface PromoterScore {
  promoterId: string
  promoter?: Promoter
  brandNames: string[]
  storeCount: number
  avgScore: number
  trend: 'up' | 'down' | 'stable'
  storeScores: StoreScore[]
}

export const SCORE_BADGE: Record<string, string> = {
  green:
    'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300',
  yellow: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
  orange: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-300',
  red: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300',
}

export function scoreColor(score: number): 'green' | 'yellow' | 'orange' | 'red' {
  if (score >= 8) return 'green'
  if (score >= 6) return 'yellow'
  if (score >= 4) return 'orange'
  return 'red'
}

// ---- INTEGRAÇÕES ----
export type IntegrationEnvironment = 'producao' | 'homologacao'
export type IntegrationStatus = 'conectado' | 'nao_conectado' | 'erro'

export interface Integration {
  id: string
  name: string
  provider: 'tradepro' | string
  base_url?: string
  api_key?: string
  environment?: IntegrationEnvironment
  status: IntegrationStatus
  config_json?: any
  created: string
  updated: string
}
