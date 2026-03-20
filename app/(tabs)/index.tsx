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
   LIGHT THEME — Soft White + Teal Mint + Slate
══════════════════════════════════════════ */
const THEME = {
  // Backgrounds
  bg:            '#F4F6FA',
  surface:       '#FFFFFF',
  surfaceAlt:    '#EEF1F8',
  card:          '#FFFFFF',

  // Borders
  border:        '#E2E8F0',
  borderLight:   '#EDF2F7',

  // Accent — deep teal
  accent:        '#0EA5E9',
  accentDark:    '#0284C7',
  accentSoft:    '#E0F2FE',

  // Secondary accent — violet
  violet:        '#7C3AED',
  violetSoft:    '#EDE9FE',

  // Semantic
  success:       '#059669',
  successSoft:   '#D1FAE5',
  warning:       '#D97706',
  warningSoft:   '#FEF3C7',
  danger:        '#DC2626',
  dangerSoft:    '#FEE2E2',
  sky:           '#0EA5E9',
  skySoft:       '#E0F2FE',
  yellow:        '#D97706',
  yellowSoft:    '#FEF3C7',
  amber:         '#F59E0B',
  amberSoft:     '#FFFBEB',

  // Text
  textPrimary:   '#0F172A',
  textSecond:    '#475569',
  textMuted:     '#94A3B8',
  textInverse:   '#FFFFFF',

  // Shadow
  shadow:        'rgba(15,23,42,0.08)',
  shadowMd:      'rgba(15,23,42,0.12)',
};

export default function HomeScreen() {
  const [lightOn,     setLightOn]     = useState(false);
  const [fanOn,       setFanOn]       = useState(false);
  const [secureMode,  setSecureMode]  = useState(false);
  const [temperature, setTemperature] = useState<number>(0);
  const [humidity,    setHumidity]    = useState<number>(0);
  const [gasLevel,    setGasLevel]     = useState<number>(0);
  const [motion,      setMotion]      = useState(false);
  const [fireStatus,  setFireStatus]   = useState(false);
  const [micActive,   setMicActive]    = useState(false);

  const pathname = usePathname();

  const scaleAnim   = useRef(new Animated.Value(1)).current;
  const pulseRef    = useRef<Animated.CompositeAnimation | null>(null);
  const headerAnim  = useRef(new Animated.Value(0)).current;
  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const slideAnim   = useRef(new Animated.Value(30)).current;
  const firePulse   = useRef(new Animated.Value(1)).current;
  const fanRotate   = useRef(new Animated.Value(0)).current;
  const fanRotRef   = useRef<Animated.CompositeAnimation | null>(null);
  const liveDotAnim = useRef(new Animated.Value(1)).current;

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

    Animated.loop(Animated.sequence([
      Animated.timing(liveDotAnim, { toValue: 0.2, duration: 900, useNativeDriver: true }),
      Animated.timing(liveDotAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
    ])).start();
  }, []);

  useEffect(() => {
    if (fireStatus) {
      Animated.loop(Animated.sequence([
        Animated.timing(firePulse, {
          toValue: 1.03, duration: 450,
          easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
        Animated.timing(firePulse, {
          toValue: 1, duration: 450,
          easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
      ])).start();
    } else {
      firePulse.stopAnimation();
      firePulse.setValue(1);
    }
  }, [fireStatus]);

  useEffect(() => {
    if (fanOn) {
      fanRotRef.current = Animated.loop(
        Animated.timing(fanRotate, {
          toValue: 1, duration: 1000,
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

  const startPulse = () => {
    pulseRef.current = Animated.loop(Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.18, duration: 550,
        easing: Easing.inOut(Easing.ease), useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1, duration: 550,
        easing: Easing.inOut(Easing.ease), useNativeDriver: true,
      }),
    ]));
    pulseRef.current.start();
  };

  const stopPulse = () => {
    pulseRef.current?.stop();
    scaleAnim.setValue(1);
  };

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
      setMicActive(false);
      stopPulse();
    }
  });

  useSpeechRecognitionEvent('error', () => {
    ExpoSpeechRecognitionModule.stop();
    setMicActive(false);
    stopPulse();
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
      stopPulse();
      ExpoSpeechRecognitionModule.stop();
    }
  };

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

  const goHome      = () => { if (pathname !== '/')         router.replace('/'); };
  const goLogs      = () => { if (pathname !== '/logs')     router.replace('/logs'); };
  const goEmergency = () => { if (pathname !== '/emergency') router.push('/emergency'); };

  const gasColor = gasLevel > 780 ? THEME.danger  : gasLevel > 500 ? THEME.warning  : THEME.success;
  const gasBg    = gasLevel > 780 ? THEME.dangerSoft : gasLevel > 500 ? THEME.warningSoft : THEME.successSoft;
  const gasBadge = gasLevel > 780 ? 'DANGER' : gasLevel > 500 ? 'WARN' : '';

  const activeDevices      = [lightOn, fanOn].filter(Boolean).length;
  const activeDevicesLabel = activeDevices === 0 ? 'None active' : `${activeDevices} active`;

  const tempLabel  = `${temperature}°C`;
  const humidLabel = `${humidity}%`;

  const secureSub  = secureMode ? 'Armed · SMS alerts active' : 'Tap to arm the system';
  const lightSub   = lightOn    ? 'On · Room illuminated'     : 'Off · Tap to turn on';
  const fanSubText = fanOn      ? 'Running · Full speed'      : 'Off · Tap to turn on';

  const gasVal    = String(gasLevel);
  const motionVal = motion ? 'Detected' : 'Clear';

  const fireMainText  = fireStatus ? 'FIRE DETECTED'    : 'No Fire Detected';
  const fireSub       = fireStatus ? 'Take action now!' : 'System monitoring';
  const fireBadgeText = fireStatus ? 'ALERT'            : 'ALL CLEAR';

  return (
    <View style={s.root}>
      {/* Light status bar — system UI (clock, battery, signal) will show in dark/black */}
      <StatusBar style="dark" translucent backgroundColor="transparent" />

      {/* ── HEADER — SafeAreaView outside so no gap above gradient ── */}
      <SafeAreaView edges={['top']} style={s.safeHeader}>
        <Animated.View style={{ opacity: headerAnim }}>
          <LinearGradient
            colors={['#FFFFFF', '#F8FAFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.header}
          >
            {/* Subtle decorative orbs */}
            <View style={s.headerOrb} />
            <View style={s.headerOrb2} />

            <View style={s.headerInner}>
              {/* Brand */}
              <View style={s.headerBrand}>
                <LinearGradient
                  colors={[THEME.accent, THEME.accentDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.headerIconGrad}
                >
                  <MaterialIcons name="home" size={20} color="#FFFFFF" />
                </LinearGradient>
                <View>
                  <Text style={s.headerSub}>SMART HOME</Text>
                  <Text style={s.headerTitle}>SmartNest</Text>
                </View>
              </View>

              {/* Right pills */}
              <View style={s.headerRight}>
                <View style={s.deviceCountPill}>
                  <View style={[s.pillDot, { backgroundColor: activeDevices > 0 ? THEME.accent : THEME.textMuted }]} />
                  <Text style={[s.deviceCountText, { color: activeDevices > 0 ? THEME.accent : THEME.textMuted }]}>
                    {activeDevicesLabel}
                  </Text>
                </View>
                <View style={s.livePill}>
                  <Animated.View style={[s.liveDot, { opacity: liveDotAnim }]} />
                  <Text style={s.liveText}>LIVE</Text>
                </View>
              </View>
            </View>

            {/* Stats strip */}
            <View style={s.headerStats}>
              <View style={s.headerStat}>
                <View style={[s.statIcon, { backgroundColor: THEME.warningSoft }]}>
                  <MaterialIcons name="thermostat" size={13} color={THEME.warning} />
                </View>
                <Text style={s.headerStatVal}>{tempLabel}</Text>
              </View>
              <View style={s.headerStatDivider} />
              <View style={s.headerStat}>
                <View style={[s.statIcon, { backgroundColor: THEME.skySoft }]}>
                  <MaterialIcons name="water-drop" size={13} color={THEME.sky} />
                </View>
                <Text style={s.headerStatVal}>{humidLabel}</Text>
              </View>
              <View style={s.headerStatDivider} />
              <View style={s.headerStat}>
                <View style={[s.statIcon, {
                  backgroundColor: secureMode ? THEME.dangerSoft : THEME.surfaceAlt,
                }]}>
                  <MaterialIcons
                    name={secureMode ? 'lock' : 'lock-open'}
                    size={13}
                    color={secureMode ? THEME.danger : THEME.textMuted}
                  />
                </View>
                <Text style={[s.headerStatVal, { color: secureMode ? THEME.danger : THEME.textMuted }]}>
                  {secureMode ? 'Armed' : 'Disarmed'}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      </SafeAreaView>

      {/* ── SCROLL BODY ── */}
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* Fire alert banner */}
          {fireStatus ? (
            <Animated.View style={{ transform: [{ scale: firePulse }], marginBottom: 14 }}>
              <LinearGradient colors={['#DC2626', '#B91C1C']} style={s.fireBanner}>
                <View style={s.fireBannerIcon}>
                  <MaterialIcons name="local-fire-department" size={22} color="#FFFFFF" />
                </View>
                <View style={s.fireBannerTextWrap}>
                  <Text style={s.fireBannerTitle}>{fireMainText}</Text>
                  <Text style={s.fireBannerSub}>{fireSub}</Text>
                </View>
                <MaterialIcons name="warning" size={20} color="rgba(255,255,255,0.7)" />
              </LinearGradient>
            </Animated.View>
          ) : null}

          {/* Emergency button */}
          <TouchableOpacity onPress={goEmergency} activeOpacity={0.82} style={s.emergencyBtnWrap}>
            <View style={s.emergencyBtn}>
              <View style={s.emergencyIconWrap}>
                <MaterialIcons name="emergency" size={20} color={THEME.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.emergencyBtnTitle}>Emergency Corner</Text>
                <Text style={s.emergencyBtnSub}>Fire Extinguisher · Medical Help</Text>
              </View>
              <View style={s.emergencyChevronWrap}>
                <MaterialIcons name="chevron-right" size={20} color={THEME.danger} />
              </View>
            </View>
          </TouchableOpacity>

          {/* ── SECURITY ── */}
          <SectionLabel text="SECURITY" />

          <View style={[s.card, secureMode && s.cardArmed]}>
            <View style={s.cardRow}>
              <View style={s.cardRowLeft}>
                <View style={[s.iconBox, {
                  backgroundColor: secureMode ? THEME.dangerSoft : THEME.surfaceAlt,
                }]}>
                  <MaterialIcons
                    name={secureMode ? 'lock' : 'lock-open'}
                    size={22}
                    color={secureMode ? THEME.danger : THEME.textMuted}
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
                trackColor={{ false: THEME.border, true: THEME.danger }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={THEME.border}
              />
            </View>
          </View>

          {/* ── DEVICES ── */}
          <SectionLabel text="DEVICES" />

          {/* Light card */}
          <View style={[s.card, lightOn && s.cardActiveYellow]}>
            <View style={s.cardRow}>
              <View style={s.cardRowLeft}>
                <View style={[s.iconBox, {
                  backgroundColor: lightOn ? THEME.yellowSoft : THEME.surfaceAlt,
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
                trackColor={{ false: THEME.border, true: THEME.amber }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={THEME.border}
              />
            </View>
          </View>

          {/* Fan card */}
          <View style={[s.card, fanOn && s.cardActiveSky]}>
            <View style={s.cardRow}>
              <View style={s.cardRowLeft}>
                <View style={[s.iconBox, {
                  backgroundColor: fanOn ? THEME.skySoft : THEME.surfaceAlt,
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
                trackColor={{ false: THEME.border, true: THEME.sky }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={THEME.border}
              />
            </View>
          </View>

          {/* ── SENSORS ── */}
          <SectionLabel text="SENSORS" />

          <View style={s.sensorGrid}>
            <SensorTile
              icon="thermostat" iconFamily="material"
              label="Temperature" value={`${temperature}°C`}
              color={THEME.warning} bg={THEME.warningSoft} badge=""
            />
            <SensorTile
              icon="water-drop" iconFamily="material"
              label="Humidity" value={`${humidity}%`}
              color={THEME.sky} bg={THEME.skySoft} badge=""
            />
            <SensorTile
              icon="air" iconFamily="material"
              label="Gas Level" value={gasVal}
              color={gasColor} bg={gasBg} badge={gasBadge}
            />
            <SensorTile
              icon={motion ? 'directions-walk' : 'accessibility-new'} iconFamily="material"
              label="Motion" value={motionVal}
              color={motion ? THEME.violet : THEME.textMuted}
              bg={motion ? THEME.violetSoft : THEME.surfaceAlt}
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
                    backgroundColor: fireStatus
                      ? 'rgba(220,38,38,0.15)'
                      : 'rgba(5,150,105,0.15)',
                  }]}>
                    <MaterialIcons
                      name={fireStatus ? 'local-fire-department' : 'verified-user'}
                      size={20}
                      color={fireStatus ? THEME.danger : THEME.success}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.sensorLabel}>Fire Status</Text>
                    <Text style={[s.fireTileBadge, {
                      color: fireStatus ? THEME.danger : THEME.success,
                    }]}>{fireBadgeText}</Text>
                  </View>
                  <View style={[s.statusDot, {
                    backgroundColor: fireStatus ? THEME.danger : THEME.success,
                  }]} />
                </View>
                <Text style={[s.sensorValueWide, {
                  color: fireStatus ? THEME.danger : THEME.success,
                }]}>{fireMainText}</Text>
              </View>
            </View>
          </View>

          <View style={s.bottomPad} />
        </Animated.View>
      </ScrollView>

      {/* ── MIC FAB ── */}
      <Animated.View style={[s.micWrap, { transform: [{ scale: scaleAnim }] }]}>
        {micActive && <View style={s.micRing} />}
        <TouchableOpacity onPress={handleMicPress} activeOpacity={0.85}>
          <LinearGradient
            colors={micActive
              ? [THEME.success, '#047857']
              : [THEME.accent, THEME.accentDark]}
            style={s.micBtn}
          >
            <MaterialIcons name={micActive ? 'mic' : 'mic-none'} size={26} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
        {micActive && <Text style={s.micHint}>Listening…</Text>}
      </Animated.View>

      {/* ── FOOTER NAV ── */}
      <View style={s.footerWrap}>
        <View style={s.footerTopBorder} />
        <SafeAreaView edges={['bottom']} style={s.footer}>
          <TouchableOpacity onPress={goHome} style={s.footerTab} activeOpacity={0.7}>
            <View style={[s.footerIconWrap, pathname === '/' && s.footerIconActive]}>
              <MaterialIcons
                name="home"
                size={22}
                color={pathname === '/' ? THEME.accent : THEME.textMuted}
              />
            </View>
            <Text style={[s.footerText, pathname === '/' && s.footerTextActive]}>Home</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={goLogs} style={s.footerTab} activeOpacity={0.7}>
            <View style={[s.footerIconWrap, pathname === '/logs' && s.footerIconActive]}>
              <MaterialIcons
                name="history"
                size={22}
                color={pathname === '/logs' ? THEME.accent : THEME.textMuted}
              />
            </View>
            <Text style={[s.footerText, pathname === '/logs' && s.footerTextActive]}>Logs</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </View>
  );
}

/* ── Helper: Section Label ── */
function SectionLabel({ text }: { text: string }) {
  return <Text style={s.sectionLabel}>{text}</Text>;
}

/* ── Helper: Sensor Tile ── */
type SensorTileProps = {
  icon: string; iconFamily: 'material' | 'community';
  label: string; value: string;
  color: string; bg: string; badge: string;
};

function SensorTile({ icon, iconFamily, label, value, color, bg, badge }: SensorTileProps) {
  return (
    <View style={s.sensorTile}>
      <View style={[s.sensorTileInner, { backgroundColor: bg }]}>
        <View style={s.sensorTileTop}>
          <View style={[s.sensorIconBox, { backgroundColor: color + '22' }]}>
            {iconFamily === 'community'
              ? <MaterialCommunityIcons name={icon as any} size={20} color={color} />
              : <MaterialIcons name={icon as any} size={20} color={color} />}
          </View>
          <Text style={s.sensorLabel}>{label}</Text>
        </View>
        <Text style={[s.sensorValue, { color }]}>{value}</Text>
        {badge !== '' && (
          <View style={[s.sensorBadgeBox, { backgroundColor: color + '22' }]}>
            <Text style={[s.sensorBadgeText, { color }]}>{badge}</Text>
          </View>
        )}
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
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },
  bottomPad:     { height: 120 },

  /* ── Header ── */
  safeHeader: {
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    // Subtle drop shadow beneath header
    shadowColor: THEME.shadowMd,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
    overflow: 'hidden',
  },
  headerOrb: {
    position: 'absolute', top: -50, right: -20,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(14,165,233,0.07)',
  },
  headerOrb2: {
    position: 'absolute', bottom: -30, left: -30,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(124,58,237,0.05)',
  },
  headerInner: {
    paddingHorizontal: 18,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  headerIconGrad: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: THEME.accent, shadowOpacity: 0.35,
    shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  headerSub: {
    color: THEME.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 3,
  },
  headerTitle: {
    color: THEME.textPrimary, fontSize: 24, fontWeight: '900', letterSpacing: -0.6, marginTop: 1,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deviceCountPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: THEME.accentSoft,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(14,165,233,0.2)',
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  deviceCountText: { fontSize: 11, fontWeight: '700' },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: THEME.successSoft,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(5,150,105,0.2)',
  },
  liveDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: THEME.success },
  liveText: { color: THEME.success, fontSize: 10, fontWeight: '800', letterSpacing: 2 },

  headerStats: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 18, marginTop: 12,
    backgroundColor: THEME.bg,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: THEME.border,
  },
  headerStat: {
    flexDirection: 'row', alignItems: 'center',
    gap: 7, flex: 1, justifyContent: 'center',
  },
  statIcon: {
    width: 24, height: 24, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
  },
  headerStatVal: {
    color: THEME.textSecond, fontSize: 13, fontWeight: '700',
  },
  headerStatDivider: { width: 1, height: 18, backgroundColor: THEME.border },

  /* ── Fire Banner ── */
  fireBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, padding: 16,
    shadowColor: '#DC2626', shadowOpacity: 0.25,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  fireBannerIcon: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  fireBannerTextWrap: { flex: 1 },
  fireBannerTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  fireBannerSub:   { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },

  /* ── Emergency ── */
  emergencyBtnWrap: { marginBottom: 14 },
  emergencyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: THEME.surface,
    borderWidth: 1, borderColor: 'rgba(220,38,38,0.2)',
    shadowColor: THEME.shadow, shadowOpacity: 1,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  emergencyIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: THEME.dangerSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  emergencyChevronWrap: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: THEME.dangerSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  emergencyBtnTitle: { color: THEME.textPrimary, fontSize: 15, fontWeight: '700' },
  emergencyBtnSub:   { color: THEME.textMuted, fontSize: 11, marginTop: 2, fontWeight: '500' },

  /* ── Section label ── */
  sectionLabel: {
    color: THEME.textMuted, fontSize: 10, fontWeight: '800',
    letterSpacing: 2.5, marginBottom: 10, marginTop: 6, marginLeft: 2,
  },

  /* ── Cards ── */
  card: {
    backgroundColor: THEME.surface,
    borderRadius: 16, marginBottom: 10,
    borderWidth: 1, borderColor: THEME.border,
    shadowColor: THEME.shadow, shadowOpacity: 1,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
    overflow: 'hidden',
  },
  cardActiveYellow: { borderColor: 'rgba(217,119,6,0.3)' },
  cardActiveSky:    { borderColor: 'rgba(14,165,233,0.3)' },
  cardArmed:        { borderColor: 'rgba(220,38,38,0.3)' },
  cardRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16,
  },
  cardRowLeft:  { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  cardTextWrap: { flex: 1 },
  cardTitle:    { color: THEME.textPrimary, fontSize: 15, fontWeight: '700' },
  cardSub:      { color: THEME.textMuted, fontSize: 12, marginTop: 2, fontWeight: '500' },
  iconBox: {
    width: 46, height: 46, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },

  /* ── Sensor Grid ── */
  sensorGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sensorTile:      { width: '48%' },
  sensorTileWide:  { width: '100%' },
  sensorTileInner: {
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(15,23,42,0.06)',
    shadowColor: THEME.shadow, shadowOpacity: 0.6,
    shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  sensorTileTop: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 12,
  },
  sensorIconBox: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  sensorLabel:    { color: THEME.textSecond, fontSize: 11, fontWeight: '600', flex: 1 },
  fireTileBadge:  { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 1 },
  sensorValue:    { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  sensorValueWide:{ fontSize: 20, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 },
  sensorBadgeBox: {
    alignSelf: 'flex-start', marginTop: 6,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  sensorBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  statusDot:       { width: 8, height: 8, borderRadius: 4 },

  /* ── Mic FAB ── */
  micWrap: { position: 'absolute', bottom: 94, right: 18, alignItems: 'center' },
  micRing: {
    position: 'absolute',
    width: 74, height: 74, borderRadius: 37,
    borderWidth: 2, borderColor: THEME.success, opacity: 0.45,
  },
  micBtn: {
    width: 58, height: 58, borderRadius: 29,
    justifyContent: 'center', alignItems: 'center',
    elevation: 10,
    shadowColor: THEME.accent, shadowOpacity: 0.4,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  micHint: {
    color: THEME.success, fontSize: 9, fontWeight: '800',
    marginTop: 6, letterSpacing: 1.5,
  },

  /* ── Footer Nav ── */
  footerWrap: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  footerTopBorder: { height: 1, backgroundColor: THEME.border },
  footer: {
    flexDirection: 'row',
    backgroundColor: THEME.surface,
    paddingTop: 4,
  },
  footerTab:        { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 3 },
  footerIconWrap:   {
    width: 46, height: 30, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  footerIconActive: { backgroundColor: THEME.accentSoft },
  footerText:       { color: THEME.textMuted, fontSize: 11, fontWeight: '600' },
  footerTextActive: { color: THEME.accent,    fontWeight: '800' },
});
