using System.Security.Claims;
using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Primitives;
using Microsoft.IdentityModel.Tokens;
using OpenIddict.Abstractions;
using OpenIddict.Server;
using OpenIddict.Server.AspNetCore;
using Tai.Portal.Core.Domain.Entities;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace Tai.Portal.Api.Controllers;

/**
 * AuthorizationController manages the OpenID Connect (OIDC) protocol engine.
 * It handles the technical handshake between the client application and the identity server.
 */
public class AuthorizationController : Controller {
  private readonly IOpenIddictApplicationManager _applicationManager;
  private readonly IOpenIddictAuthorizationManager _authorizationManager;
  private readonly IOpenIddictScopeManager _scopeManager;
  private readonly SignInManager<ApplicationUser> _signInManager;
  private readonly UserManager<ApplicationUser> _userManager;

  public AuthorizationController(
      IOpenIddictApplicationManager applicationManager,
      IOpenIddictAuthorizationManager authorizationManager,
      IOpenIddictScopeManager scopeManager,
      SignInManager<ApplicationUser> signInManager,
      UserManager<ApplicationUser> userManager) {
    _applicationManager = applicationManager;
    _authorizationManager = authorizationManager;
    _scopeManager = scopeManager;
    _signInManager = signInManager;
    _userManager = userManager;
  }

  /**
   * This is the "Authorize" endpoint (connect/authorize).
   * It is the first step of the OIDC flow.
   */
  [HttpGet("connect/authorize")]
  [HttpPost("connect/authorize")]
  [IgnoreAntiforgeryToken]
  public async Task<IActionResult> Authorize() {
    var request = HttpContext.GetOpenIddictServerRequest() ??
        throw new InvalidOperationException("The OpenID Connect request cannot be retrieved.");

    // Step 1: Check if the user is already signed in via a cookie.
    var result = await HttpContext.AuthenticateAsync(IdentityConstants.ApplicationScheme);

    // Step 2: If NOT signed in, send them to the AccountController/Login (which redirects to the Angular Identity UI).
    if (!result.Succeeded) {
      return Challenge(
          authenticationSchemes: IdentityConstants.ApplicationScheme,
          properties: new AuthenticationProperties {
            RedirectUri = Request.PathBase + Request.Path + QueryString.Create(
                  Request.HasFormContentType ? Request.Form.ToList() : Request.Query.ToList())
          });
    }

    // Step 3: User is signed in. Fetch their profile from the database.
    var user = await _userManager.GetUserAsync(result.Principal);

    // Defensive check: if the user was deleted from the DB but still has a cookie (common with in-memory DBs).
    if (user is null) {
      return Challenge(
          authenticationSchemes: IdentityConstants.ApplicationScheme,
          properties: new AuthenticationProperties {
            RedirectUri = Request.PathBase + Request.Path + QueryString.Create(
                  Request.HasFormContentType ? Request.Form.ToList() : Request.Query.ToList())
          });
    }

    // Step 4: Verify the client application (e.g., portal-web) exists in our system.
    var application = await _applicationManager.FindByClientIdAsync(request.ClientId ?? string.Empty) ??
        throw new InvalidOperationException("Details concerning the calling client application cannot be found.");

    // Step 5: Check for existing "Permanent Authorizations" (so the user doesn't have to click 'Accept' every time).
    var authorizations = await _authorizationManager.FindAsync(
        subject: await _userManager.GetUserIdAsync(user),
        client: await _applicationManager.GetIdAsync(application) ?? string.Empty,
        status: Statuses.Valid,
        type: AuthorizationTypes.Permanent,
        scopes: request.GetScopes()).ToListAsync();

    // Step 6: Create the OIDC Identity that will be used to generate the JWT tokens.
    var identity = new ClaimsIdentity(
        authenticationType: TokenValidationParameters.DefaultAuthenticationType,
        nameType: Claims.Name,
        roleType: Claims.Role);

    // Add standard OIDC claims.
    identity.SetClaim(Claims.Subject, await _userManager.GetUserIdAsync(user))
            .SetClaim(Claims.Email, await _userManager.GetEmailAsync(user))
            .SetClaim(Claims.Name, await _userManager.GetUserNameAsync(user))
            .SetClaim(Claims.PreferredUsername, await _userManager.GetUserNameAsync(user));

    // Add roles to the claims.
    identity.SetClaims(Claims.Role, [.. (await _userManager.GetRolesAsync(user))]);

    // Grant the requested scopes (openid, email, profile, roles).
    identity.SetScopes(request.GetScopes());
    identity.SetResources(await _scopeManager.ListResourcesAsync(identity.GetScopes()).ToListAsync());

    // Step 7: Finalize the authorization record.
    var authorization = authorizations.LastOrDefault();
    authorization ??= await _authorizationManager.CreateAsync(
        identity: identity,
        subject: await _userManager.GetUserIdAsync(user),
        client: await _applicationManager.GetIdAsync(application) ?? string.Empty,
        type: AuthorizationTypes.Permanent,
        scopes: identity.GetScopes());

    identity.SetClaim(Claims.Private.AuthorizationId, await _authorizationManager.GetIdAsync(authorization));

    // Step 8: Set "Destinations" (where each claim is allowed to go: Access Token vs ID Token).
    identity.SetDestinations(GetDestinations);

    // Step 9: Return to the client application with an authorization code.
    return SignIn(new ClaimsPrincipal(identity), OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
  }

  /**
   * This is the "Logout" endpoint (connect/logout).
   * It clears the server-side session.
   */
  [HttpGet("connect/logout")]
  [HttpPost("connect/logout")]
  [IgnoreAntiforgeryToken]
  public async Task<IActionResult> Logout() {
    // Clear the local ASP.NET Identity cookie.
    await _signInManager.SignOutAsync();

    // Return a SignOutResult which tells OpenIddict to clear its own session 
    // and redirect the browser back to the main web app (post_logout_redirect_uri).
    return SignOut(
        authenticationSchemes: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
        properties: new AuthenticationProperties {
          RedirectUri = "/"
        });
  }

  /**
   * This is the "Token" endpoint (connect/token).
   * It exchanges an authorization code for an Access Token and Refresh Token.
   */
  [HttpPost("connect/token")]
  [IgnoreAntiforgeryToken]
  [Produces("application/json")]
  public async Task<IActionResult> Exchange() {
    var request = HttpContext.GetOpenIddictServerRequest() ??
        throw new InvalidOperationException("The OpenID Connect request cannot be retrieved.");

    if (request.IsAuthorizationCodeGrantType() || request.IsRefreshTokenGrantType()) {
      // Retrieve the claims principal stored in the authorization code/refresh token.
      var result = await HttpContext.AuthenticateAsync(OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);

      if (result.Principal is null) {
        return Forbid(
           authenticationSchemes: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
           properties: new AuthenticationProperties(new Dictionary<string, string?> {
             [OpenIddictServerAspNetCoreConstants.Properties.Error] = Errors.InvalidGrant,
             [OpenIddictServerAspNetCoreConstants.Properties.ErrorDescription] = "The token is no longer valid."
           }));
      }

      // Retrieve the user profile corresponding to the specified subject.
      var user = await _userManager.FindByIdAsync(result.Principal.GetClaim(Claims.Subject) ?? string.Empty);
      if (user is null) {
        return Forbid(
            authenticationSchemes: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
            properties: new AuthenticationProperties(new Dictionary<string, string?> {
              [OpenIddictServerAspNetCoreConstants.Properties.Error] = Errors.InvalidGrant,
              [OpenIddictServerAspNetCoreConstants.Properties.ErrorDescription] = "The token is no longer valid."
            }));
      }

      // Ensure the user is still allowed to log in.
      if (!await _signInManager.CanSignInAsync(user)) {
        return Forbid(
            authenticationSchemes: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
            properties: new AuthenticationProperties(new Dictionary<string, string?> {
              [OpenIddictServerAspNetCoreConstants.Properties.Error] = Errors.InvalidGrant,
              [OpenIddictServerAspNetCoreConstants.Properties.ErrorDescription] = "The user is no longer allowed to sign in."
            }));
      }

      var identity = new ClaimsIdentity(result.Principal.Claims,
          authenticationType: TokenValidationParameters.DefaultAuthenticationType,
          nameType: Claims.Name,
          roleType: Claims.Role);

      // Update claims with fresh database data.
      identity.SetClaim(Claims.Subject, await _userManager.GetUserIdAsync(user))
              .SetClaim(Claims.Email, await _userManager.GetEmailAsync(user))
              .SetClaim(Claims.Name, await _userManager.GetUserNameAsync(user))
              .SetClaim(Claims.PreferredUsername, await _userManager.GetUserNameAsync(user));

      identity.SetClaims(Claims.Role, [.. (await _userManager.GetRolesAsync(user))]);

      identity.SetDestinations(GetDestinations);

      // Returning a SignInResult will ask OpenIddict to issue the appropriate tokens.
      return SignIn(new ClaimsPrincipal(identity), OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
    }

    throw new InvalidOperationException("The specified grant type is not supported.");
  }

  /**
   * This is the "UserInfo" endpoint (connect/userinfo).
   * It allows the frontend to fetch the user's profile using an access token.
   */
  [Authorize(AuthenticationSchemes = OpenIddictServerAspNetCoreDefaults.AuthenticationScheme)]
  [HttpGet("connect/userinfo")]
  [HttpPost("connect/userinfo")]
  [Produces("application/json")]
  public async Task<IActionResult> Userinfo() {
    var user = await _userManager.FindByIdAsync(User.GetClaim(Claims.Subject) ?? string.Empty);
    if (user is null) {
      return Challenge(
          authenticationSchemes: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
          properties: new AuthenticationProperties(new Dictionary<string, string?> {
            [OpenIddictServerAspNetCoreConstants.Properties.Error] = Errors.InvalidToken,
            [OpenIddictServerAspNetCoreConstants.Properties.ErrorDescription] =
                  "The specified access token is no longer valid."
          }));
    }

    // Build the payload with the user's claims.
    var claims = new Dictionary<string, object>(StringComparer.Ordinal) {
      [Claims.Subject] = await _userManager.GetUserIdAsync(user)
    };

    if (User.HasScope(Scopes.Email)) {
      claims[Claims.Email] = await _userManager.GetEmailAsync(user) ?? string.Empty;
      claims[Claims.EmailVerified] = await _userManager.IsEmailConfirmedAsync(user);
    }

    if (User.HasScope(Scopes.Profile)) {
      claims[Claims.Name] = await _userManager.GetUserNameAsync(user) ?? string.Empty;
      claims[Claims.PreferredUsername] = await _userManager.GetUserNameAsync(user) ?? string.Empty;
    }

    if (User.HasScope(Scopes.Roles)) {
      claims[Claims.Role] = await _userManager.GetRolesAsync(user);
    }

    // Add custom tenant claim for the POC context.
    claims["tenant_id"] = user.TenantId.ToString();

    return Ok(claims);
  }

  /**
   * Helper: Sets "Destinations" for claims.
   * This controls whether a claim is included in the Access Token (for the API), 
   * the Identity Token (for the UI), or both.
   */
  private static IEnumerable<string> GetDestinations(Claim claim) {
    // Note: by default, claims are NOT automatically included in the access and identity tokens.
    // To allow OpenIddict to serialize them, you must attach them a destination, that specifies
    // whether they should be included in access tokens, in identity tokens or in both.

    switch (claim.Type) {
      case Claims.Name:
      case Claims.PreferredUsername:
        yield return Destinations.AccessToken;

        if (claim.Subject?.HasScope(Scopes.Profile) == true)
          yield return Destinations.IdentityToken;

        yield break;

      case Claims.Email:
        yield return Destinations.AccessToken;

        if (claim.Subject?.HasScope(Scopes.Email) == true)
          yield return Destinations.IdentityToken;

        yield break;

      case Claims.Role:
        yield return Destinations.AccessToken;

        if (claim.Subject?.HasScope(Scopes.Roles) == true)
          yield return Destinations.IdentityToken;

        yield break;

      // Never include the security stamp in the access and identity tokens, as it's a secret value.
      case "AspNet.Identity.SecurityStamp": yield break;

      default:
        yield return Destinations.AccessToken;
        yield break;
    }
  }
}
