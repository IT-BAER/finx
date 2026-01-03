import { QueryClient } from '@tanstack/react-query';

/**
 * React Query Client Configuration
 * 
 * Default settings optimized for financial data:
 * - staleTime: 5 minutes (financial data should be fresh but not constantly refetched)
 * - gcTime: 30 minutes (keep unused data in cache for quick returns)
 * - retry: 2 attempts with exponential backoff
 * - refetchOnWindowFocus: true (ensure data is fresh when user returns)
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Garbage collection time: 30 minutes
      gcTime: 30 * 60 * 1000,
      // Retry failed requests twice
      retry: 2,
      // Exponential backoff for retries
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Refetch on window focus to keep data fresh
      refetchOnWindowFocus: true,
      // Don't refetch on reconnect by default (PWA may reconnect often)
      refetchOnReconnect: 'always',
      // Keep previous data while fetching new data
      placeholderData: (previousData: unknown) => previousData,
    },
    mutations: {
      // Retry mutations once (be careful with mutations)
      retry: 1,
      // Error handling
      onError: (error: Error) => {
        console.error('Mutation error:', error);
      },
    },
  },
});

/**
 * Query Keys - Centralized key management for cache invalidation
 */
export const queryKeys = {
  // Transactions
  transactions: ['transactions'] as const,
  transactionsList: (filters?: Record<string, unknown>) => 
    ['transactions', 'list', filters] as const,
  transactionDetail: (id: number | string) => 
    ['transactions', 'detail', id] as const,
  
  // Categories
  categories: ['categories'] as const,
  categoriesList: () => ['categories', 'list'] as const,
  
  // Sources
  sources: ['sources'] as const,
  sourcesList: () => ['sources', 'list'] as const,
  
  // Targets
  targets: ['targets'] as const,
  targetsList: () => ['targets', 'list'] as const,
  
  // Goals
  goals: ['goals'] as const,
  goalsList: () => ['goals', 'list'] as const,
  goalDetail: (id: number | string) => ['goals', 'detail', id] as const,
  
  // Dashboard
  dashboard: ['dashboard'] as const,
  dashboardSummary: (period?: string) => ['dashboard', 'summary', period] as const,
  dashboardCharts: (period?: string) => ['dashboard', 'charts', period] as const,
  
  // Reports
  reports: ['reports'] as const,
  reportData: (type: string, filters?: Record<string, unknown>) => 
    ['reports', type, filters] as const,
  
  // User
  user: ['user'] as const,
  userProfile: () => ['user', 'profile'] as const,
  userSettings: () => ['user', 'settings'] as const,
  
  // Sharing
  sharing: ['sharing'] as const,
  sharingPermissions: () => ['sharing', 'permissions'] as const,
  sharedData: (userId: number | string) => ['sharing', 'data', userId] as const,
  
  // Recurring Transactions
  recurring: ['recurring'] as const,
  recurringList: () => ['recurring', 'list'] as const,
  
  // Admin
  admin: ['admin'] as const,
  adminUsers: () => ['admin', 'users'] as const,
  adminTaxonomy: () => ['admin', 'taxonomy'] as const,
} as const;

export default queryClient;
