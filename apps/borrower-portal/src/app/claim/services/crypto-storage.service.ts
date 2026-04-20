import { Injectable } from '@angular/core';
import { DisabilityClaimDraft } from '../+state/claim.models';

@Injectable({ providedIn: 'root' })
export class CryptoStorageService {
  private key: CryptoKey | null = null;
  private static readonly STORAGE_KEY = 'bp_draft_enc';
  private static readonly KEY_STORAGE_KEY = 'bp_draft_key';
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly DRAFT_TTL_MS = 30 * 60 * 1000;

  static isAvailable(): boolean {
    return (
      typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined'
    );
  }

  private async getOrCreateKey(): Promise<CryptoKey> {
    if (!this.key) {
      // Try to load existing key from sessionStorage
      const storedKey = sessionStorage.getItem(CryptoStorageService.KEY_STORAGE_KEY);
      if (storedKey) {
        const keyData = JSON.parse(storedKey);
        this.key = await crypto.subtle.importKey(
          'jwk',
          keyData,
          { name: CryptoStorageService.ALGORITHM },
          false,
          ['encrypt', 'decrypt'],
        );
      } else {
        // Generate new key and persist it
        this.key = await crypto.subtle.generateKey(
          { name: CryptoStorageService.ALGORITHM, length: 256 },
          true, // extractable: true so we can export/import
          ['encrypt', 'decrypt'],
        );
        const exportedKey = await crypto.subtle.exportKey('jwk', this.key);
        sessionStorage.setItem(
          CryptoStorageService.KEY_STORAGE_KEY,
          JSON.stringify(exportedKey),
        );
      }
    }
    return this.key;
  }

  async save(state: DisabilityClaimDraft): Promise<void> {
    const key = await this.getOrCreateKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(state));
    const ciphertext = await crypto.subtle.encrypt(
      { name: CryptoStorageService.ALGORITHM, iv },
      key,
      plaintext,
    );
    const payload = {
      iv: this.toBase64(iv),
      data: this.toBase64(new Uint8Array(ciphertext)),
      ts: Date.now(),
    };
    sessionStorage.setItem(
      CryptoStorageService.STORAGE_KEY,
      JSON.stringify(payload),
    );
  }

  async load(): Promise<DisabilityClaimDraft | null> {
    const raw = sessionStorage.getItem(CryptoStorageService.STORAGE_KEY);
    if (!raw) return null;

    try {
      const key = await this.getOrCreateKey();
      const { iv, data, ts } = JSON.parse(raw);

      if (
        typeof ts === 'number' &&
        Date.now() - ts > CryptoStorageService.DRAFT_TTL_MS
      ) {
        sessionStorage.removeItem(CryptoStorageService.STORAGE_KEY);
        return null;
      }

      const decrypted = await crypto.subtle.decrypt(
        { name: CryptoStorageService.ALGORITHM, iv: this.fromBase64(iv) as BufferSource },
        key,
        this.fromBase64(data) as BufferSource,
      );
      const parsed = JSON.parse(new TextDecoder().decode(decrypted));
      if (typeof parsed.currentStep !== 'number') return null;
      return parsed as DisabilityClaimDraft;
    } catch {
      sessionStorage.removeItem(CryptoStorageService.STORAGE_KEY);
      return null;
    }
  }

  clear(): void {
    sessionStorage.removeItem(CryptoStorageService.STORAGE_KEY);
  }

  private toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private fromBase64(str: string): Uint8Array {
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}
