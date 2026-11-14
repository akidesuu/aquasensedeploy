import { useState, useEffect } from 'react';
import DeviceManagement, { type FloaterNode } from './DeviceManagement';

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'https://aquasense-backend-osmi.onrender.com';
const API_URL = BASE_URL.replace(/\/$/, '');

const getAuthHeaders = () => {
  const token = localStorage.getItem('token') || localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export default function DevicesContainer() {
  const [devices, setDevices] = useState<FloaterNode[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchDevices = async () => {
    try {
      const res = await fetch(`${API_URL}/api/devices`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to load nodes');
      const data: any[] = await res.json();
      
      const mappedDevices: FloaterNode[] = data.map((item) => ({
        id: String(item.id || item.device_id),
        device_id: item.device_id || item.id,
        name: item.name || 'Unnamed Node',
        location: item.location || 'Unassigned Field Station',
        color: item.color || '#22c55e',
        status: item.status || 'Offline',
        assignedUserId: item.assignedUserId || item.assigned_user || undefined,
        assignedUserName: item.assignedUserName || item.assigned_user_name || undefined,
        metrics: item.metrics || undefined
      }));

      setDevices(mappedDevices);
    } catch (err) {
      console.error('Error fetching device data from API', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleRemoveDevice = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/devices/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!res.ok) throw new Error('Delete failed');
      setDevices((prev) => prev.filter((d) => d.id !== id && d.device_id !== id));
    } catch (err) {
      console.error('Failed to remove node', err);
      window.alert('Failed to delete device node from server database.');
    }
  };

  const handleRebootDevice = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/devices/${id}/reboot`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        window.alert('Reboot command dispatched to device node.');
      }
    } catch (err) {
      console.error('Failed to dispatch reboot', err);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
        Fetching nodes from database...
      </div>
    );
  }

  return (
    <DeviceManagement
      devices={devices}
      onRemoveDevice={handleRemoveDevice}
      onRebootDevice={handleRebootDevice}
    />
  );
}