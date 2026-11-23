import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Layers,
  Users,
  LogOut,
  Waves,
  ShieldCheck,
  Menu,
  X
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  onSidebarStateChange?: (state: { isOpen: boolean; isMobile: boolean }) => void;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  onLogout,
  onSidebarStateChange
}: SidebarProps) {
  const [adminName, setAdminName] = useState('Super Admin');
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [isOpen, setIsOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      const nextOpen = !mobile;
      setIsMobile(mobile);
      setIsOpen(nextOpen);
      onSidebarStateChange?.({ isOpen: nextOpen, isMobile: mobile });
    };

    onSidebarStateChange?.({ isOpen, isMobile });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    onSidebarStateChange?.({ isOpen, isMobile });
  }, [isOpen, isMobile, onSidebarStateChange]);

  useEffect(() => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('access_token');
      if (token) {
        const base64Url = token.split('.')[1];
        if (base64Url) {
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split('')
              .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
          const decoded = JSON.parse(jsonPayload);
          if (decoded.name) {
            setAdminName(decoded.name);
          } else if (decoded.sub) {
            setAdminName(decoded.sub.split('@')[0]);
          }
        }
      }
    } catch (err) {
      console.error('Failed to parse admin identity from token:', err);
    }
  }, []);

  const handleNavSelect = (tab: string) => {
    setActiveTab(tab);
    if (isMobile) {
      setIsOpen(false);
    }
  };

  const handleLogoutClick = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('access_token');
    localStorage.clear();
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <>
      {isMobile && (
        <header style={styles.mobileTopBar}>
          <div style={styles.mobileBrandGroup}>
            <Waves size={22} color="#3b82f6" />
            <span style={styles.mobileBrandTitle}>AquaSense</span>
          </div>
          <button
            type="button"
            aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={() => setIsOpen((prev) => !prev)}
            style={styles.hamburgerBtn}
          >
            {isOpen ? <X size={22} color="#ffffff" /> : <Menu size={22} color="#ffffff" />}
          </button>
        </header>
      )}

      {isMobile && isOpen && (
        <div
          style={styles.backdrop}
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        style={{
          ...styles.sidebar,
          ...(isMobile
            ? {
                top: '56px',
                height: 'calc(100vh - 56px)',
                transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
                transition: 'transform 0.25s ease'
              }
            : {
                transform: 'translateX(0)'
              })
        }}
      >
        <div style={styles.topGlow}></div>
        <div style={styles.bottomGlow}></div>

        <div style={styles.sidebarHeader}>
          <div style={styles.logoVectorContainer}>
            <Waves size={28} color="#3b82f6" style={styles.vectorIconGlow} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={styles.sidebarBrand}>AquaSense</h1>
            <p style={styles.sidebarSubtext}>Monitoring System</p>
          </div>
        </div>

        <div style={styles.adminProfileCard}>
          <div style={styles.adminAvatar}>
            {adminName.charAt(0).toUpperCase()}
          </div>
          <div style={styles.adminInfo}>
            <div style={styles.adminNameText} title={adminName}>
              {adminName}
            </div>
            <div style={styles.adminRoleBadge}>
              <ShieldCheck size={11} color="#fde047" />
              <span>Super Admin</span>
            </div>
          </div>
        </div>

        <nav style={styles.sidebarNav}>
          <SidebarButton
            icon={<LayoutDashboard size={18} />}
            label="Dashboard"
            active={activeTab.toLowerCase() === 'dashboard'}
            onClick={() => handleNavSelect('dashboard')}
          />

          <SidebarButton
            icon={<Layers size={18} />}
            label="Device Management"
            active={activeTab.toLowerCase() === 'device management'}
            onClick={() => handleNavSelect('device management')}
          />

          <SidebarButton
            icon={<Users size={18} />}
            label="Account Management"
            active={activeTab.toLowerCase() === 'account management'}
            onClick={() => handleNavSelect('account management')}
          />
        </nav>

        <button
          style={styles.logoutBtn}
          onClick={handleLogoutClick}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.12)';
            e.currentTarget.style.border = '1px solid rgba(239,68,68,0.25)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)';
            e.currentTarget.style.transform = 'translateY(0px)';
          }}
        >
          <LogOut size={18} />
          <span>Log Out</span>
        </button>
      </aside>
    </>
  );
}

function SidebarButton({
  icon,
  label,
  active,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.navItem,
        ...(active ? styles.activeNavItem : {})
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'rgba(99,102,241,0.18)';
          e.currentTarget.style.color = '#c4b5fd';
          e.currentTarget.style.transform = 'translateX(4px)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = '#cbd5e1';
          e.currentTarget.style.transform = 'translateX(0px)';
        }
      }}
    >
      <div style={styles.iconWrapper}>
        {icon}
      </div>
      <span>{label}</span>
    </button>
  );
}

const styles = {
  mobileTopBar: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    height: '56px',
    background: 'linear-gradient(90deg, #1e1b4b 0%, #111827 100%)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    zIndex: 1001,
    boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
    boxSizing: 'border-box' as const
  },
  mobileBrandGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  mobileBrandTitle: {
    fontSize: '18px',
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: '-0.03em'
  },
  hamburgerBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.14)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  backdrop: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    backdropFilter: 'blur(2px)',
    zIndex: 998
  },
  sidebar: {
    width: '260px',
    height: '100vh',
    position: 'fixed' as const,
    top: 0,
    left: 0,
    background: 'linear-gradient(180deg, #1e1b4b 0%, #111827 100%)',
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '24px 18px',
    color: '#ffffff',
    overflow: 'hidden' as const,
    borderRight: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '8px 0 30px rgba(0,0,0,0.25)',
    zIndex: 999,
    boxSizing: 'border-box' as const
  },
  topGlow: {
    position: 'absolute' as const,
    width: '240px',
    height: '240px',
    background: 'radial-gradient(circle, rgba(168,85,247,0.28), transparent 70%)',
    top: '-90px',
    right: '-70px',
    borderRadius: '50%',
    pointerEvents: 'none' as const
  },
  bottomGlow: {
    position: 'absolute' as const,
    width: '220px',
    height: '220px',
    background: 'radial-gradient(circle, rgba(59,130,246,0.20), transparent 70%)',
    bottom: '-100px',
    left: '-90px',
    borderRadius: '50%',
    pointerEvents: 'none' as const
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    marginBottom: '24px',
    padding: '0 8px',
    position: 'relative' as const,
    zIndex: 2
  },
  logoVectorContainer: {
    width: '52px',
    height: '52px',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 10px 25px rgba(59,130,246,0.25)',
    flexShrink: 0
  },
  vectorIconGlow: {
    filter: 'drop-shadow(0px 0px 6px rgba(59,130,246,0.6))'
  },
  sidebarBrand: {
    margin: 0,
    fontSize: '24px',
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: '-0.04em'
  },
  sidebarSubtext: {
    margin: '4px 0 0 0',
    fontSize: '11px',
    color: '#94a3b8',
    letterSpacing: '0.08em'
  },
  adminProfileCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '14px',
    padding: '12px 14px',
    marginBottom: '24px',
    position: 'relative' as const,
    zIndex: 2,
    backdropFilter: 'blur(8px)'
  },
  adminAvatar: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #7e22ce 0%, #3b82f6 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '16px',
    color: '#ffffff',
    boxShadow: '0 4px 12px rgba(126,34,206,0.3)',
    flexShrink: 0
  },
  adminInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    minWidth: 0,
    flex: 1
  },
  adminNameText: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#f8fafc',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const
  },
  adminRoleBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    fontWeight: '600',
    color: '#fde047'
  },
  sidebarNav: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    flex: 1,
    position: 'relative' as const,
    zIndex: 2,
    overflow: 'hidden' as const
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    width: '100%',
    padding: '14px 16px',
    borderRadius: '14px',
    background: 'transparent',
    border: '1px solid transparent',
    color: '#cbd5e1',
    textAlign: 'left' as const,
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.25s ease',
    outline: 'none',
    boxSizing: 'border-box' as const
  },
  activeNavItem: {
    background: 'linear-gradient(135deg, rgba(250,204,21,0.22), rgba(250,204,21,0.10))',
    border: '1px solid rgba(250,204,21,0.45)',
    color: '#fde047',
    boxShadow: '0 8px 25px rgba(250,204,21,0.18)',
    transform: 'translateX(4px)'
  },
  iconWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    width: '100%',
    padding: '14px 16px',
    marginTop: '20px',
    marginBottom: '10px',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#fca5a5',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.25s ease',
    outline: 'none',
    position: 'relative' as const,
    zIndex: 2,
    boxSizing: 'border-box' as const
  }
};