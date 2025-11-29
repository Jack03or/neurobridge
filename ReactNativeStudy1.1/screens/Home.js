// screens/Home.js
import React from 'react';
import { StatusBar } from 'react-native';
import styled from 'styled-components/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function HomeScreen({ navigation }) {
  return (
    <Container>
      <StatusBar barStyle="dark-content" />

      <HeaderContainer>
        <AppIcon>
          <Icon name="brain" size={60} color="#FFFFFF" />
        </AppIcon>

        <HeaderText>NeuroBridge</HeaderText>
        <SubHeaderText>Care With Confidence</SubHeaderText>
      </HeaderContainer>

      <ButtonContainer>
        <PrimaryButton activeOpacity={0.8} onPress={() => navigation.navigate('Login')}>
          <PrimaryButtonText>Login</PrimaryButtonText>
        </PrimaryButton>

        <SecondaryButton activeOpacity={0.8} onPress={() => navigation.navigate('SignUp')}>
          <SecondaryButtonText>Sign Up</SecondaryButtonText>
        </SecondaryButton>
      </ButtonContainer>
    </Container>
  );
}

// Styled Components
const Container = styled.View`
  flex: 1;
  background-color: #F5EFE6;
  align-items: center;
  justify-content: center;
  padding: 40px;
`;

const HeaderContainer = styled.View`
  align-items: center;
  margin-bottom: 80px;
`;

const AppIcon = styled.View`
  background-color: #B03060;
  padding: 20px;
  border-radius: 60px;
  margin-bottom: 20px;
  elevation: 8;
  shadow-color: #B03060;
  shadow-opacity: 0.2;
  shadow-radius: 8px;
`;

const HeaderText = styled.Text`
  color: #2F2F2F;
  font-size: 32px;
  font-weight: 700;
  text-align: center;
`;

const SubHeaderText = styled.Text`
  color: #6B5E58;
  font-size: 16px;
  margin-top: 6px;
  text-align: center;
`;

const ButtonContainer = styled.View`
  width: 100%;
  align-items: center;
`;

const PrimaryButton = styled.TouchableOpacity`
  background-color: #B03060;
  padding: 16px;
  border-radius: 14px;
  width: 80%;
  align-items: center;
  margin-bottom: 20px;
  shadow-color: #B03060;
  shadow-opacity: 0.25;
  shadow-radius: 6px;
  elevation: 4;
`;

const PrimaryButtonText = styled.Text`
  color: #FFFFFF;
  font-size: 18px;
  font-weight: 600;
`;

const SecondaryButton = styled.TouchableOpacity`
  border: 2px solid #B03060;
  padding: 16px;
  border-radius: 14px;
  width: 80%;
  align-items: center;
  margin-bottom: 20px;
`;

const SecondaryButtonText = styled.Text`
  color: #B03060;
  font-size: 18px;
  font-weight: 600;
`;
