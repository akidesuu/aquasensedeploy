import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function ScreenTwo() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Analytics Screen Under Construction</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8fafc', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  text: {  
    color: '#64748b', 
    fontSize: 16, 
    fontWeight: '600' 
  }
});