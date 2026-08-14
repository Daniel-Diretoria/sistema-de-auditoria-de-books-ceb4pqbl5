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
  expand?: {
    identified_store?: Store
    corrected_store?: Store
    reviewed_by?: User
  }
  created: string
  updated: string
}
