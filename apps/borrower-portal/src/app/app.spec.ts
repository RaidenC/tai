import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App } from './app';
import { CryptoStorageService } from './claim/services/crypto-storage.service';
import { SecurityLoggerService } from './claim/services/security-logger.service';

describe('App — crypto availability gate', () => {
  let loggerSpy: { log: ReturnType<typeof vi.fn> };

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('logs CRYPTO_UNAVAILABLE when crypto.subtle is missing', async () => {
    loggerSpy = { log: vi.fn() };
    vi.spyOn(CryptoStorageService, 'isAvailable').mockReturnValue(false);

    await TestBed.configureTestingModule({
      imports: [App, RouterTestingModule],
      providers: [
        { provide: SecurityLoggerService, useValue: loggerSpy },
      ],
    });

    TestBed.compileComponents();
    TestBed.createComponent(App);

    expect(loggerSpy.log).toHaveBeenCalledWith(
      'CRYPTO_UNAVAILABLE',
      expect.any(String),
    );
  });

  it('does not log CRYPTO_UNAVAILABLE when crypto.subtle is present', async () => {
    loggerSpy = { log: vi.fn() };
    vi.spyOn(CryptoStorageService, 'isAvailable').mockReturnValue(true);

    await TestBed.configureTestingModule({
      imports: [App, RouterTestingModule],
      providers: [
        { provide: SecurityLoggerService, useValue: loggerSpy },
      ],
    });

    TestBed.compileComponents();
    TestBed.createComponent(App);

    const types = loggerSpy.log.mock.calls.map((c) => c[0]);
    expect(types).not.toContain('CRYPTO_UNAVAILABLE');
  });
});
