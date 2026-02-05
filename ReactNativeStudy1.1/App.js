// App.js
import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from './screens/Home';
import SignUpScreen from './screens/SignUp';
import LoginScreen from './screens/Login';
import AddChild from './screens/AddChild';
import Dashboard from './screens/Dashboard';

//Log Seizure
import LogSeizureSymptoms from './screens/LogSeizureSymptoms';
import LogSeizureDetails from './screens/LogSeizureDetails';
import SeizureSummary from './screens/SeizureSummary';

//Diary
import SeizureDiary from './screens/SeizureDiary';
import LogMedicationEvent from './screens/LogMedicationEvent';
import DiaryEventView from './screens/DiaryEventView';
import SeizureEventView from './screens/SeizureEventView';
import LogAppointmentEvent from './screens/LogAppointmentEvent';



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

        {/* Log Seizure */}
        <Stack.Screen name="LogSeizureSymptoms" component={LogSeizureSymptoms} />
        <Stack.Screen name="LogSeizureDetails" component={LogSeizureDetails} />
        <Stack.Screen name="SeizureSummary" component={SeizureSummary} />

        {/* Seizure Diary */}
        <Stack.Screen name="SeizureDiary" component={SeizureDiary} />
        <Stack.Screen name="LogMedicationEvent" component={LogMedicationEvent} />
        <Stack.Screen name="DiaryEventView" component={DiaryEventView} />
        <Stack.Screen name="SeizureEventView" component={SeizureEventView} />
        <Stack.Screen name="LogAppointmentEvent" component={LogAppointmentEvent} />




      </Stack.Navigator>
    </NavigationContainer>
  );
}
