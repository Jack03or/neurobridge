// App.js
import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from './screens/Home';
import SignUpScreen from './screens/SignUp';
import LoginScreen from './screens/Login';
import AddChild from './screens/AddChild';
import Dashboard from './screens/Dashboard';

// NEW
import LogSeizureSymptoms from './screens/LogSeizureSymptoms';
import LogSeizureDetails from './screens/LogSeizureDetails';
import SeizureSummary from './screens/SeizureSummary';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName="Home"
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="AddChild" component={AddChild} />
        <Stack.Screen name="Dashboard" component={Dashboard} />

        {/* NEW FLOW */}
        <Stack.Screen name="LogSeizureSymptoms" component={LogSeizureSymptoms} />
        <Stack.Screen name="LogSeizureDetails" component={LogSeizureDetails} />
        <Stack.Screen name="SeizureSummary" component={SeizureSummary} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
