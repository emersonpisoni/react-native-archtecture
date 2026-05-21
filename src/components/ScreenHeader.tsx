import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
};

export default function ScreenHeader({ title, subtitle, onBack }: Props) {
  return (
    <View style={styles.container}>
      {onBack && (
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>‹ Voltar</Text>
        </Pressable>
      )}
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2f3a',
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  backText: {
    color: '#7aa2f7',
    fontSize: 16,
  },
  title: {
    color: '#e6e8eb',
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: '#9ba3b4',
    fontSize: 14,
    marginTop: 4,
  },
});
