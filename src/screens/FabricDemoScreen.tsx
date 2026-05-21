import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import InfoCard from '../components/InfoCard';
import ScreenHeader from '../components/ScreenHeader';

type Props = {
  onBack: () => void;
};

export default function FabricDemoScreen({ onBack }: Props) {
  const [text, setText] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [boxes, setBoxes] = useState(3);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Fabric Renderer"
        subtitle="Cada componente abaixo é uma view nativa renderizada pelo Fabric."
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <InfoCard title="O que é o Fabric?">
          <Text style={styles.body}>
            Fabric é o novo renderer da Nova Arquitetura. Cada componente JSX
            (View, Text, TextInput…) vira um <Text style={styles.code}>HostComponent</Text>{' '}
            nativo. O React reconcilia uma Shadow Tree em C++ que descreve a UI
            de forma compartilhada entre JS e native — substitui o antigo
            Paper renderer.
          </Text>
        </InfoCard>

        <InfoCard title="Por que importa?">
          <Text style={styles.body}>
            • Layout (Yoga) e commit podem rodar de forma síncrona quando o JS
            precisa do tamanho — sem o ciclo assíncrono da Bridge.{'\n'}
            • Menos cópias serializadas: o Shadow Tree é manipulado direto via
            JSI a partir do JS.{'\n'}
            • Componentes podem ser registrados via codegen (HostComponents
            tipados a partir de uma spec TS).
          </Text>
        </InfoCard>

        <InfoCard title="Componentes nativos em ação">
          <Text style={styles.label}>TextInput (UITextField / EditText)</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite algo…"
            placeholderTextColor="#6b7385"
            value={text}
            onChangeText={setText}
          />

          <Text style={[styles.label, styles.mt]}>
            Switch (UISwitch / SwitchCompat)
          </Text>
          <View style={styles.row}>
            <Switch value={enabled} onValueChange={setEnabled} />
            <Text style={styles.bodyInline}>
              {enabled ? 'Ligado' : 'Desligado'}
            </Text>
          </View>

          <Text style={[styles.label, styles.mt]}>
            Views com flexbox (Yoga)
          </Text>
          <View style={styles.boxRow}>
            {Array.from({ length: boxes }).map((_, i) => (
              <View key={i} style={[styles.box, { opacity: 0.4 + i * 0.2 }]} />
            ))}
          </View>
          <View style={styles.row}>
            <Text
              style={styles.button}
              onPress={() => setBoxes((n) => Math.max(1, n - 1))}
            >
              − caixa
            </Text>
            <Text
              style={styles.button}
              onPress={() => setBoxes((n) => Math.min(8, n + 1))}
            >
              + caixa
            </Text>
          </View>
          <Text style={styles.note}>
            Cada alteração no estado dispara reconciliação React → mutações na
            Shadow Tree → commit → mount. No Fabric isso vira chamadas C++
            diretas, sem serialização JSON.
          </Text>
        </InfoCard>

        <InfoCard title="Paper (arquitetura antiga)">
          <Text style={styles.body}>
            No Paper, o JS criava operações de UI que eram serializadas em JSON
            e enviadas pela Bridge (assíncrona, batched) até a UI thread. Sem
            forma de obter layout sincronamente do JS — daí soluções como{' '}
            <Text style={styles.code}>onLayout</Text>{' '}
            e medições assíncronas.
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
  bodyInline: { color: '#cdd2dc', fontSize: 14 },
  label: {
    color: '#7aa2f7',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  mt: { marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: '#2a2f3a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e6e8eb',
    fontSize: 15,
    backgroundColor: '#0e1218',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  boxRow: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  box: {
    width: 32,
    height: 32,
    backgroundColor: '#7aa2f7',
    borderRadius: 6,
  },
  button: {
    color: '#7aa2f7',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2a3550',
    overflow: 'hidden',
  },
  note: {
    color: '#9ba3b4',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 18,
  },
  code: {
    fontFamily: 'Menlo',
    fontSize: 13,
    color: '#e0af68',
  },
});
