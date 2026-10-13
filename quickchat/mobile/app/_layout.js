import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { ChatSocketProvider } from '../hooks/useChatSocket';
import { IdentityProvider } from '../hooks/useIdentity';
import { NotepadProvider } from '../hooks/useNotepad';

export default function RootLayout() {
  return (
    <IdentityProvider>
      <NotepadProvider>
        <ChatSocketProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerTitleAlign: 'center',
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="unlock" options={{ title: 'NotApp' }} />
            <Stack.Screen name="recovery" options={{ title: 'NotApp' }} />
            <Stack.Screen name="chats" options={{ title: 'Chats' }} />
            <Stack.Screen name="search" options={{ title: 'Search people' }} />
            <Stack.Screen name="requests" options={{ title: 'Requests' }} />
            <Stack.Screen name="profile" options={{ title: 'Profile' }} />
            <Stack.Screen name="chat/[id]" options={{ title: 'Chat' }} />
          </Stack>
        </ChatSocketProvider>
      </NotepadProvider>
    </IdentityProvider>
  );
}
