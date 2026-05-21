import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import InfoCard from '../components/InfoCard';
import ScreenHeader from '../components/ScreenHeader';
import Calculator from '../specs/NativeCalculator';

type Props = {
  onBack: () => void;
};

export default function TurboModuleDemoScreen({ onBack }: Props) {
  const [a, setA] = useState('21');
  const [b, setB] = useState('2');
  const [syncResult, setSyncResult] = useState<string>('');
  const [asyncResult, setAsyncResult] = useState<string>('');
  const [constants, setConstants] = useState<string>('');

  const runAdd = () => {
    try {
      const result = Calculator.add(Number(a), Number(b));
      setSyncResult(`${a} + ${b} = ${result}`);
    } catch (e) {
      setSyncResult(`Erro: ${(e as Error).message}`);
    }
  };

  const runMultiply = async () => {
    try {
      setAsyncResult('Calculando…');
      const result = await Calculator.multiplyAsync(Number(a), Number(b));
      setAsyncResult(`${a} × ${b} = ${result}`);
    } catch (e) {
      setAsyncResult(`Erro: ${(e as Error).message}`);
    }
  };

  const showConstants = () => {
    try {
      const c = Calculator.getConstants();
      setConstants(`PI = ${c.PI}\nE = ${c.E}`);
    } catch (e) {
      setConstants(`Erro: ${(e as Error).message}`);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="TurboModule"
        subtitle="Calculator implementado em Kotlin + Objective-C++, chamado via JSI."
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <InfoCard title="O que é um TurboModule?">
          <Text style={styles.body}>
            Versão evoluída dos NativeModules da arquitetura antiga. A spec
            TypeScript em <Text style={styles.code}>src/specs/NativeCalculator.ts</Text>{' '}
            é lida pelo codegen no build, que gera o contrato nativo. O JS
            chama o método via JSI — referência C++ direta para o módulo
            nativo, sem Bridge serializando JSON.
          </Text>
        </InfoCard>

        <InfoCard title="Inputs">
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={a}
              onChangeText={setA}
              placeholder="a"
              placeholderTextColor="#6b7385"
            />
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={b}
              onChangeText={setB}
              placeholder="b"
              placeholderTextColor="#6b7385"
            />
          </View>
        </InfoCard>

        <InfoCard title="add(a, b) — síncrono">
          <Text style={styles.body}>
            Retorna direto (não é Promise). Só é possível porque a chamada é
            JSI: o método nativo é invocado na própria JS thread.
          </Text>
          <Pressable style={styles.button} onPress={runAdd}>
            <Text style={styles.buttonText}>Executar add</Text>
          </Pressable>
          {syncResult ? <Text style={styles.result}>{syncResult}</Text> : null}
        </InfoCard>

        <InfoCard title="multiplyAsync(a, b) — Promise">
          <Text style={styles.body}>
            Retorna Promise. No nativo, podemos delegar para uma thread de
            background antes de resolver — útil para trabalho pesado.
          </Text>
          <Pressable style={styles.button} onPress={runMultiply}>
            <Text style={styles.buttonText}>Executar multiplyAsync</Text>
          </Pressable>
          {asyncResult ? <Text style={styles.result}>{asyncResult}</Text> : null}
        </InfoCard>

        <InfoCard title="getConstants() — sync">
          <Text style={styles.body}>
            Lazy: as constantes só são pedidas ao nativo quando algum código JS
            chama. Na arquitetura antiga, todas as constantes eram enviadas
            eagerly no startup, encarecendo o cold start.
          </Text>
          <Pressable style={styles.button} onPress={showConstants}>
            <Text style={styles.buttonText}>Ler constantes</Text>
          </Pressable>
          {constants ? <Text style={styles.result}>{constants}</Text> : null}
        </InfoCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  body: { color: '#cdd2dc', fontSize: 14, lineHeight: 21 },
  row: { flexDirection: 'row', gap: 12 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2a2f3a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e6e8eb',
    fontSize: 15,
    backgroundColor: '#0e1218',
  },
  button: {
    backgroundColor: '#1d2230',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#2a3550',
    marginTop: 10,
  },
  buttonText: { color: '#e6e8eb', fontSize: 14, fontWeight: '600' },
  result: {
    color: '#e0af68',
    fontSize: 14,
    fontFamily: 'Menlo',
    marginTop: 10,
  },
  code: {
    fontFamily: 'Menlo',
    fontSize: 13,
    color: '#e0af68',
  },
});
