using System;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using MediatR;
using Tai.Portal.Core.Application.Exceptions;
using Tai.Portal.Core.Application.Interfaces;
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
  private readonly IIdentityService _identityService;
  private readonly IOtpService _otpService;

  public RegisterCustomerCommandHandler(IIdentityService identityService, IOtpService otpService) {
    _identityService = identityService;
    _otpService = otpService;
  }

  public async Task<string> Handle(RegisterCustomerCommand request, CancellationToken cancellationToken) {
    var tenantId = new TenantId(request.TenantId);
    var user = new ApplicationUser(request.Email, tenantId) {
      Email = request.Email
    };

    // Use the Domain method to initiate the state machine for a customer
    user.StartCustomerOnboarding();

    var success = await _identityService.CreateUserAsync(user, request.Password, cancellationToken);

    if (!success) {
      throw new IdentityValidationException("Failed to create customer user due to identity constraints.");
    }

    // Trigger the simulated activation (generate OTP and log it)
    await _otpService.GenerateAndStoreOtpAsync(user.Id, cancellationToken);

    return user.Id;
  }
}
