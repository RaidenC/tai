import { CryptoStorageService } from './crypto-storage.service';
import { DisabilityClaimDraft, initialClaimState } from '../+state/claim.models';
import * as fc from 'fast-check';

describe('CryptoStorageService', () => {
  let service: CryptoStorageService;

  const testState: DisabilityClaimDraft = {
    ...initialClaimState,
    currentStep: 2,
    borrower: {
      firstName: 'Jane',
      lastName: 'Doe',
      ssnLastFour: '',
      phone: '5551234567',
      email: 'jane@example.com',
    },
  };

  beforeEach(() => {
    sessionStorage.clear();
    service = new CryptoStorageService();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('save/load round-trip preserves state', async () => {
    await service.save(testState);
    const loaded = await service.load();
    expect(loaded).toEqual(testState);
  });

  it('save writes to sessionStorage', async () => {
    await service.save(testState);
    expect(sessionStorage.getItem('bp_draft_enc')).not.toBeNull();
  });

  it('stored value is not plaintext JSON', async () => {
    await service.save(testState);
    const raw = sessionStorage.getItem('bp_draft_enc')!;
    expect(raw).not.toContain('Jane');
    expect(raw).not.toContain('Doe');
  });

  it('stored value contains iv, data, and ts fields', async () => {
    await service.save(testState);
    const raw = sessionStorage.getItem('bp_draft_enc')!;
    const parsed = JSON.parse(raw);
    expect(typeof parsed.iv).toBe('string');
    expect(typeof parsed.data).toBe('string');
    expect(typeof parsed.ts).toBe('number');
  });

  it('load returns null when sessionStorage is empty', async () => {
    const result = await service.load();
    expect(result).toBeNull();
  });

  it('load returns null after key loss (new instance)', async () => {
    await service.save(testState);
    const newService = new CryptoStorageService();
    const result = await newService.load();
    expect(result).toBeNull();
  });

  it('load clears corrupt data from sessionStorage', async () => {
    sessionStorage.setItem('bp_draft_enc', 'garbage');
    const result = await service.load();
    expect(result).toBeNull();
    expect(sessionStorage.getItem('bp_draft_enc')).toBeNull();
  });

  it('load returns null for tampered ciphertext', async () => {
    await service.save(testState);
    const raw = sessionStorage.getItem('bp_draft_enc')!;
    const parsed = JSON.parse(raw);
    // Flip a character in the data to simulate tampering
    const chars = parsed.data.split('');
    chars[10] = chars[10] === 'A' ? 'B' : 'A';
    parsed.data = chars.join('');
    sessionStorage.setItem('bp_draft_enc', JSON.stringify(parsed));
    const result = await service.load();
    expect(result).toBeNull();
  });

  it('clear removes entry from sessionStorage', async () => {
    await service.save(testState);
    service.clear();
    expect(sessionStorage.getItem('bp_draft_enc')).toBeNull();
  });

  it('load rejects entry older than DRAFT_TTL_MS', async () => {
    await service.save(testState);
    // Manipulate timestamp to be 31 minutes ago
    const raw = sessionStorage.getItem('bp_draft_enc')!;
    const parsed = JSON.parse(raw);
    parsed.ts = Date.now() - 31 * 60 * 1000;
    sessionStorage.setItem('bp_draft_enc', JSON.stringify(parsed));
    const result = await service.load();
    expect(result).toBeNull();
    expect(sessionStorage.getItem('bp_draft_enc')).toBeNull();
  });

  it('load accepts entry within DRAFT_TTL_MS', async () => {
    await service.save(testState);
    const result = await service.load();
    expect(result).toEqual(testState);
  });

  it('isAvailable returns true in secure context', () => {
    expect(CryptoStorageService.isAvailable()).toBe(true);
  });

  it('isAvailable returns false when crypto.subtle missing', () => {
    const original = globalThis.crypto.subtle;
    Object.defineProperty(globalThis.crypto, 'subtle', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    expect(CryptoStorageService.isAvailable()).toBe(false);
    Object.defineProperty(globalThis.crypto, 'subtle', {
      value: original,
      writable: true,
      configurable: true,
    });
  });

  // Property-based test

  it('PROPERTY: round-trip preserves arbitrary valid state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          claimId: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
          currentStep: fc.integer({ min: 1, max: 4 }),
          borrower: fc.record({
            firstName: fc.string({ minLength: 0, maxLength: 30 }),
            lastName: fc.string({ minLength: 0, maxLength: 30 }),
            ssnLastFour: fc.constant(''),
            phone: fc.string({ minLength: 0, maxLength: 15 }),
            email: fc.string({ minLength: 0, maxLength: 50 }),
          }),
          incident: fc.constant(initialClaimState.incident),
          medicalProviders: fc.constant(initialClaimState.medicalProviders),
          documents: fc.constant(initialClaimState.documents),
          isSubmitting: fc.boolean(),
          error: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
        }),
        async (draft) => {
          sessionStorage.clear();
          const svc = new CryptoStorageService();
          await svc.save(draft);
          const loaded = await svc.load();
          expect(loaded).toEqual(draft);
        },
      ),
      { numRuns: 20 },
    );
  });
});
