// screens/AddChild.js
import React, { useState } from 'react';
import { Alert, StatusBar, Platform, Modal, KeyboardAvoidingView, Keyboard, FlatList } from 'react-native';
import styled from 'styled-components/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BASE_URL } from '../config';

export default function AddChild({ route, navigation }) {
  const { userId } = route.params;

  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [disability, setDisability] = useState('');
  const [medication, setMedication] = useState('');
  const [medicationDose, setMedicationDose] = useState('');
  const [medicationTime, setMedicationTime] = useState(new Date());
  const [dob, setDob] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showMedPicker, setShowMedPicker] = useState(false);
  const [medQuery, setMedQuery] = useState('');
  const [medResults, setMedResults] = useState([]);
  const [medLoading, setMedLoading] = useState(false);
  const [medHint, setMedHint] = useState('Type at least 2 letters to search.');

  const formatTime = (d) =>
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  const toLocalTimePayload = (d) => {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}:00`;
  };

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
    setMedication(String(name || '').trim());
    closeMedPicker();
  };

  const extractDrugNamesFromDrugsJson = (json) => {
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
  };

  const extractSpellSuggestions = (json) => {
    const list = json?.suggestionGroup?.suggestionList?.suggestion;
    if (Array.isArray(list)) return list;
    if (typeof list === 'string') return [list];
    return [];
  };

  React.useEffect(() => {
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
        setMedHint('Searching RxNorm...');

        const spellUrl = `https://rxnav.nlm.nih.gov/REST/spellingsuggestions.json?name=${encodeURIComponent(q)}`;
        const drugsUrl = `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(q)}`;

        const [spellRes, drugsRes] = await Promise.all([fetch(spellUrl), fetch(drugsUrl)]);
        const spellJson = spellRes.ok ? await spellRes.json() : null;
        const drugsJson = drugsRes.ok ? await drugsRes.json() : null;

        const spell = spellJson ? extractSpellSuggestions(spellJson) : [];
        const drugs = drugsJson ? extractDrugNamesFromDrugsJson(drugsJson) : [];

        const combined = [...spell, ...drugs]
          .map((s) => String(s).trim())
          .filter(Boolean);

        const unique = Array.from(new Set(combined));
        unique.sort((a, b) => {
          const as = a.toLowerCase().startsWith(q.toLowerCase()) ? 0 : 1;
          const bs = b.toLowerCase().startsWith(q.toLowerCase()) ? 0 : 1;
          if (as !== bs) return as - bs;
          return a.localeCompare(b);
        });

        const top = unique.slice(0, 30);
        setMedResults(top);
        setMedHint(top.length ? 'Tap a medication to select it.' : 'No matches found. You can use your typed text.');
      } catch (e) {
        setMedResults([]);
        setMedHint('Search failed. You can use your typed text.');
      } finally {
        setMedLoading(false);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [medQuery, showMedPicker]);

  const handleAddChild = async () => {
    if (!name || !dob || !gender) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }

    try {
      // Format DOB as dd/MM/yyyy to match backend
      const formattedDob = `${String(dob.getDate()).padStart(2, '0')}/${String(
        dob.getMonth() + 1,
      ).padStart(2, '0')}/${dob.getFullYear()}`;

      console.log('Sending DOB:', formattedDob);

      const response = await fetch(
        `${BASE_URL}/api/child/add?userId=${userId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            dob: formattedDob,
            gender,
            disability,
            medication,
          }),
        },
      );

      const result = await response.text();
      console.log('Add child response:', result);

      if (response.ok) {
        if (medication.trim()) {
          await fetch(`${BASE_URL}/api/medication-schedules/by-user/${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              medicationName: medication.trim(),
              dose: medicationDose.trim(),
              defaultTime: toLocalTimePayload(medicationTime),
            }),
          });
        }

        Alert.alert('Success', 'Child added successfully!');
        // Go to dashboard and show the child card
        navigation.navigate('Dashboard', { userId });
      } else {
        Alert.alert('Error', result);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Network Error', 'Could not connect to the server.');
    }
  };

  return (
    <Container>
      <StatusBar barStyle="dark-content" />
      <TopCircle />
      <BottomCircle />

      <Card>
        <Title>Add Child</Title>

        <Input
          placeholder="Child's Name"
          value={name}
          onChangeText={setName}
          placeholderTextColor="#fff9"
        />

        {/* Date of Birth box */}
        <TouchableDOB onPress={() => setShowPicker(true)}>
          <DOBText>
            {dob ? dob.toDateString() : 'Select Date of Birth'}
          </DOBText>
        </TouchableDOB>

        {showPicker && (
          <DateTimePicker
            value={dob || new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selectedDate) => {
              setShowPicker(false);
              if (selectedDate) {
                setDob(selectedDate);
              }
            }}
            maximumDate={new Date()} // no future dates
          />
        )}

        <Input
          placeholder="Gender (Male / Female / Other)"
          value={gender}
          onChangeText={setGender}
          placeholderTextColor="#fff9"
        />
        <Input
          placeholder="Learning / Intellectual Disabilities"
          value={disability}
          onChangeText={setDisability}
          placeholderTextColor="#fff9"
        />
        <TouchableDOB onPress={openMedPicker}>
          <DOBText style={{ opacity: medication ? 1 : 0.75 }}>
            {medication || 'Tap to search medication (RxNorm)'}
          </DOBText>
        </TouchableDOB>

        <Input
          placeholder="Dose (e.g. 50mg)"
          value={medicationDose}
          onChangeText={setMedicationDose}
          placeholderTextColor="#fff9"
        />

        <TouchableDOB onPress={() => setShowTimePicker(true)}>
          <DOBText>
            {`Default medication time: ${formatTime(medicationTime)}`}
          </DOBText>
        </TouchableDOB>

        {showTimePicker && (
          <DateTimePicker
            value={medicationTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selectedDate) => {
              if (Platform.OS !== 'ios') setShowTimePicker(false);
              if (selectedDate) {
                setMedicationTime(selectedDate);
              }
            }}
          />
        )}

        {Platform.OS === 'ios' && showTimePicker && (
          <DoneBtn onPress={() => setShowTimePicker(false)}>
            <DoneText>Done</DoneText>
          </DoneBtn>
        )}

        <SubmitButton activeOpacity={0.8} onPress={handleAddChild}>
          <ButtonText>Save Child</ButtonText>
          <Icon name="check" size={22} color="#FFF" />
        </SubmitButton>
      </Card>

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
              placeholderTextColor="#fff9"
              autoFocus
            />

            <HintText>{medLoading ? 'Searching RxNorm...' : medHint}</HintText>

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
                  <FooterText>Can&apos;t find it? Use your typed text:</FooterText>
                  <FooterBtn disabled={!medQuery.trim()} onPress={() => pickMed(medQuery.trim())}>
                    <FooterBtnText>Use &quot;{medQuery.trim() || '...'}&quot;</FooterBtnText>
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

// Styled Components
const Container = styled.View`
  flex: 1;
  background-color: #F5EFE6;
  justify-content: center;
  align-items: center;
  position: relative;
  padding: 24px;
`;

const TopCircle = styled.View`
  position: absolute;
  width: 360px;
  height: 360px;
  border-radius: 180px;
  background-color: #B03060;
  top: -140px;
  right: -120px;
  opacity: 0.95;
`;

const BottomCircle = styled.View`
  position: absolute;
  width: 320px;
  height: 320px;
  border-radius: 160px;
  background-color: #B03060;
  bottom: -170px;
  left: -140px;
  opacity: 0.9;
`;

const Card = styled.View`
  width: 100%;
  max-width: 420px;
  align-items: center;
`;

const Title = styled.Text`
  font-size: 30px;
  font-weight: 700;
  color: #2F2F2F;
  margin-bottom: 28px;
  align-self: flex-start;
`;

const Input = styled.TextInput`
  width: 100%;
  background-color: #B03060;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 16px;
  color: #FFF;
  font-size: 16px;
`;

const TouchableDOB = styled.TouchableOpacity`
  width: 100%;
  background-color: #B03060;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 16px;
  justify-content: center;
`;

const DOBText = styled.Text`
  color: #FFF;
  font-size: 16px;
`;

const DoneBtn = styled.TouchableOpacity`
  margin-top: -6px;
  margin-bottom: 12px;
  align-self: flex-end;
  background-color: #2F2F2F;
  padding: 10px 16px;
  border-radius: 12px;
`;

const DoneText = styled.Text`
  color: #fff;
  font-weight: 700;
`;

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
  margin-bottom: 6px;
`;

const ModalTitle = styled.Text`
  font-size: 16px;
  font-weight: 900;
  color: #2f2f2f;
`;

const CloseBtn = styled.TouchableOpacity`
  padding: 8px;
`;

const HintText = styled.Text`
  margin-top: 8px;
  font-size: 12px;
  color: #6b5e58;
`;

const ResultItem = styled.TouchableOpacity`
  padding: 12px;
  border-radius: 12px;
  background-color: #f5efe6;
  margin-top: 10px;
`;

const ResultText = styled.Text`
  font-size: 13px;
  font-weight: 700;
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
  background-color: #2f2f2f;
  padding: 14px;
  border-radius: 16px;
  align-items: center;
  opacity: ${(p) => (p.disabled ? 0.6 : 1)};
`;

const FooterBtnText = styled.Text`
  color: #fff;
  font-weight: 700;
`;

const SubmitButton = styled.TouchableOpacity`
  background-color: #2F2F2F;
  padding: 16px;
  border-radius: 50px;
  width: 60%;
  align-items: center;
  justify-content: center;
  flex-direction: row;
  margin-top: 8px;
  align-self: center;
`;

const ButtonText = styled.Text`
  color: #FFF;
  font-size: 18px;
  font-weight: 600;
  margin-right: 8px;
`;
