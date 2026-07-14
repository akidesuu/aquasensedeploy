import { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from './components/Sidebar';

import {
  Droplet,
  Thermometer,
  Eye,
  AlertTriangle,
  Battery,
  X,
  Radio,
  Activity,
  Cpu,
  Terminal,
  ShieldCheck,
  RefreshCw,
  Sliders,
  TrendingUp,
  LogOut
} from 'lucide-react';

const YOUR_COMPUTER_IP = '192.168.1.35';
const FASTAPI_URL = `http://${YOUR_COMPUTER_IP}:8000`;

interface PredictionData {
  predicted_do: number | string;
  status: string;
}

interface FloaterNode {
  id: number;
  name: string;
  location: string;
  color: string;
  user: string;
  time: string;
  metrics: {
    ph: number;
    temperature: number;
    turbidity: number;
    battery: number;
  };
}

interface LogEntry {
  id: string;
  timestamp: string;
  source: string;
  message: string;
  type: 'info' | 'success' | 'warning';
}

interface DashboardProps {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFloater, setSelectedFloater] = useState<FloaterNode | null>(null);
  const [cryptoTrendData, setCryptoTrendData] = useState<number[]>([6.8, 7.1, 6.9, 7.4, 7.2, 7.0, 7.3, 7.1, 7.5, 7.0]);
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: '1', timestamp: '11:24:02', source: 'SYS', message: 'AquaSense telemetry connection established.', type: 'success' },
    { id: '2', timestamp: '11:24:15', source: 'FLT-03', message: 'Optimized internal battery cycling state.', type: 'info' },
    { id: '3', timestamp: '11:25:00', source: 'API', message: 'FastAPI validation ping timed out. Running Fallback simulation metrics.', type: 'warning' }
  ]);

  const [floaters, setFloaters] = useState<FloaterNode[]>([
    {
      id: 1,
      name: 'Floater 1',
      location: 'Pond A Alpha',
      color: '#ff5c5c',
      user: 'Juan Dela Cruz',
      time: 'Active',
      metrics: { ph: 7.35, temperature: 28.2, turbidity: 14.1, battery: 85 }
    },
    {
      id: 2,
      name: 'Floater 2',
      location: 'Pond A Beta',
      color: '#00c853',
      user: 'Maria Clara',
      time: 'Active',
      metrics: { ph: 6.9, temperature: 27.5, turbidity: 11.2, battery: 92 }
    },
    {
      id: 3,
      name: 'Floater 3',
      location: 'Pond B North',
      color: '#2196f3',
      user: 'Akimitsu Admin',
      time: 'Active',
      metrics: { ph: 7.45, temperature: 29.1, turbidity: 18.4, battery: 64 }
    },
    {
      id: 4,
      name: 'Floater 4',
      location: 'Pond C South',
      color: '#ff9800',
      user: 'Santi Dev',
      time: 'Active',
      metrics: { ph: 7.1, temperature: 26.8, turbidity: 13.0, battery: 78 }
    }
  ]);

  const fetchCentralData = async () => {
    try {
      setError(null);
      const response = await axios.get<PredictionData>(`${FASTAPI_URL}/predict`);
      setPrediction(response.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('Simulation mode enabled. Backend offline.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCentralData();

    const environmentTicker = setInterval(() => {
      // Dynamic High/Low Crypto Line simulation updates
      setCryptoTrendData((prev) => {
        const nextData = [...prev.slice(1)];
        const lastVal = prev[prev.length - 1];
        const change = (Math.random() * 0.8 - 0.4);
        const newVal = Math.max(5.5, Math.min(8.5, parseFloat((lastVal + change).toFixed(2))));
        return [...nextData, newVal];
      });

      // Random logs simulation generator
      if (Math.random() > 0.7) {
        const randomFloaterId = Math.floor(Math.random() * 4) + 1;
        const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const targetLog: LogEntry = {
          id: String(Date.now()),
          timestamp: timeString,
          source: `FLT-0${randomFloaterId}`,
          message: `Periodic metric push accepted securely. Telemetry variance within normal bounds.`,
          type: 'info'
        };
        setLogs((prev) => [targetLog, ...prev.slice(0, 4)]);
      }

      setFloaters((prevFloaters) =>
        prevFloaters.map((f) => ({
          ...f,
          metrics: {
            ph: parseFloat((f.metrics.ph + (Math.random() * 0.08 - 0.04)).toFixed(2)),
            temperature: parseFloat((f.metrics.temperature + (Math.random() * 0.14 - 0.07)).toFixed(1)),
            turbidity: parseFloat((f.metrics.turbidity + (Math.random() * 0.3 - 0.15)).toFixed(1)),
            battery: Math.max(0, f.metrics.battery - (Math.random() > 0.95 ? 1 : 0))
          }
        }))
      );
    }, 1500);

    return () => clearInterval(environmentTicker);
  }, []);

  useEffect(() => {
    if (selectedFloater) {
      const updated = floaters.find((f) => f.id === selectedFloater.id);
      if (updated) {
        setSelectedFloater(updated);
      }
    }
  }, [floaters, selectedFloater]);

  if (loading && !prediction) {
    return (
      <div style={styles.centerStage}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Loading AquaSense Dashboard...</p>
      </div>
    );
  }

  const avgDo = typeof prediction?.predicted_do === 'number'
      ? prediction.predicted_do.toFixed(1)
      : '7.0';

  // Build crypto high/low SVG Polyline points layout matrix dynamically
  const svgWidth = 500;
  const svgHeight = 200;
  const padding = 25;
  const minVal = 5.0;
  const maxVal = 9.0;

  const points = cryptoTrendData.map((val, idx) => {
    const x = padding + (idx * (svgWidth - padding * 2)) / (cryptoTrendData.length - 1);
    const y = svgHeight - padding - ((val - minVal) * (svgHeight - padding * 2)) / (maxVal - minVal);
    return `${x},${y}`;
  }).join(' ');

  const highestPointY = Math.min(...cryptoTrendData.map((val) => svgHeight - padding - ((val - minVal) * (svgHeight - padding * 2)) / (maxVal - minVal)));
  const lowestPointY = Math.max(...cryptoTrendData.map((val) => svgHeight - padding - ((val - minVal) * (svgHeight - padding * 2)) / (maxVal - minVal)));

  return (
    <div style={styles.appContainer}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={onLogout} />

      <div style={styles.workspaceBody}>
        {error && (
          <div style={styles.warningBanner}>
            <AlertTriangle size={16} style={{ marginRight: '10px' }} />
            <span>{error}</span>
          </div>
        )}

        {/* TOP KPI BLOCK ROW */}
        <section style={styles.kpiContainerRow}>
          <div style={styles.kpiCard}>
            <div style={styles.cardHeaderGlow}>
              <Radio size={14} color="#16a34a" style={{ marginRight: '6px' }} />
              <p style={styles.kpiTitle}>ACTIVE ARRAYS</p>
            </div>
            <p style={{ ...styles.kpiValue, color: '#16a34a' }}>0{floaters.length}</p>
          </div>

          <div style={styles.kpiCard}>
            <div style={styles.cardHeaderGlow}>
              <Cpu size={14} color="#0284c7" style={{ marginRight: '6px' }} />
              <p style={styles.kpiTitle}>CLIENTS</p>
            </div>
            <p style={{ ...styles.kpiValue, color: '#0284c7' }}>04</p>
          </div>

          <div style={styles.kpiCard}>
            <div style={styles.cardHeaderGlow}>
              <Activity size={14} color="#e11d48" style={{ marginRight: '6px' }} />
              <p style={styles.kpiTitle}>MEAN DO</p>
            </div>
            <p style={{ ...styles.kpiValue, color: '#e11d48' }}>
              {avgDo}
              <span style={styles.unitText}> mg/L</span>
            </p>
          </div>

          <div style={styles.kpiCard}>
            <div style={styles.cardHeaderGlow}>
              <div style={styles.pulseDot} />
              <p style={styles.kpiTitle}>TELEMETRY</p>
            </div>
            <p style={styles.kpiValue}>Stable</p>
          </div>
        </section>

        {/* MIDDLE PRIMARY GRID BLOCKS */}
        <div style={styles.splitGridDashboard}>
          <div style={styles.panelBox}>
            <h3 style={styles.panelBoxTitle}>Fleet Radar</h3>
            <div style={styles.mapCanvas}>
              <div style={styles.radarRing1} />
              <div style={styles.radarRing2} />

              {floaters.map((node) => (
                <button
                  key={node.id}
                  onClick={() => setSelectedFloater(node)}
                  style={{
                    ...styles.floaterInteractiveBubble,
                    ...(styles[`floaterPos${node.id}` as keyof typeof styles] as React.CSSProperties)
                  }}
                >
                  <div style={{ ...styles.colorCircleNode, borderColor: node.color }}>
                    <div style={{ ...styles.innerCoreRadarDot, backgroundColor: node.color }} />
                  </div>
                  <span style={styles.bubbleTextLabel}>{node.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* CRYPTO HIGH/LOW SPARKLINES REMODEL */}
          <div style={styles.panelBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ ...styles.panelBoxTitle, margin: 0 }}>DO Real-time Trend Analytics</h3>
              <div style={styles.cryptoBadge}>
                <TrendingUp size={12} style={{ marginRight: '4px' }} />
                <span>Live High/Low Vector</span>
              </div>
            </div>
            <div style={styles.chartMockCanvas}>
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={styles.svgGraphLine}>
                {/* Horizontal Reference Lines */}
                <line x1="0" y1={padding} x2={svgWidth} y2={padding} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
                <line x1="0" y1={svgHeight/2} x2={svgWidth} y2={svgHeight/2} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
                <line x1="0" y1={svgHeight - padding} x2={svgWidth} y2={svgHeight - padding} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
                
                {/* Crypto High/Low Envelope Boundaries */}
                <path d={`M ${padding} ${highestPointY} L ${svgWidth - padding} ${highestPointY}`} fill="none" stroke="#22c55e" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
                <path d={`M ${padding} ${lowestPointY} L ${svgWidth - padding} ${lowestPointY}`} fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />

                {/* Primary Trend Vector Line */}
                <polyline points={points} fill="none" stroke="#0284c7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                
                {/* Current Price-Action Indicator Node */}
                {cryptoTrendData.length > 0 && (
                  <circle
                    cx={padding + ((cryptoTrendData.length - 1) * (svgWidth - padding * 2)) / (cryptoTrendData.length - 1)}
                    cy={svgHeight - padding - ((cryptoTrendData[cryptoTrendData.length - 1] - minVal) * (svgHeight - padding * 2)) / (maxVal - minVal)}
                    r="5"
                    fill="#0284c7"
                  />
                )}
              </svg>
              <div style={styles.chartWatermarkGrid} />
            </div>
          </div>
        </div>

        {/* BOTTOM BRAND NEW ADDITION FILLING UP WHITE SPACES */}
        <div style={styles.splitGridDashboard}>
          {/* Diagnostic Event Logging Terminal */}
          <div style={styles.panelBox}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '8px' }}>
              <Terminal size={18} color="#475569" />
              <h3 style={{ ...styles.panelBoxTitle, margin: 0 }}>System Activity & Telemetry Stream</h3>
            </div>
            <div style={styles.logTerminalContainer}>
              {logs.map((log) => (
                <div key={log.id} style={styles.logLineItem}>
                  <span style={styles.logTimestamp}>[{log.timestamp}]</span>
                  <span style={{ ...styles.logSource, color: log.type === 'warning' ? '#b91c1c' : log.type === 'success' ? '#16a34a' : '#0284c7' }}>
                    {log.source}:
                  </span>
                  <span style={styles.logMessage}>{log.message}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Fleet Actions & Status overview */}
          <div style={styles.panelBox}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '8px' }}>
              <Sliders size={18} color="#475569" />
              <h3 style={{ ...styles.panelBoxTitle, margin: 0 }}>Control Plane & Node Execution</h3>
            </div>
            <div style={styles.quickActionsGrid}>
              <div style={styles.actionCard}>
                <ShieldCheck size={22} color="#16a34a" />
                <div>
                  <h4 style={styles.actionCardTitle}>Encryption Integrity</h4>
                  <p style={styles.actionCardDesc}>SSL/TLS secure array layer secure</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button style={{ ...styles.actionInteractiveBtn, flex: 1 }} onClick={() => fetchCentralData()}>
                  <RefreshCw size={16} color="#0284c7" />
                  <span style={{ fontWeight: '600', fontSize: '13px', color: '#0f172a' }}>Force Sync</span>
                </button>
                <button style={{ ...styles.actionInteractiveLogoutBtn, flex: 1 }} onClick={onLogout}>
                  <LogOut size={16} color="#dc2626" />
                  <span style={{ fontWeight: '600', fontSize: '13px', color: '#991b1b' }}>Terminate Session</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* DETAIL NODE INTERACTIVE MODAL */}
        {selectedFloater && (
          <div style={styles.modalOverlayMask} onClick={() => setSelectedFloater(null)}>
            <div style={styles.modalBodyWindow} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalSplitGrid}>
                <div style={styles.modalMetaSection}>
                  <div style={styles.modalHeaderRow}>
                    <div>
                      <h3 style={styles.modalMainTitle}>{selectedFloater.name}</h3>
                      <p style={styles.modalMetaLine}>{selectedFloater.user}</p>
                      <p style={styles.modalMetaLine}>{selectedFloater.location}</p>
                    </div>
                    <button onClick={() => setSelectedFloater(null)} style={styles.closeModalCrossBtn}>
                      <X size={20} />
                    </button>
                  </div>

                  <div style={styles.modalMetricStack}>
                    <div style={styles.modalGridBrick}>
                      <Droplet size={18} color="#16a34a" />
                      <p style={styles.brickLabelText}>pH</p>
                      <span style={{ ...styles.brickValueText, color: '#16a34a' }}>{selectedFloater.metrics.ph}</span>
                    </div>

                    <div style={styles.modalGridBrick}>
                      <Thermometer size={18} color="#0284c7" />
                      <p style={styles.brickLabelText}>Temperature</p>
                      <span style={{ ...styles.brickValueText, color: '#0284c7' }}>{selectedFloater.metrics.temperature}°C</span>
                    </div>

                    <div style={styles.modalGridBrick}>
                      <Eye size={18} color="#e11d48" />
                      <p style={styles.brickLabelText}>Turbidity</p>
                      <span style={{ ...styles.brickValueText, color: '#e11d48' }}>{selectedFloater.metrics.turbidity}</span>
                    </div>

                    <div style={styles.modalGridBrick}>
                      <Battery size={18} color="#ca8a04" />
                      <p style={styles.brickLabelText}>Battery</p>
                      <span style={{ ...styles.brickValueText, color: '#ca8a04' }}>{selectedFloater.metrics.battery}%</span>
                    </div>
                  </div>
                </div>

                <div style={styles.modalChartPane}>
                  <div style={styles.modalChartWrapper}>
                    <svg viewBox="0 0 100 60" style={{ width: '100%', height: '100%' }}>
                      <polyline points="10,50 30,20 50,45 70,15 90,35" fill="none" stroke={selectedFloater.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div style={styles.chartWatermarkGrid} />
                  </div>
                  <div style={styles.modalChartFooterLabel}>Linear Telemetry Node Vector Track</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  appContainer: {
    display: 'flex',
    minHeight: '100vh',
    width: '100vw',
    backgroundColor: '#f8fafc',
    overflowX: 'hidden' as const,
    boxSizing: 'border-box' as const
  },
  workspaceBody: {
    flex: 1,
    marginLeft: '260px', 
    width: 'calc(100vw - 260px)', 
    minHeight: '100vh',
    overflowY: 'auto' as const,
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
    color: '#1e293b',
    fontFamily: 'sans-serif',
    boxSizing: 'border-box' as const
  },
  warningBanner: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    border: '1px solid #ef4444',
    color: '#b91c1c',
    padding: '12px 18px',
    borderRadius: '10px'
  },
  kpiContainerRow: {
    display: 'flex',
    gap: '16px',
    width: '100%',
    boxSizing: 'border-box' as const
  },
  kpiCard: {
    flex: 1,
    minWidth: '0', 
    backgroundColor: '#ffffff',
    padding: '20px',
    borderRadius: '16px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
    boxSizing: 'border-box' as const
  },
  cardHeaderGlow: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '12px'
  },
  kpiTitle: {
    margin: 0,
    fontSize: '12px',
    color: '#64748b',
    fontWeight: '600'
  },
  kpiValue: {
    margin: 0,
    fontSize: '30px',
    fontWeight: '800'
  },
  unitText: {
    fontSize: '14px',
    color: '#64748b'
  },
  pulseDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#22c55e',
    marginRight: '8px'
  },
  splitGridDashboard: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
    width: '100%',
    boxSizing: 'border-box' as const
  },
  panelBox: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
    minWidth: '0', 
    boxSizing: 'border-box' as const
  },
  panelBoxTitle: {
    margin: '0 0 24px 0',
    fontSize: '16px',
    fontWeight: '700',
    color: '#0f172a'
  },
  cryptoBadge: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'rgba(2,132,199,0.1)',
    color: '#0284c7',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600'
  },
  mapCanvas: {
    height: '260px',
    backgroundColor: '#f8fafc',
    borderRadius: '12px',
    position: 'relative' as const,
    overflow: 'hidden'
  },
  radarRing1: {
    position: 'absolute' as const,
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    border: '1px dashed #cbd5e1',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)'
  },
  radarRing2: {
    position: 'absolute' as const,
    width: '220px',
    height: '220px',
    borderRadius: '50%',
    border: '1px solid #e2e8f0',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)'
  },
  floaterInteractiveBubble: {
    position: 'absolute' as const,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '6px'
  },
  colorCircleNode: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    border: '2px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff'
  },
  innerCoreRadarDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%'
  },
  bubbleTextLabel: {
    fontSize: '11px',
    color: '#475569',
    fontWeight: '600'
  },
  floaterPos1: { top: '25%', left: '20%' },
  floaterPos2: { top: '15%', right: '25%' },
  floaterPos3: { bottom: '20%', left: '40%' },
  floaterPos4: { bottom: '30%', right: '15%' },
  chartMockCanvas: {
    height: '260px',
    backgroundColor: '#0f172a', 
    borderRadius: '12px',
    position: 'relative' as const,
    overflow: 'hidden'
  },
  svgGraphLine: {
    width: '100%',
    height: '100%',
    position: 'absolute' as const,
    top: 0,
    left: 0,
    zIndex: 2
  },
  chartWatermarkGrid: {
    position: 'absolute' as const,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundImage: 'linear-gradient(rgba(51,65,85,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(51,65,85,0.3) 1px, transparent 1px)',
    backgroundSize: '20px 20px',
    zIndex: 1
  },
  logTerminalContainer: {
    backgroundColor: '#0f172a',
    borderRadius: '12px',
    padding: '16px',
    height: '140px',
    overflowY: 'auto' as const,
    fontFamily: 'monospace',
    fontSize: '12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px'
  },
  logLineItem: {
    display: 'flex',
    gap: '8px',
    lineHeight: '1.4'
  },
  logTimestamp: {
    color: '#64748b'
  },
  logSource: {
    fontWeight: 'bold'
  },
  logMessage: {
    color: '#e2e8f0'
  },
  quickActionsGrid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    height: '140px',
    justifyContent: 'center'
  },
  actionCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: '#f8fafc',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0'
  },
  actionCardTitle: {
    margin: 0,
    fontSize: '14px',
    color: '#0f172a',
    fontWeight: '600'
  },
  actionCardDesc: {
    margin: 0,
    fontSize: '11px',
    color: '#64748b'
  },
  actionInteractiveBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    padding: '12px',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'background 0.2s',
    outline: 'none'
  },
  actionInteractiveLogoutBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fee2e2',
    padding: '12px',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'background 0.2s',
    outline: 'none'
  },
  modalOverlayMask: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px'
  },
  modalBodyWindow: {
    width: '100%',
    maxWidth: '900px',
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    overflow: 'hidden'
  },
  modalSplitGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr'
  },
  modalMetaSection: {
    padding: '32px',
    backgroundColor: '#ffffff'
  },
  modalHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between'
  },
  modalMainTitle: {
    margin: '0 0 4px 0',
    color: '#0f172a'
  },
  modalMetaLine: {
    margin: '2px 0',
    color: '#64748b',
    fontSize: '12px'
  },
  closeModalCrossBtn: {
    background: 'transparent',
    border: 'none',
    color: '#0f172a',
    cursor: 'pointer',
    height: 'fit-content'
  },
  modalMetricStack: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '14px',
    marginTop: '20px'
  },
  modalGridBrick: {
    backgroundColor: '#f8fafc',
    padding: '16px',
    borderRadius: '12px'
  },
  brickLabelText: {
    margin: '4px 0 2px 0',
    fontSize: '12px',
    color: '#64748b'
  },
  brickValueText: {
    fontSize: '18px',
    fontWeight: '700'
  },
  modalChartPane: {
    padding: '32px',
    backgroundColor: '#f8fafc',
    display: 'flex',
    flexDirection: 'column' as const
  },
  modalChartWrapper: {
    flex: 1,
    height: '220px',
    position: 'relative' as const
  },
  modalChartFooterLabel: {
    marginTop: '16px',
    color: '#64748b',
    textAlign: 'center' as const,
    fontSize: '12px'
  },
  centerStage: {
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f7fb'
  },
  loadingText: {
    marginTop: '20px',
    color: '#0284c7'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #dbeafe',
    borderTop: '3px solid #0284c7',
    borderRadius: '50%'
  }
};