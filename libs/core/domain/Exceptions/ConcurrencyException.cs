using System;

namespace Tai.Portal.Core.Domain.Exceptions;

/// <summary>
/// Exception thrown when an optimistic concurrency conflict occurs.
/// </summary>
public class ConcurrencyException : Exception {
  public ConcurrencyException(string message) : base(message) { }
}
