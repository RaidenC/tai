using System;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Identity;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.ValueObjects;

namespace Tai.Portal.Core.Application.UseCases.Onboarding;

public record RegisterStaffCommand(Guid TenantId, string Email, string Password) : IRequest<string>;

public class RegisterStaffCommandValidator : AbstractValidator<RegisterStaffCommand> {
  public RegisterStaffCommandValidator() {
    RuleFor(x => x.TenantId).NotEmpty();
    RuleFor(x => x.Email).NotEmpty().EmailAddress();
    RuleFor(x => x.Password).NotEmpty();
  }
}

public class RegisterStaffCommandHandler : IRequestHandler<RegisterStaffCommand, string> {
  private readonly UserManager<ApplicationUser> _userManager;

  public RegisterStaffCommandHandler(UserManager<ApplicationUser> userManager) {
    _userManager = userManager;
  }

  public async Task<string> Handle(RegisterStaffCommand request, CancellationToken cancellationToken) {
    var tenantId = new TenantId(request.TenantId);
    var user = new ApplicationUser(request.Email, tenantId) {
      Email = request.Email
    };

    // Use the Domain method to initiate the state machine for a staff member
    user.StartStaffOnboarding();

    var result = await _userManager.CreateAsync(user, request.Password);

    if (!result.Succeeded) {
      var errors = string.Join(", ", System.Linq.Enumerable.Select(result.Errors, e => e.Description));
      throw new InvalidOperationException($"Failed to create staff user: {errors}");
    }

    return user.Id;
  }
}
