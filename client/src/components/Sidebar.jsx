import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Calendar, 
  BarChart3, 
  Grid3x3,
  LogOut,
  Sun,
  Moon,
  Waves,
  User,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useState, useEffect } from 'react';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/monthly-tracker', icon: Calendar, label: 'Monthly Tracker' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/heatmap', icon: Grid3x3, label: 'Heatmap' },
];

export default function Sidebar() {
  console.log('Sidebar render');
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();

  // Handle escape key to close sidebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isMobileOpen) {
        setIsMobileOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileOpen]);

  const handleLogout = () => {
    logout();
    setIsMobileOpen(false);
  };

  const themeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Waves;
  const themeLabel = theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'Navy';

  const handleMobileToggle = () => {
    setIsMobileOpen(prev => !prev);
  };

  return (
    <>
      {/* Mobile hamburger - fixed positioning with proper z-index */}
      <button
        onClick={handleMobileToggle}
        className="lg:hidden fixed top-4 left-4 z-[60] p-2 rounded-lg transition-all duration-200"
        style={{ 
          backgroundColor: 'var(--accent)', 
          color: 'white',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        }}
        aria-label={isMobileOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isMobileOpen}
      >
        {isMobileOpen ? <X size={24} className="transition-transform duration-300" /> : <Menu size={24} />}
      </button>

      {/* Overlay for mobile - proper z-index hierarchy */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-[50] transition-opacity duration-300"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - smooth slide animation with proper z-index */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-[55] w-64
          transform transition-transform duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
          flex flex-col
        `}
        style={{ 
          backgroundColor: 'var(--sidebar-bg)', 
          color: 'var(--sidebar-text)',
          boxShadow: isMobileOpen ? '0 0 40px rgba(0, 0, 0, 0.3)' : 'none',
        }}
      >
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--accent)' }}>
              <BarChart3 size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">TaskTracker</h1>
              <p className="text-xs opacity-70">Daily Productivity</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium
                  transition-all duration-200
                `}
                style={{
                  backgroundColor: isActive ? 'var(--sidebar-hover)' : 'transparent',
                  color: isActive ? 'white' : 'var(--sidebar-text)',
                  opacity: isActive ? 1 : 0.7,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.target.style.backgroundColor = 'var(--sidebar-hover)';
                  e.target.style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.target.style.backgroundColor = 'transparent';
                  e.target.style.opacity = '0.7';
                }}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-white/10 space-y-3">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200"
            style={{
              color: 'var(--sidebar-text)',
              opacity: 0.7,
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'var(--sidebar-hover)';
              e.target.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.opacity = '0.7';
            }}
          >
            {themeIcon === Sun ? <Sun size={20} /> : themeIcon === Moon ? <Moon size={20} /> : <Waves size={20} />}
            <span>{themeLabel} Mode</span>
          </button>

          {/* User info */}
          {user && (
            <div className="flex items-center gap-3 px-4 py-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--accent)' }}>
                <User size={16} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs opacity-70 truncate">{user.email}</p>
              </div>
            </div>
          )}

          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200"
            style={{
              color: '#ef4444',
              opacity: 0.8,
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
              e.target.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.opacity = '0.8';
            }}
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
