import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { ChatSocketProvider } from '../hooks/useChatSocket';
import { IdentityProvider } from '../hooks/useIdentity';

export default function RootLayout() {
  return (
    <IdentityProvider>
      <ChatSocketProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerTitleAlign: 'center',
          }}
        >
          <Stack.Screen name="index" options={{ title: 'QuickChat' }} />
          <Stack.Screen name="users" options={{ title: 'People' }} />
          <Stack.Screen name="chat/[id]" options={{ title: 'Chat' }} />
        </Stack>
      </ChatSocketProvider>
    </IdentityProvider>
  );
}
