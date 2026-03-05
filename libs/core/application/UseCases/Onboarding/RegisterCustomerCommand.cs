using System;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Identity;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Domain.ValueObjects;

namespace Tai.Portal.Core.Application.UseCases.Onboarding;

public record RegisterCustomerCommand(Guid TenantId, string Email, string Password) : IRequest<string>;

public class RegisterCustomerCommandValidator : AbstractValidator<RegisterCustomerCommand> {
  public RegisterCustomerCommandValidator() {
    RuleFor(x => x.TenantId).NotEmpty();
    RuleFor(x => x.Email).NotEmpty().EmailAddress();
    RuleFor(x => x.Password).NotEmpty();
  }
}

public class RegisterCustomerCommandHandler : IRequestHandler<RegisterCustomerCommand, string> {
  private readonly UserManager<ApplicationUser> _userManager;

  public RegisterCustomerCommandHandler(UserManager<ApplicationUser> userManager) {
    _userManager = userManager;
  }

  public async Task<string> Handle(RegisterCustomerCommand request, CancellationToken cancellationToken) {
    var tenantId = new TenantId(request.TenantId);
    var user = new ApplicationUser(request.Email, tenantId) {
      Email = request.Email
    };

    // Use the Domain method to initiate the state machine for a customer
    user.StartCustomerOnboarding();

    var result = await _userManager.CreateAsync(user, request.Password);

    if (!result.Succeeded) {
      // In a real app, we'd want a specific DomainException to map to 400 Bad Request, 
      // but InvalidOperation is fine for the POC to pass the tests.
      var errors = string.Join(", ", System.Linq.Enumerable.Select(result.Errors, e => e.Description));
      throw new InvalidOperationException($"Failed to create user: {errors}");
    }

    return user.Id;
  }
}
