import React from 'react';
import {
  LayoutDashboard,
  Layers,
  Users,
  LogOut,
  Waves
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  onLogout
}: SidebarProps) {
  return (
    <aside style={styles.sidebar}>
      {/* Glow Effects */}
      <div style={styles.topGlow}></div>
      <div style={styles.bottomGlow}></div>

      {/* Header */}
      <div style={styles.sidebarHeader}>
        <div style={styles.logoVectorContainer}>
          <Waves size={28} color="#3b82f6" style={styles.vectorIconGlow} />
        </div>

        <div>
          <h1 style={styles.sidebarBrand}>
            AquaSense
          </h1>
          <p style={styles.sidebarSubtext}>
            Monitoring System
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav style={styles.sidebarNav}>
        <SidebarButton
          icon={<LayoutDashboard size={18} />}
          label="Dashboard"
          active={activeTab.toLowerCase() === 'dashboard'} 
          onClick={() => setActiveTab('dashboard')}
        />

        <SidebarButton
          icon={<Layers size={18} />}
          label="Device Management"
          active={activeTab.toLowerCase() === 'device management'}
          onClick={() => setActiveTab('device management')}
        />

        <SidebarButton
          icon={<Users size={18} />}
          label="Account Management"
          active={activeTab.toLowerCase() === 'account management'}
          onClick={() => setActiveTab('account management')}
        />
      </nav>

      {/* Logout */}
      <button
        style={styles.logoutBtn}
        onClick={onLogout}
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
          e.currentTarget.style.transform = 'translateX(6px)';
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
    overflow: 'hidden',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '8px 0 30px rgba(0,0,0,0.25)',
    zIndex: 999
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
    marginBottom: '45px',
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
    boxShadow: '0 10px 25px rgba(59,130,246,0.25)'
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
  sidebarNav: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    flex: 1,
    position: 'relative' as const,
    zIndex: 2
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
    outline: 'none'
  },
  activeNavItem: {
    background: 'linear-gradient(135deg, rgba(250,204,21,0.22), rgba(250,204,21,0.10))',
    border: '1px solid rgba(250,204,21,0.45)',
    color: '#fde047',
    boxShadow: '0 8px 25px rgba(250,204,21,0.18)',
    transform: 'translateX(6px)'
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
    zIndex: 2
  }
};