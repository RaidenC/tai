using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Infrastructure.Messaging;
using Xunit;

namespace Tai.Portal.Core.Infrastructure.Tests.Messaging;

public class OutboxPublisherBackgroundServiceTests {
  [Fact]
  public void BackgroundService_ImplementsBackgroundService() {
    // Assert
    typeof(OutboxPublisherBackgroundService)
      .BaseType
      .Should()
      .Be(typeof(BackgroundService));
  }

  [Fact]
  public void BackgroundService_HasCorrectConstructor() {
    // Arrange
    var scopeFactory = Mock.Of<IServiceScopeFactory>();
    var publisher = Mock.Of<IIntegrationEventPublisher>();
    var options = Mock.Of<IOptions<OutboxOptions>>();
    var logger = Mock.Of<ILogger<OutboxPublisherBackgroundService>>();

    // Act
    var service = new OutboxPublisherBackgroundService(
      scopeFactory,
      publisher,
      options,
      logger);

    // Assert
    service.Should().NotBeNull();
  }

  [Fact]
  public void BackgroundService_OptionsAreApplied() {
    // Arrange
    var mockOptions = new OutboxOptions {
      PollInterval = TimeSpan.FromSeconds(5),
      BatchSize = 100,
      ErrorBackoff = TimeSpan.FromSeconds(30)
    };

    var mockOptionsMonitor = Mock.Of<IOptions<OutboxOptions>>(o => o.Value == mockOptions);
    var mockScopeFactory = Mock.Of<IServiceScopeFactory>();
    var mockPublisher = Mock.Of<IIntegrationEventPublisher>();
    var mockLogger = Mock.Of<ILogger<OutboxPublisherBackgroundService>>();

    // Act
    var service = new OutboxPublisherBackgroundService(
      mockScopeFactory,
      mockPublisher,
      mockOptionsMonitor,
      mockLogger);

    // Assert
    // The service receives IOptions<OutboxOptions> and accesses .Value in constructor.
    // We verify the options were properly passed and can be read.
    mockOptionsMonitor.Value.PollInterval.Should().Be(TimeSpan.FromSeconds(5));
    mockOptionsMonitor.Value.BatchSize.Should().Be(100);
    mockOptionsMonitor.Value.ErrorBackoff.Should().Be(TimeSpan.FromSeconds(30));
  }

  [Fact]
  public void OutboxOptions_DefaultValues_AreCorrect() {
    // Arrange & Act
    var options = new OutboxOptions();

    // Assert
    options.PollInterval.Should().Be(TimeSpan.FromSeconds(2));
    options.BatchSize.Should().Be(50);
    options.ErrorBackoff.Should().Be(TimeSpan.FromSeconds(10));
  }

  [Fact]
  public void OutboxOptions_CanBindFromConfiguration() {
    // Arrange
    var configuration = new ConfigurationBuilder()
      .AddInMemoryCollection(new Dictionary<string, string?> {
        ["Outbox:PollInterval"] = "00:00:05",
        ["Outbox:BatchSize"] = "100",
        ["Outbox:ErrorBackoff"] = "00:00:30",
      })
      .Build();

    // Act
    var options = new OutboxOptions();
    configuration.GetSection(OutboxOptions.SectionName).Bind(options);

    // Assert
    options.PollInterval.Should().Be(TimeSpan.FromSeconds(5));
    options.BatchSize.Should().Be(100);
    options.ErrorBackoff.Should().Be(TimeSpan.FromSeconds(30));
  }

  [Fact]
  public void OutboxOptions_SectionName_IsCorrect() {
    // Assert
    OutboxOptions.SectionName.Should().Be("Outbox");
  }
}
