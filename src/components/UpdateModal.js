import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Linking,
  ScrollView,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const ROCKET_IMG = require('../assets/images/RocketUpdate.png');
const MOBILE_IMG = require('../assets/images/MobileImage.png');
const NEW_BADGE_IMG = require('../assets/images/NewBadge.png');
const CELEBRATION_IMG = require('../assets/images/Celebration.png');

const FONT = 'DM Sans';

const DEFAULT_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.smarteco.app';

// Fallback feature list shown when the backend doesn't supply release notes.
const DEFAULT_FEATURES = [
  'Smoother real-time monitoring',
  'Faster indoor air quality dashboard',
  'Improved sensor connectivity',
  'Enhanced alert performance',
  'Security and stability improvements',
];

// Normalises releaseNotes (string with newlines/bullets, or array) into a list.
const parseFeatures = (releaseNotes) => {
  if (Array.isArray(releaseNotes)) {
    const items = releaseNotes.map((s) => String(s).trim()).filter(Boolean);
    return items.length ? items : DEFAULT_FEATURES;
  }
  if (typeof releaseNotes === 'string' && releaseNotes.trim()) {
    const items = releaseNotes
      .split(/\r?\n|•|·|;/)
      .map((s) => s.replace(/^[-*\s]+/, '').trim())
      .filter(Boolean);
    return items.length ? items : DEFAULT_FEATURES;
  }
  return DEFAULT_FEATURES;
};

const UpdateModal = ({ visible, type, data, onDismiss, onSkipVersion }) => {
  const isForce = type === 'force';
  const isMaintenance = type === 'maintenance';

  const handleUpdate = () => {
    const url = data?.storeUrl || DEFAULT_STORE_URL;
    Linking.openURL(url).catch(() => {
      Linking.openURL('https://play.google.com/store');
    });
  };

  // ----- FORCE UPDATE: bottom sheet, no dismiss -----
  if (isForce) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => {}}
      >
        <View style={styles.forceOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            {/* Phone illustration with NEW badge */}
            <View style={styles.illustrationWrap}>
              <Image
                source={CELEBRATION_IMG}
                style={styles.celebrationRight}
                resizeMode="contain"
              />
              <Image
                source={CELEBRATION_IMG}
                style={styles.celebrationLeft}
                resizeMode="contain"
              />
              <Image
                source={MOBILE_IMG}
                style={styles.phoneImage}
                resizeMode="contain"
              />
              <Image
                source={NEW_BADGE_IMG}
                style={styles.newBadgeImage}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.sheetTitle}>App update is required</Text>
            <Text style={styles.sheetMessage}>
              You need to get the new version of the app to use this and the other latest features.
            </Text>

            {data?.latestVersion ? (
              <Text style={styles.sheetVersion}>Version {data.latestVersion}</Text>
            ) : null}

            <Pressable
              onPress={handleUpdate}
              style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, width: '100%' }]}
            >
              <LinearGradient
                colors={['#0F796B', '#4EBD84']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Update the App</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  // ----- MAINTENANCE: centered card, no actions -----
  if (isMaintenance) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {}}
      >
        <View style={styles.softOverlay}>
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <View style={styles.iconCircle}>
                <Text style={styles.iconEmoji}>🛠️</Text>
              </View>
            </View>
            <Text style={styles.cardTitle}>Under Maintenance</Text>
            <Text style={styles.cardSubtitle}>
              We are performing scheduled maintenance to improve your experience.
              Please check back shortly.
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  // ----- SOFT / NORMAL UPDATE: centered card with details -----
  const features = parseFeatures(data?.releaseNotes);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => onDismiss?.()}
    >
      <View style={styles.softOverlay}>
        <View style={styles.card}>
          {/* Rocket icon */}
          <View style={styles.iconWrap}>
            <Image
              source={ROCKET_IMG}
              style={styles.rocketImage}
              resizeMode="cover"
            />
          </View>

          <Text style={styles.cardTitle}>New Update Available</Text>
          <Text style={styles.cardSubtitle}>
            We’ve made some exciting improvements on the Smart Eco! Update now to enjoy the latest features and performance upgrades!
          </Text>

          {/* Build version pill */}
          {(data?.latestVersion || data?.size) && (
            <View style={styles.buildPill}>
              <Text style={styles.buildPillText}>
                {data?.latestVersion ? `Build Version: v${data.latestVersion}` : 'Latest Build'}
                {data?.size ? `  |  Size: ${data.size}` : ''}
              </Text>
            </View>
          )}

          {/* Update details */}
          <View style={styles.detailsBox}>
            <Text style={styles.detailsLabel}>Update Details</Text>
            <ScrollView
              style={styles.detailsScroll}
              showsVerticalScrollIndicator={false}
            >
              {features.map((item, idx) => (
                <View key={idx} style={styles.featureRow}>
                  <View style={styles.checkCircle}>
                    <Text style={styles.checkMark}>✓</Text>
                  </View>
                  <Text style={styles.featureText}>{item}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Update button */}
          <Pressable
            onPress={handleUpdate}
            style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, width: '100%' }]}
          >
            <LinearGradient
              colors={['#0F796B', '#4EBD84']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Update Now</Text>
            </LinearGradient>
          </Pressable>

          {/* Later / Skip */}
          <View style={styles.secondaryActions}>
            <Pressable
              onPress={onDismiss}
              style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={styles.laterText}>Later</Text>
            </Pressable>
            {onSkipVersion ? (
              <>
                <View style={styles.dot} />
                <Pressable
                  onPress={onSkipVersion}
                  style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={styles.skipText}>Skip This Version</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // ---------- Soft / maintenance (centered card) ----------
  softOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 60, 50, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#EAF8F0',
    borderRadius: 24,
    width: '100%',
    maxWidth: 360,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
  },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: '100%',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  // rocketImage: {
  //   width: 76,
  //   height: 76,
  // },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D4F1E0',
  },
  iconEmoji: {
    fontSize: 30,
  },
  cardTitle: {
    fontFamily: FONT,
    fontSize: 20,
    fontWeight: '700',
    color: '#363636',
    textAlign: 'center',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '400',
    color: '#4C5C68',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
    paddingHorizontal: 6,
  },
  buildPill: {
    backgroundColor: '#D4F1E0',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  buildPillText: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F796B',
  },
  detailsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: 20,
  },
  detailsLabel: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '700',
    color: '#0E2A24',
    marginBottom: 12,
  },
  detailsScroll: {
    maxHeight: 170,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 11,
  },
  checkCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#D4F1E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  checkMark: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '900',
    color: '#0F796B',
    lineHeight: 14,
  },
  featureText: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '400',
    color: '#3F514B',
    lineHeight: 19,
  },
  // ---------- Shared primary button ----------
  primaryButton: {
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    width: '100%',
  },
  primaryButtonText: {
    fontFamily: FONT,
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    gap: 12,
  },
  secondaryBtn: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#9BB3AB',
  },
  laterText: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F796B',
  },
  skipText: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '400',
    color: '#8A9C95',
  },
  // ---------- Force update (bottom sheet) ----------
  forceOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 32,
    alignItems: 'center',
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E2E8E5',
    marginBottom: 18,
  },
  illustrationWrap: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  celebrationRight: {
    position: 'absolute',
    top: -15,
    right: -30,
    width: 36,
    height: 36,
  },
  celebrationLeft: {
    position: 'absolute',
    bottom: -15,
    left: -30,
    width: 36,
    height: 36,
  },
  newBadgeImage: {
    position: 'absolute',
    bottom: -10,
    right: -2,
    // width: 36,
    // height: 36
  },
  sheetTitle: {
    fontFamily: FONT,
    fontSize: 20,
    fontWeight: '700',
    color: '#363636',
    textAlign: 'center',
    marginBottom: 10,
  },
  sheetMessage: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '400',
    color: '#4C5C68',
    textAlign: 'center',
    lineHeight: '100%',
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  sheetVersion: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '600',
    color: '#0F796B',
    marginBottom: 18,
  },
});

export default UpdateModal;
