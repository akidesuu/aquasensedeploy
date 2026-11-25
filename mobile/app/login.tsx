import React, { useState, useRef, useEffect } from 'react';
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
  ActivityIndicator,
  Modal,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  Waves,
  ShieldAlert,
} from 'lucide-react-native';
import { useAuth } from './_layout';

const API_BASE_URL = 'https://aquasense-backend-osmi.onrender.com';

export default function LoginScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { login, user } = auth;
  const isLoadingAuth = Boolean((auth as { isLoadingAuth?: boolean })?.isLoadingAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [btnPressed, setBtnPressed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [unauthorizedModalVisible, setUnauthorizedModalVisible] = useState(false);

  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(18)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const emailFocusAnim = useRef(new Animated.Value(0)).current;
  const passFocusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 380,
        useNativeDriver: true,
      }),
      Animated.timing(cardTranslateY, {
        toValue: 0,
        duration: 380,
        useNativeDriver: true,
      }),
    ]).start();
  }, [cardOpacity, cardTranslateY]);

  useEffect(() => {
    if (!isLoadingAuth && user) {
      const roleLower = String((user as { role?: string }).role || '')
        .trim()
        .toLowerCase();
      if (roleLower === 'farmer') {
        router.replace('/(tabs)');
      }
    }
  }, [isLoadingAuth, user, router]);

  useEffect(() => {
    Animated.timing(emailFocusAnim, {
      toValue: focusedField === 'email' ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [focusedField, emailFocusAnim]);

  useEffect(() => {
    Animated.timing(passFocusAnim, {
      toValue: focusedField === 'password' ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [focusedField, passFocusAnim]);

  const triggerShake = (message: string) => {
    setErrorMsg(message);
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 45, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = async () => {
    setErrorMsg(null);
    if (!email.trim() || !password.trim()) {
      triggerShake('Please enter both your email and password.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          username: email.trim(),
          password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || 'Invalid email or password configuration.');
      }

      const userRole = String(data.role || data.user?.role || '').trim().toLowerCase();

      if (userRole !== 'farmer') {
        setUnauthorizedModalVisible(true);
        return;
      }

      const resolvedName =
        data.username || data.name || data.user?.name || email.split('@')[0];
      const resolvedEmail =
        data.email || data.user?.email || email.trim().toLowerCase();
      const resolvedLocation =
        data.location || data.user?.location || 'Unassigned Field Station';
      const resolvedId = data.id || data.user?.id;

      const userPayload = Object.assign(
        {
          name: resolvedName,
          username: resolvedName,
          email: resolvedEmail,
          role: data.role || 'Farmer',
          location: resolvedLocation,
        },
        resolvedId ? { id: resolvedId } : {}
      );

      await login(userPayload as Parameters<typeof login>[0]);

      setLoading(false);
      router.replace('/(tabs)');
    } catch (error: any) {
      triggerShake(
        error?.message || 'Unable to reach the AquaSense backend server.'
      );
    } finally {
      setLoading(false);
    }
  };

  const emailLiftStyle = {
    transform: [
      {
        translateY: emailFocusAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -2],
        }),
      },
    ],
  };

  const passLiftStyle = {
    transform: [
      {
        translateY: passFocusAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -2],
        }),
      },
    ],
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.innerContainer}>
          <View style={styles.topAccentBar} />

          <Animated.View
            style={[
              styles.card,
              {
                opacity: cardOpacity,
                transform: [
                  { translateY: cardTranslateY },
                  { translateX: shakeAnim },
                ],
              },
            ]}
          >
            <View style={styles.topMetaRow}>
              <View style={styles.monochromePill}>
                <View style={styles.pulseDot} />
                <Text style={styles.monochromePillText}>FARMER CORE</Text>
              </View>
              <Text style={styles.versionTag}>v2.0</Text>
            </View>

            <View style={styles.brandHeader}>
              <View style={styles.logoBadge}>
                <Text style={styles.logoDrop}>💧</Text>
              </View>
              <Text style={styles.titleText}>AquaSense</Text>
              <Text style={styles.subtitleText}>FARMER MONITORING PORTAL</Text>
              <View style={styles.dividerRule}>
                <View style={styles.dividerLine} />
                <Waves size={13} color="#71717a" />
                <View style={styles.dividerLine} />
              </View>
            </View>

            {errorMsg && (
              <View style={styles.errorAlert}>
                <ShieldAlert size={16} color="#dc2626" />
                <Text style={styles.errorAlertText}>{errorMsg}</Text>
              </View>
            )}

            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text
                    style={[
                      styles.inputLabel,
                      focusedField === 'email' && styles.inputLabelFocused,
                    ]}
                  >
                    FARMER EMAIL ADDRESS
                  </Text>
                  <View style={styles.fieldChip}>
                    <Text style={styles.fieldChipText}>ID</Text>
                  </View>
                </View>

                <Animated.View style={[styles.inputWrapper, emailLiftStyle]}>
                  <Mail
                    size={16}
                    color={focusedField === 'email' ? '#09090b' : '#71717a'}
                    style={styles.leftIcon}
                  />
                  <TextInput
                    style={[
                      styles.inputField,
                      focusedField === 'email' && styles.inputFieldFocused,
                    ]}
                    placeholder="Enter farmer email"
                    placeholderTextColor="#a1a1aa"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                    value={email}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    onChangeText={setEmail}
                  />
                </Animated.View>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text
                    style={[
                      styles.inputLabel,
                      focusedField === 'password' && styles.inputLabelFocused,
                    ]}
                  >
                    SECURITY ACCESS PASSWORD
                  </Text>
                  <View style={styles.fieldChip}>
                    <Text style={styles.fieldChipText}>KEY</Text>
                  </View>
                </View>

                <Animated.View style={[styles.inputWrapper, passLiftStyle]}>
                  <Lock
                    size={16}
                    color={focusedField === 'password' ? '#09090b' : '#71717a'}
                    style={styles.leftIcon}
                  />
                  <TextInput
                    style={[
                      styles.passwordField,
                      focusedField === 'password' && styles.inputFieldFocused,
                    ]}
                    placeholder="••••••••••••"
                    placeholderTextColor="#a1a1aa"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                    value={password}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword((prev) => !prev)}
                    activeOpacity={0.7}
                    disabled={loading}
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff size={16} color="#27272a" />
                    ) : (
                      <Eye size={16} color="#71717a" />
                    )}
                  </TouchableOpacity>
                </Animated.View>
              </View>

              <TouchableOpacity
                style={[
                  styles.loginButton,
                  btnPressed && !loading && styles.loginButtonBlueHover,
                  loading && styles.loginButtonDisabled,
                ]}
                onPress={handleLogin}
                onPressIn={() => setBtnPressed(true)}
                onPressOut={() => setBtnPressed(false)}
                activeOpacity={0.9}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <View style={styles.btnInner}>
                    <Text style={styles.loginButtonText}>Establish Secure Session</Text>
                    <ArrowRight
                      size={16}
                      color="#ffffff"
                      style={{
                        transform: [{ translateX: btnPressed ? 4 : 0 }],
                      }}
                    />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.footerText}>ENCRYPTED TELEMETRY GATEWAY • BnW UI</Text>
            </View>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>

      <Modal
        animationType="fade"
        transparent
        visible={unauthorizedModalVisible}
        onRequestClose={() => setUnauthorizedModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentCard}>
            <View style={styles.modalIconBadge}>
              <ShieldAlert size={24} color="#dc2626" />
            </View>
            <Text style={styles.modalTitleText}>Farmer Portal Only</Text>
            <Text style={styles.modalBodyText}>
              This mobile application is strictly for Farmer accounts. Administrators and Super Admins must use the AquaSense web portal.
            </Text>
            <TouchableOpacity
              style={styles.modalDismissButton}
              onPress={() => setUnauthorizedModalVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.modalDismissButtonText}>Understood</Text>
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
    backgroundColor: '#f4f4f5',
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  topAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#09090b',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    elevation: 6,
    shadowColor: '#09090b',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
  },
  topMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  monochromePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f4f4f5',
    borderWidth: 1,
    borderColor: '#e4e4e7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#09090b',
  },
  monochromePillText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#27272a',
  },
  versionTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#71717a',
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#09090b',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoDrop: {
    fontSize: 24,
  },
  titleText: {
    fontSize: 23,
    fontWeight: '800',
    color: '#09090b',
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#71717a',
    letterSpacing: 1.4,
    marginTop: 4,
  },
  dividerRule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: 110,
    marginTop: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e4e4e7',
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorAlertText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
  },
  formContainer: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: '#52525b',
  },
  inputLabelFocused: {
    color: '#09090b',
  },
  fieldChip: {
    backgroundColor: '#f4f4f5',
    borderWidth: 1,
    borderColor: '#e4e4e7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  fieldChipText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#52525b',
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  leftIcon: {
    position: 'absolute',
    left: 14,
    zIndex: 2,
  },
  inputField: {
    backgroundColor: '#fafafa',
    borderRadius: 12,
    height: 48,
    paddingLeft: 42,
    paddingRight: 14,
    fontSize: 14,
    color: '#09090b',
    borderWidth: 1,
    borderColor: '#d4d4d8',
  },
  passwordField: {
    backgroundColor: '#fafafa',
    borderRadius: 12,
    height: 48,
    paddingLeft: 42,
    paddingRight: 44,
    fontSize: 14,
    color: '#09090b',
    borderWidth: 1,
    borderColor: '#d4d4d8',
  },
  inputFieldFocused: {
    backgroundColor: '#ffffff',
    borderColor: '#09090b',
  },
  eyeButton: {
    position: 'absolute',
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f4f4f5',
    zIndex: 2,
  },
  loginButton: {
    backgroundColor: '#09090b',
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#18181b',
  },
  loginButtonBlueHover: {
    backgroundColor: '#0284c7',
    borderColor: '#7dd3fc',
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  cardFooter: {
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f4f4f5',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#a1a1aa',
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
  },
  modalIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitleText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  modalBodyText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  modalDismissButton: {
    backgroundColor: '#0284c7',
    borderRadius: 12,
    height: 46,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDismissButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});