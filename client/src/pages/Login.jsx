import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--accent)' }}>
              <BarChart3 size={28} className="text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Welcome Back
          </h1>
          <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>
            Sign in to track your daily productivity
          </p>
        </div>

        {/* Login Form */}
        <div className="rounded-xl p-8 shadow-lg animate-fade-in"
          style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                Email
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-lg text-sm outline-none transition-all duration-200"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                Password
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full pl-10 pr-12 py-3 rounded-lg text-sm outline-none transition-all duration-200"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg text-white font-medium transition-all duration-200"
              style={{
                backgroundColor: loading ? 'var(--text-muted)' : 'var(--accent)',
              }}
              onMouseEnter={(e) => {
                if (!loading) e.target.style.backgroundColor = 'var(--accent-hover)';
              }}
              onMouseLeave={(e) => {
                if (!loading) e.target.style.backgroundColor = 'var(--accent)';
              }}
            >
              {loading ? '🚀 Waking up server...' : 'Sign In'}
            </button>
          </form>

          {loading && (
  <div
    className="mt-4 p-3 rounded-lg text-sm text-center animate-pulse"
    style={{
      backgroundColor: 'var(--bg-secondary)',
      color: 'var(--text-secondary)',
      border: '1px solid var(--border-color)',
    }}
  >
    <p className="font-medium">🚀 Connecting to server...</p>
    <p className="mt-1 text-xs">
      The backend may be waking up from sleep.
      This can take up to 50 seconds on the first visit.
    </p>
  </div>
)}

          <div className="mt-6 text-center">
            <p style={{ color: 'var(--text-secondary)' }} className="text-sm">
              Don't have an account?{' '}
              <Link to="/register" style={{ color: 'var(--accent)' }} className="font-medium hover:underline">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}