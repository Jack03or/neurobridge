// screens/LogMedicationEvent.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Switch,
  FlatList,
} from 'react-native';
import styled from 'styled-components/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BASE_URL } from '../config';

export default function LogMedicationEvent({ route, navigation }) {
  const { userId, dateYmd, existing } = route.params;

  const [medicationName, setMedicationName] = useState(
    existing?.medicationName || '',
  );
  const [dose, setDose] = useState(existing?.dose || '');

  const [taken, setTaken] = useState(existing?.taken ?? true);

  // If  users editing an existing log and it has takenAt, keep time enabled by default
  const [useTime, setUseTime] = useState(existing?.takenAt ? true : true);

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

  /* ---------------- RxNorm Picker Modal ---------------- */

  const [showMedPicker, setShowMedPicker] = useState(false);
  const [medQuery, setMedQuery] = useState('');
  const [medResults, setMedResults] = useState([]);
  const [medLoading, setMedLoading] = useState(false);
  const [medHint, setMedHint] = useState('Type at least 2 letters to search.');

  const openMedPicker = () => {
    setMedQuery('');
    setMedResults([]);
    setMedHint('Type at least 2 letters to search.');
    setShowMedPicker(true);
  };

  const closeMedPicker = () => {
    Keyboard.dismiss();
    setShowMedPicker(false);
  };

  const pickMed = (name) => {
    setMedicationName(String(name || '').trim());
    closeMedPicker();
  };

  // RxNorm parsers
  function extractDrugNamesFromDrugsJson(json) {
    const out = [];
    const groups = json?.drugGroup?.conceptGroup || [];
    for (const g of groups) {
      const props = g?.conceptProperties;
      if (Array.isArray(props)) {
        for (const p of props) {
          if (p?.name) out.push(p.name);
        }
      }
    }
    return out;
  }

  function extractSpellSuggestions(json) {
    const list = json?.suggestionGroup?.suggestionList?.suggestion;
    if (Array.isArray(list)) return list;
    if (typeof list === 'string') return [list];
    return [];
  }

  useEffect(() => {
    if (!showMedPicker) return;

    const q = medQuery.trim();
    if (q.length < 2) {
      setMedResults([]);
      setMedHint('Type at least 2 letters to search.');
      return;
    }

    const t = setTimeout(async () => {
      try {
        setMedLoading(true);
        setMedHint('Searching RxNorm…');

       //// We use both endpoints for partial typing and the selected meds are def on RxNorm
        const spellUrl = `https://rxnav.nlm.nih.gov/REST/spellingsuggestions.json?name=${encodeURIComponent(
          q,
        )}`;
        const drugsUrl = `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(
          q,
        )}`;

        const [spellRes, drugsRes] = await Promise.all([
          fetch(spellUrl),
          fetch(drugsUrl),
        ]);

        const spellJson = spellRes.ok ? await spellRes.json() : null;
        const drugsJson = drugsRes.ok ? await drugsRes.json() : null;

        const spell = spellJson ? extractSpellSuggestions(spellJson) : [];
        const drugs = drugsJson ? extractDrugNamesFromDrugsJson(drugsJson) : [];

        const combined = [...spell, ...drugs]
          .map((s) => String(s).trim())
          .filter(Boolean);

        const unique = Array.from(new Set(combined));

        // Sort: startsWith first, alphabetical
        unique.sort((a, b) => {
          const as = a.toLowerCase().startsWith(q.toLowerCase()) ? 0 : 1;
          const bs = b.toLowerCase().startsWith(q.toLowerCase()) ? 0 : 1;
          if (as !== bs) return as - bs;
          return a.localeCompare(b);
        });

        const top = unique.slice(0, 30);
        setMedResults(top);

        if (top.length === 0) {
          setMedHint('No matches found. You can use your typed text instead.');
        } else {
          setMedHint('Tap a medication to select it.');
        }
      } catch (e) {
        setMedResults([]);
        setMedHint('Search failed. You can use your typed text instead.');
      } finally {
        setMedLoading(false);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [medQuery, showMedPicker]);

  /* ---------------- Save ---------------- */

  const save = async () => {
    try {
      const date = toYMD(takenAt);

      const body = {
        id: existing?.id ?? null,
        date,
        taken,
        takenAt: useTime ? takenAt.toISOString().slice(0, 19) : null,
        medicationName: medicationName.trim() ? medicationName.trim() : null,
        dose: dose.trim() ? dose.trim() : null,
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

      Alert.alert(
        'Saved',
        taken ? 'Medication marked as taken.' : 'Medication marked as missed.',
      );
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
          <SmallText>Tap to search RxNorm and pick a medication.</SmallText>

          <Label>Name</Label>
          <TouchableBox onPress={openMedPicker}>
            <BoxText style={{ opacity: medicationName ? 1 : 0.55 }}>
              {medicationName ? medicationName : 'Tap to choose medication'}
            </BoxText>
          </TouchableBox>

          <Label style={{ marginTop: 12 }}>Dose</Label>
          <Input
            value={dose}
            onChangeText={setDose}
            placeholder="enter amount in mg"
            placeholderTextColor="#8b7e76"
          />
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

      {/* ---------- RxNorm Med Picker ---------- */}
      <Modal visible={showMedPicker} animationType="slide" transparent>
        <ModalOverlay onPress={closeMedPicker} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 }}
        >
          <ModalSheet>
            <ModalHeader>
              <ModalTitle>Select medication</ModalTitle>
              <CloseBtn onPress={closeMedPicker}>
                <Icon name="close" size={22} color="#2f2f2f" />
              </CloseBtn>
            </ModalHeader>

            <Input
              value={medQuery}
              onChangeText={setMedQuery}
              placeholder="Please enter your medication name"
              placeholderTextColor="#8b7e76"
              autoFocus
            />

            <ModalHint>
              {medLoading ? 'Searching RxNorm…' : medHint}
            </ModalHint>

            <FlatList
              keyboardShouldPersistTaps="handled"
              data={medResults}
              keyExtractor={(item, idx) => `${item}-${idx}`}
              renderItem={({ item }) => (
                <ResultItem onPress={() => pickMed(item)}>
                  <ResultText numberOfLines={2}>{item}</ResultText>
                </ResultItem>
              )}
              ListFooterComponent={
                <FooterArea>
                  <FooterText>
                    Can’t find it? Use your typed text:
                  </FooterText>
                  <FooterBtn
                    disabled={!medQuery.trim()}
                    onPress={() => pickMed(medQuery.trim())}
                  >
                    <FooterBtnText>
                      Use “{medQuery.trim() || '…'}”
                    </FooterBtnText>
                  </FooterBtn>
                </FooterArea>
              }
            />
          </ModalSheet>
        </KeyboardAvoidingView>
      </Modal>
    </Container>
  );
}

function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* styled (matching your app) */
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

const Input = styled.TextInput`
  margin-top: 8px;
  background-color: #f5efe6;
  border-radius: 14px;
  padding: 12px;
  font-size: 14px;
  color: #2f2f2f;
  font-weight: 700;
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

/* Modal picker */
const ModalOverlay = styled.Pressable`
  flex: 1;
  background-color: rgba(0, 0, 0, 0.35);
`;

const ModalSheet = styled.View`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  top: 70px;
  background-color: #ffffff;
  border-top-left-radius: 22px;
  border-top-right-radius: 22px;
  padding: 16px;
`;

const ModalHeader = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

const ModalTitle = styled.Text`
  font-size: 16px;
  font-weight: 900;
  color: #2f2f2f;
`;

const CloseBtn = styled.TouchableOpacity`
  padding: 8px;
`;

const ModalHint = styled.Text`
  margin-top: 10px;
  font-size: 12px;
  color: #6b5e58;
`;

const ResultItem = styled.TouchableOpacity`
  padding: 12px;
  border-radius: 14px;
  background-color: #f5efe6;
  margin-top: 10px;
`;

const ResultText = styled.Text`
  font-size: 13px;
  font-weight: 800;
  color: #2f2f2f;
`;

const FooterArea = styled.View`
  padding-top: 14px;
  padding-bottom: 20px;
`;

const FooterText = styled.Text`
  font-size: 12px;
  color: #6b5e58;
  font-weight: 700;
`;

const FooterBtn = styled.TouchableOpacity`
  margin-top: 10px;
  background-color: #b03060;
  padding: 14px;
  border-radius: 18px;
  align-items: center;
  opacity: ${(p) => (p.disabled ? 0.6 : 1)};
`;

const FooterBtnText = styled.Text`
  color: #fff;
  font-weight: 900;
`;
