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
  Alert 
} from 'react-native';
import { useRouter } from 'expo-router';
// Import the clean useAuth context hook directly from your sibling layout file
import { useAuth } from "./_layout";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth(); // Safely grab the context login action
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    console.log('Logging in with:', email, password);

    // Fire our context login to toggle layout authentication state.
    // The Route Guard in _layout.tsx will instantly detect this change 
    // and route the user cleanly into the /(tabs) dashboard.
    login();
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.innerContainer}>
          
          {/* Logo & Header Title */}
          <View style={styles.headerContainer}>
            <Text style={styles.logoText}>💧</Text>
            <Text style={styles.titleText}>AquaSense</Text>
            <Text style={styles.subtitleText}>Water Quality Monitoring System</Text>
          </View>

          {/* Form Context Fields */}
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.inputField}
              placeholder="Enter your email"
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

            {/* Action Execution Button */}
            <TouchableOpacity 
              style={styles.loginButton} 
              onPress={handleLogin}
              activeOpacity={0.8}
            >
              <Text style={styles.loginButtonText}>Sign In</Text>
            </TouchableOpacity>

            {/* Registration Backup Hint */}
            <TouchableOpacity 
              style={styles.registerLink} 
              onPress={() => Alert.alert('Notice', 'No registration required yet. Just type any mock credentials above to log in immediately.')}
              activeOpacity={0.7}
            >
              <Text style={styles.registerLinkText}>
                Don't have an account? <Text style={styles.registerTextBold}>Explore App</Text>
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </TouchableWithoutFeedback>
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
});