import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Linking,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import DeviceInfo from 'react-native-device-info';

const UpdateModal = ({ visible, type, data, onDismiss, onSkipVersion }) => {
  const isForce = type === 'force';
  const isMaintenance = type === 'maintenance';

  const handleUpdate = () => {
    const url = data?.storeUrl || 'https://play.google.com/store/apps/details?id=com.smarteco.app';
    Linking.openURL(url).catch(() => {
      Linking.openURL('https://play.google.com/store');
    });
  };

  const title = isMaintenance
    ? 'Under Maintenance'
    : isForce
      ? 'Update Required'
      : 'Update Available';

  const message = isMaintenance
    ? 'We are performing scheduled maintenance to improve your experience. Please check back shortly.'
    : isForce
      ? 'This version is no longer supported.\nPlease update to continue using SmartEco Enterprise.'
      : 'A newer version of SmartEco Enterprise is available.\nUpdate now for the best experience.';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (isForce || isMaintenance) return;
        onDismiss?.();
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Top accent bar */}
          <LinearGradient
            colors={['#0F796B', '#6FDC95']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.accentBar}
          />

          <View style={styles.content}>
            {/* Title */}
            <Text style={styles.title}>{title}</Text>

            {/* Version badge */}
            {!isMaintenance && data?.latestVersion && (
              <View style={styles.versionRow}>
                <View style={styles.versionBadgeCurrent}>
                  <Text style={styles.versionBadgeCurrentText}>Current: v{DeviceInfo.getVersion()}</Text>
                </View>
                <View style={styles.arrow}>
                  <Text style={styles.arrowText}>→</Text>
                </View>
                <View style={styles.versionBadgeNew}>
                  <Text style={styles.versionBadgeNewText}>v{data.latestVersion}</Text>
                </View>
              </View>
            )}

            {/* Message */}
            <Text style={styles.message}>{message}</Text>

            {/* Release notes */}
            {data?.releaseNotes && !isMaintenance && (
              <View style={styles.releaseNotesContainer}>
                <Text style={styles.releaseNotesLabel}>What's New</Text>
                <Text style={styles.releaseNotesText}>{data.releaseNotes}</Text>
              </View>
            )}

            {/* Update button */}
            {!isMaintenance && (
              <Pressable
                onPress={handleUpdate}
                style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, width: '100%' }]}
              >
                <LinearGradient
                  colors={['#0F796B', '#4EBD84']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.updateButton}
                >
                  <Text style={styles.updateButtonText}>Update Now</Text>
                </LinearGradient>
              </Pressable>
            )}

            {/* Secondary actions — soft update only */}
            {!isForce && !isMaintenance && (
              <View style={styles.secondaryActions}>
                <Pressable
                  onPress={onDismiss}
                  style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={styles.remindText}>Later</Text>
                </Pressable>

                <View style={styles.dot} />

                <Pressable
                  onPress={onSkipVersion}
                  style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={styles.skipText}>Skip This Version</Text>
                </Pressable>
              </View>
            )}

            {/* Force update subtle text */}
            {isForce && (
              <Text style={styles.forceHint}>This update is required to continue</Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 360,
    overflow: 'hidden',
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
  },
  accentBar: {
    height: 4,
    width: '100%',
  },
  content: {
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 14,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  versionBadgeCurrent: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  versionBadgeCurrentText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  arrow: {
    paddingHorizontal: 2,
  },
  arrowText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  versionBadgeNew: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  versionBadgeNewText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  message: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  releaseNotesContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 14,
    marginBottom: 22,
    width: '100%',
    borderLeftWidth: 3,
    borderLeftColor: '#0F796B',
  },
  releaseNotesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  releaseNotesText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B7280',
    lineHeight: 20,
  },
  updateButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
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
    backgroundColor: '#D1D5DB',
  },
  remindText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#0F796B',
  },
  skipText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#9CA3AF',
  },
  forceHint: {
    fontSize: 11,
    fontWeight: '400',
    color: '#9CA3AF',
    marginTop: 14,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});

export default UpdateModal;
