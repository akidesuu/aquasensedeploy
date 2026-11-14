import React, { useState, useEffect } from 'react';
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
  Pencil
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
  assignedUserId?: string | number;
  assignedUserName?: string;
  metrics?: {
    ph: number;
    temperature: number;
    turbidity: number;
  };
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

const getAuthHeaders = () => {
  const token = localStorage.getItem('token') || localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export default function DeviceManagement({
  devices: propDevices,
  accounts: propAccounts,
  onRemoveDevice,
  onRebootDevice
}: DeviceManagementProps) {
  const [devices, setDevices] = useState<FloaterNode[]>(propDevices || []);
  const [accounts, setAccounts] = useState<AccountOption[]>(propAccounts || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (propDevices) setDevices(propDevices);
  }, [propDevices]);

  useEffect(() => {
    if (propAccounts) setAccounts(propAccounts);
  }, [propAccounts]);

  // Fetch accounts
  useEffect(() => {
    if (!propAccounts || propAccounts.length === 0) {
      fetch(`${API_BASE_URL}/api/accounts`, { headers: getAuthHeaders() })
        .then((res) => {
          if (!res.ok) throw new Error(`Accounts fetch failed: ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (Array.isArray(data)) setAccounts(data);
        })
        .catch((err) => console.error('Failed to fetch accounts:', err));
    }
  }, [propAccounts]);

  // Fetch all devices from backend and check live telemetry data stream
  const loadDevicesFromBackend = async () => {
    try {
      setFetchError(null);
      const response = await fetch(`${API_BASE_URL}/api/devices`, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`Server returned status ${response.status} - Check if logged in as Super Admin.`);
      }
      
      const data = await response.json();
      
      if (Array.isArray(data)) {
        const mappedDevices: FloaterNode[] = data.map((item: any) => {
          // If backend didn't supply a status, check if metrics exist or default to Offline
          const hasMetrics = item.metrics && Object.keys(item.metrics).length > 0;
          const status = item.status ? item.status : (hasMetrics ? 'Online' : 'Offline');
          const isOnline = status.toLowerCase() === 'online';

          return {
            id: String(item.id || item.device_id),
            device_id: item.device_id || item.id,
            name: item.name || 'Unnamed Node',
            location: item.location || 'Unassigned Field Station',
            color: isOnline ? '#22c55e' : '#ef4444',
            status: isOnline ? 'Online' : 'Offline',
            assignedUserId: item.assignedUserId || item.assigned_user || undefined,
            assignedUserName: item.assignedUserName || item.assigned_user_name || undefined,
            metrics: isOnline ? (item.metrics || { ph: 7.2, temperature: 28.0, turbidity: 15.0 }) : undefined
          };
        });
        setDevices(mappedDevices);
      }
    } catch (err: any) {
      console.error('Failed to fetch devices from FastAPI:', err);
      setFetchError(err.message || 'Failed to load devices.');
    }
  };

  useEffect(() => {
    if (!propDevices) {
      loadDevicesFromBackend();
      const interval = setInterval(loadDevicesFromBackend, 10000);
      return () => clearInterval(interval);
    }
  }, [propDevices]);

  const farmerAccounts = accounts.filter(
    (acc) => acc.role && acc.role.toLowerCase() === 'farmer'
  );

  const filteredDevices = devices.filter(
    (dev) =>
      dev.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dev.device_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dev.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (dev.assignedUserName &&
        dev.assignedUserName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleOpenAddModal = () => {
    setEditingDeviceId(null);
    setNewDeviceId('');
    setNewDeviceName('');
    setNewLocation('');
    setSelectedUserId('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (device: FloaterNode) => {
    setEditingDeviceId(device.id);
    setNewDeviceId(device.device_id);
    setNewDeviceName(device.name);
    setNewLocation(device.location);
    let currentUserId = device.assignedUserId;
    if (!currentUserId && device.assignedUserName) {
      const match = farmerAccounts.find((f) => f.name === device.assignedUserName);
      if (match) currentUserId = match.id;
    }
    setSelectedUserId(currentUserId !== undefined && currentUserId !== null ? String(currentUserId) : '');
    setIsModalOpen(true);
  };

  const handleFarmerSelect = (userId: string) => {
    setSelectedUserId(userId);
    const selectedFarmer = farmerAccounts.find((acc) => String(acc.id) === String(userId));
    if (selectedFarmer && selectedFarmer.location) {
      setNewLocation(selectedFarmer.location);
    }
  };

  const handleDeleteDevice = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this node?')) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/devices/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (response.ok) {
        setDevices((prev) => prev.filter((d) => d.id !== id));
        if (onRemoveDevice) onRemoveDevice(id);
      } else {
        alert('Failed to delete the device from the server.');
      }
    } catch (err) {
      console.error('Error deleting device:', err);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const deviceId = newDeviceId.trim();
    const deviceName = newDeviceName.trim();
    const location = newLocation.trim() || 'Unassigned Field Station';
    if (!deviceId || !deviceName || isSubmitting) return;

    setIsSubmitting(true);
    const assignedUser = farmerAccounts.find((acc) => String(acc.id) === String(selectedUserId));
    
    const backendBody = JSON.stringify({
      id: deviceId,
      device_id: deviceId,
      name: deviceName,
      location: location,
      assigned_user_id: assignedUser ? assignedUser.id : null,
      status: 'Offline' // New devices start offline until they send telemetry data
    });

    try {
      if (editingDeviceId) {
        const response = await fetch(`${API_BASE_URL}/api/devices/${editingDeviceId}`, {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: backendBody
        });
        if (!response.ok) throw new Error(`FastAPI returned status ${response.status}`);
      } else {
        const response = await fetch(`${API_BASE_URL}/api/devices`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: backendBody
        });
        if (!response.ok) throw new Error(`FastAPI returned status ${response.status}`);
      }

      await loadDevicesFromBackend();
      setEditingDeviceId(null);
      setNewDeviceId('');
      setNewDeviceName('');
      setNewLocation('');
      setSelectedUserId('');
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save device changes:', err);
      window.alert('Failed to save device changes. Check console logs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <div style={styles.searchWrapper}>
          <Search size={18} color="#64748b" style={{ marginLeft: '12px' }} />
          <input
            type="text"
            placeholder="Search nodes by ID, name, location, or assigned user..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <button type="button" onClick={handleOpenAddModal} style={styles.addButton}>
          <Plus size={18} color="#ffffff" />
          <span>Register New Node</span>
        </button>
      </div>

      {fetchError && (
        <div style={styles.errorBanner}>
          <AlertCircle size={18} />
          <span>{fetchError} (Make sure you are logged in as Super Admin)</span>
        </div>
      )}

      {filteredDevices.length === 0 ? (
        <div style={styles.emptyContainer}>
          <Cpu size={40} color="#94a3b8" />
          <h3 style={styles.emptyTitle}>NO ESP32 Nodes Found</h3>
          <p style={styles.emptySub}>
            {fetchError ? 'Could not load nodes due to connection/auth error.' : 'Register a new hardware node or verify search parameters.'}
          </p>
        </div>
      ) : (
        <div style={styles.gridContainer}>
          {filteredDevices.map((device) => {
            const isOnline = device.status.toLowerCase() === 'online';
            return (
              <div key={device.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ ...styles.statusIndicator, backgroundColor: isOnline ? '#22c55e' : '#ef4444' }} />
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
                    <span style={styles.userText}>
                      User: {device.assignedUserName || 'Unassigned'}
                    </span>
                  </div>
                </div>

                {/* Display metrics ONLY if online and sending data, otherwise hide metrics and show Offline notice */}
                {isOnline && device.metrics ? (
                  <div style={styles.metricsGrid}>
                    <div style={styles.metricBlock}>
                      <div style={styles.metricHeader}>
                        <Droplet size={14} color="#16a34a" />
                        <span>pH</span>
                      </div>
                      <strong style={{ ...styles.metricVal, color: '#16a34a' }}>
                        {device.metrics.ph.toFixed(1)}
                      </strong>
                    </div>

                    <div style={styles.metricBlock}>
                      <div style={styles.metricHeader}>
                        <Thermometer size={14} color="#0284c7" />
                        <span>Temp</span>
                      </div>
                      <strong style={{ ...styles.metricVal, color: '#0284c7' }}>
                        {device.metrics.temperature.toFixed(1)}°C
                      </strong>
                    </div>

                    <div style={styles.metricBlock}>
                      <div style={styles.metricHeader}>
                        <Eye size={14} color="#e11d48" />
                        <span>Turbidity</span>
                      </div>
                      <strong style={{ ...styles.metricVal, color: '#e11d48' }}>
                        {device.metrics.turbidity.toFixed(1)}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <div style={styles.offlineMetricsBox}>
                    <AlertCircle size={16} color="#ef4444" />
                    <span>No data streaming (Offline)</span>
                  </div>
                )}

                <div style={styles.cardFooter}>
                  <div style={styles.wifiTag}>
                    <Wifi size={13} color={isOnline ? '#16a34a' : '#94a3b8'} />
                    <span>{isOnline ? 'Connected' : 'Disconnected'}</span>
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
                      onClick={() => handleDeleteDevice(device.id)}
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
        <div style={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                {editingDeviceId ? 'Edit ESP32 Node' : 'Register ESP32 Node'}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} style={styles.closeBtn}>
                <X size={18} color="#64748b" />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Device ID / MAC Address</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ESP32_POND_01"
                  value={newDeviceId}
                  onChange={(e) => setNewDeviceId(e.target.value)}
                  disabled={Boolean(editingDeviceId)}
                  style={styles.input}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Node Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ponderosa Node 1"
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
                <button type="button" onClick={() => setIsModalOpen(false)} style={styles.cancelBtn}>
                  Cancel
                </button>
                <button type="submit" style={styles.submitBtn} disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : editingDeviceId ? 'Save Changes' : 'Register Node'}
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
  container: { padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, sans-serif' },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' },
  searchWrapper: { display: 'flex', alignItems: 'center', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', width: '400px', height: '42px' },
  searchInput: { border: 'none', outline: 'none', padding: '0 12px', width: '100%', fontSize: '14px', background: 'transparent' },
  addButton: { display: 'flex', alignItems: 'center', gap: '8px', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0 16px', height: '42px', fontWeight: 600, cursor: 'pointer' },
  errorBanner: { display: 'flex', alignItems: 'center', gap: '8px', background: '#fee2e2', color: '#b91c1c', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', fontWeight: 500 },
  emptyContainer: { textAlign: 'center', padding: '60px 20px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px' },
  emptyTitle: { marginTop: '12px', fontSize: '18px', fontWeight: 600, color: '#1e293b' },
  emptySub: { marginTop: '4px', fontSize: '14px', color: '#64748b' },
  gridContainer: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' },
  card: { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' },
  statusIndicator: { width: '10px', height: '10px', borderRadius: '50%' },
  deviceName: { fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 },
  deviceId: { fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' },
  statusBadge: { display: 'flex', alignItems: 'center', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 },
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
  modalContent: { background: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden' },
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