/**
 * emergency.tsx
 *
 * ✅ Zero API keys needed
 * ✅ Zero billing / Google Cloud
 * ✅ User types location once  →  saved to AsyncStorage
 * ✅ Location persists across app restarts
 * ✅ Nearby fire stations + hospitals fetched free via:
 *      • Nominatim  (OpenStreetMap geocoding)
 *      • Overpass   (OpenStreetMap POI search)
 * ✅ User can change location any time via edit button
 */

import React, {
  useState, useRef, useEffect, useCallback,
} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Easing, Linking, Alert, Dimensions,
  ActivityIndicator, TextInput, KeyboardAvoidingView, Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

/* ─────────────────────────────────────
   Install required package (run once):
   npx expo install @react-native-async-storage/async-storage
   ───────────────────────────────────── */

const STORAGE_KEY = 'smarthome_emergency_location';

/* ══════════════════════════════════════════
   THEME — identical to index.tsx
══════════════════════════════════════════ */
const THEME = {
  bg:           '#F4F6FA',
  surface:      '#FFFFFF',
  surfaceAlt:   '#EEF1F8',
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
  dangerDeep:   '#B91C1C',
  medical:      '#0891B2',
  medicalSoft:  '#CFFAFE',
  medicalDeep:  '#0E7490',
  textPrimary:  '#0F172A',
  textSecond:   '#475569',
  textMuted:    '#94A3B8',
  shadow:       'rgba(15,23,42,0.08)',
  shadowMd:     'rgba(15,23,42,0.12)',
};

/* ══════════════════════════════════════════
   TYPES
══════════════════════════════════════════ */
interface SavedLocation {
  label:   string;   // what user typed e.g. "Shivaji Nagar, Pune"
  lat:     number;
  lon:     number;
}

interface NearbyPlace {
  id:      string;
  name:    string;
  address: string;
  phone:   string | null;
  lat:     number;
  lon:     number;
  distanceM: number;
}

type FetchState = 'idle' | 'loading' | 'done' | 'error';

/* ══════════════════════════════════════════
   STATIC GUIDE DATA
══════════════════════════════════════════ */
const FIRE_STEPS = [
  { step: '01', icon: 'campaign',     title: 'Alert Everyone',
    color: THEME.danger,  bg: THEME.dangerSoft,
    desc: 'Shout "FIRE!" loudly to warn all occupants. Activate the nearest fire alarm pull station immediately.' },
  { step: '02', icon: 'call',         title: 'Call Fire Brigade',
    color: '#EA580C',     bg: '#FFF7ED', callNumber: '101',
    desc: 'Dial 101 (Fire) or 112. Give your exact address, floor, and nature of fire. Stay on the line.' },
  { step: '03', icon: 'meeting-room', title: 'Evacuate Immediately',
    color: THEME.warning, bg: THEME.warningSoft,
    desc: 'Leave via nearest staircase — never use the lift. Close doors behind you. Do not go back.' },
  { step: '04', icon: 'air',          title: 'Stay Low & Cover',
    color: '#0369A1',     bg: '#E0F2FE',
    desc: 'Crawl low under smoke. Cover nose and mouth with a damp cloth. Clean air is near the floor.' },
  { step: '05', icon: 'door-back',    title: 'Check Doors',
    color: THEME.violet,  bg: THEME.violetSoft,
    desc: 'Before opening any door, feel it with the back of your hand. If hot — do NOT open. Find alternate exit.' },
  { step: '06', icon: 'location-on',  title: 'Assembly Point',
    color: THEME.success, bg: THEME.successSoft,
    desc: 'Proceed to the designated assembly point. Do not re-enter until fire authorities give clearance.' },
];

const PASS_STEPS = [
  { letter: 'P', word: 'Pull',    desc: 'Pull the safety pin'         },
  { letter: 'A', word: 'Aim',     desc: 'Aim at the base of the fire' },
  { letter: 'S', word: 'Squeeze', desc: 'Squeeze the handle firmly'   },
  { letter: 'S', word: 'Sweep',   desc: 'Sweep side to side at base'  },
];

const MEDICAL_STEPS = [
  { step: '01', icon: 'call',              title: 'Call Ambulance',
    color: THEME.medical, bg: THEME.medicalSoft, callNumber: '108',
    desc: 'Dial 108 (Ambulance) or 112. State your location clearly and describe the patient\'s condition.' },
  { step: '02', icon: 'airline-seat-flat', title: 'Keep Them Still',
    color: THEME.success, bg: THEME.successSoft,
    desc: 'Do not move the person unless in immediate danger. Keep them warm and calm until help arrives.' },
  { step: '03', icon: 'monitor-heart',     title: 'Check Breathing',
    color: THEME.danger,  bg: THEME.dangerSoft,
    desc: 'Look for chest rise, listen for breath. If not breathing and trained, begin CPR.' },
  { step: '04', icon: 'bloodtype',         title: 'Control Bleeding',
    color: '#B91C1C',     bg: '#FEE2E2',
    desc: 'Apply firm steady pressure with a clean cloth. Elevate the wound above heart level.' },
  { step: '05', icon: 'no-food',           title: 'Nothing by Mouth',
    color: THEME.warning, bg: THEME.warningSoft,
    desc: 'Do not give food, water or medicine to an unconscious person — it may cause choking.' },
  { step: '06', icon: 'info',              title: 'Gather Information',
    color: '#0369A1',     bg: '#E0F2FE',
    desc: 'Note age, medical conditions, medications and time symptoms started — relay to paramedics.' },
];

const QUICK_CONTACTS = [
  { label: 'Fire Brigade', number: '101', icon: 'local-fire-department', color: THEME.danger  },
  { label: 'Ambulance',    number: '108', icon: 'local-hospital',        color: THEME.medical },
  { label: 'Emergency',    number: '112', icon: 'emergency',             color: '#DC2626'     },
  { label: 'Police',       number: '100', icon: 'local-police',          color: '#1D4ED8'     },
];

const FIRST_AID_TIPS = [
  { title: 'Choking',          icon: 'sick',          tip: 'Give 5 back blows between shoulder blades, then 5 abdominal thrusts.'         },
  { title: 'Burns',            icon: 'whatshot',      tip: 'Cool under running water for 10 min. Do not use ice, butter or toothpaste.'    },
  { title: 'Fracture',         icon: 'accessibility', tip: 'Immobilise the limb. Do not try to straighten. Support above and below break.' },
  { title: 'Unconscious',      icon: 'bedtime',       tip: 'Recovery position (on side). Keep airway clear. Monitor breathing.'            },
  { title: 'Heart Attack',     icon: 'monitor-heart', tip: 'Sit them down, loosen clothing, give aspirin if available. Call 108 now.'      },
  { title: 'Allergic Reaction',icon: 'coronavirus',   tip: 'Use EpiPen if available. Lay flat, elevate legs. Call 108 immediately.'        },
];

/* ══════════════════════════════════════════
   FREE APIs — no key needed
   Nominatim : geocode user text → lat/lon
   Overpass  : find POIs near lat/lon
══════════════════════════════════════════ */

/** Convert a text address to lat/lon using Nominatim (OpenStreetMap) */
async function geocodeAddress(query: string): Promise<{ lat: number; lon: number; display: string } | null> {
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`;

  const res = await fetch(url, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'SmartNest-App/1.0' },
  });
  const data: any[] = await res.json();
  if (!data.length) return null;

  const r = data[0];
  const addr = r.address;

  // Build a clean short label
  const parts = [
    addr.suburb ?? addr.neighbourhood ?? addr.quarter,
    addr.city    ?? addr.town ?? addr.village ?? addr.county,
    addr.state,
  ].filter(Boolean);
  const display = parts.slice(0, 2).join(', ') || r.display_name.split(',').slice(0, 2).join(',');

  return { lat: parseFloat(r.lat), lon: parseFloat(r.lon), display };
}

/** Haversine distance in metres */
function distM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(m: number) {
  return m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(1) + ' km';
}

/**
 * Fetch nearby amenities using Overpass API (free, no key).
 * amenity: 'fire_station' | 'hospital' | 'clinic' | 'pharmacy'
 */
async function fetchOverpass(
  lat: number,
  lon: number,
  amenities: string[],
  radiusM: number,
): Promise<NearbyPlace[]> {
  const amenityFilter = amenities.map(a => `node["amenity"="${a}"](around:${radiusM},${lat},${lon});`).join('\n');
  const wayFilter     = amenities.map(a => `way["amenity"="${a}"](around:${radiusM},${lat},${lon});`).join('\n');

  const query = `
    [out:json][timeout:25];
    (
      ${amenityFilter}
      ${wayFilter}
    );
    out center tags;
  `;

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    'data=' + encodeURIComponent(query),
  });

  const data = await res.json();
  const elements: any[] = data.elements ?? [];

  const places: NearbyPlace[] = elements
    .filter(el => el.tags?.name)
    .map((el): NearbyPlace => {
      const elLat = el.lat ?? el.center?.lat ?? lat;
      const elLon = el.lon ?? el.center?.lon ?? lon;
      const tags  = el.tags ?? {};

      // Build address from OSM tags
      const addrParts = [
        tags['addr:housenumber'],
        tags['addr:street'],
        tags['addr:suburb'],
        tags['addr:city'],
      ].filter(Boolean);
      const address = addrParts.length
        ? addrParts.join(', ')
        : tags['addr:full'] ?? '';

      // Phone: try multiple OSM phone tags
      const phone =
        tags.phone        ??
        tags['contact:phone'] ??
        tags['contact:mobile'] ??
        null;

      return {
        id:        String(el.id),
        name:      tags.name,
        address,
        phone,
        lat:       elLat,
        lon:       elLon,
        distanceM: distM(lat, lon, elLat, elLon),
      };
    })
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, 10);

  return places;
}

/* ══════════════════════════════════════════
   LOCATION SET MODAL
══════════════════════════════════════════ */
function LocationSetModal({
  visible,
  current,
  onSave,
  onClose,
}: {
  visible:  boolean;
  current:  string;
  onSave:   (label: string, lat: number, lon: number) => void;
  onClose:  () => void;
}) {
  const [query,    setQuery]    = useState(current);
  const [loading,  setLoading]  = useState(false);
  const [errMsg,   setErrMsg]   = useState('');

  // Suggestions for quick-pick
  const SUGGESTIONS = [
    'Pimpri, Pune',
    'Shivaji Nagar, Pune',
    'Hinjewadi, Pune',
    'Viman Nagar, Pune',
    'Kothrud, Pune',
    'Wakad, Pune',
    'Baner, Pune',
    'Koregaon Park, Pune',
    'Mumbai Central, Mumbai',
    'Andheri, Mumbai',
  ];

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setErrMsg('');
    try {
      const result = await geocodeAddress(query.trim());
      if (!result) {
        setErrMsg('Location not found. Try adding city name (e.g. "Shivaji Nagar, Pune").');
      } else {
        onSave(result.display, result.lat, result.lon);
      }
    } catch {
      setErrMsg('Network error. Check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.modalOverlay}
      >
        <View style={s.modalSheet}>

          {/* Handle */}
          <View style={s.modalHandle} />

          {/* Header */}
          <View style={s.modalHeader}>
            <View style={s.modalHeaderLeft}>
              <View style={[s.modalHeaderIcon, { backgroundColor: THEME.accentSoft }]}>
                <MaterialIcons name="location-on" size={20} color={THEME.accent} />
              </View>
              <View>
                <Text style={s.modalTitle}>Set Your Location</Text>
                <Text style={s.modalSubtitle}>Used to find nearby emergency services</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={s.modalCloseBtn} activeOpacity={0.7}>
              <MaterialIcons name="close" size={18} color={THEME.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Search input */}
          <View style={s.searchInputWrap}>
            <MaterialIcons name="search" size={18} color={THEME.textMuted} style={s.searchIcon} />
            <TextInput
              style={s.searchInput}
              placeholder="e.g. Shivaji Nagar, Pune"
              placeholderTextColor={THEME.textMuted}
              value={query}
              onChangeText={t => { setQuery(t); setErrMsg(''); }}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoFocus
              autoCapitalize="words"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} style={s.searchClearBtn}>
                <MaterialIcons name="cancel" size={16} color={THEME.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {errMsg ? (
            <View style={s.errBox}>
              <MaterialIcons name="error-outline" size={14} color={THEME.danger} />
              <Text style={s.errTxt}>{errMsg}</Text>
            </View>
          ) : null}

          {/* Search button */}
          <TouchableOpacity
            onPress={handleSearch}
            activeOpacity={0.85}
            disabled={loading || !query.trim()}
            style={[s.searchBtn, (!query.trim() || loading) && s.searchBtnDisabled]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <MaterialIcons name="my-location" size={16} color="#FFF" />
                <Text style={s.searchBtnTxt}>Find & Save Location</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Quick suggestions */}
          <Text style={s.suggestLabel}>QUICK PICK</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.suggestScroll}
          >
            {SUGGESTIONS.map((s2, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setQuery(s2)}
                activeOpacity={0.7}
                style={[
                  s.suggestChip,
                  query === s2 && { backgroundColor: THEME.accentSoft, borderColor: THEME.accent },
                ]}
              >
                <MaterialIcons name="place" size={11} color={query === s2 ? THEME.accent : THEME.textMuted} />
                <Text style={[s.suggestChipTxt, query === s2 && { color: THEME.accent }]}>{s2}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={{ height: 24 }} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ══════════════════════════════════════════
   SHARED UI BITS
══════════════════════════════════════════ */
function SectionLabel({ text, icon, color }: { text: string; icon: string; color: string }) {
  return (
    <View style={s.sectionLabelRow}>
      <MaterialIcons name={icon as any} size={12} color={color} />
      <Text style={[s.sectionLabel, { color }]}>{text}</Text>
    </View>
  );
}

function dialNumber(number: string, label?: string) {
  Alert.alert(
    'Call ' + (label ?? number),
    'Dial ' + number + ' now?',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: '📞  Call Now', onPress: () => Linking.openURL('tel:' + number.replace(/[^+\d]/g, '')) },
    ]
  );
}

function openMaps(lat: number, lon: number) {
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`);
}

function renderStars(rating: number) {
  const full  = Math.floor(rating);
  const half  = rating % 1 >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {Array(full).fill(0).map((_, i)  => <MaterialIcons key={'f'+i} name="star"        size={11} color="#F59E0B" />)}
      {half &&                              <MaterialIcons key="h"    name="star-half"   size={11} color="#F59E0B" />}
      {Array(empty).fill(0).map((_, i) => <MaterialIcons key={'e'+i} name="star-border" size={11} color="#D1D5DB" />)}
    </View>
  );
}

/* ── Step Card ── */
type StepData = {
  step: string; icon: string; title: string; desc: string;
  color: string; bg: string; callNumber?: string; index: number;
};
function StepCard({ step, icon, title, desc, color, bg, callNumber: cn, index }: StepData) {
  const fade  = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 340, delay: index * 45, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 340, delay: index * 45, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
      <View style={[s.stepCard, { borderLeftColor: color }]}>
        <View style={[s.stepNumBox, { backgroundColor: color }]}>
          <Text style={s.stepNum}>{step}</Text>
        </View>
        <View style={s.stepBody}>
          <View style={s.stepTitleRow}>
            <View style={[s.stepIconBox, { backgroundColor: bg }]}>
              <MaterialIcons name={icon as any} size={16} color={color} />
            </View>
            <Text style={s.stepTitle}>{title}</Text>
          </View>
          <Text style={s.stepDesc}>{desc}</Text>
          {cn ? (
            <TouchableOpacity onPress={() => dialNumber(cn)} activeOpacity={0.8} style={s.callBtnWrap}>
              <LinearGradient colors={[color, color + 'CC']} style={s.callBtnGrad}>
                <MaterialIcons name="call" size={13} color="#FFF" />
                <Text style={s.callBtnTxt}>{'Call ' + cn}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

/* ── Place Card ── */
function PlaceCard({ place, index, accentColor, iconName }: {
  place: NearbyPlace; index: number; accentColor: string; iconName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const fade       = useRef(new Animated.Value(0)).current;
  const slide      = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 380, delay: index * 60, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 380, delay: index * 60, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const toggle = () => {
    setExpanded(e => !e);
    Animated.timing(expandAnim, {
      toValue:  expanded ? 0 : 1,
      duration: 230, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  };

  const expandH  = expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 90] });
  const chevronR = expandAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
      <View style={[s.placeCard, { borderLeftColor: accentColor }]}>

        {/* Header */}
        <TouchableOpacity onPress={toggle} activeOpacity={0.85} style={s.placeTop}>
          <View style={[s.placeIconBox, { backgroundColor: accentColor + '18' }]}>
            <MaterialIcons name={iconName as any} size={22} color={accentColor} />
          </View>
          <View style={s.placeInfo}>
            <Text style={s.placeName} numberOfLines={2}>{place.name}</Text>
            <View style={s.placeBadgeRow}>
              <View style={s.distancePill}>
                <MaterialIcons name="near-me" size={10} color={THEME.accent} />
                <Text style={s.distanceTxt}>{fmtDist(place.distanceM)}</Text>
              </View>
              {place.phone ? (
                <View style={s.phonePill}>
                  <MaterialIcons name="phone" size={10} color={THEME.success} />
                  <Text style={s.phonePillTxt}>{place.phone}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <Animated.View style={{ transform: [{ rotate: chevronR }], marginLeft: 4 }}>
            <MaterialIcons name="keyboard-arrow-down" size={20} color={THEME.textMuted} />
          </Animated.View>
        </TouchableOpacity>

        {/* Actions */}
        <View style={s.placeActions}>
          {place.phone ? (
            <TouchableOpacity
              onPress={() => dialNumber(place.phone!, place.name)}
              activeOpacity={0.8} style={s.actionCall}
            >
              <LinearGradient colors={[accentColor, accentColor + 'CC']} style={s.actionCallGrad}>
                <MaterialIcons name="call" size={14} color="#FFF" />
                <Text style={s.actionCallTxt}>Call Now</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => dialNumber('112', 'Emergency')}
              activeOpacity={0.8} style={s.actionCall}
            >
              <LinearGradient colors={[THEME.danger, THEME.dangerDeep]} style={s.actionCallGrad}>
                <MaterialIcons name="call" size={14} color="#FFF" />
                <Text style={s.actionCallTxt}>112</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => openMaps(place.lat, place.lon)}
            activeOpacity={0.8} style={s.actionMap}
          >
            <MaterialIcons name="directions" size={14} color={THEME.accent} />
            <Text style={s.actionMapTxt}>Directions</Text>
          </TouchableOpacity>
        </View>

        {/* Expandable address */}
        <Animated.View style={{ maxHeight: expandH, overflow: 'hidden' }}>
          <View style={s.placeExpanded}>
            <View style={s.expandDivider} />
            {place.address ? (
              <View style={s.expandRow}>
                <MaterialIcons name="place" size={13} color={THEME.textMuted} />
                <Text style={s.expandAddr}>{place.address}</Text>
              </View>
            ) : (
              <Text style={s.expandAddr}>Address not available in OpenStreetMap data.</Text>
            )}
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

/* ── No Location prompt ── */
function NoLocationPrompt({ onSet, color }: { onSet: () => void; color: string }) {
  return (
    <View style={s.noLocBox}>
      <View style={[s.noLocIconRing, { backgroundColor: color + '15' }]}>
        <MaterialIcons name="location-off" size={30} color={color} />
      </View>
      <Text style={s.noLocTitle}>Location Not Set</Text>
      <Text style={s.noLocDesc}>
        Set your location once to see nearby fire stations and hospitals in real time.
      </Text>
      <TouchableOpacity onPress={onSet} activeOpacity={0.85} style={s.noLocBtn}>
        <LinearGradient colors={[color, color + 'CC']} style={s.noLocBtnGrad}>
          <MaterialIcons name="add-location-alt" size={16} color="#FFF" />
          <Text style={s.noLocBtnTxt}>Set My Location</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

/* ── Fetch state ── */
function FetchStateBox({ state, color, label, onRetry }: {
  state: FetchState; color: string; label: string; onRetry: () => void;
}) {
  if (state === 'done') return null;
  return (
    <View style={s.fetchStateBox}>
      {state === 'loading' ? (
        <>
          <ActivityIndicator size="large" color={color} />
          <Text style={s.fetchStateTxt}>{'Finding ' + label + ' near you…'}</Text>
        </>
      ) : state === 'error' ? (
        <>
          <View style={[s.fetchStateIcon, { backgroundColor: color + '18' }]}>
            <MaterialIcons name="wifi-off" size={26} color={color} />
          </View>
          <Text style={s.fetchStateTxt}>{'Could not load ' + label + '. Check internet and try again.'}</Text>
          <TouchableOpacity onPress={onRetry} activeOpacity={0.8} style={s.retryBtn}>
            <LinearGradient colors={[color, color + 'CC']} style={s.retryBtnGrad}>
              <MaterialIcons name="refresh" size={14} color="#FFF" />
              <Text style={s.retryBtnTxt}>Retry</Text>
            </LinearGradient>
          </TouchableOpacity>
        </>
      ) : null}
    </View>
  );
}

/* ══════════════════════════════════════════
   FIRE SAFETY TAB
══════════════════════════════════════════ */
function FireSafetyTab({
  savedLocation, fireStations, fireState, onSetLocation, onRefetch,
}: {
  savedLocation: SavedLocation | null;
  fireStations:  NearbyPlace[];
  fireState:     FetchState;
  onSetLocation: () => void;
  onRefetch:     () => void;
}) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.tabContent}>

      {/* Hero */}
      <LinearGradient colors={['#DC2626', '#B91C1C']} style={s.heroBanner}>
        <View style={s.heroBannerLeft}>
          <View style={s.heroBannerIconRing}>
            <MaterialIcons name="local-fire-department" size={26} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroBannerTitle}>Fire Emergency</Text>
            <Text style={s.heroBannerSub}>Stay calm · Act fast · Save lives</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => dialNumber('101', 'Fire Brigade')} activeOpacity={0.85} style={s.heroBannerCallBtn}>
          <MaterialIcons name="call" size={16} color={THEME.danger} />
          <Text style={[s.heroBannerCallNum, { color: THEME.danger }]}>101</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* Nearby fire stations */}
      <View style={s.nearbyHeader}>
        <View>
          <SectionLabel text="NEARBY FIRE STATIONS" icon="location-on" color={THEME.danger} />
          {savedLocation ? (
            <Text style={s.nearbySubLabel}>📍 {savedLocation.label}</Text>
          ) : null}
        </View>
        {savedLocation ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={onRefetch} style={s.iconBtn} activeOpacity={0.7}>
              <MaterialIcons name="refresh" size={17} color={THEME.accent} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onSetLocation} style={s.iconBtn} activeOpacity={0.7}>
              <MaterialIcons name="edit-location-alt" size={17} color={THEME.accent} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {!savedLocation ? (
        <NoLocationPrompt onSet={onSetLocation} color={THEME.danger} />
      ) : (
        <>
          {/* Stats */}
          {fireState === 'done' && fireStations.length > 0 ? (
            <View style={s.statsRow}>
              <View style={[s.statPill, { backgroundColor: THEME.dangerSoft, borderColor: 'rgba(220,38,38,0.2)' }]}>
                <MaterialIcons name="local-fire-department" size={12} color={THEME.danger} />
                <Text style={[s.statPillTxt, { color: THEME.danger }]}>{fireStations.length} found</Text>
              </View>
              <View style={[s.statPill, { backgroundColor: THEME.accentSoft, borderColor: 'rgba(14,165,233,0.2)' }]}>
                <MaterialIcons name="near-me" size={12} color={THEME.accent} />
                <Text style={[s.statPillTxt, { color: THEME.accent }]}>{fmtDist(fireStations[0].distanceM)} nearest</Text>
              </View>
            </View>
          ) : null}

          <FetchStateBox state={fireState} color={THEME.danger} label="fire stations" onRetry={onRefetch} />

          {fireState === 'done' && fireStations.length === 0 ? (
            <View style={s.noResultBox}>
              <MaterialIcons name="search-off" size={28} color={THEME.textMuted} />
              <Text style={s.noResultTxt}>No fire stations found within 10 km of your location.</Text>
            </View>
          ) : null}

          {fireStations.map((st, i) => (
            <PlaceCard key={st.id} place={st} index={i} accentColor={THEME.danger} iconName="local-fire-department" />
          ))}
        </>
      )}

      {/* National helpline */}
      <View style={s.nationalCard}>
        <LinearGradient colors={['rgba(220,38,38,0.06)', 'rgba(220,38,38,0.02)']} style={s.nationalGrad}>
          <View style={s.nationalLeft}>
            <MaterialIcons name="emergency" size={16} color={THEME.danger} />
            <View>
              <Text style={s.nationalTitle}>National Fire Emergency</Text>
              <Text style={s.nationalSub}>Works on all networks, even low signal</Text>
            </View>
          </View>
          {['101', '112'].map(n => (
            <TouchableOpacity key={n} onPress={() => dialNumber(n)}
              activeOpacity={0.8} style={[s.nationalNumBtn, { backgroundColor: THEME.danger }]}>
              <Text style={s.nationalNumTxt}>{n}</Text>
            </TouchableOpacity>
          ))}
        </LinearGradient>
      </View>

      {/* Steps */}
      <SectionLabel text="EMERGENCY STEPS" icon="format-list-numbered" color={THEME.danger} />
      {FIRE_STEPS.map((item, i) => <StepCard key={item.step} {...item} index={i} />)}

      {/* PASS */}
      <SectionLabel text="P·A·S·S TECHNIQUE" icon="ads-click" color={THEME.danger} />
      <View style={s.passCard}>
        {PASS_STEPS.map((p, i) => (
          <View key={i} style={[s.passRow, i < PASS_STEPS.length - 1 && s.passRowBorder]}>
            <View style={s.passLetterBox}><Text style={s.passLetter}>{p.letter}</Text></View>
            <View>
              <Text style={s.passWord}>{p.word}</Text>
              <Text style={s.passDesc}>{p.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={s.bottomPad} />
    </ScrollView>
  );
}

/* ══════════════════════════════════════════
   MEDICAL HELP TAB
══════════════════════════════════════════ */
function MedicalHelpTab({
  savedLocation, hospitals, hospitalState, onSetLocation, onRefetch,
}: {
  savedLocation: SavedLocation | null;
  hospitals:     NearbyPlace[];
  hospitalState: FetchState;
  onSetLocation: () => void;
  onRefetch:     () => void;
}) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.tabContent}>

      {/* Hero */}
      <LinearGradient colors={[THEME.medical, THEME.medicalDeep]} style={s.heroBanner}>
        <View style={s.heroBannerLeft}>
          <View style={s.heroBannerIconRing}>
            <MaterialIcons name="local-hospital" size={26} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroBannerTitle}>Medical Emergency</Text>
            <Text style={s.heroBannerSub}>Stay calm · Call early · Help arrives</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => dialNumber('108', 'Ambulance')} activeOpacity={0.85} style={s.heroBannerCallBtn}>
          <MaterialIcons name="call" size={16} color={THEME.medical} />
          <Text style={[s.heroBannerCallNum, { color: THEME.medical }]}>108</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* Quick contacts */}
      <SectionLabel text="QUICK CONTACTS" icon="contacts" color={THEME.medical} />
      <View style={s.quickContactsRow}>
        {QUICK_CONTACTS.map((c, i) => (
          <TouchableOpacity key={i} onPress={() => dialNumber(c.number, c.label)} activeOpacity={0.8} style={s.quickContactCard}>
            <View style={[s.quickContactIcon, { backgroundColor: c.color + '18' }]}>
              <MaterialIcons name={c.icon as any} size={20} color={c.color} />
            </View>
            <Text style={s.quickContactLabel}>{c.label}</Text>
            <View style={[s.quickContactNum, { backgroundColor: c.color }]}>
              <Text style={s.quickContactNumTxt}>{c.number}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Nearby hospitals */}
      <View style={s.nearbyHeader}>
        <View>
          <SectionLabel text="NEARBY HOSPITALS & CLINICS" icon="local-hospital" color={THEME.medical} />
          {savedLocation ? (
            <Text style={s.nearbySubLabel}>📍 {savedLocation.label}</Text>
          ) : null}
        </View>
        {savedLocation ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={onRefetch} style={s.iconBtn} activeOpacity={0.7}>
              <MaterialIcons name="refresh" size={17} color={THEME.accent} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onSetLocation} style={s.iconBtn} activeOpacity={0.7}>
              <MaterialIcons name="edit-location-alt" size={17} color={THEME.accent} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {!savedLocation ? (
        <NoLocationPrompt onSet={onSetLocation} color={THEME.medical} />
      ) : (
        <>
          {hospitalState === 'done' && hospitals.length > 0 ? (
            <View style={s.statsRow}>
              <View style={[s.statPill, { backgroundColor: THEME.medicalSoft, borderColor: 'rgba(8,145,178,0.2)' }]}>
                <MaterialIcons name="local-hospital" size={12} color={THEME.medical} />
                <Text style={[s.statPillTxt, { color: THEME.medical }]}>{hospitals.length} found</Text>
              </View>
              <View style={[s.statPill, { backgroundColor: THEME.accentSoft, borderColor: 'rgba(14,165,233,0.2)' }]}>
                <MaterialIcons name="near-me" size={12} color={THEME.accent} />
                <Text style={[s.statPillTxt, { color: THEME.accent }]}>{fmtDist(hospitals[0].distanceM)} nearest</Text>
              </View>
            </View>
          ) : null}

          <FetchStateBox state={hospitalState} color={THEME.medical} label="hospitals" onRetry={onRefetch} />

          {hospitalState === 'done' && hospitals.length === 0 ? (
            <View style={s.noResultBox}>
              <MaterialIcons name="search-off" size={28} color={THEME.textMuted} />
              <Text style={s.noResultTxt}>No hospitals found within 5 km. Try updating your location.</Text>
            </View>
          ) : null}

          {hospitals.map((h, i) => (
            <PlaceCard key={h.id} place={h} index={i} accentColor={THEME.medical} iconName="local-hospital" />
          ))}
        </>
      )}

      {/* Medical steps */}
      <SectionLabel text="EMERGENCY STEPS" icon="format-list-numbered" color={THEME.medical} />
      {MEDICAL_STEPS.map((item, i) => <StepCard key={item.step} {...item} index={i} />)}

      {/* First aid */}
      <SectionLabel text="QUICK FIRST AID" icon="healing" color={THEME.success} />
      {FIRST_AID_TIPS.map((tip, i) => (
        <View key={i} style={s.tipCard}>
          <View style={[s.tipIconBox, { backgroundColor: THEME.successSoft }]}>
            <MaterialIcons name={tip.icon as any} size={16} color={THEME.success} />
          </View>
          <View style={s.tipBody}>
            <Text style={s.tipTitle}>{tip.title}</Text>
            <Text style={s.tipText}>{tip.tip}</Text>
          </View>
        </View>
      ))}

      {/* CPR */}
      <SectionLabel text="CPR QUICK GUIDE" icon="favorite" color={THEME.success} />
      <View style={s.cprCard}>
        <LinearGradient colors={['rgba(5,150,105,0.07)', 'rgba(5,150,105,0.02)']} style={s.cprGrad}>
          <View style={s.cprRow}>
            {[
              { n: '30', label: 'Chest\nCompressions', color: THEME.danger   },
              { n: '+',  label: '',                    color: THEME.textMuted },
              { n: '2',  label: 'Rescue\nBreaths',     color: THEME.medical  },
              { n: '=',  label: '',                    color: THEME.textMuted },
              { n: '1',  label: 'Full\nCycle',         color: THEME.success  },
            ].map((item, i) => (
              <View key={i} style={s.cprItem}>
                <Text style={[s.cprNum, { color: item.color }]}>{item.n}</Text>
                {item.label ? <Text style={s.cprLabel}>{item.label}</Text> : null}
              </View>
            ))}
          </View>
          <Text style={s.cprNote}>Push hard & fast · 100–120 compressions/min · Tilt head back for rescue breaths</Text>
        </LinearGradient>
      </View>

      <View style={s.bottomPad} />
    </ScrollView>
  );
}

/* ══════════════════════════════════════════
   MAIN SCREEN
══════════════════════════════════════════ */
export default function EmergencyScreen() {
  const [activeTab,      setActiveTab]      = useState<'fire' | 'medical'>('fire');
  const [savedLocation,  setSavedLocation]  = useState<SavedLocation | null>(null);
  const [showModal,      setShowModal]      = useState(false);
  const [fireStations,   setFireStations]   = useState<NearbyPlace[]>([]);
  const [hospitals,      setHospitals]      = useState<NearbyPlace[]>([]);
  const [fireState,      setFireState]      = useState<FetchState>('idle');
  const [hospitalState,  setHospitalState]  = useState<FetchState>('idle');

  const headerAnim = useRef(new Animated.Value(0)).current;
  const sliderAnim = useRef(new Animated.Value(0)).current;

  /* ── Load saved location from storage on mount ── */
  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1, duration: 600,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();

    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        try {
          const loc: SavedLocation = JSON.parse(raw);
          setSavedLocation(loc);
        } catch { /* corrupt data, ignore */ }
      } else {
        // First launch — open modal automatically
        setShowModal(true);
      }
    });
  }, []);

  /* ── Fetch nearby places when location is set/changed ── */
  const fetchNearby = useCallback(async (loc: SavedLocation) => {
    setFireState('loading');
    setHospitalState('loading');
    setFireStations([]);
    setHospitals([]);

    const [fireResult, medResult] = await Promise.allSettled([
      fetchOverpass(loc.lat, loc.lon, ['fire_station'], 10000),
      fetchOverpass(loc.lon, loc.lon, ['hospital', 'clinic'], 5000),
    ]);

    if (fireResult.status === 'fulfilled') {
      setFireStations(fireResult.value);
      setFireState('done');
    } else {
      setFireState('error');
    }

    if (medResult.status === 'fulfilled') {
      setHospitals(medResult.value);
      setHospitalState('done');
    } else {
      setHospitalState('error');
    }
  }, []);

  /* ── Triggered when fetchNearby has a bug fix for hospitals lat/lon ── */
  const fetchNearbyFixed = useCallback(async (loc: SavedLocation) => {
    setFireState('loading');
    setHospitalState('loading');
    setFireStations([]);
    setHospitals([]);

    const [fireResult, medResult] = await Promise.allSettled([
      fetchOverpass(loc.lat, loc.lon, ['fire_station'], 10000),
      fetchOverpass(loc.lat, loc.lon, ['hospital', 'clinic', 'pharmacy'], 5000),
    ]);

    if (fireResult.status === 'fulfilled') {
      setFireStations(fireResult.value);
      setFireState('done');
    } else {
      setFireState('error');
    }

    if (medResult.status === 'fulfilled') {
      setHospitals(medResult.value);
      setHospitalState('done');
    } else {
      setHospitalState('error');
    }
  }, []);

  useEffect(() => {
    if (savedLocation) fetchNearbyFixed(savedLocation);
  }, [savedLocation]);

  /* ── Save location from modal ── */
  const handleSaveLocation = async (label: string, lat: number, lon: number) => {
    const loc: SavedLocation = { label, lat, lon };
    setSavedLocation(loc);
    setShowModal(false);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
  };

  const switchTab = (tab: 'fire' | 'medical') => {
    setActiveTab(tab);
    Animated.timing(sliderAnim, {
      toValue: tab === 'fire' ? 0 : 1, duration: 260,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  };

  const HALF    = (width - 40) / 2;
  const sliderX = sliderAnim.interpolate({ inputRange: [0, 1], outputRange: [0, HALF] });

  return (
    <View style={s.root}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />

      {/* ── HEADER ── */}
      <SafeAreaView edges={['top']} style={s.safeHeader}>
        <Animated.View style={{ opacity: headerAnim }}>
          <LinearGradient colors={['#FFFFFF', '#F8FAFF']} start={{ x:0,y:0 }} end={{ x:1,y:1 }} style={s.header}>
            <View style={s.headerOrb1} />
            <View style={s.headerOrb2} />
            <View style={s.headerInner}>
              <View style={s.headerBrand}>
                <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={s.backBtn}>
                  <MaterialIcons name="arrow-back-ios" size={17} color={THEME.textPrimary} />
                </TouchableOpacity>
                <LinearGradient colors={[THEME.danger, THEME.dangerDeep]} start={{ x:0,y:0 }} end={{ x:1,y:1 }} style={s.headerIconGrad}>
                  <MaterialIcons name="emergency" size={20} color="#FFF" />
                </LinearGradient>
                <View>
                  <Text style={s.headerSub}>SMART HOME</Text>
                  <Text style={s.headerTitle}>Emergency</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => dialNumber('112', 'Emergency SOS')} activeOpacity={0.8}>
                <LinearGradient colors={[THEME.danger, THEME.dangerDeep]} style={s.sosPill}>
                  <MaterialIcons name="call" size={13} color="#FFF" />
                  <Text style={s.sosTxt}>SOS · 112</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Location bar in header */}
            <TouchableOpacity
              onPress={() => setShowModal(true)}
              activeOpacity={0.8}
              style={s.locationBar}
            >
              <MaterialIcons
                name={savedLocation ? 'location-on' : 'location-off'}
                size={14}
                color={savedLocation ? THEME.accent : THEME.textMuted}
              />
              <Text
                style={[s.locationBarTxt, { color: savedLocation ? THEME.textSecond : THEME.textMuted }]}
                numberOfLines={1}
              >
                {savedLocation ? savedLocation.label : 'Tap to set your location'}
              </Text>
              <MaterialIcons name="edit" size={13} color={THEME.accent} />
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      </SafeAreaView>

      {/* ── TAB SWITCHER ── */}
      <View style={s.tabSwitcherWrap}>
        <View style={s.tabSwitcher}>
          <Animated.View style={[s.tabSlider, {
            width: HALF,
            transform: [{ translateX: sliderX }],
            backgroundColor: activeTab === 'fire' ? THEME.danger : THEME.medical,
          }]} />
          <TouchableOpacity onPress={() => switchTab('fire')} activeOpacity={0.85} style={s.tabBtn}>
            <MaterialIcons name="local-fire-department" size={15} color={activeTab === 'fire' ? '#FFF' : THEME.textMuted} />
            <Text style={[s.tabBtnTxt, activeTab === 'fire' && s.tabBtnTxtActive]}>Fire Safety</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => switchTab('medical')} activeOpacity={0.85} style={s.tabBtn}>
            <MaterialIcons name="local-hospital" size={15} color={activeTab === 'medical' ? '#FFF' : THEME.textMuted} />
            <Text style={[s.tabBtnTxt, activeTab === 'medical' && s.tabBtnTxtActive]}>Medical Help</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── CONTENT ── */}
      <View style={s.contentArea}>
        {activeTab === 'fire' ? (
          <FireSafetyTab
            savedLocation={savedLocation}
            fireStations={fireStations}
            fireState={fireState}
            onSetLocation={() => setShowModal(true)}
            onRefetch={() => savedLocation && fetchNearbyFixed(savedLocation)}
          />
        ) : (
          <MedicalHelpTab
            savedLocation={savedLocation}
            hospitals={hospitals}
            hospitalState={hospitalState}
            onSetLocation={() => setShowModal(true)}
            onRefetch={() => savedLocation && fetchNearbyFixed(savedLocation)}
          />
        )}
      </View>

      {/* ── LOCATION SET MODAL ── */}
      <LocationSetModal
        visible={showModal}
        current={savedLocation?.label ?? ''}
        onSave={handleSaveLocation}
        onClose={() => setShowModal(false)}
      />
    </View>
  );
}

/* ══════════════════════════════════════════
   STYLES
══════════════════════════════════════════ */
const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: THEME.bg },
  contentArea: { flex: 1 },
  bottomPad:   { height: 40 },
  safeHeader:  { backgroundColor: '#FFFFFF' },

  /* Header */
  header:        { paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: THEME.border, shadowColor: THEME.shadowMd, shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6, overflow: 'hidden' },
  headerOrb1:    { position: 'absolute', top: -40, right: -20, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(220,38,38,0.07)' },
  headerOrb2:    { position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(8,145,178,0.05)' },
  headerInner:   { paddingHorizontal: 18, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerBrand:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn:       { width: 36, height: 36, borderRadius: 10, backgroundColor: THEME.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: THEME.border },
  headerIconGrad:{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  headerSub:     { color: THEME.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 3 },
  headerTitle:   { color: THEME.textPrimary, fontSize: 24, fontWeight: '900', letterSpacing: -0.6, marginTop: 1 },
  sosPill:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, elevation: 4 },
  sosTxt:        { color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },

  /* Location bar */
  locationBar:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 18, marginTop: 10, backgroundColor: THEME.bg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: THEME.border },
  locationBarTxt: { flex: 1, fontSize: 12, fontWeight: '600' },

  /* Tab switcher */
  tabSwitcherWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, backgroundColor: THEME.bg },
  tabSwitcher:     { flexDirection: 'row', backgroundColor: THEME.surface, borderRadius: 16, borderWidth: 1, borderColor: THEME.border, padding: 4, overflow: 'hidden', shadowColor: THEME.shadow, shadowOpacity: 1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  tabSlider:       { position: 'absolute', top: 4, left: 4, bottom: 4, borderRadius: 12 },
  tabBtn:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 11, borderRadius: 12, zIndex: 1 },
  tabBtnTxt:       { fontSize: 13, fontWeight: '700', color: THEME.textMuted },
  tabBtnTxtActive: { color: '#FFF', fontWeight: '800' },

  tabContent:    { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 20 },

  heroBanner:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderRadius: 20, marginBottom: 18, elevation: 4 },
  heroBannerLeft:     { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  heroBannerIconRing: { width: 50, height: 50, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroBannerTitle:    { color: '#FFF', fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
  heroBannerSub:      { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 3 },
  heroBannerCallBtn:  { backgroundColor: '#FFF', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, alignItems: 'center', minWidth: 52 },
  heroBannerCallNum:  { fontSize: 16, fontWeight: '900', marginTop: 2 },

  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, marginTop: 6 },
  sectionLabel:    { fontSize: 10, fontWeight: '800', letterSpacing: 2.5 },

  nearbyHeader:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 },
  nearbySubLabel: { color: THEME.textMuted, fontSize: 11, fontWeight: '500', marginTop: -6, marginBottom: 10, marginLeft: 18 },
  iconBtn:        { width: 34, height: 34, borderRadius: 10, backgroundColor: THEME.accentSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(14,165,233,0.2)' },

  statsRow:    { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  statPill:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  statPillTxt: { fontSize: 11, fontWeight: '700' },

  /* No location */
  noLocBox:      { backgroundColor: THEME.surface, borderRadius: 18, padding: 28, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: THEME.border },
  noLocIconRing: { width: 70, height: 70, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  noLocTitle:    { color: THEME.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 8 },
  noLocDesc:     { color: THEME.textSecond, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 18 },
  noLocBtn:      { borderRadius: 14, overflow: 'hidden' },
  noLocBtnGrad:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 13 },
  noLocBtnTxt:   { color: '#FFF', fontSize: 14, fontWeight: '800' },

  /* Fetch state */
  fetchStateBox:  { backgroundColor: THEME.surface, borderRadius: 16, padding: 24, alignItems: 'center', gap: 12, marginBottom: 14, borderWidth: 1, borderColor: THEME.border },
  fetchStateIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  fetchStateTxt:  { color: THEME.textSecond, fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 20 },
  retryBtn:       { borderRadius: 12, overflow: 'hidden' },
  retryBtnGrad:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 10 },
  retryBtnTxt:    { color: '#FFF', fontSize: 13, fontWeight: '800' },

  noResultBox:  { backgroundColor: THEME.surface, borderRadius: 14, padding: 20, alignItems: 'center', gap: 8, marginBottom: 14, borderWidth: 1, borderColor: THEME.border },
  noResultTxt:  { color: THEME.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  /* Place card */
  placeCard:    { backgroundColor: THEME.surface, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: THEME.border, borderLeftWidth: 3, shadowColor: THEME.shadow, shadowOpacity: 1, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3, overflow: 'hidden' },
  placeTop:     { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
  placeIconBox: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  placeInfo:    { flex: 1 },
  placeName:    { color: THEME.textPrimary, fontSize: 14, fontWeight: '800', marginBottom: 6 },
  placeBadgeRow:{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  distancePill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: THEME.accentSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  distanceTxt:  { color: THEME.accent, fontSize: 11, fontWeight: '700' },
  phonePill:    { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: THEME.successSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  phonePillTxt: { color: THEME.success, fontSize: 11, fontWeight: '600' },

  placeActions: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 14 },
  actionCall:   { borderRadius: 10, overflow: 'hidden', flex: 0.8 },
  actionCallGrad:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9 },
  actionCallTxt: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  actionMap:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: THEME.accentSoft, borderRadius: 10, paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(14,165,233,0.2)' },
  actionMapTxt: { color: THEME.accent, fontSize: 12, fontWeight: '700' },

  placeExpanded: { paddingHorizontal: 14, paddingBottom: 12 },
  expandDivider: { height: 1, backgroundColor: THEME.borderLight, marginBottom: 10 },
  expandRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  expandAddr:    { color: THEME.textSecond, fontSize: 12, flex: 1, lineHeight: 18 },

  /* National card */
  nationalCard:  { borderRadius: 14, marginBottom: 18, borderWidth: 1, borderColor: 'rgba(220,38,38,0.18)', overflow: 'hidden' },
  nationalGrad:  { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  nationalLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  nationalTitle: { color: THEME.textPrimary, fontSize: 13, fontWeight: '800' },
  nationalSub:   { color: THEME.textMuted, fontSize: 11, marginTop: 2 },
  nationalNumBtn:{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  nationalNumTxt:{ color: '#FFF', fontSize: 14, fontWeight: '900' },

  /* Step card */
  stepCard:    { flexDirection: 'row', backgroundColor: THEME.surface, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: THEME.border, borderLeftWidth: 4, shadowColor: THEME.shadow, shadowOpacity: 1, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2, overflow: 'hidden' },
  stepNumBox:  { width: 34, alignItems: 'center', justifyContent: 'center', paddingVertical: 18 },
  stepNum:     { color: '#FFF', fontSize: 10, fontWeight: '900', transform: [{ rotate: '-90deg' }] },
  stepBody:    { flex: 1, padding: 14 },
  stepTitleRow:{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 7 },
  stepIconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepTitle:   { color: THEME.textPrimary, fontSize: 14, fontWeight: '800', flex: 1 },
  stepDesc:    { color: THEME.textSecond, fontSize: 12, lineHeight: 19 },
  callBtnWrap: { marginTop: 10, alignSelf: 'flex-start', borderRadius: 10, overflow: 'hidden' },
  callBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8 },
  callBtnTxt:  { color: '#FFF', fontSize: 12, fontWeight: '800' },

  /* PASS */
  passCard:      { backgroundColor: THEME.surface, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: THEME.border, overflow: 'hidden', elevation: 2 },
  passRow:       { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  passRowBorder: { borderBottomWidth: 1, borderBottomColor: THEME.borderLight },
  passLetterBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: THEME.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  passLetter:    { color: THEME.danger, fontSize: 20, fontWeight: '900' },
  passWord:      { color: THEME.textPrimary, fontSize: 14, fontWeight: '800' },
  passDesc:      { color: THEME.textMuted, fontSize: 12, marginTop: 1 },

  /* Quick contacts */
  quickContactsRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  quickContactCard:   { width: (width - 48) / 2, backgroundColor: THEME.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: THEME.border, alignItems: 'center', gap: 7, elevation: 2 },
  quickContactIcon:   { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  quickContactLabel:  { color: THEME.textSecond, fontSize: 12, fontWeight: '700' },
  quickContactNum:    { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  quickContactNumTxt: { color: '#FFF', fontSize: 13, fontWeight: '900' },

  /* First aid */
  tipCard:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: THEME.surface, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: THEME.border, elevation: 2 },
  tipIconBox:{ width: 35, height: 35, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tipBody:   { flex: 1 },
  tipTitle:  { color: THEME.textPrimary, fontSize: 14, fontWeight: '800', marginBottom: 3 },
  tipText:   { color: THEME.textSecond, fontSize: 12, lineHeight: 18 },

  /* CPR */
  cprCard:   { borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(5,150,105,0.2)', overflow: 'hidden', elevation: 2 },
  cprGrad:   { padding: 18 },
  cprRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 14 },
  cprItem:   { alignItems: 'center', minWidth: 46 },
  cprNum:    { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  cprLabel:  { color: THEME.textMuted, fontSize: 10, fontWeight: '600', textAlign: 'center', marginTop: 2, lineHeight: 14 },
  cprNote:   { color: THEME.textSecond, fontSize: 11, textAlign: 'center', lineHeight: 16 },

  /* ── Location Set Modal ── */
  modalOverlay:  { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.5)' },
  modalSheet:    { backgroundColor: THEME.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12 },
  modalHandle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: THEME.border, alignSelf: 'center', marginBottom: 18 },
  modalHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  modalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalHeaderIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  modalTitle:    { color: THEME.textPrimary, fontSize: 17, fontWeight: '900' },
  modalSubtitle: { color: THEME.textMuted, fontSize: 12, marginTop: 2 },
  modalCloseBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: THEME.surfaceAlt, alignItems: 'center', justifyContent: 'center' },

  searchInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.bg, borderRadius: 14, borderWidth: 1, borderColor: THEME.border, paddingHorizontal: 12, marginBottom: 12 },
  searchIcon:      { marginRight: 4 },
  searchInput:     { flex: 1, fontSize: 15, color: THEME.textPrimary, paddingVertical: 13, fontWeight: '500' },
  searchClearBtn:  { padding: 4 },

  errBox:  { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: THEME.dangerSoft, borderRadius: 10, padding: 10, marginBottom: 12 },
  errTxt:  { color: THEME.danger, fontSize: 12, fontWeight: '600', flex: 1 },

  searchBtn:         { backgroundColor: THEME.accent, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, marginBottom: 18 },
  searchBtnDisabled: { opacity: 0.45 },
  searchBtnTxt:      { color: '#FFF', fontSize: 15, fontWeight: '800' },

  suggestLabel: { color: THEME.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 10 },
  suggestScroll:{ gap: 8, paddingRight: 4 },
  suggestChip:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: THEME.surfaceAlt, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: THEME.border },
  suggestChipTxt:{ fontSize: 12, fontWeight: '600', color: THEME.textSecond },
});
