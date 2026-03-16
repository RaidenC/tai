using Microsoft.Extensions.Logging;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Tai.Portal.Core.Application.Interfaces;

namespace Tai.Portal.Core.Infrastructure.Services;

/// <summary>
/// A POC implementation of IMessageBus that logs messages to the console.
/// In a production environment, this would be replaced with MassTransit, Azure Service Bus, or RabbitMQ.
/// </summary>
public class LoggingMessageBus : IMessageBus {
  private readonly ILogger<LoggingMessageBus> _logger;

  public LoggingMessageBus(ILogger<LoggingMessageBus> logger) {
    _logger = logger;
  }

  public Task PublishAsync<T>(T message, CancellationToken cancellationToken = default) where T : class {
    var typeName = typeof(T).Name;
    var payload = JsonSerializer.Serialize(message, new JsonSerializerOptions { WriteIndented = true });

    _logger.LogInformation(" [MESSAGE BUS] Publishing event {EventName}: {Payload}", typeName, payload);

    return Task.CompletedTask;
  }
}
