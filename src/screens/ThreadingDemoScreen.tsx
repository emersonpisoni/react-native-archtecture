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
      // bloqueia a JS thread por 2s de propósito
    }
    setCounter((c) => c + 1);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Thread Model"
        subtitle="JS thread, UI thread e o que acontece quando travam."
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <InfoCard title="Threads principais">
          <Text style={styles.body}>
            • <Text style={styles.bold}>JS thread</Text> — onde seu código JS
            roda (Hermes). Single-threaded.{'\n'}
            • <Text style={styles.bold}>UI/Main thread</Text> — desenha frames
            nativos e processa eventos do SO.{'\n'}
            • <Text style={styles.bold}>Background/Shadow thread</Text> —
            Fabric usa C++ aqui para reconciliar e calcular layout (Yoga).
            {'\n'}
            • Hermes e o runtime JSI permitem chamadas síncronas entre JS e
            nativo, mas isso não muda o fato de que cada lado tem sua thread.
          </Text>
        </InfoCard>

        <InfoCard title="Animated.useNativeDriver">
          <Text style={styles.body}>
            A animação abaixo roda 100% na UI thread. Mesmo se você travar o
            JS, ela continua suave.
          </Text>
          <Animated.View
            style={[
              styles.ball,
              { transform: [{ translateX }] },
            ]}
          />
          <Pressable style={styles.button} onPress={startAnimationNative}>
            <Text style={styles.buttonText}>Iniciar animação</Text>
          </Pressable>
        </InfoCard>

        <InfoCard title="Bloqueando a JS thread">
          <Text style={styles.body}>
            O botão abaixo executa um while loop síncrono por 2s no JS. A
            animação continua porque está na UI thread, mas qualquer setState
            (ex: o contador) fica preso até o loop acabar.
          </Text>
          <Pressable style={styles.dangerButton} onPress={blockJsThread}>
            <Text style={styles.buttonText}>Travar JS por 2s</Text>
          </Pressable>
          <Text style={styles.counter}>Cliques registrados: {counter}</Text>
          <Text style={styles.note}>
            Na arquitetura antiga, isso também bloqueava qualquer comunicação
            com o nativo (a Bridge tinha que aguardar a JS thread). Com
            TurboModules + JSI, módulos invocados a partir do nativo podem
            seguir respondendo (dependendo do design).
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
