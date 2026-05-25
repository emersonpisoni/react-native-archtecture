import { useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import InfoCard from '../components/InfoCard';
import ScreenHeader from '../components/ScreenHeader';

type Props = {
  onBack: () => void;
};

export default function ThreadingDemoScreen({ onBack }: Props) {
  const [counter, setCounter] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  const startAnimationNative = () => {
    translateX.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: 200,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  };

  const blockJsThread = () => {
    const start = Date.now();
    while (Date.now() - start < 2000) {
      // intentionally blocks the JS thread for 2s
    }
    setCounter((c) => c + 1);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Thread Model"
        subtitle="JS thread, UI thread, and what happens when each one blocks."
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <InfoCard title="Main threads">
          <Text style={styles.body}>
            • <Text style={styles.bold}>JS thread</Text> — where your JS code
            runs (Hermes). Single-threaded.{'\n'}
            • <Text style={styles.bold}>UI / Main thread</Text> — draws native
            frames and processes OS events.{'\n'}
            • <Text style={styles.bold}>Background / Shadow thread</Text> —
            Fabric uses C++ here to reconcile and calculate layout (Yoga).
            {'\n'}
            • Hermes and the JSI runtime allow synchronous calls between JS and
            native, but each side still has its own thread.
          </Text>
        </InfoCard>

        <InfoCard title="Animated.useNativeDriver">
          <Text style={styles.body}>
            The animation below runs 100% on the UI thread. Even if you block
            the JS thread, it keeps running smoothly.
          </Text>
          <Animated.View
            style={[
              styles.ball,
              { transform: [{ translateX }] },
            ]}
          />
          <Pressable style={styles.button} onPress={startAnimationNative}>
            <Text style={styles.buttonText}>Start animation</Text>
          </Pressable>
        </InfoCard>

        <InfoCard title="Blocking the JS thread">
          <Text style={styles.body}>
            The button below runs a synchronous while loop for 2s in JS. The
            animation keeps going because it lives on the UI thread, but any
            setState (e.g. the counter) is stuck until the loop finishes.
          </Text>
          <Pressable style={styles.dangerButton} onPress={blockJsThread}>
            <Text style={styles.buttonText}>Block JS for 2s</Text>
          </Pressable>
          <Text style={styles.counter}>Registered clicks: {counter}</Text>
          <Text style={styles.note}>
            In the old architecture, this also blocked all communication with
            native (the Bridge had to wait for the JS thread). With TurboModules
            + JSI, modules invoked from native can keep responding (depending on
            the design).
          </Text>
        </InfoCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  body: { color: '#cdd2dc', fontSize: 14, lineHeight: 21 },
  bold: { color: '#e6e8eb', fontWeight: '700' },
  ball: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7aa2f7',
    marginVertical: 16,
  },
  button: {
    backgroundColor: '#1d2230',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#2a3550',
  },
  dangerButton: {
    backgroundColor: '#3a1f24',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#5a2a30',
    marginTop: 8,
  },
  buttonText: { color: '#e6e8eb', fontSize: 14, fontWeight: '600' },
  counter: { color: '#9ba3b4', fontSize: 13, marginTop: 10 },
  note: {
    color: '#9ba3b4',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 10,
    lineHeight: 18,
  },
});
