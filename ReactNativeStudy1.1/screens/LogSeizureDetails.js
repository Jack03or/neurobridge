import React, { useState } from 'react';
import { ScrollView, Switch } from 'react-native';
import styled from 'styled-components/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function LogSeizureDetails({ route, navigation }) {
  const { userId, symptoms, symptomsNone, awareness } = route.params;

  // timestamp defaults to now; we’ll send ISO to backend
  const [timestampIso, setTimestampIso] = useState(new Date().toISOString());

  const [mins, setMins] = useState('0');
  const [secs, setSecs] = useState('0');

  const [patientState, setPatientState] = useState('AWAKE'); // AWAKE / TIRED / ASLEEP
  const [medsTaken, setMedsTaken] = useState(false);
  const [interventionNeeded, setInterventionNeeded] = useState(false);
  const [tongueBite, setTongueBite] = useState(false);
  const [activityState, setActivityState] = useState('RESTING'); // ACTIVE / RESTING
  const [incontinence, setIncontinence] = useState(false);

  const [notes, setNotes] = useState('');

  const durationSeconds = Math.max(0, parseInt(mins || '0', 10) * 60 + parseInt(secs || '0', 10));

  return (
    <Container>
      <TopBar>
        <BackBtn onPress={() => navigation.goBack()}>
          <TopIcon name="chevron-left" />
        </BackBtn>
        <TopTitle>Details</TopTitle>
        <TopSpacer />
      </TopBar>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 30 }}>
        <Card>
          <CardTitle>Timestamp</CardTitle>
          <SmallText>
            For now we log “now”. Later we can swap this for an iOS date/time picker like your DOB.
          </SmallText>
          <Input value={timestampIso} onChangeText={setTimestampIso} />
        </Card>

        <Card>
          <CardTitle>Duration</CardTitle>
          <Row>
            <Half>
              <Label>Minutes</Label>
              <Input keyboardType="number-pad" value={mins} onChangeText={setMins} />
            </Half>
            <Half>
              <Label>Seconds</Label>
              <Input keyboardType="number-pad" value={secs} onChangeText={setSecs} />
            </Half>
          </Row>
          <SmallText>Total: {durationSeconds} seconds</SmallText>
        </Card>

        <Card>
          <CardTitle>Patient state</CardTitle>
          <PillRow>
            {['AWAKE', 'DROWSY', 'ASLEEP'].map((s) => (
              <Pill key={s} active={patientState === s} onPress={() => setPatientState(s)}>
                <PillText active={patientState === s}>{s}</PillText>
              </Pill>
            ))}
          </PillRow>
        </Card>

        <Card>
          <CardTitle>Other details</CardTitle>

          <ToggleRow>
            <ToggleText>Meds taken</ToggleText>
            <Switch value={medsTaken} onValueChange={setMedsTaken} />
          </ToggleRow>

          <ToggleRow>
            <ToggleText>Intervention needed</ToggleText>
            <Switch value={interventionNeeded} onValueChange={setInterventionNeeded} />
          </ToggleRow>

          <ToggleRow>
            <ToggleText>Tongue bite</ToggleText>
            <Switch value={tongueBite} onValueChange={setTongueBite} />
          </ToggleRow>

          <ToggleRow>
            <ToggleText>Incontinence</ToggleText>
            <Switch value={incontinence} onValueChange={setIncontinence} />
          </ToggleRow>

          <Label style={{ marginTop: 12 }}>Activity</Label>
          <PillRow>
            {['RESTING', 'ACTIVE'].map((a) => (
              <Pill key={a} active={activityState === a} onPress={() => setActivityState(a)}>
                <PillText active={activityState === a}>{a}</PillText>
              </Pill>
            ))}
          </PillRow>
        </Card>

        <Card>
          <CardTitle>Extra notes</CardTitle>
          <TextArea
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything else you want to record..."
            placeholderTextColor="#8b7e76"
            multiline
          />
        </Card>

        <ContinueBtn
          onPress={() =>
            navigation.navigate('SeizureSummary', {
              userId,
              symptoms,
              symptomsNone,
              awareness,
              timestampIso,
              durationSeconds,
              patientState,
              medsTaken,
              interventionNeeded,
              tongueBite,
              activityState,
              incontinence,
              notes,
            })
          }
        >
          <ContinueText>Continue</ContinueText>
        </ContinueBtn>
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

const SmallText = styled.Text`
  margin-top: 6px;
  font-size: 12px;
  color: #6b5e58;
`;

const Label = styled.Text`
  margin-top: 8px;
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
`;

const Row = styled.View`
  flex-direction: row;
  justify-content: space-between;
  margin-top: 10px;
`;

const Half = styled.View`width: 48%;`;

const PillRow = styled.View`
  flex-direction: row;
  margin-top: 10px;
`;

const Pill = styled.TouchableOpacity`
  padding: 10px 12px;
  border-radius: 14px;
  background-color: ${(p) => (p.active ? '#e7c7d3' : '#f5efe6')};
  border: 2px solid ${(p) => (p.active ? '#b03060' : 'transparent')};
  margin-right: 10px;
`;

const PillText = styled.Text`
  font-weight: 900;
  color: ${(p) => (p.active ? '#b03060' : '#2f2f2f')};
`;

const ToggleRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
`;

const ToggleText = styled.Text`
  font-size: 13px;
  font-weight: 700;
  color: #2f2f2f;
`;

const TextArea = styled.TextInput`
  margin-top: 10px;
  background-color: #f5efe6;
  border-radius: 14px;
  padding: 12px;
  font-size: 14px;
  color: #2f2f2f;
  min-height: 100px;
`;

const ContinueBtn = styled.TouchableOpacity`
  margin-top: 6px;
  background-color: #b03060;
  padding: 14px;
  border-radius: 18px;
  align-items: center;
`;

const ContinueText = styled.Text`
  color: #ffffff;
  font-weight: 900;
`;
