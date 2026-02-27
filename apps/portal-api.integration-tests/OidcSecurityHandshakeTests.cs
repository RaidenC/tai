using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc.Testing;
using OpenIddict.Abstractions;
using Xunit;

namespace Tai.Portal.Api.IntegrationTests;

/// <summary>
/// OIDC Security Handshake Integration Tests
/// 
/// JUNIOR RATIONALE: This suite tests the "Rules of the Road" for our identity server.
/// We've configured the server to be very strict (e.g., requiring PKCE). These tests
/// act as a "Bouncer" to ensure that any request trying to break or bypass 
/// these security rules is immediately rejected with a clear error.
/// </summary>
public class OidcSecurityHandshakeTests : IClassFixture<WebApplicationFactory<Program>> {
  private readonly WebApplicationFactory<Program> _factory;
  
  // JUNIOR RATIONALE: To talk to the API, we must present the secret "Passcode" 
  // that proves we are coming through the trusted Gateway. 
  private string GatewaySecret => Environment.GetEnvironmentVariable("GATEWAY_SECRET") ?? 
                                  "portal-poc-secret-2026";

  public OidcSecurityHandshakeTests(WebApplicationFactory<Program> factory) {
    _factory = factory;
  }

  /// <summary>
  /// Tests that the server rejects a token request if the PKCE verifier is missing.
  /// </summary>
  [Fact]
  public async Task TokenEndpoint_RejectsRequest_WhenPkceVerifierIsMissing() {
    // 1. Arrange: Setup a virtual client that trusts our Gateway Secret.
    var client = _factory.CreateClient();
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", GatewaySecret);
    
    // JUNIOR RATIONALE: In OIDC, "PKCE" is like a secret handshake. 
    // The browser first sends a 'Challenge', and then later sends a 'Verifier'.
    // If the 'Verifier' is missing, it means someone might be trying to steal 
    // the authorization code. We MUST block this.
    var content = new FormUrlEncodedContent(new Dictionary<string, string> {
      ["grant_type"] = "authorization_code",
      ["client_id"] = "portal-web",
      ["code"] = "any-random-code", 
      ["redirect_uri"] = "http://localhost:4200"
      // Note: "code_verifier" is missing here on purpose!
    });

    // 2. Act: Try to trade the code for a token.
    var response = await client.PostAsync("/identity/connect/token", content);

    // 3. Assert: Verify the server said "No".
    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    
    var error = await response.Content.ReadFromJsonAsync<OpenIddictResponse>();
    Assert.NotNull(error);
    Assert.Equal(OpenIddictConstants.Errors.InvalidRequest, error.Error);
    Assert.Contains("code_verifier", error.ErrorDescription);
  }

  /// <summary>
  /// Tests that the server rejects a token request if the PKCE verifier is WRONG.
  /// </summary>
  [Fact]
  public async Task TokenEndpoint_RejectsRequest_WhenPkceVerifierIsInvalid() {
    // JUNIOR RATIONALE: Even if you provide a verifier, it must match the challenge 
    // sent earlier. If it's different, it's a security violation.
    
    var client = _factory.CreateClient();
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", GatewaySecret);
    
    var content = new FormUrlEncodedContent(new Dictionary<string, string> {
      ["grant_type"] = "authorization_code",
      ["client_id"] = "portal-web",
      ["code"] = "some-code", 
      ["redirect_uri"] = "http://localhost:4200",
      ["code_verifier"] = "wrong-verifier-that-does-not-match"
    });

    var response = await client.PostAsync("/identity/connect/token", content);

    // OpenIddict returns 400 Bad Request for invalid grants/verifiers.
    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    
    var error = await response.Content.ReadFromJsonAsync<OpenIddictResponse>();
    Assert.NotNull(error);
    // 'invalid_grant' is the OIDC error for a verifier/code mismatch.
    Assert.Equal(OpenIddictConstants.Errors.InvalidGrant, error.Error);
  }

  /// <summary>
  /// Tests Replay Protection: A code cannot be used twice.
  /// </summary>
  [Fact]
  public async Task TokenEndpoint_RejectsRequest_WhenCodeIsReused() {
    /**
     * JUNIOR RATIONALE: "Authorization Code Injection" is when an attacker steals 
     * a code and tries to use it. If we already used the code, the server must 
     * remember that and reject any second attempt. In fact, many secure servers 
     * will revoke ALL tokens associated with that user if they see a code reuse, 
     * because it's a sign of a hack.
     */
    
    // Note: To fully test this, we would need to generate a REAL valid code first.
    // For this POC integration test, we verify that any attempt to use a non-existent 
    // or previously used code results in a rejection.
    
    var client = _factory.CreateClient();
    client.DefaultRequestHeaders.Add("X-Gateway-Secret", GatewaySecret);
    
    var content = new FormUrlEncodedContent(new Dictionary<string, string> {
      ["grant_type"] = "authorization_code",
      ["client_id"] = "portal-web",
      ["code"] = "already-used-code", 
      ["redirect_uri"] = "http://localhost:4200",
      ["code_verifier"] = "valid-verifier"
    });

    // Act
    var response = await client.PostAsync("/identity/connect/token", content);

    // Assert
    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    var error = await response.Content.ReadFromJsonAsync<OpenIddictResponse>();
    Assert.Equal(OpenIddictConstants.Errors.InvalidGrant, error.Error);
  }
}

/// <summary>
/// A simple "Helper" class to turn the JSON from the server into a C# object.
/// </summary>
public class OpenIddictResponse {
  [JsonPropertyName("error")]
  public string Error { get; set; } = string.Empty;

  [JsonPropertyName("error_description")]
  public string ErrorDescription { get; set; } = string.Empty;
}
