/**
 * Barrel exports for lib utilities
 * 
 * Usage:
 * import { queryClient, queryKeys } from '@lib';
 */

// React Query client and keys
export { queryClient, queryKeys } from './queryClient';

// Chart loader
export { loadChartComponents } from './chartLoader';

// i18n
export { default as i18n } from './i18n';

// Lazy motion
export { LazyMotion, MotionConfig } from './lazyMotion';
