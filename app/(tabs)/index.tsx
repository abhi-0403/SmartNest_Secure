import React, { useState, useEffect } from 'react';
import { database } from "../../firebaseConfig";
import { ref, set, onValue } from "firebase/database";

import {
  StyleSheet,
  Text,
  View,
  Switch,
  ScrollView,
  TouchableOpacity
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { router, usePathname } from 'expo-router';

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

  const [lightOn, setLightOn] = useState<boolean>(false);
  const [fanOn, setFanOn] = useState<boolean>(false);
  const [secureMode, setSecureMode] = useState<boolean>(false);

  const [temperature, setTemperature] = useState<number>(0);
  const [humidity, setHumidity] = useState<number>(0);
  const [gasLevel, setGasLevel] = useState<number>(0);
  const [motion, setMotion] = useState<boolean>(false);
  const [fireStatus, setFireStatus] = useState<boolean>(false);

  const pathname = usePathname();

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

      {/* HEADER */}
      <LinearGradient
        colors={['#1b2735', '#2c3e50', '#3a556c']}
        style={styles.header}
      >
        <SafeAreaView edges={[]} style={styles.safeHeader}>
          <Text style={styles.headerTitle}>SmartNest</Text>
        </SafeAreaView>
      </LinearGradient>

      {/* CONTENT */}
      <SafeAreaView style={styles.content} edges={['bottom']}>
        <ScrollView showsVerticalScrollIndicator={false}>

          {/* DEVICE CONTROLS */}
          <View style={styles.mainContainer}>
            <Text style={styles.sectionTitle}>Device Controls</Text>

            {/* Secure Mode */}
            <View style={styles.secureContainer}>
              <Text style={styles.secureText}>
                🔒 Secure Mode {secureMode ? "(ON)" : "(OFF)"}
              </Text>

              <Switch
                value={secureMode}
                onValueChange={(value: boolean) => {
                  set(ref(database, "modes/secure_mode"), value);
                }}
                trackColor={{ false: "#E5E7EB", true: "#DC2626" }}
                thumbColor="#ffffff"
              />
            </View>

            {/* Light */}
            <DeviceCard
              name="💡 Light"
              status={lightOn ? "Active" : "Inactive"}
              value={lightOn}
              onChange={(value: boolean) => {
                set(ref(database, "devices/light"), value);
              }}
            />

            {/* Fan */}
            <DeviceCard
              name="🌀 Fan"
              status={fanOn ? "Running" : "Stopped"}
              value={fanOn}
              onChange={(value: boolean) => {
                set(ref(database, "devices/fan"), value);
              }}
            />

          </View>

          {/* SMART MONITORING */}
          <View style={styles.mainContainer}>
            <Text style={styles.sectionTitle}>Smart Monitoring</Text>

            <View style={styles.sensorGrid}>
              <SensorCard label="Temperature" value={`${temperature}°C`} />
              <SensorCard label="Humidity" value={`${humidity}%`} />
              <SensorCard label="Gas Level" value={gasLevel.toString()} />
              <SensorCard
                label="Motion"
                value={motion ? "Detected" : "No Movement"}
              />
              <SensorCard
                label="Fire"
                value={fireStatus ? "ALERT" : "Safe"}
                good={!fireStatus}
              />
            </View>
          </View>

        </ScrollView>
      </SafeAreaView>

      {/* FOOTER */}
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

function DeviceCard({
  name,
  status,
  value,
  onChange
}: DeviceCardProps) {
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

function SensorCard({
  label,
  value,
  good
}: SensorCardProps) {
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

  header: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },

  safeHeader: { alignItems: 'center' },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 35,
    fontWeight: '700'
  },

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

  secureText: {
    fontSize: 18,
    fontWeight: '800'
  },

  deviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 0.6,
    borderColor: '#E6EBEF'
  },

  deviceName: {
    fontSize: 19,
    fontWeight: '800'
  },

  deviceStatus: {
    fontSize: 14,
    color: '#6B7280'
  },

  sensorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },

  sensorCard: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    padding: 18,
    borderRadius: 14,
    marginBottom: 16
  },

  sensorLabel: {
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '700'
  },

  sensorValue: {
    fontSize: 22,
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '900'
  },

  footer: {
    flexDirection: 'row',
    backgroundColor: '#2d313a'
  },

  footerItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20
  },

  footerItemActive: {
    backgroundColor: '#2d313a'
  },

  footerText: {
    color: '#9CA3AF',
    fontSize: 16
  },

  footerActive: {
    color: '#FFFFFF',
    fontWeight: '800'
  }
});
