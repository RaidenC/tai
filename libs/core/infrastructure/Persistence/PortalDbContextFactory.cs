using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

using Tai.Portal.Core.Application.Services;

namespace Tai.Portal.Core.Infrastructure.Persistence;

public class PortalDbContextFactory : IDesignTimeDbContextFactory<PortalDbContext> {
  public PortalDbContext CreateDbContext(string[] args) {
    // This is a hack to get the connection string for design-time tools.
    // It's not ideal, but it works for now.
    var configuration = new ConfigurationBuilder()
        .SetBasePath(Directory.GetCurrentDirectory())
        .AddJsonFile("appsettings.json")
        .Build();

    var optionsBuilder = new DbContextOptionsBuilder<PortalDbContext>();
    optionsBuilder.UseNpgsql(configuration.GetConnectionString("DefaultConnection"));

    return new PortalDbContext(optionsBuilder.Options, new TenantService());
  }
}
