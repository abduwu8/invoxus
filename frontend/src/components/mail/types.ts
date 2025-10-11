// User and Profile Types
export type UserProfile = {
  id: string
  email: string
  name?: string
  picture?: string
}

// Email Types
export type Email = {
  id: string
  threadId: string
  from: string
  to: string
  subject: string
  snippet: string
  date: string
  body?: string
  read: boolean
  starred?: boolean
  labels?: string[]
  category?: string
  archived?: boolean
  deleted?: boolean
  attachments?: Array<{
    filename: string
    mimeType: string
    size: number
    attachmentId: string
  }>
}

// Chat Types
export type ChatMessage = {
  role: 'user' | 'assistant'
  text: string
}

export type PendingSend = {
  toEmail: string
  subject: string
  body: string
}

// Cold Email Types
export type ColdEmailPayload = {
  to: string
  skills: string
  role?: string
  company?: string
  industry?: string
  jobTitle?: string
  projects?: string
  education?: string
  portfolioLinks?: string
  fitSummary?: string
  ctaPreference?: string
  tone?: 'professional' | 'tldr' | 'casual' | 'formal' | 'enthusiastic' | 'confident'
  experienceLevel?: 'fresher' | 'intern'
  availability?: string
  location?: string
  lowCost?: boolean
  resumeFile?: File
  paymentId?: string
}

// Usage Types
export type Usage = {
  remainingFreeGenerations: number
  totalGenerations: number
  lastResetDate?: string
}

// View Types
export type ViewType = 'inbox' | 'sent' | 'starred' | 'archive' | 'trash'

// Filter and Sort Types
export type SortOption = 'date' | 'sender' | 'subject'
export type SortOrder = 'asc' | 'desc'
