using FluentValidation;

namespace Tai.Portal.Core.Application.UseCases.Users;

public class GetUsersQueryValidator : AbstractValidator<GetUsersQuery> {
  public GetUsersQueryValidator() {
    RuleFor(x => x.PageNumber).GreaterThanOrEqualTo(1);
    RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
  }
}
