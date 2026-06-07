import { useState, useMemo, memo, useCallback, useRef } from 'react';
import { Plus, Target, Flame, Trophy, CheckCircle, Circle, Search, X, ChevronDown, ChevronUp, Activity, Calendar } from 'lucide-react';
import { useTasks, useDashboard } from '../hooks/useTasks';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

// ── Debug flag ────────────────────────────────────────────────────────────
// Set to `true` while diagnosing rerenders, `false` for production.
const DEBUG_RERENDERS = true;
const dlog = (...args) => {
  if (DEBUG_RERENDERS) console.log(...args);
};

export default function Dashboard() {
  dlog('Dashboard render');

  const { user } = useAuth();
  const { theme } = useTheme();
  // We pass `searchTerm` to the hook so it can build a stable query key.
  // The SyncContext bump() is gone — React Query owns the cache now.
  const [searchTerm, setSearchTerm] = useState('');
  const { tasks, loading: tasksLoading, togglingId, createTask, deleteTask, toggleTask } =
    useTasks(searchTerm);
  const { data: stats, loading: statsLoading } = useDashboard();

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showGraph, setShowGraph] = useState(true);

  // Only show the full-page skeleton on the FIRST load. Subsequent
  // background refetches must NOT cause a remount / flicker.
  const hasLoadedRef = useRef(false);
  const showInitialSkeleton =
    !hasLoadedRef.current && (tasksLoading || statsLoading);
  if (!(tasksLoading || statsLoading)) {
    hasLoadedRef.current = true;
  }

  const today = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    []
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  // The optimistic update already happened inside the hook. Wrapper is
  // a fire-and-forget — UI is already updated.
  const handleToggleTask = useCallback(
    (id) => {
      toggleTask(id);
    },
    [toggleTask]
  );

  const handleCreateTask = useCallback(
    async (e) => {
      e.preventDefault();
      const title = newTaskTitle.trim();
      if (!title) return;
      setIsCreating(true);
      const result = await createTask(title);
      setIsCreating(false);
      if (result.success) {
        setNewTaskTitle('');
        setShowAddForm(false);
      }
    },
    [newTaskTitle, createTask]
  );

  // Get weekly data for chart (last 7 days, chronological: oldest left, newest right)
  const weeklyData = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayData = stats?.weeklyData?.find((w) => w.date === dateStr);
      days.push({
        date: dateStr,
        label: i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' }),
        day: d.getDate(),
        percentage: dayData?.percentage || 0,
        completed: dayData?.completed || 0,
        total: dayData?.total || 0,
        isToday: i === 0,
      });
    }
    return days;
  }, [stats?.weeklyData]);

  // Chart colors based on theme
  const chartColors = useMemo(() => {
    const isDark = theme === 'dark' || theme === 'navy';
    return {
      border: isDark ? '#60a5fa' : '#3b82f6',
      fill: isDark ? 'rgba(96, 165, 250, 0.12)' : 'rgba(59, 130, 246, 0.08)',
      point: isDark ? '#60a5fa' : '#3b82f6',
      grid: isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(100, 116, 139, 0.08)',
      tick: isDark ? '#94a3b8' : '#64748b',
      tooltipBg: isDark ? '#0f172a' : '#1e293b',
      tooltipBorder: isDark ? '#334155' : '#475569',
      titleColor: isDark ? '#f1f5f9' : '#1e293b',
      bodyColor: isDark ? '#94a3b8' : '#64748b',
      success: '#10b981',
      warning: '#f59e0b',
    };
  }, [theme]);

  const chartData = useMemo(
    () => ({
      labels: weeklyData.map((d) => d.label),
      datasets: [
        {
          label: 'Completion %',
          data: weeklyData.map((d) => d.percentage),
          fill: true,
          borderColor: chartColors.border,
          backgroundColor: chartColors.fill,
          tension: 0.4,
          pointBackgroundColor: weeklyData.map((d) => (d.isToday ? chartColors.warning : chartColors.point)),
          pointBorderColor: chartColors.tooltipBg,
          pointBorderWidth: 2,
          pointRadius: weeklyData.map((d) => (d.isToday ? 5 : 3)),
          pointHoverRadius: 7,
          borderWidth: 2.5,
        },
        {
          label: 'Tasks Completed',
          data: weeklyData.map((d) => d.completed),
          fill: false,
          borderColor: chartColors.success,
          backgroundColor: chartColors.success,
          tension: 0.4,
          pointBackgroundColor: chartColors.success,
          pointBorderColor: chartColors.tooltipBg,
          pointBorderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 6,
          borderWidth: 2,
          borderDash: [5, 5],
          yAxisID: 'y1',
        },
      ],
    }),
    [weeklyData, chartColors]
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 750, easing: 'easeOutQuart' },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: chartColors.tick,
            font: { size: 11, family: 'Inter, sans-serif' },
            usePointStyle: true,
            padding: 16,
          },
        },
        title: { display: false },
        tooltip: {
          backgroundColor: chartColors.tooltipBg,
          titleColor: chartColors.titleColor,
          bodyColor: chartColors.bodyColor,
          borderColor: chartColors.tooltipBorder,
          borderWidth: 1,
          padding: 12,
          cornerRadius: 10,
          displayColors: true,
          callbacks: {
            label: (ctx) =>
              ctx.datasetIndex === 0
                ? `${ctx.parsed.y}% completion`
                : `${ctx.parsed.y} tasks completed`,
            title: (ctx) => ctx[0].label,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: chartColors.tick, font: { size: 11 } } },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          min: 0,
          max: 100,
          grid: { color: chartColors.grid, drawBorder: false },
          ticks: { color: chartColors.tick, font: { size: 11 }, callback: (v) => `${v}%` },
          title: { display: true, text: 'Completion %', color: chartColors.tick, font: { size: 10 } },
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          min: 0,
          grid: { drawOnChartArea: false },
          ticks: { color: chartColors.success, font: { size: 11 } },
          title: { display: true, text: 'Tasks', color: chartColors.success, font: { size: 10 } },
        },
      },
      interaction: { intersect: false, mode: 'index' },
    }),
    [chartColors]
  );

  // Recent days for quick check-in
  const recentDays = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push({
        date: d.toISOString().split('T')[0],
        label:
          i === 0
            ? 'Today'
            : i === 1
            ? 'Yesterday'
            : d.toLocaleDateString('en-US', { weekday: 'short' }),
        day: d.getDate(),
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        isToday: i === 0,
      });
    }
    return days;
  }, []);

  if (showInitialSkeleton) return <DashboardSkeleton />;

  const completedToday = stats?.completedToday || tasks.filter((t) => t.completed_today).length;
  const totalTasks = stats?.totalTasks || tasks.length;
  const completionRate =
    stats?.completionPercent ??
    (totalTasks > 0 ? Math.round((completedToday / totalTasks) * 100) : 0);
  const currentStreak = stats?.currentStreak || 0;
  const longestStreak = stats?.longestStreak || 0;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* SECTION 1: Greeting Header */}
      <div
        className="rounded-xl p-4 md:p-6 card-hover"
        style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl md:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {greeting}, {user?.name?.split(' ')[0] || 'User'} 👋
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {today}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <StreakBadge label="🔥" value={`${currentStreak}d`} />
            <ProgressPill value={`${completionRate}%`} />
          </div>
        </div>
        <div
          className="mt-3 h-1.5 rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${completionRate}%`, backgroundColor: 'var(--accent)' }}
          />
        </div>
      </div>

      {/* SECTION 2: Quick Daily Check-in */}
      <div
        className="rounded-xl p-4 card-hover"
        style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
      >
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
          Weekly Check-in
        </h2>
        <div className="checkin-scroll">
          <QuickCheckinTable
            tasks={tasks}
            recentDays={recentDays}
            onToggle={handleToggleTask}
            togglingId={togglingId}
          />
        </div>
      </div>

      {/* SECTION 3: Mini Progress Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniCard
          icon={CheckCircle}
          label="Completed"
          value={`${completedToday}`}
          sub={totalTasks > 0 ? `of ${totalTasks} tasks` : 'No tasks'}
          accent="var(--success)"
        />
        <MiniCard icon={Target} label="Rate" value={`${completionRate}%`} sub="Today" accent="var(--accent)" />
        <MiniCard
          icon={Flame}
          label="Streak"
          value={`${currentStreak}d`}
          sub={currentStreak > 0 ? 'Keep going!' : 'Start today'}
          accent="var(--warning)"
        />
        <MiniCard
          icon={Trophy}
          label="Best"
          value={`${longestStreak}d`}
          sub="Longest streak"
          accent="var(--success)"
        />
      </div>

      {/* SECTION 4: Analytics-Quality Graph */}
      <div
        className="rounded-xl p-4 md:p-5 card-hover animate-slide-up"
        style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity size={16} style={{ color: 'var(--accent)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Weekly Productivity
            </span>
          </div>
          <button
            onClick={() => setShowGraph(!showGraph)}
            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--hover-bg)]"
            style={{ color: 'var(--text-muted)' }}
            aria-label={showGraph ? 'Hide chart' : 'Show chart'}
            aria-expanded={showGraph}
          >
            {showGraph ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {showGraph && (
          <div className="chart-container" style={{ height: '220px' }}>
            {weeklyData.some((d) => d.percentage > 0 || d.completed > 0) ? (
              <Line data={chartData} options={chartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Activity size={32} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No data yet</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Complete tasks to see your trend
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
          <WeeklyStat
            label="Avg Completion"
            value={`${Math.round(weeklyData.reduce((a, b) => a + b.percentage, 0) / 7)}%`}
            icon={Target}
            color="var(--accent)"
          />
          <WeeklyStat
            label="Tasks Done"
            value={weeklyData.reduce((a, b) => a + b.completed, 0)}
            icon={CheckCircle}
            color="var(--success)"
          />
          <WeeklyStat
            label="Active Days"
            value={weeklyData.filter((d) => d.percentage > 0).length}
            icon={Calendar}
            color="var(--warning)"
          />
        </div>
      </div>

      {/* SECTION 5: Below-fold - Task Management */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          All Tasks
        </h2>
        <div className="flex items-center gap-2">
          <SearchInput value={searchTerm} onChange={setSearchTerm} />
        </div>
      </div>

      <div className="space-y-2 pb-28">
        {tasks.length === 0 ? (
          <EmptyTasks />
        ) : (
          tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={handleToggleTask}
              onDelete={deleteTask}
              isToggling={togglingId === task.id}
            />
          ))
        )}
      </div>

      <FloatingAddButton onClick={() => setShowAddForm(true)} isOpen={showAddForm} />

      {showAddForm && (
        <AddTaskModal
          value={newTaskTitle}
          onChange={setNewTaskTitle}
          onSubmit={handleCreateTask}
          onClose={() => {
            setShowAddForm(false);
            setNewTaskTitle('');
          }}
          isCreating={isCreating}
        />
      )}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

const QuickCheckinTable = memo(function QuickCheckinTable({ tasks, recentDays, onToggle, togglingId }) {
  dlog('QuickCheckinTable render');
  if (tasks.length === 0) {
    return (
      <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
        Add tasks to get started
      </p>
    );
  }

  return (
    <table className="w-full min-w-[500px] md:min-w-[700px]">
      <thead>
        <tr>
          <th
            className="text-left text-xs font-medium py-2 pr-4 sticky left-0"
            style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card-bg)' }}
          >
            Task
          </th>
          {recentDays.map((d) => (
            <th
              key={d.date}
              className="text-center text-xs font-medium py-2 px-2 w-10 relative"
              style={{ color: 'var(--text-muted)' }}
            >
              <div className="font-medium">{d.dayName}</div>
              <div className="text-[10px] opacity-60">{d.day}</div>
              {d.isToday && (
                <div
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: 'var(--accent)' }}
                />
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => {
          const isCompletedToday = task.completed_today;
          const isToggling = togglingId === task.id;
          return (
            <tr key={task.id} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
              <td
                className="py-2 pr-4 text-sm truncate max-w-[160px] sticky left-0"
                style={{ color: 'var(--text-primary)', backgroundColor: 'var(--card-bg)' }}
              >
                {task.title}
              </td>
              {recentDays.map((d, idx) => (
                <td key={d.date} className="text-center py-1 px-2">
                  {idx === 0 ? (
                    <ToggleButton
                      checked={isCompletedToday}
                      onClick={() => onToggle(task.id)}
                      isToggling={isToggling}
                    />
                  ) : (
                    <span
                      className="inline-block w-5 h-5 rounded-full text-[10px] leading-5"
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                    >
                      -
                    </span>
                  )}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
});

const ToggleButton = memo(function ToggleButton({ checked, onClick, isToggling }) {
  dlog('ToggleButton render', { checked, isToggling });
  return (
    <button
      onClick={onClick}
      disabled={isToggling}
      className="inline-flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        outlineColor: 'var(--accent)',
        transform: 'scale(1)',
      }}
      aria-label={checked ? 'Mark as incomplete' : 'Mark as complete'}
      aria-pressed={checked}
    >
      {checked ? (
        <CheckCircle size={20} style={{ color: 'var(--success)' }} className={isToggling ? 'animate-spin' : ''} />
      ) : (
        <Circle size={20} style={{ color: 'var(--text-muted)' }} />
      )}
    </button>
  );
});

const MiniCard = memo(function MiniCard({ icon: Icon, label, value, sub, accent }) {
  dlog('MiniCard render', label);
  return (
    <div
      className="rounded-xl p-3 md:p-4 card-hover"
      style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={14} style={{ color: accent }} />
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
      </div>
      <p className="text-lg md:text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
        {value}
      </p>
      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
        {sub}
      </p>
    </div>
  );
});

const StreakBadge = memo(function StreakBadge({ label, value }) {
  dlog('StreakBadge render');
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
      style={{ backgroundColor: 'var(--bg-secondary)' }}
    >
      <span>{label}</span>
      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
        {value}
      </span>
    </div>
  );
});

const ProgressPill = memo(function ProgressPill({ value }) {
  dlog('ProgressPill render');
  return (
    <div
      className="px-3 py-1.5 rounded-lg text-sm font-medium"
      style={{ backgroundColor: 'var(--accent)', color: 'white' }}
    >
      {value}
    </div>
  );
});

const SearchInput = memo(function SearchInput({ value, onChange }) {
  dlog('SearchInput render');
  return (
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search..."
        className="pl-8 pr-3 py-1.5 rounded-lg text-sm outline-none w-32 md:w-40 transition-all duration-200"
        style={{
          backgroundColor: 'var(--card-bg)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-color)',
        }}
        aria-label="Search tasks"
      />
    </div>
  );
});

// TaskRow is the most performance-critical sub-component. It must
// rerender ONLY when the single task it represents changes.
const TaskRow = memo(
  function TaskRow({ task, onToggle, onDelete, isToggling }) {
    console.log('TaskRow render', task.id);
    const [deleting, setDeleting] = useState(false);

    const handleDelete = useCallback(async () => {
      if (deleting) return;
      setDeleting(true);
      await onDelete(task.id);
      setDeleting(false);
    }, [deleting, onDelete, task.id]);

    const handleToggle = useCallback(() => onToggle(task.id), [onToggle, task.id]);

    return (
      <div
        className="flex items-center gap-3 p-3 rounded-lg card-hover"
        style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
      >
        <button
          onClick={handleToggle}
          disabled={isToggling}
          className="flex-shrink-0 transition-transform hover:scale-110"
          aria-label={task.completed_today ? 'Mark incomplete' : 'Mark complete'}
          style={{ opacity: isToggling ? 0.7 : 1 }}
        >
          {task.completed_today ? (
            <CheckCircle size={20} style={{ color: 'var(--success)' }} className={isToggling ? 'animate-pulse' : ''} />
          ) : (
            <Circle size={20} style={{ color: 'var(--text-muted)' }} />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium truncate"
            style={{
              color: 'var(--text-primary)',
              textDecoration: task.completed_today ? 'line-through' : 'none',
              opacity: task.completed_today ? 0.6 : 1,
            }}
          >
            {task.title}
          </p>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-1.5 rounded-lg transition-colors hover:scale-110"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Delete task"
        >
          <X size={14} />
        </button>
      </div>
    );
  },
  // Custom equality: only re-render when this task's own state changes
  // OR when its toggling flag flips. The other task rows are untouched.
  (prev, next) =>
    prev.task.id === next.task.id &&
    prev.task.title === next.task.title &&
    prev.task.completed_today === next.task.completed_today &&
    prev.isToggling === next.isToggling &&
    prev.onToggle === next.onToggle &&
    prev.onDelete === next.onDelete
);

const WeeklyStat = memo(function WeeklyStat({ label, value, icon: Icon, color }) {
  dlog('WeeklyStat render', label);
  return (
    <div className="text-center p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      <Icon size={16} className="mx-auto mb-1" style={{ color }} />
      <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
        {value}
      </p>
      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
    </div>
  );
});

const FloatingAddButton = memo(function FloatingAddButton({ onClick, isOpen }) {
  dlog('FloatingAddButton render');
  return (
    <button
      onClick={onClick}
      className={`fab ${isOpen ? 'open' : ''}`}
      aria-label="Add new task"
      title="Add new task"
    >
      <Plus size={24} />
    </button>
  );
});

const AddTaskModal = memo(function AddTaskModal({ value, onChange, onSubmit, onClose, isCreating }) {
  dlog('AddTaskModal render');
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl p-5 animate-scale-in shadow-xl"
        style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          New Task
        </h3>
        <form onSubmit={onSubmit}>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="What do you want to do?"
            className="w-full px-4 py-2.5 rounded-lg text-sm outline-none mb-3"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
            }}
            autoFocus
            aria-label="New task title"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-[var(--hover-bg)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !value.trim()}
              className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-all"
              style={{
                backgroundColor: !isCreating && value.trim() ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              {isCreating ? 'Adding...' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

/* ── Skeleton Loader ────────────────────────────────────────────────────── */
function DashboardSkeleton() {
  dlog('DashboardSkeleton render');
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="rounded-xl p-4 md:p-6" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
        <div className="skeleton skeleton-text-lg w-2/3" />
        <div className="skeleton skeleton-text w-1/3 mt-2" />
        <div className="skeleton h-2 w-full mt-3 rounded-full" style={{ backgroundColor: 'var(--bg-secondary)' }} />
      </div>
      <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
        <div className="skeleton skeleton-text w-1/3 mb-3" />
        <div className="skeleton h-16 w-full" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton skeleton-card rounded-xl" />
        ))}
      </div>
      <div className="rounded-xl p-4 md:p-5" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
        <div className="skeleton h-8 w-1/4 mb-4" />
        <div className="skeleton h-48 w-full" />
        <div className="skeleton h-20 w-full mt-4" />
      </div>
      <div className="skeleton skeleton-text w-1/4" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

function EmptyTasks() {
  dlog('EmptyTasks render');
  return (
    <div className="empty-state">
      <Target size={40} style={{ color: 'var(--text-muted)' }} />
      <h3 className="text-base font-medium mt-3" style={{ color: 'var(--text-primary)' }}>
        No tasks yet
      </h3>
      <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
        Tap the + button to add your first task
      </p>
    </div>
  );
}
