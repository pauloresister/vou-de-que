import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { fonts, useTheme } from '@/theme';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.text,
        tabBarInactiveTintColor: t.textMuted,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.border },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 13 },
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Comparar',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'git-compare' : 'git-compare-outline'} size={24} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="alertas"
        options={{
          title: 'Alertas',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'megaphone' : 'megaphone-outline'} size={24} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'options' : 'options-outline'} size={24} color={color as string} />,
        }}
      />
    </Tabs>
  );
}
