using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.Enums;
using Tai.Portal.Core.Domain.ValueObjects;

namespace Tai.Portal.Core.Application.UseCases.Onboarding;

public record UserSummaryDto(string Id, string Email, string Name, string Status);

public record GetPendingApprovalsQuery(Guid TenantId, int Page = 1, int PageSize = 10) : IRequest<List<UserSummaryDto>>;

public class GetPendingApprovalsQueryHandler : IRequestHandler<GetPendingApprovalsQuery, List<UserSummaryDto>> {
  private readonly IIdentityService _identityService;

  public GetPendingApprovalsQueryHandler(IIdentityService identityService) {
    _identityService = identityService;
  }

  public async Task<List<UserSummaryDto>> Handle(GetPendingApprovalsQuery request, CancellationToken cancellationToken) {
    var skip = (request.Page - 1) * request.PageSize;

    var users = await _identityService.GetUsersByStatusAndTenantAsync(
      UserStatus.PendingApproval,
      new TenantId(request.TenantId),
      skip,
      request.PageSize,
      cancellationToken);

    var pendingUsers = users
      .Select(u => new UserSummaryDto(u.Id, u.Email ?? u.UserName ?? "Unknown", u.Email ?? u.UserName ?? "Unknown", u.Status.ToString()))
      .ToList();

    return pendingUsers;
  }
}
