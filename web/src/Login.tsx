import React, { useState } from 'react';
import type { FormEvent } from 'react';
import { ShieldAlert, Lock, User, Loader2 } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (username: string) => void;
}

// Read base URL from environment variable, fallback to live Render backend URL
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://aquasense-backend-osmi.onrender.com';

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Authentication failed.');
      }

      onLoginSuccess(data.username);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Cannot connect to backend gateway server.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.loginContainer}>
      <div style={styles.loginCard}>
        {/* Portal Branding Header */}
        <div style={styles.brandHeader}>
          <div style={styles.logoBadge}>
            <svg
              style={{ width: '24px', height: '24px', color: '#ffffff' }}
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 21.5c-3.03 0-5.5-2.47-5.5-5.5 0-2.88 2.31-5.69 5.25-9.33.13-.16.35-.16.49 0 2.94 3.64 5.25 6.45 5.25 9.33 0 3.03-2.47 5.5-5.5 5.5z" />
            </svg>
          </div>
          <h2 style={styles.mainTitle}>AquaSense</h2>
          <p style={styles.subTitle}>MANAGEMENT PORTAL</p>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div style={styles.errorAlert}>
            <ShieldAlert size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Interactive Form */}
        <form onSubmit={handleSubmit} style={styles.formContainer}>
          <div style={styles.inputGroup}>
            <label style={styles.inputLabel}>ADMINISTRATION USER</label>
            <div style={styles.inputWrapper}>
              <User size={16} color="#94a3b8" style={styles.inputIcon} />
              <input
                type="text"
                required
                disabled={isLoading}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                style={styles.textInput}
              />
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.inputLabel}>SECURITY ACCESS PASSWORD</label>
            <div style={styles.inputWrapper}>
              <Lock size={16} color="#94a3b8" style={styles.inputIcon} />
              <input
                type="password"
                required
                disabled={isLoading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                style={styles.textInput}
              />
            </div>
          </div>

          <button type="submit" disabled={isLoading} style={styles.submitBtn}>
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              'Establish Secure Session'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loginContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    width: '100vw',
    backgroundColor: '#f8fafc',
    fontFamily: 'sans-serif',
    boxSizing: 'border-box',
  },
  loginCard: {
    width: '100%',
    maxWidth: '420px',
    backgroundColor: '#ffffff',
    padding: '40px',
    borderRadius: '24px',
    boxShadow:
      '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02)',
    border: '1px solid #e2e8f0',
    margin: '0 16px',
    boxSizing: 'border-box',
  },
  brandHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '32px',
  },
  logoBadge: {
    width: '48px',
    height: '48px',
    borderRadius: '16px',
    backgroundColor: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '12px',
    boxShadow: '0 10px 15px -3px rgba(15, 23, 42, 0.1)',
  },
  mainTitle: {
    margin: 0,
    fontSize: '22px',
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: '-0.025em',
  },
  subTitle: {
    margin: '4px 0 0 0',
    fontSize: '10px',
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: '0.1em',
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fee2e2',
    color: '#ef4444',
    padding: '12px 16px',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: '600',
    marginBottom: '24px',
  },
  formContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  inputLabel: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: '0.05em',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '14px',
  },
  textInput: {
    width: '100%',
    padding: '12px 14px 12px 42px',
    fontSize: '14px',
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  submitBtn: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    color: '#ffffff',
    border: 'none',
    padding: '14px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '8px',
    boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.1)',
  },
};