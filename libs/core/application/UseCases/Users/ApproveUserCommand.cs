using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Domain.Exceptions;

namespace Tai.Portal.Core.Application.UseCases.Users;

public record ApproveUserCommand(string UserId, string AdminId, uint RowVersion) : IRequest<bool>;

public class ApproveUserCommandHandler : IRequestHandler<ApproveUserCommand, bool> {
  private readonly IIdentityService _identityService;

  public ApproveUserCommandHandler(IIdentityService identityService) {
    _identityService = identityService;
  }

  public async Task<bool> Handle(ApproveUserCommand request, CancellationToken cancellationToken) {
    var user = await _identityService.GetUserByIdAsync(request.UserId, cancellationToken);
    if (user == null) {
      return false;
    }

    // Check concurrency
    if (user.RowVersion != request.RowVersion) {
      throw new ConcurrencyException("The user has been modified by another process.");
    }

    user.Approve(new TenantAdminId(request.AdminId));

    return await _identityService.UpdateUserAsync(user, cancellationToken);
  }
}
