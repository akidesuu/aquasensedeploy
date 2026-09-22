import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Sidebar from './components/Sidebar';
import DeviceManagement from './DeviceManagement';
import AccountManagement from './AccountManagement';
import type { FloaterNode } from './DeviceManagement';

import {
  Droplet,
  Thermometer,
  Eye,
  AlertTriangle,
  X,
  Radio,
  Activity,
  Cpu,
  Terminal,
  ShieldCheck,
  RefreshCw,
  Sliders,
  TrendingUp,
  LogOut,
  Sparkles,
  Loader2
} from 'lucide-react';

const LOCAL_IP = '192.168.18.21';
const FASTAPI_URL = import.meta.env?.VITE_API_URL || `http://${LOCAL_IP}:8000`;

interface PredictionData {
  predicted_do: number | string;
  status?: string;
}

interface TelemetryRecord {
  device_id: string;
  ph: number;
  temperature: number;
  turbidity: number;
  created_at?: string;
  timestamp?: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  source: string;
  message: string;
  type: 'info' | 'success' | 'warning';
}

interface AccountData {
  id?: string;
  name?: string;
  email: string;
  location?: string;
  role?: string;
  status?: string;
}

interface DashboardProps {
  onLogout: () => void;
}

const RADAR_POSITIONS: React.CSSProperties[] = [
  { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
  { top: '35%', left: '30%' },
  { bottom: '35%', right: '30%' },
  { top: '25%', right: '25%' },
  { bottom: '25%', left: '25%' }
];

const COLORS = ['#00c853', '#2196f3', '#ff9800', '#ff5c5c', '#8e44ad'];

export default function Dashboard({ onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedFloater, setSelectedFloater] = useState<FloaterNode | null>(null);
  const [nodePrediction, setNodePrediction] = useState<number | string | null>(null);
  const [nodePredictLoading, setNodePredictLoading] = useState<boolean>(false);

  const [modalHistory, setModalHistory] = useState<number[]>([]);
  const [trendHistory, setTrendHistory] = useState<number[]>([6.8, 7.0, 7.1, 6.9, 7.2, 7.4, 7.3]);
  const [floaters, setFloaters] = useState<FloaterNode[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: '1', timestamp: new Date().toLocaleTimeString(), source: 'SYS', message: 'AquaSense continuous stream online.', type: 'info' }
  ]);

  const addLog = useCallback((source: string, message: string, type: LogEntry['type']) => {
    setLogs((prev) => [
      { id: String(Date.now()), timestamp: new Date().toLocaleTimeString(), source, message, type },
      ...prev.slice(0, 4)
    ]);
  }, []);

  const normTab = activeTab.trim().toLowerCase().replace(/[_\s]+/g, '-');
  const isDeviceManagementTab = ['devices', 'device-management', 'devicemanagement'].includes(normTab);
  const isAccountManagementTab = ['accounts', 'account-management', 'accountmanagement', 'users', 'user-management', 'usermanagement'].includes(normTab);

  const fetchNodePrediction = useCallback(async (node: FloaterNode) => {
    setNodePredictLoading(true);

    try {
      const now = new Date();
      const payload = {
        'Temperature (°C)': node.metrics.temperature,
        'pH': node.metrics.ph,
        'Turbidity (NTU)': node.metrics.turbidity,
        'hour': now.getHours(),
        'day': now.getDate(),
        'month': now.getMonth() + 1
      };

      const res = await axios.post<PredictionData>(`${FASTAPI_URL}/predict`, payload);
      const predictedValue = res.data?.predicted_do;
      const numVal = typeof predictedValue === 'number' ? predictedValue : parseFloat(String(predictedValue));

      setNodePrediction(
        typeof predictedValue === 'number' ? predictedValue.toFixed(2) : String(predictedValue)
      );

      if (!isNaN(numVal)) {
        setModalHistory((prev) => [...prev.slice(-9), Number(numVal.toFixed(2))]);
      }

      addLog('ML_MODEL', `Inference calculated for node ${node.device_id}.`, 'success');
    } catch (err) {
      console.warn('Real-time node prediction failed, falling back:', err);
      if (prediction?.predicted_do !== undefined) {
        const fallback = typeof prediction.predicted_do === 'number'
          ? prediction.predicted_do.toFixed(2)
          : String(prediction.predicted_do);
        setNodePrediction(fallback);
      } else {
        setNodePrediction('N/A');
      }
    } finally {
      setNodePredictLoading(false);
    }
  }, [addLog, prediction?.predicted_do]);

  const fetchCentralData = useCallback(async () => {
    try {
      const [predRes, telemRes] = await Promise.all([
        axios.get<PredictionData>(`${FASTAPI_URL}/predict`),
        axios.get<TelemetryRecord[] | TelemetryRecord>(`${FASTAPI_URL}/telemetry`)
      ]);

      setError(null);
      setPrediction(predRes.data);

      const rawData = telemRes.data;
      const dataArray = Array.isArray(rawData) ? rawData : rawData ? [rawData] : [];

      if (dataArray.length > 0) {
        const deviceMap = new Map<string, TelemetryRecord>();
        dataArray.forEach((record) => {
          const id = record.device_id || 'UNKNOWN_NODE';
          if (!deviceMap.has(id)) deviceMap.set(id, record);
        });

        const updatedNodes: FloaterNode[] = Array.from(deviceMap.values()).map((record, index) => {
          const devId = String(record.device_id || `ESP32-NODE-${index + 1}`);
          return {
            id: devId,
            device_id: devId,
            name: `Node ${devId}`,
            location: 'Active Field Node',
            color: COLORS[index % COLORS.length],
            status: 'Online',
            metrics: {
              ph: Number(record.ph ?? 0),
              temperature: Number(record.temperature ?? 0),
              turbidity: Number(record.turbidity ?? 0)
            }
          };
        });

        setFloaters(updatedNodes);

        setSelectedFloater((currentSelected) => {
          if (!currentSelected) return null;
          const freshData = updatedNodes.find((n) => n.id === currentSelected.id);
          return freshData ? { ...currentSelected, metrics: freshData.metrics } : currentSelected;
        });

        const latestVal = typeof predRes.data?.predicted_do === 'number'
          ? predRes.data.predicted_do
          : updatedNodes[0]?.metrics.ph ?? 7.0;

        setTrendHistory((prev) => [...prev.slice(-19), Number(latestVal.toFixed(2))]);
        addLog('ESP32/DB', `Stream synced (${updatedNodes.length} active nodes).`, 'success');
      }
    } catch (err) {
      console.error('Backend streaming error:', err);
      setError('AquaSense gateway unreachable. Retrying stream...');
    } finally {
      setLoading(false);
    }
  }, [addLog]);

  const handleSelectFloater = (node: FloaterNode) => {
    setSelectedFloater(node);
    setModalHistory([]);
    fetchNodePrediction(node);
  };

  useEffect(() => {
    if (selectedFloater) {
      fetchNodePrediction(selectedFloater);
    }
  }, [selectedFloater?.metrics.ph, selectedFloater?.metrics.temperature, selectedFloater?.metrics.turbidity]);

  useEffect(() => {
    fetchCentralData();
    const pollInterval = setInterval(fetchCentralData, 3000);
    return () => clearInterval(pollInterval);
  }, [fetchCentralData]);

  const handleAddDevice = (newDev: { id: string; name: string; location: string }) => {
    const newNode: FloaterNode = {
      id: newDev.id,
      device_id: newDev.id,
      name: newDev.name,
      location: newDev.location,
      color: COLORS[floaters.length % COLORS.length],
      status: 'Online',
      metrics: { ph: 7.0, temperature: 25.0, turbidity: 5.0 }
    };
    setFloaters((prev) => [...prev, newNode]);
    addLog('SYS', `Device ${newDev.id} registered.`, 'info');
  };

  const handleRemoveDevice = (id: string) => {
    setFloaters((prev) => prev.filter((f) => f.id !== id));
    addLog('SYS', `Device ${id} removed.`, 'warning');
  };

  const handleRebootDevice = (id: string) => {
    addLog('ESP32', `Reboot signal dispatched to node ${id}.`, 'info');
  };

  if (loading && !prediction) {
    return (
      <div style={styles.centerStage}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Connecting to AquaSense Live Stream...</p>
      </div>
    );
  }

  const avgDo = typeof prediction?.predicted_do === 'number'
    ? prediction.predicted_do.toFixed(1)
    : prediction?.predicted_do ?? '0.0';

  const svgWidth = 500;
  const svgHeight = 200;
  const padding = 25;
  const minVal = Math.min(...trendHistory, 4.0);
  const maxVal = Math.max(...trendHistory, 10.0);

  const points = trendHistory
    .map((val, idx) => {
      const x = padding + (idx * (svgWidth - padding * 2)) / Math.max(trendHistory.length - 1, 1);
      const y = svgHeight - padding - ((val - minVal) * (svgHeight - padding * 2)) / (maxVal - minVal || 1);
      return `${x},${y}`;
    })
    .join(' ');

  const currentX = padding + ((trendHistory.length - 1) * (svgWidth - padding * 2)) / Math.max(trendHistory.length - 1, 1);
  const currentY = svgHeight - padding - ((trendHistory[trendHistory.length - 1] - minVal) * (svgHeight - padding * 2)) / (maxVal - minVal || 1);

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

        {activeTab === 'dashboard' && (
          <>
            <section style={styles.kpiContainerRow}>
              <div style={styles.kpiCard}>
                <div style={styles.cardHeaderGlow}>
                  <Radio size={14} color="#16a34a" style={{ marginRight: '6px' }} />
                  <p style={styles.kpiTitle}>ACTIVE ARRAYS</p>
                </div>
                <p style={{ ...styles.kpiValue, color: '#16a34a' }}>
                  {floaters.length < 10 ? `0${floaters.length}` : floaters.length}
                </p>
              </div>

              <div style={styles.kpiCard}>
                <div style={styles.cardHeaderGlow}>
                  <Cpu size={14} color="#0284c7" style={{ marginRight: '6px' }} />
                  <p style={styles.kpiTitle}>HARDWARE GATEWAY</p>
                </div>
                <p style={{ ...styles.kpiValue, color: '#0284c7' }}>ESP32</p>
              </div>

              <div style={styles.kpiCard}>
                <div style={styles.cardHeaderGlow}>
                  <Activity size={14} color="#e11d48" style={{ marginRight: '6px' }} />
                  <p style={styles.kpiTitle}>MEAN DO PREDICTION</p>
                </div>
                <p style={{ ...styles.kpiValue, color: '#e11d48' }}>
                  {avgDo}<span style={styles.unitText}> mg/L</span>
                </p>
              </div>

              <div style={styles.kpiCard}>
                <div style={styles.cardHeaderGlow}>
                  <div style={styles.pulseDot} />
                  <p style={styles.kpiTitle}>STREAM STATUS</p>
                </div>
                <p style={styles.kpiValue}>{error ? 'Reconnecting' : 'Continuous'}</p>
              </div>
            </section>

            <div style={styles.splitGridDashboard}>
              <div style={styles.panelBox}>
                <h3 style={styles.panelBoxTitle}>Fleet Radar</h3>
                <div style={styles.mapCanvas}>
                  <div style={styles.radarRing1} />
                  <div style={styles.radarRing2} />

                  {floaters.length === 0 ? (
                    <div style={styles.emptyState}>No active ESP32 nodes connected</div>
                  ) : (
                    floaters.map((node, idx) => {
                      const pos = floaters.length === 1 ? RADAR_POSITIONS[0] : RADAR_POSITIONS[(idx % (RADAR_POSITIONS.length - 1)) + 1];
                      return (
                        <button
                          key={node.id}
                          type="button"
                          onClick={() => handleSelectFloater(node)}
                          style={{ ...styles.floaterInteractiveBubble, ...pos }}
                        >
                          <div style={{ ...styles.colorCircleNode, borderColor: node.color }}>
                            <div style={{ ...styles.innerCoreRadarDot, backgroundColor: node.color }} />
                          </div>
                          <span style={styles.bubbleTextLabel}>{node.name}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div style={styles.panelBox}>
                <div style={styles.panelHeaderRow}>
                  <h3 style={{ ...styles.panelBoxTitle, margin: 0 }}>DO Live Vector Stream</h3>
                  <div style={styles.cryptoBadge}>
                    <TrendingUp size={12} style={{ marginRight: '4px' }} />
                    <span>Real-time Sync</span>
                  </div>
                </div>
                <div style={styles.chartMockCanvas}>
                  <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={styles.svgGraphLine}>
                    <line x1="0" y1={padding} x2={svgWidth} y2={padding} stroke="#334155" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
                    <line x1="0" y1={svgHeight / 2} x2={svgWidth} y2={svgHeight / 2} stroke="#334155" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
                    <line x1="0" y1={svgHeight - padding} x2={svgWidth} y2={svgHeight - padding} stroke="#334155" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />

                    <polyline points={points} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                    {trendHistory.length > 0 && (
                      <circle cx={currentX} cy={currentY} r="6" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                    )}
                  </svg>
                  <div style={styles.chartWatermarkGrid} />
                </div>
              </div>
            </div>

            <div style={styles.splitGridDashboard}>
              <div style={styles.panelBox}>
                <div style={styles.flexHeader}>
                  <Terminal size={18} color="#475569" />
                  <h3 style={{ ...styles.panelBoxTitle, margin: 0 }}>System Logs & Stream Terminal</h3>
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

              <div style={styles.panelBox}>
                <div style={styles.flexHeader}>
                  <Sliders size={18} color="#475569" />
                  <h3 style={{ ...styles.panelBoxTitle, margin: 0 }}>Control Plane</h3>
                </div>
                <div style={styles.quickActionsGrid}>
                  <div style={styles.actionCard}>
                    <ShieldCheck size={22} color="#16a34a" />
                    <div>
                      <h4 style={styles.actionCardTitle}>Continuous Polling Active</h4>
                      <p style={styles.actionCardDesc}>Automated 3s backend telemetry fetching</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button type="button" style={{ ...styles.actionInteractiveBtn, flex: 1 }} onClick={fetchCentralData}>
                      <RefreshCw size={16} color="#0284c7" />
                      <span style={{ fontWeight: '600', fontSize: '13px', color: '#0f172a' }}>Sync Stream</span>
                    </button>
                    <button type="button" style={{ ...styles.actionInteractiveLogoutBtn, flex: 1 }} onClick={onLogout}>
                      <LogOut size={16} color="#dc2626" />
                      <span style={{ fontWeight: '600', fontSize: '13px', color: '#991b1b' }}>Logout</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {isDeviceManagementTab && (
          <DeviceManagement
            devices={floaters}
            onAddDevice={handleAddDevice}
            onRemoveDevice={handleRemoveDevice}
            onRebootDevice={handleRebootDevice}
          />
        )}

        {isAccountManagementTab && (
          <AccountManagement
            onAddAccount={(acc: AccountData) => addLog('SYS', `Account ${acc.email} registered.`, 'success')}
            onEditAccount={(_id: string, acc: AccountData) => addLog('SYS', `Account ${acc.email} updated.`, 'info')}
            onDeleteAccount={(id: string) => addLog('SYS', `Account ${id} deleted.`, 'warning')}
          />
        )}

        {selectedFloater && (
          <div style={styles.modalOverlayMask} onClick={() => setSelectedFloater(null)}>
            <div style={styles.modalBodyWindow} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalSplitGrid}>
                <div style={styles.modalMetaSection}>
                  <div style={styles.modalHeaderRow}>
                    <div>
                      <h3 style={styles.modalMainTitle}>{selectedFloater.name}</h3>
                      <p style={styles.modalMetaLine}>ID: {selectedFloater.device_id}</p>
                      <p style={styles.modalMetaLine}>{selectedFloater.location}</p>
                    </div>
                    <button type="button" onClick={() => setSelectedFloater(null)} style={styles.closeModalCrossBtn}>
                      <X size={20} />
                    </button>
                  </div>

                  <div style={styles.modalMetricStack}>
                    <div style={styles.modalPredictedDoBrick}>
                      <div style={styles.flexGroup8}>
                        <Sparkles size={18} color="#059669" />
                        <div>
                          <p style={styles.predictedBrickLabel}>Predicted Dissolved Oxygen</p>
                          <span style={styles.predictedBrickSub}>FastAPI Model Inference</span>
                        </div>
                      </div>
                      <span style={styles.predictedBrickValue}>
                        {nodePredictLoading ? (
                          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                        ) : (
                          <>
                            {nodePrediction ?? '0.00'}
                            <span style={{ fontSize: '12px', fontWeight: '500', marginLeft: '3px' }}>mg/L</span>
                          </>
                        )}
                      </span>
                    </div>

                    <div style={styles.modalGridBrick}>
                      <div style={styles.flexGroup8}>
                        <Droplet size={18} color="#16a34a" />
                        <p style={styles.brickLabelText}>pH</p>
                      </div>
                      <span style={{ ...styles.brickValueText, color: '#16a34a' }}>{selectedFloater.metrics.ph}</span>
                    </div>

                    <div style={styles.modalGridBrick}>
                      <div style={styles.flexGroup8}>
                        <Thermometer size={18} color="#0284c7" />
                        <p style={styles.brickLabelText}>Temperature</p>
                      </div>
                      <span style={{ ...styles.brickValueText, color: '#0284c7' }}>{selectedFloater.metrics.temperature}°C</span>
                    </div>

                    <div style={styles.modalGridBrick}>
                      <div style={styles.flexGroup8}>
                        <Eye size={18} color="#e11d48" />
                        <p style={styles.brickLabelText}>Turbidity</p>
                      </div>
                      <span style={{ ...styles.brickValueText, color: '#e11d48' }}>{selectedFloater.metrics.turbidity} NTU</span>
                    </div>
                  </div>
                </div>

                <div style={styles.modalChartPane}>
                  <div style={styles.modalChartWrapper}>
                    {(() => {
                      const svgW = 340;
                      const svgH = 180;
                      const padTop = 30;
                      const padBottom = 30;
                      const padLeft = 20;
                      const padRight = 20;

                      const rawPoints = modalHistory.length > 0 ? modalHistory : [6.5];
                      let dataPoints = rawPoints;
                      if (dataPoints.length === 1) {
                        dataPoints = [dataPoints[0], dataPoints[0]];
                      }

                      const minData = Math.min(...dataPoints);
                      const maxData = Math.max(...dataPoints);

                      let calcY: (val: number) => number;

                      if (minData === maxData) {
                        calcY = () => svgH / 2;
                      } else {
                        calcY = (val: number) => {
                          return svgH - padBottom - ((val - minData) * (svgH - padTop - padBottom)) / (maxData - minData);
                        };
                      }

                      const polyPoints = dataPoints
                        .map((val, idx) => {
                          const x = padLeft + (idx * (svgW - padLeft - padRight)) / Math.max(dataPoints.length - 1, 1);
                          const y = calcY(val);
                          return `${x},${y}`;
                        })
                        .join(' ');

                      const lastX = padLeft + ((dataPoints.length - 1) * (svgW - padLeft - padRight)) / Math.max(dataPoints.length - 1, 1);
                      const lastY = calcY(dataPoints[dataPoints.length - 1]);

                      return (
                        <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: '100%', position: 'relative', zIndex: 2 }}>
                          <line x1="0" y1={padTop} x2={svgW} y2={padTop} stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
                          <line x1="0" y1={svgH / 2} x2={svgW} y2={svgH / 2} stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
                          <line x1="0" y1={svgH - padBottom} x2={svgW} y2={svgH - padBottom} stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />

                          <polyline
                            points={polyPoints}
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ transition: 'all 0.4s ease-in-out' }}
                          />

                          <circle
                            cx={lastX}
                            cy={lastY}
                            r="6"
                            fill="#10b981"
                            stroke="#064e3b"
                            strokeWidth="2"
                            style={{ transition: 'all 0.4s ease-in-out' }}
                          />
                          <circle
                            cx={lastX}
                            cy={lastY}
                            r="2.5"
                            fill="#ffffff"
                            style={{ transition: 'all 0.4s ease-in-out' }}
                          />
                        </svg>
                      );
                    })()}
                    <div style={styles.chartWatermarkGridModal} />
                  </div>
                  <div style={styles.modalChartFooterLabel}>ESP32 Live Telemetry Vector</div>
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
  appContainer: { display: 'flex', minHeight: '100vh', width: '100vw', backgroundColor: '#f8fafc', overflowX: 'hidden' as const, boxSizing: 'border-box' as const },
  workspaceBody: { flex: 1, marginLeft: '260px', width: 'calc(100vw - 260px)', minHeight: '100vh', overflowY: 'auto' as const, padding: '24px', display: 'flex', flexDirection: 'column' as const, gap: '24px', color: '#1e293b', fontFamily: 'sans-serif', boxSizing: 'border-box' as const },
  warningBanner: { display: 'flex', alignItems: 'center', backgroundColor: '#fee2e2', border: '1px solid #ef4444', color: '#b91c1c', padding: '12px 18px', borderRadius: '10px' },
  kpiContainerRow: { display: 'flex', gap: '16px', width: '100%', boxSizing: 'border-box' as const },
  kpiCard: { flex: 1, minWidth: '0', backgroundColor: '#ffffff', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', boxSizing: 'border-box' as const },
  cardHeaderGlow: { display: 'flex', alignItems: 'center', marginBottom: '12px' },
  kpiTitle: { margin: 0, fontSize: '12px', color: '#64748b', fontWeight: '600' },
  kpiValue: { margin: 0, fontSize: '30px', fontWeight: '800' },
  unitText: { fontSize: '14px', color: '#64748b' },
  pulseDot: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e', marginRight: '8px' },
  splitGridDashboard: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', width: '100%', boxSizing: 'border-box' as const },
  panelBox: { backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', minWidth: '0', boxSizing: 'border-box' as const },
  panelHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  panelBoxTitle: { margin: '0 0 24px 0', fontSize: '16px', fontWeight: '700', color: '#0f172a' },
  cryptoBadge: { display: 'flex', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.1)', color: '#059669', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  mapCanvas: { height: '260px', backgroundColor: '#f8fafc', borderRadius: '12px', position: 'relative' as const, overflow: 'hidden' },
  emptyState: { display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' },
  radarRing1: { position: 'absolute' as const, width: '120px', height: '120px', borderRadius: '50%', border: '1px dashed #cbd5e1', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
  radarRing2: { position: 'absolute' as const, width: '220px', height: '220px', borderRadius: '50%', border: '1px solid #e2e8f0', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
  floaterInteractiveBubble: { position: 'absolute' as const, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '6px' },
  colorCircleNode: { width: '38px', height: '38px', borderRadius: '50%', border: '2px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  innerCoreRadarDot: { width: '10px', height: '10px', borderRadius: '50%' },
  bubbleTextLabel: { fontSize: '11px', color: '#475569', fontWeight: '600' },
  chartMockCanvas: { height: '260px', backgroundColor: '#0b1120', borderRadius: '12px', position: 'relative' as const, overflow: 'hidden' },
  svgGraphLine: { width: '100%', height: '100%', position: 'absolute' as const, top: 0, left: 0, zIndex: 2 },
  chartWatermarkGrid: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'linear-gradient(rgba(30,41,59,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(30,41,59,0.5) 1px, transparent 1px)', backgroundSize: '16px 16px', zIndex: 1 },
  chartWatermarkGridModal: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'linear-gradient(rgba(30,41,59,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(30,41,59,0.7) 1px, transparent 1px)', backgroundSize: '14px 14px', zIndex: 1 },
  flexHeader: { display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '8px' },
  flexGroup8: { display: 'flex', alignItems: 'center', gap: '8px' },
  logTerminalContainer: { backgroundColor: '#0b1120', borderRadius: '12px', padding: '16px', height: '140px', overflowY: 'auto' as const, fontFamily: 'monospace', fontSize: '12px', display: 'flex', flexDirection: 'column' as const, gap: '8px' },
  logLineItem: { display: 'flex', gap: '8px', lineHeight: '1.4' },
  logTimestamp: { color: '#64748b' },
  logSource: { fontWeight: 'bold' },
  logMessage: { color: '#e2e8f0' },
  quickActionsGrid: { display: 'flex', flexDirection: 'column' as const, gap: '12px', height: '140px', justifyContent: 'center' },
  actionCard: { display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' },
  actionCardTitle: { margin: 0, fontSize: '14px', color: '#0f172a', fontWeight: '600' },
  actionCardDesc: { margin: 0, fontSize: '11px', color: '#64748b' },
  actionInteractiveBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', padding: '12px', borderRadius: '12px', cursor: 'pointer', outline: 'none' },
  actionInteractiveLogoutBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', padding: '12px', borderRadius: '12px', cursor: 'pointer', outline: 'none' },
  modalOverlayMask: { position: 'fixed' as const, inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
  modalBodyWindow: { width: '100%', maxWidth: '800px', backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden' },
  modalSplitGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr' },
  modalMetaSection: { padding: '32px', backgroundColor: '#ffffff' },
  modalHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  modalMainTitle: { margin: '0 0 4px 0', color: '#0f172a', fontSize: '18px', fontWeight: '700' },
  modalMetaLine: { margin: '2px 0', color: '#64748b', fontSize: '12px' },
  closeModalCrossBtn: { background: 'transparent', border: 'none', color: '#0f172a', cursor: 'pointer', height: 'fit-content' },
  modalMetricStack: { display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginTop: '20px' },
  modalPredictedDoBrick: { backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '14px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  predictedBrickLabel: { margin: 0, fontSize: '13px', color: '#065f46', fontWeight: '700' },
  predictedBrickSub: { fontSize: '10px', color: '#047857', display: 'block' },
  predictedBrickValue: { fontSize: '20px', fontWeight: '800', color: '#065f46', display: 'flex', alignItems: 'center' },
  modalGridBrick: { backgroundColor: '#f8fafc', padding: '14px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  brickLabelText: { margin: 0, fontSize: '13px', color: '#64748b', fontWeight: '600' },
  brickValueText: { fontSize: '18px', fontWeight: '700' },
  modalChartPane: { padding: '24px', backgroundColor: '#070c18', display: 'flex', flexDirection: 'column' as const, justifyContent: 'center', alignItems: 'center' },
  modalChartWrapper: { width: '100%', height: '220px', position: 'relative' as const, backgroundColor: '#070c18', borderRadius: '8px', overflow: 'hidden' },
  modalChartFooterLabel: { marginTop: '12px', color: '#64748b', textAlign: 'center' as const, fontSize: '11px', letterSpacing: '0.5px' },
  centerStage: { display: 'flex', flexDirection: 'column' as const, justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f5f7fb' },
  loadingText: { marginTop: '20px', color: '#0284c7' },
  spinner: { width: '40px', height: '40px', border: '3px solid #dbeafe', borderTop: '3px solid #0284c7', borderRadius: '50%' }
};