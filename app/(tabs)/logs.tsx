import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { router, usePathname } from 'expo-router';
import { database } from "../../firebaseConfig";
import { ref, onValue, off } from "firebase/database";

interface FirebaseLogRaw {
  type: string;
  value: string | number | boolean;
  timestamp: number;
}

interface LogType {
  id: string;
  type: string;
  value: string | number | boolean;
  timestamp: number;
}

const { width } = Dimensions.get("window");
const TAB_WIDTH = 120;

export default function LogsScreen() {

  const tabs: string[] = [
    "Temperature",
    "Humidity",
    "Light",
    "Fan",
    "Fire",
    "Motion",
    "Gas"
  ];

  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [logs, setLogs] = useState<LogType[]>([]);

  const pageScrollRef = useRef<ScrollView>(null);
  const tabScrollRef = useRef<ScrollView>(null);

  const pathname = usePathname();

  /* ================= FETCH LOGS ================= */

  useEffect(() => {
    const logsRef = ref(database, "logs");

    const listener = onValue(logsRef, (snapshot) => {
      const data = snapshot.val();

      if (!data || typeof data !== "object") {
        setLogs([]);
        return;
      }

      const parsedLogs: LogType[] = Object.entries(data).map(
        ([firebaseKey, value]) => {
          const log = value as FirebaseLogRaw;

          return {
            id: `${firebaseKey}_${log.timestamp}`,
            type: log.type,
            value: log.value,
            timestamp: log.timestamp,
          };
        }
      );

      parsedLogs.sort((a, b) => b.timestamp - a.timestamp);
      setLogs(parsedLogs);
    });

    return () => {
      off(logsRef, "value", listener);
    };

  }, []);

  /* ================= TAB PRESS ================= */

  const handleTabPress = (index: number) => {
    setActiveIndex(index);
    pageScrollRef.current?.scrollTo({ x: index * width, animated: true });
    scrollTabToIndex(index);
  };

  /* ================= PAGE SWIPE ================= */

  const handleScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const index = Math.round(
      event.nativeEvent.contentOffset.x / width
    );
    setActiveIndex(index);
    scrollTabToIndex(index);
  };

  /* ================= AUTO SCROLL TABS ================= */

  const scrollTabToIndex = (index: number) => {
    tabScrollRef.current?.scrollTo({
      x: index * TAB_WIDTH - width / 2 + TAB_WIDTH / 2,
      animated: true
    });
  };

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

      {/* ===== HEADER ===== */}
      <LinearGradient
        colors={['#1b2735', '#2c3e50', '#3a556c']}
        style={styles.header}
      >
        <SafeAreaView edges={[]} style={styles.safeHeader}>
          <Text style={styles.headerTitle}>SmartNest</Text>
        </SafeAreaView>
      </LinearGradient>

      {/* ===== TABS ===== */}
      <View style={styles.tabContainer}>
        <ScrollView
          ref={tabScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {tabs.map((tab, index) => (
            <TouchableOpacity
              key={tab}
              onPress={() => handleTabPress(index)}
              style={[
                styles.tabItem,
                activeIndex === index && styles.activeTab
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  activeIndex === index && styles.activeTabText
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ===== PAGES ===== */}
      <ScrollView
        ref={pageScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
      >
        {tabs.map((tab) => {

          const filteredLogs = logs.filter(
            (log) =>
              log.type?.toLowerCase() === tab.toLowerCase()
          );

          return (
            <View key={tab} style={styles.page}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.mainContainer}>

                  <Text style={styles.sectionTitle}>
                    {tab} Logs
                  </Text>

                  {filteredLogs.length === 0 ? (
                    <Text style={styles.emptyText}>
                      No logs available.
                    </Text>
                  ) : (
                    filteredLogs.map((log) => (
                      <LogItem
                        key={log.id}
                        type={log.type}
                        value={log.value}
                        timestamp={log.timestamp}
                      />
                    ))
                  )}

                </View>
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>

      {/* ===== FOOTER ===== */}
      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <TouchableOpacity
          onPress={goHome}
          style={styles.footerItem}
        >
          <Text style={styles.footerText}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={goLogs}
          style={styles.footerItem}
        >
          <Text style={styles.footerText}>Logs</Text>
        </TouchableOpacity>
      </SafeAreaView>

    </View>
  );
}

/* ================= LOG ITEM ================= */

function LogItem({
  type,
  value,
  timestamp
}: {
  type: string;
  value: string | number | boolean;
  timestamp: number;
}) {

  const formattedTime = new Date(timestamp).toLocaleString();

  return (
    <View style={styles.logItem}>
      <Text style={styles.logText}>
        {type} → {String(value)}
      </Text>
      <Text style={styles.timeText}>
        {formattedTime}
      </Text>
    </View>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({

  root: {
    flex: 1,
    backgroundColor: '#F4F6F8'
  },

  header: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },

  safeHeader: {
    alignItems: 'center'
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 35,
    fontWeight: '700'
  },

  tabContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12
  },

  tabItem: {
    width: TAB_WIDTH,
    alignItems: 'center',
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: '#E5E7EB'
  },

  activeTab: {
    backgroundColor: '#a9bc63'
  },

  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151'
  },

  activeTabText: {
    color: '#005c12'
  },

  page: {
    width: width,
    flex: 1
  },

  mainContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 18,
    marginTop: 18,
    borderRadius: 16,
    padding: 20,
    elevation: 3
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 20,
    textAlign: 'center',
    color: '#212d46'
  },

  emptyText: {
    textAlign: 'center',
    color: '#6B7280'
  },

  logItem: {
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderColor: '#E5E7EB'
  },

  logText: {
    fontSize: 15,
    color: '#c0a109',
    fontWeight: '600'
  },

  timeText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4
  },

  footer: {
    flexDirection: 'row',
    backgroundColor: '#2b312b'
  },

  footerItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20
  },

  footerText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600'
  }

});
