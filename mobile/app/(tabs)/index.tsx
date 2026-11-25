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
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  Bell,
  Home,
  Layers,
  AlertCircle,
  User,
  ChevronRight,
  Activity,
  Wifi,
  WifiOff,
} from 'lucide-react-native';
import { useAuth, UserData } from '../_layout';
import AlertScreen from './AlertScreen';
import ProfileScreen from './Profile';
import ComponentsScreen, { FloaterDevice } from './ComponentsScreen';

const { width } = Dimensions.get('window');
const API_BASE_URL = 'https://aquasense-backend-osmi.onrender.com';
const STORAGE_KEY_MIN_DO = '@aquasense_min_do_threshold';
const STORAGE_KEY_MAX_DO = '@aquasense_max_do_threshold';
const ALERT_COOLDOWN_MS = 60000;

type ScreenTab = 'home' | 'components' | 'alert' | 'profile';

const lastAlertSentTimeMap = new Map<string, number>();

async function triggerThresholdNotification(
  deviceName: string,
  currentDo: number,
  limitType: 'LOW' | 'HIGH',
  thresholdVal: number
) {
  const deviceKey = `${deviceName}_${limitType}`;
  const now = Date.now();
  const lastSent = lastAlertSentTimeMap.get(deviceKey) || 0;

  if (now - lastSent < ALERT_COOLDOWN_MS) {
    return;
  }

  lastAlertSentTimeMap.set(deviceKey, now);

  const title =
    limitType === 'LOW'
      ? `🚨 CRITICAL: Low DO Warning`
      : `⚠️ ALERT: High DO Warning`;

  const body =
    limitType === 'LOW'
      ? `${deviceName} recorded DO at ${currentDo.toFixed(2)} mg/L (Limit: <= ${thresholdVal} mg/L). Aeration required!`
      : `${deviceName} recorded DO at ${currentDo.toFixed(2)} mg/L (Limit: >= ${thresholdVal} mg/L). Check water conditions.`;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      vibrate: [0, 500, 250, 500],
      data: { targetScreen: 'alert' },
    },
    trigger: null,
  });
}

const isOwnedByFarmer = (
  dev: any,
  farmer: UserData | null,
  matchedAccount?: { id?: string; name?: string; email?: string } | null
): boolean => {
  if (!farmer && !matchedAccount) return false;

  const ownerValues = [
    dev?.assignedUserId,
    dev?.assigned_user_id,
    dev?.assigned_user,
    dev?.assignedUserEmail,
    dev?.assigned_user_email,
    dev?.assignedUserName,
    dev?.assigned_user_name,
  ]
    .filter(Boolean)
    .map((v) => String(v).trim().toLowerCase());

  if (ownerValues.length === 0) return false;

  const farmerAny = (farmer || {}) as any;
  const candidateIds = [
    farmerAny.id,
    farmerAny._id,
    farmer?.email,
    farmerAny.username,
    farmer?.name,
    matchedAccount?.id,
    matchedAccount?.email,
    matchedAccount?.name,
  ]
    .filter(Boolean)
    .map((v) => String(v).trim().toLowerCase());

  return ownerValues.some((owner) => candidateIds.includes(owner));
};

export default function MobileDashboard() {
  const router = useRouter();
  const auth = useAuth();
  const { logout, user } = auth;
  const isLoadingAuth = Boolean((auth as any)?.isLoadingAuth);

  const [currentScreen, setCurrentScreen] = useState<ScreenTab>('home');
  const [selectedDevice, setSelectedDevice] = useState<FloaterDevice | null>(null);
  const [sparklineData, setSparklineData] = useState<number[]>([
    6.2, 6.5, 6.1, 6.4, 6.3, 6.0, 6.4,
  ]);
  const [devices, setDevices] = useState<FloaterDevice[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(true);

  const hasRedirectedRef = useRef<boolean>(false);
  const consecutiveFetchFailuresRef = useRef<number>(0);
  const activeUserRef = useRef<UserData | null>(user);
  const stageOpacity = useRef(new Animated.Value(1)).current;
  const stageTranslateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    activeUserRef.current = user;
  }, [user]);

  const devicesRef = useRef<FloaterDevice[]>([]);
  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  useEffect(() => {
    async function setupNotifications() {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Notification permissions not granted');
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('do-threshold-alerts', {
          name: 'Dissolved Oxygen Alerts',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 500, 250, 500],
          sound: 'default',
        });
      }
    }

    setupNotifications();

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const targetScreen = response.notification.request.content.data?.targetScreen;
        if (targetScreen === 'alert') {
          setCurrentScreen('alert');
        }
      }
    );

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (user) {
      hasRedirectedRef.current = false;
      return;
    }
    if (!isLoadingAuth && !user && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      router.replace('/login');
    }
  }, [isLoadingAuth, user, router]);

  const animateToScreen = useCallback(
    (nextScreen: ScreenTab) => {
      if (nextScreen === currentScreen) return;
      Animated.parallel([
        Animated.timing(stageOpacity, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(stageTranslateY, {
          toValue: 8,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setCurrentScreen(nextScreen);
        stageTranslateY.setValue(-8);
        Animated.parallel([
          Animated.timing(stageOpacity, {
            toValue: 1,
            duration: 210,
            useNativeDriver: true,
          }),
          Animated.timing(stageTranslateY, {
            toValue: 0,
            duration: 210,
            useNativeDriver: true,
          }),
        ]).start();
      });
    },
    [currentScreen, stageOpacity, stageTranslateY]
  );

  const sendPresenceHeartbeat = useCallback(
    async (isOnline = true, targetUser: UserData | null = activeUserRef.current) => {
      if (!targetUser) return;
      const payload = {
        id: (targetUser as any)?.id,
        email: targetUser.email,
        name: targetUser.name || (targetUser as any)?.username,
        online: isOnline,
        is_online: isOnline,
      };
      try {
        await fetch(`${API_BASE_URL}/api/accounts/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!isOnline) {
          await fetch(`${API_BASE_URL}/api/accounts/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }).catch(() => null);
        }
      } catch {
        // Optional endpoint; ignore if backend does not implement /heartbeat
      }
    },
    []
  );

  const handleMobileLogout = useCallback(async () => {
    const currentFarmer = activeUserRef.current;
    setIsConnected(false);
    setDevices([]);
    setSelectedDevice(null);
    setCurrentScreen('home');
    await sendPresenceHeartbeat(false, currentFarmer);
    logout();
    router.replace('/login');
  }, [logout, router, sendPresenceHeartbeat]);

  const fetchFarmerDevices = useCallback(async () => {
    if (!user) return;
    try {
      const [devRes, accRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/devices`, {
          headers: { 'Content-Type': 'application/json' },
        }),
        fetch(`${API_BASE_URL}/api/accounts`, {
          headers: { 'Content-Type': 'application/json' },
        }).catch(() => null),
      ]);

      if (!devRes.ok) {
        consecutiveFetchFailuresRef.current += 1;
        if (consecutiveFetchFailuresRef.current >= 2) {
          setIsConnected(false);
        }
        return;
      }

      const rawDevices = await devRes.json();
      const list = Array.isArray(rawDevices) ? rawDevices : [];

      let matchedAccount: { id?: string; name?: string; email?: string } | null = null;
      if (accRes && accRes.ok) {
        const rawAccounts = await accRes.json();
        const accountsList = Array.isArray(rawAccounts) ? rawAccounts : [];
        const userEmail = String(user.email || '').trim().toLowerCase();
        const userName = String(user.name || (user as any)?.username || '')
          .trim()
          .toLowerCase();
        const userId = String((user as any)?.id || '').trim().toLowerCase();

        matchedAccount =
          accountsList.find((acc: any) => {
            const accId = String(acc?.id || '').trim().toLowerCase();
            const accEmail = String(acc?.email || '').trim().toLowerCase();
            const accName = String(acc?.name || '').trim().toLowerCase();
            return (
              (userId && accId === userId) ||
              (userEmail && accEmail === userEmail) ||
              (userName && accName === userName)
            );
          }) || null;
      }

      const owned = list.filter((dev) =>
        isOwnedByFarmer(dev, user, matchedAccount)
      );

      const formattedDevices: FloaterDevice[] = owned.map((dev: any, idx: number) => {
        const devId = String(dev.device_id || dev.id || `NODE_${idx + 1}`);
        const statusStr: 'Online' | 'Offline' =
          String(dev.status || 'Offline').toLowerCase() === 'online'
            ? 'Online'
            : 'Offline';

        return {
          id: String(dev.id || devId),
          device_id: devId,
          name: String(dev.name || `Node ${devId}`),
          location: String(dev.location || 'Unassigned Field Station'),
          color: statusStr === 'Online' ? '#0284c7' : '#ef4444',
          status: statusStr,
          assignedUserId: dev.assignedUserId ?? dev.assigned_user_id ?? null,
          assignedUserName: dev.assignedUserName ?? dev.assigned_user_name ?? null,
          metrics: {
            ph: Number(dev.metrics?.ph ?? 7.33),
            temperature: Number(dev.metrics?.temperature ?? 24.1),
            turbidity: Number(dev.metrics?.turbidity ?? 0),
            battery: Number(dev.metrics?.battery ?? 85),
            predictedDo: Number(
              dev.metrics?.predictedDo ?? dev.metrics?.predicted_do ?? 5.25
            ),
          },
        };
      });

      consecutiveFetchFailuresRef.current = 0;
      setDevices(formattedDevices);
      setIsConnected(true);
    } catch (err) {
      console.warn('Failed to fetch farmer devices:', err);
      consecutiveFetchFailuresRef.current += 1;
      if (consecutiveFetchFailuresRef.current >= 2) {
        setIsConnected(false);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  const fetchOnlineTelemetry = useCallback(async () => {
    const currentDevices = devicesRef.current;
    const onlineDevices = currentDevices.filter(
      (d) => String(d.status || '').toLowerCase() === 'online'
    );
    if (onlineDevices.length === 0) return;

    try {
      let latestPred = 5.25;
      try {
        const predRes = await fetch(`${API_BASE_URL}/predict`);
        if (predRes.ok) {
          const predData = await predRes.json();
          if (predData.predicted_do !== undefined) {
            latestPred = parseFloat(String(predData.predicted_do)) || latestPred;
            setSparklineData((prev) => [...prev.slice(1), latestPred]);
          }
        }
      } catch {
        // Keep previous sparkline if prediction endpoint is busy
      }

      const updatesById = new Map<string, Partial<FloaterDevice['metrics']>>();
      await Promise.all(
        onlineDevices.map(async (device) => {
          const queryId = encodeURIComponent(device.device_id || String(device.id));
          try {
            const telRes = await fetch(
              `${API_BASE_URL}/telemetry/latest?device_id=${queryId}`
            );
            if (telRes.ok) {
              const telData = await telRes.json();
              updatesById.set(String(device.id), {
                ph: Number(telData.ph ?? device.metrics.ph),
                temperature: Number(telData.temperature ?? device.metrics.temperature),
                turbidity: Number(telData.turbidity ?? device.metrics.turbidity),
                predictedDo: Number(
                  telData.predicted_do ?? telData.predictedDO ?? latestPred
                ),
              });
            }
          } catch {
            // Keep existing metrics for this device
          }
        })
      );

      if (updatesById.size > 0) {
        setDevices((prev) =>
          prev.map((dev) => {
            const patch = updatesById.get(String(dev.id));
            if (!patch) return dev;
            return {
              ...dev,
              metrics: {
                ...dev.metrics,
                ...patch,
              },
            };
          })
        );
      }
    } catch {
      // Ignore transient poll errors
    }
  }, []);

  useEffect(() => {
    const checkThresholdAlerts = async () => {
      try {
        const savedMin = parseFloat(
          (await AsyncStorage.getItem(STORAGE_KEY_MIN_DO)) || '4.0'
        );
        const savedMax = parseFloat(
          (await AsyncStorage.getItem(STORAGE_KEY_MAX_DO)) || '10.0'
        );

        devices.forEach((dev) => {
          if (String(dev.status || '').toLowerCase() === 'offline') return;

          const currentDo = dev.metrics?.predictedDo;
          if (typeof currentDo !== 'number') return;

          if (currentDo <= savedMin) {
            triggerThresholdNotification(dev.name, currentDo, 'LOW', savedMin);
          } else if (currentDo >= savedMax) {
            triggerThresholdNotification(dev.name, currentDo, 'HIGH', savedMax);
          }
        });
      } catch (err) {
        console.warn('Failed checking threshold alerts:', err);
      }
    };

    if (devices.length > 0) {
      checkThresholdAlerts();
    }
  }, [devices]);

  useEffect(() => {
    if (!user) {
      setIsConnected(false);
      return;
    }

    setIsLoading(true);
    sendPresenceHeartbeat(true, user);
    fetchFarmerDevices();

    const heartbeatTimer = setInterval(() => {
      sendPresenceHeartbeat(true, user);
    }, 15000);

    return () => clearInterval(heartbeatTimer);
  }, [user, fetchFarmerDevices, sendPresenceHeartbeat]);

  useEffect(() => {
    if (devices.length > 0) {
      fetchOnlineTelemetry();
      const timer = setInterval(fetchOnlineTelemetry, 4000);
      return () => clearInterval(timer);
    }
  }, [devices.length, fetchOnlineTelemetry]);

  useEffect(() => {
    if (selectedDevice) {
      const refreshed = devices.find(
        (d) => String(d.id) === String(selectedDevice.id)
      );
      if (refreshed) {
        setSelectedDevice(refreshed);
      }
    }
  }, [devices, selectedDevice]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    sendPresenceHeartbeat(true, user);
    fetchFarmerDevices();
  };

  const handleDeviceClick = (device: FloaterDevice) => {
    setSelectedDevice(device);
    animateToScreen('components');
  };

  const handleSelectDeviceFromAlert = (deviceId: string | number) => {
    const target = devices.find(
      (d) =>
        String(d.id) === String(deviceId) || String(d.device_id) === String(deviceId)
    );
    if (target) {
      setSelectedDevice(target);
      animateToScreen('components');
    }
  };

  if (isLoadingAuth) {
    return (
      <View style={styles.authGateLoader}>
        <ActivityIndicator size="large" color="#0284c7" />
        <Text style={styles.loaderText}>Verifying farmer session...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.authGateLoader}>
        <ActivityIndicator size="large" color="#0284c7" />
        <Text style={styles.loaderText}>Redirecting to sign in...</Text>
        <TouchableOpacity
          style={styles.goLoginBtn}
          onPress={() => router.replace('/login')}
          activeOpacity={0.85}
        >
          <Text style={styles.goLoginBtnText}>Go to Farmer Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const farmerName = user?.name || (user as any)?.username || 'Farmer';
  const onlineCount = devices.filter(
    (d) => String(d.status || '').toLowerCase() === 'online'
  ).length;

  return (
    <View style={styles.screenRootContainer}>
      <StatusBar barStyle="light-content" />
      <View style={styles.topStatusBarFiller} />

      <View style={styles.brandingHeader}>
        <View style={styles.headerLeftBlock}>
          <View>
            <View style={styles.brandTitleRow}>
              <Text style={styles.brandTitleText}>AquaSense</Text>
              <View style={[styles.onlineBadge, !isConnected && styles.offlineBadge]}>
                <View
                  style={[
                    styles.onlinePulseDot,
                    !isConnected && styles.offlinePulseDot,
                  ]}
                />
                <Text
                  style={[
                    styles.onlineBadgeText,
                    !isConnected && styles.offlineBadgeText,
                  ]}
                >
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

        <View style={styles.headerActionTray}>
          <TouchableOpacity
            style={styles.actionIconBtn}
            onPress={() => animateToScreen('alert')}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Bell size={18} color="#94a3b8" />
            <View style={styles.activeNotificationAlertDot} />
          </TouchableOpacity>
        </View>
      </View>

      <Animated.View
        style={[
          styles.mainStageWrapper,
          {
            opacity: stageOpacity,
            transform: [{ translateY: stageTranslateY }],
          },
        ]}
      >
        {currentScreen === 'alert' ? (
          <AlertScreen
            devices={devices}
            onSelectAlertDevice={handleSelectDeviceFromAlert}
          />
        ) : currentScreen === 'profile' ? (
          <ProfileScreen onLogout={handleMobileLogout} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.mainContentScrollBody}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor="#0284c7"
              />
            }
          >
            {currentScreen === 'home' && (
              <View>
                <View style={styles.summaryBar}>
                  <View style={styles.summaryItem}>
                    {isConnected ? (
                      <Wifi size={14} color="#0284c7" />
                    ) : (
                      <WifiOff size={14} color="#ef4444" />
                    )}
                    <Text style={styles.summaryItemText}>
                      {devices.length} Owned ({onlineCount} Online)
                    </Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <Activity size={14} color="#0284c7" />
                    <Text style={styles.summaryItemText}>Sync 4s</Text>
                  </View>
                </View>

                <Text style={styles.sectionHeaderTitle}>Your Floater Devices</Text>

                {isLoading ? (
                  <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color="#0284c7" />
                    <Text style={styles.loaderText}>
                      Loading your assigned nodes...
                    </Text>
                  </View>
                ) : devices.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <AlertCircle size={40} color="#0284c7" />
                    <Text style={styles.emptyTitle}>No Assigned ESP32 Devices</Text>
                    <Text style={styles.emptySub}>
                      No nodes are currently assigned to {farmerName}. Contact your administrator.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.deviceSelectionGrid}>
                    {devices.map((device) => {
                      const isDeviceOnline =
                        String(device.status || '').toLowerCase() === 'online';
                      const isWarning =
                        isDeviceOnline && device.metrics.predictedDo <= 4.0;

                      return (
                        <TouchableOpacity
                          key={device.id}
                          onPress={() => handleDeviceClick(device)}
                          style={styles.interactiveDeviceCard}
                          activeOpacity={0.78}
                        >
                          <View
                            style={[
                              styles.cardAccentGlowBar,
                              {
                                backgroundColor: isDeviceOnline
                                  ? '#0284c7'
                                  : '#ef4444',
                              },
                            ]}
                          />
                          <View style={styles.deviceCardHeader}>
                            <Text style={styles.deviceCardIndexLabel} numberOfLines={1}>
                              {device.name}
                            </Text>
                            <View
                              style={[
                                styles.statusBadge,
                                !isDeviceOnline
                                  ? styles.offlineNodeBadge
                                  : isWarning
                                  ? styles.warningBadge
                                  : styles.onlineNodeBadge,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusBadgeText,
                                  !isDeviceOnline
                                    ? styles.offlineNodeBadgeText
                                    : isWarning
                                    ? styles.warningBadgeText
                                    : styles.onlineNodeBadgeText,
                                ]}
                              >
                                {!isDeviceOnline
                                  ? 'OFFLINE'
                                  : isWarning
                                  ? 'ALERT'
                                  : 'ONLINE'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.deviceCardLocationSubtext} numberOfLines={1}>
                            {device.location}
                          </Text>

                          <View style={styles.cardMetricsPreview}>
                            {isDeviceOnline ? (
                              <View>
                                <Text style={styles.metricLabel}>Pred. DO</Text>
                                <Text
                                  style={[
                                    styles.metricValue,
                                    { color: isWarning ? '#ef4444' : '#0f172a' },
                                  ]}
                                >
                                  {typeof device.metrics.predictedDo === 'number'
                                    ? device.metrics.predictedDo.toFixed(1)
                                    : device.metrics.predictedDo}{' '}
                                  <Text style={styles.unitText}>mg/L</Text>
                                </Text>
                              </View>
                            ) : (
                              <View>
                                <Text style={styles.metricLabel}>Status</Text>
                                <Text style={styles.offlineCardNote}>
                                  No telemetry (Tap to view)
                                </Text>
                              </View>
                            )}
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
      </Animated.View>

      <View style={styles.footerTabBarDock}>
        <TouchableOpacity
          style={styles.tabBarItemButton}
          onPress={() => {
            setSelectedDevice(null);
            animateToScreen('home');
          }}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.tabIconWrapper,
              currentScreen === 'home' && styles.activeTabIconWrapper,
            ]}
          >
            <Home
              size={18}
              color={currentScreen === 'home' ? '#0284c7' : '#64748b'}
            />
          </View>
          <Text
            style={[
              styles.tabBarItemButtonTextLabel,
              { color: currentScreen === 'home' ? '#0284c7' : '#64748b' },
            ]}
          >
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabBarItemButton}
          onPress={() => {
            if (!selectedDevice && devices.length > 0) {
              setSelectedDevice(devices[0]);
            }
            animateToScreen('components');
          }}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.tabIconWrapper,
              currentScreen === 'components' && styles.activeTabIconWrapper,
            ]}
          >
            <Layers
              size={18}
              color={currentScreen === 'components' ? '#0284c7' : '#64748b'}
            />
          </View>
          <Text
            style={[
              styles.tabBarItemButtonTextLabel,
              { color: currentScreen === 'components' ? '#0284c7' : '#64748b' },
            ]}
          >
            Components
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabBarItemButton}
          onPress={() => animateToScreen('alert')}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.tabIconWrapper,
              currentScreen === 'alert' && styles.activeTabIconWrapper,
            ]}
          >
            <AlertCircle
              size={18}
              color={currentScreen === 'alert' ? '#0284c7' : '#64748b'}
            />
          </View>
          <Text
            style={[
              styles.tabBarItemButtonTextLabel,
              { color: currentScreen === 'alert' ? '#0284c7' : '#64748b' },
            ]}
          >
            Alert
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabBarItemButton}
          onPress={() => animateToScreen('profile')}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.tabIconWrapper,
              currentScreen === 'profile' && styles.activeTabIconWrapper,
            ]}
          >
            <User
              size={18}
              color={currentScreen === 'profile' ? '#0284c7' : '#64748b'}
            />
          </View>
          <Text
            style={[
              styles.tabBarItemButtonTextLabel,
              { color: currentScreen === 'profile' ? '#0284c7' : '#64748b' },
            ]}
          >
            Profile
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  authGateLoader: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  goLoginBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  goLoginBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
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
    overflow: 'hidden',
  },
  headerLeftBlock: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandTitleText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  offlineBadge: { backgroundColor: 'rgba(239, 68, 68, 0.18)' },
  onlinePulseDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#38bdf8',
  },
  offlinePulseDot: { backgroundColor: '#ef4444' },
  onlineBadgeText: { fontSize: 9, fontWeight: '700', color: '#38bdf8' },
  offlineBadgeText: { color: '#f87171' },
  brandSubtitleText: {
    marginTop: 2,
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
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
    borderColor: 'rgba(255, 255, 255, 0.06)',
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
  summaryDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 16,
  },
  sectionHeaderTitle: {
    marginBottom: 14,
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  loaderContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loaderText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  emptyContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 32,
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  emptySub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '500',
  },
  deviceSelectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  interactiveDeviceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    width: (width - 48) / 2,
    position: 'relative',
    overflow: 'hidden',
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardAccentGlowBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  deviceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  deviceCardIndexLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  onlineNodeBadge: { backgroundColor: '#e0f2fe' },
  offlineNodeBadge: { backgroundColor: '#fee2e2' },
  warningBadge: { backgroundColor: '#fef3c7' },
  statusBadgeText: { fontSize: 9, fontWeight: '700' },
  onlineNodeBadgeText: { color: '#0284c7' },
  offlineNodeBadgeText: { color: '#b91c1c' },
  warningBadgeText: { color: '#b45309' },
  deviceCardLocationSubtext: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 2,
  },
  cardMetricsPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  metricValue: { fontSize: 16, fontWeight: '800', marginTop: 1 },
  offlineCardNote: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
    marginTop: 2,
  },
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
  tabIconWrapper: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 2,
  },
  activeTabIconWrapper: { backgroundColor: '#e0f2fe' },
  tabBarItemButtonTextLabel: { fontSize: 10, fontWeight: '600' },
});