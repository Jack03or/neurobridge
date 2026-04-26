import React, { useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StatusBar } from 'react-native';
import styled from 'styled-components/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BASE_URL } from '../config';

export default function GenerateReport({ route, navigation }) {
  const { userId } = route.params;

  const [mode, setMode] = useState('WEEKLY');
  const [title, setTitle] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const today = new Date();
  const defaultStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d;
  }, []);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(today);
  const [loading, setLoading] = useState(false);

  const formatDate = (d) =>
    d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

  const formatDateIso = (d) => {
    const year = d.getFullYear();
    const month = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const updatePreset = (nextMode) => {
    setMode(nextMode);
    const now = new Date();
    if (nextMode === 'WEEKLY') {
      const start = new Date();
      start.setDate(now.getDate() - 6);
      setStartDate(start);
      setEndDate(now);
    } else if (nextMode === 'MONTHLY') {
      const start = new Date();
      start.setDate(now.getDate() - 29);
      setStartDate(start);
      setEndDate(now);
    }
  };

  const onGenerate = async () => {
    const validModes = ['WEEKLY', 'MONTHLY', 'CUSTOM'];
    if (!validModes.includes(mode) || !startDate || !endDate || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      Alert.alert('Missing timeframe', 'Please choose a valid report timeframe before generating the report.');
      return;
    }

    if (mode === 'CUSTOM' && endDate < startDate) {
      Alert.alert('Invalid range', 'End date must be after start date.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        startDate: formatDateIso(startDate),
        endDate: formatDateIso(endDate),
        type: mode,
        title: title.trim(),
      };

      const response = await fetch(
        `${BASE_URL}/api/reports/by-user/${userId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      const text = await response.text();
      if (!response.ok) {
        Alert.alert('Error', text || 'Could not generate report.');
        return;
      }

      let data = null;
      try {
        data = JSON.parse(text);
      } catch (e) {
        Alert.alert('Error', 'Unexpected response from server.');
        return;
      }

      navigation.navigate('ReportPreview', {
        userId,
        reportId: data.reportId,
        reportData: data.reportData,
        downloadUrl: data.downloadUrl,
      });
    } catch (err) {
      Alert.alert('Error', 'Could not generate report.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
        <Header>
          <Title>Generate Report</Title>
          <Subtle>Choose a timeframe and title</Subtle>
        </Header>

        <Card>
          <SectionTitle>Timeframe</SectionTitle>
          <PillRow>
            <Pill onPress={() => updatePreset('WEEKLY')} active={mode === 'WEEKLY'}>
              <PillText active={mode === 'WEEKLY'}>Last 7 days</PillText>
            </Pill>
            <Pill onPress={() => updatePreset('MONTHLY')} active={mode === 'MONTHLY'}>
              <PillText active={mode === 'MONTHLY'}>Last 30 days</PillText>
            </Pill>
            <Pill onPress={() => setMode('CUSTOM')} active={mode === 'CUSTOM'}>
              <PillText active={mode === 'CUSTOM'}>Custom</PillText>
            </Pill>
          </PillRow>

          {mode === 'CUSTOM' ? (
            <DateRow>
              <DateButton onPress={() => setShowStartPicker(true)}>
                <DateLabel>Start</DateLabel>
                <DateValue>{formatDate(startDate)}</DateValue>
              </DateButton>
              <DateButton onPress={() => setShowEndPicker(true)}>
                <DateLabel>End</DateLabel>
                <DateValue>{formatDate(endDate)}</DateValue>
              </DateButton>
            </DateRow>
          ) : null}

          {showStartPicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, date) => {
                if (Platform.OS !== 'ios') setShowStartPicker(false);
                if (date) setStartDate(date);
              }}
            />
          )}

          {Platform.OS === 'ios' && showStartPicker && (
            <DoneBtn onPress={() => setShowStartPicker(false)}>
              <DoneText>Done</DoneText>
            </DoneBtn>
          )}

          {showEndPicker && (
            <DateTimePicker
              value={endDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, date) => {
                if (Platform.OS !== 'ios') setShowEndPicker(false);
                if (date) setEndDate(date);
              }}
            />
          )}

          {Platform.OS === 'ios' && showEndPicker && (
            <DoneBtn onPress={() => setShowEndPicker(false)}>
              <DoneText>Done</DoneText>
            </DoneBtn>
          )}

          <SectionTitle>Report Title</SectionTitle>
          <Input
            placeholder="e.g., Monthly Checkup"
            value={title}
            onChangeText={setTitle}
          />
          <Hint>Leave blank to use the default title.</Hint>
        </Card>

        <PrimaryButton onPress={onGenerate} disabled={loading}>
          <PrimaryButtonText>
            {loading ? 'Generating...' : 'Generate Report'}
          </PrimaryButtonText>
        </PrimaryButton>

        <LinkButton onPress={() => navigation.navigate('SavedReports', { userId })}>
          <LinkText>View Saved Reports</LinkText>
        </LinkButton>
      </ScrollView>
    </Container>
  );
}

const Container = styled.View`
  flex: 1;
  background-color: #f5efe6;
`;

const Header = styled.View`
  margin-bottom: 16px;
`;

const Title = styled.Text`
  font-size: 22px;
  font-weight: 700;
  color: #2f2f2f;
`;

const Subtle = styled.Text`
  font-size: 13px;
  color: #6b5e58;
  margin-top: 4px;
`;

const Card = styled.View`
  background-color: #ffffff;
  border-radius: 24px;
  padding: 20px;
  shadow-color: #000;
  shadow-opacity: 0.08;
  shadow-radius: 10px;
  elevation: 4;
`;

const SectionTitle = styled.Text`
  font-size: 14px;
  font-weight: 700;
  color: #2f2f2f;
  margin-bottom: 10px;
  margin-top: 6px;
`;

const PillRow = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
`;

const Pill = styled.TouchableOpacity`
  padding: 8px 12px;
  border-radius: 16px;
  background-color: ${(props) => (props.active ? '#b03060' : '#f5efe6')};
`;

const PillText = styled.Text`
  color: ${(props) => (props.active ? '#ffffff' : '#6b5e58')};
  font-size: 12px;
  font-weight: 600;
`;

const DateRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: 10px;
`;

const DateButton = styled.TouchableOpacity`
  flex: 1;
  background-color: #f5efe6;
  padding: 10px 12px;
  border-radius: 14px;
  margin-right: 10px;
`;

const DateLabel = styled.Text`
  font-size: 11px;
  color: #6b5e58;
`;

const DateValue = styled.Text`
  font-size: 13px;
  font-weight: 600;
  color: #2f2f2f;
`;

const DoneBtn = styled.TouchableOpacity`
  margin-top: 10px;
  align-self: flex-end;
  background-color: #b03060;
  padding: 10px 16px;
  border-radius: 12px;
`;

const DoneText = styled.Text`
  color: #ffffff;
  font-weight: 700;
`;

const Input = styled.TextInput`
  background-color: #f5efe6;
  border-radius: 14px;
  padding: 12px 14px;
  font-size: 13px;
  color: #2f2f2f;
`;

const Hint = styled.Text`
  font-size: 11px;
  color: #8b7e76;
  margin-top: 6px;
`;

const PrimaryButton = styled.TouchableOpacity`
  margin-top: 20px;
  background-color: #b03060;
  padding: 14px 18px;
  border-radius: 20px;
  align-items: center;
`;

const PrimaryButtonText = styled.Text`
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
`;

const LinkButton = styled.TouchableOpacity`
  margin-top: 12px;
  align-items: center;
`;

const LinkText = styled.Text`
  color: #b03060;
  font-size: 13px;
  font-weight: 600;
`;
