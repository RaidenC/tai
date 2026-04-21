using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tai.Portal.Core.Infrastructure.Persistence.Migrations {
  /// <inheritdoc />
  public partial class AddOutboxMessages : Migration {
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder) {
      migrationBuilder.CreateTable(
          name: "OutboxMessages",
          columns: table => new {
            Id = table.Column<Guid>(type: "uuid", nullable: false),
            EventType = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
            Payload = table.Column<string>(type: "jsonb", nullable: false),
            OccurredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
            ProcessedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
            RetryCount = table.Column<int>(type: "integer", nullable: false),
            Error = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
            CorrelationId = table.Column<string>(type: "text", nullable: true)
          },
          constraints: table => {
            table.PrimaryKey("PK_OutboxMessages", x => x.Id);
          });

      migrationBuilder.CreateIndex(
          name: "IX_OutboxMessages_Unprocessed",
          table: "OutboxMessages",
          column: "OccurredAt",
          filter: "\"ProcessedAt\" IS NULL");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder) {
      migrationBuilder.DropTable(
          name: "OutboxMessages");
    }
  }
}
