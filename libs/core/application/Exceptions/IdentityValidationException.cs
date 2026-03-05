using System;

namespace Tai.Portal.Core.Application.Exceptions;

public class IdentityValidationException : Exception {
  public IdentityValidationException(string message) : base(message) { }
}
