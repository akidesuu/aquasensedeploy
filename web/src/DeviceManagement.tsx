import React, { useState, useEffect } from 'react';
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
  metrics: {
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

// Read API URL dynamically from environment variables, falling back to live Render backend
const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'https://aquasense-backend-osmi.onrender.com';

const API_BASE_URL = BASE_URL.replace(/\/$/, '');

export default function DeviceManagement({
  devices: propDevices,
  accounts: propAccounts,
  onAddDevice,
  onEditDevice,
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

  // Sync prop changes if passed from parent
  useEffect(() => {
    if (propDevices) setDevices(propDevices);
  }, [propDevices]);

  useEffect(() => {
    if (propAccounts) setAccounts(propAccounts);
  }, [propAccounts]);

  // Fetch accounts from FastAPI if not provided via props
  useEffect(() => {
    if (!propAccounts || propAccounts.length === 0) {
      fetch(`${API_BASE_URL}/api/accounts`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setAccounts(data);
          }
        })
        .catch((err) => console.error('Failed to fetch accounts from FastAPI:', err));
    }
  }, [propAccounts]);

  // Fetch devices from FastAPI on mount
  const loadDevicesFromBackend = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/devices`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      
      if (Array.isArray(data)) {
        // Map backend schema to FloaterNode structure
        const mappedDevices: FloaterNode[] = data.map((item: any) => ({
          id: String(item.id || item.device_id),
          device_id: item.device_id || item.id,
          name: item.name || 'Unnamed Node',
          location: item.location || 'Unassigned Field Station',
          color: item.color || '#22c55e',
          status: item.status || 'Online',
          assignedUserId: item.assigned_user_id || item.assigned_user || undefined,
          assignedUserName: item.assigned_user_name || undefined,
          metrics: {
            ph: item.metrics?.ph ?? item.ph ?? 7.0,
            temperature: item.metrics?.temperature ?? item.temperature ?? 25.0,
            turbidity: item.metrics?.turbidity ?? item.turbidity ?? 100.0
          }
        }));
        setDevices(mappedDevices);
      }
    } catch (err) {
      console.error('Failed to fetch devices from FastAPI:', err);
    }
  };

  useEffect(() => {
    if (!propDevices) {
      loadDevicesFromBackend();
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
      (dev.assignedUserName && dev.assignedUserName.toLowerCase().includes(searchTerm.toLowerCase()))
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
        method: 'DELETE'
      });

      if (response.ok) {
        setDevices((prev) => prev.filter((d) => d.id !== id));
        if (onRemoveDevice) onRemoveDevice(id);
      } else {
        alert('Failed to delete the device from the server.');
      }
    } catch (err) {
      console.error('Error deleting device:', err);
      alert('Error connecting to FastAPI server.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const deviceId = newDeviceId.trim();
    const deviceName = newDeviceName.trim();
    const location = newLocation.trim() || 'Unassigned Field Station';

    if (!deviceId || !deviceName || isSubmitting) return;

    setIsSubmitting(true);

    const assignedUser = farmerAccounts.find((acc) => String(acc.id) === String(selectedUserId));

    const updatedPayload: FloaterNode = {
      id: editingDeviceId || deviceId,
      device_id: deviceId,
      name: deviceName,
      location,
      assignedUserId: assignedUser ? assignedUser.id : undefined,
      assignedUserName: assignedUser ? assignedUser.name : undefined,
      status: 'Online',
      color: '#22c55e',
      metrics: { ph: 7.2, temperature: 28.0, turbidity: 120.0 }
    };

    const backendBody = JSON.stringify({
      device_id: deviceId,
      name: deviceName,
      location: location,
      assigned_user_id: assignedUser ? assignedUser.id : null
    });

    try {
      if (editingDeviceId) {
        const response = await fetch(`${API_BASE_URL}/api/devices/${editingDeviceId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: backendBody
        });

        if (!response.ok) {
          throw new Error(`FastAPI returned status ${response.status}`);
        }

        setDevices((prev) =>
          prev.map((dev) => (dev.id === editingDeviceId ? updatedPayload : dev))
        );

        if (onEditDevice) onEditDevice(updatedPayload);
      } else {
        const duplicate = devices.some(
          (device) => device.device_id.toLowerCase() === deviceId.toLowerCase()
        );

        if (duplicate) {
          window.alert(`A device with ID "${deviceId}" is already registered.`);
          setIsSubmitting(false);
          return;
        }

        const response = await fetch(`${API_BASE_URL}/api/devices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: backendBody
        });

        if (!response.ok) {
          throw new Error(`FastAPI returned status ${response.status}`);
        }

        const resData = await response.json();
        const createdNode: FloaterNode = {
          ...updatedPayload,
          id: String(resData.id || resData.device_id || deviceId)
        };

        setDevices((prev) => [...prev, createdNode]);

        if (onAddDevice) onAddDevice(createdNode);
      }

      setEditingDeviceId(null);
      setNewDeviceId('');
      setNewDeviceName('');
      setNewLocation('');
      setSelectedUserId('');
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to persist device changes to FastAPI:', err);
      window.alert('Failed to save device changes. Check your FastAPI server logs.');
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

      {filteredDevices.length === 0 ? (
        <div style={styles.emptyContainer}>
          <Cpu size={40} color="#94a3b8" />
          <h3 style={styles.emptyTitle}>No ESP32 Nodes Found</h3>
          <p style={styles.emptySub}>Register a new hardware node or verify search parameters.</p>
        </div>
      ) : (
        <div style={styles.gridContainer}>
          {filteredDevices.map((device) => (
            <div key={device.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ ...styles.statusIndicator, backgroundColor: device.color }} />
                  <div>
                    <h3 style={styles.deviceName}>{device.name}</h3>
                    <p style={styles.deviceId}>ID: {device.device_id}</p>
                  </div>
                </div>
                <span
                  style={{
                    ...styles.statusBadge,
                    backgroundColor: device.status.toLowerCase() === 'online' ? '#dcfce7' : '#fee2e2',
                    color: device.status.toLowerCase() === 'online' ? '#15803d' : '#b91c1c'
                  }}
                >
                  {device.status.toLowerCase() === 'online' ? (
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

              <div style={styles.metricsGrid}>
                <div style={styles.metricBlock}>
                  <div style={styles.metricHeader}>
                    <Droplet size={14} color="#16a34a" />
                    <span>pH</span>
                  </div>
                  <strong style={{ ...styles.metricVal, color: '#16a34a' }}>
                    {device.metrics?.ph != null ? device.metrics.ph.toFixed(1) : '7.0'}
                  </strong>
                </div>

                <div style={styles.metricBlock}>
                  <div style={styles.metricHeader}>
                    <Thermometer size={14} color="#0284c7" />
                    <span>Temp</span>
                  </div>
                  <strong style={{ ...styles.metricVal, color: '#0284c7' }}>
                    {device.metrics?.temperature != null ? device.metrics.temperature.toFixed(1) : '25.0'}°C
                  </strong>
                </div>

                <div style={styles.metricBlock}>
                  <div style={styles.metricHeader}>
                    <Eye size={14} color="#e11d48" />
                    <span>Turbidity</span>
                  </div>
                  <strong style={{ ...styles.metricVal, color: '#e11d48' }}>
                    {device.metrics?.turbidity != null ? device.metrics.turbidity.toFixed(1) : '100.0'}
                  </strong>
                </div>
              </div>

              <div style={styles.cardFooter}>
                <div style={styles.wifiTag}>
                  <Wifi size={13} color="#16a34a" />
                  <span>Wi-Fi Direct</span>
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
          ))}
        </div>
      )}

      {isModalOpen && (
        <div
          style={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="register-node-title"
          onClick={() => setIsModalOpen(false)}
        >
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 id="register-node-title" style={styles.modalTitle}>
                {editingDeviceId ? 'Edit ESP32 Node' : 'Register ESP32 Node'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={styles.closeBtn}
              >
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
                  {farmerAccounts.length === 0 ? (
                    <option value="" disabled>
                      No Farmer accounts available
                    </option>
                  ) : (
                    farmerAccounts.map((farmer) => (
                      <option key={farmer.id} value={String(farmer.id)}>
                        {farmer.name} ({farmer.location || 'No Location'})
                      </option>
                    ))
                  )}
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
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={styles.cancelBtn}
                  disabled={isSubmitting}
                >
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
  searchWrapper: { display: 'flex', alignItems: 'center', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', width: '400px', maxWidth: '100%', height: '42px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
  searchInput: { border: 'none', outline: 'none', padding: '0 12px', width: '100%', fontSize: '14px', background: 'transparent' },
  addButton: { display: 'flex', alignItems: 'center', gap: '8px', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0 16px', height: '42px', fontWeight: 600, cursor: 'pointer' },
  emptyContainer: { textAlign: 'center', padding: '60px 20px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px' },
  emptyTitle: { marginTop: '12px', fontSize: '18px', fontWeight: 600, color: '#1e293b' },
  emptySub: { marginTop: '4px', fontSize: '14px', color: '#64748b' },
  gridContainer: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' },
  card: { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
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
  metricVal: { fontSize: '14px' },
  cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #f1f5f9' },
  wifiTag: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#15803d', background: '#f0fdf4', padding: '2px 8px', borderRadius: '6px' },
  actionBtnIcon: { background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  actionBtnIconEdit: { background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  actionBtnIconDanger: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' },
  modalContent: { background: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', overflow: 'hidden' },
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