// screens/AddChild.js
import React, { useState } from 'react';
import { Alert, StatusBar, Platform } from 'react-native';
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
  const [dob, setDob] = useState(null);
  const [showPicker, setShowPicker] = useState(false);

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
        <Input
          placeholder="Medication"
          value={medication}
          onChangeText={setMedication}
          placeholderTextColor="#fff9"
        />

        <SubmitButton activeOpacity={0.8} onPress={handleAddChild}>
          <ButtonText>Save Child</ButtonText>
          <Icon name="check" size={22} color="#FFF" />
        </SubmitButton>
      </Card>
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
