import React, { useState } from 'react';
import styled from 'styled-components/native';
import { StatusBar, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in both fields');
      return;
    }

    try {
      const response = await fetch('http://192.168.1.87:8080/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const text = await response.text();

      if (response.ok) {
        if (text.includes('Login successful')) {
          Alert.alert('Success', 'Login successful!');
        } else {
          Alert.alert('Error', 'Invalid email or password');
        }
      } else {
        Alert.alert('Error', 'Server error. Please try again later.');
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'Network error. Please check your connection.');
    }
  };

  return (
    <Container>
      <StatusBar barStyle="dark-content" />

      {/* Background Circles */}
      <TopCircle />
      <BottomCircle />

      <Card>
        <Title>Welcome Back</Title>

        <Input
          placeholder="Email"
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

        <LoginButton activeOpacity={0.8} onPress={handleLogin}>
          <ButtonText>Login</ButtonText>
          <Icon name="arrow-right" size={22} color="#FFF" />
        </LoginButton>

        <SignUpRow>
          <SignUpText>Don't have an account?</SignUpText>
          <SignUpLink onPress={() => navigation.navigate('SignUp')}>
            {' '}Sign Up
          </SignUpLink>
        </SignUpRow>
      </Card>
    </Container>
  );
}

// Styled Components (copied and adjusted from SignUp.js)
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
  font-size: 32px;
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

const LoginButton = styled.TouchableOpacity`
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

const SignUpRow = styled.View`
  margin-top: 18px;
  flex-direction: row;
`;

const SignUpText = styled.Text`
  color: #6B5E58;
`;

const SignUpLink = styled.Text`
  color: #B03060;
  font-weight: 700;
`;
