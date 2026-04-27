// screens/Dashboard.js
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, Alert, ScrollView, Platform, Modal, Pressable, SafeAreaView, Linking } from 'react-native';
import styled from 'styled-components/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BASE_URL } from '../config';
import InsightSleepSeizureLine from '../components/charts/InsightSleepSeizureLine';
import InsightTrendLine from '../components/charts/InsightTrendLine';
import InsightTimingPie from '../components/charts/InsightTimingPie';

export default function Dashboard({ route, navigation }) {
  const { userId } = route.params;
  const [dashboard, setDashboard] = useState(null);
  const [categories, setCategories] = useState({});
  const [selectedInsightTab, setSelectedInsightTab] = useState('sleep');
  const [selectedChartTab, setSelectedChartTab] = useState('trend');
  const [selectedSecondaryChartTab, setSelectedSecondaryChartTab] = useState('timing');
  const [charts, setCharts] = useState({
    trendSeries: { labels: [], values: [] },
    medicationSplit: { labels: [], values: [] },
    timingSplit: { labels: [], values: [] },
    medicationHeatmap: { days: [], summary: 'Not enough medication data yet.' },
    sleepSeizureSeries: { labels: [], sleepValues: [], seizureMarkers: [], seizureCounts: [] },
  });
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [pendingSchedule, setPendingSchedule] = useState(null);
  const [takenAt, setTakenAt] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showMedicationModal, setShowMedicationModal] = useState(false);
  const [selectedTimingDetail, setSelectedTimingDetail] = useState(null);
  const [selectedTrendIndex, setSelectedTrendIndex] = useState(null);
  const [selectedSleepIndex, setSelectedSleepIndex] = useState(null);
  const [refreshingRisk, setRefreshingRisk] = useState(false);
  const [fitbitBusy, setFitbitBusy] = useState(false);
  const emptyCharts = {
    trendSeries: { labels: [], values: [] },
    medicationSplit: { labels: [], values: [] },
    timingSplit: { labels: [], values: [] },
    medicationHeatmap: { days: [], summary: 'Not enough medication data yet.' },
    sleepSeizureSeries: { labels: [], sleepValues: [], seizureMarkers: [], seizureCounts: [] },
    dailyDetails: [],
  };

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
        setCategories({});
        setCharts(emptyCharts);
        return;
      }
      const data = text ? JSON.parse(text) : {};
      setCategories(data.categories && typeof data.categories === 'object' ? data.categories : {});
      setCharts({ ...emptyCharts, ...(data.charts || {}) });
    } catch (err) {
      setCategories({});
      setCharts(emptyCharts);
    }
  };

  const refreshInsights = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/dashboard/refresh-insights/by-user/${userId}`, {
        method: 'POST',
      });
      const text = await response.text();
      if (!response.ok) {
        return false;
      }
      const data = text ? JSON.parse(text) : {};
      setCategories(data.categories && typeof data.categories === 'object' ? data.categories : {});
      setCharts({ ...emptyCharts, ...(data.charts || {}) });
      return true;
    } catch (err) {
      return false;
    }
  };

  useEffect(() => {
    setLoading(true);
    setDashboard(null);
    setCategories({});
    setCharts(emptyCharts);
    setSchedules([]);
    setPendingSchedule(null);
    setShowMedicationModal(false);
    setShowTimePicker(false);
    setSelectedTimingDetail(null);
    setSelectedTrendIndex(null);
    setSelectedSleepIndex(null);
    setSelectedInsightTab('sleep');
    setSelectedChartTab('trend');
    setSelectedSecondaryChartTab('timing');
    fetchDashboard();
    fetchSchedules();
    fetchInsights();
  }, [userId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchDashboard();
      fetchSchedules();
      fetchInsights();
    });

    return unsubscribe;
  }, [navigation, userId]);

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
      const refreshed = await refreshInsights();
      if (!refreshed) {
        await fetchInsights();
      }
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

  const hasChild = dashboard?.hasChild === true;
  const noChildLinked = dashboard?.hasChild === false;
  const age = dashboard?.dob ? calculateAgeFromDob(dashboard.dob) : '-';

  const rawRiskLevel = (dashboard?.riskLevel || 'UNKNOWN').toUpperCase();
  const riskLevel = rawRiskLevel === 'VERY_HIGH' ? 'HIGH' : rawRiskLevel;
  const fitbitConnected = String(dashboard?.fitbitStatusText || '').toUpperCase() === 'CONNECTED';

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

  const connectFitbit = async () => {
    if (!dashboard?.childId) {
      Alert.alert('No child linked', 'Add a child first to connect Fitbit.');
      return;
    }

    try {
      setFitbitBusy(true);
      const response = await fetch(`${BASE_URL}/api/fitbit/connect/${dashboard.childId}?asJson=true`);
      const text = await response.text();
      if (!response.ok) {
        Alert.alert('Error', text || 'Could not start Fitbit connect.');
        return;
      }

      const data = text ? JSON.parse(text) : null;
      const authUrl = data?.authUrl;
      if (!authUrl) {
        Alert.alert('Error', 'Fitbit auth link was not returned.');
        return;
      }

      const canOpen = await Linking.canOpenURL(authUrl);
      if (!canOpen) {
        Alert.alert('Error', 'Could not open Fitbit authorization page.');
        return;
      }

      await Linking.openURL(authUrl);
      Alert.alert('Continue in browser', 'After allowing Fitbit access, return here and tap Sync Fitbit.');
    } catch (err) {
      Alert.alert('Error', 'Could not start Fitbit connect.');
    } finally {
      setFitbitBusy(false);
    }
  };

  const disconnectFitbit = async () => {
    if (!dashboard?.childId) {
      Alert.alert('No child linked', 'Add a child first.');
      return;
    }

    try {
      setFitbitBusy(true);
      const response = await fetch(`${BASE_URL}/api/fitbit/disconnect/${dashboard.childId}`, {
        method: 'POST',
      });
      const text = await response.text();
      if (!response.ok) {
        Alert.alert('Error', text || 'Could not disconnect Fitbit.');
        return;
      }

      await refreshRisk(true);
      Alert.alert('Done', 'Fitbit disconnected.');
    } catch (err) {
      Alert.alert('Error', 'Could not disconnect Fitbit.');
    } finally {
      setFitbitBusy(false);
    }
  };

  const insightTabs = [
    { key: 'sleep', label: 'Sleep', icon: 'weather-night' },
    { key: 'medication', label: 'Meds', icon: 'pill' },
    { key: 'bodySignals', label: 'Body', icon: 'heart-pulse' },
    { key: 'seizurePatterns', label: 'Patterns', icon: 'chart-timeline-variant' },
  ];
  const selectedCategory = categories?.[selectedInsightTab] || { status: 'good', messages: ['Not enough data yet to show smart insights.'] };
  const selectedMessages = Array.isArray(selectedCategory.messages) && selectedCategory.messages.length
    ? selectedCategory.messages
    : ['Not enough data yet to show smart insights.'];
  const getCategoryTone = (status) => {
    if (status === 'alert') {
      return { color: '#c62828', bg: '#fdeaea', label: 'High concern', showBadge: true };
    }
    if (status === 'watch') {
      return { color: '#f9a825', bg: '#fff6dd', label: 'Watch', showBadge: true };
    }
    return { color: '#2e7d32', bg: '#ebf7ee', label: 'Stable', showBadge: false };
  };
  const selectedTone = getCategoryTone(selectedCategory.status);
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
  const timingLabels = Array.isArray(charts?.timingSplit?.labels) ? charts.timingSplit.labels : [];
  const timingValues = Array.isArray(charts?.timingSplit?.values) ? charts.timingSplit.values.map((v) => Number(v || 0)) : [];
  const timingTotal = timingValues.reduce((sum, value) => sum + value, 0);
  const timingMax = timingValues.length ? Math.max(...timingValues) : 0;
  const topTimes = timingLabels.filter((_, idx) => timingValues[idx] === timingMax && timingMax > 0);
  const timingSummary = timingTotal === 0
    ? 'Not enough seizure timing data yet.'
    : topTimes.length > 1
      ? `Most logged seizures happened in: ${topTimes.join(', ')}.`
      : `Most logged seizures happened in the ${String(topTimes[0] || '').toLowerCase()} time window.`;
  const sleepPatternLabels = Array.isArray(charts?.sleepSeizureSeries?.labels) ? charts.sleepSeizureSeries.labels : [];
  const sleepPatternValues = Array.isArray(charts?.sleepSeizureSeries?.sleepValues)
    ? charts.sleepSeizureSeries.sleepValues.map((v) => Number(v || 0))
    : [];
  const sleepPatternSeizures = Array.isArray(charts?.sleepSeizureSeries?.seizureCounts)
    ? charts.sleepSeizureSeries.seizureCounts.map((v) => Number(v || 0))
    : [];
  const sleepPatternDays = sleepPatternLabels.filter((_, idx) => sleepPatternSeizures[idx] > 0 && sleepPatternValues[idx] > 0);
  const lowSleepSeizureDays = sleepPatternLabels.filter((_, idx) => sleepPatternSeizures[idx] > 0 && sleepPatternValues[idx] > 0 && sleepPatternValues[idx] < 6);
  const sleepPatternSummary = sleepPatternDays.length === 0
    ? 'No recent seizure days line up with the sleep trend yet.'
    : lowSleepSeizureDays.length > 0
      ? `Seizures this week lined up with lower-sleep days, especially ${lowSleepSeizureDays.join(', ')}.`
      : `Dots mark seizure days against the sleep trend this week.`;
  const heatmapDays = Array.isArray(charts?.medicationHeatmap?.days) ? charts.medicationHeatmap.days : [];
  const heatmapSummary = charts?.medicationHeatmap?.summary || 'Not enough medication data yet.';
  const getHeatmapTone = (status) => {
    if (status === 'taken') {
      return { bg: '#87c38f', text: '#ffffff', border: '#6aa572' };
    }
    if (status === 'late') {
      return { bg: '#f7c768', text: '#6b4d00', border: '#e2af46' };
    }
    if (status === 'empty') {
      return { bg: '#f3ebe5', text: '#9b8e86', border: '#ead9df' };
    }
    if (status === 'missed' || status === 'none') {
      return { bg: '#e997aa', text: '#ffffff', border: '#d97b93' };
    }
    return { bg: '#f3ebe5', text: '#9b8e86', border: '#ead9df' };
  };
  const chartTabs = [
    { key: 'trend', label: 'Seizure Trend' },
    { key: 'heatmap', label: 'Medication Heatmap' },
  ];
  const secondaryChartTabs = [
    { key: 'timing', label: 'Timing Pattern' },
    { key: 'sleepSeizure', label: 'Sleep + Seizures' },
  ];
  const dailyDetails = Array.isArray(charts?.dailyDetails) ? charts.dailyDetails : [];
  const openTrendTooltip = (index) => {
    if (index == null || index < 0 || index >= dailyDetails.length) return;
    setSelectedTrendIndex((current) => (current === index ? null : index));
  };
  const formatDetailDate = (dateString, fallbackLabel) => {
    if (!dateString) return fallbackLabel || '--';
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return fallbackLabel || dateString;
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };
  const formatDetailValue = (value, suffix = '') => {
    if (value == null || value === '') return '--';
    return `${value}${suffix}`;
  };
  const selectedTrendDetail = selectedTrendIndex == null ? null : dailyDetails[selectedTrendIndex] || null;
  const selectedTrendLeft = selectedTrendIndex == null ? '50%' : `${((selectedTrendIndex + 0.5) / Math.max(trendLabels.length, 1)) * 100}%`;
  const buildTrendDetailPoints = (detail) => {
    if (!detail) return [];
    const points = [];

    if (detail.sleepHours != null) {
      points.push(`Sleep: ${detail.sleepHours} hrs`);
      if (Number(detail.sleepHours) < 6) {
        points.push('Low sleep day');
      }
    }

    if (detail.medicationStatusText && detail.medicationStatus !== 'none') {
      points.push(`Medication: ${detail.medicationStatusText}`);
    }

    if (detail.heartRate != null) {
      points.push(`Heart rate: ${detail.heartRate} bpm`);
    }

    if (detail.hrv != null) {
      points.push(`HRV: ${detail.hrv}`);
    }

    if (Array.isArray(detail.triggers) && detail.triggers.length) {
      points.push(`Potential Triggers: ${detail.triggers.join(', ')}`);
    }

    if (Array.isArray(detail.seizureTimes) && detail.seizureTimes.length) {
      points.push(`Seizure time: ${detail.seizureTimes.join(', ')}`);
    }

    if (detail.hoursSinceLastMeal != null) {
      points.push(`Hours since last meal: ${detail.hoursSinceLastMeal}`);
    }

    if (!points.length) {
      points.push('No extra day details yet.');
    }

    return points;
  };
  const openTimingDetail = (index) => {
    if (index == null || index < 0 || index >= timingLabels.length) return;
    const count = timingValues[index] || 0;
    const percent = timingTotal > 0 ? Math.round((count / timingTotal) * 100) : 0;
    const label = timingLabels[index];
    const isTop = topTimes.includes(label) && timingMax > 0;
    const nextDetail = {
      label,
      count,
      percent,
      summary: isTop
        ? `${label} is the most common time window for logged seizures.`
        : `${count} seizures were logged in the ${String(label || '').toLowerCase()} time window.`,
    };
    setSelectedTimingDetail((current) => (current?.label === nextDetail.label ? null : nextDetail));
  };
  const openSleepTooltip = (index) => {
    if (index == null || index < 0 || index >= dailyDetails.length) return;
    setSelectedSleepIndex((current) => (current === index ? null : index));
  };
  const selectedSleepDetail = selectedSleepIndex == null ? null : dailyDetails[selectedSleepIndex] || null;
  const selectedSleepLeft = selectedSleepIndex == null ? '50%' : `${((selectedSleepIndex + 0.5) / Math.max(sleepPatternLabels.length, 1)) * 100}%`;
  const buildSleepDetailPoints = (detail) => {
    if (!detail) return [];
    const points = [];
    if (detail.sleepHours != null) {
      points.push(`Sleep: ${detail.sleepHours} hrs`);
    }
    if (Array.isArray(detail.seizureTimes) && detail.seizureTimes.length) {
      points.push(`Seizure time: ${detail.seizureTimes.join(', ')}`);
    } else if (detail.seizureCount != null) {
      points.push(`Seizures: ${detail.seizureCount}`);
    }
    if (detail.medicationStatusText && detail.medicationStatus !== 'none') {
      points.push(`Medication: ${detail.medicationStatusText}`);
    }
    if (detail.heartRate != null) {
      points.push(`Heart rate: ${detail.heartRate} bpm`);
    }
    if (detail.hrv != null) {
      points.push(`HRV: ${detail.hrv}`);
    }
    if (Array.isArray(detail.triggers) && detail.triggers.length) {
      points.push(`Potential Triggers: ${detail.triggers.join(', ')}`);
    }
    if (!points.length) {
      points.push('No extra day details yet.');
    }
    return points;
  };

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
          ) : noChildLinked ? (
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
          ) : hasChild ? (
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
                    <MedicationSubtext>
                      Scheduled: {dashboard.scheduledMedicationTime || '--'}
                    </MedicationSubtext>
                  </MedicationStatusButton>
                </SummaryItem>
              </SummaryRow>

              <DeviceRow>
                <DeviceDot />
                <DeviceText>
                  Fitbit status: {dashboard.fitbitStatusText || 'Not connected'}
                </DeviceText>
              </DeviceRow>

              <FitbitActionsRow>
                {fitbitConnected ? (
                  <FitbitButton disabled={fitbitBusy} onPress={disconnectFitbit}>
                    <FitbitButtonText>{fitbitBusy ? 'Working...' : 'Disconnect Fitbit'}</FitbitButtonText>
                  </FitbitButton>
                ) : (
                  <FitbitButton disabled={fitbitBusy} onPress={connectFitbit}>
                    <FitbitButtonText>{fitbitBusy ? 'Working...' : 'Connect Fitbit'}</FitbitButtonText>
                  </FitbitButton>
                )}

                <FitbitButton disabled={refreshingRisk} onPress={() => refreshRisk(false)}>
                  <FitbitButtonText>{refreshingRisk ? 'Syncing...' : 'Sync Fitbit'}</FitbitButtonText>
                </FitbitButton>
              </FitbitActionsRow>

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
          ) : (
            <LoadingWrapper>
              <ActivityIndicator />
            </LoadingWrapper>
          )}
        </ChildCard>

        <InsightsSection>
          <InsightsHeader>Smart Insights</InsightsHeader>
          <InsightCard full>
            <TabRow>
              {insightTabs.map((tab) => {
                const tabCategory = categories?.[tab.key] || { status: 'good' };
                const tabTone = getCategoryTone(tabCategory.status);
                const active = selectedInsightTab === tab.key;

                return (
                  <InsightTab
                    key={tab.key}
                    active={active}
                    onPress={() => setSelectedInsightTab(tab.key)}
                  >
                    <TabIconWrap>
                      <TabIcon name={tab.icon} active={active} />
                      {tabTone.showBadge ? <TabBadge style={{ backgroundColor: tabTone.color }}><TabBadgeText>!</TabBadgeText></TabBadge> : null}
                    </TabIconWrap>
                    <TabLabel active={active}>{tab.label}</TabLabel>
                  </InsightTab>
                );
              })}
            </TabRow>

            <CategoryStatusBar style={{ backgroundColor: selectedTone.bg, borderColor: selectedTone.color }}>
              <StatusDot style={{ backgroundColor: selectedTone.color }} />
              <CategoryStatusText style={{ color: selectedTone.color }}>{selectedTone.label}</CategoryStatusText>
            </CategoryStatusBar>

            {selectedMessages.map((item, idx) => (
              <WarningRow key={`category-${idx}`}>
                <WarningDot />
                <InsightText style={{ flex: 1, marginTop: 0 }}>{item}</InsightText>
              </WarningRow>
            ))}
          </InsightCard>

          <InsightsHeader>Epilepsy Insights</InsightsHeader>
          <InsightCard full>
            <InsightTopRow>
              <InsightIcon name={selectedChartTab === 'trend' ? 'chart-line' : 'calendar-month-outline'} />
              <InsightTitle>{selectedChartTab === 'trend' ? 'Trend Pattern' : 'Medication Heatmap'}</InsightTitle>
            </InsightTopRow>
            <ChartTabRow>
              {chartTabs.map((tab) => (
                <ChartTabButton
                  key={tab.key}
                  active={selectedChartTab === tab.key}
                  onPress={() => setSelectedChartTab(tab.key)}
                >
                  <ChartTabText active={selectedChartTab === tab.key}>{tab.label}</ChartTabText>
                </ChartTabButton>
              ))}
            </ChartTabRow>

            {selectedChartTab === 'trend' ? (
              <>
                <TrendChartWrap>
                  <InsightTrendLine data={charts.trendSeries} onSelectDay={openTrendTooltip} />
                  {selectedTrendDetail ? (
                    <TrendTooltip style={{ left: selectedTrendLeft }} onPress={() => setSelectedTrendIndex(null)}>
                      <TrendTooltipCard>
                        <TrendTooltipTitle>
                          {formatDetailDate(selectedTrendDetail.date, selectedTrendDetail.label)}
                        </TrendTooltipTitle>
                        {buildTrendDetailPoints(selectedTrendDetail).map((item, idx) => (
                          <TrendTooltipRow key={`trend-detail-${idx}`}>
                            <TrendTooltipDot />
                            <TrendTooltipText>{item}</TrendTooltipText>
                          </TrendTooltipRow>
                        ))}
                      </TrendTooltipCard>
                    </TrendTooltip>
                  ) : null}
                  <TrendTouchRow>
                    {trendLabels.map((label, index) => (
                      <TrendTouchZone
                        key={`${label}-${index}`}
                        onPress={() => openTrendTooltip(index)}
                      />
                    ))}
                  </TrendTouchRow>
                </TrendChartWrap>
                <InsightText>{trendSummary}</InsightText>
              </>
            ) : (
              <>
                <HeatmapGrid>
                  {heatmapDays.map((item) => {
                    const tone = getHeatmapTone(item.status);
                    return (
                      <HeatmapCellWrap key={item.date}>
                        <HeatmapCell style={{ backgroundColor: tone.bg, borderColor: tone.border }}>
                          <HeatmapCellText style={{ color: tone.text }}>{item.day}</HeatmapCellText>
                        </HeatmapCell>
                        <HeatmapDayLabel>{item.label}</HeatmapDayLabel>
                      </HeatmapCellWrap>
                    );
                  })}
                </HeatmapGrid>
                <HeatmapLegendRow>
                  <LegendItem>
                    <LegendSwatch style={{ backgroundColor: '#87c38f' }} />
                    <LegendText>Taken</LegendText>
                  </LegendItem>
                  <LegendItem>
                    <LegendSwatch style={{ backgroundColor: '#f7c768' }} />
                    <LegendText>Late</LegendText>
                  </LegendItem>
                  <LegendItem>
                    <LegendSwatch style={{ backgroundColor: '#e997aa' }} />
                    <LegendText>Missed</LegendText>
                  </LegendItem>
                </HeatmapLegendRow>
                <InsightText>{heatmapSummary}</InsightText>
              </>
            )}
          </InsightCard>

          <InsightCard full>
            <InsightTopRow>
              <InsightIcon name={selectedSecondaryChartTab === 'timing' ? 'clock-outline' : 'sleep'} />
              <InsightTitle>{selectedSecondaryChartTab === 'timing' ? 'Timing Pattern' : 'Sleep + Seizures'}</InsightTitle>
            </InsightTopRow>
            <ChartTabRow>
              {secondaryChartTabs.map((tab, idx) => (
                <ChartTabButton
                  key={tab.key}
                  active={selectedSecondaryChartTab === tab.key}
                  isLast={idx === secondaryChartTabs.length - 1}
                  onPress={() => setSelectedSecondaryChartTab(tab.key)}
                >
                  <ChartTabText active={selectedSecondaryChartTab === tab.key}>{tab.label}</ChartTabText>
                </ChartTabButton>
              ))}
            </ChartTabRow>

            {selectedSecondaryChartTab === 'timing' ? (
              <>
                  <ChartTooltipWrap>
                    <InsightTimingPie data={charts.timingSplit} onSelectSlice={openTimingDetail} />
                    {selectedTimingDetail ? (
                      <TimingTooltip onPress={() => setSelectedTimingDetail(null)}>
                        <InlineTooltipCard>
                          <InlineTooltipTitle>{selectedTimingDetail.label}</InlineTooltipTitle>
                          <InlineTooltipRow>
                            <InlineTooltipDot />
                            <InlineTooltipText>{`${selectedTimingDetail.count} seizures`}</InlineTooltipText>
                        </InlineTooltipRow>
                        <InlineTooltipRow>
                          <InlineTooltipDot />
                          <InlineTooltipText>{`${selectedTimingDetail.percent}% share`}</InlineTooltipText>
                        </InlineTooltipRow>
                          <InlineTooltipRow>
                            <InlineTooltipDot />
                            <InlineTooltipText>{selectedTimingDetail.summary}</InlineTooltipText>
                          </InlineTooltipRow>
                        </InlineTooltipCard>
                      </TimingTooltip>
                    ) : null}
                  </ChartTooltipWrap>
                <InsightText>{timingSummary}</InsightText>
              </>
            ) : (
              <>
                <ChartTooltipWrap>
                  <InsightSleepSeizureLine data={charts.sleepSeizureSeries} onSelectDay={openSleepTooltip} />
                  {selectedSleepDetail ? (
                    <InlineTooltip style={{ left: selectedSleepLeft }} onPress={() => setSelectedSleepIndex(null)}>
                      <InlineTooltipCard>
                        <InlineTooltipTitle>
                          {formatDetailDate(selectedSleepDetail.date, selectedSleepDetail.label)}
                        </InlineTooltipTitle>
                        {buildSleepDetailPoints(selectedSleepDetail).map((item, idx) => (
                          <InlineTooltipRow key={`sleep-detail-${idx}`}>
                            <InlineTooltipDot />
                            <InlineTooltipText>{item}</InlineTooltipText>
                          </InlineTooltipRow>
                        ))}
                      </InlineTooltipCard>
                    </InlineTooltip>
                  ) : null}
                </ChartTooltipWrap>
                <InsightText>{sleepPatternSummary}</InsightText>
              </>
            )}
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

const MedicationSubtext = styled.Text`
  margin-top: 4px;
  font-size: 11px;
  color: #8b7e76;
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

const FitbitActionsRow = styled.View`
  margin-top: 10px;
  flex-direction: row;
  justify-content: space-between;
`;

const FitbitButton = styled.TouchableOpacity`
  width: 48%;
  background-color: #f5efe6;
  border-radius: 10px;
  border-width: 1px;
  border-color: #d4c6bd;
  padding: 8px 10px;
  align-items: center;
`;

const FitbitButtonText = styled.Text`
  font-size: 12px;
  font-weight: 700;
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

const ChartTabRow = styled.View`
  flex-direction: row;
  margin-top: 12px;
  margin-bottom: 8px;
`;

const ChartTabButton = styled.TouchableOpacity`
  flex: 1;
  padding: 10px 8px;
  border-radius: 12px;
  border-width: 1px;
  border-color: ${(p) => (p.active ? '#b03060' : '#ead9df')};
  background-color: ${(p) => (p.active ? '#f8e7ee' : '#f7f0ea')};
  margin-right: ${(p) => (p.isLast ? '0px' : '8px')};
`;

const ChartTabText = styled.Text`
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  color: ${(p) => (p.active ? '#b03060' : '#6b5e58')};
`;

const HeatmapGrid = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-between;
  margin-top: 4px;
`;

const HeatmapCellWrap = styled.View`
  width: 18%;
  align-items: center;
  margin-bottom: 12px;
`;

const HeatmapCell = styled.View`
  width: 38px;
  height: 38px;
  border-radius: 12px;
  border-width: 1px;
  align-items: center;
  justify-content: center;
`;

const HeatmapCellText = styled.Text`
  font-size: 13px;
  font-weight: 700;
`;

const HeatmapDayLabel = styled.Text`
  margin-top: 4px;
  font-size: 10px;
  color: #8b7e76;
`;

const HeatmapLegendRow = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  margin-top: 4px;
`;

const TrendChartWrap = styled.View`
  position: relative;
`;

const TrendTouchRow = styled.View`
  position: absolute;
  left: 26px;
  right: 12px;
  top: 8px;
  bottom: 34px;
  flex-direction: row;
`;

const TrendTouchZone = styled.TouchableOpacity`
  flex: 1;
`;

const TrendTooltip = styled.TouchableOpacity`
  position: absolute;
  top: 8px;
  margin-left: -72px;
  z-index: 5;
`;

const TrendTooltipCard = styled.View`
  width: 144px;
  background-color: #fff7fb;
  border-width: 1px;
  border-color: #e7c7d3;
  border-radius: 14px;
  padding: 10px 12px;
  shadow-color: #000;
  shadow-opacity: 0.08;
  shadow-radius: 8px;
  elevation: 3;
`;

const TrendTooltipTitle = styled.Text`
  font-size: 12px;
  font-weight: 800;
  color: #b03060;
  margin-bottom: 4px;
`;

const TrendTooltipText = styled.Text`
  font-size: 11px;
  line-height: 16px;
  color: #5f544f;
`;

const TrendTooltipRow = styled.View`
  flex-direction: row;
  align-items: flex-start;
  margin-top: 4px;
`;

const TrendTooltipDot = styled.View`
  width: 6px;
  height: 6px;
  border-radius: 3px;
  background-color: #b03060;
  margin-right: 6px;
  margin-top: 5px;
`;

const ChartTooltipWrap = styled.View`
  position: relative;
`;

const InlineTooltip = styled.TouchableOpacity`
  position: absolute;
  top: 8px;
  margin-left: -72px;
  z-index: 5;
`;

const TimingTooltip = styled.TouchableOpacity`
  position: absolute;
  top: 10px;
  right: 8px;
  z-index: 5;
`;

const InlineTooltipCard = styled.View`
  width: 144px;
  background-color: #fff7fb;
  border-width: 1px;
  border-color: #e7c7d3;
  border-radius: 14px;
  padding: 10px 12px;
  shadow-color: #000;
  shadow-opacity: 0.08;
  shadow-radius: 8px;
  elevation: 3;
`;

const InlineTooltipTitle = styled.Text`
  font-size: 12px;
  font-weight: 800;
  color: #b03060;
  margin-bottom: 4px;
`;

const InlineTooltipRow = styled.View`
  flex-direction: row;
  align-items: flex-start;
  margin-top: 4px;
`;

const InlineTooltipDot = styled.View`
  width: 6px;
  height: 6px;
  border-radius: 3px;
  background-color: #b03060;
  margin-right: 6px;
  margin-top: 5px;
`;

const InlineTooltipText = styled.Text`
  font-size: 11px;
  line-height: 16px;
  color: #5f544f;
  flex: 1;
`;

const LegendItem = styled.View`
  flex-direction: row;
  align-items: center;
  margin-right: 14px;
  margin-bottom: 4px;
`;

const LegendSwatch = styled.View`
  width: 10px;
  height: 10px;
  border-radius: 3px;
  margin-right: 6px;
`;

const LegendText = styled.Text`
  font-size: 11px;
  color: #6b5e58;
`;

const WarningRow = styled.View`
  flex-direction: row;
  align-items: flex-start;
  margin-top: 10px;
`;

const WarningDot = styled.View`
  width: 7px;
  height: 7px;
  border-radius: 3.5px;
  background-color: #b03060;
  margin-right: 8px;
  margin-top: 5px;
`;

const TabRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: 14px;
`;

const InsightTab = styled.TouchableOpacity`
  width: 23%;
  align-items: center;
  padding: 10px 6px;
  border-radius: 14px;
  background-color: ${(p) => (p.active ? '#f8e7ee' : '#f7f0ea')};
  border-width: 1px;
  border-color: ${(p) => (p.active ? '#b03060' : '#ead9df')};
`;

const TabIconWrap = styled.View`
  position: relative;
`;

const TabIcon = styled(Icon)`
  font-size: 22px;
  color: ${(p) => (p.active ? '#b03060' : '#8b7e76')};
`;

const TabBadge = styled.View`
  position: absolute;
  top: -5px;
  right: -9px;
  min-width: 15px;
  height: 15px;
  border-radius: 7.5px;
  align-items: center;
  justify-content: center;
  padding-horizontal: 3px;
`;

const TabBadgeText = styled.Text`
  color: #ffffff;
  font-size: 10px;
  font-weight: 800;
`;

const TabLabel = styled.Text`
  margin-top: 6px;
  font-size: 11px;
  font-weight: 700;
  color: ${(p) => (p.active ? '#b03060' : '#6b5e58')};
`;

const CategoryStatusBar = styled.View`
  flex-direction: row;
  align-items: center;
  border-width: 1px;
  border-radius: 12px;
  padding: 10px 12px;
  margin-bottom: 6px;
`;

const StatusDot = styled.View`
  width: 9px;
  height: 9px;
  border-radius: 4.5px;
  margin-right: 8px;
`;

const CategoryStatusText = styled.Text`
  font-size: 12px;
  font-weight: 700;
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
