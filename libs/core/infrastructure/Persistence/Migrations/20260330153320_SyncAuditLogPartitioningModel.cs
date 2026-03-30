using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tai.Portal.Core.Infrastructure.Persistence.Migrations {
  /// <inheritdoc />
  public partial class SyncAuditLogPartitioningModel : Migration {
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder) {
      // Index already created manually in the previous AddPartitionedAuditLogs migration.
      // This migration exists purely to update the ModelSnapshot.
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder) {
    }
  }
}
