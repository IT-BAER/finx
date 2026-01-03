/**
 * FinX Type Definitions
 * These types define the core data structures used throughout the application.
 */

// ============================================================================
// User Types
// ============================================================================

export interface User {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_admin: boolean;
  income_tracking_disabled: boolean;
  theme: string;
  dark_mode: boolean | null;
  language?: string;
  created_at: string;
  last_login: string | null;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
}

// ============================================================================
// Transaction Types
// ============================================================================

export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: number;
  user_id: number;
  category_id: number | null;
  source_id: number | null;
  target_id: number | null;
  amount: number;
  type: TransactionType;
  description: string | null;
  date: string; // ISO date string (YYYY-MM-DD)
  is_sample: boolean;
  recurring_transaction_id: number | null;
  
  // Joined fields
  category_name?: string;
  source_name?: string;
  target_name?: string;
  recurring_recurrence_type?: string;
  recurring_id?: number;
  
  // Offline support fields
  _tempId?: string;
  _isOffline?: boolean;
  _dataSource?: 'online' | 'local' | 'snapshot';
  
  // Permission fields
  readOnly?: boolean;
}

export interface TransactionCreateInput {
  amount: number;
  type: TransactionType;
  category?: string;
  source?: string;
  target?: string;
  description?: string;
  date?: string;
  _tempId?: string;
}

export interface TransactionUpdateInput extends Partial<TransactionCreateInput> {
  id: number;
}

// ============================================================================
// Category Types
// ============================================================================

export interface Category {
  id: number;
  user_id: number;
  name: string;
  is_sample: boolean;
}

// ============================================================================
// Source Types
// ============================================================================

export interface Source {
  id: number;
  user_id: number;
  name: string;
  is_sample: boolean;
}

// ============================================================================
// Target Types
// ============================================================================

export interface Target {
  id: number;
  user_id: number;
  name: string;
  is_sample: boolean;
}

// ============================================================================
// Goal Types
// ============================================================================

export type GoalType = 'savings' | 'expense_limit' | 'income';

export interface Goal {
  id: number;
  user_id: number;
  name: string;
  type: GoalType;
  target_amount: number;
  current_amount: number;
  start_date: string;
  end_date: string | null;
  category_id: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Recurring Transaction Types
// ============================================================================

export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurringTransaction {
  id: number;
  user_id: number;
  title: string;
  amount: number;
  type: TransactionType;
  category_id: number | null;
  source: string | null;
  target: string | null;
  description: string | null;
  recurrence_type: RecurrenceType;
  recurrence_interval: number;
  start_date: string;
  end_date: string | null;
  max_occurrences: number | null;
  occurrences_created: number;
  last_run: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Sharing Types
// ============================================================================

export type PermissionLevel = 'read' | 'read_write';

export interface SharingPermission {
  id: number;
  owner_user_id: number;
  shared_with_user_id: number;
  permission_level: PermissionLevel;
  source_filter: string | null; // JSON array of source IDs
  created_at: string;
  updated_at: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface TransactionsResponse {
  success: boolean;
  transactions: Transaction[];
}

// ============================================================================
// Dashboard Types
// ============================================================================

export interface DashboardSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  transactionCount: number;
  recentTransactions: Transaction[];
  categoryBreakdown: CategoryBreakdown[];
}

export interface CategoryBreakdown {
  category_id: number;
  category_name: string;
  total: number;
  percentage: number;
  type: TransactionType;
}

// ============================================================================
// Report Types
// ============================================================================

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  categoryIds?: number[];
  sourceIds?: number[];
  targetIds?: number[];
  type?: TransactionType;
}

export interface TrendData {
  date: string;
  income: number;
  expenses: number;
  balance: number;
}

// ============================================================================
// Theme Types
// ============================================================================

export type ThemeName = 'default' | 'calm' | 'blue' | 'fresh' | 'warm' | 'contrast';

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

// ============================================================================
// Form Types
// ============================================================================

export interface FormErrors {
  [key: string]: string | undefined;
}

export interface SelectOption {
  value: string | number;
  label: string;
}
