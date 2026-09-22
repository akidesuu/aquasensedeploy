import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import {
  Droplet,
  Thermometer,
  Eye,
  AlertTriangle,
  Battery,
  TrendingUp,
  Activity,
  ShieldAlert,
  Zap
} from 'lucide-react-native';

export interface FloaterDevice {
  id: string | number;
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

interface ComponentsScreenProps {
  selectedDevice: FloaterDevice;
  sparklineData: number[];
}

export default function ComponentsScreen({
  selectedDevice,
  sparklineData,
}: ComponentsScreenProps) {
  const isLowDo = selectedDevice.metrics.predictedDo <= 4.0;

  const getPointsStr = () => {
    return sparklineData
      .map((val, idx) => `${idx * 45 + 10},${50 - (val - 2) * 8}`)
      .join(' ');
  };

  return (
    <View style={styles.container}>
      {/* Alert Warning Banner */}
      {isLowDo && (
        <View style={styles.alertWarningBanner}>
          <View style={styles.alertIconBadge}>
            <ShieldAlert size={20} color="#dc2626" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.alertBannerHeadline}>CRITICAL THRESHOLD</Text>
              <View style={styles.alertPillBadge}>
                <Text style={styles.alertPillText}>LOW DO</Text>
              </View>
            </View>
            <Text style={styles.alertBannerBodyCopy}>
              Predicted DO level reached minimum threshold ({selectedDevice.metrics.predictedDo.toFixed(1)} mg/L).
            </Text>
          </View>
        </View>
      )}

      {/* Hero Prediction Card */}
      <View style={[styles.heroPredictionCard, isLowDo && styles.heroPredictionCardWarning]}>
        <View style={styles.heroBackgroundPattern} />
        
        <View style={styles.heroHeaderRow}>
          <Text style={styles.predictionCardLabel}>
            PREDICTED DISSOLVED OXYGEN
          </Text>
          <View style={styles.heroLivePill}>
            <Activity size={12} color="#ffffff" />
            <Text style={styles.heroLivePillText}>ML MODEL</Text>
          </View>
        </View>

        <Text style={styles.predictionCardPrimaryValue}>
          {selectedDevice.metrics.predictedDo}{' '}
          <Text style={{ fontSize: 18, fontWeight: '600', color: 'rgba(255,255,255,0.8)' }}>mg/L</Text>
        </Text>

        <View style={styles.statusBadgeRow}>
          <Text style={styles.statusLabelTitle}>Status: </Text>
          <Text
            style={[
              styles.statusFlagText,
              { color: isLowDo ? '#fca5a5' : '#4ade80' },
            ]}
          >
            {isLowDo ? 'Warning' : 'Optimal'}
          </Text>
        </View>
      </View>

      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionHeaderTitle}>
          Node Telemetry Metrics
        </Text>
        <Text style={styles.sectionHeaderSubtitle}>
          {selectedDevice.name} • {selectedDevice.location}
        </Text>
      </View>

      {/* Bento Grid Metrics */}
      <View style={styles.bentoMetricsLayoutStructure}>
        <View style={styles.metricLeftVerticalStackColumn}>
          {/* Temperature */}
          <View style={styles.bentoMiniBrickCard}>
            <View style={styles.brickHeaderRow}>
              <View style={[styles.iconContainer, { backgroundColor: '#fef2f2' }]}>
                <Thermometer size={16} color="#ef4444" />
              </View>
              <Text style={styles.brickLabelTitleText}>Temperature</Text>
            </View>
            <Text style={[styles.brickPrimaryValueText, { color: '#0f172a' }]}>
              {selectedDevice.metrics.temperature}{' '}
              <Text style={styles.brickUnitText}>°C</Text>
            </Text>
          </View>

          {/* Turbidity */}
          <View style={styles.bentoMiniBrickCard}>
            <View style={styles.brickHeaderRow}>
              <View style={[styles.iconContainer, { backgroundColor: '#fefce8' }]}>
                <Eye size={16} color="#d97706" />
              </View>
              <Text style={styles.brickLabelTitleText}>Turbidity</Text>
            </View>
            <Text style={[styles.brickPrimaryValueText, { color: '#0f172a' }]}>
              {selectedDevice.metrics.turbidity}{' '}
              <Text style={styles.brickUnitText}>NTU</Text>
            </Text>
          </View>

          {/* pH */}
          <View style={styles.bentoMiniBrickCard}>
            <View style={styles.brickHeaderRow}>
              <View style={[styles.iconContainer, { backgroundColor: '#f0fdf4' }]}>
                <Droplet size={16} color="#16a34a" />
              </View>
              <Text style={styles.brickLabelTitleText}>pH Level</Text>
            </View>
            <Text style={[styles.brickPrimaryValueText, { color: '#0f172a' }]}>
              {selectedDevice.metrics.ph}
            </Text>
          </View>
        </View>

        {/* Battery Level */}
        <View style={styles.bentoRightExpandedColumnCard}>
          <View style={styles.brickHeaderRow}>
            <View style={[
              styles.iconContainer, 
              { backgroundColor: selectedDevice.metrics.battery <= 50 ? '#fff7ed' : '#f0fdf4' }
            ]}>
              <Battery
                size={16}
                color={
                  selectedDevice.metrics.battery <= 50 ? '#f97316' : '#16a34a'
                }
              />
            </View>
            <Text style={styles.brickLabelTitleText}>Power Level</Text>
          </View>

          <View style={styles.batteryCellMeterOuterContainer}>
            <View
              style={[
                styles.batteryCellMeterInnerFillProgress,
                {
                  height: `${selectedDevice.metrics.battery}%`,
                  backgroundColor:
                    selectedDevice.metrics.battery <= 50
                      ? 'rgba(249, 115, 22, 0.25)'
                      : 'rgba(34, 197, 94, 0.25)',
                  borderTopWidth: 2,
                  borderTopColor:
                    selectedDevice.metrics.battery <= 50
                      ? '#f97316'
                      : '#22c55e',
                },
              ]}
            />
            <Zap 
              size={18} 
              color={selectedDevice.metrics.battery <= 50 ? '#f97316' : '#16a34a'} 
              style={{ marginBottom: 4 }} 
            />
            <Text
              style={[
                styles.batteryPercentageDisplayValueText,
                {
                  color:
                    selectedDevice.metrics.battery <= 50
                      ? '#ea580c'
                      : '#15803d',
                },
              ]}
            >
              {selectedDevice.metrics.battery}%
            </Text>
            <Text style={styles.batterySubtext}>Li-Ion Cell</Text>
          </View>
        </View>
      </View>

      {/* Sparkline Panel */}
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
                Real-time prediction flow
              </Text>
            </View>
          </View>
          <View style={styles.livePulseBadge}>
            <View style={styles.pulseDot} />
            <Text style={styles.livePulseStatusLabel}>LIVE</Text>
          </View>
        </View>

        <View style={styles.svgSparklineContainerCanvas}>
          <Svg height="100%" width="100%" viewBox="0 0 300 60">
            <Polyline
              points={getPointsStr()}
              fill="none"
              stroke={selectedDevice.color || '#38bdf8'}
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
  container: {
    gap: 16,
  },
  sectionTitleRow: {
    marginTop: 4,
    marginBottom: 4,
  },
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
  alertWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    elevation: 2,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  alertIconBadge: {
    backgroundColor: '#fee2e2',
    padding: 8,
    borderRadius: 12,
  },
  alertPillBadge: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  alertPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
  },
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
    backgroundColor: '#2563eb',
    borderRadius: 24,
    padding: 22,
    position: 'relative',
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
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
  heroLivePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
  },
  predictionCardPrimaryValue: {
    marginBottom: 16,
    fontSize: 40,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -1,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusLabelTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  statusFlagText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  bentoMetricsLayoutStructure: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  metricLeftVerticalStackColumn: {
    flex: 1.1,
    gap: 10,
  },
  brickHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
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
    borderColor: '#f1f5f9',
    elevation: 2,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
  },
  brickLabelTitleText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
  },
  brickPrimaryValueText: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: '800',
  },
  brickUnitText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  bentoRightExpandedColumnCard: {
    flex: 0.9,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    elevation: 2,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
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
    elevation: 4,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
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
  sparklineSubtitle: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
  },
  livePulseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  livePulseStatusLabel: {
    fontSize: 9,
    color: '#10b981',
    fontWeight: '800',
  },
  svgSparklineContainerCanvas: {
    height: 65,
    width: '100%',
    marginTop: 6,
  },
});