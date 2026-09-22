import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  View, 
  KeyboardAvoidingView, 
  Platform, 
  TouchableWithoutFeedback, 
  Keyboard, 
  Alert,
  ActivityIndicator,
  Modal
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from "./_layout";

const YOUR_COMPUTER_IP = '192.168.1.35'; 
const FASTAPI_URL = `http://${YOUR_COMPUTER_IP}:8000`;

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [unauthorizedModalVisible, setUnauthorizedModalVisible] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Validation Error', 'Please fill in both email and password.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${FASTAPI_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password: password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const userRole = (data.role || data.user?.role || '').toString().toLowerCase().trim();

        if (userRole === 'farmer') {
          // Pass full user details to AuthContext
          login({
            name: data.username || data.name || email.split('@')[0],
            email: data.email || email,
            role: data.role || 'Farmer'
          });
          
          router.replace('/(tabs)');
        } else {
          setUnauthorizedModalVisible(true);
        }
      } else {
        Alert.alert(
          'Authentication Failed', 
          data.detail || 'Invalid email or password configuration.'
        );
      }
    } catch (error) {
      console.error('Mobile Auth Network Error:', error);
      Alert.alert(
        'Connection Error', 
        'Unable to reach the AquaSense backend server. Please verify network connectivity and host IP.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.innerContainer}>
          
          <View style={styles.headerContainer}>
            <Text style={styles.logoText}>💧</Text>
            <Text style={styles.titleText}>AquaSense</Text>
            <Text style={styles.subtitleText}>Water Quality Monitoring System</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.inputField}
              placeholder="Enter your registered email"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />

            <Text style={[styles.inputLabel, { marginTop: 16 }]}>Password</Text>
            <TextInput
              style={styles.inputField}
              placeholder="Enter your password"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity 
              style={[styles.loginButton, loading && styles.loginButtonDisabled]} 
              onPress={handleLogin}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.loginButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.registerLink} 
              onPress={() => Alert.alert('Notice', 'Please contact your AquaSense administrator to create new user credentials.')}
              activeOpacity={0.7}
            >
              <Text style={styles.registerLinkText}>
                Need an account? <Text style={styles.registerTextBold}>Contact Admin</Text>
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </TouchableWithoutFeedback>

      <Modal
        animationType="fade"
        transparent={true}
        visible={unauthorizedModalVisible}
        onRequestClose={() => setUnauthorizedModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentCard}>
            <View style={styles.modalIconBadge}>
              <Text style={styles.modalIconText}>🚫</Text>
            </View>
            <Text style={styles.modalTitleText}>Not Authorized</Text>
            <Text style={styles.modalBodyText}>
              Access is restricted to Farmer accounts only. Your account does not have permission to view this application.
            </Text>
            <TouchableOpacity 
              style={styles.modalDismissButton}
              onPress={() => setUnauthorizedModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalDismissButtonText}>Okay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoText: {
    fontSize: 48,
    marginBottom: 12,
  },
  titleText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500',
  },
  formContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    elevation: 4,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  inputField: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  loginButton: {
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    elevation: 2,
    shadowColor: '#1d4ed8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  registerLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  registerLinkText: {
    fontSize: 13,
    color: '#64748b',
  },
  registerTextBold: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
  },
  modalIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIconText: {
    fontSize: 28,
  },
  modalTitleText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  modalBodyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalDismissButton: {
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    height: 48,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDismissButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});