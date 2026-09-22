import { useState, useEffect } from 'react';
import DeviceManagement, { type FloaterNode } from './DeviceManagement';

const API_URL = 'http://127.0.0.1:8000';

export default function DevicesContainer() {
  const [devices, setDevices] = useState<FloaterNode[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchDevices = async () => {
    try {
      const res = await fetch(`${API_URL}/devices`);
      if (!res.ok) throw new Error('Failed to load nodes');
      const data: FloaterNode[] = await res.json();
      setDevices(data);
    } catch (err) {
      console.error('Error fetch device data from API', err);
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
    try {
      const payload = {
        device_id: newDev.id,
        id: newDev.id,
        name: newDev.name,
        location: newDev.location,
        color: '#0284c7',
        status: 'Offline'
      };

      const res = await fetch(`${API_URL}/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to save node');
      }

      await fetchDevices();
    } catch (err) {
      console.error('Failed to add node', err);
      window.alert('Failed to save device node to database.');
    }
  };

  const handleRemoveDevice = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/devices/${id}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Delete failed');
      await fetchDevices();
    } catch (err) {
      console.error('Failed to remove node', err);
      window.alert('Failed to delete device node from server database.');
    }
  };

  const handleRebootDevice = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/devices/${id}/reboot`, {
        method: 'POST'
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
      <div className="p-10 text-center text-slate-400">
        Fetch nodes from database...
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