import { TestBed } from '@angular/core/testing';
import { TrustedTypesService } from './trusted-types.service';
import { describe, it, expect, beforeEach } from 'vitest';

describe('TrustedTypesService', () => {
  let service: TrustedTypesService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TrustedTypesService]
    });
    service = TestBed.inject(TrustedTypesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return input string as is in POC implementation', () => {
    const html = '<b>Safe</b>';
    const result = service.createTrustedHTML(html);
    expect(result).toBe(html);
  });

  it('should handle missing Trusted Types API gracefully', () => {
    // In Vitest/jsdom environment, trustedTypes might not be present
    const result = service.createTrustedHTML('test');
    expect(result).toBe('test');
  });
});
