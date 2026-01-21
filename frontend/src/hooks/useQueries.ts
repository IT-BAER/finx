/**
 * React Query Hooks for FinX
 * 
 * Custom hooks that wrap React Query for data fetching with offline support.
 * These hooks integrate with the existing offlineAPI service and goalAPI.
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import offlineAPI from '../services/offlineAPI';
import { 
  goalAPI, 
  transactionAPI, 
  sharingAPI, 
  recurringTransactionAPI,
  authAPI,
  userAPI,
} from '../services/api';
import type { 
  Transaction, 
  Category, 
  Source, 
  Target, 
  Goal, 
  RecurringTransaction,
  User,
  DashboardSummary,
  SharingPermission 
} from '../types';

// ============================================
// Categories
// ============================================

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categoriesList(),
    queryFn: async () => {
      const response = await offlineAPI.getCategories();
      return response as Category[];
    },
    staleTime: 10 * 60 * 1000, // Categories don't change often
  });
}

// ============================================
// Sources
// ============================================

export function useSources() {
  return useQuery({
    queryKey: queryKeys.sourcesList(),
    queryFn: async () => {
      const response = await offlineAPI.getSources();
      return response as Source[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

// ============================================
// Targets
// ============================================

export function useTargets() {
  return useQuery({
    queryKey: queryKeys.targetsList(),
    queryFn: async () => {
      const response = await offlineAPI.getTargets();
      return response as Target[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

// ============================================
// Transactions
// ============================================

interface TransactionFilters {
  startDate?: string;
  endDate?: string;
  category?: string;
  source?: string;
  type?: 'income' | 'expense';
  searchQuery?: string;
  limit?: number;
  offset?: number;
  [key: string]: unknown; // Allow index signature for Record<string, unknown> compatibility
}

export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: queryKeys.transactionsList(filters as Record<string, unknown>),
    queryFn: async () => {
      const response = await offlineAPI.getTransactions(filters);
      return response as { transactions: Transaction[]; hasMore: boolean; total: number };
    },
    staleTime: 2 * 60 * 1000, // Transactions change more often
  });
}

export function useTransaction(id: number | string) {
  return useQuery({
    queryKey: queryKeys.transactionDetail(id),
    queryFn: async () => {
      const response = await offlineAPI.getTransactionById(id);
      return response as Transaction;
    },
    enabled: !!id,
  });
}

export function useInfiniteTransactions(filters: Omit<TransactionFilters, 'offset'> = {}) {
  const limit = filters.limit || 50;
  
  return useInfiniteQuery({
    queryKey: queryKeys.transactionsList({ ...filters, infinite: true }),
    queryFn: async ({ pageParam = 0 }) => {
      // Use getAllTransactions with pageOnly for proper offline merge
      const response = await offlineAPI.getAllTransactions({
        ...filters,
        offset: pageParam,
        limit,
        pageOnly: true,
      });
      
      // getAllTransactions with pageOnly returns an array directly
      const transactions = Array.isArray(response) ? response : [];
      
      // Count only online transactions to determine if there are more pages
      const onlineCount = transactions.filter((tx: Transaction) => tx._dataSource !== 'local').length;
      const hasMore = onlineCount === limit;
      
      return { 
        transactions, 
        hasMore,
        onlineCount,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      // Calculate offset based on online items only (local items are merged on first page)
      return allPages.reduce((acc, page) => acc + (page.onlineCount || 0), 0);
    },
  });
}

// Mutation hooks for transactions
export function useCreateTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Partial<Transaction>) => {
      return await offlineAPI.createTransaction(data);
    },
    onSuccess: () => {
      // Invalidate all transaction-related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.reports });
      queryClient.invalidateQueries({ queryKey: queryKeys.goals });
      // Also dispatch custom event for components that still use event-based refresh
      window.dispatchEvent(new CustomEvent('transactionAdded'));
      window.dispatchEvent(new CustomEvent('dataRefreshNeeded'));
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: number | string; data: Partial<Transaction> }) => {
      return await offlineAPI.updateTransaction(id, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactionDetail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.reports });
      queryClient.invalidateQueries({ queryKey: queryKeys.goals });
      // Also dispatch custom event for components that still use event-based refresh
      window.dispatchEvent(new CustomEvent('transactionUpdated'));
      window.dispatchEvent(new CustomEvent('dataRefreshNeeded'));
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number | string) => {
      return await offlineAPI.deleteTransaction(id);
    },
    onSuccess: (_data, id) => {
      // Invalidate all transaction-related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.reports });
      queryClient.invalidateQueries({ queryKey: queryKeys.goals });
      // Dispatch custom event with the deleted ID for optimistic UI updates
      window.dispatchEvent(new CustomEvent('transactionDeleted', { detail: { id } }));
      window.dispatchEvent(new CustomEvent('dataRefreshNeeded'));
    },
  });
}

// ============================================
// Goals
// ============================================

interface GoalFilters {
  includeCompleted?: boolean;
}

export function useGoals(filters: GoalFilters = {}) {
  const { includeCompleted = true } = filters;
  return useQuery({
    queryKey: [...queryKeys.goalsList(), { includeCompleted }],
    queryFn: async () => {
      const response = await goalAPI.getAll(includeCompleted);
      return (response.data.goals || []) as Goal[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useGoalsSummary() {
  return useQuery({
    queryKey: [...queryKeys.goals, 'summary'],
    queryFn: async () => {
      const response = await goalAPI.getSummary();
      return response.data.summary;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useGoal(id: number | string) {
  return useQuery({
    queryKey: queryKeys.goalDetail(id),
    queryFn: async () => {
      const response = await goalAPI.getById(id);
      return response.data.goal as Goal;
    },
    enabled: !!id,
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Partial<Goal>) => {
      const response = await goalAPI.create(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals });
    },
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: number | string; data: Partial<Goal> }) => {
      const response = await goalAPI.update(id, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals });
      queryClient.invalidateQueries({ queryKey: queryKeys.goalDetail(variables.id) });
    },
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number | string) => {
      const response = await goalAPI.delete(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals });
    },
  });
}

export function useAddGoalContribution() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ goalId, data }: { goalId: number | string; data: { amount: number; note?: string } }) => {
      const response = await goalAPI.addContribution(goalId, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals });
    },
  });
}

// ============================================
// Dashboard
// ============================================

interface DashboardFilters {
  period?: string;
  startDate?: string;
  endDate?: string;
}

export function useDashboardSummary(filters: DashboardFilters = {}) {
  return useQuery({
    queryKey: queryKeys.dashboardSummary(filters.period),
    queryFn: async () => {
      const response = await transactionAPI.getDashboardData(filters);
      return response.data as DashboardSummary;
    },
    staleTime: 2 * 60 * 1000,
  });
}

// ============================================
// User Profile
// ============================================

export function useUserProfile() {
  return useQuery({
    queryKey: queryKeys.userProfile(),
    queryFn: async () => {
      const response = await authAPI.getCurrentUser();
      return response.data as User;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Partial<User>) => {
      return await authAPI.updateUser(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
    },
  });
}

// ============================================
// Sharing
// ============================================

export function useSharingPermissions() {
  return useQuery({
    queryKey: queryKeys.sharingPermissions(),
    queryFn: async () => {
      const response = await sharingAPI.getMyPermissions();
      return (response.data || []) as SharingPermission[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSharedWithMe() {
  return useQuery({
    queryKey: ['sharing', 'shared-with-me'],
    queryFn: async () => {
      const response = await sharingAPI.getSharedWithMe();
      return (response.data || []) as SharingPermission[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSharingUsers() {
  return useQuery({
    queryKey: ['sharing', 'users'],
    queryFn: async () => {
      const response = await sharingAPI.getAllUsers();
      return (response.data || []) as User[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSharingSources() {
  return useQuery({
    queryKey: ['sharing', 'sources'],
    queryFn: async () => {
      const response = await sharingAPI.getUserSources();
      return (response.data || []) as Source[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateSharingPermission() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { user_id: number; permission_level: string; source_filter?: string }) => {
      return await sharingAPI.createPermission(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sharing });
      queryClient.invalidateQueries({ queryKey: ['sharing'] });
    },
  });
}

export function useUpdateSharingPermission() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<SharingPermission> }) => {
      return await sharingAPI.updatePermission(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sharing });
      queryClient.invalidateQueries({ queryKey: ['sharing'] });
    },
  });
}

export function useDeleteSharingPermission() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      return await sharingAPI.deletePermission(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sharing });
      queryClient.invalidateQueries({ queryKey: ['sharing'] });
    },
  });
}

// ============================================
// Recurring Transactions
// ============================================

export function useRecurringTransactions() {
  return useQuery({
    queryKey: queryKeys.recurringList(),
    queryFn: async () => {
      const response = await recurringTransactionAPI.getAll();
      return (response.data?.transactions || []) as RecurringTransaction[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateRecurringTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Partial<RecurringTransaction>) => {
      return await recurringTransactionAPI.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recurring });
    },
  });
}

export function useUpdateRecurringTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: number | string; data: Partial<RecurringTransaction> }) => {
      return await recurringTransactionAPI.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recurring });
    },
  });
}

export function useDeleteRecurringTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number | string) => {
      return await recurringTransactionAPI.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recurring });
    },
  });
}

// ============================================
// Utility Hooks
// ============================================

/**
 * Hook to get loading state across multiple queries
 */
export function useIsDataLoading(queryKeys: readonly unknown[][]) {
  const queryClient = useQueryClient();
  return queryKeys.some(key => 
    queryClient.getQueryState(key)?.status === 'pending'
  );
}

/**
 * Hook to prefetch data for performance
 */
export function usePrefetchDataQueries() {
  const queryClient = useQueryClient();
  
  return {
    prefetchCategories: () => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.categoriesList(),
        queryFn: () => offlineAPI.getCategories(),
      });
    },
    prefetchSources: () => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.sourcesList(),
        queryFn: () => offlineAPI.getSources(),
      });
    },
    prefetchTargets: () => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.targetsList(),
        queryFn: () => offlineAPI.getTargets(),
      });
    },
    prefetchGoals: async () => {
      const response = await goalAPI.getAll(true);
      queryClient.setQueryData(queryKeys.goalsList(), response.data.goals || []);
    },
  };
}

// ============================================
// Admin User Management
// ============================================

interface AdminUser {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  is_admin: boolean;
  created_at?: string;
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const response = await userAPI.getAllUsers();
      return (response.data?.data || []) as AdminUser[];
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useCreateAdminUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Omit<AdminUser, 'id' | 'created_at'> & { password: string }) => {
      return await userAPI.createUser(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<AdminUser> }) => {
      return await userAPI.updateUser(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useDeleteAdminUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      return await userAPI.deleteUser(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}