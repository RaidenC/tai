import { APIRequestContext } from '@playwright/test';

export interface SeedUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
  tenantHost?: string;
  role?: string;
  status?: number; // UserStatus enum values: Created=0, PendingApproval=1, PendingVerification=2, Active=3
}

/**
 * TDM Utility to seed a specific test user via the API.
 * This bypasses the UI for "Arrange" steps, making tests faster and more reliable.
 */
export async function seedTestUser(request: APIRequestContext, user: SeedUserRequest) {
  // Call the API directly (5031) to avoid Gateway (5217) header conflicts.
  // In CI, we use 127.0.0.1 to avoid IPv6/IPv4 resolution issues.
  const API_URL = process.env['CI'] ? 'http://127.0.0.1:5031' : 'http://localhost:5031';
  
  // Use the secret from environment if available (set in CI), otherwise use default.
  const GATEWAY_SECRET = process.env['GATEWAY_SECRET'] || 'portal-poc-secret-2026';

  const response = await request.post(`${API_URL}/api/tdm/seed-user`, {
    data: user,
    headers: {
      'X-Gateway-Secret': GATEWAY_SECRET,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Failed to seed test user on ${API_URL}: ${response.status()} - ${body}`);
  }

  return await response.json();
}
