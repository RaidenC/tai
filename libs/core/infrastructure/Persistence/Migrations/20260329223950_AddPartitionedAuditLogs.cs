using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tai.Portal.Core.Infrastructure.Persistence.Migrations {
  /// <inheritdoc />
  public partial class AddPartitionedAuditLogs : Migration {
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder) {
      // 1. Rename existing table AND its primary key constraint to avoid name collision
      migrationBuilder.Sql("ALTER TABLE \"AuditLogs\" RENAME TO \"AuditLogs_Old\";");
      migrationBuilder.Sql("ALTER TABLE \"AuditLogs_Old\" RENAME CONSTRAINT \"PK_AuditLogs\" TO \"PK_AuditLogs_Old\";");

      // 2. Create partitioned table
      migrationBuilder.Sql(@"
            CREATE TABLE ""AuditLogs"" (
                ""Id"" uuid NOT NULL,
                ""Timestamp"" timestamp with time zone NOT NULL,
                ""Action"" text NOT NULL,
                ""UserId"" text NOT NULL,
                ""ResourceId"" text NOT NULL,
                ""TenantId"" uuid NOT NULL,
                ""CorrelationId"" text,
                ""IpAddress"" text,
                ""Details"" text,
                CONSTRAINT ""PK_AuditLogs"" PRIMARY KEY (""Id"", ""Timestamp"")
            ) PARTITION BY RANGE (""Timestamp"");
        ");

      // 3. Create a default partition
      migrationBuilder.Sql("CREATE TABLE \"AuditLogs_Default\" PARTITION OF \"AuditLogs\" DEFAULT;");

      // 4. Migrate existing data
      migrationBuilder.Sql(@"
          INSERT INTO ""AuditLogs"" (""Id"", ""Timestamp"", ""Action"", ""UserId"", ""ResourceId"", ""TenantId"", ""CorrelationId"", ""IpAddress"", ""Details"")
          SELECT ""Id"", ""Timestamp"", ""Action"", ""UserId"", ""ResourceId"", ""TenantId"", ""CorrelationId"", ""IpAddress"", ""Details"" 
          FROM ""AuditLogs_Old"";
      ");
      // 5. Drop old table
      migrationBuilder.Sql("DROP TABLE \"AuditLogs_Old\";");

      // 6. Create indexes on the partitioned table
      migrationBuilder.CreateIndex(
          name: "IX_AuditLogs_Id",
          table: "AuditLogs",
          column: "Id");

      migrationBuilder.CreateIndex(
          name: "IX_AuditLogs_TenantId_UserId_TimestampDesc", table: "AuditLogs",
          columns: new[] { "TenantId", "UserId", "Timestamp" },
          descending: new[] { false, false, true });

      migrationBuilder.CreateIndex(
          name: "IX_AuditLogs_TenantId_TimestampDesc",
          table: "AuditLogs",
          columns: new[] { "TenantId", "Timestamp" },
          descending: new[] { false, true });
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder) {
      // Reverse the process: Convert back to a standard table if needed, though usually partitioning is a one-way street in POCs.
      // For completeness:
      migrationBuilder.Sql("ALTER TABLE \"AuditLogs\" RENAME TO \"AuditLogs_Partitioned\";");

      migrationBuilder.Sql(@"
                CREATE TABLE ""AuditLogs"" (
                    ""Id"" uuid NOT NULL,
                    ""Timestamp"" timestamp with time zone NOT NULL,
                    ""Action"" text NOT NULL,
                    ""UserId"" text NOT NULL,
                    ""ResourceId"" text NOT NULL,
                    ""TenantId"" uuid NOT NULL,
                    ""CorrelationId"" text,
                    ""IpAddress"" text,
                    ""Details"" text,
                    CONSTRAINT ""PK_AuditLogs_Old"" PRIMARY KEY (""Id"")
                );
            ");

      migrationBuilder.Sql("INSERT INTO \"AuditLogs\" SELECT * FROM \"AuditLogs_Partitioned\";");
      migrationBuilder.Sql("DROP TABLE \"AuditLogs_Partitioned\" CASCADE;");

      migrationBuilder.CreateIndex(
          name: "IX_AuditLogs_TenantId_TimestampDesc",
          table: "AuditLogs",
          columns: new[] { "TenantId", "Timestamp" },
          descending: new[] { false, true });
    }
  }
}
