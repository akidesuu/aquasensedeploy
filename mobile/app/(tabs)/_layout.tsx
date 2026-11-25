import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';

const API_BASE_URL = 'https://aquasense-backend-osmi.onrender.com';
const TOKEN_KEY = 'aquasense_auth_token';
const USER_KEY = 'aquasense_auth_user';

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
  token: string | null;
  isLoadingAuth: boolean;
  login: (authData: any) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoadingAuth: true,
  login: async () => {},
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function RootLayout() {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    const restoreSession = async () => {
      try {
        const [savedToken, savedUser] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (!mounted) return;
        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        }
      } catch (err) {
        console.warn('Failed to restore auth session:', err);
      } finally {
        if (mounted) {
          setIsLoadingAuth(false);
        }
      }
    };
    restoreSession();
    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (authData: any) => {
    const receivedToken = authData?.access_token || authData?.token || '';
    const resolvedUser: MobileUser = {
      id: authData?.id,
      email: authData?.email,
      username: authData?.username || authData?.name,
      name: authData?.name || authData?.username || authData?.email || 'Farmer',
      role: authData?.role || 'Farmer',
      location: authData?.location,
    };

    // Update React state immediately before AsyncStorage finishes
    setToken(receivedToken || null);
    setUser(resolvedUser);
    setIsLoadingAuth(false);

    try {
      if (receivedToken) {
        await AsyncStorage.setItem(TOKEN_KEY, receivedToken);
      }
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(resolvedUser));
    } catch (err) {
      console.warn('Failed to persist auth session:', err);
    }
  }, []);

  const logout = useCallback(async () => {
    const currentToken = token;
    setUser(null);
    setToken(null);
    setIsLoadingAuth(false);

    try {
      if (currentToken) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentToken}`,
          },
        }).catch(() => {});
      }
      await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    } catch (err) {
      console.warn('Failed to clear auth session:', err);
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, isLoadingAuth, login, logout }}>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthContext.Provider>
  );
}