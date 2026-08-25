using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Tai.Portal.Core.Infrastructure.Persistence;
using Testcontainers.PostgreSql;
using Xunit;

namespace Tai.Portal.Api.IntegrationTests;

public class SeedDataIsolationTests : IAsyncLifetime {
  private readonly PostgreSqlContainer _firstDatabase = new PostgreSqlBuilder("postgres:17").Build();
  private readonly PostgreSqlContainer _secondDatabase = new PostgreSqlBuilder("postgres:17").Build();
  private WebApplicationFactory<Program>? _firstFactory;
  private WebApplicationFactory<Program>? _secondFactory;

  public async Task InitializeAsync() {
    await Task.WhenAll(_firstDatabase.StartAsync(), _secondDatabase.StartAsync());
  }

  public async Task DisposeAsync() {
    if (_secondFactory is not null) await _secondFactory.DisposeAsync();
    if (_firstFactory is not null) await _firstFactory.DisposeAsync();
    await _secondDatabase.DisposeAsync();
    await _firstDatabase.DisposeAsync();
  }

  [Fact]
  public async Task SeedsEachDatabase_WhenFactoriesUseDifferentConnections() {
    _firstFactory = CreateFactory(_firstDatabase);
    _ = _firstFactory.Server;

    // Force the first database to be seeded even when another test initialized
    // SeedData earlier in this process.
    Tai.Portal.Api.SeedData.Initialize(_firstFactory.Services, force: true);

    _secondFactory = CreateFactory(_secondDatabase);
    _ = _secondFactory.Server;

    using var scope = _secondFactory.Services.CreateScope();
    var context = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
    var privilegeCount = await context.Privileges.IgnoreQueryFilters().CountAsync();

    Assert.True(privilegeCount >= 11, $"Expected seeded privileges, found {privilegeCount}.");
  }

  private static WebApplicationFactory<Program> CreateFactory(PostgreSqlContainer database) {
    return new WebApplicationFactory<Program>().WithWebHostBuilder(builder => {
      builder.ConfigureServices(services => {
        var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<PortalDbContext>));
        if (descriptor is not null) services.Remove(descriptor);

        services.AddDbContext<PortalDbContext>(options => {
          var dataSource = new NpgsqlDataSourceBuilder(database.GetConnectionString());
          dataSource.EnableDynamicJson();
          options.UseNpgsql(dataSource.Build());
        });
      });
    });
  }
}
