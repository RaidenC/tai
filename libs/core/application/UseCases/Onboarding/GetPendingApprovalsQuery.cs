using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Identity;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.Enums;

namespace Tai.Portal.Core.Application.UseCases.Onboarding;

public record UserSummaryDto(string Id, string Email, UserStatus Status);

public record GetPendingApprovalsQuery() : IRequest<List<UserSummaryDto>>;

public class GetPendingApprovalsQueryHandler : IRequestHandler<GetPendingApprovalsQuery, List<UserSummaryDto>> {
  private readonly UserManager<ApplicationUser> _userManager;

  public GetPendingApprovalsQueryHandler(UserManager<ApplicationUser> userManager) {
    _userManager = userManager;
  }

  public Task<List<UserSummaryDto>> Handle(GetPendingApprovalsQuery request, CancellationToken cancellationToken) {
    // Note: In a production app, we would typically use IQueryable projections and pagination here.
    // For the POC, filtering in memory is sufficient to demonstrate the query logic.
    // In later iterations, a dedicated Read Repository or direct EF Core querying would be used.
    
    // We cannot use await directly with .Where().ToList() on the Users IQueryable from the mock easily without setting up async enumerators.
    // Given the small data set in tests, we materialise first.
    var users = _userManager.Users.ToList();
    
    var pendingUsers = users
      .Where(u => u.Status == UserStatus.PendingApproval)
      .Select(u => new UserSummaryDto(u.Id, u.Email, u.Status))
      .ToList();

    return Task.FromResult(pendingUsers);
  }
}
