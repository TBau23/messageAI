import { Stack } from 'expo-router';

export default function MainLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="new-chat" 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="chat/[id]" 
        options={{ headerShown: false }} 
      />
    </Stack>
  );
}

