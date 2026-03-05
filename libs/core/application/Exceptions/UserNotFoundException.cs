using System;

namespace Tai.Portal.Core.Application.Exceptions;

public class UserNotFoundException : Exception {
  public UserNotFoundException(string userId) : base($"User with ID {userId} was not found.") { }
}
