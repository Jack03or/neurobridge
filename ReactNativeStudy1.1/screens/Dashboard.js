// screens/Dashboard.js
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, Alert, ScrollView } from 'react-native';
import styled from 'styled-components/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { BASE_URL } from '../config';

export default function Dashboard({ route, navigation }) {
  const { userId } = route.params;
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
      } catch (err) {
        Alert.alert('Error', 'Could not load dashboard information.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [userId]);

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

  const riskPercent = dashboard?.riskPercent;
  const riskDisplay =
    riskPercent == null ? '--%' : `${riskPercent.toString()}%`;

  return (
    <Container>
      <StatusBar barStyle="light-content" />

      <TopBar>
        {/* put onPress back for settings */}
        <SettingsButton onPress={() => navigation.navigate('Settings')}>
          <TopIcon name="cog-outline" />
        </SettingsButton>

        <TopTitle>Neurobridge</TopTitle>
        <TopSpacer />
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
                </SummaryItem>
              </SummaryRow>

              <DeviceRow>
                <DeviceDot />
                <DeviceText>
                  Fitbit status: {dashboard.fitbitStatusText || 'Not connected'}
                </DeviceText>
              </DeviceRow>

              <StatusRing>
                <StatusInner>
                  <StatusLabel>Today</StatusLabel>
                  <StatusValue>{riskDisplay}</StatusValue>
                  <StatusHint>Seizure risk (coming soon)</StatusHint>
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

        <ActionsContainer>
          <ActionTile
            onPress={() => navigation.navigate('LogSeizureSymptoms', { userId })}
          >
            <ActionIcon name="pulse" />
            <ActionText>Log Seizure</ActionText>
          </ActionTile>

          <ActionTile
            onPress={() => Alert.alert('Generate Report', 'Coming next!')}
          >
            <ActionIcon name="file-chart" />
            <ActionText>Generate Report</ActionText>
          </ActionTile>

          <ActionTile
            onPress={() => Alert.alert('Seizure Diary', 'Coming next!')}
          >
            <ActionIcon name="calendar-text" />
            <ActionText>Seizure Diary</ActionText>
          </ActionTile>

          <ActionTileDisabled>
            <ActionIcon name="lightbulb-on-outline" />
            <ActionText>Coming Soon</ActionText>
          </ActionTileDisabled>
        </ActionsContainer>
      </ScrollView>
    </Container>
  );
}

/* styled components */

const Container = styled.View`
  flex: 1;
  background-color: #f5efe6;
`;

const TopBar = styled.View`
  height: 56px;
  background-color: #b03060;
  margin: 16px 24px 8px;
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

const TopSpacer = styled.View`
  width: 28px;
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
