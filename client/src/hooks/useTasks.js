import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksAPI } from '../services/api';
import toast from 'react-hot-toast';
import { queryKeys } from './queryKeys';

/* ──────────────────────────────────────────────────────────────────────────
 * useTasks()
 * Owns the canonical cache for the user's task list and exposes
 * a fully optimistic toggle/create/update/delete mutation set.
 *
 * CRITICAL: On toggle, this hook now updates ALL dependent query caches
 * (dashboard, heatmap, analytics, monthly) so that every page stays
 * in sync WITHOUT refetches or flicker.
 * ────────────────────────────────────────────────────────────────────── */

export function useTasks(searchTerm) {
  const queryClient = useQueryClient();

  /* ── query: tasks list ────────────────────────────────────────────── */
  const {
    data: tasks = [],
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: queryKeys.tasks(searchTerm),
    queryFn: async () => {
      const res = await tasksAPI.getAll(searchTerm || undefined);
      return res.data.data;
    },
    staleTime: 1000 * 60 * 2,
  });

  /* ── mutation: create ─────────────────────────────────────────────── */
  const createMutation = useMutation({
    mutationFn: async (title) => {
      const res = await tasksAPI.create({ title });
      return res.data.data;
    },
    onMutate: async (title) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks(searchTerm) });
      const previous = queryClient.getQueryData(queryKeys.tasks(searchTerm));
      const optimistic = {
        id: `temp-${Date.now()}`,
        title,
        completed_today: false,
        _optimistic: true,
      };
      queryClient.setQueryData(queryKeys.tasks(searchTerm), (old = []) => [optimistic, ...old]);
      return { previous };
    },
    onError: (_err, _title, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(queryKeys.tasks(searchTerm), ctx.previous);
      }
      toast.error('Failed to create task');
    },
    onSuccess: (serverTask) => {
      queryClient.setQueryData(queryKeys.tasks(searchTerm), (old = []) =>
        old.map((t) => (t._optimistic ? serverTask : t))
      );
      toast.success('Task created!');
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
      // Invalidate all monthly/analytics/heatmap by prefix
      queryClient.invalidateQueries({ queryKey: ['monthly'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['heatmap'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardHistory'] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(searchTerm) });
    },
  });

  /* ── mutation: update (title) ─────────────────────────────────────── */
  const updateMutation = useMutation({
    mutationFn: async ({ id, title }) => {
      const res = await tasksAPI.update(id, { title });
      return res.data.data;
    },
    onMutate: async ({ id, title }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks(searchTerm) });
      const previous = queryClient.getQueryData(queryKeys.tasks(searchTerm));
      queryClient.setQueryData(queryKeys.tasks(searchTerm), (old = []) =>
        old.map((t) => (t.id === id ? { ...t, title } : t))
      );
      // Also update title in all monthly caches
      queryClient.getQueryCache().findAll({ queryKey: ['monthly'] }).forEach(query => {
        const key = query.queryKey;
        const oldData = queryClient.getQueryData(key);
        if (oldData?.tasks) {
          queryClient.setQueryData(key, {
            ...oldData,
            tasks: oldData.tasks.map(t => t.id === id ? { ...t, title } : t),
          });
        }
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(queryKeys.tasks(searchTerm), ctx.previous);
      }
      toast.error('Failed to update task');
    },
    onSuccess: (serverTask) => {
      queryClient.setQueryData(queryKeys.tasks(searchTerm), (old = []) =>
        old.map((t) => (t.id === serverTask.id ? serverTask : t))
      );
      toast.success('Task updated!');
      // Invalidate monthly to sync title changes
      queryClient.invalidateQueries({ queryKey: ['monthly'] });
    },
  });

  /* ── mutation: delete ─────────────────────────────────────────────── */
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await tasksAPI.delete(id);
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks(searchTerm) });
      const previous = queryClient.getQueryData(queryKeys.tasks(searchTerm));
      queryClient.setQueryData(queryKeys.tasks(searchTerm), (old = []) =>
        old.filter((t) => t.id !== id)
      );
      // Also remove from all monthly caches
      queryClient.getQueryCache().findAll({ queryKey: ['monthly'] }).forEach(query => {
        const key = query.queryKey;
        const oldData = queryClient.getQueryData(key);
        if (oldData?.tasks) {
          queryClient.setQueryData(key, {
            ...oldData,
            tasks: oldData.tasks.filter(t => t.id !== id),
          });
        }
      });
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(queryKeys.tasks(searchTerm), ctx.previous);
      }
      toast.error('Failed to delete task');
    },
    onSuccess: () => {
      toast.success('Task deleted!');
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
      queryClient.invalidateQueries({ queryKey: ['monthly'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['heatmap'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardHistory'] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(searchTerm) });
    },
  });

  /* ── mutation: toggle by date (for MonthlyTracker) ────────────────── */
  const toggleByDateMutation = useMutation({
    mutationFn: async ({ taskId, dateStr }) => {
      const res = await tasksAPI.toggleByDate(taskId, dateStr);
      return res.data.data;
    },
    onMutate: async ({ taskId, dateStr }) => {
      // Cancel all monthly queries
      await queryClient.cancelQueries({ queryKey: ['monthly'] });
      // Snapshot all monthly caches
      const previousMonthlyCaches = {};
      queryClient.getQueryCache().findAll({ queryKey: ['monthly'] }).forEach(query => {
        previousMonthlyCaches[JSON.stringify(query.queryKey)] = queryClient.getQueryData(query.queryKey);
      });

      const dateObj = new Date(dateStr + 'T00:00:00');
      const y = dateObj.getFullYear();
      const m = dateObj.getMonth() + 1;
      const day = dateObj.getDate();
      const monthlyKey = ['monthly', y, m];
      const monthlyData = queryClient.getQueryData(monthlyKey);
      
      if (monthlyData?.tasks) {
        queryClient.setQueryData(monthlyKey, (old) => {
          if (!old) return old;
          return {
            ...old,
            tasks: old.tasks.map(t => {
              if (t.id === taskId) {
                const wasCompleted = t.days?.[day] === true;
                return { ...t, days: { ...t.days, [day]: !wasCompleted } };
              }
              return t;
            }),
          };
        });
      }

      // If toggling today, also sync dashboard and tasks list
      const today = new Date().toISOString().split('T')[0];
      if (dateStr === today) {
        await queryClient.cancelQueries({ queryKey: queryKeys.tasks(searchTerm) });
        await queryClient.cancelQueries({ queryKey: queryKeys.dashboard() });

        const previousTasks = queryClient.getQueryData(queryKeys.tasks(searchTerm));
        const oldTask = (previousTasks || []).find(t => t.id === taskId);
        const wasComplete = oldTask?.completed_today;
        const delta = wasComplete ? -1 : 1;

        queryClient.setQueryData(queryKeys.tasks(searchTerm), (old = []) =>
          old.map((t) => (t.id === taskId ? { ...t, completed_today: !t.completed_today } : t))
        );

        const prevDash = queryClient.getQueryData(queryKeys.dashboard());
        if (prevDash) {
          queryClient.setQueryData(queryKeys.dashboard(), (old) => {
            if (!old) return old;
            const completedToday = Math.max(0, Math.min(old.totalTasks || 0, (old.completedToday || 0) + delta));
            return {
              ...old,
              completedToday,
              completionPercent: (old.totalTasks || 0) > 0 ? Math.round((completedToday / old.totalTasks) * 100) : 0,
            };
          });
        }

        return { previousMonthlyCaches, previousTasks, prevDash };
      }

      return { previousMonthlyCaches };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previousMonthlyCaches) {
        Object.entries(ctx.previousMonthlyCaches).forEach(([keyStr, data]) => {
          queryClient.setQueryData(JSON.parse(keyStr), data);
        });
      }
      if (ctx?.previousTasks) {
        queryClient.setQueryData(queryKeys.tasks(searchTerm), ctx.previousTasks);
      }
      if (ctx?.prevDash) {
        queryClient.setQueryData(queryKeys.dashboard(), ctx.prevDash);
      }
      toast.error('Failed to update');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
      queryClient.invalidateQueries({ queryKey: ['heatmap'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardHistory'] });
    },
  });

  const toggleByDate = useCallback(
    async (taskId, dateStr) => {
      await toggleByDateMutation.mutateAsync({ taskId, dateStr });
    },
    [toggleByDateMutation]
  );

  /* ── mutation: toggle completion (the hot path) ───────────────────── */
  const toggleMutation = useMutation({
    mutationFn: async (id) => {
      const res = await tasksAPI.toggle(id);
      return res.data.data; // { id, completed }
    },
    onMutate: async (id) => {
      // Cancel any in-flight refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks(searchTerm) });
      await queryClient.cancelQueries({ queryKey: queryKeys.dashboard() });

      const previous = queryClient.getQueryData(queryKeys.tasks(searchTerm));
      const oldTask = (previous || []).find((t) => t.id === id);
      const wasComplete = oldTask?.completed_today;
      const delta = wasComplete ? -1 : 1;

      // ── 1. Optimistic update: tasks list ──────────────────────────
      queryClient.setQueryData(queryKeys.tasks(searchTerm), (old = []) =>
        old.map((t) => (t.id === id ? { ...t, completed_today: !t.completed_today } : t))
      );

      // ── 2. Optimistic update: dashboard stats ─────────────────────
      const previousDashboard = queryClient.getQueryData(queryKeys.dashboard());
      if (previousDashboard) {
        const totalTasks = previousDashboard.totalTasks || 0;
        const completedToday = Math.max(
          0,
          Math.min(totalTasks, (previousDashboard.completedToday || 0) + delta)
        );
        const completionPercent =
          totalTasks > 0 ? Math.round((completedToday / totalTasks) * 100) : 0;
        queryClient.setQueryData(queryKeys.dashboard(), {
          ...previousDashboard,
          completedToday,
          completionPercent,
        });
      }

      // ── 3. Optimistic update: heatmap ─────────────────────────────
      const today = new Date().toISOString().split('T')[0];
      const previousHeatmap = queryClient.getQueryData(queryKeys.heatmap());
      if (previousHeatmap) {
        queryClient.setQueryData(queryKeys.heatmap(), (old = []) => {
          const existingIndex = old.findIndex(d => d.date === today);
          const totalTasks = previousDashboard?.totalTasks || previous?.length || 1;
          if (existingIndex >= 0) {
            const newCount = old[existingIndex].percentage * totalTasks / 100 + delta;
            return old.map((d, i) =>
              i === existingIndex
                ? { ...d, percentage: Math.max(0, Math.min(100, Math.round((newCount / totalTasks) * 100))) }
                : d
            );
          } else {
            return [...old, { date: today, percentage: delta > 0 ? Math.round((1 / totalTasks) * 100) : 0 }];
          }
        });
      }

      // ── 4. Optimistic update: analytics (current month) ───────────
      const now = new Date();
      const curYear = now.getFullYear();
      const curMonth = now.getMonth() + 1;
      const analyticsKey = queryKeys.analytics(curYear, curMonth);
      const previousAnalytics = queryClient.getQueryData(analyticsKey);
      if (previousAnalytics?.dailyChartData) {
        const todayStr = today;
        queryClient.setQueryData(analyticsKey, (old) => {
          if (!old) return old;
          return {
            ...old,
            dailyChartData: old.dailyChartData.map(d => {
              if (d.date === todayStr) {
                const newPct = Math.max(0, Math.min(100, d.percentage + (delta > 0 ? Math.round(100 / old.totalTasks) : -Math.round(100 / old.totalTasks))));
                return { ...d, percentage: newPct };
              }
              return d;
            }),
          };
        });
      }

      // ── 5. Optimistic update: monthly tracker ─────────────────────
      const monthlyKey = queryKeys.monthly(curYear, curMonth);
      const previousMonthly = queryClient.getQueryData(monthlyKey);
      if (previousMonthly?.tasks) {
        const todayDay = now.getDate();
        queryClient.setQueryData(monthlyKey, (old) => {
          if (!old) return old;
          return {
            ...old,
            tasks: old.tasks.map(t => {
              if (t.id === id) {
                return { ...t, days: { ...t.days, [todayDay]: !wasComplete } };
              }
              return t;
            }),
          };
        });
      }

      // Return snapshots for rollback
      return {
        previous,
        previousDashboard,
        previousHeatmap: previousHeatmap,
        previousAnalytics,
        previousMonthly,
      };
    },
    onError: (_err, _id, ctx) => {
      // Roll back ALL caches
      if (ctx?.previous) {
        queryClient.setQueryData(queryKeys.tasks(searchTerm), ctx.previous);
      }
      if (ctx?.previousDashboard) {
        queryClient.setQueryData(queryKeys.dashboard(), ctx.previousDashboard);
      }
      if (ctx?.previousHeatmap) {
        queryClient.setQueryData(queryKeys.heatmap(), ctx.previousHeatmap);
      }
      if (ctx?.previousAnalytics) {
        const now = new Date();
        queryClient.setQueryData(
          queryKeys.analytics(now.getFullYear(), now.getMonth() + 1),
          ctx.previousAnalytics
        );
      }
      if (ctx?.previousMonthly) {
        const now = new Date();
        queryClient.setQueryData(
          queryKeys.monthly(now.getFullYear(), now.getMonth() + 1),
          ctx.previousMonthly
        );
      }
      toast.error('Failed to update task');
    },
    onSuccess: (data) => {
      // Reconcile tasks list with server
      queryClient.setQueryData(queryKeys.tasks(searchTerm), (old = []) =>
        old.map((t) => (t.id === data.id ? { ...t, completed_today: data.completed } : t))
      );
    },
    onSettled: () => {
      // Soft-refresh in background (does NOT block UI)
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
      queryClient.invalidateQueries({ queryKey: ['dashboardHistory'] });
    },
  });

  /* ── stable callback wrappers ─────────────────────────────────────── */
  const createTask = useCallback(
    async (title) => {
      const r = await createMutation.mutateAsync(title);
      return { success: !!r, data: r };
    },
    [createMutation]
  );

  const updateTask = useCallback(
    async (id, title) => {
      const r = await updateMutation.mutateAsync({ id, title });
      return { success: !!r };
    },
    [updateMutation]
  );

  const deleteTask = useCallback(
    async (id) => {
      const r = await deleteMutation.mutateAsync(id);
      return { success: !!r };
    },
    [deleteMutation]
  );

  const toggleTask = useCallback(
    async (id) => {
      const r = await toggleMutation.mutateAsync(id);
      return { success: true, completed: r.completed };
    },
    [toggleMutation]
  );

  return {
    tasks,
    allTasks: tasks,
    loading: isLoading,
    isFetching,
    togglingId: toggleMutation.isPending ? toggleMutation.variables : null,
    createTask,
    updateTask,
    deleteTask,
    toggleTask,
    toggleByDate,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * useDashboard()
 * Returns aggregated stats for the dashboard page.
 * ────────────────────────────────────────────────────────────────────── */
export function useDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.dashboard(),
    queryFn: async () => {
      const res = await tasksAPI.getDashboard();
      return res.data.data;
    },
    staleTime: 1000 * 60 * 5,
  });
  return { data: data ?? null, loading: isLoading };
}

/* ──────────────────────────────────────────────────────────────────────────
 * useMonthlyData(year, month)
 * ────────────────────────────────────────────────────────────────────── */
/* ──────────────────────────────────────────────────────────────────────────
 * useDashboardHistory(days)
 * Returns historical completion data for the Dashboard's visible days.
 * ────────────────────────────────────────────────────────────────────── */
export function useDashboardHistory(days) {
  return useQuery({
    queryKey: queryKeys.dashboardHistory(days),
    queryFn: async () => {
      const res = await tasksAPI.getDashboardHistory(days);
      return res.data.data; // { tasks, completions, startDate, endDate }
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useMonthlyData(year, month) {
  const [currentDate, setCurrentDate] = useState(() => {
    // When year/month are provided from URL, use them. Otherwise default to current month.
    if (year != null && month != null) {
      const d = new Date(year, month - 1, 1);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });
  const y = currentDate.getFullYear();
  const m = currentDate.getMonth() + 1;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.monthly(y, m),
    queryFn: async () => {
      const res = await tasksAPI.getMonthly(y, m);
      return res.data.data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const goToPreviousMonth = useCallback(
    () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)),
    []
  );
  const goToNextMonth = useCallback(
    () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)),
    []
  );
  const goToCurrentMonth = useCallback(() => setCurrentDate(new Date()), []);

  return {
    data: data ?? null,
    loading: isLoading,
    year: y,
    month: m,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * useAnalytics()
 * ────────────────────────────────────────────────────────────────────── */
export function useAnalytics() {
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.analytics(selectedYear, selectedMonth),
    queryFn: async () => {
      const res = await tasksAPI.getAnalytics(selectedYear, selectedMonth);
      return res.data.data;
    },
    staleTime: 1000 * 60 * 5,
  });

  return {
    data: data ?? null,
    loading: isLoading,
    selectedYear,
    selectedMonth,
    setSelectedYear,
    setSelectedMonth,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * useHeatmap()
 * ────────────────────────────────────────────────────────────────────── */
export function useHeatmap() {
  const { data = [], isLoading } = useQuery({
    queryKey: queryKeys.heatmap(),
    queryFn: async () => {
      const res = await tasksAPI.getHeatmap();
      return res.data.data;
    },
    staleTime: 1000 * 60 * 5,
  });
  return { data, loading: isLoading };
}