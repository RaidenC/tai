using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using RabbitMQ.Client;
using Tai.Portal.Core.Infrastructure.Persistence;
using Testcontainers.PostgreSql;
using Testcontainers.RabbitMq;
using Xunit;

namespace portal_api.integration_tests.Outbox;

public class OutboxFixture : IAsyncLifetime {
  public PostgreSqlContainer Postgres { get; } = new PostgreSqlBuilder("postgres:17")
    .WithDatabase("portal_test")
    .WithUsername("postgres")
    .WithPassword("postgres")
    .Build();

  public RabbitMqContainer Rabbit { get; } = new RabbitMqBuilder()
    .WithImage("rabbitmq:3-management")
    .WithUsername("portal")
    .WithPassword("portal")
    .Build();

  public WebApplicationFactory<Program> Factory { get; private set; } = null!;

  public async Task InitializeAsync() {
    await Task.WhenAll(Postgres.StartAsync(), Rabbit.StartAsync());

    Factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder => {
      builder.ConfigureAppConfiguration((_, cfg) => {
        cfg.AddInMemoryCollection(new Dictionary<string, string?> {
          ["RabbitMq:HostName"] = Rabbit.Hostname,
          ["RabbitMq:Port"] = Rabbit.GetMappedPublicPort(5672).ToString(),
          ["RabbitMq:UserName"] = "portal",
          ["RabbitMq:Password"] = "portal",
          ["RabbitMq:ExchangeName"] = "portal.events",
          ["Outbox:PollInterval"] = "00:00:00.500",
          ["Outbox:BatchSize"] = "10",
        });
      });
      builder.ConfigureServices(services => {
        var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<PortalDbContext>));
        if (descriptor != null) services.Remove(descriptor);
        services.AddDbContext<PortalDbContext>(options => {
          var npgsql = new NpgsqlDataSourceBuilder(Postgres.GetConnectionString());
          npgsql.EnableDynamicJson();
          options.UseNpgsql(npgsql.Build());
        });
      });
    });

    using var scope = Factory.Services.CreateScope();
    var ctx = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
    await ctx.Database.MigrateAsync();
  }

  /// <summary>
  /// Declares a temporary queue + binding for tests so the publisher's messages
  /// land somewhere we can read. Returns (channel, queueName) — caller owns disposal.
  /// </summary>
  public (IConnection conn, IModel channel, string queueName) BindTestQueue(string routingKeyPattern) {
    var factory = new ConnectionFactory {
      HostName = Rabbit.Hostname,
      Port = Rabbit.GetMappedPublicPort(5672),
      UserName = "portal",
      Password = "portal",
    };
    var conn = factory.CreateConnection("integration-test");
    var ch = conn.CreateModel();
    ch.ExchangeDeclare("portal.events", ExchangeType.Topic, durable: true);
    var q = ch.QueueDeclare(queue: "", durable: false, exclusive: true, autoDelete: true).QueueName;
    ch.QueueBind(q, "portal.events", routingKeyPattern);
    return (conn, ch, q);
  }

  public async Task DisposeAsync() {
    await Factory.DisposeAsync();
    await Postgres.DisposeAsync();
    await Rabbit.DisposeAsync();
  }
}

[CollectionDefinition("Outbox")]
public class OutboxCollection : ICollectionFixture<OutboxFixture> { }
