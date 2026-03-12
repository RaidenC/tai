using System;

namespace Tai.Portal.Core.Application.Exceptions;

public class ConcurrencyException : Exception {
  public ConcurrencyException(string message) : base(message) { }
}
