import React, { useState, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import {
  Plus,
  Trash2,
  RotateCw,
  Search,
  Cpu,
  MapPin,
  Wifi,
  Droplet,
  Thermometer,
  Eye,
  X,
  CheckCircle2,
  AlertCircle,
  User,
  Pencil,
  RefreshCw
} from 'lucide-react';

export interface AccountOption {
  id: string | number;
  name: string;
  role: string;
  location?: string;
}

export interface FloaterNode {
  id: string;
  device_id: string;
  name: string;
  location: string;
  color: string;
  status: string;
  lastTelemetryAt?: string | null;
  assignedUserId?: string | number;
  assignedUserName?: string;
  metrics?: {
    ph: number;
    temperature: number;
    turbidity: number;
  };
}

interface TelemetryRecord {
  device_id?: string;
  id?: string;
  ph?: number;
  temperature?: number;
  turbidity?: number;
  created_at?: string;
  timestamp?: string;
}

interface DeviceManagementProps {
  devices?: FloaterNode[];
  accounts?: AccountOption[];
  onAddDevice?: (device: FloaterNode) => void;
  onEditDevice?: (device: FloaterNode) => void;
  onRemoveDevice?: (id: string) => void;
  onRebootDevice?: (id: string) => void;
}

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'https://aquasense-backend-osmi.onrender.com';
const API_BASE_URL = BASE_URL.replace(/\/$/, '');

const TELEMETRY_ONLINE_WINDOW_MS = 12 * 60 * 60 * 1000;

const getAuthHeaders = (): Record<string, string> => {
  const token =
    localStorage.getItem('token') ||
    localStorage.getItem('access_token') ||
    sessionStorage.getItem('token') ||
    sessionStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

const extractErrorMessage = async (response: Response): Promise<string> => {
  try {
    const data = await response.json();
    if (typeof data?.detail === 'string') return data.detail;
    if (Array.isArray(data?.detail)) {
      return data.detail.map((d: any) => d?.msg || JSON.stringify(d)).join(', ');
    }
    if (typeof data?.message === 'string') return data.message;
  } catch {
    // Ignore JSON parse error
  }
  return `Request failed with status ${response.status}`;
};

const normalizeDevicesList = (rawData: any): FloaterNode[] => {
  const list = Array.isArray(rawData)
    ? rawData
    : Array.isArray(rawData?.devices)
    ? rawData.devices
    : Array.isArray(rawData?.data)
    ? rawData.data
    : [];

  return list.map((item: any, idx: number) => {
    const devId = String(item.device_id || item.id || `NODE_${idx + 1}`).trim();
    const docId = String(item.id || item.device_id || idx + 1).trim();
    return {
      id: docId,
      device_id: devId,
      name: String(item.name || `Node ${devId}`),
      location: String(item.location || 'Unassigned Field Station'),
      color: item.color || '#ef4444',
      status: 'Offline',
      lastTelemetryAt: null,
      assignedUserId:
        item.assignedUserId ??
        item.assigned_user_id ??
        item.assigned_user ??
        undefined,
      assignedUserName:
        item.assignedUserName ??
        item.assigned_user_name ??
        undefined,
      metrics: undefined
    };
  });
};

const normalizeTelemetryList = (rawData: any): TelemetryRecord[] => {
  if (Array.isArray(rawData)) return rawData;
  if (Array.isArray(rawData?.telemetry)) return rawData.telemetry;
  if (Array.isArray(rawData?.records)) return rawData.records;
  if (Array.isArray(rawData?.data)) return rawData.data;
  if (rawData && typeof rawData === 'object') return [rawData];
  return [];
};

const applyTelemetryStatus = (
  baseDevices: FloaterNode[],
  telemetryRecords: TelemetryRecord[]
): FloaterNode[] => {
  const latestByDevice = new Map<
    string,
    { record: TelemetryRecord; timeMs: number; timeStr: string | null }
  >();

  for (const rec of telemetryRecords) {
    const rawId = String(rec.device_id || rec.id || '').trim();
    if (!rawId) continue;
    const key = rawId.toLowerCase();
    const timeStr = rec.created_at || rec.timestamp || null;
    const parsedTime = timeStr ? new Date(timeStr).getTime() : NaN;
    const effectiveTimeMs = !Number.isNaN(parsedTime) ? parsedTime : Date.now();

    const existing = latestByDevice.get(key);
    if (!existing || effectiveTimeMs >= existing.timeMs) {
      latestByDevice.set(key, {
        record: rec,
        timeMs: effectiveTimeMs,
        timeStr
      });
    }
  }

  const nowMs = Date.now();

  return baseDevices.map((dev) => {
    const match =
      latestByDevice.get(String(dev.device_id).trim().toLowerCase()) ||
      latestByDevice.get(String(dev.id).trim().toLowerCase());

    const hasSentTelemetry = Boolean(match);
    const isFresh =
      hasSentTelemetry && Math.abs(nowMs - match!.timeMs) <= TELEMETRY_ONLINE_WINDOW_MS;

    if (hasSentTelemetry && isFresh && match) {
      const rec = match.record;
      return {
        ...dev,
        status: 'Online',
        color: '#22c55e',
        lastTelemetryAt: match.timeStr,
        metrics: {
          ph: Number(rec.ph ?? 0),
          temperature: Number(rec.temperature ?? 0),
          turbidity: Number(rec.turbidity ?? 0)
        }
      };
    }

    return {
      ...dev,
      status: 'Offline',
      color: '#ef4444',
      lastTelemetryAt: match?.timeStr ?? null,
      metrics: undefined
    };
  });
};

export default function DeviceManagement({
  devices: _propDevices,
  accounts: propAccounts,
  onAddDevice,
  onEditDevice,
  onRemoveDevice,
  onRebootDevice
}: DeviceManagementProps) {
  const [devices, setDevices] = useState<FloaterNode[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>(propAccounts || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingDevices, setIsLoadingDevices] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<FloaterNode | null>(null);
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (propAccounts && propAccounts.length > 0) {
      setAccounts(propAccounts);
    }
  }, [propAccounts]);

  useEffect(() => {
    if (!propAccounts || propAccounts.length === 0) {
      fetch(`${API_BASE_URL}/api/accounts`, { headers: getAuthHeaders() })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          const list = Array.isArray(data)
            ? data
            : Array.isArray(data?.accounts)
            ? data.accounts
            : Array.isArray(data?.data)
            ? data.data
            : [];
          if (list.length > 0) setAccounts(list);
        })
        .catch((err) => console.error('Failed to fetch accounts:', err));
    }
  }, [propAccounts]);

  const loadDevicesAndTelemetry = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsLoadingDevices(true);
    try {
      const headers = getAuthHeaders();
      const [devicesRes, telemetryRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/devices`, { headers }),
        fetch(`${API_BASE_URL}/telemetry?limit=100`, { headers }).catch(() =>
          fetch(`${API_BASE_URL}/api/telemetry?limit=100`, { headers })
        )
      ]);

      if (!devicesRes.ok) {
        const errMsg = await extractErrorMessage(devicesRes);
        throw new Error(errMsg);
      }

      const rawDevices = await devicesRes.json();
      const baseDevices = normalizeDevicesList(rawDevices);

      let telemetryList: TelemetryRecord[] = [];
      if (telemetryRes && telemetryRes.ok) {
        const rawTelemetry = await telemetryRes.json();
        telemetryList = normalizeTelemetryList(rawTelemetry);
      }

      const computedDevices = applyTelemetryStatus(baseDevices, telemetryList);
      setDevices(computedDevices);
      setFetchError(null);
    } catch (err: any) {
      console.error('Failed to fetch devices/telemetry:', err);
      setFetchError(err?.message || 'Unable to load devices or telemetry stream from database.');
    } finally {
      setIsLoadingDevices(false);
    }
  }, []);

  useEffect(() => {
    loadDevicesAndTelemetry(true);
    const interval = setInterval(() => loadDevicesAndTelemetry(false), 5000);
    return () => clearInterval(interval);
  }, [loadDevicesAndTelemetry]);

  const farmerAccounts = accounts.filter(
    (acc) => acc.role && acc.role.toLowerCase() === 'farmer'
  );

  const filteredDevices = devices.filter((dev) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      dev.name.toLowerCase().includes(q) ||
      dev.device_id.toLowerCase().includes(q) ||
      dev.location.toLowerCase().includes(q) ||
      dev.status.toLowerCase().includes(q) ||
      (dev.assignedUserName && dev.assignedUserName.toLowerCase().includes(q)) ||
      (dev.assignedUserId && String(dev.assignedUserId).toLowerCase().includes(q))
    );
  });

  const handleOpenAddModal = () => {
    setEditingDevice(null);
    setNewDeviceId('');
    setNewDeviceName('');
    setNewLocation('');
    setSelectedUserId('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (device: FloaterNode) => {
    setEditingDevice(device);
    setNewDeviceId(device.device_id);
    setNewDeviceName(device.name);
    setNewLocation(device.location);
    let currentUserId = device.assignedUserId;
    if (!currentUserId && device.assignedUserName) {
      const match = farmerAccounts.find((f) => f.name === device.assignedUserName);
      if (match) currentUserId = match.id;
    }
    setSelectedUserId(
      currentUserId !== undefined && currentUserId !== null ? String(currentUserId) : ''
    );
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setEditingDevice(null);
    setFormError(null);
  };

  const handleFarmerSelect = (userId: string) => {
    setSelectedUserId(userId);
    const selectedFarmer = farmerAccounts.find((acc) => String(acc.id) === String(userId));
    if (selectedFarmer && selectedFarmer.location) {
      setNewLocation(selectedFarmer.location);
    }
  };

  const handleDeleteDevice = async (device: FloaterNode) => {
    if (deletingId) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete "${device.name}" (${device.device_id})?`
    );
    if (!confirmed) return;

    const targetId = encodeURIComponent(device.id || device.device_id);
    setDeletingId(device.id);
    setFetchError(null);
    setStatusMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/devices/${targetId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        const errMsg = await extractErrorMessage(response);
        throw new Error(errMsg);
      }

      setDevices((prev) => prev.filter((d) => d.id !== device.id && d.device_id !== device.device_id));
      setStatusMessage(`Deleted node "${device.device_id}" from database.`);
      if (onRemoveDevice) onRemoveDevice(device.id);
      await loadDevicesAndTelemetry(false);
    } catch (err: any) {
      console.error('Error deleting device:', err);
      setFetchError(`Delete failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    setStatusMessage(null);

    const deviceId = newDeviceId.trim();
    const deviceName = newDeviceName.trim();
    const location = newLocation.trim() || 'Unassigned Field Station';

    if (!deviceId) {
      setFormError('Device ID / MAC Address is required.');
      return;
    }
    if (!deviceName) {
      setFormError('Node Display Name is required.');
      return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);

    const assignedUser = farmerAccounts.find(
      (acc) => String(acc.id) === String(selectedUserId)
    );

    const payload = {
      id: deviceId,
      device_id: deviceId,
      name: deviceName,
      location,
      assignedUserId: assignedUser ? String(assignedUser.id) : null,
      assignedUserName: assignedUser ? assignedUser.name : null,
      assigned_user_id: assignedUser ? String(assignedUser.id) : null,
      status: 'Offline',
      color: '#ef4444'
    };

    try {
      if (editingDevice) {
        const editTarget = encodeURIComponent(editingDevice.id || editingDevice.device_id);
        const response = await fetch(`${API_BASE_URL}/api/devices/${editTarget}`, {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errMsg = await extractErrorMessage(response);
          throw new Error(errMsg);
        }

        const updatedJson = await response.json();
        const normalizedUpdated = normalizeDevicesList([updatedJson])[0];
        if (normalizedUpdated && onEditDevice) {
          onEditDevice(normalizedUpdated);
        }
        setStatusMessage(`Updated node "${deviceId}" in database.`);
      } else {
        const response = await fetch(`${API_BASE_URL}/api/devices`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errMsg = await extractErrorMessage(response);
          throw new Error(errMsg);
        }

        const createdJson = await response.json();
        const normalizedCreated = normalizeDevicesList([createdJson])[0];
        if (normalizedCreated && onAddDevice) {
          onAddDevice(normalizedCreated);
        }
        setStatusMessage(`Registered node "${deviceId}" in database.`);
      }

      await loadDevicesAndTelemetry(false);
      setIsModalOpen(false);
      setEditingDevice(null);
      setNewDeviceId('');
      setNewDeviceName('');
      setNewLocation('');
      setSelectedUserId('');
    } catch (err: any) {
      console.error('Failed to save device:', err);
      setFormError(err?.message || 'Failed to save node to database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <div style={styles.searchWrapper}>
          <Search size={18} color="#64748b" style={{ marginLeft: '12px', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search nodes by ID, name, location, status, or assigned user..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => loadDevicesAndTelemetry(true)}
            style={styles.refreshButton}
            title="Sync devices and telemetry with database"
          >
            <RefreshCw size={16} color="#334155" />
            <span>Refresh ({devices.length})</span>
          </button>

          <button type="button" onClick={handleOpenAddModal} style={styles.addButton}>
            <Plus size={18} color="#ffffff" />
            <span>Register New Node</span>
          </button>
        </div>
      </div>

      {fetchError && (
        <div style={styles.errorBanner}>
          <AlertCircle size={16} color="#b91c1c" />
          <span>{fetchError}</span>
        </div>
      )}

      {statusMessage && !fetchError && (
        <div style={styles.successBanner}>
          <CheckCircle2 size={16} color="#15803d" />
          <span>{statusMessage}</span>
        </div>
      )}

      {isLoadingDevices && devices.length === 0 ? (
        <div style={styles.emptyContainer}>
          <Cpu size={40} color="#0284c7" />
          <h3 style={styles.emptyTitle}>Loading Nodes from Database...</h3>
          <p style={styles.emptySub}>Checking registered devices and cloud telemetry stream.</p>
        </div>
      ) : filteredDevices.length === 0 ? (
        <div style={styles.emptyContainer}>
          <Cpu size={40} color="#94a3b8" />
          <h3 style={styles.emptyTitle}>NO ESP32 Nodes Found</h3>
          <p style={styles.emptySub}>Register a new hardware node or verify search parameters.</p>
        </div>
      ) : (
        <div style={styles.gridContainer}>
          {filteredDevices.map((device) => {
            const isOnline = device.status === 'Online';
            const assignedLabel =
              device.assignedUserName ||
              (device.assignedUserId ? String(device.assignedUserId) : 'Unassigned');

            return (
              <div key={device.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        ...styles.statusIndicator,
                        backgroundColor: isOnline ? '#22c55e' : '#ef4444'
                      }}
                    />
                    <div>
                      <h3 style={styles.deviceName}>{device.name}</h3>
                      <p style={styles.deviceId}>ID: {device.device_id}</p>
                    </div>
                  </div>
                  <span
                    style={{
                      ...styles.statusBadge,
                      backgroundColor: isOnline ? '#dcfce7' : '#fee2e2',
                      color: isOnline ? '#15803d' : '#b91c1c'
                    }}
                  >
                    {isOnline ? (
                      <CheckCircle2 size={12} style={{ marginRight: '4px' }} />
                    ) : (
                      <AlertCircle size={12} style={{ marginRight: '4px' }} />
                    )}
                    {device.status}
                  </span>
                </div>

                <div style={styles.infoSection}>
                  <div style={styles.locationRow}>
                    <MapPin size={14} color="#64748b" />
                    <span style={styles.locationText}>{device.location}</span>
                  </div>
                  <div style={styles.userRow}>
                    <User size={14} color="#0284c7" />
                    <span style={styles.userText}>User: {assignedLabel}</span>
                  </div>
                </div>

                {isOnline && device.metrics ? (
                  <div style={styles.metricsGrid}>
                    <div style={styles.metricBlock}>
                      <div style={styles.metricHeader}>
                        <Droplet size={14} color="#16a34a" />
                        <span>pH</span>
                      </div>
                      <strong style={{ ...styles.metricVal, color: '#16a34a' }}>
                        {Number(device.metrics.ph).toFixed(1)}
                      </strong>
                    </div>

                    <div style={styles.metricBlock}>
                      <div style={styles.metricHeader}>
                        <Thermometer size={14} color="#0284c7" />
                        <span>Temp</span>
                      </div>
                      <strong style={{ ...styles.metricVal, color: '#0284c7' }}>
                        {Number(device.metrics.temperature).toFixed(1)}°C
                      </strong>
                    </div>

                    <div style={styles.metricBlock}>
                      <div style={styles.metricHeader}>
                        <Eye size={14} color="#e11d48" />
                        <span>Turbidity</span>
                      </div>
                      <strong style={{ ...styles.metricVal, color: '#e11d48' }}>
                        {Number(device.metrics.turbidity).toFixed(1)}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <div style={styles.offlineMetricsBox}>
                    <AlertCircle size={16} color="#ef4444" />
                    <span>No recent telemetry sent to cloud (Offline)</span>
                  </div>
                )}

                <div style={styles.cardFooter}>
                  <div style={styles.wifiTag}>
                    <Wifi size={13} color={isOnline ? '#16a34a' : '#94a3b8'} />
                    <span>{isOnline ? 'Sending Data' : 'No Data Sent'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      title="Edit Node"
                      onClick={() => handleOpenEditModal(device)}
                      style={styles.actionBtnIconEdit}
                    >
                      <Pencil size={15} color="#d97706" />
                    </button>
                    <button
                      type="button"
                      title="Reboot Node"
                      onClick={() => onRebootDevice && onRebootDevice(device.id)}
                      style={styles.actionBtnIcon}
                    >
                      <RotateCw size={15} color="#0284c7" />
                    </button>
                    <button
                      type="button"
                      title="Remove Node"
                      disabled={deletingId === device.id}
                      onClick={() => handleDeleteDevice(device)}
                      style={styles.actionBtnIconDanger}
                    >
                      <Trash2 size={15} color="#dc2626" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <div style={styles.modalOverlay} onClick={handleCloseModal}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                {editingDevice ? 'Edit ESP32 Node' : 'Register ESP32 Node'}
              </h3>
              <button type="button" onClick={handleCloseModal} style={styles.closeBtn}>
                <X size={18} color="#64748b" />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={styles.form}>
              {formError && (
                <div style={styles.errorBanner}>
                  <AlertCircle size={16} color="#b91c1c" />
                  <span>{formError}</span>
                </div>
              )}

              <div style={styles.inputGroup}>
                <label style={styles.label}>Device ID / MAC Address</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ESP32_POND_03"
                  value={newDeviceId}
                  onChange={(e) => setNewDeviceId(e.target.value)}
                  disabled={Boolean(editingDevice)}
                  style={styles.input}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Node Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Node ESP_POND_03"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  style={styles.input}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Assign Farmer Account</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => handleFarmerSelect(e.target.value)}
                  style={styles.input}
                >
                  <option value="">-- Select Farmer Account --</option>
                  {farmerAccounts.map((farmer) => (
                    <option key={farmer.id} value={String(farmer.id)}>
                      {farmer.name} ({farmer.location || 'No Location'})
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Deployment Location / Station</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Zone 3, BonBon Pond"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  style={styles.input}
                />
              </div>

              <div style={styles.modalFooter}>
                <button type="button" onClick={handleCloseModal} style={styles.cancelBtn}>
                  Cancel
                </button>
                <button type="submit" style={styles.submitBtn} disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : editingDevice ? 'Save Changes' : 'Register Node'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: 0, width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' },
  searchWrapper: { display: 'flex', alignItems: 'center', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', flex: '1 1 260px', height: '42px', boxSizing: 'border-box' },
  searchInput: { border: 'none', outline: 'none', padding: '0 12px', width: '100%', fontSize: '14px', background: 'transparent' },
  refreshButton: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#ffffff', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 14px', height: '42px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', flexShrink: 0 },
  addButton: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0 16px', height: '42px', fontWeight: 600, cursor: 'pointer', flexShrink: 0 },
  errorBanner: { display: 'flex', alignItems: 'center', gap: '8px', background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', fontWeight: 500 },
  successBanner: { display: 'flex', alignItems: 'center', gap: '8px', background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', fontWeight: 500 },
  emptyContainer: { textAlign: 'center', padding: '60px 20px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px' },
  emptyTitle: { marginTop: '12px', fontSize: '18px', fontWeight: 600, color: '#1e293b' },
  emptySub: { marginTop: '4px', fontSize: '14px', color: '#64748b' },
  gridContainer: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' },
  card: { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '8px' },
  statusIndicator: { width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0 },
  deviceName: { fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 },
  deviceId: { fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' },
  statusBadge: { display: 'flex', alignItems: 'center', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, flexShrink: 0 },
  infoSection: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px', background: '#f8fafc', padding: '10px', borderRadius: '8px' },
  locationRow: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569' },
  locationText: { fontWeight: 500 },
  userRow: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#0284c7' },
  userText: { fontWeight: 600 },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' },
  metricBlock: { background: '#f1f5f9', padding: '8px', borderRadius: '8px', textAlign: 'center' },
  metricHeader: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '12px', color: '#475569', marginBottom: '4px' },
  metricVal: { fontSize: '14px', fontWeight: 700 },
  offlineMetricsBox: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#fef2f2', padding: '12px', borderRadius: '8px', marginBottom: '16px', color: '#b91c1c', fontSize: '13px', fontWeight: 500 },
  cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #f1f5f9' },
  wifiTag: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#15803d', background: '#f0fdf4', padding: '2px 8px', borderRadius: '6px' },
  actionBtnIcon: { background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  actionBtnIconEdit: { background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  actionBtnIconDanger: { background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' },
  modalContent: { background: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderBottom: '1px solid #e2e8f0' },
  modalTitle: { margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' },
  closeBtn: { background: 'transparent', border: 'none', cursor: 'pointer' },
  form: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', fontWeight: 600, color: '#334155' },
  input: { height: '40px', padding: '0 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' },
  cancelBtn: { background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 16px', height: '38px', fontWeight: 600, color: '#475569', cursor: 'pointer' },
  submitBtn: { background: '#0284c7', border: 'none', borderRadius: '8px', padding: '0 16px', height: '38px', fontWeight: 600, color: '#ffffff', cursor: 'pointer' }
};