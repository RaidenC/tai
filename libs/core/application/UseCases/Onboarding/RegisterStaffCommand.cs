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

public record RegisterStaffCommand(Guid TenantId, string Email, string Password, string FirstName, string LastName) : IRequest<string>;

public class RegisterStaffCommandValidator : AbstractValidator<RegisterStaffCommand> {
  public RegisterStaffCommandValidator() {
    RuleFor(x => x.TenantId).NotEmpty();
    RuleFor(x => x.Email).NotEmpty().EmailAddress();
    RuleFor(x => x.Password).NotEmpty();
    RuleFor(x => x.FirstName).NotEmpty();
    RuleFor(x => x.LastName).NotEmpty();
  }
}

public class RegisterStaffCommandHandler : IRequestHandler<RegisterStaffCommand, string> {
  private readonly IIdentityService _identityService;
  private readonly IOtpService _otpService;

  public RegisterStaffCommandHandler(IIdentityService identityService, IOtpService otpService) {
    _identityService = identityService;
    _otpService = otpService;
  }

  public async Task<string> Handle(RegisterStaffCommand request, CancellationToken cancellationToken) {
    var tenantId = new TenantId(request.TenantId);
    var user = new ApplicationUser(request.Email, tenantId) {
      Email = request.Email,
      UserName = request.Email
    };

    // Use the Domain method to initiate the state machine for a staff member
    user.StartStaffOnboarding();

    var (success, errors) = await _identityService.CreateUserAsync(user, request.Password, cancellationToken);

    if (!success) {
      throw new IdentityValidationException(string.Join(", ", errors));
    }

    // Note: We DO NOT generate the OTP here for Staff. 
    // They are in PendingApproval state and must be approved by an Admin first.
    // The OTP will be generated in the ApproveStaffCommandHandler.

    return user.Id;
  }
}
