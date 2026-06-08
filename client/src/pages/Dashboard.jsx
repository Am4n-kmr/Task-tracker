import { useState, useMemo, memo, useCallback, useRef, useEffect } from 'react';
import { Plus, Target, Flame, Trophy, CheckCircle, Circle, X, ChevronDown, ChevronUp, Activity, Edit2, Trash2, Check } from 'lucide-react';
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
import { tasksAPI } from '../services/api';
import toast from 'react-hot-toast';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

// ── Debug ────────────────────────────────────────────────────────────
const DEBUG_RERENDERS = false;
const dlog = (...args) => { if (DEBUG_RERENDERS) console.log(...args); };

/* ── Responsive day count ─────────────────────────────────────────── */
function getDayCount() {
  const w = window.innerWidth;
  if (w < 480) return 5;   // mobile: last 4 + today
  if (w < 768) return 5;   // small tablet: last 4 + today
  if (w < 1024) return 7;  // tablet: last 6 + today
  return 8;                 // desktop: last 7 + today
}

/* ── Build recent days (newest RIGHT) ─────────────────────────────── */
function buildRecentDays(count) {
  const days = [];
  const now = new Date();
  // count-1 days ago through today
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push({
      date: d.toISOString().split('T')[0],
      label: i === 0 ? 'Today' : i === 1 ? 'Yesterday' : d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      day: d.getDate(),
      isToday: i === 0,
      month: d.getMonth(),
      dateObj: d,
    });
  }
  return days; // oldest left, newest right
}

export default function Dashboard() {
  dlog('Dashboard render');

  const { user } = useAuth();
  const { theme } = useTheme();
  const { tasks, loading: tasksLoading, togglingId, createTask, updateTask, deleteTask, toggleTask } = useTasks();
  const { data: stats, loading: statsLoading } = useDashboard();

  const [dayCount, setDayCount] = useState(() => getDayCount());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [showGraph, setShowGraph] = useState(true);

  const containerRef = useRef(null);

  // Recent days (computed once)
  const recentDays = useMemo(() => buildRecentDays(Math.max(dayCount, 4)), [dayCount]);

  const hasLoadedRef = useRef(false);
  const showInitialSkeleton = !hasLoadedRef.current && (tasksLoading || statsLoading);
  if (!(tasksLoading || statsLoading)) hasLoadedRef.current = true;

  const today = useMemo(() =>
    new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), []
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const handleToggleTask = useCallback((id) => toggleTask(id), [toggleTask]);

  const handleCreateTask = useCallback(async (e) => {
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
  }, [newTaskTitle, createTask]);

  // Edit handlers
  const handleStartEdit = useCallback((task) => {
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
  }, []);

  const handleSaveEdit = useCallback(async (taskId) => {
    if (!editingTitle.trim()) return;
    await updateTask(taskId, editingTitle.trim());
    setEditingTaskId(null);
    setEditingTitle('');
  }, [editingTitle, updateTask]);

  const handleCancelEdit = useCallback(() => {
    setEditingTaskId(null);
    setEditingTitle('');
  }, []);

  // Delete handlers
  const handleDeleteConfirm = useCallback(async (taskId) => {
    await deleteTask(taskId);
    setDeleteConfirmId(null);
  }, [deleteTask]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => setDayCount(getDayCount());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Move up/down - use queryClient ref
  const handleMoveTask = useCallback(async (taskId, direction, currentIndex) => {
    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= tasks.length) return;
    try {
      await tasksAPI.swapOrder(taskId, tasks[swapIndex].id);
      // Simple page reload to re-fetch with new order
      window.location.reload();
    } catch { toast.error('Failed to reorder'); }
  }, [tasks]);

  // ── Weekly data for chart (from dashboard stats) ──
  const weeklyData = useMemo(() => {
    return recentDays.map(d => {
      // For today, use real task data. For past days, use stats if available
      const isToday = d.isToday;
      const completed = isToday ? tasks.filter(t => t.completed_today).length : (stats?.weeklyData?.find(w => w.date === d.date)?.completed || 0);
      const total = tasks.length || stats?.totalTasks || 1;
      const percentage = isToday
        ? (total > 0 ? Math.round((completed / total) * 100) : 0)
        : (stats?.weeklyData?.find(w => w.date === d.date)?.percentage || 0);
      return { date: d.date, label: d.label, day: d.day, percentage, completed, total, isToday };
    });
  }, [recentDays, tasks, stats]);

  // ── Chart colors ──────────────────────────────────────────────────
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

  const chartData = useMemo(() => ({
    labels: weeklyData.map(d => d.label),
    datasets: [
      {
        label: 'Completion %',
        data: weeklyData.map(d => d.percentage),
        fill: true,
        borderColor: chartColors.border,
        backgroundColor: chartColors.fill,
        tension: 0.4,
        pointBackgroundColor: weeklyData.map(d => d.isToday ? chartColors.warning : chartColors.point),
        pointBorderColor: chartColors.tooltipBg,
        pointBorderWidth: 2,
        pointRadius: weeklyData.map(d => d.isToday ? 5 : 3),
        pointHoverRadius: 7,
        borderWidth: 2.5,
      },
      {
        label: 'Tasks Completed',
        data: weeklyData.map(d => d.completed),
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
  }), [weeklyData, chartColors]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 500, easing: 'easeOutQuart' },
    plugins: {
      legend: { display: true, position: 'top', labels: { color: chartColors.tick, font: { size: 10, family: 'Inter, sans-serif' }, usePointStyle: true, padding: 12 } },
      tooltip: {
        backgroundColor: chartColors.tooltipBg,
        titleColor: chartColors.titleColor,
        bodyColor: chartColors.bodyColor,
        borderColor: chartColors.tooltipBorder,
        borderWidth: 1, padding: 10, cornerRadius: 8,
        callbacks: { label: (ctx) => ctx.datasetIndex === 0 ? `${ctx.parsed.y}%` : `${ctx.parsed.y} tasks` },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: chartColors.tick, font: { size: 10 } } },
      y: { type: 'linear', display: true, position: 'left', min: 0, max: 100, grid: { color: chartColors.grid, drawBorder: false }, ticks: { color: chartColors.tick, font: { size: 10 }, callback: (v) => `${v}%` } },
      y1: { type: 'linear', display: true, position: 'right', min: 0, grid: { drawOnChartArea: false }, ticks: { color: chartColors.success, font: { size: 10 } } },
    },
    interaction: { intersect: false, mode: 'index' },
  }), [chartColors]);

  if (showInitialSkeleton) return <DashboardSkeleton />;

  const completedToday = tasks.filter(t => t.completed_today).length;
  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedToday / totalTasks) * 100) : 0;
  const currentStreak = stats?.currentStreak || 0;
  const longestStreak = stats?.longestStreak || 0;

  return (
    <div className="space-y-3 animate-fade-in" ref={containerRef}>
      {/* ═══ SECTION 1: Greeting + Mini Stats ═══ */}
      <div
        className="rounded-xl p-3 md:p-4 card-hover"
        style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base md:text-lg font-bold truncate" style={{ color: 'var(--text-primary)' }}>
              {greeting}, {user?.name?.split(' ')[0] || 'User'} 👋
            </h1>
            <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>{today}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs px-2 py-1 rounded-md font-semibold" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
              🔥 {currentStreak}d
            </span>
            <span className="text-xs px-2 py-1 rounded-md font-semibold text-white" style={{ backgroundColor: 'var(--accent)' }}>
              {completionRate}%
            </span>
          </div>
        </div>
        <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${completionRate}%`, backgroundColor: 'var(--accent)' }} />
        </div>
      </div>

      {/* ═══ SECTION 2: Daily Check-in Board ═══ */}
      <div
        className="rounded-xl card-hover overflow-hidden"
        style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
      >
        {tasks.length === 0 ? (
          <div className="text-center py-8">
            <Target size={32} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No tasks yet</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Tap + to add your first task</p>
          </div>
        ) : (
          <CheckinBoard
            tasks={tasks}
            recentDays={recentDays}
            onToggle={handleToggleTask}
            togglingId={togglingId}
            editingTaskId={editingTaskId}
            editingTitle={editingTitle}
            onStartEdit={handleStartEdit}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={handleCancelEdit}
            onDeleteRequest={setDeleteConfirmId}
            deleteConfirmId={deleteConfirmId}
            onDeleteConfirm={handleDeleteConfirm}
            onCancelDelete={() => setDeleteConfirmId(null)}
            onMoveTask={handleMoveTask}
          />
        )}
      </div>

      {/* ═══ SECTION 3: Mini Progress Summary ═══ */}
      <div className="grid grid-cols-4 gap-2">
        <MiniCardSm icon={CheckCircle} label="Done" value={`${completedToday}`} accent="var(--success)" />
        <MiniCardSm icon={Target} label="Rate" value={`${completionRate}%`} accent="var(--accent)" />
        <MiniCardSm icon={Flame} label="Streak" value={`${currentStreak}d`} accent="var(--warning)" />
        <MiniCardSm icon={Trophy} label="Best" value={`${longestStreak}d`} accent="var(--success)" />
      </div>

      {/* ═══ SECTION 4: Weekly Graph ═══ */}
      <div
        className="rounded-xl p-3 md:p-4 card-hover"
        style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Activity size={14} style={{ color: 'var(--accent)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Weekly</span>
          </div>
          <button onClick={() => setShowGraph(!showGraph)} className="p-1 rounded hover:bg-[var(--hover-bg)]" style={{ color: 'var(--text-muted)' }}>
            {showGraph ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
        {showGraph && (
          <div style={{ height: '140px' }}>
            {weeklyData.some(d => d.percentage > 0 || d.completed > 0) ? (
              <Line data={chartData} options={chartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-xs" style={{ color: 'var(--text-muted)' }}>
                Complete tasks to see your trend
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ SECTION 5: Add Task Button & Form ═══ */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
          style={{ backgroundColor: 'var(--accent)', color: 'white' }}
        >
          <Plus size={14} />
          Add Task
        </button>
        {showAddForm && (
          <form onSubmit={handleCreateTask} className="flex-1 flex gap-1">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="New task..."
              className="flex-1 px-3 py-1.5 rounded-lg text-xs outline-none"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
              autoFocus
              onKeyDown={(e) => e.key === 'Escape' && (setShowAddForm(false), setNewTaskTitle(''))}
            />
            <button type="submit" disabled={isCreating || !newTaskTitle.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
              style={{ backgroundColor: newTaskTitle.trim() ? 'var(--accent)' : 'var(--text-muted)' }}>
              {isCreating ? '...' : 'Add'}
            </button>
            <button type="button" onClick={() => { setShowAddForm(false); setNewTaskTitle(''); }}
              className="px-2 py-1.5 rounded-lg text-xs" style={{ color: 'var(--text-muted)' }}>
              <X size={14} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Check-in Board (the main table component)
   ══════════════════════════════════════════════════════════════════════ */
const CheckinBoard = memo(function CheckinBoard({
  tasks, recentDays, onToggle, togglingId,
  editingTaskId, editingTitle, onStartEdit, onSaveEdit, onCancelEdit,
  onDeleteRequest, deleteConfirmId, onDeleteConfirm, onCancelDelete, onMoveTask
}) {
  dlog('CheckinBoard render');
  const scrollRef = useRef(null);

  return (
    <div className="checkin-board-scroll" ref={scrollRef}>
      <table className="checkin-board-table">
        <thead>
          <tr>
            <th className="checkin-board-th checkin-task-col">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Tasks</span>
              </div>
            </th>
            {recentDays.map((d) => (
              <th key={d.date} className={`checkin-board-th checkin-day-col ${d.isToday ? 'is-today' : ''}`}>
                {/* TODAY INDICATOR - topmost */}
                {d.isToday && <span className="checkin-today-badge">TODAY</span>}
                {/* Day name */}
                <span className="checkin-day-name">{d.dayName}</span>
                {/* Date number */}
                <span className="checkin-date-num">{d.day}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task, idx) => (
            <CheckinRow
              key={task.id}
              task={task}
              recentDays={recentDays}
              onToggle={onToggle}
              isToggling={togglingId === task.id}
              isEditing={editingTaskId === task.id}
              editingTitle={editingTitle}
              onStartEdit={() => onStartEdit(task)}
              onSaveEdit={() => onSaveEdit(task.id)}
              onCancelEdit={onCancelEdit}
              onDeleteRequest={() => onDeleteRequest(task.id)}
              isDeleteConfirm={deleteConfirmId === task.id}
              onDeleteConfirm={() => onDeleteConfirm(task.id)}
              onCancelDelete={onCancelDelete}
              onMoveUp={idx > 0 ? () => onMoveTask(task.id, 'up', idx) : null}
              onMoveDown={idx < tasks.length - 1 ? () => onMoveTask(task.id, 'down', idx) : null}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════
   Check-in Row (memoized to only rerender when its own task changes)
   ══════════════════════════════════════════════════════════════════════ */
const CheckinRow = memo(function CheckinRow({
  task, recentDays, onToggle, isToggling,
  isEditing, editingTitle, onStartEdit, onSaveEdit, onCancelEdit,
  onDeleteRequest, isDeleteConfirm, onDeleteConfirm, onCancelDelete,
  onMoveUp, onMoveDown
}) {
  dlog('CheckinRow render', task.id);
  const [editValue, setEditValue] = useState(task.title);

  // Sync editValue when editing starts
  useEffect(() => {
    if (isEditing) setEditValue(task.title);
  }, [isEditing, task.title]);

  return (
    <tr className="checkin-board-tr" style={{ borderTop: '1px solid var(--border-color)' }}>
      {/* Task name cell - sticky left */}
      <td className="checkin-board-td checkin-task-col">
        <div className="flex items-center gap-1">
          {/* Reorder buttons */}
          <div className="checkin-reorder-group">
            <button onClick={onMoveUp} disabled={!onMoveUp}
              className="checkin-reorder-btn" style={{ opacity: onMoveUp ? 1 : 0.2 }}>
              <ChevronUp size={10} />
            </button>
            <button onClick={onMoveDown} disabled={!onMoveDown}
              className="checkin-reorder-btn" style={{ opacity: onMoveDown ? 1 : 0.2 }}>
              <ChevronDown size={10} />
            </button>
          </div>

          {isEditing ? (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1 px-1.5 py-0.5 rounded text-xs outline-none min-w-0"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--accent)' }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSaveEdit();
                  if (e.key === 'Escape') onCancelEdit();
                }}
              />
              <button onClick={() => { if (editValue.trim()) onSaveEdit(); }}
                className="p-0.5 rounded hover:bg-[var(--hover-bg)]" style={{ color: 'var(--success)' }}>
                <Check size={12} />
              </button>
              <button onClick={onCancelEdit} className="p-0.5 rounded hover:bg-[var(--hover-bg)]" style={{ color: 'var(--danger)' }}>
                <X size={12} />
              </button>
            </div>
          ) : (
            <>
              <span className="checkin-task-title" onClick={onStartEdit} title={task.title}>{task.title}</span>
              <div className="checkin-task-actions">
                <button onClick={onStartEdit} className="checkin-action-btn" aria-label="Edit">
                  <Edit2 size={10} />
                </button>
                {isDeleteConfirm ? (
                  <span className="flex items-center gap-0.5">
                    <button onClick={onDeleteConfirm} className="checkin-action-btn" style={{ color: 'var(--danger)' }}>
                      <Check size={10} />
                    </button>
                    <button onClick={onCancelDelete} className="checkin-action-btn">
                      <X size={10} />
                    </button>
                  </span>
                ) : (
                  <button onClick={onDeleteRequest} className="checkin-action-btn" aria-label="Delete">
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </td>

      {/* Day cells */}
      {recentDays.map((d) => (
        <td key={d.date} className={`checkin-board-td checkin-day-col ${d.isToday ? 'is-today' : ''}`}>
          <CheckinCell
            checked={d.isToday ? task.completed_today : false}
            onClick={() => d.isToday ? onToggle(task.id) : null}
            isToggling={isToggling && d.isToday}
          />
        </td>
      ))}
    </tr>
  );
// Custom comparison - recentDays is always same reference within a render cycle
}, (prev, next) =>
  prev.task.id === next.task.id &&
  prev.task.title === next.task.title &&
  prev.task.completed_today === next.task.completed_today &&
  prev.isToggling === next.isToggling &&
  prev.isEditing === next.isEditing &&
  prev.isDeleteConfirm === next.isDeleteConfirm
);

/* ══════════════════════════════════════════════════════════════════════
   Check-in Cell (checkbox)
   ══════════════════════════════════════════════════════════════════════ */
const CheckinCell = memo(function CheckinCell({ checked, onClick, isToggling }) {
  dlog('CheckinCell render', { checked, isToggling });
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="checkin-cell-btn"
      aria-label={checked ? 'Completed' : 'Not completed'}
      aria-pressed={checked}
    >
      {checked ? (
        <CheckCircle size={16} className={`checkin-check-icon ${isToggling ? 'animate-pulse' : ''}`} style={{ color: 'var(--success)' }} />
      ) : (
        <Circle size={16} style={{ color: 'var(--text-muted)' }} />
      )}
    </button>
  );
});

/* ══════════════════════════════════════════════════════════════════════
   Mini Stats Card
   ══════════════════════════════════════════════════════════════════════ */
const MiniCardSm = memo(function MiniCardSm({ icon: Icon, label, value, accent }) {
  return (
    <div className="rounded-lg p-2 text-center card-hover" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
      <div className="flex items-center justify-center gap-1 mb-0.5">
        <Icon size={10} style={{ color: accent }} />
        <span className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════
   Skeleton Loader
   ══════════════════════════════════════════════════════════════════════ */
function DashboardSkeleton() {
  return (
    <div className="space-y-3 animate-fade-in">
      <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
        <div className="skeleton skeleton-text-lg w-2/3" />
        <div className="skeleton skeleton-text w-1/3 mt-1" />
        <div className="skeleton h-2 w-full mt-2 rounded-full" style={{ backgroundColor: 'var(--bg-secondary)' }} />
      </div>
      <div className="rounded-xl" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
        <div className="skeleton h-32 w-full" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[1,2,3,4].map(i => <div key={i} className="skeleton skeleton-card rounded-lg" />)}
      </div>
      <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
        <div className="skeleton h-24 w-full" />
      </div>
    </div>
  );
}