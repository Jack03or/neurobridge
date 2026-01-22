// screens/SignUp.js
import React, { useState } from 'react';
import styled from 'styled-components/native';
import { StatusBar, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { BASE_URL } from '../config';

export default function SignUp({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignUp = async () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const result = await response.json(); // backend returns JSON User
      console.log('Sign-up response JSON:', result);

      if (response.ok && result && result.id) {
        Alert.alert('Success', 'User registered successfully!');
        // Pass userId to AddChild so we can link the child to this parent
        navigation.navigate('AddChild', { userId: result.id });
      } else {
        Alert.alert('Error', 'Registration failed.');
      }
    } catch (error) {
      console.error('Sign-up error:', error);
      Alert.alert('Network Error', 'Could not connect to the server.');
    }
  };

  return (
    <Container>
      <StatusBar barStyle="dark-content" />
      <TopCircle />
      <BottomCircle />

      <Card>
        <Title>Create Account</Title>

        <Input
          placeholder="Name"
          value={name}
          onChangeText={setName}
          placeholderTextColor="#fff9"
        />
        <Input
          placeholder="Your Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor="#fff9"
        />
        <Input
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholderTextColor="#fff9"
        />

        <SignUpButton activeOpacity={0.8} onPress={handleSignUp}>
          <ButtonText>Sign Up</ButtonText>
          <Icon name="arrow-right" size={22} color="#FFF" />
        </SignUpButton>

        <LoginRow>
          <LoginText>Already have an account?</LoginText>
          <LoginLink onPress={() => navigation.goBack()}> Sign In</LoginLink>
        </LoginRow>
      </Card>
    </Container>
  );
}

// Styled Components
const Container = styled.View`
  flex: 1;
  background-color: #f5efe6;
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
  background-color: #b03060;
  top: -140px;
  right: -120px;
  opacity: 0.95;
`;

const BottomCircle = styled.View`
  position: absolute;
  width: 320px;
  height: 320px;
  border-radius: 160px;
  background-color: #b03060;
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
  font-size: 32px;
  font-weight: 700;
  color: #2f2f2f;
  margin-bottom: 28px;
  align-self: flex-start;
`;

const Input = styled.TextInput`
  width: 100%;
  background-color: #b03060;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 16px;
  color: #fff;
  font-size: 16px;
`;

const SignUpButton = styled.TouchableOpacity`
  background-color: #2f2f2f;
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
  color: #fff;
  font-size: 18px;
  font-weight: 600;
  margin-right: 8px;
`;

const LoginRow = styled.View`
  margin-top: 18px;
  flex-direction: row;
`;

const LoginText = styled.Text`
  color: #6b5e58;
`;

const LoginLink = styled.Text`
  color: #b03060;
  font-weight: 700;
`;
