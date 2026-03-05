using System.Threading;
using System.Threading.Tasks;

namespace Tai.Portal.Core.Application.Interfaces;

public interface IOtpService {
  Task<string> GenerateAndStoreOtpAsync(string userId, CancellationToken cancellationToken = default);
  Task<bool> ValidateOtpAsync(string userId, string otpCode, CancellationToken cancellationToken = default);
}
