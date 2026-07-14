import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions, 
  SafeAreaView, 
  StatusBar 
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { useRouter } from 'expo-router'; 
import {
  Droplet,
  Thermometer,
  Eye,
  AlertTriangle,
  Battery,
  Bell,
  Home,
  Layers,
  AlertCircle,
  User,
  ChevronLeft,
  TrendingUp,
  LogOut 
} from 'lucide-react-native';

// 1. IMPORT THE AUTH CONTEXT HOOK FROM YOUR ROOT LAYOUT
// Note: Adjust the relative import path depending on your file structure 
// (e.g., '../../_layout' if this file is nested inside app/(tabs)/index.tsx)
import { useAuth } from "../_layout";

interface FloaterDevice {
  id: number;
  name: string;
  location: string;
  color: string;
  metrics: {
    ph: number;
    temperature: number;
    turbidity: number;
    battery: number;
    predictedDo: number;
  };
}

const { width } = Dimensions.get('window');

export default function MobileDashboard() {
  const router = useRouter(); 
  
  // 2. CONSUME THE LOGOUT FUNCTION FROM YOUR AUTHENTICATION CONTEXT
  const { logout } = useAuth();

  const [currentScreen, setCurrentScreen] = useState<'home' | 'components' | 'alert' | 'profile'>('home');
  const [selectedDevice, setSelectedDevice] = useState<FloaterDevice | null>(null);
  const [sparklineData, setSparklineData] = useState<number[]>([6.2, 6.5, 6.1, 6.4, 6.3, 6.0, 6.4]);

  const [devices, setDevices] = useState<FloaterDevice[]>([
    { id: 1, name: 'Floater 1', location: 'Pond A Alpha', color: '#ff5c5c', metrics: { ph: 7.35, temperature: 28.2, turbidity: 14.1, battery: 85, predictedDo: 6.4 } },
    { id: 2, name: 'Floater 2', location: 'Pond A Beta', color: '#00c853', metrics: { ph: 6.90, temperature: 27.5, turbidity: 11.2, battery: 92, predictedDo: 6.8 } },
    { id: 3, name: 'Floater 3', location: 'Pond B North', color: '#2196f3', metrics: { ph: 7.45, temperature: 29.1, turbidity: 18.4, battery: 64, predictedDo: 5.9 } },
    { id: 4, name: 'Floater 4', location: 'Pond C South', color: '#ff9800', metrics: { ph: 7.10, temperature: 26.8, turbidity: 13.0, battery: 50, predictedDo: 2.4 } }, 
    { id: 5, name: 'Floater 5', location: 'Pond B East', color: '#a855f7', metrics: { ph: 7.25, temperature: 27.9, turbidity: 12.5, battery: 73, predictedDo: 6.1 } },
    { id: 6, name: 'Floater 6', location: 'Pond C West', color: '#ec4899', metrics: { ph: 7.02, temperature: 28.4, turbidity: 15.2, battery: 88, predictedDo: 6.7 } }
  ]);

  useEffect(() => {
    const dataTicker = setInterval(() => {
      setSparklineData((prev) => {
        const next = [...prev.slice(1)];
        const variance = (Math.random() * 0.6 - 0.3);
        const updatedVal = Math.max(2.0, Math.min(8.5, parseFloat((prev[prev.length - 1] + variance).toFixed(2))));
        return [...next, updatedVal];
      });

      setDevices((prevDevices) =>
        prevDevices.map((d) => ({
          ...d,
          metrics: {
            ...d.metrics,
            ph: parseFloat((d.metrics.ph + (Math.random() * 0.04 - 0.02)).toFixed(2)),
            temperature: parseFloat((d.metrics.temperature + (Math.random() * 0.1 - 0.05)).toFixed(1)),
            turbidity: parseFloat((d.metrics.turbidity + (Math.random() * 0.2 - 0.1)).toFixed(1)),
            battery: Math.max(0, d.metrics.battery - (Math.random() > 0.98 ? 1 : 0))
          }
        }))
      );
    }, 2000);

    return () => clearInterval(dataTicker);
  }, []);

  useEffect(() => {
    if (selectedDevice) {
      const liveUpdate = devices.find((d) => d.id === selectedDevice.id);
      if (liveUpdate) setSelectedDevice(liveUpdate);
    }
  }, [devices, selectedDevice]);

  const handleDeviceClick = (device: FloaterDevice) => {
    setSelectedDevice(device);
    setCurrentScreen('components');
  };

  // 3. UPDATED LOGOUT METHOD TO SAFELY ALTER ROOT STATE
  const handleLogout = () => {
    // Toggles layout auth condition to false. 
    // The route guard in _layout.tsx will instantly take care of kicking the user back out to /login.
    logout(); 
  };

  const isLowDo = selectedDevice && selectedDevice.metrics.predictedDo <= 4.0;

  const getPointsStr = () => {
    return sparklineData.map((val, idx) => `${(idx * 45) + 10},${50 - ((val - 2) * 8)}`).join(' ');
  };

  return (
    <SafeAreaView style={styles.phoneWrapperFrame}>
      <StatusBar barStyle="light-content" />
      
      {/* GLOBAL BRANDING HEADER */}
      <View style={styles.brandingHeader}>
        <View style={styles.headerLeftBlock}>
          {currentScreen === 'components' && (
            <TouchableOpacity style={styles.backArrowBtn} onPress={() => { setCurrentScreen('home'); setSelectedDevice(null); }}>
              <ChevronLeft size={20} color="#ffffff" />
            </TouchableOpacity>
          )}
          <View>
            <Text style={styles.brandTitleText}>AquaSense</Text>
            <Text style={styles.brandSubtitleText}>
              {selectedDevice ? `node: ${selectedDevice.name}` : 'welcome back, user'}
            </Text>
          </View>
        </View>

        {/* Action Tray Container containing Notifications and Logout */}
        <View style={styles.headerActionTray}>
          <TouchableOpacity style={styles.notificationAnchor} activeOpacity={0.7}>
            <Bell size={20} color="#ffffff" />
            <View style={styles.activeNotificationAlertDot} />
          </TouchableOpacity>
          
          {/* THE LOGOUT TOUCHABLE BUTTON TRIGGER */}
          <TouchableOpacity style={styles.logoutActionBtn} onPress={handleLogout} activeOpacity={0.7}>
            <LogOut size={20} color="#ff5c5c" />
          </TouchableOpacity>
        </View>
      </View>

      {/* CORE DISPLAY STAGE */}
      <ScrollView contentContainerStyle={styles.mainContentScrollBody}>
        
        {/* SCREEN 1: CHOOSE FLOATER GRID INDEX */}
        {currentScreen === 'home' && (
          <View>
            <Text style={styles.sectionHeaderTitle}>Choose Floater Device</Text>
            <View style={styles.deviceSelectionGrid}>
              {devices.map((device) => (
                <TouchableOpacity 
                  key={device.id} 
                  onPress={() => handleDeviceClick(device)} 
                  style={styles.interactiveDeviceCard}
                  activeOpacity={0.8}
                >
                  <View style={[styles.cardAccentGlowBar, { backgroundColor: device.color }]} />
                  <View style={styles.deviceCardMetaWrapper}>
                    <Text style={styles.deviceCardIndexLabel}>{device.name}</Text>
                    <Text style={styles.deviceCardLocationSubtext}>{device.location}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* SCREEN 2 & 3: COMPONENT ANALYSIS PANELS */}
        {currentScreen === 'components' && selectedDevice && (
          <View style={{ gap: 16 }}>
            
            {/* THRESHOLD EXCEPTION ALARM BANNER */}
            {isLowDo && (
              <View style={styles.alertWarningBanner}>
                <AlertTriangle size={18} color="#b91c1c" style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertBannerHeadline}>ALERT!!!</Text>
                  <Text style={styles.alertBannerBodyCopy}>Predicted DO level reached minimum Threshold!</Text>
                </View>
              </View>
            )}

            {/* PREDICTED DISSOLVED OXYGEN HERO PLATE */}
            <View style={styles.heroPredictionCard}>
              <Text style={styles.predictionCardLabel}>Predicted Dissolved Oxygen</Text>
              <Text style={styles.predictionCardPrimaryValue}>
                {selectedDevice.metrics.predictedDo} <Text style={{ fontSize: 16, fontWeight: '500' }}>mg/L</Text>
              </Text>
              <View style={styles.statusBadgeRow}>
                <Text style={styles.statusLabelTitle}>Status: </Text>
                <Text style={[styles.statusFlagText, { color: isLowDo ? '#ef4444' : '#00c853' }]}>
                  {isLowDo ? 'Warning' : 'Normal'}
                </Text>
              </View>
            </View>

            <Text style={[styles.sectionHeaderTitle, { marginBottom: 4 }]}>Components</Text>

            {/* COMPLEX GRID METRICS LAYOUT */}
            <View style={styles.bentoMetricsLayoutStructure}>
              <View style={styles.metricLeftVerticalStackColumn}>
                
                {/* TEMPERATURE CARD */}
                <View style={styles.bentoMiniBrickCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Thermometer size={16} color="#0284c7" />
                    <Text style={styles.brickLabelTitleText}>Temp</Text>
                  </View>
                  <Text style={[styles.brickPrimaryValueText, { color: '#e11d48' }]}>
                    {selectedDevice.metrics.temperature} <Text style={{ fontSize: 12 }}>°C</Text>
                  </Text>
                </View>

                {/* TURBIDITY CARD */}
                <View style={styles.bentoMiniBrickCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Eye size={16} color="#ca8a04" />
                    <Text style={styles.brickLabelTitleText}>Turbidity</Text>
                  </View>
                  <Text style={[styles.brickPrimaryValueText, { color: '#ca8a04' }]}>
                    {selectedDevice.metrics.turbidity} <Text style={{ fontSize: 12 }}>NTU</Text>
                  </Text>
                </View>

                {/* pH CARD */}
                <View style={styles.bentoMiniBrickCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Droplet size={16} color="#16a34a" />
                    <Text style={styles.brickLabelTitleText}>pH</Text>
                  </View>
                  <Text style={[styles.brickPrimaryValueText, { color: '#ec4899' }]}>
                    {selectedDevice.metrics.ph}
                  </Text>
                </View>
              </View>

              {/* BATTERY LARGE EXPANDED CARD */}
              <View style={styles.bentoRightExpandedColumnCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <Battery size={18} color={selectedDevice.metrics.battery <= 50 ? '#f97316' : '#16a34a'} />
                  <Text style={styles.brickLabelTitleText}>Battery</Text>
                </View>
                <View style={styles.batteryCellMeterOuterContainer}>
                  <View style={[ 
                    styles.batteryCellMeterInnerFillProgress, 
                    { 
                      height: `${selectedDevice.metrics.battery}%`,
                      backgroundColor: selectedDevice.metrics.battery <= 50 ? 'rgba(249,115,22,0.2)' : 'rgba(22,197,94,0.15)',
                      borderTopWidth: 2,
                      borderTopColor: selectedDevice.metrics.battery <= 50 ? '#f97316' : '#22c55e'
                    }
                  ]} />
                  <Text style={[styles.batteryPercentageDisplayValueText, { color: selectedDevice.metrics.battery <= 50 ? '#f97316' : '#16a34a' }]}>
                    {selectedDevice.metrics.battery}%
                  </Text>
                </View>
              </View>
            </View>

            {/* REAL-TIME SPARKLINES INLINE BLOCK */}
            <View style={styles.miniCryptoAnalyticsPanelBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <TrendingUp size={14} color="#0284c7" />
                  <Text style={styles.cryptoChartLabelTextTitle}>Node Telemetry Sparkline</Text>
                </View>
                <Text style={styles.livePulseStatusLabel}>● Live Vector</Text>
              </View>
              <View style={styles.svgSparklineContainerCanvas}>
                <Svg height="100%" width="100%" viewBox="0 0 300 60">
                  <Polyline
                    points={getPointsStr()}
                    fill="none"
                    stroke={selectedDevice.color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
            </View>

          </View>
        )}

        {/* SYSTEM PLACEHOLDER FALLBACK TEMPLATES */}
        {(currentScreen === 'alert' || currentScreen === 'profile') && (
          <View style={styles.placeholderEmptyStateStageView}>
            <AlertCircle size={36} color="#94a3b8" />
            <Text style={{ marginTop: 8, color: '#64748b', fontSize: 14 }}>
              System panel under construction.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* FOOTER TAB BAR DOCK */}
      <View style={styles.footerTabBarDock}>
        <TouchableOpacity style={styles.tabBarItemButton} onPress={() => { setCurrentScreen('home'); setSelectedDevice(null); }}>
          <Home size={20} color={currentScreen === 'home' ? '#0284c7' : '#64748b'} />
          <Text style={[styles.tabBarItemButtonTextLabel, { color: currentScreen === 'home' ? '#0284c7' : '#64748b' }]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabBarItemButton} onPress={() => { if (!selectedDevice) setSelectedDevice(devices[0]); setCurrentScreen('components'); }}>
          <Layers size={20} color={currentScreen === 'components' ? '#0284c7' : '#64748b'} />
          <Text style={[styles.tabBarItemButtonTextLabel, { color: currentScreen === 'components' ? '#0284c7' : '#64748b' }]}>Components</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabBarItemButton} onPress={() => setCurrentScreen('alert')}>
          <AlertCircle size={20} color={currentScreen === 'alert' ? '#0284c7' : '#64748b'} />
          <Text style={[styles.tabBarItemButtonTextLabel, { color: currentScreen === 'alert' ? '#0284c7' : '#64748b' }]}>Alert</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabBarItemButton} onPress={() => setCurrentScreen('profile')}>
          <User size={20} color={currentScreen === 'profile' ? '#0284c7' : '#64748b'} />
          <Text style={[styles.tabBarItemButtonTextLabel, { color: currentScreen === 'profile' ? '#0284c7' : '#64748b' }]}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  phoneWrapperFrame: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  brandingHeader: {
    backgroundColor: '#111827',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 8,
    shadowColor: '#1e1b4b',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    zIndex: 10
  },
  headerLeftBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  headerActionTray: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  backArrowBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitleText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5
  },
  brandSubtitleText: {
    marginTop: 2,
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500'
  },
  notificationAnchor: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutActionBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: 6,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeNotificationAlertDot: {
    position: 'absolute',
    top: -2,
    right: -1,
    width: 8,
    height: 8,
    backgroundColor: '#ef4444',
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#1e1b4b'
  },
  mainContentScrollBody: {
    padding: 20,
    paddingBottom: 110,
  },
  sectionHeaderTitle: {
    marginBottom: 16,
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  deviceSelectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 14
  },
  interactiveDeviceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    height: 110,
    width: (width - 54) / 2, 
    position: 'relative',
    overflow: 'hidden',
    padding: 16,
    justifyContent: 'flex-end',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
  },
  cardAccentGlowBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6
  },
  deviceCardMetaWrapper: {
    flexDirection: 'column'
  },
  deviceCardIndexLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2
  },
  deviceCardLocationSubtext: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500'
  },
  alertWarningBanner: {
    flexDirection: 'row',
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 14,
    padding: 12,
  },
  alertBannerHeadline: {
    marginBottom: 2,
    fontSize: 13,
    fontWeight: '800',
    color: '#b91c1c',
  },
  alertBannerBodyCopy: {
    fontSize: 11,
    fontWeight: '600',
    color: '#b91c1c',
    lineHeight: 14
  },
  heroPredictionCard: {
    backgroundColor: '#1d4ed8',
    borderRadius: 20,
    padding: 22,
    elevation: 6,
    shadowColor: '#1d4ed8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  predictionCardLabel: {
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#e0f2fe',
  },
  predictionCardPrimaryValue: {
    marginBottom: 14,
    fontSize: 36,
    fontWeight: '800',
    color: '#ffffff',
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    alignSelf: 'flex-start'
  },
  statusLabelTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  statusFlagText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  bentoMetricsLayoutStructure: {
    flexDirection: 'row',
    gap: 14,
    width: '100%'
  },
  metricLeftVerticalStackColumn: {
    flex: 1.1,
    gap: 12
  },
  bentoMiniBrickCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
  },
  brickLabelTitleText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600'
  },
  brickPrimaryValueText: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: '800'
  },
  bentoRightExpandedColumnCard: {
    flex: 0.9,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
  },
  batteryCellMeterOuterContainer: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120
  },
  batteryCellMeterInnerFillProgress: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  batteryPercentageDisplayValueText: {
    fontSize: 24,
    fontWeight: '800',
  },
  miniCryptoAnalyticsPanelBox: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 14,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cryptoChartLabelTextTitle: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600'
  },
  livePulseStatusLabel: {
    fontSize: 10,
    color: '#00c853',
    fontWeight: '700'
  },
  svgSparklineContainerCanvas: {
    height: 65,
    width: '100%',
    marginTop: 6
  },
  placeholderEmptyStateStageView: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 300,
  },
  footerTabBarDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 74,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 12,
    zIndex: 15
  },
  tabBarItemButton: {
    alignItems: 'center',
    gap: 4,
  },
  tabBarItemButtonTextLabel: {
    fontSize: 10,
    fontWeight: '600'
  }
});