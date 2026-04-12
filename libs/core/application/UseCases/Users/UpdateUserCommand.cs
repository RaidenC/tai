using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using MediatR;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Application.Models;
using Tai.Portal.Core.Domain.Exceptions;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Domain.Events;

namespace Tai.Portal.Core.Application.UseCases.Users;

public record UpdateUserCommand(
  string Id,
  string FirstName,
  string LastName,
  string Email,
  uint RowVersion,
  IEnumerable<Guid> PrivilegeIds) : IRequest<bool>;

public class UpdateUserCommandValidator : AbstractValidator<UpdateUserCommand> {
  public UpdateUserCommandValidator() {
    RuleFor(x => x.Id).NotEmpty();
    RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
    RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
    RuleFor(x => x.Email).NotEmpty().EmailAddress();
  }
}

public class UpdateUserCommandHandler : IRequestHandler<UpdateUserCommand, bool> {
  private readonly IIdentityService _identityService;
  private readonly IMediator _mediator;

  public UpdateUserCommandHandler(IIdentityService identityService, IMediator mediator) {
    _identityService = identityService;
    _mediator = mediator;
  }

  public async Task<bool> Handle(UpdateUserCommand request, CancellationToken cancellationToken) {
    var user = await _identityService.GetUserByIdAsync(request.Id, cancellationToken);
    if (user == null) {
      return false;
    }

    // Concurrency Check
    if (user.RowVersion != request.RowVersion) {
      throw new ConcurrencyException("The user has been modified by another process.");
    }

    user.FirstName = request.FirstName;
    user.LastName = request.LastName;
    user.Email = request.Email;
    user.UserName = request.Email; // Keep UserName in sync with Email

    var updateProfileResult = await _identityService.UpdateUserAsync(user, cancellationToken);
    if (!updateProfileResult) return false;

    // Update privileges
    var privilegeIds = request.PrivilegeIds.Select(id => new PrivilegeId(id));
    var result = await _identityService.UpdateUserPrivilegesAsync(request.Id, privilegeIds, cancellationToken);

    // Publish security event for privilege change
    if (result) {
      var domainEvent = new PrivilegeChangeEvent(
        user.TenantId,
        user.Id,
        "privilege_update",
        $"User privileges updated: {string.Join(", ", request.PrivilegeIds)}",
        request.Id
      );
      await _mediator.Publish(new DomainEventNotification<PrivilegeChangeEvent>(domainEvent), cancellationToken);
    }

    return result;
  }
}
