// screens/SeizureEventView.js
import React from 'react';
import { ScrollView } from 'react-native';
import styled from 'styled-components/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function SeizureEventView({ route, navigation }) {
  const { seizure } = route.params;

  return (
    <Container>
      <TopBar>
        <BackBtn onPress={() => navigation.goBack()}>
          <TopIcon name="chevron-left" />
        </BackBtn>
        <TopTitle>Seizure</TopTitle>
        <TopSpacer />
      </TopBar>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 30 }}>
        <Card>
          <CardTitle>What happened</CardTitle>
          <Line>
            <Label>Symptoms</Label>
            <Value>{seizure?.type || '--'}</Value>
          </Line>
          <Line>
            <Label>Awareness</Label>
            <Value>{seizure?.awareness || '--'}</Value>
          </Line>
        </Card>

        <Card>
          <CardTitle>Details</CardTitle>
          <Line>
            <Label>Timestamp</Label>
            <Value>{seizure?.timestamp || '--'}</Value>
          </Line>
          <Line>
            <Label>Duration</Label>
            <Value>
              {seizure?.durationSeconds != null ? `${seizure.durationSeconds} seconds` : '--'}
            </Value>
          </Line>
          <Line>
            <Label>Patient state</Label>
            <Value>{seizure?.patientState || '--'}</Value>
          </Line>
        </Card>

        <Card>
          <CardTitle>Other</CardTitle>
          <Line><Label>Meds taken</Label><Value>{boolText(seizure?.medsTaken)}</Value></Line>
          <Line><Label>Intervention</Label><Value>{boolText(seizure?.interventionNeeded)}</Value></Line>
          <Line><Label>Tongue bite</Label><Value>{boolText(seizure?.tongueBite)}</Value></Line>
          <Line><Label>Activity</Label><Value>{seizure?.activityState || '--'}</Value></Line>
          <Line><Label>Incontinence</Label><Value>{boolText(seizure?.incontinence)}</Value></Line>
        </Card>

        <Card>
          <CardTitle>Potential Triggers</CardTitle>
          <Line><Label>Selected triggers</Label><Value>{seizure?.seizureTrigger?.trim() ? seizure.seizureTrigger : '--'}</Value></Line>
          <Line>
            <Label>Hours since last meal</Label>
            <Value>
              {seizure?.hoursSinceLastMeal != null ? `${seizure.hoursSinceLastMeal} hours` : '--'}
            </Value>
          </Line>
        </Card>

        <Card>
          <CardTitle>Notes</CardTitle>
          <Value>{seizure?.notes?.trim() ? seizure.notes : '--'}</Value>
        </Card>
      </ScrollView>
    </Container>
  );
}

function boolText(v) {
  if (v === true) return 'Yes';
  if (v === false) return 'No';
  return '--';
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

const Line = styled.View`
  margin-top: 10px;
`;

const Label = styled.Text`
  font-size: 11px;
  color: #8b7e76;
  font-weight: 800;
`;

const Value = styled.Text`
  margin-top: 2px;
  font-size: 14px;
  color: #2f2f2f;
  font-weight: 700;
`;
