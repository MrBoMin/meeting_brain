import { Platform, ViewStyle } from 'react-native';

export const shadow1: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  android: {
    elevation: 3,
  },
  default: {},
});

export const shadow2: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
  },
  android: {
    elevation: 6,
  },
  default: {},
});

export const shadow3: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
  },
  android: {
    elevation: 10,
  },
  default: {},
});
