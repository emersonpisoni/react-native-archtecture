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
        subtitle="Every component below is a native view rendered by Fabric."
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <InfoCard title="What is Fabric?">
          <Text style={styles.body}>
            Fabric is the new renderer of the New Architecture. Every JSX
            component (View, Text, TextInput…) becomes a native{' '}
            <Text style={styles.code}>HostComponent</Text>. React reconciles a
            Shadow Tree in C++ that describes the UI in a form shared between JS
            and native — replacing the old Paper renderer.
          </Text>
        </InfoCard>

        <InfoCard title="Why does it matter?">
          <Text style={styles.body}>
            • Layout (Yoga) and commit can run synchronously when JS needs the
            size — no more async round-trip through the Bridge.{'\n'}
            • Fewer serialized copies: the Shadow Tree is mutated directly via
            JSI from JS.{'\n'}
            • Components can be registered via codegen (typed HostComponents
            from a TS spec).
          </Text>
        </InfoCard>

        <InfoCard title="Native components in action">
          <Text style={styles.label}>TextInput (UITextField / EditText)</Text>
          <TextInput
            style={styles.input}
            placeholder="Type something…"
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
              {enabled ? 'On' : 'Off'}
            </Text>
          </View>

          <Text style={[styles.label, styles.mt]}>
            Views with flexbox (Yoga)
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
              − box
            </Text>
            <Text
              style={styles.button}
              onPress={() => setBoxes((n) => Math.min(8, n + 1))}
            >
              + box
            </Text>
          </View>
          <Text style={styles.note}>
            Every state change triggers React reconciliation → Shadow Tree
            mutations → commit → mount. In Fabric this becomes direct C++ calls,
            with no JSON serialization.
          </Text>
        </InfoCard>

        <InfoCard title="Paper (old architecture)">
          <Text style={styles.body}>
            In Paper, JS created UI operations that were serialized to JSON and
            sent over the Bridge (async, batched) to the UI thread. There was no
            way to get layout synchronously from JS — hence workarounds like{' '}
            <Text style={styles.code}>onLayout</Text> and async measurements.
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
