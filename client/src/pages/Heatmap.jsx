import { useState, memo, useCallback, useMemo, useRef } from 'react';
import { Info } from 'lucide-react';
import { useHeatmap } from '../hooks/useTasks';
import { formatDate, getHeatmapColor } from '../utils/helpers';

export default function Heatmap() {
  console.log('Heatmap render');
  const { data, loading } = useHeatmap();
  const [tooltip, setTooltip] = useState(null);
  const tooltipRef = useRef(null);

  const dateMap = useMemo(() => {
    const map = {};
    data.forEach(d => { map[d.date] = d.percentage; });
    return map;
  }, [data]);

  const weeks = useMemo(() => {
    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const result = [];
    let currentDate = new Date(oneYearAgo);

    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek > 0) {
      currentDate.setDate(currentDate.getDate() - dayOfWeek);
    }

    while (currentDate <= today) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        const dateStr = currentDate.toISOString().split('T')[0];
        week.push({
          date: dateStr,
          percentage: dateMap[dateStr] || 0,
          isFuture: currentDate > today,
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      result.push(week);
    }
    return result;
  }, [dateMap]);

  const stats = useMemo(() => {
    const totalDays = data.length;
    const daysWithActivity = data.filter(d => d.percentage > 0).length;
    const average = totalDays > 0
      ? Math.round(data.reduce((sum, d) => sum + d.percentage, 0) / totalDays)
      : 0;
    const best = data.reduce((best, d) =>
      (d.percentage > (best?.percentage || 0)) ? d : best, data[0]
    );
    return { totalDays, daysWithActivity, average, best };
  }, [data]);

  // Stable tooltip positioning - no layout shift
  const showTooltip = useCallback((day, clientX, clientY) => {
    if (!day.isFuture) {
      setTooltip({
        date: day.date,
        percentage: day.percentage,
        clientX,
        clientY,
      });
    }
  }, []);

  const hideTooltip = useCallback(() => setTooltip(null), []);

  // Handle touch for mobile - prevent page shake
  const handleTouchStart = useCallback((e, day) => {
    if (!day.isFuture) {
      e.preventDefault(); // Prevent any default behavior that might cause scroll
      const touch = e.touches[0];
      showTooltip(day, touch.clientX, touch.clientY - 10);
      // Auto-hide after 1.5s on mobile
      setTimeout(hideTooltip, 1500);
    }
  }, [showTooltip, hideTooltip]);

  if (loading) {
    return <HeatmapSkeleton />;
  }

  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Activity Heatmap
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          Past year of productivity at a glance
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Active Days" value={stats.daysWithActivity} sub={`Out of ${stats.totalDays} days`} />
        <StatCard label="Average Daily" value={`${stats.average}%`} sub="Completion rate" />
        <StatCard label="Best Day" value={stats.best ? `${stats.best.percentage}%` : 'N/A'} sub={stats.best ? formatDate(stats.best.date) : 'No data'} />
      </div>

      {/* Heatmap */}
      <div
        className="rounded-xl p-4 md:p-6"
        style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Info size={14} style={{ color: 'var(--text-muted)' }} />
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Darker = higher completion
          </p>
        </div>

        <div className="overflow-x-auto pb-2 stable-layout">
          <div className="flex gap-1" style={{ minWidth: '700px' }}>
            {/* Day labels */}
            <div className="flex flex-col gap-[3px] mr-2">
              {dayLabels.map((label, i) => (
                <div key={i} className="h-[14px] text-[10px] leading-[14px]" style={{ color: 'var(--text-muted)' }}>
                  {label}
                </div>
              ))}
            </div>

            {/* Weeks */}
            <div className="flex gap-[3px]">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-[3px]">
                  {week.map((day, dayIndex) => (
                    <div
                      key={dayIndex}
                      className="heatmap-cell"
                      style={{
                        backgroundColor: day.isFuture ? 'transparent' : getHeatmapColor(day.percentage),
                        border: day.percentage > 0 ? 'none' : '1px solid var(--border-color)',
                      }}
                      onMouseEnter={(e) => showTooltip(day, e.clientX, e.clientY)}
                      onMouseLeave={hideTooltip}
                      onTouchStart={(e) => handleTouchStart(e, day)}
                      role="gridcell"
                      aria-label={`${formatDate(day.date)}: ${day.percentage}% completion`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-4 justify-end">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Less</span>
          {[0, 25, 50, 75, 100].map(pct => (
            <div
              key={pct}
              className="heatmap-cell"
              style={{
                backgroundColor: pct === 0 ? 'transparent' : getHeatmapColor(pct),
                border: pct === 0 ? '1px solid var(--border-color)' : 'none',
              }}
            />
          ))}
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>More</span>
        </div>
      </div>

      {/* Tooltip - fixed positioning, no layout shift */}
      {tooltip && (
        <TooltipBox 
          date={tooltip.date} 
          percentage={tooltip.percentage} 
          clientX={tooltip.clientX} 
          clientY={tooltip.clientY}
          ref={tooltipRef}
        />
      )}
    </div>
  );
}

/* ── Sub-components ── */

const StatCard = memo(function StatCard({ label, value, sub }) {
  return (
    <div
      className="rounded-xl p-4 card-hover animate-fade-in"
      style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
    >
      <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <p className="text-xl md:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>
    </div>
  );
});

function TooltipBox({ date, percentage, clientX, clientY }) {
  // Use fixed positioning with transform for stable, non-shifting tooltip
  return (
    <div
      className="heatmap-tooltip px-2.5 py-1.5 rounded-lg shadow-lg text-xs animate-scale-in"
      style={{
        left: `${clientX}px`,
        top: `${clientY}px`,
        backgroundColor: 'var(--bg-tertiary)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border-color)',
        transform: 'translate(-50%, -100%)',
        marginTop: '-8px',
      }}
    >
      <p className="font-medium">{formatDate(date)}</p>
      <p className="opacity-70">{percentage}% complete</p>
    </div>
  );
}

function HeatmapSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="skeleton skeleton-text-lg w-1/3" />
      <div className="skeleton skeleton-text w-1/2" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[1,2,3].map(i => <div key={i} className="skeleton skeleton-card rounded-xl" />)}
      </div>
      <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
        <div className="skeleton h-48 w-full" />
      </div>
    </div>
  );
}