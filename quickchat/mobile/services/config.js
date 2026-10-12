import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_PORT = 5000;

function resolveHost() {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    '';

  if (hostUri) {
    return hostUri.split(':')[0];
  }

  if (Platform.OS === 'android') {
    return '10.0.2.2';
  }

  return 'localhost';
}

const override = process.env.EXPO_PUBLIC_API_URL;

export const API_BASE_URL = override
  ? override.replace(/\/+$/, '')
  : `http://${resolveHost()}:${DEFAULT_PORT}`;

export const SOCKET_URL = API_BASE_URL;
