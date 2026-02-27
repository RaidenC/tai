using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Tai.Portal.Core.Domain.Entities;

namespace Tai.Portal.Api.Controllers;

[Route("[controller]/[action]")]
public class AccountController : Controller {
  private readonly SignInManager<ApplicationUser> _signInManager;
  private readonly UserManager<ApplicationUser> _userManager;
  private readonly IConfiguration _configuration;

  public AccountController(
      SignInManager<ApplicationUser> signInManager,
      UserManager<ApplicationUser> userManager,
      IConfiguration configuration) {
    _signInManager = signInManager;
    _userManager = userManager;
    _configuration = configuration;
  }

  [HttpGet]
  public IActionResult Login(string? returnUrl = null) {
    var systemConfig = _configuration.GetSection("System");
    var identityUiPort = systemConfig.GetValue<int>("IdentityUiPort");
    var gatewayPort = systemConfig.GetValue<int>("GatewayPort");
    var apiPort = systemConfig.GetValue<int>("ApiPort");

    // For the POC, we redirect to the standalone Identity UI Angular app.
    // JUNIOR RATIONALE: We use the current request host so that if the 
    // user is at 'acme.localhost', they stay on 'acme.localhost'.
    var host = Request.Host.Host;
    var identityUiUrl = $"http://{host}:{identityUiPort}/login";

    // Ensure the returnUrl points back to the Gateway
    if (!string.IsNullOrEmpty(returnUrl) && returnUrl.Contains($":{apiPort}")) {
      returnUrl = returnUrl.Replace($":{apiPort}", $":{gatewayPort}");
    }

    var redirectUrl = $"{identityUiUrl}?returnUrl={Uri.EscapeDataString(returnUrl ?? "/")}";

    return Redirect(redirectUrl);
  }

  [HttpPost]
  [IgnoreAntiforgeryToken]
  public async Task<IActionResult> Login([FromForm] string username, [FromForm] string password, [FromForm] string? returnUrl = null) {
    var systemConfig = _configuration.GetSection("System");
    var identityUiPort = systemConfig.GetValue<int>("IdentityUiPort");
    var gatewayPort = systemConfig.GetValue<int>("GatewayPort");
    var apiPort = systemConfig.GetValue<int>("ApiPort");

    // Debugging for the POC
    Console.WriteLine($"[AUTH] Login attempt for user: {username}");

    var host = Request.Host.Host;
    var result = await _signInManager.PasswordSignInAsync(username, password, false, false);
    if (result.Succeeded) {
      Console.WriteLine($"[AUTH] Login succeeded for user: {username}.");

      // Ensure the returnUrl points back to the Gateway
      if (!string.IsNullOrEmpty(returnUrl) && returnUrl.Contains($":{apiPort}")) {
        returnUrl = returnUrl.Replace($":{apiPort}", $":{gatewayPort}");
      }

      // JUNIOR RATIONALE: After a successful login, we MUST redirect back 
      // to the 'returnUrl'. This is the OIDC 'authorize' endpoint that 
      // will then issue the code and redirect back to the main app.
      if (!string.IsNullOrEmpty(returnUrl)) {
        return Redirect(returnUrl);
      }

      var webPort = systemConfig.GetValue<int>("WebPort");
      return Redirect($"http://{host}:{webPort}");
    }

    Console.WriteLine($"[AUTH] Login failed for user: {username}");

    // If the login fails, redirect back to the Identity UI with an error message.
    var identityUiUrl = $"http://{host}:{identityUiPort}/login";
    var redirectUrl = $"{identityUiUrl}?returnUrl={Uri.EscapeDataString(returnUrl ?? "/")}&error=invalid_credentials";
    return Redirect(redirectUrl);
  }
}
