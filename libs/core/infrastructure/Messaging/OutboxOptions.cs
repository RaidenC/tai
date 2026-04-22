using System;

namespace Tai.Portal.Core.Infrastructure.Messaging;

public class OutboxOptions {
  public const string SectionName = "Outbox";

  public TimeSpan PollInterval { get; set; } = TimeSpan.FromSeconds(2);
  public TimeSpan ErrorBackoff { get; set; } = TimeSpan.FromSeconds(10);
  public int BatchSize { get; set; } = 50;
}
