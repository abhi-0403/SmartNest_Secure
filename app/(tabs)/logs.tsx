import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, NativeSyntheticEvent, NativeScrollEvent,
  PanResponder, Animated, Easing, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { router, usePathname } from 'expo-router';
import { database } from '../../firebaseConfig';
import { ref, onValue, off, remove, get } from 'firebase/database';
import Svg, { Path, Circle, Line, Text as SvgText, Rect, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';

/* ══════════════════════════════════════════
   LIGHT THEME — identical to index.tsx
══════════════════════════════════════════ */
const THEME = {
  bg:           '#F4F6FA',
  surface:      '#FFFFFF',
  surfaceAlt:   '#EEF1F8',
  card:         '#FFFFFF',

  border:       '#E2E8F0',
  borderLight:  '#EDF2F7',

  accent:       '#0EA5E9',
  accentDark:   '#0284C7',
  accentSoft:   '#E0F2FE',

  violet:       '#7C3AED',
  violetSoft:   '#EDE9FE',

  success:      '#059669',
  successSoft:  '#D1FAE5',
  warning:      '#D97706',
  warningSoft:  '#FEF3C7',
  danger:       '#DC2626',
  dangerSoft:   '#FEE2E2',
  sky:          '#0EA5E9',
  skySoft:      '#E0F2FE',
  yellow:       '#D97706',
  yellowSoft:   '#FEF3C7',
  amber:        '#F59E0B',

  textPrimary:  '#0F172A',
  textSecond:   '#475569',
  textMuted:    '#94A3B8',
  textInverse:  '#FFFFFF',

  shadow:       'rgba(15,23,42,0.08)',
  shadowMd:     'rgba(15,23,42,0.12)',
};

interface FirebaseLogRaw { type: string; value: string | number | boolean; timestamp: number; }
interface LogType { id: string; firebaseKey: string; type: string; value: string | number | boolean; timestamp: number; }
interface TimeRange { label: string; seconds: number; maxPoints: number; }
interface GraphData { dataPoints: number[]; timestamps: number[]; minVal: number; maxVal: number; range: number; fromTime: string; toTime: string; }

const { width } = Dimensions.get('window');
const TAB_WIDTH     = 110;
const LOGS_PER_PAGE = 10;

const CHART_W  = width - 68;
const CHART_H  = 205;
const PAD_L    = 40;
const PAD_R    = 10;
const PAD_T    = 16;
const PAD_B    = 28;
const PLOT_W   = CHART_W - PAD_L - PAD_R;
const PLOT_H   = CHART_H - PAD_T - PAD_B;

const TIME_RANGES: TimeRange[] = [
  { label: '30M', seconds: 30 * 60,          maxPoints: 6 },
  { label: '1H',  seconds: 60 * 60,          maxPoints: 6 },
  { label: '3H',  seconds: 3 * 60 * 60,      maxPoints: 6 },
  { label: '8H',  seconds: 8 * 60 * 60,      maxPoints: 6 },
  { label: '12H', seconds: 12 * 60 * 60,     maxPoints: 6 },
  { label: '1D',  seconds: 24 * 60 * 60,     maxPoints: 6 },
  { label: '7D',  seconds: 7 * 24 * 60 * 60, maxPoints: 6 },
];

const TABS = [
  { label: 'Temperature', firebaseKey: 'temperature', color: '#D97706', suffix: '\u00B0C', icon: 'thermostat',            hasGraph: true  },
  { label: 'Humidity',    firebaseKey: 'humidity',    color: '#0EA5E9', suffix: '%',       icon: 'water-drop',            hasGraph: true  },
  { label: 'Gas',         firebaseKey: 'gas',         color: '#059669', suffix: '',        icon: 'air',                   hasGraph: true  },
  { label: 'Light',       firebaseKey: 'light',       color: '#F59E0B', suffix: '',        icon: 'lightbulb',             hasGraph: false },
  { label: 'Fan',         firebaseKey: 'fan',         color: '#7C3AED', suffix: '',        icon: 'mode-fan-off',          hasGraph: false },
  { label: 'Fire',        firebaseKey: 'fire',        color: '#DC2626', suffix: '',        icon: 'local-fire-department', hasGraph: false },
  { label: 'Motion',      firebaseKey: 'motion',      color: '#0284C7', suffix: '',        icon: 'directions-walk',       hasGraph: false },
];

function formatValue(type: string, value: string | number | boolean): { label: string; color: string; bg: string } {
  const t = type.toLowerCase(), v = String(value), isOn = v === '1' || v === 'true';
  if (t === 'light')  return isOn ? { label: 'Turned ON',       color: '#FFF', bg: '#059669'    } : { label: 'Turned OFF',     color: '#FFF', bg: THEME.textMuted };
  if (t === 'fan')    return isOn ? { label: 'Turned ON',       color: '#FFF', bg: '#7C3AED'    } : { label: 'Turned OFF',     color: '#FFF', bg: THEME.textMuted };
  if (t === 'fire')   return isOn ? { label: 'FIRE Detected!',  color: '#FFF', bg: THEME.danger } : { label: 'Fire Cleared',   color: '#FFF', bg: '#059669'       };
  if (t === 'motion') return isOn ? { label: 'Motion Detected', color: '#FFF', bg: '#0284C7'    } : { label: 'No Motion',      color: '#FFF', bg: THEME.textMuted };
  return { label: v, color: THEME.textPrimary, bg: 'transparent' };
}

const toX = (i: number, n: number) => PAD_L + (i / (n - 1)) * PLOT_W;
const toY = (v: number, min: number, rng: number) => PAD_T + PLOT_H - ((v - min) / rng) * PLOT_H;

function buildGraphData(logs: LogType[], key: string, range: TimeRange): GraphData | null {
  const now = Math.floor(Date.now() / 1000);
  const filtered = logs
    .filter(l => l.type?.toLowerCase() === key.toLowerCase() && l.timestamp >= now - range.seconds)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (filtered.length < 2) return null;
  const total = filtered.length, max = range.maxPoints;
  let sampled: LogType[] = total <= max ? filtered : [];
  if (total > max) { const step = (total - 1) / (max - 1); for (let i = 0; i < max; i++) sampled.push(filtered[Math.round(i * step)]); }
  const dataPoints = sampled.map(l => parseFloat(parseFloat(String(l.value)).toFixed(1)));
  const timestamps = sampled.map(l => l.timestamp);
  const minRaw = Math.min(...dataPoints), maxRaw = Math.max(...dataPoints);
  const minVal = minRaw - 0.5, maxVal = maxRaw + 0.5, rng = maxVal - minVal || 1;
  return {
    dataPoints, timestamps, minVal, maxVal, range: rng,
    fromTime: new Date((now - range.seconds) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    toTime:   new Date(now * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

/* ─── SVG CHART ─────────────────────────────────────────────────── */
function SVGChart({ gd, touchIndex, color, suffix, onTouchStart, onTouchMove, onTouchEnd }: {
  gd: GraphData; touchIndex: number | null; color: string; suffix: string;
  onTouchStart: (x: number) => void; onTouchMove: (x: number) => void; onTouchEnd: () => void;
}) {
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true, onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,  onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderGrant:     e => onTouchStart(e.nativeEvent.locationX),
    onPanResponderMove:      e => onTouchMove(e.nativeEvent.locationX),
    onPanResponderRelease:   () => onTouchEnd(),
    onPanResponderTerminate: () => onTouchEnd(),
  })).current;

  const n = gd.dataPoints.length;
  const pts = gd.dataPoints.map((v, i) => ({ x: toX(i, n), y: toY(v, gd.minVal, gd.range) }));

  let line = 'M ' + pts[0].x + ' ' + pts[0].y;
  for (let i = 1; i < pts.length; i++) {
    const cx = (pts[i-1].x + pts[i].x) / 2;
    line += ' C ' + cx + ' ' + pts[i-1].y + ' ' + cx + ' ' + pts[i].y + ' ' + pts[i].x + ' ' + pts[i].y;
  }
  const area = line + ' L ' + pts[pts.length-1].x + ' ' + (PAD_T + PLOT_H) + ' L ' + PAD_L + ' ' + (PAD_T + PLOT_H) + ' Z';

  const ySteps = 4;
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => ({
    val: (gd.minVal + (gd.range * i) / ySteps).toFixed(1),
    y: PAD_T + PLOT_H - (PLOT_H * i) / ySteps,
  }));

  const tip = touchIndex !== null ? {
    x: pts[touchIndex].x, y: pts[touchIndex].y,
    val: gd.dataPoints[touchIndex],
    time: new Date(gd.timestamps[touchIndex] * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  } : null;

  const tLeft = tip ? (tip.x + 50 > CHART_W ? tip.x - 94 : tip.x + 8) : 0;
  const tTop  = tip ? (tip.y - 52 < PAD_T   ? tip.y + 10 : tip.y - 52) : 0;
  const gid   = 'g' + color.replace('#', '');

  return (
    <View style={{ width: CHART_W, height: CHART_H }}>
      <Svg width={CHART_W} height={CHART_H}>
        <Defs>
          <SvgGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.18" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </SvgGradient>
        </Defs>
        {/* Grid lines — light theme uses a soft slate tint */}
        {yLabels.map((yl, i) => (
          <Line key={'g'+i} x1={PAD_L} y1={yl.y} x2={CHART_W - PAD_R} y2={yl.y}
            stroke="rgba(15,23,42,0.07)" strokeWidth={1} />
        ))}
        {yLabels.map((yl, i) => (
          <SvgText key={'l'+i} x={PAD_L - 5} y={yl.y + 4} fontSize={9}
            fill={THEME.textMuted} textAnchor="end">{yl.val}</SvgText>
        ))}
        <Path d={area} fill={'url(#' + gid + ')'} />
        <Path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <Circle key={'d'+i} cx={p.x} cy={p.y} r={touchIndex === i ? 7 : 3.5}
            fill={touchIndex === i ? color : THEME.surface} stroke={color} strokeWidth={2} />
        ))}
        {tip ? (
          <>
            <Line x1={tip.x} y1={PAD_T} x2={tip.x} y2={PAD_T + PLOT_H}
              stroke={color + '66'} strokeWidth={1} strokeDasharray="4,3" />
            <Rect x={tLeft} y={tTop} width={92} height={42} rx={10}
              fill={THEME.surface} stroke={color} strokeWidth={1} />
            <SvgText x={tLeft+46} y={tTop+16} fontSize={13} fontWeight="bold"
              fill={color} textAnchor="middle">{tip.val.toFixed(1) + suffix}</SvgText>
            <SvgText x={tLeft+46} y={tTop+32} fontSize={10}
              fill={THEME.textSecond} textAnchor="middle">{tip.time}</SvgText>
          </>
        ) : null}
        {pts.map((p, i) => {
          const timeStr = new Date(gd.timestamps[i] * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const anchor  = i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle';
          const xPos    = i === 0 ? PAD_L : i === pts.length - 1 ? CHART_W - PAD_R : p.x;
          return (
            <SvgText key={'xt'+i} x={xPos} y={CHART_H - 4}
              fontSize={8} fill={THEME.textMuted} textAnchor={anchor as any}>
              {timeStr}
            </SvgText>
          );
        })}
      </Svg>
      <View {...pan.panHandlers} style={{ position: 'absolute', top: 0, left: 0, width: CHART_W, height: CHART_H, backgroundColor: 'transparent' }} />
    </View>
  );
}

/* ─── SENSOR GRAPH CARD ─────────────────────────────────────────── */
function SensorGraphCard({ logs, firebaseKey, color, suffix, label, icon }: {
  logs: LogType[]; firebaseKey: string; color: string; suffix: string; label: string; icon: string;
}) {
  const [sel, setSel] = useState<TimeRange>(TIME_RANGES[2]);
  const [ti, setTi]   = useState<number | null>(null);
  const gdRef         = useRef<GraphData | null>(null);
  const gd            = buildGraphData(logs, firebaseKey, sel);
  gdRef.current       = gd;

  const onMove = (x: number) => {
    const d = gdRef.current;
    if (!d || d.dataPoints.length < 2) return;
    let nearest = 0, minD = Infinity;
    for (let i = 0; i < d.dataPoints.length; i++) {
      const dist = Math.abs(x - toX(i, d.dataPoints.length));
      if (dist < minD) { minD = dist; nearest = i; }
    }
    setTi(nearest);
  };

  return (
    <View style={[s.graphCard, { borderLeftColor: color }]}>
      <View style={s.graphInner}>
        <View style={s.graphHeader}>
          <View style={s.graphTitleRow}>
            <View style={[s.graphIconBox, { backgroundColor: color + '22' }]}>
              <MaterialIcons name={icon as any} size={18} color={color} />
            </View>
            <Text style={s.graphTitle}>{label}</Text>
          </View>
          {gd ? (
            <View style={s.graphStats}>
              <View style={[s.statPill, { backgroundColor: color + '15' }]}>
                <Text style={[s.statLabel, { color }]}>{'Lo  ' + Math.min(...gd.dataPoints).toFixed(1) + suffix}</Text>
              </View>
              <View style={[s.statPill, { backgroundColor: color + '15', marginLeft: 6 }]}>
                <Text style={[s.statLabel, { color }]}>{'Hi  ' + Math.max(...gd.dataPoints).toFixed(1) + suffix}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={s.rangeScroll} contentContainerStyle={s.rangeContent} nestedScrollEnabled>
          {TIME_RANGES.map(r => (
            <TouchableOpacity key={r.label} onPress={() => { setSel(r); setTi(null); }}
              style={[s.rangeBtn, sel.label === r.label ? { backgroundColor: color, borderColor: color } : null]}>
              <Text style={[s.rangeBtnTxt, sel.label === r.label ? { color: '#FFFFFF' } : null]}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {gd ? (
          <SVGChart gd={gd} touchIndex={ti} color={color} suffix={suffix}
            onTouchStart={onMove} onTouchMove={onMove} onTouchEnd={() => setTimeout(() => setTi(null), 2000)} />
        ) : (
          <View style={s.noData}>
            <View style={s.noDataIcon}>
              <MaterialIcons name="bar-chart" size={28} color={THEME.textMuted} />
            </View>
            <Text style={s.noDataTxt}>{'No data for ' + sel.label}</Text>
            <Text style={s.noDataSub}>Try a longer time range</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/* ─── DELETE BUTTON ─────────────────────────────────────────────── */
function DeleteLogsButton({ tabLabel, firebaseKey, count }: { tabLabel: string; firebaseKey: string; count: number; }) {
  const [busy, setBusy] = useState(false);
  const handleDelete = () => {
    if (count === 0) return;
    Alert.alert('Delete ' + tabLabel + ' Logs',
      'Delete all ' + count + ' entries? Cannot be undone.',
      [{ text: 'Cancel', style: 'cancel' }, {
        text: 'Delete All', style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            const snap = await get(ref(database, 'logs'));
            const data = snap.val();
            if (data && typeof data === 'object') {
              await Promise.all(Object.entries(data)
                .filter(([, v]) => (v as FirebaseLogRaw).type?.toLowerCase() === firebaseKey.toLowerCase())
                .map(([k]) => remove(ref(database, 'logs/' + k))));
            }
            Alert.alert('Deleted', tabLabel + ' logs cleared.', [{ text: 'OK' }]);
          } catch { Alert.alert('Error', 'Failed. Try again.', [{ text: 'OK' }]); }
          finally  { setBusy(false); }
        },
      }],
      { cancelable: true }
    );
  };
  return (
    <TouchableOpacity onPress={handleDelete} disabled={busy || count === 0}
      activeOpacity={0.8}
      style={[s.delBtn, count === 0 ? s.delBtnOff : { borderColor: 'rgba(220,38,38,0.25)' }]}>
      <View style={[s.delInner, count === 0 ? { backgroundColor: THEME.surfaceAlt } : { backgroundColor: THEME.dangerSoft }]}>
        <MaterialIcons name={busy ? 'hourglass-empty' : 'delete-sweep'} size={18}
          color={count === 0 ? THEME.textMuted : THEME.danger} />
        <Text style={[s.delTxt, count === 0 ? { color: THEME.textMuted } : null]}>
          {busy ? 'Deleting...' : 'Clear All ' + count + ' Logs'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/* ─── PAGINATED LOGS ────────────────────────────────────────────── */
function PaginatedLogs({ logs, title, accentColor, icon, firebaseKey }: {
  logs: LogType[]; title: string; accentColor: string; icon: string; firebaseKey: string;
}) {
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [logs.length]);
  const total = Math.max(1, Math.ceil(logs.length / LOGS_PER_PAGE));
  const start = page * LOGS_PER_PAGE;
  const slice = logs.slice(start, start + LOGS_PER_PAGE);
  const countLabel = logs.length > 0
    ? String(start+1) + '\u2013' + String(Math.min(start + LOGS_PER_PAGE, logs.length)) + ' of ' + String(logs.length) : '';

  return (
    <View style={s.logsCard}>
      <View style={s.logsHeader}>
        <View style={s.logsTitleRow}>
          <View style={[s.logsIconBox, { backgroundColor: accentColor + '22' }]}>
            <MaterialIcons name={icon as any} size={16} color={accentColor} />
          </View>
          <Text style={[s.logsTitle, { color: accentColor }]}>{title + ' Logs'}</Text>
        </View>
        {logs.length > 0 ? <Text style={s.logsCount}>{countLabel}</Text> : null}
      </View>

      {logs.length === 0 ? (
        <View style={s.emptyBox}>
          <MaterialIcons name="inbox" size={32} color={THEME.textMuted} />
          <Text style={s.emptyTxt}>No logs available</Text>
        </View>
      ) : slice.map(log => (
        <LogItem key={log.id} type={log.type} value={log.value} timestamp={log.timestamp} accentColor={accentColor} />
      ))}

      {total > 1 ? (
        <View style={s.pagination}>
          <TouchableOpacity onPress={() => setPage(p => Math.max(0, p-1))} disabled={page===0}
            style={[s.pageBtn, { backgroundColor: accentColor }, page===0 ? s.pageBtnOff : null]}>
            <Text style={[s.pageBtnTxt, page===0 ? { color: THEME.textMuted } : null]}>Prev</Text>
          </TouchableOpacity>
          <View style={s.pageDots}>
            {(() => {
              // Build a deduplicated window of up to 5 page numbers centred on `page`
              const maxDots = Math.min(total, 5);
              let start = Math.max(0, page - Math.floor(maxDots / 2));
              const end  = Math.min(total - 1, start + maxDots - 1);
              start = Math.max(0, end - maxDots + 1); // re-clamp start if end hit the ceiling
              return Array.from({ length: end - start + 1 }, (_, i) => {
                const pn     = start + i;
                const active = pn === page;
                return (
                  <TouchableOpacity key={pn} onPress={() => setPage(pn)}
                    style={[s.pageDot, active ? { backgroundColor: accentColor } : null]}>
                    <Text style={[s.pageDotTxt, active ? s.pageDotTxtActive : null]}>{pn + 1}</Text>
                  </TouchableOpacity>
                );
              });
            })()}
          </View>
          <TouchableOpacity onPress={() => setPage(p => Math.min(total-1, p+1))} disabled={page===total-1}
            style={[s.pageBtn, { backgroundColor: accentColor }, page===total-1 ? s.pageBtnOff : null]}>
            <Text style={[s.pageBtnTxt, page===total-1 ? { color: THEME.textMuted } : null]}>Next</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={s.delSep} />
      <DeleteLogsButton tabLabel={title} firebaseKey={firebaseKey} count={logs.length} />
    </View>
  );
}

/* ─── LOG ITEM ──────────────────────────────────────────────────── */
function LogItem({ type, value, timestamp, accentColor }: {
  type: string; value: string | number | boolean; timestamp: number; accentColor: string;
}) {
  const fmt   = formatValue(type, value);
  const badge = fmt.bg !== 'transparent';
  return (
    <View style={s.logItem}>
      <View style={s.logRow}>
        {badge ? (
          <View style={[s.logBadge, { backgroundColor: fmt.bg }]}>
            <Text style={[s.logBadgeTxt, { color: fmt.color }]}>{fmt.label}</Text>
          </View>
        ) : (
          <View style={s.logValRow}>
            <Text style={[s.logType, { color: THEME.textMuted }]}>{type}</Text>
            <View style={[s.logValPill, { backgroundColor: accentColor + '18' }]}>
              <Text style={[s.logVal, { color: accentColor }]}>{fmt.label}</Text>
            </View>
          </View>
        )}
      </View>
      <Text style={s.logTime}>{new Date(timestamp * 1000).toLocaleString()}</Text>
    </View>
  );
}

/* ─── MAIN SCREEN ───────────────────────────────────────────────── */
export default function LogsScreen() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [logs, setLogs]               = useState<LogType[]>([]);
  const pageRef    = useRef<ScrollView>(null);
  const tabRef     = useRef<ScrollView>(null);
  const liveDot    = useRef(new Animated.Value(1)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const pathname   = usePathname();

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1, duration: 700,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();

    Animated.loop(Animated.sequence([
      Animated.timing(liveDot, { toValue: 0.2, duration: 900, useNativeDriver: true }),
      Animated.timing(liveDot, { toValue: 1,   duration: 900, useNativeDriver: true }),
    ])).start();
  }, []);

  useEffect(() => {
    const lr = ref(database, 'logs');
    const listener = onValue(lr, snap => {
      const data = snap.val();
      if (!data || typeof data !== 'object') { setLogs([]); return; }
      const parsed: LogType[] = Object.entries(data).map(([k, v]) => {
        const l = v as FirebaseLogRaw;
        return { id: k + '_' + l.timestamp, firebaseKey: k, type: l.type, value: l.value, timestamp: l.timestamp };
      });
      parsed.sort((a, b) => b.timestamp - a.timestamp);
      setLogs(parsed);
    });
    return () => off(lr, 'value', listener);
  }, []);

  const scrollTo = (i: number) => {
    pageRef.current?.scrollTo({ x: i * width, animated: true });
    tabRef.current?.scrollTo({ x: i * TAB_WIDTH - width/2 + TAB_WIDTH/2, animated: true });
  };
  const onTabPress  = (i: number) => { setActiveIndex(i); scrollTo(i); };
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveIndex(i);
    tabRef.current?.scrollTo({ x: i * TAB_WIDTH - width/2 + TAB_WIDTH/2, animated: true });
  };

  return (
    <View style={s.root}>
      {/* Dark text status bar — matches index.tsx */}
      <StatusBar style="dark" translucent backgroundColor="transparent" />

      {/* ── HEADER — flush to top, SafeAreaView handles status bar inset ── */}
      <SafeAreaView edges={['top']} style={s.safeHeader}>
        <Animated.View style={{ opacity: headerAnim }}>
          <LinearGradient
            colors={['#FFFFFF', '#F8FAFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.header}
          >
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
                  <MaterialIcons name="history" size={20} color="#FFFFFF" />
                </LinearGradient>
                <View>
                  <Text style={s.headerSub}>SMART HOME</Text>
                  <Text style={s.headerTitle}>Activity Logs</Text>
                </View>
              </View>

              {/* Right pills */}
              <View style={s.headerRight}>
                <View style={s.deviceCountPill}>
                  <View style={[s.pillDot, { backgroundColor: logs.length > 0 ? THEME.accent : THEME.textMuted }]} />
                  <Text style={[s.deviceCountText, { color: logs.length > 0 ? THEME.accent : THEME.textMuted }]}>
                    {logs.length + ' events'}
                  </Text>
                </View>
                <View style={s.livePill}>
                  <Animated.View style={[s.liveDot, { opacity: liveDot }]} />
                  <Text style={s.liveText}>LIVE</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      </SafeAreaView>

      {/* ── TAB BAR ── */}
      <View style={s.tabBar}>
        <ScrollView ref={tabRef} horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabContent}>
          {TABS.map((tab, i) => {
            const active = activeIndex === i;
            return (
              <TouchableOpacity key={tab.label} onPress={() => onTabPress(i)}
                style={[
                  s.tabItem,
                  active
                    ? { backgroundColor: tab.color + '18', borderColor: tab.color + '50' }
                    : null,
                ]}>
                <MaterialIcons name={tab.icon as any} size={14}
                  color={active ? tab.color : THEME.textMuted} />
                <Text style={[s.tabTxt, active ? { color: tab.color } : null]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── PAGED CONTENT ── */}
      <ScrollView ref={pageRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd} style={{ flex: 1 }}>
        {TABS.map(tab => {
          const fl = logs.filter(l => l.type?.toLowerCase() === tab.firebaseKey.toLowerCase());
          return (
            <View key={tab.label} style={s.page}>
              <ScrollView showsVerticalScrollIndicator={false}
                contentContainerStyle={s.pageContent} nestedScrollEnabled>
                {tab.hasGraph ? (
                  <SensorGraphCard logs={logs} firebaseKey={tab.firebaseKey}
                    color={tab.color} suffix={tab.suffix} label={tab.label} icon={tab.icon} />
                ) : null}
                <PaginatedLogs logs={fl} title={tab.label} accentColor={tab.color}
                  icon={tab.icon} firebaseKey={tab.firebaseKey} />
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>

      {/* ── FOOTER NAV — identical to index.tsx ── */}
      <View style={s.footerWrap}>
        <View style={s.footerTopBorder} />
        <SafeAreaView edges={['bottom']} style={s.footer}>
          {[
            { label: 'Home', icon: 'home',    path: '/' },
            { label: 'Logs', icon: 'history', path: '/logs' },
          ].map(tab => {
            const active = pathname === tab.path;
            const onPress = tab.path === '/'
              ? () => { if (pathname !== '/') router.replace('/'); }
              : () => { if (pathname !== '/logs') router.replace('/logs'); };
            return (
              <TouchableOpacity key={tab.label} onPress={onPress} style={s.footerTab} activeOpacity={0.7}>
                <View style={[s.footerIconWrap, active && s.footerIconActive]}>
                  <MaterialIcons name={tab.icon as any} size={22}
                    color={active ? THEME.accent : THEME.textMuted} />
                </View>
                <Text style={[s.footerText, active && s.footerTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </SafeAreaView>
      </View>
    </View>
  );
}

/* ══════════════════════════════════════════
   STYLES
══════════════════════════════════════════ */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.bg },

  /* ── Header — mirrors index.tsx exactly ── */
  safeHeader: {
    backgroundColor: '#FFFFFF', // prevents flash of bg colour behind status bar
  },
  header: {
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
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
    paddingTop: 10,
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
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(14,165,233,0.2)',
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  deviceCountText: { fontSize: 11, fontWeight: '700' },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: THEME.successSoft,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(5,150,105,0.2)',
  },
  liveDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: THEME.success },
  liveText: { color: THEME.success, fontSize: 10, fontWeight: '800', letterSpacing: 2 },

  /* ── Tab bar ── */
  tabBar: {
    backgroundColor: THEME.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    paddingVertical: 10,
    shadowColor: THEME.shadow,
    shadowOpacity: 1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  tabContent: { paddingHorizontal: 12, gap: 8 },
  tabItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: THEME.border,
    backgroundColor: THEME.bg,
  },
  tabTxt: { fontSize: 12, fontWeight: '700', color: THEME.textMuted },

  /* ── Pages ── */
  page:        { width },
  pageContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 },

  /* ── Graph card ── */
  graphCard: {
    backgroundColor: THEME.surface,
    borderRadius: 16, marginBottom: 16,
    borderLeftWidth: 3, borderWidth: 1,
    borderColor: THEME.border,
    shadowColor: THEME.shadow, shadowOpacity: 1,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  graphInner:    { padding: 16, borderRadius: 16 },
  graphHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  graphTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  graphIconBox:  { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  graphTitle:    { color: THEME.textPrimary, fontSize: 16, fontWeight: '800' },
  graphStats:    { flexDirection: 'row', alignItems: 'center' },
  statPill:      { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  statLabel:     { fontSize: 11, fontWeight: '700' },
  rangeScroll:   { marginBottom: 14, flexGrow: 0 },
  rangeContent:  { gap: 8, paddingRight: 4 },
  rangeBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: THEME.bg, borderWidth: 1, borderColor: THEME.border,
  },
  rangeBtnTxt: { color: THEME.textSecond, fontSize: 12, fontWeight: '700' },
  noData:      { paddingVertical: 40, alignItems: 'center', gap: 10 },
  noDataIcon:  {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: THEME.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  noDataTxt: { color: THEME.textSecond, fontSize: 14, fontWeight: '700' },
  noDataSub: { color: THEME.textMuted,  fontSize: 12 },

  /* ── Logs card ── */
  logsCard: {
    backgroundColor: THEME.surface,
    borderRadius: 16, borderWidth: 1, borderColor: THEME.border,
    padding: 18, marginBottom: 16,
    shadowColor: THEME.shadow, shadowOpacity: 1,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  logsHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  logsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logsIconBox:  { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  logsTitle:    { fontSize: 16, fontWeight: '800' },
  logsCount:    { fontSize: 11, color: THEME.textMuted, fontWeight: '600' },
  emptyBox:     { paddingVertical: 32, alignItems: 'center', gap: 10 },
  emptyTxt:     { color: THEME.textMuted, fontSize: 14, fontWeight: '600' },

  /* ── Log items ── */
  logItem:    { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: THEME.borderLight },
  logRow:     { flexDirection: 'row', alignItems: 'center' },
  logValRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logType:    { fontSize: 12, fontWeight: '600' },
  logValPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  logVal:     { fontSize: 13, fontWeight: '700' },
  logBadge:   { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  logBadgeTxt:{ fontSize: 12, fontWeight: '700' },
  logTime:    { fontSize: 11, color: THEME.textMuted, marginTop: 5 },

  /* ── Pagination ── */
  pagination:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: THEME.border },
  pageBtn:         { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20 },
  pageBtnOff:      { backgroundColor: THEME.surfaceAlt },
  pageBtnTxt:      { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  pageDots:        { flexDirection: 'row', gap: 5, alignItems: 'center' },
  pageDot:         { minWidth: 28, height: 28, borderRadius: 14, backgroundColor: THEME.surfaceAlt, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  pageDotTxt:      { fontSize: 11, fontWeight: '700', color: THEME.textMuted },
  pageDotTxtActive:{ color: '#FFFFFF' },

  /* ── Delete button ── */
  delSep:   { height: 1, backgroundColor: THEME.border, marginTop: 18, marginBottom: 14 },
  delBtn:   { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  delBtnOff:{ borderColor: THEME.border, opacity: 0.5 },
  delInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 20, borderRadius: 14 },
  delTxt:   { color: THEME.danger, fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },

  /* ── Footer nav — mirrors index.tsx exactly ── */
  footerWrap:       { position: 'absolute', bottom: 0, left: 0, right: 0 },
  footerTopBorder:  { height: 1, backgroundColor: THEME.border },
  footer:           { flexDirection: 'row', backgroundColor: THEME.surface, paddingTop: 4 },
  footerTab:        { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 3 },
  footerIconWrap:   { width: 46, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  footerIconActive: { backgroundColor: THEME.accentSoft },
  footerText:       { color: THEME.textMuted, fontSize: 11, fontWeight: '600' },
  footerTextActive: { color: THEME.accent,    fontWeight: '800' },
});
