import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Bell,
  Clock,
  Sliders,
  X,
} from 'lucide-react-native';
import { FloaterDevice } from './ComponentsScreen';

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
  devices?: FloaterDevice[];
  onSelectAlertDevice?: (deviceId: string | number) => void;
  onAlertsChange?: (alerts: SystemAlert[]) => void;
}

const API_BASE_URL = 'https://aquasense-backend-osmi.onrender.com';
const STORAGE_KEY_MIN_DO = '@aquasense_min_do_threshold';
const STORAGE_KEY_MAX_DO = '@aquasense_max_do_threshold';

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
    const badgeBg = isCritical ? '#fee2e2' : isWarning ? '#fef3c7' : '#e0f2fe';
    const badgeTextColor = isCritical
      ? '#b91c1c'
      : isWarning
      ? '#b45309'
      : '#0284c7';

    return (
      <View
        style={[
          styles.alertCard,
          { borderColor: cardBorderColor },
          item.isResolved && styles.resolvedCardStyle,
        ]}
      >
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
        <Text style={styles.alertTitleText}>{item.title}</Text>
        <Text style={styles.alertMessageText}>{item.message}</Text>
        <View style={styles.alertCardFooter}>
          <TouchableOpacity
            style={[
              styles.resolveActionBtn,
              item.isResolved && styles.resolveActionBtnDone,
            ]}
            onPress={() => onToggleResolve(item.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.isResolved }}
          >
            <CheckCircle2
              size={14}
              color={item.isResolved ? '#0284c7' : '#64748b'}
            />
            <Text
              style={[
                styles.resolveActionText,
                item.isResolved && { color: '#0284c7' },
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
  devices = [],
  onSelectAlertDevice,
  onAlertsChange,
}: AlertScreenProps) {
  const [backendAlerts, setBackendAlerts] = useState<SystemAlert[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const [minDoThreshold, setMinDoThreshold] = useState<string>('4.0');
  const [maxDoThreshold, setMaxDoThreshold] = useState<string>('10.0');
  const [tempMin, setTempMin] = useState<string>('4.0');
  const [tempMax, setTempMax] = useState<string>('10.0');

  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);

  useEffect(() => {
    const loadSavedThresholds = async () => {
      try {
        const savedMin = await AsyncStorage.getItem(STORAGE_KEY_MIN_DO);
        const savedMax = await AsyncStorage.getItem(STORAGE_KEY_MAX_DO);
        if (savedMin !== null) {
          setMinDoThreshold(savedMin);
          setTempMin(savedMin);
        }
        if (savedMax !== null) {
          setMaxDoThreshold(savedMax);
          setTempMax(savedMax);
        }
      } catch (err) {
        console.warn('Failed to load DO thresholds from storage:', err);
      }
    };
    loadSavedThresholds();
  }, []);

  const fetchAlertsFromBackend = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/alerts`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          const ownedIds = new Set(
            devices
              .flatMap((d) => [String(d.id), String(d.device_id || '')])
              .filter(Boolean)
          );
          const filtered =
            ownedIds.size > 0
              ? data.filter((alt: any) =>
                  ownedIds.has(String(alt.device_id || alt.deviceId || ''))
                )
              : data;

          const formattedAlerts: SystemAlert[] = filtered.map((alt: any) => ({
            id: String(alt.id || alt._id),
            deviceId: alt.device_id || alt.deviceId,
            deviceName: alt.device_name || alt.deviceName || `Node ${alt.device_id}`,
            location: alt.location || 'AquaSense Pond',
            severity: alt.severity || 'info',
            title: alt.title || 'System Alert',
            message: alt.message || 'Telemetry anomaly recorded.',
            timestamp: alt.timestamp || 'Just now',
            isResolved: Boolean(alt.is_resolved ?? alt.isResolved),
          }));
          setBackendAlerts(formattedAlerts);
        }
      }
    } catch (error) {
      console.warn('Could not fetch remote alerts:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [devices]);

  useEffect(() => {
    setIsLoading(true);
    fetchAlertsFromBackend();
  }, [fetchAlertsFromBackend]);

  const dynamicAlerts = useMemo(() => {
    const minLimit = parseFloat(minDoThreshold) || 4.0;
    const maxLimit = parseFloat(maxDoThreshold) || 10.0;
    const generated: SystemAlert[] = [];

    devices.forEach((dev) => {
      if (String(dev.status || '').toLowerCase() === 'offline') return;
      const currentDo = dev.metrics?.predictedDo ?? 5.25;

      if (currentDo <= minLimit) {
        const alertId = `dynamic-low-do-${dev.id}`;
        generated.push({
          id: alertId,
          deviceId: dev.id,
          deviceName: dev.name,
          location: dev.location,
          severity: 'critical',
          title: 'Low Dissolved Oxygen Warning',
          message: `Predicted DO dropped to ${currentDo.toFixed(2)} mg/L (Min Limit: <= ${minLimit} mg/L). Aeration required.`,
          timestamp: 'Live stream',
          isResolved: resolvedIds.includes(alertId),
        });
      }

      if (currentDo >= maxLimit) {
        const alertId = `dynamic-high-do-${dev.id}`;
        generated.push({
          id: alertId,
          deviceId: dev.id,
          deviceName: dev.name,
          location: dev.location,
          severity: 'warning',
          title: 'High Dissolved Oxygen Warning',
          message: `Predicted DO rose to ${currentDo.toFixed(2)} mg/L (Max Limit: >= ${maxLimit} mg/L). Monitor water status.`,
          timestamp: 'Live stream',
          isResolved: resolvedIds.includes(alertId),
        });
      }
    });

    return [
      ...generated,
      ...backendAlerts.filter((b) => !generated.some((g) => g.deviceId === b.deviceId)),
    ];
  }, [devices, minDoThreshold, maxDoThreshold, resolvedIds, backendAlerts]);

  useEffect(() => {
    onAlertsChange?.(dynamicAlerts);
  }, [dynamicAlerts, onAlertsChange]);

  const handleSaveThresholds = async () => {
    const finalMin = tempMin.trim() === '' ? '4.0' : tempMin;
    const finalMax = tempMax.trim() === '' ? '10.0' : tempMax;

    setMinDoThreshold(finalMin);
    setMaxDoThreshold(finalMax);
    setIsModalVisible(false);

    try {
      await AsyncStorage.setItem(STORAGE_KEY_MIN_DO, finalMin);
      await AsyncStorage.setItem(STORAGE_KEY_MAX_DO, finalMax);
    } catch (err) {
      console.warn('Failed to save DO thresholds to storage:', err);
    }
  };

  const toggleResolveAlert = (id: string) => {
    setResolvedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchAlertsFromBackend();
  };

  const activeAlerts = useMemo(
    () => dynamicAlerts.filter((item) => !item.isResolved),
    [dynamicAlerts]
  );

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor="#0284c7"
        />
      }
    >
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.screenHeaderTitle}>System Notifications</Text>
          <Text style={styles.screenHeaderSub}>
            Min: {minDoThreshold} | Max: {maxDoThreshold} mg/L
          </Text>
        </View>
        <TouchableOpacity
          style={styles.thresholdBtn}
          onPress={() => {
            setTempMin(minDoThreshold);
            setTempMax(maxDoThreshold);
            setIsModalVisible(true);
          }}
          activeOpacity={0.8}
        >
          <Sliders size={16} color="#ffffff" />
          <Text style={styles.thresholdBtnText}>Configure</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.listContainer}>
        {isLoading ? (
          <View style={styles.emptyStateContainer}>
            <ActivityIndicator size="small" color="#0284c7" />
            <Text style={styles.emptyStateTitle}>Syncing telemetry alerts...</Text>
          </View>
        ) : activeAlerts.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Bell size={32} color="#94a3b8" />
            <Text style={styles.emptyStateTitle}>No Active Alerts</Text>
            <Text style={styles.emptyStateSubtext}>
              Your active nodes are within {minDoThreshold} - {maxDoThreshold} mg/L.
            </Text>
          </View>
        ) : (
          activeAlerts.map((item) => (
            <AlertCard
              key={item.id}
              item={item}
              onToggleResolve={toggleResolveAlert}
              onSelectDevice={onSelectAlertDevice}
            />
          ))
        )}
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContentCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitleText}>DO Trigger Limits</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalBodyText}>
              Set minimum and maximum Dissolved Oxygen boundaries in mg/L.
            </Text>

            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>Minimum DO Limit (mg/L)</Text>
              <TextInput
                style={styles.textInputBox}
                value={tempMin}
                onChangeText={setTempMin}
                keyboardType="numeric"
                placeholder="e.g. 4.0"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={[styles.inputBlock, { marginTop: 14 }]}>
              <Text style={styles.inputLabel}>Maximum DO Limit (mg/L)</Text>
              <TextInput
                style={styles.textInputBox}
                value={tempMax}
                onChangeText={setTempMax}
                keyboardType="numeric"
                placeholder="e.g. 10.0"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <TouchableOpacity
              style={styles.modalSaveButton}
              onPress={handleSaveThresholds}
              activeOpacity={0.8}
            >
              <Text style={styles.modalSaveButtonText}>Save Threshold Limits</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 110 },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  screenHeaderTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  screenHeaderSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  thresholdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  thresholdBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  listContainer: { gap: 12 },
  alertCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  resolvedCardStyle: { opacity: 0.7, backgroundColor: '#f8fafc' },
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
  severityBadgeText: { fontSize: 10, fontWeight: '800' },
  deviceNameLink: { fontSize: 12, fontWeight: '700', color: '#0284c7' },
  timestampGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timestampText: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
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
  resolveActionBtnDone: { backgroundColor: '#e0f2fe' },
  resolveActionText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitleText: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  modalBodyText: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
    marginBottom: 16,
  },
  inputBlock: { width: '100%' },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  textInputBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 16,
    height: 48,
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalSaveButton: {
    backgroundColor: '#0284c7',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  modalSaveButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
});