import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

const AppUpdateModal = ({
  visible,
  currentVersion,
  latestVersion,
  onUpdate,
  onExit,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onExit}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.accentBar} />

          <View style={styles.content}>
          <Text style={styles.title}>New Version Available</Text>

          <View style={styles.versionRow}>
            <View style={styles.currentVersionBadge}>
              <Text style={styles.currentVersionText}>Current version: {currentVersion}</Text>
            </View>
            <Text style={styles.arrow}>→</Text>
            <View style={styles.latestVersionBadge}>
              <Text style={styles.latestVersionText}>Latest version: {latestVersion}</Text>
            </View>
          </View>

          <Text style={styles.message}>
            A new version of SmartEco Enterprise is available. Please update to get the latest features and improvements.
          </Text>


          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={onExit}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>Later</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={onUpdate}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Update Now</Text>
            </TouchableOpacity>
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
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 26,
    overflow: 'hidden',
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
  },
  accentBar: {
    height: 7,
    width: '100%',
    backgroundColor: '#0F796B',
  },
  content: {
    paddingTop: 28,
    paddingBottom: 25,
    paddingHorizontal: 26,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 15,
  },
  message: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 24,
  },
  versionRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginBottom: 20,
  },
  currentVersionBadge: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 13,
    alignItems: 'center',
  },
  currentVersionText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  arrow: {
    fontSize: 20,
    color: '#9CA3AF',
  },
  latestVersionBadge: {
    flex: 1,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 13,
    alignItems: 'center',
  },
  latestVersionText: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#0F796B',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#EFFAF7',
  },
  secondaryButtonText: {
    color: '#147D6D',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default AppUpdateModal;
