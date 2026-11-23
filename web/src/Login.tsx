import React, { useState } from 'react';
import type { FormEvent } from 'react';
import { ShieldAlert, Lock, User, Loader2, ArrowRight, Waves } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (username: string) => void;
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://aquasense-backend-osmi.onrender.com';

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [focusedField, setFocusedField] = useState<'username' | 'password' | null>(null);
  const [isBtnHovered, setIsBtnHovered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shakeError, setShakeError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const triggerErrorShake = (msg: string) => {
    setError(msg);
    setShakeError(true);
    setTimeout(() => setShakeError(false), 450);
  };

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

      const userRole = String(data.role || data.user?.role || '').trim().toLowerCase();

      if (userRole !== 'super admin') {
        throw new Error(
          'Access Denied: Only Super Administrators are authorized to access this dashboard.'
        );
      }

      const authToken = data.token || data.access_token;
      if (authToken) {
        localStorage.setItem('token', authToken);
        localStorage.setItem('access_token', authToken);
      }

      onLoginSuccess(data.username || data.user?.username || username);
    } catch (err: unknown) {
      if (err instanceof Error) {
        triggerErrorShake(err.message);
      } else {
        triggerErrorShake('Cannot connect to backend gateway server.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="aquasense-login-root">
      <style>{`
        @keyframes aq-float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes aq-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        @keyframes aq-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .aq-spin-icon {
          animation: aq-spin 0.9s linear infinite;
        }
        .aq-shake-box {
          animation: aq-shake 0.42s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }
        .aq-input-box {
          transition:
            transform 0.24s cubic-bezier(0.22, 1, 0.36, 1),
            background-color 0.24s ease,
            border-color 0.24s ease,
            box-shadow 0.24s ease;
        }
        .aq-input-box:hover:not(:disabled) {
          border-color: #64748b !important;
          background-color: #ffffff !important;
        }
        .aq-input-box:focus {
          transform: translateY(-1.5px);
          background-color: #ffffff !important;
          border-color: #09090b !important;
          box-shadow: 0 0 0 4px rgba(9, 9, 11, 0.08), 0 8px 16px -6px rgba(0, 0, 0, 0.12) !important;
        }
        .aq-submit-btn {
          position: relative;
          overflow: hidden;
          transition:
            background 0.32s cubic-bezier(0.22, 1, 0.36, 1),
            color 0.32s cubic-bezier(0.22, 1, 0.36, 1),
            transform 0.25s cubic-bezier(0.22, 1, 0.36, 1),
            box-shadow 0.32s cubic-bezier(0.22, 1, 0.36, 1),
            border-color 0.32s ease;
        }
        .aq-submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          background: linear-gradient(135deg, #0284c7 0%, #38bdf8 55%, #e0f2fe 120%);
          color: #ffffff;
          border-color: #7dd3fc;
          box-shadow:
            0 12px 24px -6px rgba(2, 132, 199, 0.42),
            0 0 0 3px rgba(125, 211, 252, 0.35);
        }
        .aq-submit-btn:active:not(:disabled) {
          transform: translateY(0px) scale(0.99);
        }
        .aq-arrow-slide {
          transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.28s ease;
        }
      `}</style>

      {/* Monochrome geometric grid & ambient accents */}
      <div style={styles.gridBackdrop} aria-hidden="true" />
      <div style={styles.topAccentBar} aria-hidden="true" />

      <div
        style={{
          ...styles.loginCard,
          ...(shakeError ? styles.shakeCard : {})
        }}
      >
        {/* Top monochrome status strip */}
        <div style={styles.topMetaRow}>
          <span style={styles.monochromePill}>
            <span style={styles.pulseDot} />
            MONOCHROME CORE
          </span>
          <span style={styles.versionTag}>v2.0</span>
        </div>

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
          <p style={styles.subTitle}>SUPER ADMIN PORTAL</p>
          <div style={styles.dividerRule}>
            <span style={styles.dividerLine} />
            <Waves size={13} color="#71717a" />
            <span style={styles.dividerLine} />
          </div>
        </div>

        {error && (
          <div
            style={styles.errorAlert}
            className={shakeError ? 'aq-shake-box' : undefined}
          >
            <ShieldAlert size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.formContainer}>
          <div style={styles.inputGroup}>
            <div style={styles.labelRow}>
              <label
                htmlFor="aq-username"
                style={{
                  ...styles.inputLabel,
                  color: focusedField === 'username' ? '#09090b' : '#52525b'
                }}
              >
                SUPERADMIN USERNAME
              </label>
              <span
                style={{
                  ...styles.fieldIndicator,
                  opacity: focusedField === 'username' ? 1 : 0.45
                }}
              >
                ID
              </span>
            </div>
            <div style={styles.inputWrapper}>
              <User
                size={16}
                color={focusedField === 'username' ? '#09090b' : '#71717a'}
                style={{
                  ...styles.inputIcon,
                  transform:
                    focusedField === 'username' ? 'translateX(2px) scale(1.06)' : 'none',
                  transition: 'all 0.22s ease'
                }}
              />
              <input
                id="aq-username"
                type="text"
                required
                disabled={isLoading}
                value={username}
                onFocus={() => setFocusedField('username')}
                onBlur={() => setFocusedField(null)}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter superadmin username"
                className="aq-input-box"
                style={styles.textInput}
              />
            </div>
          </div>

          <div style={styles.inputGroup}>
            <div style={styles.labelRow}>
              <label
                htmlFor="aq-password"
                style={{
                  ...styles.inputLabel,
                  color: focusedField === 'password' ? '#09090b' : '#52525b'
                }}
              >
                SECURITY ACCESS PASSWORD
              </label>
              <span
                style={{
                  ...styles.fieldIndicator,
                  opacity: focusedField === 'password' ? 1 : 0.45
                }}
              >
                KEY
              </span>
            </div>
            <div style={styles.inputWrapper}>
              <Lock
                size={16}
                color={focusedField === 'password' ? '#09090b' : '#71717a'}
                style={{
                  ...styles.inputIcon,
                  transform:
                    focusedField === 'password' ? 'translateX(2px) scale(1.06)' : 'none',
                  transition: 'all 0.22s ease'
                }}
              />
              <input
                id="aq-password"
                type="password"
                required
                disabled={isLoading}
                value={password}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="aq-input-box"
                style={styles.textInput}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            onMouseEnter={() => setIsBtnHovered(true)}
            onMouseLeave={() => setIsBtnHovered(false)}
            className="aq-submit-btn"
            style={{
              ...styles.submitBtn,
              opacity: isLoading ? 0.75 : 1
            }}
          >
            {isLoading ? (
              <Loader2 size={18} className="aq-spin-icon" />
            ) : (
              <span style={styles.btnContent}>
                <span>Establish Secure Session</span>
                <ArrowRight
                  size={16}
                  className="aq-arrow-slide"
                  style={{
                    transform: isBtnHovered ? 'translateX(4px)' : 'translateX(0)',
                    opacity: isBtnHovered ? 1 : 0.85
                  }}
                />
              </span>
            )}
          </button>
        </form>

        <div style={styles.cardFooter}>
          <span>ENCRYPTED TELEMETRY GATEWAY</span>
          <span>•</span>
          <span>BnW UI</span>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loginContainer: {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    width: '100%',
    backgroundColor: '#f4f4f5',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    boxSizing: 'border-box',
    padding: '20px',
    overflow: 'hidden'
  },
  gridBackdrop: {
    position: 'absolute',
    inset: 0,
    backgroundImage:
      'radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.9), transparent 70%), linear-gradient(to right, rgba(24, 24, 27, 0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(24, 24, 27, 0.045) 1px, transparent 1px)',
    backgroundSize: '100% 100%, 28px 28px, 28px 28px',
    pointerEvents: 'none',
    zIndex: 0
  },
  topAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '4px',
    background: 'linear-gradient(90deg, #09090b 0%, #52525b 50%, #09090b 100%)',
    zIndex: 1
  },
  loginCard: {
    position: 'relative',
    zIndex: 2,
    width: '100%',
    maxWidth: '420px',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    backdropFilter: 'blur(12px)',
    padding: 'clamp(24px, 5vw, 36px)',
    borderRadius: '24px',
    boxShadow:
      '0 24px 48px -12px rgba(9, 9, 11, 0.14), 0 0 0 1px rgba(24, 24, 27, 0.08)',
    border: '1px solid #e4e4e7',
    boxSizing: 'border-box'
  },
  shakeCard: {
    borderColor: '#fca5a5'
  },
  topMetaRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px'
  },
  monochromePill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#27272a',
    backgroundColor: '#f4f4f5',
    border: '1px solid #e4e4e7',
    padding: '4px 10px',
    borderRadius: '999px'
  },
  pulseDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#09090b',
    display: 'inline-block'
  },
  versionTag: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#71717a',
    letterSpacing: '0.06em'
  },
  brandHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '28px'
  },
  logoBadge: {
    width: '52px',
    height: '52px',
    borderRadius: '16px',
    background: 'linear-gradient(145deg, #18181b 0%, #09090b 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '12px',
    boxShadow:
      '0 12px 20px -4px rgba(9, 9, 11, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
    border: '1px solid #27272a'
  },
  mainTitle: {
    margin: 0,
    fontSize: '23px',
    fontWeight: 800,
    color: '#09090b',
    letterSpacing: '-0.03em'
  },
  subTitle: {
    margin: '4px 0 0 0',
    fontSize: '10px',
    fontWeight: 700,
    color: '#71717a',
    letterSpacing: '0.14em'
  },
  dividerRule: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '120px',
    marginTop: '14px'
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    backgroundColor: '#e4e4e7'
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    padding: '12px 14px',
    borderRadius: '12px',
    fontSize: '12.5px',
    fontWeight: 600,
    marginBottom: '20px'
  },
  formContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '7px'
  },
  labelRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  inputLabel: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.07em',
    transition: 'color 0.2s ease'
  },
  fieldIndicator: {
    fontSize: '9px',
    fontWeight: 700,
    color: '#52525b',
    backgroundColor: '#f4f4f5',
    padding: '2px 6px',
    borderRadius: '6px',
    border: '1px solid #e4e4e7',
    transition: 'opacity 0.2s ease'
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  inputIcon: {
    position: 'absolute',
    left: '14px',
    pointerEvents: 'none',
    zIndex: 2
  },
  textInput: {
    width: '100%',
    padding: '12.5px 14px 12.5px 42px',
    fontSize: '14px',
    color: '#09090b',
    backgroundColor: '#fafafa',
    border: '1px solid #d4d4d8',
    borderRadius: '12px',
    outline: 'none',
    boxSizing: 'border-box'
  },
  submitBtn: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#09090b',
    color: '#ffffff',
    border: '1px solid #18181b',
    padding: '14px 18px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '6px',
    boxShadow: '0 8px 16px -4px rgba(9, 9, 11, 0.22)'
  },
  btnContent: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px'
  },
  cardFooter: {
    marginTop: '22px',
    paddingTop: '14px',
    borderTop: '1px solid #f4f4f5',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
    fontSize: '9.5px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: '#a1a1aa'
  }
};