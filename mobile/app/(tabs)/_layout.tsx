import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface MobileUser {
  id?: string | number;
  name?: string;
  username?: string;
  email?: string;
  role?: string;
  location?: string;
  token?: string;
}

interface AuthContextValue {
  user: MobileUser | null;
  token: string | null;
  isLoadingAuth: boolean;
  login: (userData: MobileUser) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isLoadingAuth: true,
  login: async () => {},
  logout: async () => {},
});

const STORAGE_KEY_USER = '@aquasense_mobile_user';
const STORAGE_KEY_TOKEN = '@aquasense_mobile_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);

  useEffect(() => {
    const hydrateSession = async () => {
      try {
        const [savedUser, savedToken] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_USER),
          AsyncStorage.getItem(STORAGE_KEY_TOKEN),
        ]);
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }
        if (savedToken) {
          setToken(savedToken);
        }
      } catch (err) {
        console.warn('Failed to restore auth session:', err);
      } finally {
        setIsLoadingAuth(false);
      }
    };
    hydrateSession();
  }, []);

  const login = useCallback(async (userData: MobileUser) => {
    const authToken = userData.token || null;
    setUser(userData);
    setToken(authToken);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(userData));
      if (authToken) {
        await AsyncStorage.setItem(STORAGE_KEY_TOKEN, authToken);
      }
    } catch (err) {
      console.warn('Failed to persist auth session:', err);
    }
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    setToken(null);
    try {
      await AsyncStorage.multiRemove([STORAGE_KEY_USER, STORAGE_KEY_TOKEN]);
    } catch (err) {
      console.warn('Failed to clear auth session:', err);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoadingAuth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export default function Layout() {
  return (
    <AuthProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade_from_bottom',
          animationDuration: 240,
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="index" />
      </Stack>
    </AuthProvider>
  );
}