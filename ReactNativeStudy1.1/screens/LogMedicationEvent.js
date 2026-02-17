import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  Switch,
} from 'react-native';
import styled from 'styled-components/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BASE_URL } from '../config';

export default function LogMedicationEvent({ route, navigation }) {
  const { userId, dateYmd, existing } = route.params;

  const [taken, setTaken] = useState(existing?.taken ?? true);
  const [useTime, setUseTime] = useState(existing?.takenAt ? true : true);
  const [schedules, setSchedules] = useState([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState(existing?.schedule?.id ?? null);

  const initial = useMemo(() => {
    if (existing?.takenAt) {
      const s = String(existing.takenAt).replace(' ', 'T');
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d;
    }

    if (existing?.date) {
      const d = new Date(`${existing.date}T12:00:00`);
      if (!isNaN(d.getTime())) return d;
    }

    if (dateYmd) {
      const d = new Date(`${dateYmd}T12:00:00`);
      if (!isNaN(d.getTime())) return d;
    }

    return new Date();
  }, [existing, dateYmd]);

  const [takenAt, setTakenAt] = useState(initial);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    const loadSchedules = async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/medication-schedules/by-user/${userId}`);
        const text = await response.text();
        if (!response.ok) return;
        const data = text ? JSON.parse(text) : [];
        setSchedules(data);

        if (!selectedScheduleId && data.length) {
          setSelectedScheduleId(data[0].id);
        }
      } catch (err) {
        setSchedules([]);
      }
    };

    loadSchedules();
  }, [userId]);

  const selectedSchedule = schedules.find((s) => s.id === selectedScheduleId) || null;

  const save = async () => {
    try {
      if (!selectedScheduleId) {
        Alert.alert('Medication required', 'Select a medication first.');
        return;
      }

      const date = toYMD(takenAt);
      const body = {
        id: existing?.id ?? null,
        date,
        taken,
        takenAt: useTime ? toIsoLocal(takenAt) : null,
        medicationName: selectedSchedule?.medicationName ?? existing?.medicationName ?? null,
        dose: selectedSchedule?.dose ?? existing?.dose ?? null,
        scheduleId: selectedScheduleId,
      };

      const res = await fetch(`${BASE_URL}/api/medications/by-user/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      if (!res.ok) {
        Alert.alert('Error', text || 'Could not save medication log.');
        return;
      }

      Alert.alert('Saved', taken ? 'Medication marked as taken.' : 'Medication marked as missed.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Failed to save medication log.');
    }
  };

  const formatDate = (d) =>
    d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

  const formatTime = (d) =>
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  return (
    <Container>
      <TopBar>
        <BackBtn onPress={() => navigation.goBack()}>
          <TopIcon name="chevron-left" />
        </BackBtn>
        <TopTitle>Medication</TopTitle>
        <TopSpacer />
      </TopBar>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 30 }}>
        <Card>
          <CardTitle>Status</CardTitle>
          <PillRow>
            {[
              { key: true, label: 'TAKEN' },
              { key: false, label: 'MISSED' },
            ].map((p) => (
              <Pill
                key={String(p.key)}
                active={taken === p.key}
                onPress={() => setTaken(p.key)}
              >
                <PillText active={taken === p.key}>{p.label}</PillText>
              </Pill>
            ))}
          </PillRow>
        </Card>

        <Card>
          <CardTitle>Medication details</CardTitle>
          <SmallText>Pick from medication saved in child profile.</SmallText>

          {schedules.length === 0 ? (
            <SmallText style={{ marginTop: 12 }}>
              No medication schedule found. Add medication in child setup first.
            </SmallText>
          ) : (
            <PillRow>
              {schedules.map((s) => (
                <Pill
                  key={s.id}
                  active={selectedScheduleId === s.id}
                  onPress={() => setSelectedScheduleId(s.id)}
                >
                  <PillText active={selectedScheduleId === s.id}>
                    {s.medicationName}
                    {s.dose ? ` (${s.dose})` : ''}
                  </PillText>
                </Pill>
              ))}
            </PillRow>
          )}
        </Card>

        <Card>
          <CardTitle>Date & Time</CardTitle>
          <SmallText>Log when this was recorded.</SmallText>

          <Row>
            <Half>
              <Label>Date</Label>
              <TouchableBox onPress={() => setShowDatePicker(true)}>
                <BoxText>{formatDate(takenAt)}</BoxText>
              </TouchableBox>
            </Half>

            <Half>
              <Label>Time</Label>
              <TouchableBox
                onPress={() => setShowTimePicker(true)}
                disabled={!useTime}
              >
                <BoxText style={{ opacity: useTime ? 1 : 0.5 }}>
                  {useTime ? formatTime(takenAt) : 'Not set'}
                </BoxText>
              </TouchableBox>
            </Half>
          </Row>

          <ToggleRow>
            <ToggleText>Include time</ToggleText>
            <Switch value={useTime} onValueChange={setUseTime} />
          </ToggleRow>

          {showDatePicker && (
            <DateTimePicker
              value={takenAt}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              maximumDate={new Date()}
              onChange={(event, selectedDate) => {
                if (Platform.OS !== 'ios') setShowDatePicker(false);
                if (selectedDate) {
                  const updated = new Date(takenAt);
                  updated.setFullYear(
                    selectedDate.getFullYear(),
                    selectedDate.getMonth(),
                    selectedDate.getDate(),
                  );
                  setTakenAt(updated);
                }
              }}
            />
          )}

          {Platform.OS === 'ios' && showDatePicker && (
            <DoneBtn onPress={() => setShowDatePicker(false)}>
              <DoneText>Done</DoneText>
            </DoneBtn>
          )}

          {showTimePicker && (
            <DateTimePicker
              value={takenAt}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                if (Platform.OS !== 'ios') setShowTimePicker(false);
                if (selectedDate) {
                  const updated = new Date(takenAt);
                  updated.setHours(
                    selectedDate.getHours(),
                    selectedDate.getMinutes(),
                    selectedDate.getSeconds(),
                    selectedDate.getMilliseconds(),
                  );
                  setTakenAt(updated);
                }
              }}
            />
          )}

          {Platform.OS === 'ios' && showTimePicker && (
            <DoneBtn onPress={() => setShowTimePicker(false)}>
              <DoneText>Done</DoneText>
            </DoneBtn>
          )}
        </Card>

        <SaveBtn onPress={save}>
          <SaveText>Save</SaveText>
        </SaveBtn>
      </ScrollView>
    </Container>
  );
}

function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toIsoLocal(d) {
  const pad = (v) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

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

const Row = styled.View`
  flex-direction: row;
  justify-content: space-between;
  margin-top: 10px;
`;

const Half = styled.View`
  width: 48%;
`;

const Label = styled.Text`
  margin-top: 8px;
  font-size: 12px;
  font-weight: 800;
  color: #6b5e58;
`;

const TouchableBox = styled.TouchableOpacity`
  margin-top: 8px;
  background-color: #f5efe6;
  border-radius: 14px;
  padding: 12px;
`;

const BoxText = styled.Text`
  font-size: 14px;
  color: #2f2f2f;
  font-weight: 700;
`;

const DoneBtn = styled.TouchableOpacity`
  margin-top: 10px;
  align-self: flex-end;
  background-color: #b03060;
  padding: 10px 16px;
  border-radius: 12px;
`;

const DoneText = styled.Text`
  color: #fff;
  font-weight: 900;
`;

const ToggleRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
`;

const ToggleText = styled.Text`
  font-size: 13px;
  font-weight: 700;
  color: #2f2f2f;
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

const SaveBtn = styled.TouchableOpacity`
  background-color: #b03060;
  padding: 14px;
  border-radius: 18px;
  align-items: center;
`;

const SaveText = styled.Text`
  color: #fff;
  font-weight: 900;
`;

