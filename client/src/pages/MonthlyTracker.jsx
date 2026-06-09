import { useState, memo, useRef, useEffect, useCallback, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Download,
  Calendar,
  Edit2,
  X,
  Trash2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useMonthlyData, useTasks } from "../hooks/useTasks";
import { getMonthName, exportToPDF } from "../utils/helpers";
import { tasksAPI } from "../services/api";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

export default function MonthlyTracker() {
  const {
    data,
    loading,
    year,
    month,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
  } = useMonthlyData();
  const { toggleByDate, deleteTask, updateTask } = useTasks();
  const queryClient = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const scrollRef = useRef(null);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Scroll to today when month loads
  useEffect(() => {
    if (scrollRef.current && data) {
      const today = new Date().getDate();
      const cellWidth = 44;
      scrollRef.current.scrollLeft = Math.max(0, (today - 3) * cellWidth);
    }
  }, [data]);

  const handleExportPDF = async () => {
    setExporting(true);
    await exportToPDF(
      "monthly-tracker-content",
      `productivity-${year}-${month}.pdf`,
    );
    setExporting(false);
    toast.success("PDF exported successfully!");
  };

  const handleExportCSV = useCallback(async () => {
    try {
      const response = await tasksAPI.exportCSV(year, month);
      const blob = new Blob([response.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `productivity-${year}-${month}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("CSV exported!");
    } catch {
      toast.error("Export failed");
    }
  }, [year, month]);

  // NaN-safe month/year validation
  const safeMonth =
    typeof month === "number" && month >= 1 && month <= 12
      ? month
      : new Date().getMonth() + 1;
  const safeYear =
    typeof year === "number" && year >= 1900 ? year : new Date().getFullYear();
  const daysInMonth = data?.lastDay || 0;

  // Build day headers with proper chronological order: oldest LEFT, newest RIGHT
  const dayHeaders = useMemo(() => {
    if (!safeMonth || !safeYear || !daysInMonth || daysInMonth < 1) return [];

    const today = new Date();
    const headers = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(safeYear, safeMonth - 1, i);
      if (isNaN(date.getTime())) continue;

      headers.push({
        day: i,
        dayName: date.toLocaleDateString("en-US", { weekday: "short" }),
        isToday:
          today.getFullYear() === safeYear &&
          today.getMonth() + 1 === safeMonth &&
          today.getDate() === i,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        dateObj: date,
      });
    }
    return headers;
  }, [safeYear, safeMonth, daysInMonth]);

  // Toggle completion for a specific day - uses optimistic cache-driven mutation
  const handleToggleDay = useCallback(
    async (taskId, day) => {
      const dateStr = `${safeYear}-${String(safeMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      await toggleByDate(taskId, dateStr);
    },
    [safeYear, safeMonth, toggleByDate],
  );

  // Edit task
  const handleStartEdit = useCallback((task) => {
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
  }, []);

  const handleSaveEdit = useCallback(
    async (taskId) => {
      if (!editingTitle.trim()) {
        toast.error("Title cannot be empty");
        return;
      }
      await updateTask(taskId, editingTitle.trim());
      setEditingTaskId(null);
      setEditingTitle("");
    },
    [editingTitle, updateTask],
  );

  const handleCancelEdit = useCallback(() => {
    setEditingTaskId(null);
    setEditingTitle("");
  }, []);

  // Delete task
  const handleDeleteConfirm = useCallback(
    async (taskId) => {
      await deleteTask(taskId);
      setDeleteConfirmId(null);
    },
    [deleteTask],
  );

  // Reorder tasks
  const handleMoveTask = useCallback(
    async (taskId, direction) => {
      if (!data?.tasks) return;
      const tasks = data.tasks;
      const currentIndex = tasks.findIndex((t) => t.id === taskId);
      if (currentIndex === -1) return;

      const swapIndex =
        direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (swapIndex < 0 || swapIndex >= tasks.length) return;

      const task1 = tasks[currentIndex];
      const task2 = tasks[swapIndex];

      // Optimistic reorder in cache
      const monthlyKey = ["monthly", safeYear, safeMonth];
      const monthlyData = queryClient.getQueryData(monthlyKey);
      if (monthlyData?.tasks) {
        const reordered = [...monthlyData.tasks];
        [reordered[currentIndex], reordered[swapIndex]] = [
          reordered[swapIndex],
          reordered[currentIndex],
        ];
        queryClient.setQueryData(monthlyKey, {
          ...monthlyData,
          tasks: reordered,
        });
      }

      try {
        await tasksAPI.swapOrder(task1.id, task2.id);
      } catch {
        // Rollback
        if (monthlyData?.tasks) {
          queryClient.setQueryData(monthlyKey, monthlyData);
        }
        toast.error("Failed to reorder");
      }
    },
    [data, queryClient, safeYear, safeMonth],
  );

  if (loading) {
    return <MonthlySkeleton />;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1
            className="text-xl md:text-2xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Monthly Tracker
          </h1>
          <p
            className="text-sm mt-0.5"
            style={{ color: "var(--text-secondary)" }}
          >
            Track your daily task completion
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            onClick={handleExportPDF}
            loading={exporting}
            label="Export PDF"
          />
          <ExportButton
            onClick={handleExportCSV}
            loading={false}
            label="Export CSV"
          />
        </div>
      </div>

      {/* Month Navigation */}
      <div
        className="rounded-xl p-3 md:p-4 card-hover"
        style={{
          backgroundColor: "var(--card-bg)",
          border: "1px solid var(--border-color)",
        }}
      >
        <div className="flex items-center justify-between">
          <NavButton
            onClick={goToPreviousMonth}
            icon={ChevronLeft}
            label="Previous month"
          />
          <div className="text-center">
            <h2
              className="text-lg md:text-xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {getMonthName(safeMonth)} {safeYear}
            </h2>
            <button
              onClick={goToCurrentMonth}
              className="text-xs mt-0.5 font-medium transition-colors"
              style={{ color: "var(--accent)" }}
              aria-label="Go to current month"
            >
              Today
            </button>
          </div>
          <NavButton
            onClick={goToNextMonth}
            icon={ChevronRight}
            label="Next month"
          />
        </div>
      </div>

      {/* Calendar Grid */}
      <div
        id="monthly-tracker-content"
        className="rounded-xl overflow-hidden"
        style={{
          backgroundColor: "var(--card-bg)",
          border: "1px solid var(--border-color)",
        }}
      >
        {!data?.tasks || data.tasks.length === 0 ? (
          <div className="empty-state">
            <Calendar size={40} style={{ color: "var(--text-muted)" }} />
            <h3
              className="text-base font-medium mt-3"
              style={{ color: "var(--text-primary)" }}
            >
              No tasks to display
            </h3>
            <p
              className="text-sm mt-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Create tasks first to see them here
            </p>
          </div>
        ) : (
          <div
            className="monthly-tracker-wrapper"
            ref={scrollRef}
            style={{ "--monthly-days": daysInMonth }}
          >
            <div className="monthly-tracker-grid">
              {/* Grid Header Row */}
              <div className="monthly-grid-row monthly-grid-header">
                <div
                  className="monthly-grid-cell monthly-task-header sticky-col"
                  style={{
                    color: "var(--text-primary)",
                    backgroundColor: "var(--card-bg)",
                  }}
                >
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Tasks
                  </span>
                </div>

                {dayHeaders.map(({ day, dayName, isToday, isWeekend }) => (
                  <div
                    key={day}
                    className={`monthly-grid-cell monthly-day-header ${isToday ? "is-today" : ""} ${isWeekend ? "is-weekend" : ""}`}
                    style={{
                      color: isToday
                        ? "white"
                        : isWeekend
                          ? "var(--text-muted)"
                          : "var(--text-secondary)",
                      backgroundColor: isToday
                        ? "var(--accent)"
                        : "transparent",
                    }}
                  >
                    {isToday && (
                      <span className="monthly-today-badge">TODAY</span>
                    )}
                    <span className="monthly-day-name">{dayName}</span>
                    <span className="monthly-date-num">{day}</span>
                  </div>
                ))}
              </div>

              {/* Task rows */}
              {data.tasks.map((task, taskIndex) => (
                <MonthlyTaskRow
                  key={task.id}
                  task={task}
                  taskIndex={taskIndex}
                  totalTasks={data.tasks.length}
                  dayHeaders={dayHeaders}
                  onToggleDay={handleToggleDay}
                  onStartEdit={handleStartEdit}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={handleCancelEdit}
                  onDeleteConfirm={handleDeleteConfirm}
                  editingTaskId={editingTaskId}
                  editingTitle={editingTitle}
                  setEditingTitle={setEditingTitle}
                  deleteConfirmId={deleteConfirmId}
                  setDeleteConfirmId={setDeleteConfirmId}
                  onMoveTask={handleMoveTask}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Extracted Task Row for memoization ── */
const MonthlyTaskRow = memo(
  function MonthlyTaskRow({
    task,
    taskIndex,
    totalTasks,
    dayHeaders,
    onToggleDay,
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    onDeleteConfirm,
    editingTaskId,
    editingTitle,
    setEditingTitle,
    deleteConfirmId,
    setDeleteConfirmId,
    onMoveTask,
  }) {
    const isEditing = editingTaskId === task.id;

    return (
      <div className="monthly-grid-row monthly-grid-task-row">
        {/* Task name cell */}
        <div
          className="monthly-grid-cell monthly-task-cell sticky-col"
          style={{
            color: "var(--text-primary)",
            backgroundColor: "var(--card-bg)",
          }}
        >
          <div className="monthly-task-controls">
            <div className="monthly-reorder-btns">
              <button
                onClick={() => onMoveTask(task.id, "up")}
                disabled={taskIndex === 0}
                className="monthly-reorder-btn"
                aria-label="Move up"
                style={{
                  color: "var(--text-muted)",
                  opacity: taskIndex === 0 ? 0.3 : 1,
                }}
              >
                <ChevronUp size={12} />
              </button>
              <button
                onClick={() => onMoveTask(task.id, "down")}
                disabled={taskIndex === totalTasks - 1}
                className="monthly-reorder-btn"
                aria-label="Move down"
                style={{
                  color: "var(--text-muted)",
                  opacity: taskIndex === totalTasks - 1 ? 0.3 : 1,
                }}
              >
                <ChevronDown size={12} />
              </button>
            </div>

            {isEditing ? (
              <div className="monthly-edit-form">
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  className="monthly-edit-input"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--accent)",
                  }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSaveEdit(task.id);
                    if (e.key === "Escape") onCancelEdit();
                  }}
                />
                <div className="monthly-edit-actions">
                  <button
                    onClick={() => onSaveEdit(task.id)}
                    className="monthly-edit-save"
                    style={{ color: "var(--success)" }}
                    aria-label="Save"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={onCancelEdit}
                    className="monthly-edit-cancel"
                    style={{ color: "var(--danger)" }}
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
                  onClick={() => onStartEdit(task)}
                >
                  {task.title}
                </span>
                <div className="monthly-task-actions">
                  <button
                    onClick={() => onStartEdit(task)}
                    className="monthly-action-btn"
                    aria-label="Edit task"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <Edit2 size={12} />
                  </button>
                  {deleteConfirmId === task.id ? (
                    <div className="monthly-delete-confirm">
                      <span
                        className="text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Delete?
                      </span>
                      <button
                        onClick={() => onDeleteConfirm(task.id)}
                        className="monthly-action-btn"
                        aria-label="Confirm delete"
                        style={{ color: "var(--danger)" }}
                      >
                        <Check size={12} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="monthly-action-btn"
                        aria-label="Cancel delete"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(task.id)}
                      className="monthly-action-btn"
                      aria-label="Delete task"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Day completion cells */}
        {dayHeaders.map(({ day, isToday, isWeekend }) => {
          const isCompleted = task.days?.[day];
          return (
            <div
              key={`${task.id}-${day}`}
              className={`monthly-grid-cell monthly-completion-cell ${isToday ? "is-today" : ""} ${isWeekend ? "is-weekend" : ""} ${isCompleted ? "is-completed" : ""}`}
              style={{
                cursor: "default",
                backgroundColor: isCompleted
                  ? "var(--success)"
                  : isToday
                    ? "rgba(59, 130, 246, 0.05)"
                    : isWeekend
                      ? "rgba(100, 116, 139, 0.03)"
                      : "transparent",
              }}
              role="gridcell"
              aria-label={`${task.title} on day ${day}`}
            >
              {isCompleted ? (
                <Check
                  size={14}
                  className="monthly-check-icon"
                  style={{ color: "white" }}
                />
              ) : (
                <span className="monthly-empty-dot" />
              )}
            </div>
          );
        })}
      </div>
    );
  },
  (prev, next) => {
    // Custom comparator: only re-render if task data or editing/delete state changed
    if (prev.task.id !== next.task.id) return false;
    if (prev.task.title !== next.task.title) return false;
    if (prev.taskIndex !== next.taskIndex) return false;
    if (prev.editingTaskId !== next.editingTaskId) return false;
    if (prev.editingTitle !== next.editingTitle) return false;
    if (prev.deleteConfirmId !== next.deleteConfirmId) return false;
    // Deep compare days
    const prevDays = prev.task.days;
    const nextDays = next.task.days;
    if (!prevDays && !nextDays) return true;
    if (!prevDays || !nextDays) return false;
    const prevKeys = Object.keys(prevDays);
    const nextKeys = Object.keys(nextDays);
    if (prevKeys.length !== nextKeys.length) return false;
    for (const key of prevKeys) {
      if (prevDays[key] !== nextDays[key]) return false;
    }
    return true;
  },
);

/* ── Sub-components ── */

const NavButton = memo(function NavButton({ onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className="p-2 rounded-lg transition-colors hover:bg-[var(--hover-bg)]"
      style={{ color: "var(--text-secondary)" }}
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
        backgroundColor: "var(--card-bg)",
        color: "var(--text-primary)",
        border: "1px solid var(--border-color)",
      }}
      aria-label={label}
    >
      <Download size={14} />
      <span>{loading ? "..." : label}</span>
    </button>
  );
});

function MonthlySkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="skeleton skeleton-text-lg w-1/3" />
      <div className="skeleton skeleton-text w-1/4" />
      <div
        className="rounded-xl p-4"
        style={{
          backgroundColor: "var(--card-bg)",
          border: "1px solid var(--border-color)",
        }}
      >
        <div className="skeleton h-8 w-full" />
      </div>
      <div
        className="rounded-xl overflow-hidden"
        style={{
          backgroundColor: "var(--card-bg)",
          border: "1px solid var(--border-color)",
        }}
      >
        <div className="skeleton h-64 w-full" />
      </div>
    </div>
  );
}
