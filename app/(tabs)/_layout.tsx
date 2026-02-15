import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View, StyleSheet } from "react-native";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        {/* Status Bar */}
        <StatusBar style="dark" backgroundColor="#F4F5F7" />

        {/* Safe Area Wrapper */}
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          <View style={styles.content}>
            <Stack screenOptions={{ headerShown: false }} />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F4F5F7",
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
