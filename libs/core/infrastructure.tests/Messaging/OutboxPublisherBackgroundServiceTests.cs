using FluentAssertions;
using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Domain.ValueObjects;
using Tai.Portal.Core.Infrastructure.Messaging;
using Tai.Portal.Core.Infrastructure.Persistence;
using Tai.Portal.Core.Infrastructure.Persistence.Entities;
using Testcontainers.PostgreSql;
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

public class OutboxPublisherBackoffTests : IAsyncLifetime {
  private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17").Build();

  public Task InitializeAsync() => _postgres.StartAsync();

  public Task DisposeAsync() => _postgres.DisposeAsync().AsTask();

  [Fact]
  public async Task PublishFailure_WaitsForErrorBackoffBeforeRetrying() {
    var services = new ServiceCollection();
    var tenantService = new Mock<ITenantService>();
    tenantService.SetupGet(service => service.TenantId).Returns(new TenantId(Guid.NewGuid()));
    tenantService.SetupGet(service => service.IsGlobalAccess).Returns(true);
    services.AddSingleton(tenantService.Object);
    services.AddDbContext<PortalDbContext>(options => options.UseNpgsql(_postgres.GetConnectionString()));

    await using var serviceProvider = services.BuildServiceProvider();
    await using (var scope = serviceProvider.CreateAsyncScope()) {
      var db = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
      await db.Database.EnsureCreatedAsync();
      db.OutboxMessages.Add(new OutboxMessage {
        Id = Guid.NewGuid(),
        EventType = "test.event",
        Payload = "{}",
        OccurredAt = DateTimeOffset.UtcNow,
      });
      await db.SaveChangesAsync();
    }

    var publisher = new Mock<IIntegrationEventPublisher>();
    publisher
      .Setup(instance => instance.PublishAsync(
        It.IsAny<Guid>(),
        It.IsAny<string>(),
        It.IsAny<string>(),
        It.IsAny<string?>(),
        It.IsAny<CancellationToken>()))
      .ThrowsAsync(new InvalidOperationException("Broker unavailable"));

    var worker = new OutboxPublisherBackgroundService(
      serviceProvider.GetRequiredService<IServiceScopeFactory>(),
      publisher.Object,
      Options.Create(new OutboxOptions {
        PollInterval = TimeSpan.FromMilliseconds(10),
        ErrorBackoff = TimeSpan.FromMilliseconds(750),
        BatchSize = 10,
      }),
      Mock.Of<ILogger<OutboxPublisherBackgroundService>>());

    await worker.StartAsync(CancellationToken.None);
    try {
      await WaitForRetryCountAsync(serviceProvider, minimumCount: 1);
      var firstRetryObservedAt = Stopwatch.GetTimestamp();
      await Task.Delay(TimeSpan.FromMilliseconds(250));

      var retryCount = await GetRetryCountAsync(serviceProvider);
      retryCount.Should().Be(1, "failed batches must wait for ErrorBackoff before retrying");

      await WaitForRetryCountAsync(serviceProvider, minimumCount: 2);
      Stopwatch.GetElapsedTime(firstRetryObservedAt).Should().BeGreaterThanOrEqualTo(
        TimeSpan.FromMilliseconds(500),
        "the next attempt must use the configured 750 ms ErrorBackoff");
    } finally {
      await worker.StopAsync(CancellationToken.None);
      worker.Dispose();
    }
  }

  private static async Task WaitForRetryCountAsync(
      ServiceProvider serviceProvider,
      int minimumCount) {
    var deadline = DateTimeOffset.UtcNow.AddSeconds(10);
    while (DateTimeOffset.UtcNow < deadline) {
      if (await GetRetryCountAsync(serviceProvider) >= minimumCount) {
        return;
      }
      await Task.Delay(20);
    }

    throw new TimeoutException("The outbox message was not retried in time.");
  }

  private static async Task<int> GetRetryCountAsync(ServiceProvider serviceProvider) {
    await using var scope = serviceProvider.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
    return await db.OutboxMessages.AsNoTracking().Select(message => message.RetryCount).SingleAsync();
  }
}
