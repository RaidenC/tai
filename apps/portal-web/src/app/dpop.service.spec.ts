import { TestBed } from '@angular/core/testing';
import { DPoPService } from './dpop.service';
import { describe, it, expect, beforeEach } from 'vitest';

describe('DPoPService', () => {
  let service: DPoPService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DPoPService]
    });
    service = TestBed.inject(DPoPService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should generate a DPoP header', async () => {
    const method = 'GET';
    const url = 'http://localhost:5217/api/data';
    
    const header = await service.getDPoPHeader(method, url);
    
    expect(header).toBeTruthy();
    const parts = header.split('.');
    expect(parts.length).toBe(3);

    // Decode header
    const headerPayload = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    expect(headerPayload.typ).toBe('dpop+jwt');
    expect(headerPayload.alg).toBe('ES256');
    expect(headerPayload.jwk).toBeDefined();
    expect(headerPayload.jwk.kty).toBe('EC');
    expect(headerPayload.jwk.crv).toBe('P-256');

    // Decode payload
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    expect(payload.htm).toBe(method);
    expect(payload.htu).toBe(url);
    expect(payload.jti).toBeDefined();
    expect(payload.iat).toBeDefined();
  });

  it('should include nonce in DPoP header if provided', async () => {
    const method = 'POST';
    const url = '/api/secure';
    const nonce = 'test-nonce';
    
    const header = await service.getDPoPHeader(method, url, undefined, nonce);
    
    const parts = header.split('.');
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    expect(payload.nonce).toBe(nonce);
  });

  it('should include ath in DPoP header if accessToken is provided', async () => {
    const method = 'PUT';
    const url = '/api/resource';
    const accessToken = 'test-token';
    
    const header = await service.getDPoPHeader(method, url, accessToken);
    
    const parts = header.split('.');
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    expect(payload.ath).toBeDefined();
    expect(typeof payload.ath).toBe('string');
  });

  it('should reuse the same key pair for multiple headers', async () => {
    // Generate first header to trigger key creation
    const header1 = await service.getDPoPHeader('GET', '/1');
    const parts1 = header1.split('.');
    const headerPayload1 = JSON.parse(atob(parts1[0].replace(/-/g, '+').replace(/_/g, '/')));
    
    // Generate second header
    const header2 = await service.getDPoPHeader('GET', '/2');
    const parts2 = header2.split('.');
    const headerPayload2 = JSON.parse(atob(parts2[0].replace(/-/g, '+').replace(/_/g, '/')));
    
    // Compare public keys (JWK)
    expect(headerPayload1.jwk.x).toBe(headerPayload2.jwk.x);
    expect(headerPayload1.jwk.y).toBe(headerPayload2.jwk.y);
  });
});
