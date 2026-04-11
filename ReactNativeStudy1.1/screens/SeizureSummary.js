import React, { useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import styled from 'styled-components/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { BASE_URL } from '../config';

export default function SeizureSummary({ route, navigation }) {
  const payload = route.params;
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        timestamp: new Date(payload.timestampIso).toISOString().replace('Z', ''), // LocalDateTime friendly-ish
        symptoms: payload.symptoms,
        symptomsNone: payload.symptomsNone,
        awareness: payload.awareness,
        durationSeconds: payload.durationSeconds,
        patientState: payload.patientState,
        medsTaken: payload.medsTaken,
        interventionNeeded: payload.interventionNeeded,
        tongueBite: payload.tongueBite,
        activityState: payload.activityState,
        incontinence: payload.incontinence,
        potentialTriggers: payload.potentialTriggers,
        hoursSinceLastMeal: payload.hoursSinceLastMeal,
        notes: payload.notes,
      };

      const res = await fetch(`${BASE_URL}/api/seizures/by-user/${payload.userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      if (!res.ok) {
        Alert.alert('Error', text || 'Could not save seizure log.');
        return;
      }

      await fetch(`${BASE_URL}/api/dashboard/refresh-insights/by-user/${payload.userId}`, {
        method: 'POST',
      });

      Alert.alert('Saved', 'Seizure entry added.');
      navigation.navigate('MainTabs', {
        userId: payload.userId,
        screen: 'Dashboard',
      });
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to save seizure log.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container>
      <TopBar>
        <BackBtn onPress={() => navigation.goBack()}>
          <TopIcon name="chevron-left" />
        </BackBtn>
        <TopTitle>Summary</TopTitle>
        <TopSpacer />
      </TopBar>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 30 }}>
        <Card>
          <CardTitle>What happened</CardTitle>
          <Line>
            <Label>Symptoms</Label>
            <Value>
              {payload.symptomsNone
                ? 'NONE'
                : (payload.symptoms || []).join(', ') || '--'}
            </Value>
          </Line>
          <Line>
            <Label>Awareness</Label>
            <Value>{payload.awareness}</Value>
          </Line>
        </Card>

        <Card>
          <CardTitle>Details</CardTitle>
          <Line>
            <Label>Timestamp</Label>
            <Value>{payload.timestampIso}</Value>
          </Line>
          <Line>
            <Label>Duration</Label>
            <Value>{payload.durationSeconds} seconds</Value>
          </Line>
          <Line>
            <Label>Patient state</Label>
            <Value>{payload.patientState}</Value>
          </Line>
        </Card>

        <Card>
          <CardTitle>Other</CardTitle>
          <Line><Label>Meds taken</Label><Value>{payload.medsTaken ? 'Yes' : 'No'}</Value></Line>
          <Line><Label>Intervention</Label><Value>{payload.interventionNeeded ? 'Yes' : 'No'}</Value></Line>
          <Line><Label>Tongue bite</Label><Value>{payload.tongueBite ? 'Yes' : 'No'}</Value></Line>
          <Line><Label>Activity</Label><Value>{payload.activityState}</Value></Line>
          <Line><Label>Incontinence</Label><Value>{payload.incontinence ? 'Yes' : 'No'}</Value></Line>
        </Card>

        <Card>
          <CardTitle>Potential Triggers</CardTitle>
          <Line>
            <Label>Selected triggers</Label>
            <Value>{Array.isArray(payload.potentialTriggers) && payload.potentialTriggers.length ? payload.potentialTriggers.join(', ') : '--'}</Value>
          </Line>
          <Line>
            <Label>Hours since last meal</Label>
            <Value>{payload.hoursSinceLastMeal != null ? `${payload.hoursSinceLastMeal} hours` : '--'}</Value>
          </Line>
        </Card>

        <Card>
          <CardTitle>Notes</CardTitle>
          <Value>{payload.notes?.trim() ? payload.notes : '--'}</Value>
        </Card>

        <SaveBtn disabled={saving} onPress={save}>
          <SaveText>{saving ? 'Saving...' : 'Save'}</SaveText>
        </SaveBtn>
      </ScrollView>
    </Container>
  );
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
