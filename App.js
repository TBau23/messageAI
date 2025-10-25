import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button } from 'react-native';
import { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';

export default function App() {
  const [message, setMessage] = useState('Hello World');
  const [firebaseStatus, setFirebaseStatus] = useState('Checking Firebase...');

  useEffect(() => {
    checkFirebase();
  }, []);

  const checkFirebase = () => {
    if (db) {
      setFirebaseStatus('✅ Firebase Connected');
    } else {
      setFirebaseStatus('❌ Firebase Not Connected');
    }
  };

  const testFirebase = async () => {
    try {

      setFirebaseStatus('Writing to Firebase...');
      const docRef = await addDoc(collection(db, 'test'), {
        message: 'Hello from React Native!',
        timestamp: new Date()
      });

      setFirebaseStatus('✅ Data written to Firestore!');
    } catch (error) {
      console.error('Firebase error:', error);
      setFirebaseStatus(`❌ Error: ${error.message}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{message}</Text>
      <Text style={styles.status}>{firebaseStatus}</Text>
      <Button title="Test Firebase" onPress={testFirebase} />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  status: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
});