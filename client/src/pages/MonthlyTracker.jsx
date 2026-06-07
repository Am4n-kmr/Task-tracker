import { useState, memo, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Check, Download, Calendar } from 'lucide-react';
import { useMonthlyData } from '../hooks/useTasks';
import { getMonthName, exportToPDF } from '../utils/helpers';
import { tasksAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function MonthlyTracker() {
  const { data, loading, year, month, goToPreviousMonth, goToNextMonth, goToCurrentMonth } = useMonthlyData();
  const [exporting, setExporting] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    // Scroll to today when month loads
    if (scrollRef.current && data) {
      const today = new Date().getDate();
      const cellWidth = 40;
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

  const daysInMonth = data?.lastDay || 0;

  // Build day headers with day names
  const dayHeaders = useMemo(() => {
    const today = new Date();
    const headers = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month - 1, i);
      headers.push({
        day: i,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        isToday: today.getFullYear() === year && (today.getMonth() + 1) === month && today.getDate() === i,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
      });
    }
    return headers;
  }, [year, month, daysInMonth]);

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
              {getMonthName(month)} {year}
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
          <div className="monthly-tracker-wrapper" ref={scrollRef}>
            {/* Header row with sticky date header */}
            <div
              className="monthly-tracker-header flex border-b"
              style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--card-bg)' }}
            >
              <div
                className="flex-shrink-0 p-3 text-sm font-medium sticky left-0 z-10"
                style={{
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--card-bg)',
                  width: '180px',
                  minWidth: '180px',
                }}
              >
                Tasks ↓ / Days →
              </div>
              <div className="flex">
                {dayHeaders.map(({ day, dayName, isToday, isWeekend }) => (
                  <div
                    key={day}
                    className="flex-shrink-0 flex flex-col items-center justify-center p-1 text-center text-xs font-medium"
                    style={{
                      width: '40px',
                      minWidth: '40px',
                      color: isToday ? 'white' : isWeekend ? 'var(--text-muted)' : 'var(--text-secondary)',
                      backgroundColor: isToday ? 'var(--accent)' : 'transparent',
                      borderRadius: isToday ? '4px 4px 0 0' : '0',
                    }}
                  >
                    <span>{day}</span>
                    <span className="text-[9px] opacity-70">{dayName}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Task rows */}
            {data.tasks.map(task => (
              <div
                key={task.id}
                className="flex border-b card-hover"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div
                  className="flex-shrink-0 p-3 text-sm font-medium truncate sticky left-0 z-10 monthly-tracker-task-name"
                  style={{
                    color: 'var(--text-primary)',
                    backgroundColor: 'var(--card-bg)',
                    width: '180px',
                    minWidth: '180px',
                  }}
                  title={task.title}
                >
                  {task.title}
                </div>
                <div className="flex">
                  {dayHeaders.map(({ day, isToday, isWeekend }) => {
                    const isCompleted = task.days?.[day];
                    return (
                      <div
                        key={day}
                        className="flex-shrink-0 flex items-center justify-center"
                        style={{
                          width: '40px',
                          minWidth: '40px',
                          height: '36px',
                          backgroundColor: isCompleted ? 'var(--success)' : isToday ? 'rgba(59, 130, 246, 0.05)' : isWeekend ? 'rgba(100, 116, 139, 0.03)' : 'transparent',
                        }}
                      >
                        {isCompleted && <Check size={12} className="text-white" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
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