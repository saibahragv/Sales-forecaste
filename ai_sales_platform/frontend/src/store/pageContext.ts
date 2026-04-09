import { create } from 'zustand'

// Global page context store — ARIA reads this to understand what the user is seeing
export type PageContextState = {
  currentPage: string
  pageData: Record<string, unknown>
  setCurrentPage: (page: string) => void
  setPageData: (data: Record<string, unknown>) => void
  updatePageData: (partial: Record<string, unknown>) => void
}

export const usePageContext = create<PageContextState>()((set) => ({
  currentPage: 'overview',
  pageData: {},
  setCurrentPage: (page) => set({ currentPage: page }),
  setPageData: (data) => set({ pageData: data }),
  updatePageData: (partial) => set((s) => ({ pageData: { ...s.pageData, ...partial } })),
}))
