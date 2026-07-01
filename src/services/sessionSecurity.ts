/**
 * Web Crypto API Session Security Utilities
 * Provides client-side hashing, HMAC signing of session states,
 * and key management using non-extractable keys in IndexedDB.
 */

import localforage from 'localforage';

const KEY_STORE_KEY = 'meridian_session_crypto_key';

export interface SessionPayload {
  email: string;
  role: 'employee' | 'admin';
  timestamp: number;
  expiry: number;
}

export interface SecureSession {
  payload: SessionPayload;
  signature: string; // Hex representation of the HMAC signature
}

/**
 * Generates or retrieves a secure CryptoKey for HMAC-SHA256.
 * Marked as extractable: false to prevent browser console access.
 */
export async function getOrCreateSessionKey(): Promise<CryptoKey> {
  try {
    const savedKey = await localforage.getItem<CryptoKey>(KEY_STORE_KEY);
    if (savedKey) {
      return savedKey;
    }
  } catch (e) {
    console.warn('Failed to retrieve session key from storage, generating a new one...', e);
  }

  const key = await crypto.subtle.generateKey(
    {
      name: 'HMAC',
      hash: { name: 'SHA-256' },
    },
    false, // extractable: false
    ['sign', 'verify']
  );

  try {
    await localforage.setItem(KEY_STORE_KEY, key);
  } catch (e) {
    console.error('Failed to store session key in IndexedDB:', e);
  }

  return key;
}

/**
 * Generates an HMAC-SHA256 signature for a session payload.
 */
export async function signSession(payload: SessionPayload): Promise<SecureSession> {
  const key = await getOrCreateSessionKey();
  const encoder = new TextEncoder();
  const serialized = JSON.stringify(payload);
  const data = encoder.encode(serialized);
  
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    data
  );

  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const signature = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    payload,
    signature,
  };
}

/**
 * Validates the session signature and expiration.
 */
export async function verifySession(secureSession: SecureSession): Promise<boolean> {
  try {
    const key = await getOrCreateSessionKey();
    const encoder = new TextEncoder();
    const serialized = JSON.stringify(secureSession.payload);
    const data = encoder.encode(serialized);

    const sigHex = secureSession.signature;
    if (!sigHex || typeof sigHex !== 'string') {
      return false;
    }
    const matches = sigHex.match(/.{1,2}/g);
    if (!matches) {
      return false;
    }
    const sigBytes = new Uint8Array(matches.map(byte => parseInt(byte, 16)));

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      data
    );

    if (!isValid) return false;

    const now = Date.now();
    if (now > secureSession.payload.expiry) {
      console.warn('Session has expired');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Session verification error:', error);
    return false;
  }
}

/**
 * Freezes the session object to prevent runtime modification.
 */
export function freezeSession<T extends object>(sessionObj: T): T {
  return Object.freeze(sessionObj);
}
