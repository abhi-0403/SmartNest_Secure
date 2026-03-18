import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  PanResponder,
  Animated,
  Easing,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { router, usePathname } from 'expo-router';
import { database } from '../../firebaseConfig';
import { ref, onValue, off, remove, get } from 'firebase/database';
import Svg, {
  Path, Circle, Line,
  Text as SvgText, Rect,
  Defs, LinearGradient as SvgGradient, Stop,
} from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';

/* ══════════════════════════════════════════
   THEME — identical to home screen
══════════════════════════════════════════ */
const THEME = {
  bg:          '#0A0A14',
  surface:     '#12121F',
  surfaceAlt:  '#1A1A2E',
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

/* ================= TYPES ================= */
interface FirebaseLogRaw {
  type: string;
  value: string | number | boolean;
  timestamp: number;
}
interface LogType {
  id: string;
  firebaseKey: string; // the actual Firebase key under /logs
  type: string;
  value: string | number | boolean;
  timestamp: number;
}
interface TimeRange {
  label: string;
  seconds: number;
  maxPoints: number;
}
interface GraphData {
  dataPoints: number[];
  timestamps: number[];
  minVal: number;
  maxVal: number;
  range: number;
  fromTime: string;
  toTime: string;
}

/* ================= CONSTANTS ================= */
const { width } = Dimensions.get('window');
const TAB_WIDTH     = 110;
const LOGS_PER_PAGE = 10;

const CHART_W   = width - 32;
const CHART_H   = 210;
const PAD_LEFT  = 46;
const PAD_RIGHT = 16;
const PAD_TOP   = 18;
const PAD_BOT   = 26;
const PLOT_W    = CHART_W - PAD_LEFT - PAD_RIGHT;
const PLOT_H    = CHART_H - PAD_TOP - PAD_BOT;

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
  { label: 'Temperature', firebaseKey: 'temperature', color: '#F59E0B', suffix: '\u00B0C', icon: 'thermostat',            hasGraph: true  },
  { label: 'Humidity',    firebaseKey: 'humidity',    color: '#38BDF8', suffix: '%',       icon: 'water-drop',            hasGraph: true  },
  { label: 'Gas',         firebaseKey: 'gas',         color: '#22D3A5', suffix: '',        icon: 'air',                   hasGraph: true  },
  { label: 'Light',       firebaseKey: 'light',       color: '#FCD34D', suffix: '',        icon: 'lightbulb',             hasGraph: false },
  { label: 'Fan',         firebaseKey: 'fan',         color: '#A78BFA', suffix: '',        icon: 'mode-fan-off',          hasGraph: false },
  { label: 'Fire',        firebaseKey: 'fire',        color: '#FF5757', suffix: '',        icon: 'local-fire-department', hasGraph: false },
  { label: 'Motion',      firebaseKey: 'motion',      color: '#6C63FF', suffix: '',        icon: 'directions-walk',       hasGraph: false },
];

/* ================= VALUE FORMATTER ================= */
function formatValue(
  type: string,
  value: string | number | boolean
): { label: string; color: string; bg: string } {
  const t    = type.toLowerCase();
  const v    = String(value);
  const isOn = v === '1' || v === 'true';

  if (t === 'light') {
    return isOn
      ? { label: 'Turned ON',      color: '#FFFFFF', bg: '#16a34a' }
      : { label: 'Turned OFF',     color: '#FFFFFF', bg: THEME.textMuted };
  }
  if (t === 'fan') {
    return isOn
      ? { label: 'Turned ON',      color: '#FFFFFF', bg: '#7C3AED' }
      : { label: 'Turned OFF',     color: '#FFFFFF', bg: THEME.textMuted };
  }
  if (t === 'fire') {
    return isOn
      ? { label: 'FIRE Detected!', color: '#FFFFFF', bg: THEME.danger }
      : { label: 'Fire Cleared',   color: '#FFFFFF', bg: '#16a34a' };
  }
  if (t === 'motion') {
    return isOn
      ? { label: 'Motion Detected', color: '#FFFFFF', bg: '#0284c7' }
      : { label: 'No Motion',       color: '#FFFFFF', bg: THEME.textMuted };
  }
  return { label: v, color: THEME.textPrimary, bg: 'transparent' };
}

/* ================= HELPERS ================= */
const toX = (i: number, total: number) =>
  PAD_LEFT + (i / (total - 1)) * PLOT_W;

const toY = (val: number, minVal: number, range: number) =>
  PAD_TOP + PLOT_H - ((val - minVal) / range) * PLOT_H;

const buildGraphData = (
  logs: LogType[],
  firebaseKey: string,
  selectedRange: TimeRange
): GraphData | null => {
  const now    = Math.floor(Date.now() / 1000);
  const cutoff = now - selectedRange.seconds;

  const filtered = logs
    .filter(l => l.type?.toLowerCase() === firebaseKey.toLowerCase() && l.timestamp >= cutoff)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (filtered.length < 2) return null;

  const total = filtered.length;
  const max   = selectedRange.maxPoints;
  let sampled: LogType[] = [];

  if (total <= max) {
    sampled = filtered;
  } else {
    const step = (total - 1) / (max - 1);
    for (let i = 0; i < max; i++) {
      sampled.push(filtered[Math.round(i * step)]);
    }
  }

  const dataPoints = sampled.map(l =>
    parseFloat(parseFloat(String(l.value)).toFixed(1))
  );
  const timestamps = sampled.map(l => l.timestamp);
  const minRaw = Math.min(...dataPoints);
  const maxRaw = Math.max(...dataPoints);
  const minVal = minRaw - 0.5;
  const maxVal = maxRaw + 0.5;
  const range  = maxVal - minVal || 1;

  const fromTime = new Date((now - selectedRange.seconds) * 1000)
    .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const toTime = new Date(now * 1000)
    .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return { dataPoints, timestamps, minVal, maxVal, range, fromTime, toTime };
};

/* ================= SVG CHART ================= */
interface SVGChartProps {
  gd: GraphData;
  touchIndex: number | null;
  color: string;
  suffix: string;
  onTouchStart: (x: number) => void;
  onTouchMove:  (x: number) => void;
  onTouchEnd:   () => void;
}

function SVGChart({ gd, touchIndex, color, suffix, onTouchStart, onTouchMove, onTouchEnd }: SVGChartProps) {
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder:         () => true,
      onMoveShouldSetPanResponderCapture:  () => true,
      onPanResponderGrant:     (evt) => { onTouchStart(evt.nativeEvent.locationX); },
      onPanResponderMove:      (evt) => { onTouchMove(evt.nativeEvent.locationX); },
      onPanResponderRelease:   () => { onTouchEnd(); },
      onPanResponderTerminate: () => { onTouchEnd(); },
    })
  ).current;

  const n      = gd.dataPoints.length;
  const points = gd.dataPoints.map((v, i) => ({
    x: toX(i, n),
    y: toY(v, gd.minVal, gd.range),
  }));

  let pathD = 'M ' + String(points[0].x) + ' ' + String(points[0].y);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX  = (prev.x + curr.x) / 2;
    pathD += ' C ' + String(cpX) + ' ' + String(prev.y) + ' ' + String(cpX) + ' ' + String(curr.y) + ' ' + String(curr.x) + ' ' + String(curr.y);
  }

  let areaD = pathD;
  areaD += ' L ' + String(points[points.length - 1].x) + ' ' + String(PAD_TOP + PLOT_H);
  areaD += ' L ' + String(PAD_LEFT) + ' ' + String(PAD_TOP + PLOT_H) + ' Z';

  const ySteps = 4;
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => ({
    val: (gd.minVal + (gd.range * i) / ySteps).toFixed(1),
    y:   PAD_TOP + PLOT_H - (PLOT_H * i) / ySteps,
  }));

  const tip = touchIndex !== null ? {
    x:    points[touchIndex].x,
    y:    points[touchIndex].y,
    val:  gd.dataPoints[touchIndex],
    time: new Date(gd.timestamps[touchIndex] * 1000)
      .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  } : null;

  const tooltipLeft = tip ? (tip.x + 50 > CHART_W ? tip.x - 94 : tip.x + 8) : 0;
  const tooltipTop  = tip ? (tip.y - 52 < PAD_TOP  ? tip.y + 10 : tip.y - 52) : 0;

  const tipValStr  = tip ? tip.val.toFixed(1) + suffix : '';
  const tipTimeStr = tip ? tip.time : '';
  const gradId     = 'grad_' + color.replace('#', '');

  return (
    <View style={{ width: CHART_W, height: CHART_H }}>
      <Svg width={CHART_W} height={CHART_H}>
        <Defs>
          <SvgGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.25" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </SvgGradient>
        </Defs>

        {yLabels.map((yl, i) => (
          <Line
            key={'g' + String(i)}
            x1={PAD_LEFT} y1={yl.y}
            x2={CHART_W - PAD_RIGHT} y2={yl.y}
            stroke="rgba(255,255,255,0.06)" strokeWidth={1}
          />
        ))}
        {yLabels.map((yl, i) => (
          <SvgText
            key={'y' + String(i)}
            x={PAD_LEFT - 5} y={yl.y + 4}
            fontSize={9} fill={THEME.textMuted} textAnchor="end"
          >
            {yl.val}
          </SvgText>
        ))}

        <Path d={areaD} fill={'url(#' + gradId + ')'} />
        <Path d={pathD} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, i) => (
          <Circle
            key={'d' + String(i)}
            cx={p.x} cy={p.y}
            r={touchIndex === i ? 7 : 3.5}
            fill={touchIndex === i ? color : THEME.surface}
            stroke={color} strokeWidth={2}
          />
        ))}

        {tip !== null ? (
          <>
            <Line
              x1={tip.x} y1={PAD_TOP}
              x2={tip.x} y2={PAD_TOP + PLOT_H}
              stroke={color + '66'} strokeWidth={1}
              strokeDasharray="4,3"
            />
            <Rect x={tooltipLeft} y={tooltipTop} width={92} height={42} rx={10}
              fill={THEME.surface} stroke={color} strokeWidth={1} />
            <SvgText
              x={tooltipLeft + 46} y={tooltipTop + 16}
              fontSize={13} fontWeight="bold" fill={color} textAnchor="middle"
            >
              {tipValStr}
            </SvgText>
            <SvgText
              x={tooltipLeft + 46} y={tooltipTop + 32}
              fontSize={10} fill={THEME.textSecond} textAnchor="middle"
            >
              {tipTimeStr}
            </SvgText>
          </>
        ) : null}

        <SvgText x={PAD_LEFT} y={CHART_H - 4} fontSize={9} fill={THEME.textMuted} textAnchor="middle">
          {gd.fromTime}
        </SvgText>
        <SvgText x={CHART_W - PAD_RIGHT} y={CHART_H - 4} fontSize={9} fill={THEME.textMuted} textAnchor="middle">
          {gd.toTime}
        </SvgText>
      </Svg>

      <View
        {...panResponder.panHandlers}
        style={{ position: 'absolute', top: 0, left: 0, width: CHART_W, height: CHART_H, backgroundColor: 'transparent' }}
      />
    </View>
  );
}

/* ================= SENSOR GRAPH CARD ================= */
interface SensorGraphCardProps {
  logs: LogType[];
  firebaseKey: string;
  color: string;
  suffix: string;
  label: string;
  icon: string;
}

function SensorGraphCard({ logs, firebaseKey, color, suffix, label, icon }: SensorGraphCardProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>(TIME_RANGES[2]);
  const [touchIndex, setTouchIndex]       = useState<number | null>(null);
  const gdRef = useRef<GraphData | null>(null);

  const gd = buildGraphData(logs, firebaseKey, selectedRange);
  gdRef.current = gd;

  const handleTouchStart = (x: number) => { handleTouchMove(x); };
  const handleTouchMove  = (x: number) => {
    const d = gdRef.current;
    if (!d || d.dataPoints.length < 2) return;
    const n = d.dataPoints.length;
    let nearest = 0, minDist = Infinity;
    for (let i = 0; i < n; i++) {
      const px   = toX(i, n);
      const dist = Math.abs(x - px);
      if (dist < minDist) { minDist = dist; nearest = i; }
    }
    setTouchIndex(nearest);
  };
  const handleTouchEnd = () => { setTimeout(() => setTouchIndex(null), 2000); };

  const minVal = gd ? Math.min(...gd.dataPoints).toFixed(1) + suffix : '';
  const maxVal = gd ? Math.max(...gd.dataPoints).toFixed(1) + suffix : '';

  return (
    <View style={[s.graphCard, { borderLeftColor: color }]}>
      <LinearGradient
        colors={[color + '18', color + '05']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.graphCardGrad}
      >
        <View style={s.graphHeader}>
          <View style={s.graphTitleRow}>
            <View style={[s.graphIconBox, { backgroundColor: color + '22' }]}>
              <MaterialIcons name={icon as any} size={18} color={color} />
            </View>
            <Text style={s.graphTitle}>{label}</Text>
          </View>
          {gd !== null ? (
            <View style={s.graphStats}>
              <View style={[s.statPill, { backgroundColor: color + '18' }]}>
                <Text style={[s.statLabel, { color }]}>{'Lo  ' + minVal}</Text>
              </View>
              <View style={[s.statPill, { backgroundColor: color + '18', marginLeft: 6 }]}>
                <Text style={[s.statLabel, { color }]}>{'Hi  ' + maxVal}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.rangeScroll}
          contentContainerStyle={s.rangeScrollContent}
          nestedScrollEnabled={true}
        >
          {TIME_RANGES.map((range) => {
            const isActive = selectedRange.label === range.label;
            return (
              <TouchableOpacity
                key={range.label}
                onPress={() => { setSelectedRange(range); setTouchIndex(null); }}
                style={[s.rangeBtn, isActive ? { backgroundColor: color } : null]}
              >
                <Text style={[s.rangeBtnText, isActive ? { color: THEME.bg } : null]}>
                  {range.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {gd !== null ? (
          <SVGChart
            gd={gd}
            touchIndex={touchIndex}
            color={color}
            suffix={suffix}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
        ) : (
          <View style={s.noDataBox}>
            <View style={s.noDataIconBox}>
              <MaterialIcons name="bar-chart" size={28} color={THEME.textMuted} />
            </View>
            <Text style={s.noDataText}>{'No data for ' + selectedRange.label}</Text>
            <Text style={s.noDataSub}>Try a longer time range</Text>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

/* ================= DELETE BUTTON ================= */
interface DeleteLogsButtonProps {
  tabLabel: string;
  firebaseKey: string;
  accentColor: string;
  count: number;
}

function DeleteLogsButton({ tabLabel, firebaseKey, accentColor, count }: DeleteLogsButtonProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = () => {
    if (count === 0) return;

    Alert.alert(
      'Delete ' + tabLabel + ' Logs',
      'Are you sure you want to delete all ' + String(count) + ' ' + tabLabel + ' log entries? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              // Fetch all logs, filter by type, delete matching keys
              const logsRef  = ref(database, 'logs');
              const snapshot = await get(logsRef);
              const data     = snapshot.val();

              if (!data || typeof data !== 'object') {
                setDeleting(false);
                return;
              }

              const deletePromises: Promise<void>[] = [];

              Object.entries(data).forEach(([key, value]) => {
                const log = value as FirebaseLogRaw;
                if (log.type?.toLowerCase() === firebaseKey.toLowerCase()) {
                  deletePromises.push(remove(ref(database, 'logs/' + key)));
                }
              });

              await Promise.all(deletePromises);

              Alert.alert(
                'Deleted',
                tabLabel + ' logs have been cleared successfully.',
                [{ text: 'OK' }]
              );
            } catch {
              Alert.alert(
                'Error',
                'Failed to delete logs. Please try again.',
                [{ text: 'OK' }]
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <TouchableOpacity
      onPress={handleDelete}
      disabled={deleting || count === 0}
      activeOpacity={0.8}
      style={[
        s.deleteBtn,
        count === 0 ? s.deleteBtnDisabled : { borderColor: THEME.danger + '60' },
      ]}
    >
      <LinearGradient
        colors={
          count === 0
            ? [THEME.surfaceAlt, THEME.surfaceAlt]
            : deleting
            ? ['rgba(255,87,87,0.08)', 'rgba(255,87,87,0.04)']
            : ['rgba(255,87,87,0.15)', 'rgba(255,87,87,0.06)']
        }
        style={s.deleteBtnGrad}
      >
        <MaterialIcons
          name={deleting ? 'hourglass-empty' : 'delete-sweep'}
          size={18}
          color={count === 0 ? THEME.textMuted : THEME.danger}
        />
        <Text style={[s.deleteBtnText, count === 0 ? { color: THEME.textMuted } : null]}>
          {deleting ? 'Deleting...' : 'Clear All ' + String(count) + ' Logs'}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

/* ================= PAGINATED LOGS ================= */
function PaginatedLogs({ logs, title, accentColor, icon, firebaseKey }: {
  logs: LogType[];
  title: string;
  accentColor: string;
  icon: string;
  firebaseKey: string;
}) {
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [logs.length]);

  const totalPages = Math.max(1, Math.ceil(logs.length / LOGS_PER_PAGE));
  const start      = page * LOGS_PER_PAGE;
  const pageLogs   = logs.slice(start, start + LOGS_PER_PAGE);

  const countLabel = logs.length > 0
    ? String(start + 1) + '\u2013' + String(Math.min(start + LOGS_PER_PAGE, logs.length)) + ' of ' + String(logs.length)
    : '';

  return (
    <View style={s.logsCard}>
      {/* Header */}
      <View style={s.logsHeader}>
        <View style={s.logsTitleRow}>
          <View style={[s.logsIconBox, { backgroundColor: accentColor + '22' }]}>
            <MaterialIcons name={icon as any} size={16} color={accentColor} />
          </View>
          <Text style={[s.logsTitle, { color: accentColor }]}>{title + ' Logs'}</Text>
        </View>
        {logs.length > 0 ? (
          <Text style={s.logsCount}>{countLabel}</Text>
        ) : null}
      </View>

      {/* Log rows */}
      {logs.length === 0 ? (
        <View style={s.emptyBox}>
          <MaterialIcons name="inbox" size={32} color={THEME.textMuted} />
          <Text style={s.emptyText}>No logs available</Text>
        </View>
      ) : (
        pageLogs.map((log) => (
          <LogItem
            key={log.id}
            type={log.type}
            value={log.value}
            timestamp={log.timestamp}
            accentColor={accentColor}
          />
        ))
      )}

      {/* Pagination */}
      {totalPages > 1 ? (
        <View style={s.pagination}>
          <TouchableOpacity
            onPress={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={[s.pageBtn, { backgroundColor: accentColor }, page === 0 ? s.pageBtnDisabled : null]}
          >
            <Text style={[s.pageBtnText, page === 0 ? s.pageBtnTextDisabled : null]}>
              Prev
            </Text>
          </TouchableOpacity>

          <View style={s.pageDots}>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const showDots = totalPages > 7;
              const pageNum  = showDots
                ? (i === 0 ? 0
                  : i === 6 ? totalPages - 1
                  : page - 2 + i < 0 ? i
                  : page - 2 + i >= totalPages ? totalPages - 1 - (6 - i)
                  : page - 2 + i)
                : i;
              const isActive = pageNum === page;
              return (
                <TouchableOpacity
                  key={String(i)}
                  onPress={() => setPage(pageNum)}
                  style={[s.pageDot, isActive ? { backgroundColor: accentColor } : null]}
                >
                  <Text style={[s.pageDotText, isActive ? s.pageDotTextActive : null]}>
                    {String(pageNum + 1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            style={[s.pageBtn, { backgroundColor: accentColor }, page === totalPages - 1 ? s.pageBtnDisabled : null]}
          >
            <Text style={[s.pageBtnText, page === totalPages - 1 ? s.pageBtnTextDisabled : null]}>
              Next
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── DELETE BUTTON — always visible at bottom of each tab's log card ── */}
      <View style={s.deleteSeparator} />
      <DeleteLogsButton
        tabLabel={title}
        firebaseKey={firebaseKey}
        accentColor={accentColor}
        count={logs.length}
      />
    </View>
  );
}

/* ================= LOG ITEM ================= */
function LogItem({ type, value, timestamp, accentColor }: {
  type: string;
  value: string | number | boolean;
  timestamp: number;
  accentColor: string;
}) {
  const formatted     = formatValue(type, value);
  const isBadge       = formatted.bg !== 'transparent';
  const formattedTime = new Date(timestamp * 1000).toLocaleString();

  return (
    <View style={s.logItem}>
      <View style={s.logRow}>
        {isBadge ? (
          <View style={[s.logBadge, { backgroundColor: formatted.bg }]}>
            <Text style={[s.logBadgeText, { color: formatted.color }]}>
              {formatted.label}
            </Text>
          </View>
        ) : (
          <View style={s.logValueRow}>
            <Text style={[s.logType, { color: THEME.textMuted }]}>{type}</Text>
            <View style={[s.logValuePill, { backgroundColor: accentColor + '22' }]}>
              <Text style={[s.logValue, { color: accentColor }]}>{formatted.label}</Text>
            </View>
          </View>
        )}
      </View>
      <Text style={s.timeText}>{formattedTime}</Text>
    </View>
  );
}

/* ================= MAIN SCREEN ================= */
export default function LogsScreen() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [logs, setLogs]               = useState<LogType[]>([]);

  const pageScrollRef = useRef<ScrollView>(null);
  const tabScrollRef  = useRef<ScrollView>(null);
  const fadeAnim      = useRef(new Animated.Value(0)).current;
  const slideAnim     = useRef(new Animated.Value(20)).current;
  const liveDotAnim   = useRef(new Animated.Value(1)).current;

  const pathname = usePathname();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    Animated.loop(Animated.sequence([
      Animated.timing(liveDotAnim, { toValue: 0.2, duration: 900, useNativeDriver: true }),
      Animated.timing(liveDotAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
    ])).start();
  }, []);

  useEffect(() => {
    const logsRef = ref(database, 'logs');
    const listener = onValue(logsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data || typeof data !== 'object') { setLogs([]); return; }
      const parsed: LogType[] = Object.entries(data).map(([key, value]) => {
        const log = value as FirebaseLogRaw;
        return {
          id:          String(key) + '_' + String(log.timestamp),
          firebaseKey: key,
          type:        log.type,
          value:       log.value,
          timestamp:   log.timestamp,
        };
      });
      parsed.sort((a, b) => b.timestamp - a.timestamp);
      setLogs(parsed);
    });
    return () => { off(logsRef, 'value', listener); };
  }, []);

  const scrollTo = (index: number) => {
    pageScrollRef.current?.scrollTo({ x: index * width, animated: true });
    tabScrollRef.current?.scrollTo({
      x: index * TAB_WIDTH - width / 2 + TAB_WIDTH / 2,
      animated: true,
    });
  };

  const handleTabPress = (index: number) => {
    setActiveIndex(index);
    scrollTo(index);
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveIndex(index);
    tabScrollRef.current?.scrollTo({
      x: index * TAB_WIDTH - width / 2 + TAB_WIDTH / 2,
      animated: true,
    });
  };

  const goHome = () => { if (pathname !== '/') router.replace('/'); };
  const goLogs = () => { if (pathname !== '/logs') router.replace('/logs'); };

  return (
    <View style={s.root}>
      <StatusBar style="light" translucent backgroundColor="rgba(13,13,31,0.95)" />

      {/* ── HEADER ── */}
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
            <View style={s.headerBrand}>
              <LinearGradient colors={[THEME.accent, '#9B8CFF']} style={s.headerIconGrad}>
                <MaterialIcons name="history" size={20} color="#FFFFFF" />
              </LinearGradient>
              <View>
                <Text style={s.headerSub}>SMART HOME</Text>
                <Text style={s.headerTitle}>Activity Logs</Text>
              </View>
            </View>

            <View style={s.headerRight}>
              <View style={s.logCountPill}>
                <Text style={s.logCountText}>{String(logs.length) + ' events'}</Text>
              </View>
              <View style={s.livePill}>
                <Animated.View style={[s.liveDot, { opacity: liveDotAnim }]} />
                <Text style={s.liveText}>LIVE</Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ── TABS ── */}
      <View style={s.tabBar}>
        <ScrollView
          ref={tabScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabScrollContent}
        >
          {TABS.map((tab, index) => {
            const isActive = activeIndex === index;
            return (
              <TouchableOpacity
                key={tab.label}
                onPress={() => handleTabPress(index)}
                style={[
                  s.tabItem,
                  isActive ? { backgroundColor: tab.color + '20', borderColor: tab.color + '60' } : null,
                ]}
              >
                <MaterialIcons
                  name={tab.icon as any}
                  size={14}
                  color={isActive ? tab.color : THEME.textMuted}
                />
                <Text style={[s.tabText, isActive ? { color: tab.color } : null]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── PAGES ── */}
      <ScrollView
        ref={pageScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={{ flex: 1 }}
      >
        {TABS.map((tab) => {
          const filteredLogs = logs.filter(
            l => l.type?.toLowerCase() === tab.firebaseKey.toLowerCase()
          );

          return (
            <View key={tab.label} style={s.page}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.pageContent}
                nestedScrollEnabled={true}
              >
                {tab.hasGraph ? (
                  <SensorGraphCard
                    logs={logs}
                    firebaseKey={tab.firebaseKey}
                    color={tab.color}
                    suffix={tab.suffix}
                    label={tab.label}
                    icon={tab.icon}
                  />
                ) : null}

                <PaginatedLogs
                  logs={filteredLogs}
                  title={tab.label}
                  accentColor={tab.color}
                  icon={tab.icon}
                  firebaseKey={tab.firebaseKey}
                />
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>

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
   STYLES
══════════════════════════════════════════ */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.bg },

  /* Header */
  header: { paddingBottom: 16, overflow: 'hidden' },
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
  headerTitle: { color: THEME.textPrimary, fontSize: 24, fontWeight: '900', letterSpacing: -0.5, marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logCountPill: {
    backgroundColor: THEME.accentSoft,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(108,99,255,0.2)',
  },
  logCountText: { color: THEME.accent, fontSize: 11, fontWeight: '700' },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(34,211,165,0.1)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(34,211,165,0.2)',
  },
  liveDot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: THEME.success },
  liveText: { color: THEME.success, fontSize: 10, fontWeight: '800', letterSpacing: 2 },

  /* Tab bar */
  tabBar: {
    backgroundColor: THEME.surface,
    borderBottomWidth: 1, borderBottomColor: THEME.border,
    paddingVertical: 10,
  },
  tabScrollContent: { paddingHorizontal: 12, gap: 8 },
  tabItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: THEME.border,
    backgroundColor: THEME.bg,
  },
  tabText: { fontSize: 12, fontWeight: '700', color: THEME.textMuted },

  /* Page */
  page:        { width },
  pageContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 },

  /* Graph card */
  graphCard: {
    borderRadius: 20, marginBottom: 16,
    borderLeftWidth: 3,
    overflow: 'hidden',
    borderWidth: 1, borderColor: THEME.border,
  },
  graphCardGrad:  { padding: 18 },
  graphHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  graphTitleRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  graphIconBox:   { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  graphTitle:     { color: THEME.textPrimary, fontSize: 16, fontWeight: '800' },
  graphStats:     { flexDirection: 'row', alignItems: 'center' },
  statPill:       { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  statLabel:      { fontSize: 11, fontWeight: '700' },
  rangeScroll:    { marginBottom: 14, flexGrow: 0 },
  rangeScrollContent: { gap: 8, paddingRight: 4 },
  rangeBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: THEME.bg,
    borderWidth: 1, borderColor: THEME.border,
  },
  rangeBtnText:   { color: THEME.textSecond, fontSize: 12, fontWeight: '700' },
  noDataBox:      { paddingVertical: 40, alignItems: 'center', gap: 10 },
  noDataIconBox:  { width: 56, height: 56, borderRadius: 16, backgroundColor: THEME.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  noDataText:     { color: THEME.textSecond, fontSize: 14, fontWeight: '700' },
  noDataSub:      { color: THEME.textMuted,  fontSize: 12 },

  /* Logs card */
  logsCard: {
    backgroundColor: THEME.surface,
    borderRadius: 20, borderWidth: 1, borderColor: THEME.border,
    padding: 18, marginBottom: 16,
  },
  logsHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  logsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logsIconBox:  { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  logsTitle:    { fontSize: 16, fontWeight: '800' },
  logsCount:    { fontSize: 11, color: THEME.textMuted, fontWeight: '600' },
  emptyBox:     { paddingVertical: 32, alignItems: 'center', gap: 10 },
  emptyText:    { color: THEME.textMuted, fontSize: 14, fontWeight: '600' },

  /* Log item */
  logItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  logRow:      { flexDirection: 'row', alignItems: 'center' },
  logValueRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logType:     { fontSize: 12, fontWeight: '600' },
  logValuePill:{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  logValue:    { fontSize: 13, fontWeight: '700' },
  logBadge:    { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  logBadgeText:{ fontSize: 12, fontWeight: '700' },
  timeText:    { fontSize: 11, color: THEME.textMuted, marginTop: 5 },

  /* Pagination */
  pagination: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 16,
    paddingTop: 14, borderTopWidth: 1, borderTopColor: THEME.border,
  },
  pageBtn:             { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20 },
  pageBtnDisabled:     { backgroundColor: THEME.surfaceAlt },
  pageBtnText:         { color: THEME.bg,       fontSize: 12, fontWeight: '800' },
  pageBtnTextDisabled: { color: THEME.textMuted },
  pageDots:            { flexDirection: 'row', gap: 5, alignItems: 'center' },
  pageDot: {
    minWidth: 28, height: 28, borderRadius: 14,
    backgroundColor: THEME.surfaceAlt,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  pageDotText:       { fontSize: 11, fontWeight: '700', color: THEME.textMuted },
  pageDotTextActive: { color: '#FFFFFF' },

  /* Delete button */
  deleteSeparator: {
    height: 1,
    backgroundColor: THEME.border,
    marginTop: 18,
    marginBottom: 14,
  },
  deleteBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    overflow: 'hidden',
  },
  deleteBtnDisabled: {
    borderColor: THEME.border,
    opacity: 0.5,
  },
  deleteBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 20,
  },
  deleteBtnText: {
    color: THEME.danger,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  /* Footer */
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
  footerTextActive: { color: THEME.accent,    fontWeight: '800' },
});
