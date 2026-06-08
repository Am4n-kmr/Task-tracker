import { useState, memo, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Check, Download, Calendar, Edit2, X, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { useMonthlyData } from '../hooks/useTasks';
import { getMonthName, exportToPDF } from '../utils/helpers';
import { tasksAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function MonthlyTracker() {
  const { data, loading, year, month, goToPreviousMonth, goToNextMonth, goToCurrentMonth } = useMonthlyData();
  const [exporting, setExporting] = useState(false);
  const scrollRef = useRef(null);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Force a refresh after mutations
  const forceRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    // Scroll to today when month loads
    if (scrollRef.current && data) {
      const today = new Date().getDate();
      const cellWidth = 44;
      scrollRef.current.scrollLeft = Math.max(0, (today - 3) * cellWidth);
    }
  }, [data]);

  const handleExportPDF = async () => {
    setExporting(true);
    await exportToPDF('monthly-tracker-content', `productivity-${year}-${month}.pdf`);
    setExporting(false);
    toast.success('PDF exported successfully!');
  };

  const handleExportCSV = useCallback(async () => {
    try {
      const response = await tasksAPI.exportCSV(year, month);
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `productivity-${year}-${month}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('CSV exported!');
    } catch {
      toast.error('Export failed');
    }
  }, [year, month]);

  // NaN-safe month/year validation
  const safeMonth = typeof month === 'number' && month >= 1 && month <= 12 ? month : (new Date().getMonth() + 1);
  const safeYear = typeof year === 'number' && year >= 1900 ? year : new Date().getFullYear();
  const daysInMonth = data?.lastDay || 0;

  // Build day headers with proper chronological order: oldest LEFT, newest RIGHT
  // Example: Mon Tue Wed Thu Fri Sat Sun (today=Sunday, newest=right)
  const dayHeaders = useMemo(() => {
    // Guard against NaN or invalid dates
    if (!safeMonth || !safeYear || !daysInMonth || daysInMonth < 1) return [];

    const today = new Date();
    const headers = [];
    for (let i = 1; i <= daysInMonth; i++) {
      // month is 1-indexed, so month-1 for Date constructor (0-indexed)
      const date = new Date(safeYear, safeMonth - 1, i);
      // Validate the date is valid (not NaN)
      if (isNaN(date.getTime())) continue;

      headers.push({
        day: i,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        isToday: today.getFullYear() === safeYear && (today.getMonth() + 1) === safeMonth && today.getDate() === i,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        dateObj: date,
      });
    }
    return headers;
  }, [safeYear, safeMonth, daysInMonth]);

  // Toggle completion for a specific day
  const handleToggleDay = useCallback(async (taskId, day) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    try {
      await tasksAPI.toggleByDate(taskId, dateStr);
      forceRefresh();
    } catch (err) {
      toast.error('Failed to update');
    }
  }, [year, month, forceRefresh]);

  // Edit task
  const handleStartEdit = useCallback((task) => {
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
  }, []);

  const handleSaveEdit = useCallback(async (taskId) => {
    if (!editingTitle.trim()) {
      toast.error('Title cannot be empty');
      return;
    }
    try {
      await tasksAPI.update(taskId, { title: editingTitle.trim() });
      setEditingTaskId(null);
      setEditingTitle('');
      forceRefresh();
      toast.success('Task updated!');
    } catch {
      toast.error('Failed to update task');
    }
  }, [editingTitle, forceRefresh]);

  const handleCancelEdit = useCallback(() => {
    setEditingTaskId(null);
    setEditingTitle('');
  }, []);

  // Delete task
  const handleDeleteConfirm = useCallback(async (taskId) => {
    try {
      await tasksAPI.delete(taskId);
      setDeleteConfirmId(null);
      forceRefresh();
      toast.success('Task deleted!');
    } catch {
      toast.error('Failed to delete task');
    }
  }, [forceRefresh]);

  // Reorder tasks
  const handleMoveTask = useCallback(async (taskId, direction) => {
    if (!data?.tasks) return;
    const tasks = data.tasks;
    const currentIndex = tasks.findIndex(t => t.id === taskId);
    if (currentIndex === -1) return;

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= tasks.length) return;

    const task1 = tasks[currentIndex];
    const task2 = tasks[swapIndex];

    try {
      await tasksAPI.swapOrder(task1.id, task2.id);
      forceRefresh();
    } catch {
      toast.error('Failed to reorder');
    }
  }, [data, forceRefresh]);

  if (loading) {
    return <MonthlySkeleton />;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Monthly Tracker
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Track your daily task completion
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton onClick={handleExportPDF} loading={exporting} label="Export PDF" />
          <ExportButton onClick={handleExportCSV} loading={false} label="Export CSV" />
        </div>
      </div>

      {/* Month Navigation */}
      <div
        className="rounded-xl p-3 md:p-4 card-hover"
        style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
      >
        <div className="flex items-center justify-between">
          <NavButton onClick={goToPreviousMonth} icon={ChevronLeft} label="Previous month" />
          <div className="text-center">
            <h2 className="text-lg md:text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {getMonthName(safeMonth)} {safeYear}
            </h2>
            <button
              onClick={goToCurrentMonth}
              className="text-xs mt-0.5 font-medium transition-colors"
              style={{ color: 'var(--accent)' }}
              aria-label="Go to current month"
            >
              Today
            </button>
          </div>
          <NavButton onClick={goToNextMonth} icon={ChevronRight} label="Next month" />
        </div>
      </div>

      {/* Calendar Grid */}
      <div
        id="monthly-tracker-content"
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
      >
        {(!data?.tasks || data.tasks.length === 0) ? (
          <div className="empty-state">
            <Calendar size={40} style={{ color: 'var(--text-muted)' }} />
            <h3 className="text-base font-medium mt-3" style={{ color: 'var(--text-primary)' }}>
              No tasks to display
            </h3>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Create tasks first to see them here
            </p>
          </div>
        ) : (
          <div 
            className="monthly-tracker-wrapper" 
            ref={scrollRef} 
            key={refreshKey}
            style={{ '--monthly-days': daysInMonth }}
          >
            {/* Calendar grid using CSS Grid for perfect alignment */}
            <div className="monthly-tracker-grid">
              {/* Header row with column structure:
                  Column 0: Task Name (sticky)
                  Columns 1..N: Day columns (each has today indicator, day name, date, task cells) */}
              
              {/* Grid Header Row */}
              <div className="monthly-grid-row monthly-grid-header">
                {/* Task name header cell */}
                <div
                  className="monthly-grid-cell monthly-task-header sticky-col"
                  style={{
                    color: 'var(--text-primary)',
                    backgroundColor: 'var(--card-bg)',
                  }}
                >
                  <span className="text-xs font-semibold uppercase tracking-wider">Tasks</span>
                </div>

                {/* Day columns - CHRONOLOGICAL ORDER: oldest left, newest right */}
                {dayHeaders.map(({ day, dayName, isToday, isWeekend }) => (
                  <div
                    key={day}
                    className={`monthly-grid-cell monthly-day-header ${isToday ? 'is-today' : ''} ${isWeekend ? 'is-weekend' : ''}`}
                    style={{
                      color: isToday ? 'white' : isWeekend ? 'var(--text-muted)' : 'var(--text-secondary)',
                      backgroundColor: isToday ? 'var(--accent)' : 'transparent',
                    }}
                  >
                    {/* TODAY INDICATOR - TOPMOST element */}
                    {isToday && (
                      <span className="monthly-today-badge">TODAY</span>
                    )}
                    {/* Day of week (Sun, Mon, etc.) */}
                    <span className="monthly-day-name">{dayName}</span>
                    {/* Date number */}
                    <span className="monthly-date-num">{day}</span>
                  </div>
                ))}
              </div>

              {/* Task rows */}
              {data.tasks.map((task, taskIndex) => (
                <div key={task.id} className="monthly-grid-row monthly-grid-task-row">
                  {/* Task name cell - sticky with edit/delete/reorder controls */}
                  <div
                    className="monthly-grid-cell monthly-task-cell sticky-col"
                    style={{
                      color: 'var(--text-primary)',
                      backgroundColor: 'var(--card-bg)',
                    }}
                  >
                    <div className="monthly-task-controls">
                      {/* Reorder buttons */}
                      <div className="monthly-reorder-btns">
                        <button
                          onClick={() => handleMoveTask(task.id, 'up')}
                          disabled={taskIndex === 0}
                          className="monthly-reorder-btn"
                          aria-label="Move up"
                          style={{ color: 'var(--text-muted)', opacity: taskIndex === 0 ? 0.3 : 1 }}
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          onClick={() => handleMoveTask(task.id, 'down')}
                          disabled={taskIndex === data.tasks.length - 1}
                          className="monthly-reorder-btn"
                          aria-label="Move down"
                          style={{ color: 'var(--text-muted)', opacity: taskIndex === data.tasks.length - 1 ? 0.3 : 1 }}
                        >
                          <ChevronDown size={12} />
                        </button>
                      </div>

                      {/* Task title with inline editing */}
                      {editingTaskId === task.id ? (
                        <div className="monthly-edit-form">
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            className="monthly-edit-input"
                            style={{
                              backgroundColor: 'var(--bg-secondary)',
                              color: 'var(--text-primary)',
                              border: '1px solid var(--accent)',
                            }}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(task.id);
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                          />
                          <div className="monthly-edit-actions">
                            <button
                              onClick={() => handleSaveEdit(task.id)}
                              className="monthly-edit-save"
                              style={{ color: 'var(--success)' }}
                              aria-label="Save"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="monthly-edit-cancel"
                              style={{ color: 'var(--danger)' }}
                              aria-label="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <span
                            className="monthly-task-title"
                            title={task.title}
                            onClick={() => handleStartEdit(task)}
                          >
                            {task.title}
                          </span>
                          <div className="monthly-task-actions">
                            <button
                              onClick={() => handleStartEdit(task)}
                              className="monthly-action-btn"
                              aria-label="Edit task"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              <Edit2 size={12} />
                            </button>
                            {deleteConfirmId === task.id ? (
                              <div className="monthly-delete-confirm">
                                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Delete?</span>
                                <button
                                  onClick={() => handleDeleteConfirm(task.id)}
                                  className="monthly-action-btn"
                                  aria-label="Confirm delete"
                                  style={{ color: 'var(--danger)' }}
                                >
                                  <Check size={12} />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="monthly-action-btn"
                                  aria-label="Cancel delete"
                                  style={{ color: 'var(--text-muted)' }}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(task.id)}
                                className="monthly-action-btn"
                                aria-label="Delete task"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Day completion cells - one per day */}
                  {dayHeaders.map(({ day, isToday, isWeekend }) => {
                    const isCompleted = task.days?.[day];
                    return (
                      <div
                        key={`${task.id}-${day}`}
                        className={`monthly-grid-cell monthly-completion-cell ${isToday ? 'is-today' : ''} ${isWeekend ? 'is-weekend' : ''} ${isCompleted ? 'is-completed' : ''}`}
                        style={{
                          backgroundColor: isCompleted
                            ? 'var(--success)'
                            : isToday
                            ? 'rgba(59, 130, 246, 0.05)'
                            : isWeekend
                            ? 'rgba(100, 116, 139, 0.03)'
                            : 'transparent',
                        }}
                        onClick={() => handleToggleDay(task.id, day)}
                        role="button"
                        tabIndex={0}
                        aria-label={`Toggle ${task.title} for day ${day}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleToggleDay(task.id, day);
                          }
                        }}
                      >
                        {isCompleted ? (
                          <Check size={14} className="monthly-check-icon" style={{ color: 'white' }} />
                        ) : (
                          <span className="monthly-empty-dot" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ── */

const NavButton = memo(function NavButton({ onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className="p-2 rounded-lg transition-colors hover:bg-[var(--hover-bg)]"
      style={{ color: 'var(--text-secondary)' }}
      aria-label={label}
    >
      <Icon size={22} />
    </button>
  );
});

const ExportButton = memo(function ExportButton({ onClick, loading, label }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
      style={{
        backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)',
        border: '1px solid var(--border-color)',
      }}
      aria-label={label}
    >
      <Download size={14} />
      <span>{loading ? '...' : label}</span>
    </button>
  );
});

function MonthlySkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="skeleton skeleton-text-lg w-1/3" />
      <div className="skeleton skeleton-text w-1/4" />
      <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
        <div className="skeleton h-8 w-full" />
      </div>
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
        <div className="skeleton h-64 w-full" />
      </div>
    </div>
  );
}