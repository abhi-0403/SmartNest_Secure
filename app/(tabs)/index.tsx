import React, { useState, useEffect, useRef } from 'react';
import { database } from "../../firebaseConfig";
import { ref, set, onValue } from "firebase/database";
import {
  StyleSheet, Text, View, Switch, ScrollView,
  TouchableOpacity, Animated, Easing, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { router, usePathname } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

/* ── Voice (silenced for Expo Go) ── */
const ExpoSpeechRecognitionModule = {
  requestPermissionsAsync: async () => ({ granted: false }),
  start: (_o: any) => {}, stop: () => {},
};
const useSpeechRecognitionEvent = (_e: string, _cb: any) => {};

const { width } = Dimensions.get('window');

/* ══════════════════════════════════════════
   THEME
══════════════════════════════════════════ */
const THEME = {
  bg:          '#0A0A14',
  surface:     '#12121F',
  border:      '#1E1E3A',
  accent:      '#6C63FF',
  accentSoft:  'rgba(108,99,255,0.15)',
  success:     '#22D3A5',
  successSoft: 'rgba(34,211,165,0.12)',
  warning:     '#F59E0B',
  warningSoft: 'rgba(245,158,11,0.12)',
  danger:      '#FF5757',
  dangerSoft:  'rgba(255,87,87,0.12)',
  sky:         '#38BDF8',
  skySoft:     'rgba(56,189,248,0.12)',
  yellow:      '#FCD34D',
  yellowSoft:  'rgba(252,211,77,0.12)',
  textPrimary: '#F0EEFF',
  textSecond:  '#8B84C4',
  textMuted:   '#4A4580',
};

/* ══════════════════════════════════════════
   MAIN SCREEN
══════════════════════════════════════════ */
export default function HomeScreen() {

  const [lightOn,     setLightOn]     = useState(false);
  const [fanOn,       setFanOn]       = useState(false);
  const [secureMode,  setSecureMode]  = useState(false);
  const [temperature, setTemperature] = useState<number>(0);
  const [humidity,    setHumidity]    = useState<number>(0);
  const [gasLevel,    setGasLevel]    = useState<number>(0);
  const [motion,      setMotion]      = useState(false);
  const [fireStatus,  setFireStatus]  = useState(false);
  const [micActive,   setMicActive]   = useState(false);

  const pathname = usePathname();

  /* ── Animations ── */
  const scaleAnim   = useRef(new Animated.Value(1)).current;
  const pulseRef    = useRef<Animated.CompositeAnimation | null>(null);
  const headerAnim  = useRef(new Animated.Value(0)).current;
  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const slideAnim   = useRef(new Animated.Value(30)).current;
  const firePulse   = useRef(new Animated.Value(1)).current;
  const fanRotate   = useRef(new Animated.Value(0)).current;
  const fanRotRef   = useRef<Animated.CompositeAnimation | null>(null);
  const liveDotAnim = useRef(new Animated.Value(1)).current;

  /* ── Mount animations ── */
  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerAnim, {
        toValue: 1, duration: 700,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(200),
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(slideAnim, {
            toValue: 0, duration: 600,
            easing: Easing.out(Easing.cubic), useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();

    /* Live dot breathe */
    Animated.loop(Animated.sequence([
      Animated.timing(liveDotAnim, { toValue: 0.2, duration: 900, useNativeDriver: true }),
      Animated.timing(liveDotAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
    ])).start();
  }, []);

  /* ── Fire pulse ── */
  useEffect(() => {
    if (fireStatus) {
      Animated.loop(Animated.sequence([
        Animated.timing(firePulse, {
          toValue: 1.04, duration: 400,
          easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
        Animated.timing(firePulse, {
          toValue: 1, duration: 400,
          easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
      ])).start();
    } else {
      firePulse.stopAnimation();
      firePulse.setValue(1);
    }
  }, [fireStatus]);

  /* ── Fan spin ── */
  useEffect(() => {
    if (fanOn) {
      fanRotRef.current = Animated.loop(
        Animated.timing(fanRotate, {
          toValue: 1, duration: 1200,
          easing: Easing.linear, useNativeDriver: true,
        })
      );
      fanRotRef.current.start();
    } else {
      fanRotRef.current?.stop();
      fanRotate.setValue(0);
    }
  }, [fanOn]);

  const fanSpin = fanRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  /* ── Mic pulse ── */
  const startPulse = () => {
    pulseRef.current = Animated.loop(Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2, duration: 600,
        easing: Easing.inOut(Easing.ease), useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1, duration: 600,
        easing: Easing.inOut(Easing.ease), useNativeDriver: true,
      }),
    ]));
    pulseRef.current.start();
  };
  const stopPulse = () => { pulseRef.current?.stop(); scaleAnim.setValue(1); };

  /* ── Voice commands ── */
  const handleVoiceCommand = (text: string) => {
    const cmd = text.trim().toLowerCase();
    if      (cmd === 'turn on light')       set(ref(database, 'devices/light'), true);
    else if (cmd === 'turn off light')      set(ref(database, 'devices/light'), false);
    else if (cmd === 'turn on fan')         set(ref(database, 'devices/fan'), true);
    else if (cmd === 'turn off fan')        set(ref(database, 'devices/fan'), false);
    else if (cmd === 'enable secure mode')  set(ref(database, 'modes/secure_mode'), true);
    else if (cmd === 'disable secure mode') set(ref(database, 'modes/secure_mode'), false);
  };

  useSpeechRecognitionEvent('result', (event: any) => {
    if (event.results?.length > 0) {
      handleVoiceCommand(event.results[0]?.transcript ?? '');
      ExpoSpeechRecognitionModule.stop();
      setMicActive(false); stopPulse();
    }
  });
  useSpeechRecognitionEvent('error', () => {
    ExpoSpeechRecognitionModule.stop(); setMicActive(false); stopPulse();
  });

  const handleMicPress = async () => {
    const next = !micActive;
    setMicActive(next);
    if (next) {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) { setMicActive(false); return; }
      startPulse();
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US', interimResults: false, maxAlternatives: 1, continuous: false,
      });
    } else {
      stopPulse(); ExpoSpeechRecognitionModule.stop();
    }
  };

  /* ── Firebase ── */
  useEffect(() => {
    const u1 = onValue(ref(database, 'devices'), (snap) => {
      const d = snap.val();
      if (d) { setLightOn(d.light ?? false); setFanOn(d.fan ?? false); }
    });
    const u2 = onValue(ref(database, 'modes'), (snap) => {
      const d = snap.val();
      if (d) setSecureMode(d.secure_mode ?? false);
    });
    const u3 = onValue(ref(database, 'sensors'), (snap) => {
      const d = snap.val();
      if (d) {
        setTemperature(d.temperature ?? 0);
        setHumidity(d.humidity ?? 0);
        setGasLevel(d.gas_level ?? 0);
        setMotion(d.motion ?? false);
        setFireStatus(d.fire_status ?? false);
      }
    });
    return () => { u1(); u2(); u3(); };
  }, []);

  const goHome = () => { if (pathname !== '/') router.replace('/'); };
  const goLogs = () => { if (pathname !== '/logs') router.replace('/logs'); };

  /* ── Derived values — all pre-built as plain strings ── */
  const gasColor  = gasLevel > 780 ? THEME.danger  : gasLevel > 500 ? THEME.warning  : THEME.success;
  const gasBg     = gasLevel > 780 ? THEME.dangerSoft : gasLevel > 500 ? THEME.warningSoft : THEME.successSoft;
  const gasBadge  = gasLevel > 780 ? 'DANGER' : gasLevel > 500 ? 'WARN' : '';

  const activeDevices      = [lightOn, fanOn].filter(Boolean).length;
  const activeDevicesLabel = activeDevices === 0 ? 'None active' : String(activeDevices) + ' active';

  const tempLabel   = String(temperature) + '\u00B0C';   // °
  const humidLabel  = String(humidity) + '%';

  const secureSub   = secureMode  ? 'Armed - SMS alerts active' : 'Tap switch to arm';
  const lightSub    = lightOn     ? 'On - Room illuminated'     : 'Off - Tap to turn on';
  const fanSubText  = fanOn       ? 'Running - Full speed'      : 'Off - Tap to turn on';

  const tempVal   = String(temperature) + '\u00B0C';
  const humVal    = String(humidity) + '%';
  const gasVal    = String(gasLevel);
  const motionVal = motion ? 'Detected' : 'Clear';

  const fireMainText  = fireStatus ? 'FIRE DETECTED' : 'No Fire Detected';
  const fireSub       = fireStatus ? 'Take action immediately!' : 'System is monitoring';
  const fireBadgeText = fireStatus ? 'ALERT' : 'ALL CLEAR';

  const headerTranslateY = headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] });

  return (
    <View style={s.root}>
      {/*
        style="light"      → white icons/text on the status bar
        translucent        → status bar sits on top of content (no coloured strip)
        backgroundColor    → Android: the semi-transparent strip behind icons stays dark
      */}
      <StatusBar style="light" translucent backgroundColor="rgba(13,13,31,0.95)" />

      {/* ── HEADER ── */}
      <Animated.View style={{ opacity: headerAnim, transform: [{ translateY: headerTranslateY }] }}>
        <LinearGradient
          colors={['#0D0D1F', '#12122A', '#0A0A18']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.header}
        >
          <View style={s.headerOrb} />
          <View style={s.headerOrb2} />

          <SafeAreaView edges={['top']}>
            <View style={s.headerInner}>

              {/* Brand */}
              <View style={s.headerBrand}>
                <LinearGradient colors={[THEME.accent, '#9B8CFF']} style={s.headerIconGrad}>
                  <MaterialIcons name="home" size={20} color="#FFFFFF" />
                </LinearGradient>
                <View>
                  <Text style={s.headerSub}>SMART HOME</Text>
                  <Text style={s.headerTitle}>SmartNest</Text>
                </View>
              </View>

              {/* Pills */}
              <View style={s.headerRight}>
                <View style={s.deviceCountPill}>
                  <Text style={s.deviceCountText}>{activeDevicesLabel}</Text>
                </View>
                <View style={s.livePill}>
                  <Animated.View style={[s.liveDot, { opacity: liveDotAnim }]} />
                  <Text style={s.liveText}>LIVE</Text>
                </View>
              </View>
            </View>

            {/* Stats bar */}
            <View style={s.headerStats}>
              <View style={s.headerStat}>
                <MaterialIcons name="thermostat" size={14} color={THEME.warning} />
                <Text style={s.headerStatVal}>{tempLabel}</Text>
              </View>
              <View style={s.headerStatDivider} />
              <View style={s.headerStat}>
                <MaterialIcons name="water-drop" size={14} color={THEME.sky} />
                <Text style={s.headerStatVal}>{humidLabel}</Text>
              </View>
              <View style={s.headerStatDivider} />
              <View style={s.headerStat}>
                <MaterialIcons
                  name={secureMode ? 'lock' : 'lock-open'}
                  size={14}
                  color={secureMode ? THEME.danger : THEME.textMuted}
                />
                <Text style={[s.headerStatVal, { color: secureMode ? THEME.danger : THEME.textMuted }]}>
                  {secureMode ? 'Armed' : 'Disarmed'}
                </Text>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </Animated.View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* ── FIRE ALERT BANNER ── */}
          {fireStatus ? (
            <Animated.View style={{ transform: [{ scale: firePulse }], marginBottom: 16 }}>
              <LinearGradient colors={['#FF3B3B', '#CC0000']} style={s.fireBanner}>
                <View style={s.fireBannerIcon}>
                  <MaterialIcons name="local-fire-department" size={22} color="#FFFFFF" />
                </View>
                <View style={s.fireBannerTextWrap}>
                  <Text style={s.fireBannerTitle}>{fireMainText}</Text>
                  <Text style={s.fireBannerSub}>{fireSub}</Text>
                </View>
                <MaterialIcons name="warning" size={20} color="rgba(255,255,255,0.6)" />
              </LinearGradient>
            </Animated.View>
          ) : null}

          {/* ── SECURITY ── */}
          <Text style={s.sectionLabel}>SECURITY</Text>
          <View style={[s.card, secureMode ? s.cardArmed : null]}>
            <LinearGradient
              colors={
                secureMode
                  ? ['rgba(255,87,87,0.08)', 'rgba(255,87,87,0.02)']
                  : ['rgba(255,255,255,0.03)', 'rgba(255,255,255,0)']
              }
              style={s.cardGrad}
            >
              <View style={s.cardRow}>
                <View style={s.cardRowLeft}>
                  <View style={[s.iconBox, {
                    backgroundColor: secureMode ? THEME.dangerSoft : 'rgba(255,255,255,0.06)',
                  }]}>
                    <MaterialIcons
                      name={secureMode ? 'lock' : 'lock-open'}
                      size={22}
                      color={secureMode ? THEME.danger : THEME.textSecond}
                    />
                  </View>
                  <View style={s.cardTextWrap}>
                    <Text style={s.cardTitle}>Secure Mode</Text>
                    <Text style={[s.cardSub, { color: secureMode ? THEME.danger : THEME.textMuted }]}>
                      {secureSub}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={secureMode}
                  onValueChange={(v) => set(ref(database, 'modes/secure_mode'), v)}
                  trackColor={{ false: 'rgba(255,255,255,0.1)', true: THEME.danger }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </LinearGradient>
          </View>

          {/* ── DEVICES ── */}
          <Text style={s.sectionLabel}>DEVICES</Text>

          {/* LIGHT */}
          <View style={[s.card, lightOn ? s.cardActive : null]}>
            <LinearGradient
              colors={
                lightOn
                  ? ['rgba(252,211,77,0.08)', 'rgba(252,211,77,0.02)']
                  : ['rgba(255,255,255,0.03)', 'rgba(255,255,255,0)']
              }
              style={s.cardGrad}
            >
              <View style={s.cardRow}>
                <View style={s.cardRowLeft}>
                  <View style={[s.iconBox, {
                    backgroundColor: lightOn ? THEME.yellowSoft : 'rgba(255,255,255,0.06)',
                  }]}>
                    <MaterialIcons
                      name="lightbulb"
                      size={22}
                      color={lightOn ? THEME.yellow : THEME.textMuted}
                    />
                  </View>
                  <View style={s.cardTextWrap}>
                    <Text style={s.cardTitle}>Ceiling Light</Text>
                    <Text style={[s.cardSub, { color: lightOn ? THEME.yellow : THEME.textMuted }]}>
                      {lightSub}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={lightOn}
                  onValueChange={(v) => set(ref(database, 'devices/light'), v)}
                  trackColor={{ false: 'rgba(255,255,255,0.1)', true: THEME.yellow }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </LinearGradient>
          </View>

          {/* FAN */}
          <View style={[s.card, fanOn ? s.cardFan : null]}>
            <LinearGradient
              colors={
                fanOn
                  ? ['rgba(56,189,248,0.08)', 'rgba(56,189,248,0.02)']
                  : ['rgba(255,255,255,0.03)', 'rgba(255,255,255,0)']
              }
              style={s.cardGrad}
            >
              <View style={s.cardRow}>
                <View style={s.cardRowLeft}>
                  <View style={[s.iconBox, {
                    backgroundColor: fanOn ? THEME.skySoft : 'rgba(255,255,255,0.06)',
                  }]}>
                    <Animated.View style={{ transform: [{ rotate: fanSpin }] }}>
                      <MaterialCommunityIcons
                        name="fan"
                        size={22}
                        color={fanOn ? THEME.sky : THEME.textMuted}
                      />
                    </Animated.View>
                  </View>
                  <View style={s.cardTextWrap}>
                    <Text style={s.cardTitle}>Ceiling Fan</Text>
                    <Text style={[s.cardSub, { color: fanOn ? THEME.sky : THEME.textMuted }]}>
                      {fanSubText}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={fanOn}
                  onValueChange={(v) => set(ref(database, 'devices/fan'), v)}
                  trackColor={{ false: 'rgba(255,255,255,0.1)', true: THEME.sky }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </LinearGradient>
          </View>

          {/* ── SENSORS ── */}
          <Text style={s.sectionLabel}>SENSORS</Text>

          <View style={s.sensorGrid}>
            <SensorTile
              icon="thermostat"
              iconFamily="material"
              label="Temperature"
              value={tempVal}
              color={THEME.warning}
              bg={THEME.warningSoft}
              badge=""
            />
            <SensorTile
              icon="water-drop"
              iconFamily="material"
              label="Humidity"
              value={humVal}
              color={THEME.sky}
              bg={THEME.skySoft}
              badge=""
            />
            <SensorTile
              icon="air"
              iconFamily="material"
              label="Gas Level"
              value={gasVal}
              color={gasColor}
              bg={gasBg}
              badge={gasBadge}
            />
            <SensorTile
              icon={motion ? 'directions-walk' : 'accessibility-new'}
              iconFamily="material"
              label="Motion"
              value={motionVal}
              color={motion ? '#A78BFA' : THEME.textMuted}
              bg={motion ? 'rgba(167,139,250,0.1)' : 'rgba(255,255,255,0.03)'}
              badge=""
            />

            {/* Fire tile — full width */}
            <View style={s.sensorTileWide}>
              <View style={[
                s.sensorTileInner,
                { backgroundColor: fireStatus ? THEME.dangerSoft : THEME.successSoft },
              ]}>
                <View style={s.sensorTileTop}>
                  <View style={[s.sensorIconBox, {
                    backgroundColor: fireStatus ? 'rgba(255,87,87,0.2)' : 'rgba(34,211,165,0.2)',
                  }]}>
                    <MaterialIcons
                      name={fireStatus ? 'local-fire-department' : 'verified-user'}
                      size={20}
                      color={fireStatus ? THEME.danger : THEME.success}
                    />
                  </View>
                  <View>
                    <Text style={s.sensorLabel}>Fire Status</Text>
                    <Text style={[s.fireTileBadge, { color: fireStatus ? THEME.danger : THEME.success }]}>
                      {fireBadgeText}
                    </Text>
                  </View>
                  <View style={s.spacer} />
                  <View style={[s.statusDot, {
                    backgroundColor: fireStatus ? THEME.danger : THEME.success,
                  }]} />
                </View>
                <Text style={[s.sensorValueWide, { color: fireStatus ? THEME.danger : THEME.success }]}>
                  {fireMainText}
                </Text>
              </View>
            </View>
          </View>

          <View style={s.bottomPad} />
        </Animated.View>
      </ScrollView>

      {/* ── MIC FAB ── */}
      <Animated.View style={[s.micWrap, { transform: [{ scale: scaleAnim }] }]}>
        {micActive ? <View style={s.micRing} /> : null}
        <TouchableOpacity onPress={handleMicPress} activeOpacity={0.85}>
          <LinearGradient
            colors={micActive ? [THEME.success, '#16A34A'] : [THEME.accent, '#9B8CFF']}
            style={s.micBtn}
          >
            <MaterialIcons
              name={micActive ? 'mic' : 'mic-none'}
              size={26}
              color="#FFFFFF"
            />
          </LinearGradient>
        </TouchableOpacity>
        {micActive ? <Text style={s.micHint}>Listening...</Text> : null}
      </Animated.View>

      {/* ── FOOTER NAV ── */}
      <View style={s.footerWrap}>
        <LinearGradient
          colors={['rgba(10,10,20,0)', '#0A0A14']}
          style={s.footerBlur}
        />
        <SafeAreaView edges={['bottom']} style={s.footer}>
          <TouchableOpacity onPress={goHome} style={s.footerTab} activeOpacity={0.7}>
            <View style={[s.footerIconWrap, pathname === '/' ? s.footerIconActive : null]}>
              <MaterialIcons
                name="home"
                size={22}
                color={pathname === '/' ? THEME.accent : THEME.textMuted}
              />
            </View>
            <Text style={[s.footerText, pathname === '/' ? s.footerTextActive : null]}>
              Home
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goLogs} style={s.footerTab} activeOpacity={0.7}>
            <View style={[s.footerIconWrap, pathname === '/logs' ? s.footerIconActive : null]}>
              <MaterialIcons
                name="history"
                size={22}
                color={pathname === '/logs' ? THEME.accent : THEME.textMuted}
              />
            </View>
            <Text style={[s.footerText, pathname === '/logs' ? s.footerTextActive : null]}>
              Logs
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </View>
  );
}

/* ══════════════════════════════════════════
   SENSOR TILE
══════════════════════════════════════════ */
type SensorTileProps = {
  icon: string;
  iconFamily: 'material' | 'community';
  label: string;
  value: string;
  color: string;
  bg: string;
  badge: string;
};

function SensorTile({ icon, iconFamily, label, value, color, bg, badge }: SensorTileProps) {
  return (
    <View style={s.sensorTile}>
      <View style={[s.sensorTileInner, { backgroundColor: bg }]}>
        <View style={s.sensorTileTop}>
          <View style={[s.sensorIconBox, { backgroundColor: color + '22' }]}>
            {iconFamily === 'community'
              ? <MaterialCommunityIcons name={icon as any} size={20} color={color} />
              : <MaterialIcons name={icon as any} size={20} color={color} />
            }
          </View>
          <Text style={s.sensorLabel}>{label}</Text>
        </View>
        <Text style={[s.sensorValue, { color }]}>{value}</Text>
        {badge !== '' ? (
          <View style={[s.sensorBadgeBox, { backgroundColor: color + '22' }]}>
            <Text style={[s.sensorBadgeText, { color }]}>{badge}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/* ══════════════════════════════════════════
   STYLES
══════════════════════════════════════════ */
const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: THEME.bg },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 20 },
  spacer:        { flex: 1 },
  bottomPad:     { height: 120 },

  /* ── Header ── */
  header: { paddingBottom: 18, overflow: 'hidden' },
  headerOrb: {
    position: 'absolute', top: -60, right: -30,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(108,99,255,0.12)',
  },
  headerOrb2: {
    position: 'absolute', top: 20, left: -50,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(108,99,255,0.06)',
  },
  headerInner: {
    paddingHorizontal: 20, paddingTop: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconGrad: {
    width: 42, height: 42, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: THEME.accent, shadowOpacity: 0.5,
    shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  headerSub:   { color: THEME.textMuted,   fontSize: 9,  fontWeight: '800', letterSpacing: 3 },
  headerTitle: { color: THEME.textPrimary, fontSize: 26, fontWeight: '900', letterSpacing: -0.5, marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deviceCountPill: {
    backgroundColor: THEME.accentSoft,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(108,99,255,0.2)',
  },
  deviceCountText: { color: THEME.accent, fontSize: 11, fontWeight: '700' },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(34,211,165,0.1)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(34,211,165,0.2)',
  },
  liveDot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: THEME.success },
  liveText: { color: THEME.success, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  headerStats: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: THEME.border,
  },
  headerStat:        { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center' },
  headerStatVal:     { color: THEME.textSecond, fontSize: 13, fontWeight: '700' },
  headerStatDivider: { width: 1, height: 16, backgroundColor: THEME.border },

  /* ── Fire Banner ── */
  fireBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, padding: 16,
    shadowColor: '#FF3B3B', shadowOpacity: 0.4,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  fireBannerIcon: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  fireBannerTextWrap: { flex: 1 },
  fireBannerTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  fireBannerSub:   { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },

  /* ── Section label ── */
  sectionLabel: {
    color: THEME.textMuted, fontSize: 10, fontWeight: '800',
    letterSpacing: 3, marginBottom: 10, marginTop: 8, marginLeft: 2,
  },

  /* ── Card ── */
  card: {
    borderRadius: 18, marginBottom: 10,
    borderWidth: 1, borderColor: THEME.border,
    overflow: 'hidden', backgroundColor: THEME.surface,
  },
  cardGrad:    {},
  cardActive:  { borderColor: 'rgba(252,211,77,0.25)' },
  cardArmed:   { borderColor: 'rgba(255,87,87,0.3)' },
  cardFan:     { borderColor: 'rgba(56,189,248,0.25)' },
  cardRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  cardRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  cardTextWrap:{ flex: 1 },
  cardTitle:   { color: THEME.textPrimary, fontSize: 15, fontWeight: '700' },
  cardSub:     { color: THEME.textMuted,   fontSize: 12, marginTop: 2, fontWeight: '500' },
  textSecond:  { color: THEME.textSecond },

  /* Icon box */
  iconBox: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  /* ── Sensor grid ── */
  sensorGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sensorTile:      { width: '48%' },
  sensorTileWide:  { width: '100%' },
  sensorTileInner: { borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  sensorTileTop:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sensorIconBox:   { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sensorLabel:     { color: THEME.textSecond, fontSize: 11, fontWeight: '600', flex: 1 },
  fireTileBadge:   { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  sensorValue:     { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  sensorValueWide: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5, marginTop: 4 },
  sensorBadgeBox:  { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  sensorBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  statusDot:       { width: 8, height: 8, borderRadius: 4 },

  /* ── Mic FAB ── */
  micWrap: { position: 'absolute', bottom: 96, right: 20, alignItems: 'center' },
  micRing: {
    position: 'absolute',
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 2, borderColor: THEME.success, opacity: 0.4,
  },
  micBtn: {
    width: 60, height: 60, borderRadius: 30,
    justifyContent: 'center', alignItems: 'center',
    elevation: 12,
    shadowColor: THEME.accent, shadowOpacity: 0.5,
    shadowRadius: 14, shadowOffset: { width: 0, height: 5 },
  },
  micHint: { color: THEME.success, fontSize: 9, fontWeight: '800', marginTop: 7, letterSpacing: 1.5 },

  /* ── Footer ── */
  footerWrap: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  footerBlur: { height: 20 },
  footer: {
    flexDirection: 'row',
    backgroundColor: THEME.surface,
    borderTopWidth: 1, borderTopColor: THEME.border,
    paddingTop: 4,
  },
  footerTab:        { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 4 },
  footerIconWrap:   { width: 48, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  footerIconActive: { backgroundColor: THEME.accentSoft },
  footerText:       { color: THEME.textMuted, fontSize: 11, fontWeight: '600' },
  footerTextActive: { color: THEME.accent, fontWeight: '800' },
});
