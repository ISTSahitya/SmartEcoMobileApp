import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  Animated,
  Easing,
  Pressable,
  StatusBar,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DEVICE_IMAGE = require('../assets/images/smarteco-device.png');
const LOGO_IMAGE = require('../assets/images/logo.png');

const DESCRIPTIONS = {
  hard:
    "We've made important improvements to the SmartEco app. This version is no longer supported, so please update to continue using the app.",
  soft:
    "We've made some exciting improvements to the SmartEco app! Update now to enjoy the latest features and performance upgrades.",
};

/** Loops the animation `build(value)` returns while the modal is visible, and returns the value. */
const useLoop = (visible, build) => {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return undefined;
    value.setValue(0);
    const loop = Animated.loop(build(value));
    loop.start();
    return () => loop.stop();
    // build is a stable inline factory; only visibility should restart the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, value]);
  return value;
};

const pingPong = duration => value =>
  Animated.sequence([
    Animated.timing(value, {
      toValue: 1,
      duration,
      easing: Easing.inOut(Easing.sin),
      useNativeDriver: true,
    }),
    Animated.timing(value, {
      toValue: 0,
      duration,
      easing: Easing.inOut(Easing.sin),
      useNativeDriver: true,
    }),
  ]);

const UpdateModal = ({ visible, data, onDismiss, onUpdate }) => {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isHard = data?.updateType === 'hard';

  const float = useLoop(visible, pingPong(2600));
  const drift = useLoop(visible, pingPong(7000));
  const pulse = useLoop(visible, value =>
    Animated.timing(value, {
      toValue: 1,
      duration: 3200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }),
  );

  const deviceSize = width * 0.85;
  const ringSize = deviceSize * 0.7;
  const contentBottomPadding = Math.min(
    deviceSize * 0.62,
    Math.max(insets.bottom + 16, height * 0.24),
  );

  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });

  // Two rings half a cycle apart, so one is always expanding.
  const ringStyle = progress => ({
    opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
    transform: [
      { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.6] }) },
    ],
  });
  const pulseOffset = pulse.interpolate({
    inputRange: [0, 0.5, 0.5001, 1],
    outputRange: [0.5, 1, 0, 0.5],
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      // A hard update can't be closed; a soft one closes like "Later".
      onRequestClose={() => {
        if (!isHard) onDismiss?.();
      }}
    >
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <LinearGradient
        colors={['#FFFFFF', '#FFFFFF', '#F3FAF6']}
        locations={[0, 0.65, 1]}
        style={[styles.screen, { paddingTop: insets.top }]}
      >
        {/* Drifting background blobs */}
        <Animated.View
          style={[
            styles.blob,
            styles.blobTop,
            {
              width: width * 0.9,
              height: width * 0.9,
              borderRadius: width * 0.45,
              transform: [
                { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-30, 30] }) },
                { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 40] }) },
                { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.blob,
            styles.blobBottom,
            {
              width: width * 0.8,
              height: width * 0.8,
              borderRadius: width * 0.4,
              transform: [
                { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [20, -40] }) },
                { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [30, -20] }) },
                { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1.1, 0.95] }) },
              ],
            },
          ]}
        />

        {/* Device in the bottom-right corner, bleeding off the edge like the template */}
        <View
          pointerEvents="none"
          style={[
            styles.deviceArea,
            {
              width: deviceSize,
              height: deviceSize,
              right: -deviceSize * 0.14,
              bottom: insets.bottom - deviceSize * 0.05,
            },
          ]}
        >
          {[pulse, pulseOffset].map((progress, index) => (
            <Animated.View
              key={index}
              style={[
                styles.ring,
                {
                  width: ringSize,
                  height: ringSize,
                  borderRadius: ringSize / 2,
                },
                ringStyle(progress),
              ]}
            />
          ))}
          <Animated.Image
            source={DEVICE_IMAGE}
            resizeMode="contain"
            style={{
              width: deviceSize,
              height: deviceSize,
              transform: [{ translateY: floatY }, { rotate: '-8deg' }],
            }}
          />
        </View>

        <Image
          source={LOGO_IMAGE}
          resizeMode="contain"
          style={styles.logo}
        />

        <ScrollView
          style={styles.content}
          contentContainerStyle={[
            styles.contentContainer,
            { paddingBottom: contentBottomPadding },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Text style={styles.title}>New Update Available</Text>
          <Text style={styles.message}>
            {DESCRIPTIONS[isHard ? 'hard' : 'soft']}
          </Text>

          {/* The text sizes the pill; the gradient only fills (and is clipped to) it. */}
          <Pressable
            onPress={onUpdate}
            style={({ pressed }) => [styles.updateButton, { opacity: pressed ? 0.85 : 1 }]}
          >
            <LinearGradient
              colors={['#0F796B', '#4EBD84']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.updateButtonText}>Update Now</Text>
          </Pressable>
 

          {!isHard && (
            <Pressable
              onPress={onDismiss}
              hitSlop={8}
              style={({ pressed }) => [styles.laterButton, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={styles.laterText}>Later</Text>
            </Pressable>
          )}
        </ScrollView>
      </LinearGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
  },
  blobTop: {
    top: -120,
    left: -140,
    backgroundColor: 'rgba(111, 220, 149, 0.08)',
  },
  blobBottom: {
    bottom: -60,
    left: -80,
    backgroundColor: 'rgba(15, 121, 107, 0.04)',
  },
  logo: {
    alignSelf: 'center',
    marginTop: -5,
    width: 180,
    height: 50,
  },
  deviceArea: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(78, 189, 132, 0.6)',
    backgroundColor: 'rgba(78, 189, 132, 0.04)',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    fontWeight: '400',
    color: '#374151',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  updateButton: {
    alignSelf: 'center',
    minHeight: 44,
    paddingHorizontal: 28,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  laterButton: {
    marginTop: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  laterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0F796B',
  },
});

export default UpdateModal;
