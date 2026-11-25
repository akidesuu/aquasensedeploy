import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Polyline } from 'react-native-svg';
import {
  Droplet,
  Thermometer,
  Eye,
  Battery,
  TrendingUp,
  Activity,
  ShieldAlert,
  Zap,
  WifiOff,
} from 'lucide-react-native';

export interface FloaterDevice {
  id: string | number;
  device_id?: string;
  name: string;
  location: string;
  color: string;
  status?: 'Online' | 'Offline' | string;
  assignedUserId?: string | number | null;
  assignedUserName?: string | null;
  metrics: {
    ph: number;
    temperature: number;
    turbidity: number;
    battery: number;
    predictedDo: number;
  };
}

interface ComponentsScreenProps {
  selectedDevice: FloaterDevice;
  sparklineData: number[];
}

const STORAGE_KEY_MIN_DO = '@aquasense_min_do_threshold';
const STORAGE_KEY_MAX_DO = '@aquasense_max_do_threshold';

export default function ComponentsScreen({
  selectedDevice,
  sparklineData,
}: ComponentsScreenProps) {
  const [minLimit, setMinLimit] = useState<number>(4.0);
  const [maxLimit, setMaxLimit] = useState<number>(10.0);

  useEffect(() => {
    const loadThresholds = async () => {
      try {
        const savedMin = await AsyncStorage.getItem(STORAGE_KEY_MIN_DO);
        const savedMax = await AsyncStorage.getItem(STORAGE_KEY_MAX_DO);
        if (savedMin !== null) setMinLimit(parseFloat(savedMin));
        if (savedMax !== null) setMaxLimit(parseFloat(savedMax));
      } catch (err) {
        console.warn('Failed to load thresholds in ComponentsScreen:', err);
      }
    };
    loadThresholds();
  }, []);

  const isDeviceOffline =
    String(selectedDevice?.status || '').toLowerCase() === 'offline';

  const metrics = selectedDevice?.metrics || {
    ph: 7.33,
    temperature: 24.1,
    turbidity: 0.0,
    battery: 85,
    predictedDo: 5.25,
  };

  const currentDo = metrics.predictedDo;
  const isBelowMin = !isDeviceOffline && currentDo <= minLimit;
  const isAboveMax = !isDeviceOffline && currentDo >= maxLimit;
  const isOutOfRange = isBelowMin || isAboveMax;

  const getPointsStr = () => {
    if (!sparklineData || sparklineData.length === 0) return '10,30 290,30';
    return sparklineData
      .map((val, idx) => `${idx * 45 + 10},${50 - (val - 2) * 8}`)
      .join(' ');
  };

  return (
    <View style={styles.container}>
      {isDeviceOffline && (
        <View style={styles.offlineBanner}>
          <View style={styles.offlineIconBadge}>
            <WifiOff size={18} color="#dc2626" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.offlineTitle}>NODE OFFLINE</Text>
            <Text style={styles.offlineSub}>
              {selectedDevice.name} is currently offline in the database, but remains listed in your owned devices.
            </Text>
          </View>
        </View>
      )}

      {isOutOfRange && (
        <View style={styles.alertWarningBanner}>
          <View style={styles.alertIconBadge}>
            <ShieldAlert size={20} color="#dc2626" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.alertBannerHeadline}>THRESHOLD BREACH</Text>
              <View style={styles.alertPillBadge}>
                <Text style={styles.alertPillText}>
                  {isBelowMin ? 'LOW DO' : 'HIGH DO'}
                </Text>
              </View>
            </View>
            <Text style={styles.alertBannerBodyCopy}>
              {isBelowMin
                ? `DO level (${currentDo.toFixed(1)} mg/L) is at or below minimum limit (${minLimit} mg/L).`
                : `DO level (${currentDo.toFixed(1)} mg/L) is at or above maximum limit (${maxLimit} mg/L).`}
            </Text>
          </View>
        </View>
      )}

      <View
        style={[
          styles.heroPredictionCard,
          isDeviceOffline
            ? styles.heroPredictionCardOffline
            : isOutOfRange && styles.heroPredictionCardWarning,
        ]}
      >
        <View style={styles.heroBackgroundPattern} />

        <View style={styles.heroHeaderRow}>
          <Text style={styles.predictionCardLabel}>
            PREDICTED DISSOLVED OXYGEN
          </Text>
          <View style={styles.heroLivePill}>
            <Activity size={12} color="#ffffff" />
            <Text style={styles.heroLivePillText}>
              {isDeviceOffline ? 'OFFLINE' : 'ML MODEL'}
            </Text>
          </View>
        </View>

        <Text style={styles.predictionCardPrimaryValue}>
          {isDeviceOffline ? (
            '--'
          ) : (
            <>
              {typeof currentDo === 'number' ? currentDo.toFixed(2) : currentDo}{' '}
              <Text style={styles.heroUnitText}>mg/L</Text>
            </>
          )}
        </Text>

        <View style={styles.statusBadgeRow}>
          <Text style={styles.statusLabelTitle}>Range Limit: </Text>
          <Text style={styles.statusRangeText}>
            {minLimit} - {maxLimit} mg/L
          </Text>
        </View>
      </View>

      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionHeaderTitle}>Node Telemetry Metrics</Text>
        <Text style={styles.sectionHeaderSubtitle}>
          {selectedDevice.name} • {selectedDevice.location} ({selectedDevice.status || 'Offline'})
        </Text>
      </View>

      <View style={styles.bentoMetricsLayoutStructure}>
        <View style={styles.metricLeftVerticalStackColumn}>
          <View style={styles.bentoMiniBrickCard}>
            <View style={styles.brickHeaderRow}>
              <View style={[styles.iconContainer, { backgroundColor: '#fef2f2' }]}>
                <Thermometer size={16} color="#ef4444" />
              </View>
              <Text style={styles.brickLabelTitleText}>Temperature</Text>
            </View>
            <Text style={styles.brickPrimaryValueText}>
              {isDeviceOffline ? (
                '--'
              ) : (
                <>
                  {metrics.temperature} <Text style={styles.brickUnitText}>°C</Text>
                </>
              )}
            </Text>
          </View>

          <View style={styles.bentoMiniBrickCard}>
            <View style={styles.brickHeaderRow}>
              <View style={[styles.iconContainer, { backgroundColor: '#fefce8' }]}>
                <Eye size={16} color="#d97706" />
              </View>
              <Text style={styles.brickLabelTitleText}>Turbidity</Text>
            </View>
            <Text style={styles.brickPrimaryValueText}>
              {isDeviceOffline ? (
                '--'
              ) : (
                <>
                  {metrics.turbidity} <Text style={styles.brickUnitText}>NTU</Text>
                </>
              )}
            </Text>
          </View>

          <View style={styles.bentoMiniBrickCard}>
            <View style={styles.brickHeaderRow}>
              <View style={[styles.iconContainer, { backgroundColor: '#f0fdf4' }]}>
                <Droplet size={16} color="#16a34a" />
              </View>
              <Text style={styles.brickLabelTitleText}>pH Level</Text>
            </View>
            <Text style={styles.brickPrimaryValueText}>
              {isDeviceOffline ? '--' : metrics.ph}
            </Text>
          </View>
        </View>

        <View style={styles.bentoRightExpandedColumnCard}>
          <View style={styles.brickHeaderRow}>
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: isDeviceOffline
                    ? '#f1f5f9'
                    : metrics.battery <= 50
                    ? '#fff7ed'
                    : '#f0fdf4',
                },
              ]}
            >
              <Battery
                size={16}
                color={
                  isDeviceOffline
                    ? '#94a3b8'
                    : metrics.battery <= 50
                    ? '#f97316'
                    : '#16a34a'
                }
              />
            </View>
            <Text style={styles.brickLabelTitleText}>Power Level</Text>
          </View>

          <View style={styles.batteryCellMeterOuterContainer}>
            {!isDeviceOffline && (
              <View
                style={[
                  styles.batteryCellMeterInnerFillProgress,
                  {
                    height: `${metrics.battery}%`,
                    backgroundColor:
                      metrics.battery <= 50
                        ? 'rgba(249, 115, 22, 0.25)'
                        : 'rgba(2, 132, 199, 0.2)',
                    borderTopWidth: 2,
                    borderTopColor:
                      metrics.battery <= 50 ? '#f97316' : '#0284c7',
                  },
                ]}
              />
            )}
            <Zap
              size={18}
              color={
                isDeviceOffline
                  ? '#94a3b8'
                  : metrics.battery <= 50
                  ? '#f97316'
                  : '#0284c7'
              }
              style={{ marginBottom: 4 }}
            />
            <Text
              style={[
                styles.batteryPercentageDisplayValueText,
                {
                  color: isDeviceOffline
                    ? '#64748b'
                    : metrics.battery <= 50
                    ? '#ea580c'
                    : '#0284c7',
                },
              ]}
            >
              {isDeviceOffline ? 'OFF' : `${metrics.battery}%`}
            </Text>
            <Text style={styles.batterySubtext}>Li-Ion Cell</Text>
          </View>
        </View>
      </View>

      <View style={styles.miniCryptoAnalyticsPanelBox}>
        <View style={styles.sparklineHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={styles.sparklineIconWrapper}>
              <TrendingUp size={14} color="#38bdf8" />
            </View>
            <View>
              <Text style={styles.cryptoChartLabelTextTitle}>
                Node Telemetry Vector
              </Text>
              <Text style={styles.sparklineSubtitle}>
                {isDeviceOffline ? 'Awaiting cloud telemetry' : 'Real-time prediction flow'}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.livePulseBadge,
              isDeviceOffline && styles.offlinePulseBadge,
            ]}
          >
            <View
              style={[
                styles.pulseDot,
                isDeviceOffline && styles.offlinePulseDot,
              ]}
            />
            <Text
              style={[
                styles.livePulseStatusLabel,
                isDeviceOffline && styles.offlinePulseText,
              ]}
            >
              {isDeviceOffline ? 'OFFLINE' : 'LIVE'}
            </Text>
          </View>
        </View>
        <View style={styles.svgSparklineContainerCanvas}>
          <Svg height="100%" width="100%" viewBox="0 0 300 60">
            <Polyline
              points={getPointsStr()}
              fill="none"
              stroke={isDeviceOffline ? '#64748b' : '#38bdf8'}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  sectionTitleRow: { marginTop: 4, marginBottom: 4 },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  sectionHeaderSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 2,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  offlineIconBadge: {
    backgroundColor: '#fee2e2',
    padding: 8,
    borderRadius: 12,
  },
  offlineTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#991b1b',
    letterSpacing: 0.5,
  },
  offlineSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#b91c1c',
    marginTop: 2,
    lineHeight: 15,
  },
  alertWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  alertIconBadge: { backgroundColor: '#fee2e2', padding: 8, borderRadius: 12 },
  alertPillBadge: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  alertPillText: { fontSize: 9, fontWeight: '800', color: '#ffffff' },
  alertBannerHeadline: {
    fontSize: 12,
    fontWeight: '800',
    color: '#991b1b',
    letterSpacing: 0.5,
  },
  alertBannerBodyCopy: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: '#b91c1c',
    lineHeight: 15,
  },
  heroPredictionCard: {
    backgroundColor: '#0284c7',
    borderRadius: 24,
    padding: 22,
    position: 'relative',
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  heroPredictionCardOffline: {
    backgroundColor: '#475569',
    shadowColor: '#334155',
  },
  heroPredictionCardWarning: {
    backgroundColor: '#dc2626',
    shadowColor: '#dc2626',
  },
  heroBackgroundPattern: {
    position: 'absolute',
    right: -30,
    top: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  predictionCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 0.8,
  },
  heroLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  heroLivePillText: { fontSize: 9, fontWeight: '800', color: '#ffffff' },
  predictionCardPrimaryValue: {
    marginBottom: 16,
    fontSize: 40,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -1,
  },
  heroUnitText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  statusLabelTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  statusRangeText: { fontSize: 12, fontWeight: '800', color: '#ffffff' },
  bentoMetricsLayoutStructure: { flexDirection: 'row', gap: 12, width: '100%' },
  metricLeftVerticalStackColumn: { flex: 1.1, gap: 10 },
  brickHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoMiniBrickCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  brickLabelTitleText: { fontSize: 11, color: '#64748b', fontWeight: '700' },
  brickPrimaryValueText: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  brickUnitText: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },
  bentoRightExpandedColumnCard: {
    flex: 0.9,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'space-between',
  },
  batteryCellMeterOuterContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  batteryCellMeterInnerFillProgress: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  batteryPercentageDisplayValueText: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  batterySubtext: {
    fontSize: 9,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 2,
  },
  miniCryptoAnalyticsPanelBox: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  sparklineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sparklineIconWrapper: {
    backgroundColor: '#1e293b',
    padding: 6,
    borderRadius: 8,
  },
  cryptoChartLabelTextTitle: {
    fontSize: 12,
    color: '#f8fafc',
    fontWeight: '700',
  },
  sparklineSubtitle: { fontSize: 10, color: '#94a3b8', fontWeight: '500' },
  livePulseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  offlinePulseBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38bdf8',
  },
  offlinePulseDot: { backgroundColor: '#ef4444' },
  livePulseStatusLabel: {
    fontSize: 9,
    color: '#38bdf8',
    fontWeight: '800',
  },
  offlinePulseText: { color: '#f87171' },
  svgSparklineContainerCanvas: { height: 65, width: '100%', marginTop: 6 },
});