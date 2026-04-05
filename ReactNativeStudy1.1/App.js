// App.js
import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import HomeScreen from './screens/Home';
import SignUpScreen from './screens/SignUp';
import LoginScreen from './screens/Login';
import AddChild from './screens/AddChild';
import Dashboard from './screens/Dashboard';

//Log Seizure
import LogSeizureSymptoms from './screens/LogSeizureSymptoms';
import LogSeizureDetails from './screens/LogSeizureDetails';
import LogSeizureTriggers from './screens/LogSeizureTriggers';
import SeizureSummary from './screens/SeizureSummary';

//Diary
import SeizureDiary from './screens/SeizureDiary';
import LogMedicationEvent from './screens/LogMedicationEvent';
import DiaryEventView from './screens/DiaryEventView';
import SeizureEventView from './screens/SeizureEventView';
import LogAppointmentEvent from './screens/LogAppointmentEvent';
import GenerateReport from './screens/GenerateReport';
import SavedReports from './screens/SavedReports';
import ReportPreview from './screens/ReportPreview';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs({ route }) {
  const userId = route?.params?.userId;

  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={({ route: tabRoute }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#B03060',
        tabBarInactiveTintColor: '#8b7e76',
        tabBarStyle: {
          height: 62,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarIcon: ({ color, size }) => {
          const iconMap = {
            SeizureDiary: 'calendar-month-outline',
            Dashboard: 'view-dashboard-outline',
            LogSeizureSymptoms: 'plus-circle-outline',
            GenerateReport: 'file-document-outline',
          };

          return <Icon name={iconMap[tabRoute.name] || 'circle-outline'} color={color} size={size} />;
        },
      })}
    >
      <Tab.Screen
        name="SeizureDiary"
        component={SeizureDiary}
        initialParams={{ userId }}
        options={{ title: 'Diary' }}
      />
      <Tab.Screen
        name="Dashboard"
        component={Dashboard}
        initialParams={{ userId }}
        options={{ title: 'Dashboard' }}
      />
      <Tab.Screen
        name="LogSeizureSymptoms"
        component={LogSeizureSymptoms}
        initialParams={{ userId }}
        options={{ title: 'Log Seizure' }}
      />
      <Tab.Screen
        name="GenerateReport"
        component={GenerateReport}
        initialParams={{ userId }}
        options={{ title: 'Reports' }}
      />
    </Tab.Navigator>
  );
}

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
        <Stack.Screen name="MainTabs" component={MainTabs} />

        {/* Log Seizure */}
        <Stack.Screen name="LogSeizureDetails" component={LogSeizureDetails} />
        <Stack.Screen name="LogSeizureTriggers" component={LogSeizureTriggers} />
        <Stack.Screen name="SeizureSummary" component={SeizureSummary} />

        {/* Seizure Diary */}
        <Stack.Screen name="LogMedicationEvent" component={LogMedicationEvent} />
        <Stack.Screen name="DiaryEventView" component={DiaryEventView} />
        <Stack.Screen name="SeizureEventView" component={SeizureEventView} />
        <Stack.Screen name="LogAppointmentEvent" component={LogAppointmentEvent} />

        {/* Reports */}
        <Stack.Screen name="SavedReports" component={SavedReports} />
        <Stack.Screen name="ReportPreview" component={ReportPreview} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
