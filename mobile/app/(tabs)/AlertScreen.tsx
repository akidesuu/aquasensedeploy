import React, { useState, useEffect, useMemo, memo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Bell,
  Clock,
  Trash2,
} from 'lucide-react-native';

export interface SystemAlert {
  id: string;
  deviceId: string | number;
  deviceName: string;
  location: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  isResolved: boolean;
}

interface AlertScreenProps {
  alerts?: SystemAlert[];
  onSelectAlertDevice?: (deviceId: string | number) => void;
  onAlertsChange?: (alerts: SystemAlert[]) => void;
}

// Set host IP for local network development
const SERVER_IP: string = "192.168.18.21"; // Replace with host IP address
const API_BASE_URL = Platform.OS === 'android' && (SERVER_IP as string) === 'localhost' 
  ? "http://10.0.2.2:8000" 
  : `http://${SERVER_IP}:8000`;

const DEFAULT_ALERTS: SystemAlert[] = [
  {
    id: 'alt-1',
    deviceId: 'ESP32_POND_04',
    deviceName: 'Floater 4',
    location: 'Pond C South',
    severity: 'critical',
    title: 'Low Dissolved Oxygen Warning',
    message: 'Predicted DO level reached 2.4 mg/L (threshold: <= 4.0 mg/L). Immediate aeration required.',
    timestamp: '2 mins ago',
    isResolved: false,
  },
  {
    id: 'alt-2',
    deviceId: 'ESP32_POND_03',
    deviceName: 'Floater 3',
    location: 'Pond B North',
    severity: 'warning',
    title: 'Elevated Water Temperature',
    message: 'Temperature spike detected at 29.1°C. Monitor thermal conditions.',
    timestamp: '14 mins ago',
    isResolved: false,
  },
  {
    id: 'alt-3',
    deviceId: 'ESP32_POND_01',
    deviceName: 'Floater 1',
    location: 'Pond A Alpha',
    severity: 'info',
    title: 'Routine Battery Notification',
    message: 'Battery level dropped below 85%. Solar charging active.',
    timestamp: '1 hour ago',
    isResolved: true,
  },
  {
    id: 'alt-4',
    deviceId: 'ESP32_POND_04',
    deviceName: 'Floater 4',
    location: 'Pond C South',
    severity: 'warning',
    title: 'High Turbidity Detected',
    message: 'Turbidity spiked to 18.4 NTU after water intake.',
    timestamp: '3 hours ago',
    isResolved: true,
  },
];

// Memoized Individual Alert Card
const AlertCard = memo(
  ({
    item,
    onToggleResolve,
    onSelectDevice,
  }: {
    item: SystemAlert;
    onToggleResolve: (id: string) => void;
    onSelectDevice?: (deviceId: string | number) => void;
  }) => {
    const isCritical = item.severity === 'critical';
    const isWarning = item.severity === 'warning';

    const cardBorderColor = item.isResolved
      ? '#e2e8f0'
      : isCritical
      ? '#fca5a5'
      : isWarning
      ? '#fde68a'
      : '#cbd5e1';

    const badgeBg = isCritical
      ? '#fee2e2'
      : isWarning
      ? '#fef3c7'
      : '#f1f5f9';

    const badgeTextColor = isCritical
      ? '#b91c1c'
      : isWarning
      ? '#b45309'
      : '#475569';

    return (
      <View
        style={[
          styles.alertCard,
          { borderColor: cardBorderColor },
          item.isResolved && styles.resolvedCardStyle,
        ]}
      >
        {/* TOP META ROW */}
        <View style={styles.alertCardHeader}>
          <View style={styles.headerLeftGroup}>
            <View style={[styles.severityBadge, { backgroundColor: badgeBg }]}>
              {isCritical ? (
                <AlertTriangle size={12} color={badgeTextColor} />
              ) : isWarning ? (
                <AlertCircle size={12} color={badgeTextColor} />
              ) : (
                <Bell size={12} color={badgeTextColor} />
              )}
              <Text style={[styles.severityBadgeText, { color: badgeTextColor }]}>
                {item.severity.toUpperCase()}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => onSelectDevice?.(item.deviceId)}
              accessibilityRole="button"
              accessibilityLabel={`Filter by device ${item.deviceName}`}
            >
              <Text style={styles.deviceNameLink} numberOfLines={1}>
                {item.deviceName} • {item.location}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.timestampGroup}>
            <Clock size={12} color="#94a3b8" />
            <Text style={styles.timestampText}>{item.timestamp}</Text>
          </View>
        </View>

        {/* CONTENT BODY */}
        <Text style={styles.alertTitleText}>{item.title}</Text>
        <Text style={styles.alertMessageText}>{item.message}</Text>

        {/* FOOTER ACTIONS */}
        <View style={styles.alertCardFooter}>
          <TouchableOpacity
            style={[
              styles.resolveActionBtn,
              item.isResolved && styles.resolveActionBtnDone,
            ]}
            onPress={() => onToggleResolve(item.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.isResolved }}
            accessibilityLabel={`Mark ${item.title} as ${
              item.isResolved ? 'unresolved' : 'resolved'
            }`}
          >
            <CheckCircle2
              size={14}
              color={item.isResolved ? '#059669' : '#64748b'}
            />
            <Text
              style={[
                styles.resolveActionText,
                item.isResolved && { color: '#059669' },
              ]}
            >
              {item.isResolved ? 'Resolved' : 'Mark as Resolved'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
);

AlertCard.displayName = 'AlertCard';

export default function AlertScreen({
  alerts,
  onSelectAlertDevice,
  onAlertsChange,
}: AlertScreenProps) {
  const [alertList, setAlertList] = useState<SystemAlert[]>(alerts || DEFAULT_ALERTS);
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'critical'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Fetch alerts from backend `/api/alerts`
  const fetchAlertsFromBackend = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/alerts`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const formattedAlerts: SystemAlert[] = data.map((alt: any) => ({
            id: String(alt.id || alt._id),
            deviceId: alt.device_id || alt.deviceId,
            deviceName: alt.device_name || alt.deviceName || `Floater ${alt.device_id}`,
            location: alt.location || 'AquaSense Pond',
            severity: alt.severity || 'info',
            title: alt.title || 'System Alert',
            message: alt.message || 'Telemetry anomaly recorded.',
            timestamp: alt.timestamp || 'Just now',
            isResolved: Boolean(alt.is_resolved ?? alt.isResolved),
          }));
          setAlertList(formattedAlerts);
          onAlertsChange?.(formattedAlerts);
        }
      }
    } catch (error) {
      console.warn("Alerts endpoint unreachable, keeping current state:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [onAlertsChange]);

  useEffect(() => {
    if (alerts && alerts.length > 0) {
      setAlertList(alerts);
    } else {
      setIsLoading(true);
      fetchAlertsFromBackend();
    }
  }, [alerts, fetchAlertsFromBackend]);

  const updateAlerts = (newList: SystemAlert[]) => {
    setAlertList(newList);
    onAlertsChange?.(newList);
  };

  const toggleResolveAlert = async (id: string) => {
    const targetAlert = alertList.find((a) => a.id === id);
    if (!targetAlert) return;

    const newResolvedState = !targetAlert.isResolved;
    const updated = alertList.map((item) =>
      item.id === id ? { ...item, isResolved: newResolvedState } : item
    );
    updateAlerts(updated);

    // Sync resolution status with backend
    try {
      await fetch(`${API_BASE_URL}/api/alerts/${id}/resolve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_resolved: newResolvedState }),
      });
    } catch (err) {
      console.warn(`Failed to sync resolve status for alert ${id}:`, err);
    }
  };

  const clearResolved = () => {
    const updated = alertList.filter((item) => !item.isResolved);
    updateAlerts(updated);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchAlertsFromBackend();
  };

  // Filtered Alert List memoization
  const filteredAlerts = useMemo(() => {
    return alertList.filter((item) => {
      if (filter === 'unresolved') return !item.isResolved;
      if (filter === 'critical') return item.severity === 'critical';
      return true;
    });
  }, [alertList, filter]);

  // Aggregation counts memoization
  const counts = useMemo(() => {
    let critical = 0;
    let warning = 0;
    let resolved = 0;

    alertList.forEach((a) => {
      if (a.isResolved) {
        resolved++;
      } else {
        if (a.severity === 'critical') critical++;
        if (a.severity === 'warning') warning++;
      }
    });

    return { critical, warning, resolved };
  }, [alertList]);

  return (
    <ScrollView 
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#0284c7" />
      }
    >
      {/* HEADER STATS SUMMARY */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderLeftColor: '#ef4444' }]}>
          <View style={styles.statHeader}>
            <AlertTriangle size={16} color="#ef4444" />
            <Text style={styles.statCardTitle}>Critical</Text>
          </View>
          <Text style={[styles.statCardValue, { color: '#ef4444' }]}>
            {counts.critical}
          </Text>
        </View>

        <View style={[styles.statCard, { borderLeftColor: '#f59e0b' }]}>
          <View style={styles.statHeader}>
            <AlertCircle size={16} color="#f59e0b" />
            <Text style={styles.statCardTitle}>Warnings</Text>
          </View>
          <Text style={[styles.statCardValue, { color: '#f59e0b' }]}>
            {counts.warning}
          </Text>
        </View>

        <View style={[styles.statCard, { borderLeftColor: '#10b981' }]}>
          <View style={styles.statHeader}>
            <CheckCircle2 size={16} color="#10b981" />
            <Text style={styles.statCardTitle}>Resolved</Text>
          </View>
          <Text style={[styles.statCardValue, { color: '#10b981' }]}>
            {counts.resolved}
          </Text>
        </View>
      </View>

      {/* FILTER TABS & CLEAR ACTION */}
      <View style={styles.filterBar}>
        <View style={styles.tabGroup}>
          <TouchableOpacity
            style={[styles.filterChip, filter === 'all' && styles.activeFilterChip]}
            onPress={() => setFilter('all')}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === 'all' }}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === 'all' && styles.activeFilterChipText,
              ]}
            >
              All ({alertList.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              filter === 'unresolved' && styles.activeFilterChip,
            ]}
            onPress={() => setFilter('unresolved')}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === 'unresolved' }}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === 'unresolved' && styles.activeFilterChipText,
              ]}
            >
              Active
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              filter === 'critical' && styles.activeFilterChip,
            ]}
            onPress={() => setFilter('critical')}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === 'critical' }}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === 'critical' && styles.activeFilterChipText,
              ]}
            >
              Critical
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.clearBtn}
          onPress={clearResolved}
          accessibilityRole="button"
          accessibilityLabel="Clear resolved alerts"
        >
          <Trash2 size={16} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* ALERTS FEED LIST */}
      <View style={styles.listContainer}>
        {isLoading ? (
          <View style={styles.emptyStateContainer}>
            <ActivityIndicator size="small" color="#0284c7" />
            <Text style={styles.emptyStateTitle}>Syncing AquaSense alerts...</Text>
          </View>
        ) : filteredAlerts.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Bell size={32} color="#cbd5e1" />
            <Text style={styles.emptyStateTitle}>No alerts match this filter</Text>
            <Text style={styles.emptyStateSubtext}>
              All telemetry parameters are operating within safe margins.
            </Text>
          </View>
        ) : (
          filteredAlerts.map((item) => (
            <AlertCard
              key={item.id}
              item={item}
              onToggleResolve={toggleResolveAlert}
              onSelectDevice={onSelectAlertDevice}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 110,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statCardTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  statCardValue: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  tabGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
  },
  activeFilterChip: {
    backgroundColor: '#0284c7',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  activeFilterChipText: {
    color: '#ffffff',
  },
  clearBtn: {
    padding: 8,
  },
  listContainer: {
    gap: 12,
  },
  alertCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
  },
  resolvedCardStyle: {
    opacity: 0.7,
    backgroundColor: '#f8fafc',
  },
  alertCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  severityBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  deviceNameLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  timestampGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timestampText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  alertTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  alertMessageText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 12,
  },
  alertCardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  resolveActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  resolveActionBtnDone: {
    backgroundColor: '#ecfdf5',
  },
  resolveActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyStateTitle: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  emptyStateSubtext: {
    marginTop: 4,
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});