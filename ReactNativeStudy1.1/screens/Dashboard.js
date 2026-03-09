// screens/Dashboard.js
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, Alert, ScrollView, Platform, Modal, Pressable, SafeAreaView } from 'react-native';
import styled from 'styled-components/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BASE_URL } from '../config';
import InsightTrendLine from '../components/charts/InsightTrendLine';
import InsightTimingPie from '../components/charts/InsightTimingPie';

export default function Dashboard({ route, navigation }) {
  const { userId } = route.params;
  const [dashboard, setDashboard] = useState(null);
  const [insights, setInsights] = useState([]);
  const [charts, setCharts] = useState({
    trendSeries: { labels: [], values: [] },
    medicationSplit: { labels: [], values: [] },
    timingSplit: { labels: [], values: [] },
  });
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [pendingSchedule, setPendingSchedule] = useState(null);
  const [takenAt, setTakenAt] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showMedicationModal, setShowMedicationModal] = useState(false);
  const [refreshingRisk, setRefreshingRisk] = useState(false);

  const maybeShowMedicationReminder = (data) => {
    if (!data?.hasChild || data?.medicationTakenToday) return;

    Alert.alert(
      'Medication reminder',
      'Medication has not been marked as taken today.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Mark as taken', onPress: handleMedicationTap },
      ]
    );
  };

  const fetchDashboard = async () => {
    try {
      const response = await fetch(
        `${BASE_URL}/api/dashboard/by-user/${userId}`,
      );
      const text = await response.text();

      if (!response.ok) {
        Alert.alert('Error', text || 'Could not load dashboard data.');
        return;
      }

      let data = null;
      try {
        data = JSON.parse(text);
      } catch (e) {
        Alert.alert('Error', 'Unexpected server response.');
        return;
      }

      setDashboard(data);
      maybeShowMedicationReminder(data);
    } catch (err) {
      Alert.alert('Error', 'Could not load dashboard information.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/medication-schedules/by-user/${userId}`);
      const text = await response.text();
      if (!response.ok) return;
      setSchedules(text ? JSON.parse(text) : []);
    } catch (err) {
      setSchedules([]);
    }
  };

  const fetchInsights = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/dashboard/insights/by-user/${userId}`);
      const text = await response.text();
      if (!response.ok) {
        setInsights([]);
        setCharts({
          trendSeries: { labels: [], values: [] },
          medicationSplit: { labels: [], values: [] },
          timingSplit: { labels: [], values: [] },
        });
        return;
      }
      const data = text ? JSON.parse(text) : {};
      setInsights(Array.isArray(data.insights) ? data.insights.slice(0, 3) : []);
      setCharts(data.charts || {
        trendSeries: { labels: [], values: [] },
        medicationSplit: { labels: [], values: [] },
        timingSplit: { labels: [], values: [] },
      });
    } catch (err) {
      setInsights([]);
      setCharts({
        trendSeries: { labels: [], values: [] },
        medicationSplit: { labels: [], values: [] },
        timingSplit: { labels: [], values: [] },
      });
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetchSchedules();
    fetchInsights();
  }, [userId]);

  const toIsoLocal = (d) => {
    const pad = (v) => String(v).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const markTakenNow = async (scheduleId, time) => {
    try {
      const response = await fetch(`${BASE_URL}/api/medications/mark-taken/by-user/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId,
          takenAt: toIsoLocal(time),
        }),
      });
      const text = await response.text();
      if (!response.ok) {
        Alert.alert('Error', text || 'Could not mark medication taken.');
        return;
      }
      await refreshRisk(true);
      Alert.alert('Saved', 'Medication marked as taken.');
    } catch (err) {
      Alert.alert('Error', 'Could not mark medication taken.');
    }
  };

  const refreshRisk = async (silent = false) => {
    try {
      setRefreshingRisk(true);
      const response = await fetch(`${BASE_URL}/api/dashboard/refresh-risk/by-user/${userId}`, {
        method: 'POST',
      });
      const text = await response.text();
      if (!response.ok) {
        if (!silent) Alert.alert('Error', text || 'Could not refresh risk.');
        return;
      }
      const data = text ? JSON.parse(text) : null;
      if (data) {
        setDashboard(data);
        maybeShowMedicationReminder(data);
      }
      await fetchInsights();
      if (!silent) Alert.alert('Updated', 'Risk refreshed.');
    } catch (err) {
      if (!silent) Alert.alert('Error', 'Could not refresh risk.');
    } finally {
      setRefreshingRisk(false);
    }
  };

  const handleMedicationTap = () => {
    if (!schedules.length) {
      Alert.alert('No medication set', 'Add medication in child setup first.');
      return;
    }
    setPendingSchedule(schedules[0]);
    setTakenAt(new Date());
    setShowMedicationModal(true);
  };

  const formatTime = (d) =>
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  const calculateAgeFromDob = (dobString) => {
    if (!dobString) return '-';

    const [yearStr, monthStr, dayStr] = dobString.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    const day = parseInt(dayStr, 10);

    const dob = new Date(year, month, day);
    const today = new Date();

    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  };

  const hasChild = dashboard?.hasChild;
  const age = dashboard?.dob ? calculateAgeFromDob(dashboard.dob) : '-';

  const riskLevel = (dashboard?.riskLevel || 'UNKNOWN').toUpperCase();

  const getRiskTone = (level) => {
    if (level === 'LOW') {
      return { color: '#2e7d32', message: 'Looking stable today.' };
    }
    if (level === 'MEDIUM') {
      return { color: '#f9a825', message: 'Keep an eye on symptoms.' };
    }
    if (level === 'HIGH' || level === 'VERY_HIGH') {
      return { color: '#c62828', message: 'Higher risk today. Stay alert.' };
    }
    return { color: '#6b5e58', message: 'Not enough data yet.' };
  };

  const riskTone = getRiskTone(riskLevel);

  const findInsight = (matcher) => {
    return insights.find((item) => matcher((item || '').toLowerCase())) || 'Not enough data yet.';
  };

  const timingInsight = findInsight((txt) =>
    txt.includes('morning') || txt.includes('afternoon') || txt.includes('evening') || txt.includes('night')
  );
  const weeklyInsight = findInsight((txt) =>
    txt.includes('mon') || txt.includes('tue') || txt.includes('wed') || txt.includes('thu') || txt.includes('fri') || txt.includes('sat') || txt.includes('sun')
  );
  const trendLabels = Array.isArray(charts?.trendSeries?.labels) ? charts.trendSeries.labels : [];
  const trendValues = Array.isArray(charts?.trendSeries?.values) ? charts.trendSeries.values.map((v) => Number(v || 0)) : [];
  const trendTotal = trendValues.reduce((sum, value) => sum + value, 0);
  const trendMax = trendValues.length ? Math.max(...trendValues) : 0;
  const topDays = trendLabels.filter((_, idx) => trendValues[idx] === trendMax && trendMax > 0);
  const trendSummary = trendTotal === 0
    ? 'No seizures logged in the last 7 days.'
    : topDays.length > 1
      ? `${trendTotal} seizures in the last 7 days. Highest days: ${topDays.join(', ')} (${trendMax}).`
      : `${trendTotal} seizures in the last 7 days. Highest day: ${topDays[0]} (${trendMax}).`;

  return (
    <Container>
      <StatusBar barStyle="light-content" />
      <SafeTop />

      <TopBar>
        {/* put onPress back for settings */}
        <SettingsButton onPress={() => navigation.navigate('Settings')}>
          <TopIcon name="cog-outline" />
        </SettingsButton>

        <TopTitle>Neurobridge</TopTitle>
        <SettingsButton onPress={() => refreshRisk(false)} disabled={refreshingRisk}>
          <TopIcon name={refreshingRisk ? 'loading' : 'refresh'} />
        </SettingsButton>
      </TopBar>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
        <ChildCard>
          {loading ? (
            <LoadingWrapper>
              <ActivityIndicator />
            </LoadingWrapper>
          ) : !hasChild ? (
            <EmptyState>
              <EmptyTitle>No child linked yet</EmptyTitle>
              <EmptyText>
                Add your child to start tracking seizures and health data.
              </EmptyText>
              <EmptyButton
                onPress={() => navigation.navigate('AddChild', { userId })}
              >
                <EmptyButtonText>Add Child</EmptyButtonText>
              </EmptyButton>
            </EmptyState>
          ) : (
            <>
              <ChildHeaderRow>
                <ChildName>{dashboard.childName}</ChildName>
                <ChildAge>{age === '-' ? 'Age —' : `Age ${age}`}</ChildAge>
              </ChildHeaderRow>

              <ChildSubRow>
                <ChildInfoText>{dashboard.gender}</ChildInfoText>
                {dashboard.disability ? (
                  <ChildInfoText numberOfLines={1}>
                    {dashboard.disability}
                  </ChildInfoText>
                ) : null}
              </ChildSubRow>

              <SummaryRow>
                <SummaryItem>
                  <SummaryLabel>Last seizure</SummaryLabel>
                  <SummaryValue>{dashboard.lastSeizureText || '--'}</SummaryValue>
                </SummaryItem>

                <SummaryItem>
                  <SummaryLabel>Medication</SummaryLabel>
                  <MedicationStatusButton onPress={handleMedicationTap}>
                  <MedicationStatus>
                    {dashboard.medicationTakenToday ? (
                      <>
                        <MedicationIcon name="check-circle-outline" />
                        <MedicationText>Taken today</MedicationText>
                      </>
                    ) : (
                      <>
                        <MedicationIcon name="close-circle-outline" />
                        <MedicationText>
                          {dashboard.medicationStatusText || 'Not logged'}
                        </MedicationText>
                      </>
                    )}
                  </MedicationStatus>
                  </MedicationStatusButton>
                </SummaryItem>
              </SummaryRow>

              <DeviceRow>
                <DeviceDot />
                <DeviceText>
                  Fitbit status: {dashboard.fitbitStatusText || 'Not connected'}
                </DeviceText>
              </DeviceRow>

              <StatusRing style={{ borderColor: riskTone.color }}>
                <StatusInner>
                  <StatusLabel>Today</StatusLabel>
                  <StatusValue style={{ color: riskTone.color }}>
                    {riskLevel === 'UNKNOWN' ? '--' : riskLevel}
                  </StatusValue>
                  <StatusHint>{riskTone.message}</StatusHint>
                </StatusInner>
              </StatusRing>

              {/* Metric cards */}
              <MetricsRow>
                <MetricChip>
                  <MetricLabel>Sleep</MetricLabel>
                  <MetricValue>
                    {dashboard.sleepHours != null
                      ? `${dashboard.sleepHours.toFixed(1)} hrs`
                      : '-- hrs'}
                  </MetricValue>
                  <MetricSubtext>Last night</MetricSubtext>
                </MetricChip>

                <MetricChip>
                  <MetricLabel>Heart rate</MetricLabel>
                  <MetricValue>
                    {dashboard.heartRate != null
                      ? `${dashboard.heartRate} bpm`
                      : '-- bpm'}
                  </MetricValue>
                  <MetricSubtext>
                    {dashboard.heartRateAgeMinutes != null
                      ? `${dashboard.heartRateAgeMinutes} min ago`
                      : '--'}
                  </MetricSubtext>
                </MetricChip>

                <MetricChip>
                  <MetricLabel>HRV</MetricLabel>
                  <MetricValue>
                    {dashboard.hrv != null ? dashboard.hrv.toString() : '--'}
                  </MetricValue>
                  <MetricSubtext>Today</MetricSubtext>
                </MetricChip>
              </MetricsRow>
            </>
          )}
        </ChildCard>

        <InsightsSection>
          <InsightsHeader>Epilepsy Insights</InsightsHeader>
          <InsightCard full>
            <InsightTopRow>
              <InsightIcon name="chart-line" />
              <InsightTitle>Trend Pattern</InsightTitle>
            </InsightTopRow>
            <InsightTrendLine data={charts.trendSeries} />
            <InsightText>{trendSummary}</InsightText>
          </InsightCard>

          <InsightCard full>
            <InsightTopRow>
              <InsightIcon name="clock-outline" />
              <InsightTitle>Timing Pattern</InsightTitle>
            </InsightTopRow>
            <InsightTimingPie data={charts.timingSplit} />
            <InsightText>{timingInsight === 'Not enough data yet.' ? weeklyInsight : timingInsight}</InsightText>
          </InsightCard>
        </InsightsSection>
      </ScrollView>

      {showMedicationModal && (
        <Modal transparent animationType="fade" onRequestClose={() => setShowMedicationModal(false)}>
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}
            onPress={() => {
              setShowMedicationModal(false);
              setShowTimePicker(false);
            }}
          >
            <Pressable style={{ marginTop: 'auto' }} onPress={() => {}}>
              <MedicationSheet>
                <SheetTitle>Did they take medication today?</SheetTitle>
                <SheetHint>Select medication and time, then save.</SheetHint>

                <PillWrap>
                  {schedules.map((s) => (
                    <SheetPill
                      key={s.id}
                      active={pendingSchedule?.id === s.id}
                      onPress={() => setPendingSchedule(s)}
                    >
                      <SheetPillText active={pendingSchedule?.id === s.id}>
                        {s.medicationName}
                        {s.dose ? ` (${s.dose})` : ''}
                      </SheetPillText>
                    </SheetPill>
                  ))}
                </PillWrap>

                <TimeRow onPress={() => setShowTimePicker(true)}>
                  <TimeLabel>Time taken</TimeLabel>
                  <TimeValue>{formatTime(takenAt)}</TimeValue>
                </TimeRow>

                {showTimePicker && (
                  <DateTimePicker
                    value={takenAt}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      if (Platform.OS !== 'ios') setShowTimePicker(false);
                      if (selectedDate) setTakenAt(selectedDate);
                    }}
                  />
                )}

                {Platform.OS === 'ios' && showTimePicker && (
                  <PickerDoneBtn onPress={() => setShowTimePicker(false)}>
                    <PickerDoneText>Done</PickerDoneText>
                  </PickerDoneBtn>
                )}

                <ActionRow>
                  <CancelBtn
                    onPress={() => {
                      setShowMedicationModal(false);
                      setShowTimePicker(false);
                    }}
                  >
                    <CancelText>Cancel</CancelText>
                  </CancelBtn>
                  <SaveBtn
                    onPress={async () => {
                      if (!pendingSchedule) return;
                      setShowMedicationModal(false);
                      setShowTimePicker(false);
                      await markTakenNow(pendingSchedule.id, takenAt);
                      setPendingSchedule(null);
                    }}
                  >
                    <SaveText>Mark Taken</SaveText>
                  </SaveBtn>
                </ActionRow>
              </MedicationSheet>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {!showMedicationModal && showTimePicker && (
        <DateTimePicker
          value={takenAt}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={async (event, selectedDate) => {
            if (Platform.OS !== 'ios') setShowTimePicker(false);
            if (!selectedDate) return;

            setTakenAt(selectedDate);

            if (Platform.OS !== 'ios' && pendingSchedule) {
              await markTakenNow(pendingSchedule.id, selectedDate);
              setPendingSchedule(null);
            }
          }}
        />
      )}

      {Platform.OS === 'ios' && !showMedicationModal && showTimePicker && (
        <PickerDoneWrap>
          <PickerDoneBtn
            onPress={async () => {
              setShowTimePicker(false);
              if (pendingSchedule) {
                await markTakenNow(pendingSchedule.id, takenAt);
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

/* styled components */

const Container = styled.View`
  flex: 1;
  background-color: #f5efe6;
`;

const SafeTop = styled(SafeAreaView)`
  background-color: #f5efe6;
`;

const TopBar = styled.View`
  height: 56px;
  background-color: #b03060;
  margin: 8px 24px 8px;
  border-radius: 18px;
  padding: 0 16px;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  shadow-color: #000;
  shadow-opacity: 0.12;
  shadow-radius: 8px;
  elevation: 4;
`;

const SettingsButton = styled.TouchableOpacity`
  padding: 6px;
`;

const TopIcon = styled(Icon)`
  font-size: 22px;
  color: #ffffff;
`;

const TopTitle = styled.Text`
  flex: 1;
  text-align: center;
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
`;

const ChildCard = styled.View`
  background-color: #ffffff;
  border-radius: 24px;
  padding: 20px;
  margin-bottom: 24px;
  shadow-color: #000;
  shadow-opacity: 0.08;
  shadow-radius: 10px;
  elevation: 4;
`;

const LoadingWrapper = styled.View`
  padding: 30px 0;
  align-items: center;
`;

const ChildHeaderRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

const ChildName = styled.Text`
  font-size: 22px;
  font-weight: 700;
  color: #2f2f2f;
`;

const ChildAge = styled.Text`
  font-size: 16px;
  font-weight: 600;
  color: #6b5e58;
`;

const ChildSubRow = styled.View`
  margin-top: 4px;
  flex-direction: row;
  justify-content: space-between;
`;

const ChildInfoText = styled.Text`
  font-size: 13px;
  color: #8b7e76;
  max-width: 60%;
`;

const SummaryRow = styled.View`
  margin-top: 14px;
  flex-direction: row;
  justify-content: space-between;
`;

const SummaryItem = styled.View`
  flex: 1;
  margin-right: 12px;
`;

const SummaryLabel = styled.Text`
  font-size: 11px;
  color: #8b7e76;
  margin-bottom: 2px;
`;

const SummaryValue = styled.Text`
  font-size: 14px;
  font-weight: 600;
  color: #2f2f2f;
`;

const MedicationStatus = styled.View`
  flex-direction: row;
  align-items: center;
`;

const MedicationStatusButton = styled.TouchableOpacity`
  align-self: flex-start;
`;

const MedicationIcon = styled(Icon)`
  font-size: 18px;
  color: #b03060;
  margin-right: 4px;
`;

const MedicationText = styled.Text`
  font-size: 13px;
  color: #2f2f2f;
`;

const DeviceRow = styled.View`
  margin-top: 8px;
  flex-direction: row;
  align-items: center;
`;

const DeviceDot = styled.View`
  width: 8px;
  height: 8px;
  border-radius: 4px;
  background-color: #b03060;
  margin-right: 6px;
`;

const DeviceText = styled.Text`
  font-size: 12px;
  color: #6b5e58;
`;

const StatusRing = styled.View`
  margin-top: 20px;
  align-self: center;
  width: 150px;
  height: 150px;
  border-radius: 75px;
  border-width: 10px;
  border-color: #b03060;
  justify-content: center;
  align-items: center;
`;

const StatusInner = styled.View`
  align-items: center;
`;

const StatusLabel = styled.Text`
  font-size: 12px;
  color: #6b5e58;
`;

const StatusValue = styled.Text`
  font-size: 26px;
  font-weight: 700;
  color: #b03060;
`;

const StatusHint = styled.Text`
  font-size: 11px;
  color: #6b5e58;
  text-align: center;
`;

const MetricsRow = styled.View`
  margin-top: 18px;
  flex-direction: row;
  justify-content: space-between;
`;

const MetricChip = styled.View`
  flex: 1;
  background-color: #f5efe6;
  padding: 10px 12px;
  border-radius: 14px;
  margin-right: 8px;
`;

const MetricLabel = styled.Text`
  font-size: 11px;
  color: #6b5e58;
`;

const MetricValue = styled.Text`
  font-size: 14px;
  font-weight: 600;
  color: #2f2f2f;
  margin-top: 2px;
`;

const MetricSubtext = styled.Text`
  font-size: 11px;
  color: #8b7e76;
  margin-top: 2px;
`;

const EmptyState = styled.View`
  align-items: flex-start;
`;

const EmptyTitle = styled.Text`
  font-size: 18px;
  font-weight: 700;
  color: #2f2f2f;
  margin-bottom: 6px;
`;

const EmptyText = styled.Text`
  font-size: 13px;
  color: #6b5e58;
  margin-bottom: 12px;
`;

const EmptyButton = styled.TouchableOpacity`
  background-color: #b03060;
  padding: 10px 18px;
  border-radius: 18px;
`;

const EmptyButtonText = styled.Text`
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
`;

const InsightsSection = styled.View`
  margin-top: 2px;
`;

const InsightsHeader = styled.Text`
  font-size: 18px;
  font-weight: 700;
  color: #2f2f2f;
  margin-bottom: 12px;
`;

const InsightCard = styled.View`
  width: ${(p) => (p.full ? '100%' : '48%')};
  min-height: 250px;
  border-radius: 18px;
  background-color: #ffffff;
  padding: 12px;
  margin-bottom: 12px;
  border-width: 1px;
  border-color: #ead9df;
`;

const InsightTopRow = styled.View`
  flex-direction: row;
  align-items: center;
`;

const InsightIcon = styled(Icon)`
  font-size: 18px;
  color: #b03060;
  margin-right: 6px;
`;

const InsightTitle = styled.Text`
  font-size: 13px;
  font-weight: 700;
  color: #2f2f2f;
`;

const InsightText = styled.Text`
  margin-top: 10px;
  font-size: 12px;
  color: #5f544f;
  line-height: 17px;
`;

const ActionsContainer = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-between;
`;

const ActionTileBase = styled.TouchableOpacity`
  width: 48%;
  height: 110px;
  border-radius: 20px;
  margin-bottom: 16px;
  justify-content: center;
  align-items: center;
  padding: 10px;
`;

const ActionTile = styled(ActionTileBase)`
  background-color: #b03060;
`;

const ActionTileDisabled = styled(ActionTileBase)`
  background-color: #f5efe6;
  border-width: 2px;
  border-color: #b03060;
`;

const ActionIcon = styled(Icon)`
  font-size: 30px;
  color: #ffffff;
  margin-bottom: 6px;
`;

const ActionText = styled.Text`
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
`;

const MedicationSheet = styled.View`
  background-color: #ffffff;
  border-top-left-radius: 22px;
  border-top-right-radius: 22px;
  padding: 16px;
`;

const SheetTitle = styled.Text`
  font-size: 17px;
  font-weight: 800;
  color: #2f2f2f;
`;

const SheetHint = styled.Text`
  margin-top: 4px;
  font-size: 12px;
  color: #6b5e58;
`;

const PillWrap = styled.View`
  margin-top: 12px;
  flex-direction: row;
  flex-wrap: wrap;
`;

const SheetPill = styled.TouchableOpacity`
  padding: 10px 12px;
  border-radius: 14px;
  background-color: ${(p) => (p.active ? '#e7c7d3' : '#f5efe6')};
  border-width: 2px;
  border-color: ${(p) => (p.active ? '#b03060' : 'transparent')};
  margin-right: 8px;
  margin-bottom: 8px;
`;

const SheetPillText = styled.Text`
  font-size: 12px;
  font-weight: 700;
  color: ${(p) => (p.active ? '#b03060' : '#2f2f2f')};
`;

const TimeRow = styled.TouchableOpacity`
  margin-top: 12px;
  background-color: #f5efe6;
  border-radius: 14px;
  padding: 12px;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

const TimeLabel = styled.Text`
  font-size: 12px;
  color: #6b5e58;
  font-weight: 700;
`;

const TimeValue = styled.Text`
  font-size: 14px;
  color: #2f2f2f;
  font-weight: 700;
`;

const ActionRow = styled.View`
  margin-top: 14px;
  flex-direction: row;
  justify-content: space-between;
`;

const CancelBtn = styled.TouchableOpacity`
  flex: 1;
  margin-right: 8px;
  border-radius: 12px;
  border-width: 1px;
  border-color: #b03060;
  padding: 12px;
  align-items: center;
`;

const CancelText = styled.Text`
  color: #b03060;
  font-size: 13px;
  font-weight: 700;
`;

const SaveBtn = styled.TouchableOpacity`
  flex: 1;
  margin-left: 8px;
  border-radius: 12px;
  background-color: #b03060;
  padding: 12px;
  align-items: center;
`;

const SaveText = styled.Text`
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
`;

const PickerDoneWrap = styled.View`
  padding: 0 24px 20px;
`;

const PickerDoneBtn = styled.TouchableOpacity`
  background-color: #b03060;
  border-radius: 12px;
  padding: 10px 16px;
  align-self: flex-end;
`;

const PickerDoneText = styled.Text`
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
`;
