namespace Tai.Portal.Core.Infrastructure.Messaging;

public class RabbitMqOptions {
  public const string SectionName = "RabbitMq";

  public string HostName { get; set; } = "localhost";
  public int Port { get; set; } = 5672;
  public string UserName { get; set; } = "portal";
  public string Password { get; set; } = "portal";
  public string VirtualHost { get; set; } = "/";

  /// <summary>Topic exchange name. Created (durable) on connection open.</summary>
  public string ExchangeName { get; set; } = "portal.events";

  /// <summary>Publisher confirm wait timeout, milliseconds.</summary>
  public int ConfirmTimeoutMs { get; set; } = 5000;
}
