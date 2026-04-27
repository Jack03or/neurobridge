// screens/SeizureDiary.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import styled from 'styled-components/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { CalendarProvider, WeekCalendar } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BASE_URL } from '../config';

export default function SeizureDiary({ route, navigation }) {
  const { userId } = route.params;
  const { width } = useWindowDimensions();
  const calendarWidth = Math.max(280, width - 72);

  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(toYMD(new Date()));
  const [filter, setFilter] = useState('ALL'); // ALL | SEIZURE | MEDICATION | APPOINTMENT

  const [seizures, setSeizures] = useState([]);
  const [meds, setMeds] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [pendingSchedule, setPendingSchedule] = useState(null);
  const [takenAt, setTakenAt] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [showFabMenu, setShowFabMenu] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [sRes, mRes, aRes, scRes] = await Promise.all([
        fetch(`${BASE_URL}/api/seizures/by-user/${userId}`),
        fetch(`${BASE_URL}/api/medications/by-user/${userId}`),
        fetch(`${BASE_URL}/api/appointments/by-user/${userId}`),
        fetch(`${BASE_URL}/api/medication-schedules/by-user/${userId}`),
      ]);

      const sText = await sRes.text();
      const mText = await mRes.text();
      const aText = await aRes.text();
      const scText = await scRes.text();

      if (!sRes.ok) {
        Alert.alert('Error', sText || 'Could not load seizures.');
        setSeizures([]);
      } else {
        setSeizures(sText ? JSON.parse(sText) : []);
      }

      if (!mRes.ok) {
        Alert.alert('Error', mText || 'Could not load medication logs.');
        setMeds([]);
      } else {
        setMeds(mText ? JSON.parse(mText) : []);
      }

      if (!aRes.ok) {
        Alert.alert('Error', aText || 'Could not load appointments.');
        setAppointments([]);
      } else {
        setAppointments(aText ? JSON.parse(aText) : []);
      }

      if (!scRes.ok) {
        setSchedules([]);
      } else {
        setSchedules(scText ? JSON.parse(scText) : []);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not load diary data.');
      setSeizures([]);
      setMeds([]);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsub = navigation.addListener('focus', loadAll);
    loadAll();
    return unsub;
    // // Reload data whenever this screen is opened or comes back into focus
  }, [userId]);

  const markedDates = useMemo(() => {
    const seizureDays = new Set(
      (seizures || [])
        .map((s) => toYMD(parseLocalDateTime(s.timestamp)))
        .filter(Boolean),
    );

    const medDays = new Set(
      (meds || [])
        .map((m) => (typeof m.date === 'string' ? m.date : null))
        .filter(Boolean),
    );

    const apptDays = new Set(
      (appointments || [])
        .map((a) => toYMD(parseLocalDateTime(a.startTime)))
        .filter(Boolean),
    );

    const allDays = new Set([selectedDate, ...seizureDays, ...medDays, ...apptDays]);

    const out = {};
    for (const day of allDays) {
      const hasSeizure = seizureDays.has(day);
      const hasMed = medDays.has(day);
      const hasAppt = apptDays.has(day);

      out[day] = {
        selected: day === selectedDate,
        selectedColor: '#b03060',
        selectedTextColor: '#ffffff',
        dots: [
          { key: 'SEIZURE', color: hasSeizure ? '#b03060' : 'transparent' },
          { key: 'MED', color: hasMed ? '#6b5e58' : 'transparent' },
          { key: 'APPT', color: hasAppt ? '#8b7e76' : 'transparent' },
        ],
      };
    }
    return out;
  }, [seizures, meds, appointments, selectedDate]);

  const dayEvents = useMemo(() => {
    const date = selectedDate;

    const seizureEvents = (seizures || [])
      .filter((s) => toYMD(parseLocalDateTime(s.timestamp)) === date)
      .map((s) => ({
        kind: 'SEIZURE',
        id: s.id,
        title: cleanText(s.type) || 'Seizure',
        time: formatTime(parseLocalDateTime(s.timestamp)),
        sortTime: parseLocalDateTime(s.timestamp)?.getTime?.() || 0,
        subtitle: formatDuration(s.durationSeconds),
        raw: s,
      }));

    const medEvents = (meds || [])
      .filter((m) => m.date === date)
      .map((m) => {
        const t = m.takenAt ? parseLocalDateTime(m.takenAt) : null;
        return {
          kind: 'MEDICATION',
          id: m.id,
          title: m.taken ? 'Medication taken' : 'Medication missed',
          time: t ? formatTime(t) : 'Logged',
          sortTime: t ? t.getTime() : new Date(date + 'T23:59:00').getTime(),
          subtitle: '',
          raw: m,
        };
      });

    const apptEvents = (appointments || [])
      .filter((a) => toYMD(parseLocalDateTime(a.startTime)) === date)
      .map((a) => {
        const st = parseLocalDateTime(a.startTime);
        return {
          kind: 'APPOINTMENT',
          id: a.id,
          title: cleanText(a.title) || 'Doctor appointment',
          time: st ? formatTime(st) : 'Appointment',
          sortTime: st?.getTime?.() || new Date(date + 'T23:59:00').getTime(),
          subtitle: cleanText(a.location) || '',
          raw: a,
        };
      });

    let combined = [...seizureEvents, ...medEvents, ...apptEvents];
    combined.sort((a, b) => a.sortTime - b.sortTime);

    if (filter === 'SEIZURE') combined = combined.filter((e) => e.kind === 'SEIZURE');
    if (filter === 'MEDICATION') combined = combined.filter((e) => e.kind === 'MEDICATION');
    if (filter === 'APPOINTMENT') combined = combined.filter((e) => e.kind === 'APPOINTMENT');

    return combined;
  }, [selectedDate, seizures, meds, appointments, filter]);

  const toIsoLocal = (d) => {
    const pad = (v) => String(v).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const markTakenForSelectedDate = async (scheduleId, time) => {
    try {
      const response = await fetch(`${BASE_URL}/api/medications/mark-taken/by-user/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId,
          date: selectedDate,
          takenAt: toIsoLocal(time),
        }),
      });
      const text = await response.text();
      if (!response.ok) {
        Alert.alert('Error', text || 'Could not mark medication taken.');
        return;
      }
      await loadAll();
      Alert.alert('Saved', 'Medication marked as taken.');
    } catch (err) {
      Alert.alert('Error', 'Could not mark medication taken.');
    }
  };

  const onMarkMedication = () => {
    if (!schedules.length) {
      Alert.alert('No medication set', 'Add medication schedule first.');
      return;
    }

    if (schedules.length === 1) {
      const schedule = schedules[0];
      Alert.alert(
        'Medication taken?',
        `${schedule.medicationName}${schedule.dose ? ` (${schedule.dose})` : ''}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes',
            onPress: () => {
              setPendingSchedule(schedule);
              setTakenAt(new Date());
              setShowTimePicker(true);
            },
          },
        ],
      );
      return;
    }

    const actions = schedules.slice(0, 5).map((s) => ({
      text: `${s.medicationName}${s.dose ? ` (${s.dose})` : ''}`,
      onPress: () => {
        setPendingSchedule(s);
        setTakenAt(new Date());
        setShowTimePicker(true);
      },
    }));
    actions.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Select medication', 'Which medication was taken?', actions);
  };

  return (
    <Container>
      <TopBar>
        <BackBtn onPress={() => navigation.goBack()}>
          <TopIcon name="chevron-left" />
        </BackBtn>
        <TopTitle>Seizure Diary</TopTitle>
        <TopSpacer />
      </TopBar>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 90 }}>
        <Card>
          <CardTitle>Calendar</CardTitle>
          <SmallText>Tap a day to view events. Swipe to change week.</SmallText>

          <CalendarWrap>
            <CalendarProvider
              date={selectedDate}
              onDateChanged={(d) => setSelectedDate(d)}
              disabledOpacity={0.6}
            >
              <WeekCalendar
                calendarWidth={calendarWidth}
                firstDay={1}
                markingType="multi-dot"
                markedDates={markedDates}
                theme={{
                  calendarBackground: '#ffffff',
                  textSectionTitleColor: '#6b5e58',
                  dayTextColor: '#2f2f2f',
                  textDisabledColor: '#c9bfb9',
                  monthTextColor: '#2f2f2f',
                  arrowColor: '#b03060',
                  todayTextColor: '#b03060',
                }}
              />
            </CalendarProvider>
          </CalendarWrap>
        </Card>

        <Card>
          <CardTitle>Events</CardTitle>

          <PillRow>
            {[
              { key: 'ALL', label: 'All' },
              { key: 'SEIZURE', label: 'Seizures' },
              { key: 'MEDICATION', label: 'Medication' },
              { key: 'APPOINTMENT', label: 'Appointments' },
            ].map((p) => (
              <Pill key={p.key} active={filter === p.key} onPress={() => setFilter(p.key)}>
                <PillText active={filter === p.key}>{p.label}</PillText>
              </Pill>
            ))}
          </PillRow>

          <SmallText style={{ marginTop: 6 }}>{prettyDate(selectedDate)}</SmallText>

          <QuickMedBtn onPress={onMarkMedication}>
            <QuickMedIcon name="pill" />
            <QuickMedText>Mark medication taken</QuickMedText>
          </QuickMedBtn>
        </Card>

        {loading ? (
          <LoadingWrapper>
            <ActivityIndicator />
          </LoadingWrapper>
        ) : dayEvents.length === 0 ? (
          <Card>
            <CardTitle>No events</CardTitle>
            <SmallText style={{ marginTop: 8 }}>
              No seizures, medication logs, or appointments recorded for this day.
            </SmallText>
          </Card>
        ) : (
          dayEvents.map((e) => (
            <EventCard
              key={`${e.kind}-${e.id}`}
              onPress={() => {
                if (e.kind === 'SEIZURE') {
                  navigation.navigate('SeizureEventView', {
                    userId,
                    seizure: e.raw,
                  });
                  return;
                }

                if (e.kind === 'MEDICATION') {
                  navigation.navigate('LogMedicationEvent', {
                    userId,
                    dateYmd: selectedDate,
                    existing: e.raw,
                  });
                  return;
                }

                if (e.kind === 'APPOINTMENT') {
                  navigation.navigate('LogAppointmentEvent', {
                    userId,
                    dateYmd: selectedDate,
                    existing: e.raw,
                  });
                }
              }}
            >
              <EventLeft>
                <EventIcon name={iconForKind(e.kind)} />
              </EventLeft>

              <EventBody>
                <EventTopRow>
                  <EventTime>{e.time}</EventTime>
                  {e.kind === 'SEIZURE' ? <EventChip>{e.subtitle || ''}</EventChip> : null}
                </EventTopRow>

                <EventTitle numberOfLines={1}>{e.title}</EventTitle>

                {e.kind === 'SEIZURE' ? (
                  <EventSub numberOfLines={1}>
                    {cleanText(e.raw.awareness) ? `Awareness: ${e.raw.awareness}` : ''}
                  </EventSub>
                ) : e.kind === 'APPOINTMENT' && e.subtitle ? (
                  <EventSub numberOfLines={1}>{e.subtitle}</EventSub>
                ) : null}
              </EventBody>

              <Chevron>
                <Icon name="chevron-right" size={22} color="#6b5e58" />
              </Chevron>
            </EventCard>
          ))
        )}
      </ScrollView>

      <Fab onPress={() => setShowFabMenu(true)}>
        <FabIcon name="plus" />
      </Fab>

      <Modal
        visible={showFabMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFabMenu(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' }}
          onPress={() => setShowFabMenu(false)}
        >
          <Pressable style={{ marginTop: 'auto' }} onPress={() => {}}>
            <Sheet>
              <SheetTitle>Add</SheetTitle>

              <SheetBtn
                onPress={() => {
                  setShowFabMenu(false);
                  navigation.navigate('LogSeizureSymptoms', { userId });
                }}
              >
                <SheetIcon name="pulse" />
                <SheetText>Log Seizure</SheetText>
              </SheetBtn>

              <SheetBtn
                onPress={() => {
                  setShowFabMenu(false);
                  navigation.navigate('LogMedicationEvent', { userId, dateYmd: selectedDate });
                }}
              >
                <SheetIcon name="pill" />
                <SheetText>Log Medication</SheetText>
              </SheetBtn>

              <SheetBtn
                onPress={() => {
                  setShowFabMenu(false);
                  navigation.navigate('LogAppointmentEvent', { userId, dateYmd: selectedDate });
                }}
              >
                <SheetIcon name="calendar-clock" />
                <SheetText>Add Doctor Appointment</SheetText>
              </SheetBtn>
            </Sheet>
          </Pressable>
        </Pressable>
      </Modal>

      {showTimePicker && (
        <DateTimePicker
          value={takenAt}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={async (event, selectedDateTime) => {
            if (Platform.OS !== 'ios') setShowTimePicker(false);
            if (!selectedDateTime) return;
            setTakenAt(selectedDateTime);

            if (Platform.OS !== 'ios' && pendingSchedule) {
              await markTakenForSelectedDate(pendingSchedule.id, selectedDateTime);
              setPendingSchedule(null);
            }
          }}
        />
      )}

      {Platform.OS === 'ios' && showTimePicker && (
        <PickerDoneWrap>
          <PickerDoneBtn
            onPress={async () => {
              setShowTimePicker(false);
              if (pendingSchedule) {
                await markTakenForSelectedDate(pendingSchedule.id, takenAt);
                setPendingSchedule(null);
              }
            }}
          >
            <PickerDoneText>Done</PickerDoneText>
          </PickerDoneBtn>
        </PickerDoneWrap>
      )}
    </Container>
  );
}

/* helpers */
function iconForKind(kind) {
  if (kind === 'SEIZURE') return 'pulse';
  if (kind === 'MEDICATION') return 'pill';
  if (kind === 'APPOINTMENT') return 'calendar-clock';
  return 'circle';
}

function cleanText(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function toYMD(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalDateTime(s) {
  if (!s) return null;
  const m = String(s).match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/,
  );
  if (!m) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  const [, y, mo, d, h, mi, se] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se || 0));
}

function formatTime(d) {
  if (!d) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function prettyDate(ymd) {
  const dt = new Date(`${ymd}T00:00:00`);
  if (isNaN(dt.getTime())) return ymd;
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const d0 = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  const diff = Math.round((d0 - t0) / (24 * 60 * 60 * 1000));
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return dt.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDuration(totalSeconds) {
  const s = Number(totalSeconds || 0);
  if (!s) return '';
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

/* styled */
const Container = styled.View`
  flex: 1;
  background-color: #f5efe6;
`;

const TopBar = styled.View`
  height: 56px;
  background-color: #b03060;
  margin: 16px 24px 8px;
  border-radius: 18px;
  padding: 0 12px;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
`;

const BackBtn = styled.TouchableOpacity`padding: 6px;`;
const TopIcon = styled(Icon)`font-size: 26px; color: #fff;`;
const TopTitle = styled.Text`
  flex: 1;
  text-align: center;
  font-size: 18px;
  font-weight: 700;
  color: #fff;
`;
const TopSpacer = styled.View`width: 32px;`;

const Card = styled.View`
  background-color: #ffffff;
  border-radius: 22px;
  padding: 16px;
  margin-bottom: 14px;
`;

const CardTitle = styled.Text`
  font-size: 16px;
  font-weight: 900;
  color: #2f2f2f;
`;

const SmallText = styled.Text`
  margin-top: 6px;
  font-size: 12px;
  color: #6b5e58;
`;

const CalendarWrap = styled.View`
  margin-top: 10px;
  border-radius: 18px;
  overflow: hidden;
`;

const PillRow = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  margin-top: 10px;
`;

const Pill = styled.TouchableOpacity`
  padding: 10px 12px;
  border-radius: 14px;
  background-color: ${(p) => (p.active ? '#e7c7d3' : '#f5efe6')};
  border: 2px solid ${(p) => (p.active ? '#b03060' : 'transparent')};
  margin-right: 10px;
  margin-bottom: 10px;
`;

const PillText = styled.Text`
  font-weight: 900;
  color: ${(p) => (p.active ? '#b03060' : '#2f2f2f')};
`;

const LoadingWrapper = styled.View`
  padding: 30px 0;
  align-items: center;
`;

const EventCard = styled.TouchableOpacity`
  background-color: #ffffff;
  border-radius: 22px;
  padding: 14px 16px;
  margin-bottom: 12px;
  flex-direction: row;
  align-items: center;
`;

const EventLeft = styled.View`
  width: 34px;
  align-items: center;
`;

const EventIcon = styled(Icon)`
  font-size: 20px;
  color: #b03060;
`;

const EventBody = styled.View`
  flex: 1;
`;

const EventTopRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

const EventTime = styled.Text`
  font-size: 13px;
  font-weight: 900;
  color: #2f2f2f;
`;

const EventChip = styled.Text`
  font-size: 11px;
  font-weight: 900;
  color: #b03060;
`;

const EventTitle = styled.Text`
  margin-top: 2px;
  font-size: 14px;
  font-weight: 900;
  color: #2f2f2f;
`;

const EventSub = styled.Text`
  margin-top: 2px;
  font-size: 12px;
  color: #6b5e58;
  font-weight: 700;
`;

const Chevron = styled.View`
  margin-left: 8px;
`;

const Fab = styled.TouchableOpacity`
  position: absolute;
  right: 22px;
  bottom: 22px;
  width: 58px;
  height: 58px;
  border-radius: 29px;
  background-color: #b03060;
  justify-content: center;
  align-items: center;
  shadow-color: #000;
  shadow-opacity: 0.2;
  shadow-radius: 10px;
  elevation: 6;
`;

const FabIcon = styled(Icon)`
  font-size: 28px;
  color: #fff;
`;

const Sheet = styled.View`
  background-color: #ffffff;
  border-top-left-radius: 22px;
  border-top-right-radius: 22px;
  padding: 16px;
`;

const SheetTitle = styled.Text`
  font-size: 16px;
  font-weight: 900;
  color: #2f2f2f;
  margin-bottom: 10px;
`;

const SheetBtn = styled(TouchableOpacity)`
  padding: 14px 12px;
  border-radius: 16px;
  background-color: #f5efe6;
  flex-direction: row;
  align-items: center;
  margin-bottom: 10px;
`;

const SheetIcon = styled(Icon)`
  font-size: 20px;
  color: #b03060;
  margin-right: 10px;
`;

const SheetText = styled.Text`
  font-size: 14px;
  font-weight: 900;
  color: #2f2f2f;
`;

const QuickMedBtn = styled.TouchableOpacity`
  margin-top: 10px;
  border-radius: 14px;
  background-color: #f5efe6;
  padding: 12px;
  flex-direction: row;
  align-items: center;
`;

const QuickMedIcon = styled(Icon)`
  font-size: 18px;
  color: #b03060;
  margin-right: 8px;
`;

const QuickMedText = styled.Text`
  font-size: 13px;
  font-weight: 800;
  color: #2f2f2f;
`;

const PickerDoneWrap = styled.View`
  padding: 0 20px 16px;
`;

const PickerDoneBtn = styled.TouchableOpacity`
  align-self: flex-end;
  background-color: #b03060;
  border-radius: 12px;
  padding: 10px 16px;
`;

const PickerDoneText = styled.Text`
  color: #fff;
  font-weight: 700;
`;
