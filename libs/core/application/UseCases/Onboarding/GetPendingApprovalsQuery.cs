using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using MediatR;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Application.Models;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.Enums;
using Tai.Portal.Core.Domain.ValueObjects;

namespace Tai.Portal.Core.Application.UseCases.Onboarding;

public record UserSummaryDto(string Id, string Email, string Name, string Status);

public record GetPendingApprovalsQuery(Guid TenantId, int PageNumber = 1, int PageSize = 10) : IRequest<PaginatedList<UserSummaryDto>>;

public class GetPendingApprovalsQueryValidator : FluentValidation.AbstractValidator<GetPendingApprovalsQuery> {
  public GetPendingApprovalsQueryValidator() {
    RuleFor(x => x.PageNumber).GreaterThanOrEqualTo(1);
    RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
  }
}

public class GetPendingApprovalsQueryHandler : IRequestHandler<GetPendingApprovalsQuery, PaginatedList<UserSummaryDto>> {
  private readonly IIdentityService _identityService;

  public GetPendingApprovalsQueryHandler(IIdentityService identityService) {
    _identityService = identityService;
  }

  public async Task<PaginatedList<UserSummaryDto>> Handle(GetPendingApprovalsQuery request, CancellationToken cancellationToken) {
    var skip = (request.PageNumber - 1) * request.PageSize;
    var tenantId = new TenantId(request.TenantId);

    var users = await _identityService.GetUsersByStatusAndTenantAsync(
      UserStatus.PendingApproval,
      tenantId,
      skip,
      request.PageSize,
      cancellationToken);

    var totalCount = await _identityService.CountUsersByStatusAndTenantAsync(UserStatus.PendingApproval, tenantId, cancellationToken);

    var items = users
      .Select(u => {
        var email = u.Email ?? u.UserName ?? "Unknown";
        var name = !string.IsNullOrWhiteSpace(u.FirstName) ? $"{u.FirstName} {u.LastName}".Trim() : email;
        return new UserSummaryDto(u.Id, email, name, u.Status.ToString());
      })
      .ToList();

    return new PaginatedList<UserSummaryDto>(items, totalCount, request.PageNumber, request.PageSize);
  }
}
