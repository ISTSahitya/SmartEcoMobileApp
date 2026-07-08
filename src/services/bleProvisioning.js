/* eslint-disable no-bitwise */
/**
 * BLE device-provisioning service (Android).
 *
 * Replaces the old WiFi-hotspot (IAQ_ AP + POST http://192.168.4.1/wifi) flow.
 * The device's C6 (ESP-AT) advertises a GATT server named "IAQ_<id>"; this module
 * (the GATT central) connects, writes the SAME config JSON the app used to POST,
 * and reads the result back from a notify characteristic.
 *
 * Contract — MUST match the firmware (P4 wifi_manager.c) and the C6 ESP-AT GATT
 * service table. These are the ESP-AT default GATTS demo UUIDs; confirm against the
 * actual C6 build (the firmware logs AT+BLEGATTSCHAR? at startup):
 *   service 0xA002, write char 0xC301 (phone -> device), notify char 0xC302 (device -> phone)
 *
 * Framing: write the ASCII header "LEN:<n>\n" (n = JSON byte length), then the JSON
 * body in MTU-sized chunks. The device notifies:
 *   {"success":bool,"internetAvailable":bool,"message":string}
 */
import { BleManager } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform, Alert, Linking } from 'react-native';

export const BLE_NAME_PREFIX = 'IAQ_';
// Service UUID advertised by the device, used only as a scan filter. The actual
// write/notify characteristics are discovered by PROPERTY after connecting, so we
// never depend on exact characteristic UUIDs (which vary by the C6 gatts_data.csv).
const SERVICE_UUID = '0000a002-0000-1000-8000-00805f9b34fb';

const REQUEST_MTU = 517;
const DEFAULT_CHUNK = 180; // safe payload if MTU negotiation is unavailable/low
const CONNECT_TIMEOUT_MS = 15000;
const RESULT_TIMEOUT_MS = 40000; // device tests WiFi (AT+CWJAP ~20s) before notifying

let manager = null;

const getManager = () => {
  if (!manager) {
    manager = new BleManager();
  }
  return manager;
};

/* -------------------- base64 helpers (Hermes has no Buffer/btoa) -------------------- */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const bytesToBase64 = bytes => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? B64[b2 & 63] : '=';
  }
  return out;
};

const base64ToString = b64 => {
  const clean = (b64 || '').replace(/[^A-Za-z0-9+/=]/g, '');
  const bytes = [];
  for (let i = 0; i < clean.length; i += 4) {
    const e0 = B64.indexOf(clean[i]);
    const e1 = B64.indexOf(clean[i + 1]);
    const e2 = B64.indexOf(clean[i + 2]);
    const e3 = B64.indexOf(clean[i + 3]);
    bytes.push((e0 << 2) | (e1 >> 4));
    if (clean[i + 2] !== '=' && e2 >= 0) bytes.push(((e1 & 15) << 4) | (e2 >> 2));
    if (clean[i + 3] !== '=' && e3 >= 0) bytes.push(((e2 & 3) << 6) | e3);
  }
  // UTF-8 decode
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i];
    if (c < 0x80) {
      str += String.fromCharCode(c);
    } else if (c < 0xe0) {
      str += String.fromCharCode(((c & 0x1f) << 6) | (bytes[++i] & 0x3f));
    } else {
      str += String.fromCharCode(
        ((c & 0x0f) << 12) | ((bytes[++i] & 0x3f) << 6) | (bytes[++i] & 0x3f),
      );
    }
  }
  return str;
};

const utf8Bytes = str => {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return bytes;
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/* -------------------- permissions -------------------- */
export const ensureBlePermissions = async () => {
  if (Platform.OS !== 'android') return true;

  const sdk = Platform.Version; // API level (number) on Android
  const perms =
    sdk >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

  const granted = await PermissionsAndroid.requestMultiple(perms);
  return Object.values(granted).every(
    v => v === PermissionsAndroid.RESULTS.GRANTED,
  );
};

/**
 * Ensure the phone's Bluetooth radio is on. If it's off, show the system
 * "turn on Bluetooth?" popup (Android) and wait until it powers on.
 * @returns {Promise<boolean>} true once Bluetooth is PoweredOn
 */
export const ensureBluetoothOn = async () => {
  const mgr = getManager();

  // The initial state() can be 'Unknown'/'Resetting' before the adapter reports.
  // onStateChange(…, true) emits the current state immediately; guard with a
  // timeout so a stuck adapter never blocks the flow forever.
  const settledState = () =>
    new Promise(resolve => {
      let done = false;
      const finish = s => {
        if (done) return;
        done = true;
        try {
          sub.remove();
        } catch (_) {}
        resolve(s);
      };
      const sub = mgr.onStateChange(s => {
        if (
          s === 'PoweredOn' ||
          s === 'PoweredOff' ||
          s === 'Unsupported' ||
          s === 'Unauthorized'
        ) {
          finish(s);
        }
      }, true);
      setTimeout(() => finish('Unknown'), 4000);
    });

  let state = await settledState();
  if (state === 'PoweredOn') return true;
  if (state === 'Unsupported') return false;

  // iOS reports 'Unauthorized' when the user denied the app's Bluetooth
  // permission (distinct from the radio being off). Guide them to Settings
  // where the app's Bluetooth toggle lives — enabling the radio won't help.
  if (state === 'Unauthorized') {
    await new Promise(resolve => {
      Alert.alert(
        'Allow Bluetooth',
        'Please allow Bluetooth access for SmartEco Enterprise in Settings to set up your device.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
          {
            text: 'Open Settings',
            onPress: () => {
              Linking.openSettings();
              resolve();
            },
          },
        ],
        { cancelable: true, onDismiss: () => resolve() },
      );
    });
    return (await mgr.state()) === 'PoweredOn';
  }

  // Try a one-tap programmatic enable (works on Android < 13). Race a timeout so a
  // hanging/unsupported enable() (Android 13+) can never block "Searching…".
  if (Platform.OS === 'android') {
    try {
      await Promise.race([
        mgr.enable(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('enable timeout')), 4000),
        ),
      ]);
    } catch (_) {
      // Unsupported on this Android version, declined, or timed out — fall through.
    }
    for (let i = 0; i < 6; i++) {
      if ((await mgr.state()) === 'PoweredOn') return true;
      await delay(400);
    }
  }

  // Still off → show a popup guiding the user to enable Bluetooth via settings.
  await new Promise(resolve => {
    Alert.alert(
      'Turn on Bluetooth',
      'Bluetooth is required to set up your device. Please turn it on, then try again.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
        {
          text: 'Open Settings',
          onPress: () => {
            if (Platform.OS === 'android') {
              Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS').catch(
                () => Linking.openSettings(),
              );
            } else {
              Linking.openURL('App-Prefs:Bluetooth').catch(() =>
                Linking.openSettings(),
              );
            }
            resolve();
          },
        },
      ],
      { cancelable: true, onDismiss: () => resolve() },
    );
  });

  return (await mgr.state()) === 'PoweredOn';
};

/* -------------------- scan -------------------- */
/**
 * Scan for devices advertising the IAQ_ name prefix.
 * @returns {Promise<Array<{id,name,rssi}>>}
 */
export const scanForDevices = async ({ timeoutMs = 8000 } = {}) => {
  const ok = await ensureBlePermissions();
  if (!ok) {
    throw new Error('Bluetooth permission denied');
  }

  const on = await ensureBluetoothOn();
  if (!on) {
    throw new Error('Please turn on Bluetooth and try again');
  }

  const mgr = getManager();
  const found = new Map();

  // Android: filter natively by the advertised service UUID — reliable and
  // battery-friendly, and proven working. iOS: Core Bluetooth only surfaces a
  // peripheral when the filtered UUID is actually present in the (short)
  // advertising packet; many ESP-AT builds advertise only the "IAQ_" name and
  // expose the service UUID solely in the GATT table, so a UUID-filtered scan
  // returns nothing on iOS. Scan unfiltered on iOS and match in JS by name
  // prefix or (when present) the advertised service UUID.
  const isIOS = Platform.OS === 'ios';
  const scanFilter = isIOS ? null : [SERVICE_UUID];

  const matchesTarget = device => {
    if (!isIOS) return true; // native UUID filter already applied on Android
    const name = device.name || device.localName || '';
    if (name.toUpperCase().startsWith(BLE_NAME_PREFIX)) return true;
    const advertised = device.serviceUUIDs || [];
    return advertised.some(u => (u || '').toLowerCase() === SERVICE_UUID);
  };

  return new Promise((resolve, reject) => {
    mgr.startDeviceScan(
      scanFilter,
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          mgr.stopDeviceScan();
          reject(error);
          return;
        }
        if (device && matchesTarget(device) && !found.has(device.id)) {
          found.set(device.id, {
            id: device.id,
            name: device.name || device.localName || null,
            rssi: device.rssi,
          });
        }
      },
    );

    setTimeout(() => {
      mgr.stopDeviceScan();
      resolve(Array.from(found.values()));
    }, timeoutMs);
  });
};

/* -------------------- connect -------------------- */
let connectedDevice = null;
let writeChar = null; // discovered writable characteristic (config in)
let notifyChar = null; // discovered notifiable characteristic (result out)
let sendInProgress = false; // guards against concurrent/duplicate sends

export const connectToDevice = async deviceId => {
  const mgr = getManager();
  let device = await mgr.connectToDevice(deviceId, {
    timeout: CONNECT_TIMEOUT_MS,
  });
  await device.discoverAllServicesAndCharacteristics();
  try {
    device = await device.requestMTU(REQUEST_MTU);
  } catch (e) {
    // Some stacks reject explicit MTU; continue with the default chunk size.
    console.log('requestMTU failed, using default chunk size', e?.message);
  }

  // Discover the config/result characteristics by PROPERTY, not by UUID: find the
  // service that has both a writable and a notifiable characteristic. This is immune
  // to whatever UUIDs/indices the C6 gatts_data.csv uses. We must SKIP the standard
  // GAP/GATT services (0x1800/0x1801) — 0x1801 has a writable (0x2B29) and an
  // indicatable (0x2A05) char that would otherwise match — and prefer the advertised
  // service UUID.
  writeChar = null;
  notifyChar = null;
  const isStandardService = uuid => {
    const u = (uuid || '').toLowerCase();
    return (
      u.startsWith('00001800-') ||
      u.startsWith('00001801-') ||
      u.startsWith('00001805-')
    );
  };
  const services = await device.services();
  // Prefer the advertised SERVICE_UUID, then any other non-standard service.
  const ordered = [...services].sort(
    (a, b) =>
      (b.uuid.toLowerCase() === SERVICE_UUID ? 1 : 0) -
      (a.uuid.toLowerCase() === SERVICE_UUID ? 1 : 0),
  );
  for (const svc of ordered) {
    if (isStandardService(svc.uuid)) continue;
    const chars = await svc.characteristics();
    const w = chars.find(
      c => c.isWritableWithResponse || c.isWritableWithoutResponse,
    );
    const n = chars.find(c => c.isNotifiable || c.isIndicatable);
    if (w && n) {
      writeChar = w;
      notifyChar = n;
      break;
    }
  }

  if (!writeChar || !notifyChar) {
    await disconnectDevice();
    throw new Error('Device is missing the required Bluetooth characteristics');
  }

  connectedDevice = device;
  return { id: device.id, name: device.name, mtu: device.mtu };
};

export const disconnectDevice = async () => {
  try {
    if (connectedDevice) {
      await getManager().cancelDeviceConnection(connectedDevice.id);
    }
  } catch (e) {
    console.log('disconnect error', e?.message);
  } finally {
    connectedDevice = null;
    writeChar = null;
    notifyChar = null;
  }
};

/* -------------------- send config + await result -------------------- */
/**
 * Write the config payload over BLE and resolve with the device's notify result.
 * @param {object} payload  Same object the app used to POST to /wifi
 * @returns {Promise<{success:boolean, internetAvailable?:boolean, message?:string}>}
 */
export const sendConfig = async payload => {
  if (!connectedDevice || !writeChar || !notifyChar) {
    return { success: false, message: 'No BLE device connected' };
  }
  // Reject a second send while one is already running. Two concurrent sends
  // interleave their BLE writes and arrive at the device as corrupted/duplicated
  // chunks (e.g. "LEN:" header twice) → the firmware can't reassemble the JSON.
  if (sendInProgress) {
    return { success: false, message: 'A configuration is already in progress' };
  }
  sendInProgress = true;

  const device = connectedDevice;
  const json = JSON.stringify(payload);
  const body = utf8Bytes(json);

  const chunkSize = device.mtu ? Math.min(device.mtu - 3, 512) : DEFAULT_CHUNK;
  const useWriteResponse = writeChar.isWritableWithResponse;

  return new Promise((resolve) => {
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      sendInProgress = false;
      try {
        subscription?.remove();
      } catch (_) {}
      clearTimeout(timer);
      resolve(result);
    };

    // 1. Subscribe to the discovered notify/indicate characteristic for the result.
    const subscription = notifyChar.monitor((error, characteristic) => {
      if (error) {
        // iOS/Android cancellation fires here on disconnect; ignore if settled.
        if (!settled) {
          finish({ success: false, message: error.message });
        }
        return;
      }
      try {
        const text = base64ToString(characteristic?.value);
        const parsed = JSON.parse(text);
        finish({
          success: !!parsed.success,
          internetAvailable: parsed.internetAvailable,
          message: parsed.message,
        });
      } catch (e) {
        // Partial/garbled notification — wait for a complete one or timeout.
      }
    });

    const timer = setTimeout(() => {
      finish({
        success: false,
        message:
          'Device did not respond within the timeout period. Please check the connection.',
      });
    }, RESULT_TIMEOUT_MS);

    const writeChunk = async b64 => {
      if (useWriteResponse) {
        await writeChar.writeWithResponse(b64);
      } else {
        await writeChar.writeWithoutResponse(b64);
      }
    };

    // 2. Write the LEN header, then the JSON body in chunks. Run sequentially in
    // an inner async fn so the Promise executor itself stays synchronous.
    const writeAll = async () => {
      const header = `LEN:${body.length}\n`;
      await writeChunk(bytesToBase64(utf8Bytes(header)));

      for (let off = 0; off < body.length; off += chunkSize) {
        const chunk = body.slice(off, off + chunkSize);
        await writeChunk(bytesToBase64(chunk));
        await delay(20); // small gap so the C6 can drain each +WRITE over UART
      }
    };

    writeAll().catch(e =>
      finish({ success: false, message: e?.message || 'Failed to send config' }),
    );
  });
};
