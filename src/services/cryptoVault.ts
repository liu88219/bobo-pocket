import LZString from 'lz-string';

export interface DerivedVaultIdentity {
  passHashHex: string;
  vaultKey: string;
  imgKeyPrefix: string;
  sseTopic: string;
  fingerprintBadge: string;
}

const FINGERPRINT_EMOJIS = ['🧸', '🥐', '☕', '📍', '🍡', '🌿', '🍰', '🗺️'];

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x2000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    parts.push(String.fromCharCode(...slice));
  }
  return btoa(parts.join(''));
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function normalizePasscode(raw: string): string {
  return raw.trim();
}

/**
 * 產生 iOS 鍵盤常見大小寫／全半形自動修正候選組（僅於精確通行碼在雲端查無紀錄時作為自動救援比對！）
 */
export function getPasscodeFallbackVariants(raw: string): string[] {
  const exact = normalizePasscode(raw);
  if (!exact) return [];
  const nfkc = exact.normalize('NFKC').trim();
  const toggledFirst =
    nfkc.length > 0
      ? (nfkc[0] === nfkc[0].toLowerCase() ? nfkc[0].toUpperCase() : nfkc[0].toLowerCase()) +
        nfkc.slice(1)
      : nfkc;
  const lower = nfkc.toLowerCase();
  const capFirst = lower.length > 0 ? lower[0].toUpperCase() + lower.slice(1) : lower;
  return Array.from(new Set([exact, nfkc, toggledFirst, lower, capFirst].filter(Boolean)));
}

/**
 * 確定性衍生跨瀏覽器一致的雲端鍵值（Safari ↔ iPhone 加入主畫面 ↔ LINE 內建瀏覽器輸入同一通行碼必對齊同一通道）
 */
export async function deriveVaultIdentity(passcode: string): Promise<DerivedVaultIdentity> {
  const normalized = normalizePasscode(passcode);
  if (!normalized) {
    throw new Error('請輸入通行碼');
  }
  const enc = new TextEncoder();
  const hashBuf = await crypto.subtle.digest(
    'SHA-256',
    enc.encode(`bobo_pocket_vault_v1:${normalized}`)
  );
  const bytes = new Uint8Array(hashBuf);
  const fullHex = bytesToHex(bytes);
  const keySlice = fullHex.slice(0, 32);
  const sseSlice = fullHex.slice(32, 56);
  const fpA = FINGERPRINT_EMOJIS[bytes[28] % FINGERPRINT_EMOJIS.length];
  const fpB = FINGERPRINT_EMOJIS[bytes[29] % FINGERPRINT_EMOJIS.length];
  const fpCode = fullHex.slice(60, 64).toUpperCase();
  return {
    passHashHex: fullHex,
    vaultKey: `bobopocket_perm_v1_${keySlice}`,
    imgKeyPrefix: `bobopocket_img_v1_${fullHex.slice(0, 20)}`,
    sseTopic: `bobopocket_sse_v1_${sseSlice}`,
    fingerprintBadge: `${fpA}${fpB} #${fpCode}`,
  };
}

async function deriveAesKey(passcode: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(`bobo_pocket_aes_v1:${normalizePasscode(passcode)}`),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 60000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * BC2 高壓縮二進位加密信封：
 * 先以 LZString.compressToUint8Array 壓縮為緊湊二進位（比舊版 UTF16→UTF8 雙重 Base64 縮小約 5 倍！），
 * 再以 PBKDF2 + AES-GCM 加密並封裝為單層 Base64 `BC2:<salt16|iv12|cipher>`
 */
export async function encryptVaultPayload(plainJson: string, passcode: string): Promise<string> {
  const compressedBytes = LZString.compressToUint8Array(plainJson);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await deriveAesKey(passcode, salt);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    compressedBytes as BufferSource
  );
  const cipherBytes = new Uint8Array(cipherBuf);
  const packed = new Uint8Array(16 + 12 + cipherBytes.length);
  packed.set(salt, 0);
  packed.set(iv, 16);
  packed.set(cipherBytes, 28);
  return `BC2:${bytesToBase64(packed)}`;
}

/**
 * 無損向下相容解密：同時支援新版 `BC2:` 緊湊二進位密文與舊版 `BC1:` JSON 信封密文！
 */
export async function decryptVaultPayload(payload: string, passcode: string): Promise<string> {
  const trimmed = payload.trim();
  if (trimmed.startsWith('BC2:')) {
    const packed = base64ToBytes(trimmed.slice(4));
    if (packed.length < 29) {
      throw new Error('無效的 BC2 雲端密文長度');
    }
    const salt = packed.slice(0, 16);
    const iv = packed.slice(16, 28);
    const cipherBytes = packed.slice(28);
    const aesKey = await deriveAesKey(passcode, salt);
    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      aesKey,
      cipherBytes as BufferSource
    );
    const decompressed = LZString.decompressFromUint8Array(new Uint8Array(plainBuf));
    if (!decompressed) {
      throw new Error('解壓縮 BC2 雲端資料失敗');
    }
    return decompressed;
  }

  if (trimmed.startsWith('BC1:')) {
    const envelopeJson = atob(trimmed.slice(4));
    const envelope = JSON.parse(envelopeJson) as { v: number; s: string; i: string; c: string };
    const salt = base64ToBytes(envelope.s);
    const iv = base64ToBytes(envelope.i);
    const cipherBytes = base64ToBytes(envelope.c);
    const aesKey = await deriveAesKey(passcode, salt);
    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      aesKey,
      cipherBytes as BufferSource
    );
    const dec = new TextDecoder();
    const compressed = dec.decode(plainBuf);
    const decompressed = LZString.decompressFromUTF16(compressed);
    if (!decompressed) {
      throw new Error('解壓縮 BC1 雲端資料失敗');
    }
    return decompressed;
  }

  throw new Error('無效的雲端加密格式');
}
