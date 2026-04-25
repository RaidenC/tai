using System;
using System.Threading;
using System.Threading.Tasks;
using Tai.Portal.Core.Application.Interfaces;

namespace Tai.PaymentProtection.Infrastructure.Messaging;

/// <summary>
/// Simple message bus stub for Payment Protection that logs messages to console.
/// This can be replaced with a full outbox implementation when needed.
/// </summary>
public class PaymentProtectionMessageBus : IMessageBus {
  public Task PublishAsync<T>(T message, CancellationToken cancellationToken = default) where T : class {
    Console.WriteLine($"[MessageBus] Publishing: {message.GetType().Name}");
    return Task.CompletedTask;
  }
}
