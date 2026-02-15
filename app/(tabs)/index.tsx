import React, { useState, useEffect, useRef } from 'react';
import { database } from "../../firebaseConfig";
import { ref, set, onValue } from "firebase/database";

import {
  StyleSheet,
  Text,
  View,
  Switch,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { router, usePathname } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

/* ================= VOICE IMPORT ================= */
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent
} from "expo-speech-recognition";

/* ================= TYPES ================= */

interface DeviceCardProps {
  name: string;
  status: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

interface SensorCardProps {
  label: string;
  value: string;
  good?: boolean;
}

/* ================= MAIN ================= */

export default function HomeScreen() {

  const [lightOn, setLightOn] = useState(false);
  const [fanOn, setFanOn] = useState(false);
  const [secureMode, setSecureMode] = useState(false);

  const [temperature, setTemperature] = useState(0);
  const [humidity, setHumidity] = useState(0);
  const [gasLevel, setGasLevel] = useState(0);
  const [motion, setMotion] = useState(false);
  const [fireStatus, setFireStatus] = useState(false);

  const [micActive, setMicActive] = useState(false);

  const pathname = usePathname();

  /* ================= MIC ANIMATION ================= */

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnimation = useRef<Animated.CompositeAnimation | null>(null);

  const startPulse = () => {
    pulseAnimation.current = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.18,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.current.start();
  };

  const stopPulse = () => {
    pulseAnimation.current?.stop();
    scaleAnim.setValue(1);
  };

  /* ================= VOICE LOGIC ================= */

  const requestMicPermission = async () => {
    const { granted } =
      await ExpoSpeechRecognitionModule.requestPermissionsAsync();

    if (!granted) {
      console.log("Microphone permission denied");
      return false;
    }

    return true;
  };

  const handleVoiceCommand = (text: string) => {
    const command = text.trim().toLowerCase();

    console.log("Result received:", command);

    switch (command) {
      case "turn on light":
        set(ref(database, "devices/light"), true);
        console.log("Command executed: turn on light");
        break;

      case "turn off light":
        set(ref(database, "devices/light"), false);
        console.log("Command executed: turn off light");
        break;

      case "turn on fan":
        set(ref(database, "devices/fan"), true);
        console.log("Command executed: turn on fan");
        break;

      case "turn off fan":
        set(ref(database, "devices/fan"), false);
        console.log("Command executed: turn off fan");
        break;

      case "enable secure mode":
        set(ref(database, "modes/secure_mode"), true);
        console.log("Command executed: enable secure mode");
        break;

      case "disable secure mode":
        set(ref(database, "modes/secure_mode"), false);
        console.log("Command executed: disable secure mode");
        break;

      default:
        console.log("Unrecognized command");
        break;
    }
  };

  const startListening = async () => {
    const hasPermission = await requestMicPermission();
    if (!hasPermission) return;

    console.log("Listening started");

    ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      interimResults: false,
      maxAlternatives: 1,
      continuous: false,
    });
  };

  const stopListening = () => {
    ExpoSpeechRecognitionModule.stop();
  };

  /* ================= VOICE EVENTS ================= */

  useSpeechRecognitionEvent("result", (event) => {
    if (event.results?.length > 0) {
      const transcript = event.results[0]?.transcript ?? "";

      handleVoiceCommand(transcript);

      stopListening();
      setMicActive(false);
      stopPulse();
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    console.log("Speech recognition error:", event.error);

    stopListening();
    setMicActive(false);
    stopPulse();
  });

  /* ================= MIC BUTTON ================= */

  const handleMicPress = () => {
    const nextState = !micActive;
    setMicActive(nextState);

    if (nextState) {
      startPulse();
      startListening();
    } else {
      stopPulse();
      stopListening();
    }
  };

  /* ================= REALTIME LISTENERS ================= */

  useEffect(() => {

    const devicesRef = ref(database, "devices");
    const modesRef = ref(database, "modes");
    const sensorsRef = ref(database, "sensors");

    const unsubscribeDevices = onValue(devicesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setLightOn(data.light ?? false);
        setFanOn(data.fan ?? false);
      }
    });

    const unsubscribeModes = onValue(modesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setSecureMode(data.secure_mode ?? false);
      }
    });

    const unsubscribeSensors = onValue(sensorsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setTemperature(data.temperature ?? 0);
        setHumidity(data.humidity ?? 0);
        setGasLevel(data.gas_level ?? 0);
        setMotion(data.motion ?? false);
        setFireStatus(data.fire_status ?? false);
      }
    });

    return () => {
      unsubscribeDevices();
      unsubscribeModes();
      unsubscribeSensors();
    };

  }, []);

  /* ================= NAVIGATION ================= */

  const goHome = () => {
    if (pathname !== '/') router.replace('/');
  };

  const goLogs = () => {
    if (pathname !== '/logs') router.replace('/logs');
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <LinearGradient
        colors={['#1b2735', '#2c3e50', '#3a556c']}
        style={styles.header}
      >
        <SafeAreaView edges={[]} style={styles.safeHeader}>
          <Text style={styles.headerTitle}>SmartNest</Text>
        </SafeAreaView>
      </LinearGradient>

      <SafeAreaView style={styles.content} edges={['bottom']}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.mainContainer}>
            <Text style={styles.sectionTitle}>Device Controls</Text>

            <View style={styles.secureContainer}>
              <Text style={styles.secureText}>
                🔒 Secure Mode {secureMode ? "(ON)" : "(OFF)"}
              </Text>

              <Switch
                value={secureMode}
                onValueChange={(value) => {
                  set(ref(database, "modes/secure_mode"), value);
                }}
                trackColor={{ false: "#E5E7EB", true: "#DC2626" }}
                thumbColor="#ffffff"
              />
            </View>

            <DeviceCard
              name="💡 Light"
              status={lightOn ? "Active" : "Inactive"}
              value={lightOn}
              onChange={(value) => {
                set(ref(database, "devices/light"), value);
              }}
            />

            <DeviceCard
              name="🌀 Fan"
              status={fanOn ? "Running" : "Stopped"}
              value={fanOn}
              onChange={(value) => {
                set(ref(database, "devices/fan"), value);
              }}
            />
          </View>

          <View style={styles.mainContainer}>
            <Text style={styles.sectionTitle}>Smart Monitoring</Text>

            <View style={styles.sensorGrid}>
              <SensorCard label="Temperature" value={`${temperature}°C`} />
              <SensorCard label="Humidity" value={`${humidity}%`} />
              <SensorCard label="Gas Level" value={gasLevel.toString()} />
              <SensorCard label="Motion" value={motion ? "Detected" : "No Movement"} />
              <SensorCard
                label="Fire"
                value={fireStatus ? "ALERT" : "Safe"}
                good={!fireStatus}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      <Animated.View
        style={[
          styles.micContainer,
          { transform: [{ scale: scaleAnim }] }
        ]}
      >
        <TouchableOpacity activeOpacity={0.8} onPress={handleMicPress}>
          <LinearGradient
            colors={
              micActive
                ? ['#16A34A', '#22C55E']
                : ['#1b2735', '#2c3e50', '#3a556c']
            }
            style={[
              styles.micButton,
              micActive && styles.micActiveGlow
            ]}
          >
            <MaterialIcons name="mic" size={32} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <TouchableOpacity
          onPress={goHome}
          style={[
            styles.footerItem,
            pathname === '/' && styles.footerItemActive
          ]}
        >
          <Text style={[
            styles.footerText,
            pathname === '/' && styles.footerActive
          ]}>
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={goLogs}
          style={[
            styles.footerItem,
            pathname === '/logs' && styles.footerItemActive
          ]}
        >
          <Text style={[
            styles.footerText,
            pathname === '/logs' && styles.footerActive
          ]}>
            Logs
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

/* ================= DEVICE CARD ================= */

function DeviceCard({ name, status, value, onChange }: DeviceCardProps) {
  return (
    <View style={styles.deviceCard}>
      <View>
        <Text style={styles.deviceName}>{name}</Text>
        <Text style={styles.deviceStatus}>{status}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#E5E7EB", true: "#4F46E5" }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

/* ================= SENSOR CARD ================= */

function SensorCard({ label, value, good }: SensorCardProps) {
  return (
    <View style={styles.sensorCard}>
      <Text style={styles.sensorLabel}>{label}</Text>
      <Text
        style={[
          styles.sensorValue,
          good === true ? { color: '#22C55E' } :
          good === false ? { color: '#DC2626' } :
          null
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6F8' },
  header: { paddingVertical: 20, alignItems: 'center', justifyContent: 'center' },
  safeHeader: { alignItems: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: 35, fontWeight: '700' },
  content: { flex: 1 },
  mainContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 18,
    marginTop: 18,
    borderRadius: 16,
    padding: 18,
    elevation: 3
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 20,
    textAlign: 'center',
    color: '#111827'
  },
  secureContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 0.6,
    borderColor: '#E6EBEF'
  },
  secureText: { fontSize: 18, fontWeight: '800' },
  deviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 0.6,
    borderColor: '#E6EBEF'
  },
  deviceName: { fontSize: 19, fontWeight: '800' },
  deviceStatus: { fontSize: 14, color: '#6B7280' },
  sensorGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  sensorCard: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    padding: 18,
    borderRadius: 14,
    marginBottom: 16
  },
  sensorLabel: { fontSize: 16, textAlign: 'center', fontWeight: '700' },
  sensorValue: { fontSize: 22, textAlign: 'center', marginTop: 6, fontWeight: '900' },
  micContainer: { position: "absolute", bottom: 90, right: 25 },
  micButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
  },
  micActiveGlow: {
    shadowColor: '#22C55E',
    shadowOpacity: 0.9,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 25,
  },
  footer: { flexDirection: 'row', backgroundColor: '#2d313a' },
  footerItem: { flex: 1, alignItems: 'center', paddingVertical: 20 },
  footerItemActive: { backgroundColor: '#2d313a' },
  footerText: { color: '#9CA3AF', fontSize: 16 },
  footerActive: { color: '#FFFFFF', fontWeight: '800' }
});
