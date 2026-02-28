import { test, expect } from '@playwright/test';

/**
 * Multi-Tenancy Data Isolation E2E Tests
 * 
 * JUNIOR RATIONALE: We want to prove that the system can tell the difference 
 * between two banks. We simulate a request coming from 'localhost' (TAI) 
 * and another from 'acme.localhost' (ACME). 
 * 
 * We check if the API gives us back the right "Secret ID" for each one.
 */
test.describe('Multi-Tenancy Isolation', () => {
  const API_URL = 'http://localhost:5031'; // Direct API for diagnostic verification

  test('should resolve to TAI Tenant for localhost', async ({ request }) => {
    const response = await request.get(`${API_URL}/identity/diag/headers`, {
      headers: {
        'Host': 'localhost',
        'X-Gateway-Secret': process.env['GATEWAY_SECRET'] || 'portal-poc-secret-2026'
      }
    });

    await expect(response).toBeOK();
    const data = await response.json();
    
    // Verify the API sees the EXACT host (ignoring port)
    expect(data.host).toMatch(/^localhost(:\d+)?$/);
  });

  test('should resolve to ACME Tenant for acme.localhost', async ({ request }) => {
    const response = await request.get(`${API_URL}/identity/diag/headers`, {
      headers: {
        'Host': 'acme.localhost',
        'X-Gateway-Secret': process.env['GATEWAY_SECRET'] || 'portal-poc-secret-2026'
      }
    });

    await expect(response).toBeOK();
    const data = await response.json();
    
    // Verify the API sees the EXACT subdomain host (ignoring port)
    expect(data.host).toMatch(/^acme\.localhost(:\d+)?$/);
  });

  test('should enforce cross-tenant data isolation (Negative Test)', async ({ request }) => {
    // Attempt to fetch the ACME Admin User (ending in ...20) 
    // while presenting as the TAI (localhost) tenant.
    const ACME_USER_ID = '00000000-0000-0000-0000-000000000020';

    const response = await request.get(`${API_URL}/identity/diag/user/${ACME_USER_ID}`, {
      headers: {
        'X-Tenant-Host': 'localhost',
        'X-Gateway-Secret': process.env['GATEWAY_SECRET'] || 'portal-poc-secret-2026'
      }
    });

    // The Global Query Filter should ensure this returns 404 because the 
    // record's TenantId does not match the resolved context.
    expect(response.status()).toBe(404);
  });

  test('should reject requests without a valid gateway secret', async ({ request }) => {
    const response = await request.get(`${API_URL}/identity/diag/headers`, {
      headers: {
        'Host': 'localhost',
        'X-Gateway-Secret': 'WRONG'
      }
    });

    expect(response.status()).toBe(403);
  });
});
