import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface MobileUser {
  id?: string;
  email?: string;
  username?: string;
  name?: string;
  role?: string;
  location?: string;
}

interface AuthContextType {
  user: MobileUser | null;
  isLoadingAuth: boolean;
  login: (userData: any) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoadingAuth: false,
  login: () => {},
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function RootLayout() {
  const router = useRouter();
  const [user, setUser] = useState<MobileUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(false);

  useEffect(() => {
    // 2. Request notification permissions & set up Android vibration channel
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

    // 3. Listen for when user taps the pop-up notification
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.targetScreen === 'alert') {
        // Navigates directly to your tabs screen
        router.replace('/(tabs)');
      }
    });

    return () => subscription.remove();
  }, [router]);

  const login = useCallback((userData: any) => {
    const resolvedUser: MobileUser = {
      id: userData?.id || userData?.user?.id,
      email: userData?.email || userData?.user?.email,
      username: userData?.username || userData?.user?.username || userData?.name,
      name:
        userData?.name ||
        userData?.username ||
        userData?.user?.name ||
        userData?.email ||
        'Farmer',
      role: userData?.role || userData?.user?.role || 'Farmer',
      location: userData?.location || userData?.user?.location || 'Unassigned Field Station',
    };

    setIsLoadingAuth(false);
    setUser(resolvedUser);
  }, []);

  const logout = useCallback(() => {
    setIsLoadingAuth(false);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoadingAuth, login, logout }}>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthContext.Provider>
  );
}