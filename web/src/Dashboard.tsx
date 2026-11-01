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

const FASTAPI_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'https://aquasense-backend-osmi.onrender.com';

const STALE_TIMEOUT_MS = 12 * 60 * 60 * 1000;

// Coordinates for target field node location in CDO
const DEFAULT_LAT = 8.496141137486907;
const DEFAULT_LNG = 124.63905096785479;

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

  // Ref to hold current map instance and marker
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const normTab = activeTab.trim().toLowerCase().replace(/[_\s]+/g, '-');
  const isDeviceManagementTab = ['devices', 'device-management', 'devicemanagement'].includes(normTab);
  const isAccountManagementTab = ['accounts', 'account-management', 'accountmanagement', 'users', 'user-management', 'usermanagement'].includes(normTab);

  const fetchNodePrediction = useCallback(async (node: FloaterNode) => {
    // If node is offline or zeroed out, force 0.00 metrics immediately
    if (node.status === 'Offline' || node.metrics.ph === 0) {
      setNodePrediction('0.00');
      setModalHistory([0, 0, 0, 0]);
      setNodePredictLoading(false);
      return;
    }

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
      const [predRes, telemRes] = await Promise.all([
        axios.get<PredictionData>(`${FASTAPI_URL}/predict`),
        axios.get<TelemetryRecord[] | TelemetryRecord>(`${FASTAPI_URL}/telemetry?limit=100`)
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
          const id = record.device_id || 'UNKNOWN_NODE';
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
              location: 'King Fisher Wee Viralmultimedia Services, Kauswagan CDO',
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

        setSelectedFloater((currentSelected) => {
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
    } catch (err) {
      console.error('Backend streaming error:', err);
      setError('AquaSense gateway unreachable. Retrying stream...');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectFloater = useCallback((node: FloaterNode) => {
    setSelectedFloater(node);
    setModalHistory([]);
    fetchNodePrediction(node);
  }, [fetchNodePrediction]);

  // Handle clicking the Pin directly from the Map
  const handleMapPinClick = () => {
    if (floaters.length > 0) {
      handleSelectFloater(floaters[0]);
    } else {
      // Offline Zero-State Floater Object
      const offlineNode: FloaterNode = {
        id: 'ESP32_POND_01',
        device_id: 'ESP32_POND_01',
        name: 'Node ESP32_POND_01 (Offline)',
        location: 'King Fisher Wee Viralmultimedia Services, Kauswagan CDO',
        color: '#ef4444',
        status: 'Offline',
        metrics: { ph: 0, temperature: 0, turbidity: 0 }
      };
      handleSelectFloater(offlineNode);
    }
  };

  // Immediate and Reliable Map Setup Effect
  useEffect(() => {
    if (activeTab !== 'dashboard') return;

    let isMounted = true;
    let resizeObserver: ResizeObserver | null = null;

    const initMap = () => {
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

      // Double-trigger layout calculations to ensure first-load render works cleanly
      requestAnimationFrame(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      });

      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 250);

      // ResizeObserver forces Leaflet to refresh tile bounds when CSS containers settle
      if (mapContainerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        });
        resizeObserver.observe(mapContainerRef.current);
      }
    };

    const loadLeafletScript = () => {
      if (window.L) {
        initMap();
        return;
      }

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
        script.onload = () => {
          if (isMounted) initMap();
        };
        document.body.appendChild(script);
      } else {
        const checkL = setInterval(() => {
          if (window.L) {
            clearInterval(checkL);
            if (isMounted) initMap();
          }
        }, 50);
      }
    };

    loadLeafletScript();

    return () => {
      isMounted = false;
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [activeTab]);

  // Marker Updater Effect
  useEffect(() => {
    if (activeTab !== 'dashboard' || !mapInstanceRef.current || !window.L) return;

    const Leaflet = window.L;
    const isOnline = floaters.length > 0;
    const pinColor = isOnline ? '#22c55e' : '#ef4444';

    const pinIconHtml = `
      <div style="cursor: pointer; transform: translate(-50%, -100%); transition: transform 0.2s ease;">
        <svg width="38" height="38" viewBox="0 0 24 24" fill="${pinColor}" stroke="#ffffff" stroke-width="1.5" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <circle cx="12" cy="9" r="2.5" fill="#ffffff"/>
        </svg>
      </div>
    `;

    const customIcon = Leaflet.divIcon({
      className: 'aquasense-interactive-pin',
      html: pinIconHtml,
      iconSize: [38, 38],
      iconAnchor: [19, 38]
    });

    if (markerRef.current) {
      mapInstanceRef.current.removeLayer(markerRef.current);
    }

    markerRef.current = Leaflet.marker([DEFAULT_LAT, DEFAULT_LNG], { icon: customIcon })
      .addTo(mapInstanceRef.current);

    markerRef.current.on('click', () => {
      handleMapPinClick();
    });
  }, [activeTab, floaters]);

  useEffect(() => {
    if (selectedFloater) {
      fetchNodePrediction(selectedFloater);
    }
  }, [selectedFloater?.metrics.ph, selectedFloater?.metrics.temperature, selectedFloater?.metrics.turbidity, fetchNodePrediction]);

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
  };

  const handleRemoveDevice = (id: string) => {
    setFloaters((prev) => prev.filter((f) => f.id !== id));
  };

  const handleRebootDevice = (id: string) => {
    console.log(`Reboot signal dispatched to node ${id}`);
  };

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
  
  const avgDo = isHardwareOnline && !isNaN(rawAvgDo)
    ? rawAvgDo.toFixed(2)
    : '0.00';

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

  const livePoints = isHardwareOnline ? trendHistory : [0, 0, 0, 0, 0];
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
                  <Radio size={14} color={isHardwareOnline ? "#16a34a" : "#94a3b8"} style={{ marginRight: '6px' }} />
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
                  <Activity size={14} color={isHardwareOnline ? "#e11d48" : "#94a3b8"} style={{ marginRight: '6px' }} />
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
                          <text x={padLeft - 8} y={y + 4} fill="#94a3b8" fontSize="10" textAnchor="end" fontWeight="600">
                            {val}
                          </text>
                        </g>
                      );
                    })}

                    <line x1={padLeft} y1={svgHeight - padBottom} x2={svgWidth - padRight} y2={svgHeight - padBottom} stroke="#475569" strokeWidth="1.5" />
                    <text x={padLeft} y={svgHeight - 10} fill="#64748b" fontSize="10" textAnchor="start">History</text>
                    <text x={svgWidth - padRight} y={svgHeight - 10} fill="#64748b" fontSize="10" textAnchor="end">Now</text>
                    <text x={padLeft - 25} y={15} fill="#38bdf8" fontSize="10" fontWeight="700">DO (mg/L)</text>

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

                        const predDoVal = !isNaN(numDo)
                          ? `${numDo.toFixed(2)} mg/L`
                          : 'N/A';

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
                          <p style={{
                            ...styles.predictedBrickLabel,
                            color: selectedFloater.status === 'Offline' ? '#991b1b' : '#065f46'
                          }}>Predicted Dissolved Oxygen</p>
                          <span style={{
                            ...styles.predictedBrickSub,
                            color: selectedFloater.status === 'Offline' ? '#b91c1c' : '#047857'
                          }}>
                            {selectedFloater.status === 'Offline' ? 'Hardware Unreachable' : 'FastAPI Model Inference'}
                          </span>
                        </div>
                      </div>
                      <span style={{
                        ...styles.predictedBrickValue,
                        color: selectedFloater.status === 'Offline' ? '#dc2626' : '#065f46'
                      }}>
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
                        {selectedFloater.status === 'Offline' ? '0.00' : selectedFloater.metrics.ph}
                      </span>
                    </div>

                    <div style={styles.modalGridBrick}>
                      <div style={styles.flexGroup8}>
                        <Thermometer size={18} color={selectedFloater.status === 'Offline' ? '#94a3b8' : '#0284c7'} />
                        <p style={styles.brickLabelText}>Temperature</p>
                      </div>
                      <span style={{ ...styles.brickValueText, color: selectedFloater.status === 'Offline' ? '#94a3b8' : '#0284c7' }}>
                        {selectedFloater.status === 'Offline' ? '0.0' : selectedFloater.metrics.temperature}°C
                      </span>
                    </div>

                    <div style={styles.modalGridBrick}>
                      <div style={styles.flexGroup8}>
                        <Eye size={18} color={selectedFloater.status === 'Offline' ? '#94a3b8' : '#e11d48'} />
                        <p style={styles.brickLabelText}>Turbidity</p>
                      </div>
                      <span style={{ ...styles.brickValueText, color: selectedFloater.status === 'Offline' ? '#94a3b8' : '#e11d48' }}>
                        {selectedFloater.status === 'Offline' ? '0.0' : selectedFloater.metrics.turbidity} NTU
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
                        calcY = (val: number) => {
                          return svgH - padB - ((val - minData) * (svgH - padT - padB)) / (maxData - minData);
                        };
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
                  </div>
                  <div style={styles.modalChartFooterLabel}>
                    {selectedFloater.status === 'Offline' ? 'Node Telemetry Stream Inactive' : 'ESP32 Live Telemetry Vector'}
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
  appContainer: { display: 'flex', minHeight: '100vh', width: '100vw', backgroundColor: '#f8fafc', overflowX: 'hidden', boxSizing: 'border-box' },
  workspaceBody: { flex: 1, marginLeft: '260px', width: 'calc(100vw - 260px)', minHeight: '100vh', overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', color: '#1e293b', fontFamily: 'sans-serif', boxSizing: 'border-box' },
  centerStage: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', backgroundColor: '#f8fafc', fontFamily: 'sans-serif' },
  spinner: { width: '40px', height: '40px', border: '4px solid #e2e8f0', borderTop: '4px solid #0284c7', borderRadius: '50%', animation: 'spin 1s linear infinite' },
  loadingText: { marginTop: '16px', fontSize: '14px', color: '#64748b', fontWeight: '600' },
  warningBanner: { display: 'flex', alignItems: 'center', backgroundColor: '#fee2e2', border: '1px solid #ef4444', color: '#b91c1c', padding: '12px 18px', borderRadius: '10px' },
  kpiContainerRow: { display: 'flex', gap: '16px', width: '100%', boxSizing: 'border-box' },
  kpiCard: { flex: 1, minWidth: '0', backgroundColor: '#ffffff', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', boxSizing: 'border-box' },
  cardHeaderGlow: { display: 'flex', alignItems: 'center', marginBottom: '12px' },
  kpiTitle: { margin: 0, fontSize: '12px', color: '#64748b', fontWeight: '600' },
  kpiValue: { margin: 0, fontSize: '30px', fontWeight: '800' },
  unitText: { fontSize: '14px', color: '#64748b' },
  pulseDot: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e', marginRight: '8px' },
  splitGridDashboard: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', width: '100%', boxSizing: 'border-box' },
  panelBox: { backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', minWidth: '0', boxSizing: 'border-box' },
  panelBoxFullWidth: { backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', width: '100%', boxSizing: 'border-box' },
  panelHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  panelBoxTitle: { margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' },
  recordBadge: { backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', marginLeft: '8px' },
  latestBadge: { backgroundColor: '#0284c7', color: '#ffffff', fontSize: '10px', fontWeight: '800', padding: '3px 8px', borderRadius: '10px', letterSpacing: '0.05em' },
  indexBadge: { color: '#64748b', fontSize: '12px', fontWeight: '600' },
  refreshBtn: { display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: '#334155' },
  cryptoBadge: { display: 'flex', alignItems: 'center', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  mapCanvas: { height: '260px', backgroundColor: '#f8fafc', borderRadius: '12px', position: 'relative', overflow: 'hidden', border: '1px solid #e2e8f0' },
  chartMockCanvas: { height: '260px', backgroundColor: '#0b1120', borderRadius: '12px', position: 'relative', overflow: 'hidden' },
  svgGraphLine: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 2 },
  chartWatermarkGrid: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: `linear-gradient(rgba(30,41,59,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(30,41,59,0.5) 1px, transparent 1px)`, backgroundSize: '16px 16px', zIndex: 1 },
  chartWatermarkGridModal: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: `linear-gradient(rgba(30,41,59,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(30,41,59,0.7) 1px, transparent 1px)`, backgroundSize: '14px 14px', zIndex: 1 },
  flexHeader: { display: 'flex', alignItems: 'center', gap: '8px' },
  flexGroup8: { display: 'flex', alignItems: 'center', gap: '8px' },
  tableScrollContainer: { maxHeight: '280px', overflowY: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' },
  telemetryTable: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' },
  tableTh: { padding: '10px 14px', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: '700', borderBottom: '1px solid #cbd5e1', position: 'sticky', top: 0, zIndex: 5 },
  tableTr: { borderBottom: '1px solid #f1f5f9' },
  tableTdBold: { padding: '10px 14px', fontWeight: '700', color: '#0f172a' },
  tableTdPh: { padding: '10px 14px', color: '#16a34a', fontWeight: '600' },
  tableTdTemp: { padding: '10px 14px', color: '#0284c7', fontWeight: '600' },
  tableTdTurb: { padding: '10px 14px', color: '#e11d48', fontWeight: '600' },
  tableTdDo: { padding: '10px 14px', color: '#059669', fontWeight: '700' },
  tableTdTime: { padding: '10px 14px', color: '#64748b', fontSize: '12px' },
  emptyTd: { padding: '20px', textAlign: 'center', color: '#94a3b8' },
  modalOverlayMask: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
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
  modalGridBrick: { backgroundColor: '#f8fafc', padding: '14px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  brickLabelText: { margin: 0, fontSize: '13px', color: '#475569', fontWeight: '600' },
  brickValueText: { fontSize: '16px', fontWeight: '700' },
  modalChartPane: { backgroundColor: '#0b1120', padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
  modalChartWrapper: { height: '220px', width: '100%', position: 'relative', overflow: 'hidden', borderRadius: '12px' },
  modalChartFooterLabel: { color: '#64748b', fontSize: '11px', textAlign: 'center', marginTop: '16px', letterSpacing: '0.05em' }
};