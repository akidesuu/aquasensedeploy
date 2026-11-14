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
const STORAGE_KEY_DO_THRESHOLD = '@aquasense_do_threshold';

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
    const badgeBg = isCritical ? '#fee2e2' : isWarning ? '#fef3c7' : '#f1f5f9';
    const badgeTextColor = isCritical ? '#b91c1c' : isWarning ? '#b45309' : '#475569';

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
  devices = [],
  onSelectAlertDevice,
  onAlertsChange,
}: AlertScreenProps) {
  const [backendAlerts, setBackendAlerts] = useState<SystemAlert[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [doThreshold, setDoThreshold] = useState<string>('4.0');
  const [tempThreshold, setTempThreshold] = useState<string>('4.0');
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);

  // Load saved threshold from AsyncStorage on mount
  useEffect(() => {
    const loadSavedThreshold = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY_DO_THRESHOLD);
        if (saved !== null) {
          setDoThreshold(saved);
          setTempThreshold(saved);
        }
      } catch (err) {
        console.warn('Failed to load DO threshold from storage:', err);
      }
    };
    loadSavedThreshold();
  }, []);

  const fetchAlertsFromBackend = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/alerts`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          const formattedAlerts: SystemAlert[] = data.map((alt: any) => ({
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
      console.warn("Could not fetch remote alerts:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fetchAlertsFromBackend();
  }, [fetchAlertsFromBackend]);

  const dynamicAlerts = useMemo(() => {
    const thresholdNum = parseFloat(doThreshold) || 4.0;
    const generated: SystemAlert[] = [];

    devices.forEach((dev) => {
      const currentDo = dev.metrics?.predictedDo ?? 6.5;
      if (currentDo <= thresholdNum) {
        const alertId = `dynamic-do-${dev.id}`;
        generated.push({
          id: alertId,
          deviceId: dev.id,
          deviceName: dev.name,
          location: dev.location,
          severity: 'critical',
          title: 'Low Dissolved Oxygen Warning',
          message: `Predicted DO level reached ${currentDo.toFixed(1)} mg/L (threshold: <= ${thresholdNum} mg/L). Immediate aeration required.`,
          timestamp: 'Live stream',
          isResolved: resolvedIds.includes(alertId),
        });
      }
    });

    const combined = [...generated, ...backendAlerts.filter(b => !generated.some(g => g.deviceId === b.deviceId))];
    return combined;
  }, [devices, doThreshold, resolvedIds, backendAlerts]);

  useEffect(() => {
    onAlertsChange?.(dynamicAlerts);
  }, [dynamicAlerts, onAlertsChange]);

  const handleSaveThreshold = async () => {
    const valToSave = tempThreshold.trim() || '4.0';
    setDoThreshold(valToSave);
    setIsModalVisible(false);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_DO_THRESHOLD, valToSave);
    } catch (err) {
      console.warn('Failed to save DO threshold to storage:', err);
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

  const activeAlerts = useMemo(() => {
    return dynamicAlerts.filter((item) => !item.isResolved);
  }, [dynamicAlerts]);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#0284c7" />
      }
    >
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.screenHeaderTitle}>System Notifications</Text>
          <Text style={styles.screenHeaderSub}>Active Trigger Limit: {doThreshold} mg/L DO</Text>
        </View>
        <TouchableOpacity
          style={styles.thresholdBtn}
          onPress={() => {
            setTempThreshold(doThreshold);
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
            <Bell size={32} color="#cbd5e1" />
            <Text style={styles.emptyStateTitle}>No Active Alerts</Text>
            <Text style={styles.emptyStateSubtext}>
              All active nodes are operating within your configured Dissolved Oxygen safety margin ({doThreshold} mg/L).
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
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitleText}>DO Trigger Threshold</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalBodyText}>
              Set the minimum Predicted Dissolved Oxygen (mg/L) level below which critical alerts and notifications will trigger dynamically.
            </Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={tempThreshold}
                onChangeText={setTempThreshold}
                placeholder="4.0"
              />
              <Text style={styles.inputUnit}>mg/L</Text>
            </View>
            <TouchableOpacity
              style={styles.modalSaveButton}
              onPress={handleSaveThreshold}
              activeOpacity={0.8}
            >
              <Text style={styles.modalSaveButtonText}>Save Threshold Limit</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
  },
  resolvedCardStyle: { opacity: 0.7, backgroundColor: '#f8fafc' },
  alertCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  headerLeftGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  severityBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  severityBadgeText: { fontSize: 10, fontWeight: '800' },
  deviceNameLink: { fontSize: 12, fontWeight: '700', color: '#0284c7' },
  timestampGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timestampText: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
  alertTitleText: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  alertMessageText: { fontSize: 13, color: '#475569', lineHeight: 18, marginBottom: 12 },
  alertCardFooter: { flexDirection: 'row', justifyContent: 'flex-end', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
  resolveActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: '#f1f5f9' },
  resolveActionBtnDone: { backgroundColor: '#ecfdf5' },
  resolveActionText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  emptyStateContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  emptyStateTitle: { marginTop: 10, fontSize: 14, fontWeight: '700', color: '#334155' },
  emptyStateSubtext: { marginTop: 4, fontSize: 12, color: '#94a3b8', textAlign: 'center', paddingHorizontal: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContentCard: { backgroundColor: '#ffffff', borderRadius: 24, padding: 24, width: '100%', maxWidth: 340, elevation: 10, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 15 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitleText: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  modalBodyText: { fontSize: 13, color: '#64748b', lineHeight: 18, marginBottom: 20 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 16, marginBottom: 24 },
  textInput: { flex: 1, height: 48, fontSize: 16, fontWeight: '700', color: '#0f172a' },
  inputUnit: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  modalSaveButton: { backgroundColor: '#0284c7', borderRadius: 12, height: 48, justifyContent: 'center', alignItems: 'center' },
  modalSaveButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});