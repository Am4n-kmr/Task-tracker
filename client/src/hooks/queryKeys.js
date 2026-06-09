/**
 * Centralized React Query keys.
 * Centralizing prevents string-typo bugs and makes it trivial
 * to invalidate precisely the queries that need it.
 */
export const queryKeys = {
  tasks: (search) => ['tasks', search ?? null],
  dashboard: () => ['dashboard'],
  dashboardHistory: (days) => ['dashboardHistory', days],
  heatmap: () => ['heatmap'],
  analytics: (year, month) => ['analytics', year, month],
  monthly: (year, month) => ['monthly', year, month],
};

export default queryKeys;
