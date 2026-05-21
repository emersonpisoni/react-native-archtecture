import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ScreenName } from '../../App';

type Demo = {
  id: ScreenName;
  title: string;
  description: string;
};

const demos: Demo[] = [
  {
    id: 'fabric',
    title: 'Fabric Renderer',
    description:
      'Componentes nativos renderizados pelo Fabric. Como ele substitui o Paper, o que é o Shadow Tree e por que o layout pode ser síncrono.',
  },
  {
    id: 'turbomodule',
    title: 'TurboModule (Calculator)',
    description:
      'Chamada de um módulo nativo via JSI, sem Bridge. Tipos verificados via codegen a partir da spec TypeScript.',
  },
  {
    id: 'threading',
    title: 'Thread Model',
    description:
      'JS thread vs UI thread vs Shadow/Background. O que acontece quando você bloqueia cada uma.',
  },
];

type Props = {
  onNavigate: (screen: ScreenName) => void;
};

export default function HomeScreen({ onNavigate }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.title}>RN Architecture</Text>
        <Text style={styles.subtitle}>
          Demos para entender Fabric, TurboModules e o thread model da Nova
          Arquitetura. Cada tela traz explicação inline.
        </Text>
      </View>

      {demos.map((demo) => (
        <Pressable
          key={demo.id}
          onPress={() => onNavigate(demo.id)}
          style={({ pressed }) => [
            styles.card,
            pressed && styles.cardPressed,
          ]}
        >
          <Text style={styles.cardTitle}>{demo.title}</Text>
          <Text style={styles.cardDescription}>{demo.description}</Text>
        </Pressable>
      ))}

      <Text style={styles.footer}>
        Leia o README.md na raiz do projeto para fundamentos completos,
        tradeoffs e referências.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    color: '#e6e8eb',
    fontSize: 32,
    fontWeight: '800',
  },
  subtitle: {
    color: '#9ba3b4',
    fontSize: 15,
    marginTop: 8,
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#161a23',
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#252b38',
  },
  cardPressed: {
    backgroundColor: '#1d2230',
  },
  cardTitle: {
    color: '#e6e8eb',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  cardDescription: {
    color: '#9ba3b4',
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    color: '#6b7385',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
});
