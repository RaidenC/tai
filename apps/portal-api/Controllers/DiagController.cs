using Microsoft.AspNetCore.Mvc;

namespace Tai.Portal.Api.Controllers;

[Route("diag")]
public class DiagController : Controller {
  [HttpGet("headers")]
  public IActionResult GetHeaders() {
    var headers = Request.Headers.ToDictionary(h => h.Key, h => h.Value.ToString());
    var info = new {
      Host = Request.Host.ToString(),
      PathBase = Request.PathBase.ToString(),
      Scheme = Request.Scheme,
      Headers = headers
    };
    return Ok(info);
  }
}
