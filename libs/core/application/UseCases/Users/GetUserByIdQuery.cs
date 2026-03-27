using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.Enums;
using Tai.Portal.Core.Domain.ValueObjects;

namespace Tai.Portal.Core.Application.UseCases.Users;

public record UserDetailDto(
  string Id,
  string Email,
  string FirstName,
  string LastName,
  string Status,
  string? Institution,
  uint RowVersion,
  IEnumerable<Guid> PrivilegeIds,
  string Debug = "DEBUG");

public record GetUserByIdQuery(string Id) : IRequest<UserDetailDto?>;

public class GetUserByIdQueryHandler : IRequestHandler<GetUserByIdQuery, UserDetailDto?> {
  private readonly IIdentityService _identityService;

  public GetUserByIdQueryHandler(IIdentityService identityService) {
    _identityService = identityService;
  }

  public async Task<UserDetailDto?> Handle(GetUserByIdQuery request, CancellationToken cancellationToken) {
    var user = await _identityService.GetUserByIdAsync(request.Id, cancellationToken);
    if (user == null) {
      return null;
    }

    var email = !string.IsNullOrWhiteSpace(user.Email) ? user.Email : (!string.IsNullOrWhiteSpace(user.UserName) ? user.UserName : "No Email");
    var privilegeIds = await _identityService.GetUserPrivilegesAsync(request.Id, cancellationToken);

    return new UserDetailDto(
      user.Id,
      email,
      user.FirstName ?? "No First Name",
      user.LastName ?? "No Last Name",
      user.Status.ToString(),
      "Tai Portal", // Institution placeholder
      user.RowVersion,
      privilegeIds.Select(p => p.Value),
      "RUNNING_NEW_CODE");
  }
}
