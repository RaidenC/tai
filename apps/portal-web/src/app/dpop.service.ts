import { Injectable } from '@angular/core';

/**
 * DPoP (Demonstrating Proof-of-Possession) Service
 * 
 * This service is responsible for generating cryptographic keys and creating
 * DPoP proofs according to RFC 9449. DPoP is a security mechanism that binds
 * OAuth 2.0 access tokens to a specific client instance, preventing token theft.
 * If a token is stolen, it cannot be used by the attacker because they don't
 * possess the corresponding private key.
 */
@Injectable({
  providedIn: 'root'
})
export class DPoPService {
  // A promise that resolves to the cryptographic key pair.
  // We use a promise to ensure we only generate the key pair once per session.
  private keyPairPromise: Promise<CryptoKeyPair> | null = null;
  // A promise for the public key in JWK (JSON Web Key) format.
  private jwkPromise: Promise<JsonWebKey> | null = null;

  /**
   * Generates the DPoP header string for an HTTP request.
   * @param httpMethod The HTTP method of the request (e.g., 'GET', 'POST').
   * @param url The full URL of the request.
   * @param accessToken Optional access token, required for DPoP-bound tokens.
   * @param nonce Optional nonce provided by the server.
   * @returns A promise that resolves to the signed DPoP JWT.
   */
  async getDPoPHeader(httpMethod: string, url: string, accessToken?: string, nonce?: string): Promise<string> {
    const keyPair = await this.getOrCreateKeyPair();
    const jwk = await this.getOrCreateJWK(keyPair.publicKey);

    // --- DPoP Proof Header ---
    // The header includes the algorithm, token type, and the public key (JWK).
    // The server uses the public key to verify the signature of the DPoP proof.
    const header = {
      typ: 'dpop+jwt',
      alg: 'ES256', // ECDSA with P-256 and SHA-256, recommended by the spec.
      jwk: {
          kty: jwk.kty,
          crv: jwk.crv,
          x: jwk.x,
          y: jwk.y
      }
    };

    // --- DPoP Proof Payload ---
    // The payload contains the core claims that prove possession of the key for this specific request.
    const payload: Record<string, string | number> = {
      jti: window.crypto.randomUUID(), // Unique identifier to prevent replay attacks.
      htm: httpMethod,              // The HTTP method of the request being protected.
      htu: url,                     // The full HTTP URL of the request being protected.
      iat: Math.floor(Date.now() / 1000) // Timestamp of when the proof was created.
    };

    // If a nonce is provided by the server, include it in the proof.
    if (nonce) {
      payload['nonce'] = nonce;
    }

    // If an access token is provided, include its hash in the proof.
    // This cryptographically binds the DPoP proof to the access token.
    if (accessToken) {
        payload['ath'] = await this.hashAccessToken(accessToken);
    }

    const headerJson = JSON.stringify(header);
    const payloadJson = JSON.stringify(payload);

    // The data to be signed is the Base64Url-encoded header and payload, joined by a dot.
    const encodedHeader = this.base64UrlEncode(headerJson);
    const encodedPayload = this.base64UrlEncode(payloadJson);
    
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const dataToSign = new TextEncoder().encode(signatureInput);

    // --- Signature ---
    // Sign the data using the private key with the ECDSA P-256 algorithm.
    const signature = await window.crypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' },
      },
      keyPair.privateKey,
      dataToSign
    );

    const encodedSignature = this.base64UrlEncode(new Uint8Array(signature));

    // The final DPoP JWT is the combination of the encoded parts.
    return `${signatureInput}.${encodedSignature}`;
  }

  /**
   * Lazily generates and stores an ECDSA key pair for the user's session.
   * The private key is marked as non-extractable for security.
   */
  private async getOrCreateKeyPair(): Promise<CryptoKeyPair> {
    if (!this.keyPairPromise) {
      this.keyPairPromise = window.crypto.subtle.generateKey(
        {
          name: 'ECDSA',
          namedCurve: 'P-256',
        },
        false, // 'false' makes the private key non-extractable.
        ['sign'] // The key's only purpose is for signing.
      );
    }
    return this.keyPairPromise;
  }

  /**
   * Lazily exports and caches the public key in JWK format.
   */
  private async getOrCreateJWK(publicKey: CryptoKey): Promise<JsonWebKey> {
      if (!this.jwkPromise) {
          this.jwkPromise = window.crypto.subtle.exportKey('jwk', publicKey);
      }
      return this.jwkPromise;
  }

  /**
   * Calculates the SHA-256 hash of the access token and Base64Url-encodes it.
   */
  private async hashAccessToken(accessToken: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(accessToken);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(hashBuffer));
  }

  /**
   * A helper function to Base64Url-encode data, as required by the JWT and DPoP specs.
   * This is different from standard Base64 encoding.
   */
  private base64UrlEncode(input: string | Uint8Array): string {
    let base64String: string;
    
    if (typeof input === 'string') {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(input);
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        base64String = btoa(binary);
    } else {
        let binary = '';
        const len = input.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(input[i]);
        }
        base64String = btoa(binary);
    }

    // Convert standard Base64 to Base64Url by replacing characters and removing padding.
    return base64String
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}
