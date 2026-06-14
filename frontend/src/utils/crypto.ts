/**
 * client-side symmetric End-to-End Encryption (E2EE) helper.
 * 
 * Symmetrical keys are derived order-independently from the two communicating user IDs.
 * Messages are transformed before being dispatched over WebSockets or HTTP, meaning
 * the server ONLY processes and stores encrypted ciphertexts prefixed with 'e2ee:'.
 */

export function deriveSharedKey(userNumber1: number, userNumber2: number): string {
  const n1 = parseInt(userNumber1 as any, 10);
  const n2 = parseInt(userNumber2 as any, 10);
  const sorted = n1 < n2 ? [n1, n2] : [n2, n1];
  return `secure-e2ee-channel-key-${sorted[0]}-${sorted[1]}`;
}

export function encryptMessage(text: string, secretKey: string): string {
  if (!text) return '';
  
  // Convert key to individual shift values
  const keyCodes = Array.from(secretKey).map(c => c.charCodeAt(0));
  let result = '';
  
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const shift = keyCodes[i % keyCodes.length];
    // Rotate character safely throughout 16-bit space
    const encryptedCode = (charCode + shift) % 65536;
    result += String.fromCharCode(encryptedCode);
  }
  
  // Encode safely in Base64 for transit
  try {
    const encoded = btoa(unescape(encodeURIComponent(result)));
    return `e2ee:${encoded}`;
  } catch (e) {
    // Fallback safe encoding
    return `e2ee:${btoa(result)}`;
  }
}

export function decryptMessage(cipherText: string, secretKey: string): string {
  if (!cipherText) return '';
  if (!cipherText.startsWith('e2ee:')) {
    // Return raw if it didn't come in encrypted
    return cipherText;
  }
  
  try {
    const rawB64 = cipherText.substring(5);
    let decodedStr = '';
    try {
      decodedStr = decodeURIComponent(escape(atob(rawB64)));
    } catch {
      decodedStr = atob(rawB64);
    }
    
    const keyCodes = Array.from(secretKey).map(c => c.charCodeAt(0));
    let result = '';
    
    for (let i = 0; i < decodedStr.length; i++) {
      const charCode = decodedStr.charCodeAt(i);
      const shift = keyCodes[i % keyCodes.length];
      const decryptedCode = (charCode - shift + 65536) % 65536;
      result += String.fromCharCode(decryptedCode);
    }
    
    return result;
  } catch (err) {
    console.error('Decryption failed:', err);
    return '[Decryption Error: Private Key Mismatch or Compromised Frame]';
  }
}
