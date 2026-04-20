using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Tai.PaymentProtection.Infrastructure.Persistence;

/// <summary>
/// Used by 'dotnet ef migrations add/update' so the CLI can build the context
/// without booting borrower-portal-api. Connection string matches docker-compose.
/// </summary>
public class PaymentProtectionDbContextFactory : IDesignTimeDbContextFactory<PaymentProtectionDbContext> {
  public PaymentProtectionDbContext CreateDbContext(string[] args) {
    var connectionString = "Host=localhost;Port=5432;Database=portal;Username=postgres;Password=postgres";
    var options = new DbContextOptionsBuilder<PaymentProtectionDbContext>()
      .UseNpgsql(connectionString, o => {
        o.MigrationsAssembly("Tai.PaymentProtection.Infrastructure");
        o.MigrationsHistoryTable("__EFMigrationsHistory", PaymentProtectionDbContext.SchemaName);
      })
      .Options;
    return new PaymentProtectionDbContext(options);
  }
}
