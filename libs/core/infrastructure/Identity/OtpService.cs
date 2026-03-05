using System;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Tai.Portal.Core.Application.Interfaces;

namespace Tai.Portal.Core.Infrastructure.Identity;

public class OtpService : IOtpService {
  private readonly IMemoryCache _cache;
  private readonly ILogger<OtpService> _logger;
  private static readonly TimeSpan DefaultExpiration = TimeSpan.FromMinutes(10);

  public OtpService(IMemoryCache cache, ILogger<OtpService> logger) {
    _cache = cache;
    _logger = logger;
  }

  public Task<string> GenerateAndStoreOtpAsync(string userId, CancellationToken cancellationToken = default) {
    // Generate a secure 6-digit numeric code
    var code = RandomNumberGenerator.GetInt32(100000, 999999).ToString("D6");

    var cacheKey = GetCacheKey(userId);

    // Store in memory cache with absolute expiration
    _cache.Set(cacheKey, code, DefaultExpiration);

    // SIMULATED ACTIVATION: Log to terminal (as required by the spec)
    _logger.LogInformation("==========================================================");
    _logger.LogInformation("SIMULATED EMAIL/SMS EVENT:");
    _logger.LogInformation("To: User {UserId}", userId);
    _logger.LogInformation("Subject: Your Activation Code");
    _logger.LogInformation("Body: Your 6-digit activation code is: {Code}", code);
    _logger.LogInformation("This code will expire in {Minutes} minutes.", DefaultExpiration.TotalMinutes);
    _logger.LogInformation("==========================================================");

    return Task.FromResult(code);
  }

  public Task<bool> ValidateOtpAsync(string userId, string otpCode, CancellationToken cancellationToken = default) {
    var cacheKey = GetCacheKey(userId);

    if (_cache.TryGetValue(cacheKey, out string? storedCode)) {
      if (storedCode == otpCode) {
        // OTP is valid. Remove it so it cannot be reused.
        _cache.Remove(cacheKey);
        return Task.FromResult(true);
      }
    }

    return Task.FromResult(false);
  }

  private static string GetCacheKey(string userId) => $"OTP_VERIFICATION_{userId}";
}
