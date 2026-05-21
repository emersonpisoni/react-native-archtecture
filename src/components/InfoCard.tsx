import { StyleSheet, Text, View } from 'react-native';

type Props = {
  title: string;
  children: React.ReactNode;
};

export default function InfoCard({ title, children }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#161a23',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#252b38',
  },
  title: {
    color: '#7aa2f7',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  body: {
    gap: 8,
  },
});
