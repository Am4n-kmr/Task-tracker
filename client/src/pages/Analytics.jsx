import { useState, memo, useMemo } from 'react';
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
import {
  TrendingUp,
  Flame,
  Trophy,
  Target,
  ChevronLeft,
  ChevronRight,
  Download
} from 'lucide-react';
import { useAnalytics } from '../hooks/useTasks';
import { getMonthName, exportToPDF } from '../utils/helpers';
import toast from 'react-hot-toast';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

export default function Analytics() {
  console.log('Analytics render');
  const { data, loading, selectedYear, selectedMonth, setSelectedYear, setSelectedMonth } = useAnalytics();
  const [exporting, setExporting] = useState(false);
  const { theme } = useTheme();

  // Theme-aware chart colors
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
    };
  }, [theme]);

  const chartData = useMemo(() => ({
    labels: data?.dailyChartData?.map(d => `${d.day}`) || [],
    datasets: [{
      label: 'Daily %',
      data: data?.dailyChartData?.map(d => d.percentage) || [],
      fill: true,
      borderColor: chartColors.border,
      backgroundColor: chartColors.fill,
      tension: 0.3,
      pointBackgroundColor: chartColors.point,
      pointBorderColor: chartColors.tooltipBg,
      pointBorderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 6,
      borderWidth: 2.5,
    }],
  }), [data, chartColors]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 750,
      easing: 'easeOutQuart',
    },
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: `${getMonthName(selectedMonth)} ${selectedYear}`,
        color: chartColors.titleColor,
        font: { size: 14, family: 'Inter, sans-serif', weight: '600' },
        padding: { bottom: 16 },
      },
      tooltip: {
        backgroundColor: chartColors.tooltipBg,
        titleColor: chartColors.titleColor,
        bodyColor: chartColors.bodyColor,
        borderColor: chartColors.tooltipBorder,
        borderWidth: 1,
        padding: 12,
        cornerRadius: 10,
        displayColors: false,
        callbacks: { 
          label: (ctx) => `${ctx.parsed.y}% completion`,
          title: (ctx) => `Day ${ctx[0].label}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: chartColors.tick, font: { size: 11 }, maxTicksLimit: 12 },
      },
      y: {
        min: 0,
        max: 100,
        grid: { color: chartColors.grid, drawBorder: false },
        ticks: { color: chartColors.tick, font: { size: 11 }, callback: (v) => `${v}%` },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index',
    },
  }), [selectedMonth, selectedYear, chartColors]);

  const handleExportPDF = async () => {
    setExporting(true);
    await exportToPDF('analytics-content', `analytics-${selectedYear}-${selectedMonth}.pdf`);
    setExporting(false);
    toast.success('Report exported!');
  };

  const goBack = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(p => p - 1); }
    else setSelectedMonth(p => p - 1);
  };

  const goForward = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(p => p + 1); }
    else setSelectedMonth(p => p + 1);
  };

  if (loading) return <AnalyticsSkeleton />;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Analytics
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Detailed productivity insights
          </p>
        </div>
        <button
          onClick={handleExportPDF}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
          aria-label="Export report"
        >
          <Download size={14} />
          <span>{exporting ? '...' : 'Export'}</span>
        </button>
      </div>

      {/* Month Nav - theme-aware text color */}
      <div
        className="rounded-xl p-3"
        style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
      >
        <div className="flex items-center justify-between">
          <NavBtn onClick={goBack} icon={ChevronLeft} label="Previous month" />
          <h2 className="text-base md:text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {getMonthName(selectedMonth)} {selectedYear}
          </h2>
          <NavBtn onClick={goForward} icon={ChevronRight} label="Next month" />
        </div>
      </div>

      {/* Key Metrics */}
      <div id="analytics-content" className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard icon={TrendingUp} label="Monthly" value={`${data?.monthlyCompletionPercentage || 0}%`} sub={`${data?.totalTasks || 0} tasks`} />
          <MetricCard icon={Flame} label="Streak" value={`${data?.currentStreak || 0}d`} sub="Current" />
          <MetricCard icon={Trophy} label="Best Streak" value={`${data?.longestStreak || 0}d`} sub="All time" />
          <MetricCard icon={Target} label="Total Tasks" value={data?.totalTasks || 0} sub={`${data?.totalDaysInMonth || 0} days`} />
        </div>

        {/* Chart */}
        <div
          className="rounded-xl p-4 md:p-5"
          style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
        >
          <div className="chart-container">
            {data?.dailyChartData?.length > 0 ? (
              <Line data={chartData} options={chartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No data to display</p>
              </div>
            )}
          </div>
        </div>

        {/* Task Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TaskStatCard
            title="Most Completed"
            task={data?.mostCompleted}
            color="var(--success)"
            suffix="times"
          />
          <TaskStatCard
            title="Least Completed"
            task={data?.leastCompleted}
            color="var(--warning)"
            suffix="times"
          />
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

const NavBtn = memo(function NavBtn({ onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick} className="p-2 rounded-lg transition-colors hover:bg-[var(--hover-bg)]" style={{ color: 'var(--text-secondary)' }} aria-label={label}>
      <Icon size={20} />
    </button>
  );
});

const MetricCard = memo(function MetricCard({ icon: Icon, label, value, sub }) {
  return (
    <div
      className="rounded-xl p-3 md:p-4 card-hover"
      style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <Icon size={14} style={{ color: 'var(--accent)' }} />
        </div>
      </div>
      <p className="text-lg md:text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>
    </div>
  );
});

const TaskStatCard = memo(function TaskStatCard({ title, task, color, suffix }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
    >
      <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{title}</h3>
      {task ? (
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{task.title}</p>
          <p className="text-xs mt-1" style={{ color }}>
            Completed {task.completion_count} {suffix}
          </p>
        </div>
      ) : (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No data</p>
      )}
    </div>
  );
});

function AnalyticsSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="skeleton skeleton-text-lg w-1/4" />
      <div className="skeleton skeleton-text w-1/3" />
      <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
        <div className="skeleton h-8 w-full" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1,2,3,4].map(i => <div key={i} className="skeleton skeleton-card rounded-xl" />)}
      </div>
      <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
        <div className="skeleton h-48 w-full" />
      </div>
    </div>
  );
}