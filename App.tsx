/**
 * RNArchDemo — Didactic project about React Native Architecture.
 *
 * Minimal useState-based router to avoid adding dependencies
 * (react-navigation, etc.) and keep the focus on what matters: architecture.
 */

import { useState } from 'react';
import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import HomeScreen from './src/screens/HomeScreen';
import FabricDemoScreen from './src/screens/FabricDemoScreen';
import TurboModuleDemoScreen from './src/screens/TurboModuleDemoScreen';
import ThreadingDemoScreen from './src/screens/ThreadingDemoScreen';

export type ScreenName =
  | 'home'
  | 'fabric'
  | 'turbomodule'
  | 'threading';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState<ScreenName>('home');

  const containerStyle = [
    styles.container,
    { paddingTop: insets.top, paddingBottom: insets.bottom },
  ];

  return (
    <View style={containerStyle}>
      {screen === 'home' && <HomeScreen onNavigate={setScreen} />}
      {screen === 'fabric' && (
        <FabricDemoScreen onBack={() => setScreen('home')} />
      )}
      {screen === 'turbomodule' && (
        <TurboModuleDemoScreen onBack={() => setScreen('home')} />
      )}
      {screen === 'threading' && (
        <ThreadingDemoScreen onBack={() => setScreen('home')} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0e14',
  },
});

export default App;
