import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Database,
  TrendingUp,
  Sparkles,
  Loader2,
  RefreshCw,
  MapPin
} from 'lucide-react';

declare global {
  interface Window {
    L: any;
  }
}

// Ensure Leaflet Assets are loaded globally as early as possible
if (typeof document !== 'undefined') {
  if (!document.getElementById('leaflet-css-pkg')) {
    const link = document.createElement('link');
    link.id = 'leaflet-css-pkg';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }
  if (!document.getElementById('leaflet-js-pkg')) {
    const script = document.createElement('script');
    script.id = 'leaflet-js-pkg';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    document.head.appendChild(script);
  }
}

const FASTAPI_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'https://aquasense-backend-osmi.onrender.com';

const STALE_TIMEOUT_MS = 12 * 60 * 60 * 1000;
const DEFAULT_LAT = 8.4961;
const DEFAULT_LNG = 124.6390;

interface PredictionData {
  predicted_do: number | string;
  status?: string;
}

interface TelemetryRecord {
  device_id: string;
  ph: number;
  temperature: number;
  turbidity: number;
  predicted_do?: number | string;
  created_at?: string;
  timestamp?: string;
}

export interface AccountData {
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
  const [trendHistory, setTrendHistory] = useState<number[]>([7.0, 7.0, 7.0, 7.0, 7.0]);
  const [floaters, setFloaters] = useState<FloaterNode[]>([]);
  const [rawTelemetryList, setRawTelemetryList] = useState<TelemetryRecord[]>([]);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const normTab = activeTab.trim().toLowerCase().replace(/[\s]+/g, '-');
  const isDeviceManagementTab = ['devices', 'device-management', 'devicemanagement'].includes(normTab);
  const isAccountManagementTab = ['accounts', 'account-management', 'accountmanagement', 'users', 'user-management', 'usermanagement'].includes(normTab);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  };

  const fetchNodePrediction = useCallback(async (node: FloaterNode) => {
    if (node.status === 'Offline' || node.metrics?.ph === 0) {
      setNodePrediction('0.00');
      setModalHistory([0, 0, 0, 0]);
      setNodePredictLoading(false);
      return;
    }
    setNodePredictLoading(true);
    try {
      const now = new Date();
      const payload = {
        'Temperature (°C)': node.metrics?.temperature,
        'pH': node.metrics?.ph,
        'Turbidity (NTU)': node.metrics?.turbidity,
        'hour': now.getHours(),
        'day': now.getDate(),
        'month': now.getMonth() + 1
      };
      const res = await axios.post<PredictionData>(`${FASTAPI_URL}/predict`, payload, getAuthHeaders());
      const predictedValue = res.data?.predicted_do;
      const numVal = typeof predictedValue === 'number' ? predictedValue : parseFloat(String(predictedValue));
      
      setNodePrediction(!isNaN(numVal) ? numVal.toFixed(2) : String(predictedValue));
      if (!isNaN(numVal)) {
        setModalHistory((prev) => [...prev.slice(-9), Number(numVal.toFixed(2))]);
      }
    } catch (err) {
      console.warn('Real-time node prediction failed, falling back:', err);
      if (prediction?.predicted_do !== undefined) {
        const numVal = typeof prediction.predicted_do === 'number'
          ? prediction.predicted_do
          : parseFloat(String(prediction.predicted_do));
        setNodePrediction(!isNaN(numVal) ? numVal.toFixed(2) : String(prediction.predicted_do));
      } else {
        setNodePrediction('N/A');
      }
    } finally {
      setNodePredictLoading(false);
    }
  }, [prediction?.predicted_do]);

  const fetchCentralData = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const [predRes, telemRes] = await Promise.all([
        axios.get<PredictionData>(`${FASTAPI_URL}/predict`, headers),
        axios.get<TelemetryRecord[] | TelemetryRecord>(`${FASTAPI_URL}/telemetry?limit=100`, headers)
      ]);
      setError(null);
      setPrediction(predRes.data);
      const rawData = telemRes.data;
      let dataArray: TelemetryRecord[] = Array.isArray(rawData) ? rawData : rawData ? [rawData] : [];
      
      dataArray.sort((a, b) => {
        const timeA = new Date(a.created_at || a.timestamp || 0).getTime();
        const timeB = new Date(b.created_at || b.timestamp || 0).getTime();
        return timeB - timeA;
      });
      setRawTelemetryList(dataArray);

      if (dataArray.length > 0) {
        const deviceMap = new Map<string, TelemetryRecord>();
        dataArray.forEach((record) => {
          const id = record.device_id || 'UNKNOWN NODE';
          if (!deviceMap.has(id)) deviceMap.set(id, record);
        });
        const nowMs = Date.now();
        const activeNodes: FloaterNode[] = [];
        Array.from(deviceMap.values()).forEach((record, index) => {
          const recordTime = new Date(record.created_at || record.timestamp || 0).getTime();
          const isFresh = Math.abs(nowMs - recordTime) <= STALE_TIMEOUT_MS;
          if (isFresh) {
            const devId = String(record.device_id || `ESP32-NODE-${index + 1}`);
            activeNodes.push({
              id: devId,
              device_id: devId,
              name: `Node ${devId}`,
              location: 'King Fisher Wee Viral Multimedia Services, Kauswagan CDO',
              color: COLORS[index % COLORS.length],
              status: 'Online',
              metrics: {
                ph: Number(record.ph ?? 0),
                temperature: Number(record.temperature ?? 0),
                turbidity: Number(record.turbidity ?? 0)
              }
            });
          }
        });
        setFloaters(activeNodes);
        setSelectedFloater((currentSelected: FloaterNode | null) => {
          if (!currentSelected) return null;
          const freshData = activeNodes.find((n) => n.id === currentSelected.id);
          return freshData ? { ...currentSelected, metrics: freshData.metrics } : currentSelected;
        });

        if (activeNodes.length > 0) {
          const latestDoVal = typeof predRes.data?.predicted_do === 'number'
            ? predRes.data.predicted_do
            : parseFloat(String(predRes.data?.predicted_do || 7.0));
          if (!isNaN(latestDoVal)) {
            setTrendHistory((prev) => [...prev.slice(-14), Number(latestDoVal.toFixed(2))]);
          }
        }
      } else {
        setFloaters([]);
      }
    } catch (err: any) {
      console.error('Backend streaming error:', err);
      if (err?.response?.status === 401) {
        setError('Unauthorized session. Please log in again.');
      } else {
        setError('AquaSense gateway unreachable. Retrying stream...');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectFloater = useCallback((node: FloaterNode) => {
    setSelectedFloater(node);
    setModalHistory([]);
    fetchNodePrediction(node);
  }, [fetchNodePrediction]);

  const handleMapPinClick = () => {
    if (floaters.length > 0) {
      handleSelectFloater(floaters[0]);
    } else {
      const offlineNode: FloaterNode = {
        id: 'ESP32_POND_01',
        device_id: 'ESP32_POND_01',
        name: 'Node ESP32_POND_01 (Offline)',
        location: 'King Fisher Wee Viral Multimedia Services, Kauswagan CDO',
        color: '#ef4444',
        status: 'Offline',
        metrics: { ph: 0, temperature: 0, turbidity: 0 }
      };
      handleSelectFloater(offlineNode);
    }
  };

  const initMapInstance = useCallback(() => {
    if (!mapContainerRef.current || !window.L) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    const map = window.L.map(mapContainerRef.current, {
      center: [DEFAULT_LAT, DEFAULT_LNG],
      zoom: 16,
      zoomControl: true
    });
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© AquaSense GIS | OpenStreetMap'
    }).addTo(map);
    mapInstanceRef.current = map;

    const forceRefresh = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    requestAnimationFrame(forceRefresh);
    setTimeout(forceRefresh, 100);
    setTimeout(forceRefresh, 300);
    setTimeout(forceRefresh, 800);
  }, []);

  useEffect(() => {
    if (loading || activeTab !== 'dashboard') return;
    let isMounted = true;
    let pollInterval: any = null;

    const prepareAndBuildMap = () => {
      if (!isMounted) return;
      if (window.L) {
        initMapInstance();
      } else {
        pollInterval = setInterval(() => {
          if (window.L) {
            clearInterval(pollInterval);
            if (isMounted) initMapInstance();
          }
        }, 50);
      }
    };
    prepareAndBuildMap();

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [loading, activeTab, initMapInstance]);

  useEffect(() => {
    if (loading || activeTab !== 'dashboard' || !mapInstanceRef.current || !window.L) return;
    const Leaflet = window.L;
    const isOnline = floaters.length > 0;
    const pinColor = isOnline ? '#22c55e' : '#ef4444';
    const pinIconHtml = `
      <div style="cursor: pointer; transform: translate(-50%, -100%); transition: transform 0.2s ease;">
        <svg width="38" height="38" viewBox="0 0 24 24" fill="${pinColor}" stroke="#ffffff" stroke-width="1.5" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <circle cx="12" cy="9" r="2.5" fill="#ffffff"/>
        </svg>
      </div>`;

    const customIcon = Leaflet.divIcon({
      className: 'aquasense-interactive-pin',
      html: pinIconHtml,
      iconSize: [38, 38],
      iconAnchor: [19, 38]
    });

    if (markerRef.current) {
      mapInstanceRef.current.removeLayer(markerRef.current);
    }
    markerRef.current = Leaflet.marker([DEFAULT_LAT, DEFAULT_LNG], { icon: customIcon }).addTo(mapInstanceRef.current);
    markerRef.current.on('click', () => {
      handleMapPinClick();
    });
  }, [loading, activeTab, floaters]);

  useEffect(() => {
    if (selectedFloater) {
      fetchNodePrediction(selectedFloater);
    }
  }, [selectedFloater?.metrics?.ph, selectedFloater?.metrics?.temperature, selectedFloater?.metrics?.turbidity, fetchNodePrediction]);

  useEffect(() => {
    fetchCentralData();
    const pollInterval = setInterval(fetchCentralData, 3000);
    return () => clearInterval(pollInterval);
  }, [fetchCentralData]);

  if (loading && !prediction) {
    return (
      <div style={styles.centerStage}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Connecting to AquaSense Live Stream...</p>
      </div>
    );
  }

  const isHardwareOnline = floaters.length > 0;
  const rawAvgDo = typeof prediction?.predicted_do === 'number'
    ? prediction.predicted_do
    : parseFloat(String(prediction?.predicted_do || 0));
  const avgDo = isHardwareOnline && !isNaN(rawAvgDo) ? rawAvgDo.toFixed(2) : '0.00';

  const svgWidth = 500;
  const svgHeight = 220;
  const padLeft = 45;
  const padBottom = 30;
  const padTop = 20;
  const padRight = 20;
  const minDoAxis = 0;
  const maxDoAxis = 12;

  const getYCoordinate = (doValue: number) => {
    const clamped = Math.max(minDoAxis, Math.min(maxDoAxis, doValue));
    return svgHeight - padBottom - ((clamped - minDoAxis) / (maxDoAxis - minDoAxis)) * (svgHeight - padTop - padBottom);
  };

  const livePoints = isHardwareOnline ? trendHistory : [0, 0, 0, 0, 0, 0];
  const points = livePoints
    .map((val, idx) => {
      const x = padLeft + (idx * (svgWidth - padLeft - padRight)) / Math.max(livePoints.length - 1, 1);
      const y = isHardwareOnline ? getYCoordinate(val) : svgHeight - padBottom;
      return `${x},${y}`;
    })
    .join(' ');

  const currentX = padLeft + ((livePoints.length - 1) * (svgWidth - padLeft - padRight)) / Math.max(livePoints.length - 1, 1);
  const currentY = isHardwareOnline ? getYCoordinate(livePoints[livePoints.length - 1]) : svgHeight - padBottom;

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
                  <Radio size={14} color={isHardwareOnline ? '#16a34a' : '#94a3b8'} style={{ marginRight: '6px' }} />
                  <p style={styles.kpiTitle}>ACTIVE ARRAYS</p>
                </div>
                <p style={{ ...styles.kpiValue, color: isHardwareOnline ? '#16a34a' : '#94a3b8' }}>
                  {floaters.length < 10 ? `0${floaters.length}` : floaters.length}
                </p>
              </div>

              <div style={styles.kpiCard}>
                <div style={styles.cardHeaderGlow}>
                  <Cpu size={14} color="#0284c7" style={{ marginRight: '6px' }} />
                  <p style={styles.kpiTitle}>HARDWARE GATEWAY</p>
                </div>
                <p style={{ ...styles.kpiValue, color: isHardwareOnline ? '#0284c7' : '#94a3b8' }}>
                  {isHardwareOnline ? 'ESP32' : 'OFFLINE'}
                </p>
              </div>

              <div style={styles.kpiCard}>
                <div style={styles.cardHeaderGlow}>
                  <Activity size={14} color={isHardwareOnline ? '#e11d48' : '#94a3b8'} style={{ marginRight: '6px' }} />
                  <p style={styles.kpiTitle}>MEAN DO PREDICTION</p>
                </div>
                <p style={{ ...styles.kpiValue, color: isHardwareOnline ? '#e11d48' : '#94a3b8' }}>
                  {avgDo}<span style={styles.unitText}> mg/L</span>
                </p>
              </div>

              <div style={styles.kpiCard}>
                <div style={styles.cardHeaderGlow}>
                  <div style={{ ...styles.pulseDot, backgroundColor: isHardwareOnline ? '#22c55e' : '#ef4444' }} />
                  <p style={styles.kpiTitle}>STREAM STATUS</p>
                </div>
                <p style={{ ...styles.kpiValue, color: isHardwareOnline ? '#0f172a' : '#ef4444', fontSize: '22px' }}>
                  {error ? 'Reconnecting' : isHardwareOnline ? 'Continuous' : 'Offline'}
                </p>
              </div>
            </section>

            <div style={styles.splitGridDashboard}>
              <div style={styles.panelBox}>
                <div style={styles.panelHeaderRow}>
                  <div style={styles.flexHeader}>
                    <MapPin size={18} color="#0284c7" />
                    <h3 style={{ ...styles.panelBoxTitle, margin: 0 }}>Fleet Geolocation Radar Map</h3>
                  </div>
                  <span style={{
                    ...styles.cryptoBadge,
                    backgroundColor: isHardwareOnline ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    color: isHardwareOnline ? '#16a34a' : '#ef4444'
                  }}>
                    {isHardwareOnline ? 'Node Online' : 'Node Offline'}
                  </span>
                </div>
                <div style={styles.mapCanvas}>
                  <div ref={mapContainerRef} style={{ width: '100%', height: '100%', borderRadius: '12px', zIndex: 1 }} />
                </div>
              </div>

              <div style={styles.panelBox}>
                <div style={styles.panelHeaderRow}>
                  <h3 style={{ ...styles.panelBoxTitle, margin: 0 }}>DO Live Vector Stream</h3>
                  <div style={{ ...styles.cryptoBadge, backgroundColor: isHardwareOnline ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: isHardwareOnline ? '#059669' : '#ef4444' }}>
                    <TrendingUp size={12} style={{ marginRight: '4px' }} />
                    <span>{isHardwareOnline ? 'Real-time Sync' : 'Offline (No Active Stream)'}</span>
                  </div>
                </div>
                <div style={styles.chartMockCanvas}>
                  <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={styles.svgGraphLine}>
                    {[12, 9, 6, 3, 0].map((val) => {
                      const y = getYCoordinate(val);
                      return (
                        <g key={`y-axis-${val}`}>
                          <line x1={padLeft} y1={y} x2={svgWidth - padRight} y2={y} stroke="#334155" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
                          <text x={padLeft - 8} y={y + 4} fill="#94a3b8" fontSize="10" textAnchor="end" fontWeight="600">{val}</text>
                        </g>
                      );
                    })}
                    <line x1={padLeft} y1={svgHeight - padBottom} x2={svgWidth - padRight} y2={svgHeight - padBottom} stroke="#475569" strokeWidth="1.5" />
                    <text x={padLeft} y={svgHeight - 10} fill="#64748b" fontSize="10" textAnchor="start">History</text>
                    <text x={svgWidth - padRight} y={svgHeight - 10} fill="#64748b" fontSize="10" textAnchor="end">Now</text>
                    <text x={padLeft + 25} y={15} fill="#38bdf8" fontSize="10" fontWeight="700">DO (mg/L)</text>
                    <polyline
                      points={points}
                      fill="none"
                      stroke={isHardwareOnline ? '#10b981' : '#64748b'}
                      strokeWidth={isHardwareOnline ? '3' : '1.5'}
                      strokeDasharray={isHardwareOnline ? 'none' : '4 4'}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {isHardwareOnline && (
                      <circle cx={currentX} cy={currentY} r="6" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                    )}
                  </svg>
                  <div style={styles.chartWatermarkGrid} />
                </div>
              </div>
            </div>

            {/* RAW TELEMETRY DATABASE STREAM TABLE */}
            <div style={styles.panelBoxFullWidth}>
              <div style={styles.panelHeaderRow}>
                <div style={styles.flexHeader}>
                  <Database size={18} color="#0284c7" />
                  <h3 style={{ ...styles.panelBoxTitle, margin: 0 }}>Latest Raw Telemetry Database Stream</h3>
                  <span style={styles.recordBadge}>{rawTelemetryList.length} Records</span>
                </div>
                <button type="button" style={styles.refreshBtn} onClick={fetchCentralData}>
                  <RefreshCw size={14} color="#0284c7" />
                  <span>Refresh DB</span>
                </button>
              </div>
              <div style={styles.tableScrollContainer}>
                <table style={styles.telemetryTable}>
                  <thead>
                    <tr>
                      <th style={styles.tableTh}>Status / Rank</th>
                      <th style={styles.tableTh}>Device ID</th>
                      <th style={styles.tableTh}>pH Level</th>
                      <th style={styles.tableTh}>Temp (°C)</th>
                      <th style={styles.tableTh}>Turbidity (NTU)</th>
                      <th style={styles.tableTh}>Predicted DO</th>
                      <th style={styles.tableTh}>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rawTelemetryList.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={styles.emptyTd}>
                          No raw telemetry records fetched from database.
                        </td>
                      </tr>
                    ) : (
                      rawTelemetryList.map((rec, index) => {
                        const timeStr = rec.created_at || rec.timestamp || 'N/A';
                        const isLatest = index === 0;
                        const numDo = typeof rec.predicted_do === 'number'
                          ? rec.predicted_do
                          : parseFloat(String(rec.predicted_do || ''));
                        const predDoVal = !isNaN(numDo) ? `${numDo.toFixed(2)} mg/L` : 'N/A';
                        return (
                          <tr key={`${rec.device_id}-${index}`} style={{ ...styles.tableTr, backgroundColor: isLatest ? 'rgba(2, 132, 199, 0.05)' : 'transparent' }}>
                            <td style={styles.tableTdBold}>
                              {isLatest ? (
                                <span style={styles.latestBadge}>LATEST LOG</span>
                              ) : (
                                <span style={styles.indexBadge}>#{index + 1}</span>
                              )}
                            </td>
                            <td style={styles.tableTdBold}>{rec.device_id || 'N/A'}</td>
                            <td style={styles.tableTdPh}>{Number(rec.ph ?? 0).toFixed(2)}</td>
                            <td style={styles.tableTdTemp}>{Number(rec.temperature ?? 0).toFixed(1)}°C</td>
                            <td style={styles.tableTdTurb}>{Number(rec.turbidity ?? 0).toFixed(1)} NTU</td>
                            <td style={styles.tableTdDo}>{predDoVal}</td>
                            <td style={styles.tableTdTime}>{timeStr}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Renders DeviceManagement directly since it's located in web/src/ */}
        {isDeviceManagementTab && (
          <DeviceManagement />
        )}

        {isAccountManagementTab && (
          <AccountManagement
            onAddAccount={(_acc: AccountData) => {}}
            onEditAccount={(_id: string, _acc: AccountData) => {}}
            onDeleteAccount={(_id: string) => {}}
          />
        )}

        {/* NODE INSPECTION MODAL */}
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
                    <div style={{
                      ...styles.modalPredictedDoBrick,
                      backgroundColor: selectedFloater.status === 'Offline' ? '#fef2f2' : '#ecfdf5',
                      borderColor: selectedFloater.status === 'Offline' ? '#fca5a5' : '#a7f3d0'
                    }}>
                      <div style={styles.flexGroup8}>
                        <Sparkles size={18} color={selectedFloater.status === 'Offline' ? '#dc2626' : '#059669'} />
                        <div>
                          <p style={{ ...styles.predictedBrickLabel, color: selectedFloater.status === 'Offline' ? '#991b1b' : '#065f46' }}>Predicted Dissolved Oxygen</p>
                          <span style={{ ...styles.predictedBrickSub, color: selectedFloater.status === 'Offline' ? '#b91c1c' : '#047857' }}>
                            {selectedFloater.status === 'Offline' ? 'Hardware Unreachable' : 'FastAPI Model Inference'}
                          </span>
                        </div>
                      </div>
                      <span style={{ ...styles.predictedBrickValue, color: selectedFloater.status === 'Offline' ? '#dc2626' : '#065f46' }}>
                        {nodePredictLoading ? (
                          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                        ) : (
                          <>
                            {selectedFloater.status === 'Offline' ? '0.00' : (nodePrediction ?? '0.00')}
                            <span style={{ fontSize: '12px', fontWeight: '500', marginLeft: '3px' }}>mg/L</span>
                          </>
                        )}
                      </span>
                    </div>

                    <div style={styles.modalGridBrick}>
                      <div style={styles.flexGroup8}>
                        <Droplet size={18} color={selectedFloater.status === 'Offline' ? '#94a3b8' : '#16a34a'} />
                        <p style={styles.brickLabelText}>pH</p>
                      </div>
                      <span style={{ ...styles.brickValueText, color: selectedFloater.status === 'Offline' ? '#94a3b8' : '#16a34a' }}>
                        {selectedFloater.status === 'Offline' ? '0.00' : selectedFloater?.metrics?.ph}
                      </span>
                    </div>

                    <div style={styles.modalGridBrick}>
                      <div style={styles.flexGroup8}>
                        <Thermometer size={18} color={selectedFloater.status === 'Offline' ? '#94a3b8' : '#0284c7'} />
                        <p style={styles.brickLabelText}>Temperature</p>
                      </div>
                      <span style={{ ...styles.brickValueText, color: selectedFloater.status === 'Offline' ? '#94a3b8' : '#0284c7' }}>
                        {selectedFloater.status === 'Offline' ? '0.0' : selectedFloater?.metrics?.temperature}°C
                      </span>
                    </div>

                    <div style={styles.modalGridBrick}>
                      <div style={styles.flexGroup8}>
                        <Eye size={18} color={selectedFloater.status === 'Offline' ? '#94a3b8' : '#e11d48'} />
                        <p style={styles.brickLabelText}>Turbidity</p>
                      </div>
                      <span style={{ ...styles.brickValueText, color: selectedFloater.status === 'Offline' ? '#94a3b8' : '#e11d48' }}>
                        {selectedFloater.status === 'Offline' ? '0.0' : selectedFloater?.metrics?.turbidity} NTU
                      </span>
                    </div>
                  </div>
                </div>

                <div style={styles.modalChartPane}>
                  <div style={styles.modalChartWrapper}>
                    {(() => {
                      const svgW = 340;
                      const svgH = 180;
                      const padT = 30;
                      const padB = 30;
                      const padL = 20;
                      const padR = 20;
                      const isNodeOffline = selectedFloater.status === 'Offline';
                      const rawPoints = isNodeOffline ? [0, 0] : (modalHistory.length > 0 ? modalHistory : [6.5]);
                      let dataPoints = rawPoints;
                      if (dataPoints.length === 1) {
                        dataPoints = [dataPoints[0], dataPoints[0]];
                      }
                      const minData = Math.min(...dataPoints);
                      const maxData = Math.max(...dataPoints);
                      let calcY: (val: number) => number;
                      if (minData === maxData || isNodeOffline) {
                        calcY = () => svgH - padB;
                      } else {
                        calcY = (val: number) => svgH - padB - ((val - minData) * (svgH - padT - padB)) / (maxData - minData);
                      }

                      const polyPoints = dataPoints
                        .map((val, idx) => {
                          const x = padL + (idx * (svgW - padL - padR)) / Math.max(dataPoints.length - 1, 1);
                          const y = calcY(val);
                          return `${x},${y}`;
                        })
                        .join(' ');

                      const lastX = padL + ((dataPoints.length - 1) * (svgW - padL - padR)) / Math.max(dataPoints.length - 1, 1);
                      const lastY = calcY(dataPoints[dataPoints.length - 1]);

                      return (
                        <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: '100%', position: 'relative', zIndex: 2 }}>
                          <line x1="0" y1={padT} x2={svgW} y2={padT} stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
                          <line x1="0" y1={svgH / 2} x2={svgW} y2={svgH / 2} stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
                          <line x1="0" y1={svgH - padB} x2={svgW} y2={svgH - padB} stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
                          <polyline
                            points={polyPoints}
                            fill="none"
                            stroke={isNodeOffline ? '#ef4444' : '#10b981'}
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ transition: 'all 0.4s ease-in-out' }}
                          />
                          <circle
                            cx={lastX}
                            cy={lastY}
                            r="6"
                            fill={isNodeOffline ? '#ef4444' : '#10b981'}
                            stroke={isNodeOffline ? '#7f1d1d' : '#064e3b'}
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
                    <div style={styles.modalChartFooterLabel}>
                      {selectedFloater.status === 'Offline' ? 'Node Telemetry Stream Inactive' : 'ESP32 Live Telemetry Vector'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  appContainer: { display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: 'Inter, sans-serif' },
  workspaceBody: { flex: 1, marginLeft: '260px', padding: '32px', boxSizing: 'border-box' },
  centerStage: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a' },
  spinner: { width: '40px', height: '40px', border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid #38bdf8', borderRadius: '50%', animation: 'spin 1s linear infinite' },
  loadingText: { color: '#94a3b8', marginTop: '16px', fontSize: '14px', fontWeight: '500' },
  warningBanner: { display: 'flex', alignItems: 'center', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '12px 16px', borderRadius: '12px', marginBottom: '24px', fontSize: '14px', fontWeight: '600' },
  kpiContainerRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '28px' },
  kpiCard: { background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '20px', backdropFilter: 'blur(10px)' },
  cardHeaderGlow: { display: 'flex', alignItems: 'center', marginBottom: '12px' },
  kpiTitle: { margin: 0, fontSize: '12px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.05em' },
  kpiValue: { margin: 0, fontSize: '28px', fontWeight: '800', color: '#f8fafc' },
  unitText: { fontSize: '14px', fontWeight: '600', color: '#94a3b8' },
  pulseDot: { width: '8px', height: '8px', borderRadius: '50%', marginRight: '8px' },
  splitGridDashboard: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px', marginBottom: '28px' },
  panelBox: { background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px', backdropFilter: 'blur(10px)' },
  panelBoxFullWidth: { background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px', backdropFilter: 'blur(10px)', marginBottom: '28px' },
  panelHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  flexHeader: { display: 'flex', alignItems: 'center', gap: '10px' },
  panelBoxTitle: { fontSize: '16px', fontWeight: '700', color: '#f8fafc' },
  cryptoBadge: { fontSize: '11px', fontWeight: '600', padding: '4px 10px', borderRadius: '20px' },
  mapCanvas: { width: '100%', height: '320px', borderRadius: '12px', overflow: 'hidden' },
  chartMockCanvas: { width: '100%', height: '220px', position: 'relative' },
  svgGraphLine: { width: '100%', height: '100%', overflow: 'visible' },
  chartWatermarkGrid: { position: 'absolute', inset: 0, pointerEvents: 'none' },
  recordBadge: { background: 'rgba(2, 132, 199, 0.1)', color: '#38bdf8', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '600' },
  refreshBtn: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', cursor: 'pointer', fontSize: '12px', fontWeight: '600' },
  tableScrollContainer: { width: '100%', overflowX: 'auto' },
  telemetryTable: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', color: '#cbd5e1' },
  tableTh: { padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', fontWeight: '600' },
  tableTr: { borderBottom: '1px solid rgba(255,255,255,0.04)' },
  tableTdBold: { padding: '14px 16px', fontWeight: '700', color: '#f8fafc' },
  tableTdPh: { padding: '14px 16px', color: '#4ade80', fontWeight: '600' },
  tableTdTemp: { padding: '14px 16px', color: '#38bdf8', fontWeight: '600' },
  tableTdTurb: { padding: '14px 16px', color: '#f43f5e', fontWeight: '600' },
  tableTdDo: { padding: '14px 16px', color: '#34d399', fontWeight: '700' },
  tableTdTime: { padding: '14px 16px', color: '#94a3b8' },
  latestBadge: { background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: '700' },
  indexBadge: { color: '#64748b', fontSize: '11px', fontWeight: '600' },
  emptyTd: { textAlign: 'center', padding: '30px', color: '#64748b' },
  modalOverlayMask: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(5px)' },
  modalBodyWindow: { background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', width: '90%', maxWidth: '850px', padding: '28px', boxSizing: 'border-box' },
  modalSplitGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' },
  modalMetaSection: { display: 'flex', flexDirection: 'column', gap: '20px' },
  modalHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  modalMainTitle: { margin: 0, fontSize: '20px', fontWeight: '700', color: '#f8fafc' },
  modalMetaLine: { margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' },
  closeModalCrossBtn: { background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' },
  modalMetricStack: { display: 'flex', flexDirection: 'column', gap: '12px' },
  modalPredictedDoBrick: { background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '14px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  flexGroup8: { display: 'flex', alignItems: 'center', gap: '8px' },
  predictedBrickLabel: { margin: 0, fontSize: '13px', fontWeight: '700', color: '#065f46' },
  predictedBrickSub: { fontSize: '11px', fontWeight: '500', color: '#047857' },
  predictedBrickValue: { fontSize: '20px', fontWeight: '800', color: '#065f46' },
  modalGridBrick: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  brickLabelText: { margin: 0, fontSize: '13px', fontWeight: '600', color: '#cbd5e1' },
  brickValueText: { fontSize: '15px', fontWeight: '700' },
  modalChartPane: { display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  modalChartWrapper: { background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '16px', height: '240px', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' },
  chartWatermarkGridModal: { position: 'absolute', inset: 0, pointerEvents: 'none' },
  modalChartFooterLabel: { marginTop: '12px', fontSize: '12px', fontWeight: '600', color: '#94a3b8' }
};