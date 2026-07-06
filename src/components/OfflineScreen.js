import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const OfflineScreen = React.memo(({ visible, onRetry, topInset = 0 }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const prevVisible = useRef(false);
  const [shouldRender, setShouldRender] = useState(false);
  const retrying = useRef(false);

  useEffect(() => {
    if (visible && !prevVisible.current) {
      setShouldRender(true);
      retrying.current = false;
      fadeAnim.setValue(0);
      slideAnim.setValue(24);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start();
    } else if (!visible && prevVisible.current) {
      retrying.current = false;
      Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
        // Completely unmount after fade-out so the white background doesn't block the WebView
        setShouldRender(false);
      });
    }
    prevVisible.current = visible;
  }, [visible, fadeAnim, slideAnim]);

  const handleRetry = useCallback(() => {
    if (retrying.current) return;
    retrying.current = true;
    // Reset after a delay so user can tap again if still offline
    setTimeout(() => { retrying.current = false; }, 3000);
    onRetry();
  }, [onRetry]);

  if (!shouldRender) return null;

  return (
    <View
      style={[styles.overlay, { paddingTop: topInset }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <View style={styles.header}>
        <Image
          source={require('../assets/images/logo.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
      </View>

      <Animated.View
        style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
      >
        <Image
          source={require('../assets/images/NoInternetImage.png')}
          style={styles.image}
          resizeMode="contain"
        />

        <Text style={styles.title}>No Internet Connection</Text>

        <Text style={styles.subtitle}>
          SmartEco requires an internet connection to update and sync real-time
          environmental monitoring data.
        </Text>

        <TouchableOpacity
          style={styles.buttonWrap}
          activeOpacity={0.9}
          onPress={handleRetry}
        >
          <LinearGradient
            colors={['#0F796B', '#4EBD84']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  headerLogo: {
    height: 32,
    width: 160,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    width: '100%',
  },
  image: {
    width: 164,
    height: 164,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#7A7A7A',
    textAlign: 'center',
    marginBottom: 28,
  },
  buttonWrap: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  button: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default OfflineScreen;
