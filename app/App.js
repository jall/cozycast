import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import FeedScreen from './src/screens/FeedScreen';
import RecordScreen from './src/screens/RecordScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Tab = createBottomTabNavigator();

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <Text style={styles.loadingLogo}>cozycast</Text>
      <ActivityIndicator size="large" color="#E8734A" style={{ marginTop: 24 }} />
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#E8734A',
        tabBarInactiveTintColor: '#B0A090',
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'Feed') {
            iconName = 'home';
          } else if (route.name === 'Record') {
            iconName = 'mic';
          } else if (route.name === 'Profile') {
            iconName = 'person';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Record" component={RecordScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AppRoot() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <NavigationContainer>
      <MainTabs />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppRoot />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#FFF8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogo: {
    fontSize: 36,
    fontWeight: '700',
    color: '#E8734A',
    letterSpacing: -1,
  },
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    height: 88,
    paddingTop: 8,
    paddingBottom: 28,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
