using System;
using System.Data.Common;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Respawn;
using Tai.Portal.Core.Infrastructure.Persistence;
using Testcontainers.PostgreSql;
using Xunit;

namespace Tai.Portal.Core.Infrastructure.Tests.Fixtures;

public class DatabaseFixture : IAsyncLifetime {
  private readonly PostgreSqlContainer _dbContainer = new PostgreSqlBuilder()
    .WithImage("postgres:16-alpine")
    .WithDatabase("portal_test")
    .WithUsername("postgres")
    .WithPassword("postgres")
    .Build();

  private DbConnection _dbConnection = null!;
  private Respawner _respawner = null!;

  public WebApplicationFactory<Program> Factory { get; private set; } = null!;

  public async Task InitializeAsync() {
    await _dbContainer.StartAsync();

    // Create a factory that overrides the DB connection string
    Factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder => {
      builder.ConfigureServices(services => {
        // Find and remove the existing DbContext registration
        var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<PortalDbContext>));
        if (descriptor != null) {
          services.Remove(descriptor);
        }

        services.AddDbContext<PortalDbContext>(options => {
          options.UseNpgsql(_dbContainer.GetConnectionString());
        });
      });
    });

    // Ensure database is created and migrations are applied
    using var scope = Factory.Services.CreateScope();
    var context = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
    await context.Database.MigrateAsync();

    // Initialize Respawn for fast database resets between tests
    _dbConnection = new NpgsqlConnection(_dbContainer.GetConnectionString());
    await _dbConnection.OpenAsync();

    _respawner = await Respawner.CreateAsync(_dbConnection, new RespawnerOptions {
      DbAdapter = DbAdapter.Postgres,
      SchemasToInclude = new[] { "public" },
      // Ignore EF Core migration history so we don't drop the schema state
      TablesToIgnore = new[] { new Respawn.Graph.Table("__EFMigrationsHistory") }
    });
  }

  public async Task ResetDatabaseAsync() {
    await _respawner.ResetAsync(_dbConnection);
  }

  public async Task DisposeAsync() {
    if (_dbConnection != null) {
      await _dbConnection.CloseAsync();
      await _dbConnection.DisposeAsync();
    }
    await _dbContainer.DisposeAsync();
  }
}

// Collection fixture so the container is shared across all test classes
[CollectionDefinition("Database collection")]
public class DatabaseCollection : ICollectionFixture<DatabaseFixture> {
  // This class has no code, and is never created. Its purpose is simply
  // to be the place to apply [CollectionDefinition] and all the
  // ICollectionFixture<> interfaces.
}
