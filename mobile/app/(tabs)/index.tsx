import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Bell,
  Home,
  Layers,
  AlertCircle,
  User,
  ChevronRight,
  Activity,
  Wifi,
  WifiOff
} from 'lucide-react-native';
import { useAuth } from '../_layout';
import AlertScreen from './AlertScreen';
import ProfileScreen from './Profile';
import ComponentsScreen, { FloaterDevice } from './ComponentsScreen';

const { width } = Dimensions.get('window');
const API_BASE_URL = 'https://aquasense-backend-osmi.onrender.com';

export default function MobileDashboard() {
  const router = useRouter();
  const { logout, user } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<'home' | 'components' | 'alert' | 'profile'>('home');
  const [selectedDevice, setSelectedDevice] = useState<FloaterDevice | null>(null);
  const [sparklineData, setSparklineData] = useState<number[]>([6.2, 6.5, 6.1, 6.4, 6.3, 6.0, 6.4]);
  const [devices, setDevices] = useState<FloaterDevice[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(true);

  const devicesRef = useRef<FloaterDevice[]>([]);
  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  const fetchDevices = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/devices`);
      if (response.ok) {
        const rawDevices = await response.json();
        if (Array.isArray(rawDevices)) {
          const formattedDevices: FloaterDevice[] = rawDevices.map((dev: any) => ({
            id: dev.device_id || dev.id || 'ESP32_POND_01',
            name: dev.name || dev.device_id || 'Node ESP32_POND_01',
            location: dev.location || 'BonBon',
            color: dev.color || '#22c55e',
            metrics: {
              ph: dev.metrics?.ph ?? 7.33,
              temperature: dev.metrics?.temperature ?? 24.1,
              turbidity: dev.metrics?.turbidity ?? 12.0,
              battery: dev.metrics?.battery ?? 85,
              predictedDo: dev.metrics?.predictedDo ?? 5.25
            }
          }));

          setDevices(formattedDevices);
        } else {
          setDevices([]);
        }
        setIsConnected(true);
      } else {
        setDevices([
          {
            id: 'ESP32_POND_01',
            name: 'Node ESP32_POND_01',
            location: 'BonBon',
            color: '#22c55e',
            metrics: { ph: 7.33, temperature: 24.1, turbidity: 0, battery: 85, predictedDo: 5.25 }
          }
        ]);
      }
    } catch (err) {
      console.warn("Could not reach backend devices endpoint, using offline fallback:", err);
      setIsConnected(false);
      setDevices([
        {
          id: 'ESP32_POND_01',
          name: 'Node ESP32_POND_01',
          location: 'BonBon',
          color: '#22c55e',
          metrics: { ph: 7.33, temperature: 24.1, turbidity: 0, battery: 85, predictedDo: 5.25 }
        }
      ]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const fetchBackendData = useCallback(async () => {
    const currentDevices = devicesRef.current;
    if (currentDevices.length === 0) return;

    try {
      let currentPrediction = 5.25;
      try {
        const predRes = await fetch(`${API_BASE_URL}/predict`);
        if (predRes.ok) {
          const predData = await predRes.json();
          if (predData.predicted_do !== undefined) {
            currentPrediction = typeof predData.predicted_do === 'number'
              ? predData.predicted_do
              : parseFloat(predData.predicted_do);
            setSparklineData((prev) => [...prev.slice(1), currentPrediction]);
          }
        }
      } catch (err) {
        setSparklineData((prev) => {
          const next = [...prev.slice(1)];
          const variance = (Math.random() * 0.4 - 0.2);
          const updatedVal = Math.max(2.0, Math.min(8.5, parseFloat((prev[prev.length - 1] + variance).toFixed(2))));
          return [...next, updatedVal];
        });
      }

      const updatedDevices = await Promise.all(
        currentDevices.map(async (device) => {
          try {
            const telRes = await fetch(`${API_BASE_URL}/telemetry/latest?device_id=${device.id}`);
            if (telRes.ok) {
              const telData = await telRes.json();
              setIsConnected(true);
              return {
                ...device,
                metrics: {
                  ...device.metrics,
                  ph: telData.ph ?? device.metrics.ph,
                  temperature: telData.temperature ?? device.metrics.temperature,
                  turbidity: telData.turbidity ?? device.metrics.turbidity,
                  predictedDo: telData.predicted_do ?? currentPrediction
                }
              };
            }
          } catch (e) {}
          return device;
        })
      );
      setDevices(updatedDevices);
    } catch (globalErr) {
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    if (devices.length > 0) {
      fetchBackendData();
      const dataTicker = setInterval(fetchBackendData, 4000);
      return () => clearInterval(dataTicker);
    }
  }, [devices.length, fetchBackendData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDevices();
  };

  const handleDeviceClick = (device: FloaterDevice) => {
    setSelectedDevice(device);
    setCurrentScreen('components');
  };

  const handleSelectDeviceFromAlert = (deviceId: string | number) => {
    const target = devices.find((d) => d.id === deviceId);
    if (target) {
      setSelectedDevice(target);
      setCurrentScreen('components');
    }
  };

  const typedUser = user as any;
  const farmerName = typedUser?.name || 'John Rey Nillama';

  return (
    <View style={styles.screenRootContainer}>
      <StatusBar barStyle="light-content" />
      
      {/* TOP EDGE SAFE AREA BACKGROUND FILLER */}
      <View style={styles.topStatusBarFiller} />

      {/* CONSISTENT GLOBAL BRANDING HEADER */}
      <View style={styles.brandingHeader}>
        <View style={styles.headerLeftBlock}>
          <View>
            <View style={styles.brandTitleRow}>
              <Text style={styles.brandTitleText}>AquaSense</Text>
              <View style={[styles.onlineBadge, !isConnected && styles.offlineBadge]}>
                <View style={[styles.onlinePulseDot, !isConnected && styles.offlinePulseDot]} />
                <Text style={[styles.onlineBadgeText, !isConnected && styles.offlineBadgeText]}>
                  {isConnected ? 'ONLINE' : 'OFFLINE'}
                </Text>
              </View>
            </View>
            <Text style={styles.brandSubtitleText}>
              {selectedDevice
                ? `node: ${selectedDevice.name}`
                : `welcome back, ${farmerName}`}
            </Text>
          </View>
        </View>

        {/* Action Tray (Notification Bell Only) */}
        <View style={styles.headerActionTray}>
          <TouchableOpacity
            style={styles.actionIconBtn}
            onPress={() => setCurrentScreen('alert')}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Bell size={18} color="#94a3b8" />
            <View style={styles.activeNotificationAlertDot} />
          </TouchableOpacity>
        </View>
      </View>

      {/* CORE DISPLAY STAGE */}
      <View style={styles.mainStageWrapper}>
        {currentScreen === 'alert' ? (
          <AlertScreen devices={devices} onSelectAlertDevice={handleSelectDeviceFromAlert} />
        ) : currentScreen === 'profile' ? (
          <ProfileScreen onLogout={logout} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.mainContentScrollBody}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#0284c7" />
            }
          >
            {currentScreen === 'home' && (
              <View>
                <View style={styles.summaryBar}>
                  <View style={styles.summaryItem}>
                    {isConnected ? <Wifi size={14} color="#16a34a" /> : <WifiOff size={14} color="#ef4444" />}
                    <Text style={styles.summaryItemText}>{devices.length} Active Nodes</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <Activity size={14} color="#0284c7" />
                    <Text style={styles.summaryItemText}>Sync 4s</Text>
                  </View>
                </View>

                <Text style={styles.sectionHeaderTitle}>Choose Floater Device</Text>

                {isLoading ? (
                  <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color="#0284c7" />
                    <Text style={styles.loaderText}>Connecting to AquaSense database...</Text>
                  </View>
                ) : devices.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <AlertCircle size={40} color="#f59e0b" />
                    <Text style={styles.emptyTitle}>No ESP32 Device Found</Text>
                    <Text style={styles.emptySub}>Contact the administrator</Text>
                  </View>
                ) : (
                  <View style={styles.deviceSelectionGrid}>
                    {devices.map((device) => {
                      const isWarning = device.metrics.predictedDo <= 4.0;
                      return (
                        <TouchableOpacity
                          key={device.id}
                          onPress={() => handleDeviceClick(device)}
                          style={styles.interactiveDeviceCard}
                          activeOpacity={0.75}
                        >
                          <View style={[styles.cardAccentGlowBar, { backgroundColor: device.color }]} />
                          <View style={styles.deviceCardHeader}>
                            <Text style={styles.deviceCardIndexLabel}>{device.name}</Text>
                            <View style={[styles.statusBadge, isWarning ? styles.warningBadge : styles.normalBadge]}>
                              <Text style={[styles.statusBadgeText, isWarning ? styles.warningBadgeText : styles.normalBadgeText]}>
                                {isWarning ? 'ALERT' : 'OK'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.deviceCardLocationSubtext}>{device.location}</Text>
                          
                          <View style={styles.cardMetricsPreview}>
                            <View>
                              <Text style={styles.metricLabel}>Pred. DO</Text>
                              <Text style={[styles.metricValue, { color: isWarning ? '#ef4444' : '#0f172a' }]}>
                                {typeof device.metrics.predictedDo === 'number'
                                  ? device.metrics.predictedDo.toFixed(1)
                                  : device.metrics.predictedDo}{' '}
                                <Text style={styles.unitText}>mg/L</Text>
                              </Text>
                            </View>
                            <ChevronRight size={18} color="#cbd5e1" />
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {currentScreen === 'components' && selectedDevice && (
              <ComponentsScreen
                selectedDevice={selectedDevice}
                sparklineData={sparklineData}
              />
            )}
          </ScrollView>
        )}
      </View>

      {/* FOOTER TAB BAR DOCK */}
      <View style={styles.footerTabBarDock}>
        <TouchableOpacity
          style={styles.tabBarItemButton}
          onPress={() => { setCurrentScreen('home'); setSelectedDevice(null); }}
          activeOpacity={0.7}
        >
          <View style={[styles.tabIconWrapper, currentScreen === 'home' && styles.activeTabIconWrapper]}>
            <Home size={18} color={currentScreen === 'home' ? '#0284c7' : '#64748b'} />
          </View>
          <Text style={[styles.tabBarItemButtonTextLabel, { color: currentScreen === 'home' ? '#0284c7' : '#64748b' }]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabBarItemButton}
          onPress={() => { if (!selectedDevice && devices.length > 0) setSelectedDevice(devices[0]); setCurrentScreen('components'); }}
          activeOpacity={0.7}
        >
          <View style={[styles.tabIconWrapper, currentScreen === 'components' && styles.activeTabIconWrapper]}>
            <Layers size={18} color={currentScreen === 'components' ? '#0284c7' : '#64748b'} />
          </View>
          <Text style={[styles.tabBarItemButtonTextLabel, { color: currentScreen === 'components' ? '#0284c7' : '#64748b' }]}>Components</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabBarItemButton}
          onPress={() => setCurrentScreen('alert')}
          activeOpacity={0.7}
        >
          <View style={[styles.tabIconWrapper, currentScreen === 'alert' && styles.activeTabIconWrapper]}>
            <AlertCircle size={18} color={currentScreen === 'alert' ? '#0284c7' : '#64748b'} />
          </View>
          <Text style={[styles.tabBarItemButtonTextLabel, { color: currentScreen === 'alert' ? '#0284c7' : '#64748b' }]}>Alert</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabBarItemButton}
          onPress={() => setCurrentScreen('profile')}
          activeOpacity={0.7}
        >
          <View style={[styles.tabIconWrapper, currentScreen === 'profile' && styles.activeTabIconWrapper]}>
            <User size={18} color={currentScreen === 'profile' ? '#0284c7' : '#64748b'} />
          </View>
          <Text style={[styles.tabBarItemButtonTextLabel, { color: currentScreen === 'profile' ? '#0284c7' : '#64748b' }]}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenRootContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  topStatusBarFiller: {
    height: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 24,
    backgroundColor: '#0f172a',
  },
  brandingHeader: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    zIndex: 10,
  },
  mainStageWrapper: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    overflow: 'hidden',
  },
  headerLeftBlock: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandTitleText: { fontSize: 22, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5 },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  offlineBadge: { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
  onlinePulseDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#10b981' },
  offlinePulseDot: { backgroundColor: '#ef4444' },
  onlineBadgeText: { fontSize: 9, fontWeight: '700', color: '#10b981' },
  offlineBadgeText: { color: '#ef4444' },
  brandSubtitleText: { marginTop: 2, fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  headerActionTray: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionIconBtn: {
    backgroundColor: '#1e293b',
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  activeNotificationAlertDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 7,
    height: 7,
    backgroundColor: '#ef4444',
    borderRadius: 3.5,
    borderWidth: 1.5,
    borderColor: '#0f172a',
  },
  mainContentScrollBody: { padding: 18, paddingBottom: 110 },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryItemText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  summaryDivider: { width: 1, height: 14, backgroundColor: '#cbd5e1', marginHorizontal: 16 },
  sectionHeaderTitle: { marginBottom: 14, fontSize: 16, fontWeight: '700', color: '#0f172a', letterSpacing: -0.3 },
  loaderContainer: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loaderText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  emptyContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  emptySub: { fontSize: 14, color: '#f59e0b', textAlign: 'center', fontWeight: '600' },
  deviceSelectionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  interactiveDeviceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    width: (width - 48) / 2,
    position: 'relative',
    overflow: 'hidden',
    padding: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    elevation: 2,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  cardAccentGlowBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  deviceCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  deviceCardIndexLabel: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  normalBadge: { backgroundColor: '#dcfce7' },
  warningBadge: { backgroundColor: '#fee2e2' },
  statusBadgeText: { fontSize: 9, fontWeight: '700' },
  normalBadgeText: { color: '#15803d' },
  warningBadgeText: { color: '#b91c1c' },
  deviceCardLocationSubtext: { fontSize: 11, color: '#64748b', fontWeight: '500', marginTop: 2 },
  cardMetricsPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  metricLabel: { fontSize: 10, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' },
  metricValue: { fontSize: 16, fontWeight: '800', marginTop: 1 },
  unitText: { fontSize: 10, fontWeight: '600', color: '#64748b' },
  footerTabBarDock: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    right: 20,
    height: 64,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    zIndex: 15,
  },
  tabBarItemButton: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  tabIconWrapper: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12, marginBottom: 2 },
  activeTabIconWrapper: { backgroundColor: '#e0f2fe' },
  tabBarItemButtonTextLabel: { fontSize: 10, fontWeight: '600' },
});