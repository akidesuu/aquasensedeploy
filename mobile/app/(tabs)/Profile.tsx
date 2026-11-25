import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import {
  User,
  Mail,
  Bell,
  LogOut,
  Sliders,
  CheckCircle2,
  Camera,
  MapPin,
  Volume2,
} from 'lucide-react-native';
import { useAuth } from './_layout';

interface ProfileScreenProps {
  onLogout?: () => void;
}

const STORAGE_KEY_PROFILE_IMAGE = '@aquasense_farmer_profile_image';

export default function ProfileScreen({ onLogout }: ProfileScreenProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  const [criticalAlertsOnly, setCriticalAlertsOnly] = useState<boolean>(false);
  const [soundAlerts, setSoundAlerts] = useState<boolean>(true);
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  useEffect(() => {
    const loadSavedImage = async () => {
      try {
        const savedImage = await AsyncStorage.getItem(STORAGE_KEY_PROFILE_IMAGE);
        if (savedImage) {
          setProfileImageUri(savedImage);
        }
      } catch (err) {
        console.warn('Failed to load profile image from storage:', err);
      }
    };
    loadSavedImage();
  }, []);

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          'Permission Required',
          'Permission to access photo library is required to customize your profile image.'
        );
        return;
      }

      setIsUploading(true);
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!pickerResult.canceled && pickerResult.assets?.length > 0) {
        const selectedUri = pickerResult.assets[0].uri;
        setProfileImageUri(selectedUri);
        await AsyncStorage.setItem(STORAGE_KEY_PROFILE_IMAGE, selectedUri);
      }
    } catch (error) {
      console.warn('Error picking image:', error);
      Alert.alert('Error', 'Could not update profile image.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogoutPress = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of AquaSense?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => {
          if (onLogout) {
            onLogout();
          } else {
            logout();
          }
          router.replace('/login');
        },
      },
    ]);
  };

  const farmerName = user?.name || user?.username || 'Farmer Account';
  const farmerEmail = user?.email || 'farmer@aquasense.local';
  const farmerRole = user?.role || 'Farmer';
  const farmerLocation = user?.location || 'Unassigned Field Station';
  const farmerId = user?.id || 'FARMER';

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.userCard}>
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={handlePickImage}
          activeOpacity={0.8}
        >
          {profileImageUri ? (
            <Image source={{ uri: profileImageUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarCircle}>
              <User size={34} color="#0284c7" />
            </View>
          )}
          <View style={styles.cameraBadge}>
            {isUploading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Camera size={12} color="#ffffff" />
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.userInfo}>
          <Text style={styles.userName}>{farmerName}</Text>
          <View style={styles.infoRow}>
            <Mail size={12} color="#64748b" />
            <Text style={styles.userEmail}>{farmerEmail}</Text>
          </View>
          <View style={styles.infoRow}>
            <MapPin size={12} color="#64748b" />
            <Text style={styles.userEmail}>
              {farmerLocation} ({farmerId})
            </Text>
          </View>
          <View style={styles.roleBadge}>
            <CheckCircle2 size={10} color="#0284c7" />
            <Text style={styles.roleBadgeText}>{farmerRole}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Phone Notifications & Alerts</Text>
      <View style={styles.settingsGroup}>
        <View style={styles.settingItem}>
          <View style={styles.settingIconLabelGroup}>
            <View style={[styles.iconBox, { backgroundColor: '#e0f2fe' }]}>
              <Bell size={18} color="#0284c7" />
            </View>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.settingTitle}>Push Notifications</Text>
              <Text style={styles.settingSubtitle}>
                Receive mobile alerts for DO threshold breaches
              </Text>
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
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.settingTitle}>Critical Thresholds Only</Text>
              <Text style={styles.settingSubtitle}>
                Highlight critical DO drops first
              </Text>
            </View>
          </View>
          <Switch
            value={criticalAlertsOnly}
            onValueChange={setCriticalAlertsOnly}
            trackColor={{ false: '#cbd5e1', true: '#0284c7' }}
          />
        </View>

        <View style={styles.settingDivider} />

        <View style={styles.settingItem}>
          <View style={styles.settingIconLabelGroup}>
            <View style={[styles.iconBox, { backgroundColor: '#e0f2fe' }]}>
              <Volume2 size={18} color="#0284c7" />
            </View>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.settingTitle}>Alert Sound & Vibration</Text>
              <Text style={styles.settingSubtitle}>
                Notify when pond aeration needs attention
              </Text>
            </View>
          </View>
          <Switch
            value={soundAlerts}
            onValueChange={setSoundAlerts}
            trackColor={{ false: '#cbd5e1', true: '#0284c7' }}
          />
        </View>
      </View>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogoutPress}
        activeOpacity={0.8}
      >
        <LogOut size={18} color="#ef4444" />
        <Text style={styles.logoutButtonText}>Sign Out of System</Text>
      </TouchableOpacity>

      <Text style={styles.versionSubtext}>AquaSense Farmer Portal • v2.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 110, gap: 16 },
  userCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatarContainer: { position: 'relative' },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#7dd3fc',
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#0284c7',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0284c7',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  userInfo: { flex: 1, gap: 3 },
  userName: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  userEmail: { fontSize: 11, color: '#64748b', fontWeight: '500' },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  roleBadgeText: { fontSize: 10, fontWeight: '700', color: '#0284c7' },
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
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
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
  settingTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  settingSubtitle: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1,
  },
  settingDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 6,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 8,
  },
  logoutButtonText: { color: '#ef4444', fontWeight: '800', fontSize: 14 },
  versionSubtext: {
    textAlign: 'center',
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 4,
  },
});