using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.Enums;
using Tai.Portal.Core.Domain.ValueObjects;

namespace Tai.Portal.Core.Application.UseCases.Users;

public record UserDetailDto(string Id, string Email, string FirstName, string LastName, string Status, uint RowVersion);

public record GetUserByIdQuery(string Id) : IRequest<UserDetailDto?>;

public class GetUserByIdQueryHandler : IRequestHandler<GetUserByIdQuery, UserDetailDto?> {
  private readonly IIdentityService _identityService;

  public GetUserByIdQueryHandler(IIdentityService identityService) {
    _identityService = identityService;
  }

  public async Task<UserDetailDto?> Handle(GetUserByIdQuery request, CancellationToken cancellationToken) {
    var user = await _identityService.GetUserByIdAsync(request.Id, cancellationToken);
    if (user == null) return null;

    var email = user.Email ?? user.UserName ?? "Unknown";
    return new UserDetailDto(user.Id, email, user.FirstName ?? "", user.LastName ?? "", user.Status.ToString(), user.RowVersion);
  }
}
