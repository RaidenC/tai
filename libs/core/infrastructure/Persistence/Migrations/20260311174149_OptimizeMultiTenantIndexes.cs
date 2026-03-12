using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tai.Portal.Core.Infrastructure.Persistence.Migrations {
  /// <inheritdoc />
  public partial class OptimizeMultiTenantIndexes : Migration {
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder) {
      migrationBuilder.CreateIndex(
          name: "IX_AuditLogs_TenantId_TimestampDesc",
          table: "AuditLogs",
          columns: new[] { "TenantId", "Timestamp" },
          descending: new[] { false, true });

      migrationBuilder.CreateIndex(
          name: "IX_AspNetUsers_TenantId",
          table: "AspNetUsers",
          column: "TenantId");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder) {
      migrationBuilder.DropIndex(
          name: "IX_AuditLogs_TenantId_TimestampDesc",
          table: "AuditLogs");

      migrationBuilder.DropIndex(
          name: "IX_AspNetUsers_TenantId",
          table: "AspNetUsers");
    }
  }
}
