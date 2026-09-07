import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const UpdateModal = ({ visible, data, onDismiss, onUpdate }) => {

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
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
            <Text style={styles.title}>New version available</Text>

            {/* Version badge */}
            {data?.latestVersion && (
              <View style={styles.versionRow}>
                <View style={styles.versionBadgeCurrent}>
                  <Text style={styles.versionBadgeCurrentText}>Current version: {data.currentVersion}</Text>
                </View>
                <View style={styles.arrow}>
                  <Text style={styles.arrowText}>→</Text>
                </View>
                <View style={styles.versionBadgeNew}>
                  <Text style={styles.versionBadgeNewText}>Latest version: {data.latestVersion}</Text>
                </View>
              </View>
            )}

            {/* Message */}
            <Text style={styles.message}>
              A new version of SmartEco Enterprise is available. Please update to get the latest features and improvements.
            </Text>

            <View style={styles.secondaryActions}>
              <Pressable
                onPress={onDismiss}
                style={({ pressed }) => [styles.actionButton, styles.secondaryBtn, { opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={styles.remindText}>Exit</Text>
              </Pressable>

              <Pressable
                onPress={onUpdate}
                style={({ pressed }) => [styles.actionButton, styles.updateAction, { opacity: pressed ? 0.9 : 1 }]}
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
            </View>
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
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
    width: '100%',
  },
  actionButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  secondaryBtn: {
    flex: 0.5,
    borderColor: '#B7DED3',
    backgroundColor: '#F0FAF7',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },
  remindText: {
    fontSize: 14,
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
