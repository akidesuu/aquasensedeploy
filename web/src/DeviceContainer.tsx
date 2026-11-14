import { useState, useEffect } from 'react';
import DeviceManagement, { type FloaterNode } from './DeviceManagement';

// Read API URL dynamically from environment variables, falling back to live Render backend
const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'https://aquasense-backend-osmi.onrender.com';
const API_URL = BASE_URL.replace(/\/$/, '');

// Helper to retrieve auth headers
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
        status: item.status || 'Online',
        assignedUserId: item.assignedUserId || item.assigned_user || undefined,
        assignedUserName: item.assignedUserName || item.assigned_user_name || undefined,
        metrics: {
          ph: item.metrics?.ph ?? item.ph ?? 7.0,
          temperature: item.metrics?.temperature ?? item.temperature ?? 25.0,
          turbidity: item.metrics?.turbidity ?? item.turbidity ?? 100.0
        }
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

  const handleAddDevice = async (newDev: { id: string; name: string; location: string }) => {
    const payload = {
      id: newDev.id,
      device_id: newDev.id,
      name: newDev.name,
      location: newDev.location,
      color: '#0284c7',
      status: 'Online'
    };

    const res = await fetch(`${API_URL}/api/devices`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || 'Failed to save node');
    }

    const savedNode: any = await res.json();
    const formattedNode: FloaterNode = {
      id: String(savedNode.id || savedNode.device_id || newDev.id),
      device_id: savedNode.device_id || newDev.id,
      name: savedNode.name || newDev.name,
      location: savedNode.location || newDev.location,
      color: savedNode.color || '#22c55e',
      status: savedNode.status || 'Online',
      metrics: { ph: 7.2, temperature: 28.0, turbidity: 120.0 }
    };

    setDevices((prev) => [...prev, formattedNode]);
  };

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
      } else {
        window.alert('Reboot command failed.');
      }
    } catch (err) {
      console.error('Failed to dispatch reboot', err);
    }
  };

  if (isLoading) {
    return (
      <div className="p-10 text-center text-slate-400">
        Fetching nodes from database...
      </div>
    );
  }

  return (
    <DeviceManagement
      devices={devices}
      onAddDevice={handleAddDevice}
      onRemoveDevice={handleRemoveDevice}
      onRebootDevice={handleRebootDevice}
    />
  );
}