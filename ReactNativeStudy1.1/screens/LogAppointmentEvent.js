import React, { useMemo, useState } from 'react';
import { Alert, Platform, ScrollView } from 'react-native';
import styled from 'styled-components/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BASE_URL } from '../config';

export default function LogAppointmentEvent({ route, navigation }) {
  const { userId, dateYmd, existing } = route.params;

  const [title, setTitle] = useState(existing?.title || 'Doctor appointment');
  const [location, setLocation] = useState(existing?.location || '');
  const [notes, setNotes] = useState(existing?.notes || '');

  const initial = useMemo(() => {
    if (existing?.startTime) {
      const s = String(existing.startTime).replace(' ', 'T');
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d;
    }
    if (dateYmd) {
      const d = new Date(`${dateYmd}T12:00:00`);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  }, [existing, dateYmd]);

  const [startAt, setStartAt] = useState(initial);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const save = async () => {
    try {
      const body = {
        id: existing?.id ?? null,
        startTime: startAt.toISOString().slice(0, 19),
        endTime: null, // reserved for later
        title: title.trim() ? title.trim() : 'Doctor appointment',
        location: location.trim() ? location.trim() : null,
        notes: notes.trim() ? notes.trim() : null,
      };

      const res = await fetch(`${BASE_URL}/api/appointments/by-user/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      if (!res.ok) {
        Alert.alert('Error', text || 'Could not save appointment.');
        return;
      }

      Alert.alert('Saved', 'Appointment added.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Failed to save appointment.');
    }
  };

  const formatDate = (d) =>
    d.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });

  const formatTime = (d) =>
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  return (
    <Container>
      <TopBar>
        <BackBtn onPress={() => navigation.goBack()}>
          <TopIcon name="chevron-left" />
        </BackBtn>
        <TopTitle>Appointment</TopTitle>
        <TopSpacer />
      </TopBar>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 30 }}>
        <Card>
          <CardTitle>Details</CardTitle>

          <Label>Title</Label>
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Neurology review"
            placeholderTextColor="#8b7e76"
          />

          <Label>Location</Label>
          <Input
            value={location}
            onChangeText={setLocation}
            placeholder="e.g. Hospital / Clinic"
            placeholderTextColor="#8b7e76"
          />

          <Label>Notes</Label>
          <TextArea
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything to remember"
            placeholderTextColor="#8b7e76"
            multiline
          />
        </Card>

        <Card>
          <CardTitle>Date & Time</CardTitle>

          <Row>
            <Half>
              <Label>Date</Label>
              <TouchableBox onPress={() => setShowDatePicker(true)}>
                <BoxText>{formatDate(startAt)}</BoxText>
              </TouchableBox>
            </Half>

            <Half>
              <Label>Time</Label>
              <TouchableBox onPress={() => setShowTimePicker(true)}>
                <BoxText>{formatTime(startAt)}</BoxText>
              </TouchableBox>
            </Half>
          </Row>

          {showDatePicker && (
            <DateTimePicker
              value={startAt}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                if (Platform.OS !== 'ios') setShowDatePicker(false);
                if (selectedDate) {
                  const updated = new Date(startAt);
                  updated.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                  setStartAt(updated);
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
              value={startAt}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                if (Platform.OS !== 'ios') setShowTimePicker(false);
                if (selectedDate) {
                  const updated = new Date(startAt);
                  updated.setHours(
                    selectedDate.getHours(),
                    selectedDate.getMinutes(),
                    selectedDate.getSeconds(),
                    selectedDate.getMilliseconds(),
                  );
                  setStartAt(updated);
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

/* styled (same style as your app) */
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

const Label = styled.Text`
  margin-top: 10px;
  font-size: 12px;
  font-weight: 800;
  color: #6b5e58;
`;

const Input = styled.TextInput`
  margin-top: 8px;
  background-color: #f5efe6;
  border-radius: 14px;
  padding: 12px;
  font-size: 14px;
  color: #2f2f2f;
  font-weight: 700;
`;

const TextArea = styled.TextInput`
  margin-top: 8px;
  background-color: #f5efe6;
  border-radius: 14px;
  padding: 12px;
  font-size: 14px;
  color: #2f2f2f;
  min-height: 90px;
  font-weight: 700;
`;

const Row = styled.View`
  flex-direction: row;
  justify-content: space-between;
  margin-top: 10px;
`;

const Half = styled.View`
  width: 48%;
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
