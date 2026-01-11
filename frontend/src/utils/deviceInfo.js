/**
 * Device Information Utility for Web
 * Generates unique device identifiers and retrieves device information
 */

// Storage key for persistent device ID
const DEVICE_ID_KEY = 'finx_device_id';

/**
 * Generate a UUID v4-like string
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get or create a unique device identifier
 * Persisted in localStorage to survive page refreshes
 */
function getOrCreateDeviceId() {
  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    
    if (deviceId) {
      return deviceId;
    }
    
    // Generate a new device ID
    deviceId = `web-${generateUUID()}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    return deviceId;
  } catch (error) {
    // localStorage might be unavailable (private browsing, etc.)
    console.error('[DeviceInfo] Error getting device ID:', error);
    return `web-temp-${Date.now()}`;
  }
}

/**
 * Get a human-readable device name from the user agent
 */
function getDeviceName() {
  const ua = navigator.userAgent;
  
  // Try to identify the browser
  let browser = 'Browser';
  if (ua.includes('Firefox')) {
    browser = 'Firefox';
  } else if (ua.includes('Edg/')) {
    browser = 'Edge';
  } else if (ua.includes('Chrome')) {
    browser = 'Chrome';
  } else if (ua.includes('Safari')) {
    browser = 'Safari';
  } else if (ua.includes('Opera') || ua.includes('OPR')) {
    browser = 'Opera';
  }
  
  // Try to identify the OS
  let os = 'Unknown';
  if (ua.includes('Windows')) {
    os = 'Windows';
  } else if (ua.includes('Mac OS')) {
    os = 'macOS';
  } else if (ua.includes('Linux')) {
    os = 'Linux';
  } else if (ua.includes('Android')) {
    os = 'Android';
  } else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) {
    os = 'iOS';
  }
  
  return `${browser} on ${os}`;
}

/**
 * Get the device type
 */
function getDeviceType() {
  return 'web';
}

/**
 * Get complete device information for authentication requests
 */
export function getDeviceInfo() {
  return {
    deviceId: getOrCreateDeviceId(),
    deviceName: getDeviceName(),
    deviceType: getDeviceType(),
  };
}

export default {
  getDeviceInfo,
  getOrCreateDeviceId,
  getDeviceName,
  getDeviceType,
};
