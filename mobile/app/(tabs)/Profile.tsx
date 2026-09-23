import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import {
  User,
  Mail,
  Shield,
  Bell,
  HardDrive,
  LogOut,
  ChevronRight,
  Sliders,
  CheckCircle2,
} from 'lucide-react-native';
import { useAuth } from '../_layout';

interface ProfileScreenProps {
  onLogout?: () => void;
}

export default function ProfileScreen({ onLogout }: ProfileScreenProps) {
  const { user } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [criticalAlertsOnly, setCriticalAlertsOnly] = useState(false);
  const [autoSync, setAutoSync] = useState(true);

  const handleLogoutPress = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of AquaSense?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Log Out', 
        style: 'destructive', 
        onPress: () => onLogout?.() 
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* USER IDENTITY CARD */}
      <View style={styles.userCard}>
        <View style={styles.avatarCircle}>
          <User size={36} color="#0284c7" />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user?.name || 'AquaSense Operator'}</Text>
          <View style={styles.emailRow}>
            <Mail size={12} color="#64748b" />
            <Text style={styles.userEmail}>{user?.email || 'operator@aquasense.io'}</Text>
          </View>
          <View style={styles.roleBadge}>
            <CheckCircle2 size={10} color="#16a34a" />
            <Text style={styles.roleBadgeText}>{user?.role || 'Farmer'}</Text>
          </View>
        </View>
      </View>

      {/* SYSTEM TELEMETRY PREFERENCES */}
      <Text style={styles.sectionTitle}>Telemetry & Alerts</Text>
      <View style={styles.settingsGroup}>
        <View style={styles.settingItem}>
          <View style={styles.settingIconLabelGroup}>
            <View style={[styles.iconBox, { backgroundColor: '#e0f2fe' }]}>
              <Bell size={18} color="#0284c7" />
            </View>
            <View>
              <Text style={styles.settingTitle}>Push Notifications</Text>
              <Text style={styles.settingSubtitle}>Receive real-time DO alerts</Text>
            </View>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: '#cbd5e1', true: '#0284c7' }}
          />
        </View>

        <View style={styles.settingDivider} />

        <View style={styles.settingItem}>
          <View style={styles.settingIconLabelGroup}>
            <View style={[styles.iconBox, { backgroundColor: '#fee2e2' }]}>
              <Sliders size={18} color="#ef4444" />
            </View>
            <View>
              <Text style={styles.settingTitle}>Critical Thresholds Only</Text>
              <Text style={styles.settingSubtitle}>Filter out minor warnings</Text>
            </View>
          </View>
          <Switch
            value={criticalAlertsOnly}
            onValueChange={setCriticalAlertsOnly}
            trackColor={{ false: '#cbd5e1', true: '#0284c7' }}
          />
        </View>
      </View>

      {/* HARDWARE & SYNC */}
      <Text style={styles.sectionTitle}>Node Configuration</Text>
      <View style={styles.settingsGroup}>
        <View style={styles.settingItem}>
          <View style={styles.settingIconLabelGroup}>
            <View style={[styles.iconBox, { backgroundColor: '#f0fdf4' }]}>
              <HardDrive size={18} color="#16a34a" />
            </View>
            <View>
              <Text style={styles.settingTitle}>Background Data Sync</Text>
              <Text style={styles.settingSubtitle}>Auto-fetch floater metrics</Text>
            </View>
          </View>
          <Switch
            value={autoSync}
            onValueChange={setAutoSync}
            trackColor={{ false: '#cbd5e1', true: '#0284c7' }}
          />
        </View>

        <View style={styles.settingDivider} />

        <TouchableOpacity style={styles.settingItemClickable} activeOpacity={0.7}>
          <View style={styles.settingIconLabelGroup}>
            <View style={[styles.iconBox, { backgroundColor: '#f1f5f9' }]}>
              <Shield size={18} color="#475569" />
            </View>
            <View>
              <Text style={styles.settingTitle}>Security & Credentials</Text>
              <Text style={styles.settingSubtitle}>Manage API tokens & keys</Text>
            </View>
          </View>
          <ChevronRight size={18} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      {/* DANGER ZONE / LOGOUT */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogoutPress}
        activeOpacity={0.8}
      >
        <LogOut size={18} color="#ef4444" />
        <Text style={styles.logoutButtonText}>Sign Out of System</Text>
      </TouchableOpacity>

      {/* FOOTER METADATA */}
      <Text style={styles.versionSubtext}>AquaSense Mobile v1.2.0 • Build 2026</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 110,
    gap: 16,
  },
  userCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#bae6fd',
  },
  userInfo: {
    flex: 1,
    gap: 3,
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userEmail: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16a34a',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 4,
    marginBottom: -4,
  },
  settingsGroup: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  settingItemClickable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  settingIconLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  settingSubtitle: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  settingDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 8,
  },
  logoutButtonText: {
    color: '#ef4444',
    fontWeight: '800',
    fontSize: 14,
  },
  versionSubtext: {
    textAlign: 'center',
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 4,
  },
});