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
 * Why React Query here?
 *  - The previous implementation bumped a global `version` counter on every
 *    toggle, which caused `useDashboard`, `useHeatmap`, `useAnalytics` and
 *    `useMonthlyData` to re-run their `useEffect` and refetch from the
 *    server. While that refetch was in flight, `loading` flipped back to
 *    `true` and the entire <Dashboard> unmounted in favor of a skeleton —
 *    producing the flicker described in the bug report.
 *  - React Query isolates the cache per key, gives us `onMutate` /
 *    `onError` / `onSettled` lifecycle hooks, and lets us update a SINGLE
 *    task row in place without touching any other query.
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
    // The data is "fresh" long enough that toggling a task does not
    // require a refetch of the list itself.
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
      // Optimistic placeholder so the row shows up immediately.
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
      // Invalidate ONLY the summary queries that genuinely depend on
      // the task count. We DO NOT refetch the tasks list itself.
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
    },
    onSettled: () => {
      // Reconcile with the server in the background; this is a soft
      // refetch that does not block the UI.
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
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(searchTerm) });
    },
  });

  /* ── mutation: toggle completion (the hot path) ───────────────────── */
  const toggleMutation = useMutation({
    mutationFn: async (id) => {
      const res = await tasksAPI.toggle(id);
      return res.data.data; // { id, completed }
    },
    // BEFORE the request fires, mutate the cache in place for the single
    // affected task. Nothing else in the tree is touched.
    onMutate: async (id) => {
      // Cancel any in-flight refetch of this exact query so it doesn't
      // overwrite our optimistic value.
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks(searchTerm) });

      const previous = queryClient.getQueryData(queryKeys.tasks(searchTerm));
      queryClient.setQueryData(queryKeys.tasks(searchTerm), (old = []) =>
        old.map((t) => (t.id === id ? { ...t, completed_today: !t.completed_today } : t))
      );

      // Mirror the optimistic delta into the dashboard summary so the
      // counter (completedToday / completionRate) updates immediately
      // without a refetch.
      const previousDashboard = queryClient.getQueryData(queryKeys.dashboard());
      if (previousDashboard) {
        const oldTask = (previous || []).find((t) => t.id === id);
        const wasComplete = oldTask?.completed_today;
        const delta = wasComplete ? -1 : 1;
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

      return { previous, previousDashboard };
    },
    onError: (_err, _id, ctx) => {
      // Roll back BOTH the task list and the dashboard summary.
      if (ctx?.previous) {
        queryClient.setQueryData(queryKeys.tasks(searchTerm), ctx.previous);
      }
      if (ctx?.previousDashboard) {
        queryClient.setQueryData(queryKeys.dashboard(), ctx.previousDashboard);
      }
      toast.error('Failed to update task');
    },
    // Reconcile with the server's authoritative value.
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.tasks(searchTerm), (old = []) =>
        old.map((t) => (t.id === data.id ? { ...t, completed_today: data.completed } : t))
      );
      // Soft-refresh only the aggregate queries the user might be looking
      // at. We deliberately DO NOT touch ['heatmap'] or ['analytics'] on
      // toggle — those are owned by their own pages and would only cause
      // wasted network + flicker if re-rendered in the background.
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
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
    isToggling: (id) => toggleMutation.isPending && toggleMutation.variables === id,
    togglingId: toggleMutation.isPending ? toggleMutation.variables : null,
    createTask,
    updateTask,
    deleteTask,
    toggleTask,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * useDashboard()
 * Returns aggregated stats for the dashboard page. Uses useQuery so that
 * the data is cached and NOT refetched when unrelated mutations happen.
 * ────────────────────────────────────────────────────────────────────── */
export function useDashboard() {
  const { data, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.dashboard(),
    queryFn: async () => {
      const res = await tasksAPI.getDashboard();
      return res.data.data;
    },
    staleTime: 1000 * 60 * 5,
  });
  return { data: data ?? null, loading: isLoading, isFetching };
}

/* ──────────────────────────────────────────────────────────────────────────
 * useMonthlyData(year, month)
 * ────────────────────────────────────────────────────────────────────── */
export function useMonthlyData(year, month) {
  const [currentDate, setCurrentDate] = useState(() => new Date(year, month - 1, 1));
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
