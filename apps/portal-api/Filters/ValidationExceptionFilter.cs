using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Linq;
using Tai.Portal.Core.Application.Exceptions;

namespace Tai.Portal.Api.Filters;

public class ValidationExceptionFilter : IExceptionFilter {
  public void OnException(ExceptionContext context) {
    if (context.Exception is ValidationException validationException) {
      var errors = validationException.Errors
          .GroupBy(e => e.PropertyName)
          .ToDictionary(
              g => g.Key,
              g => g.Select(e => e.ErrorMessage).ToArray()
          );

      context.Result = new BadRequestObjectResult(new {
        message = "Validation failed",
        errors = errors
      });
      context.ExceptionHandled = true;
    } else if (context.Exception is IdentityValidationException identityException) {
      context.Result = new BadRequestObjectResult(new {
        message = identityException.Message
      });
      context.ExceptionHandled = true;
    } else if (context.Exception is UserNotFoundException userNotFoundException) {
      context.Result = new NotFoundObjectResult(new {
        message = userNotFoundException.Message
      });
      context.ExceptionHandled = true;
    }
  }
}
