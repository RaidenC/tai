using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Tai.Portal.Core.Domain.ValueObjects;

#nullable disable

namespace Tai.Portal.Core.Infrastructure.Persistence.Migrations {
  /// <inheritdoc />
  public partial class AddPrivileges : Migration {
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder) {
      migrationBuilder.CreateTable(
          name: "Privileges",
          columns: table => new {
            Id = table.Column<Guid>(type: "uuid", nullable: false),
            Name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
            Description = table.Column<string>(type: "text", nullable: false),
            Module = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
            RiskLevel = table.Column<int>(type: "integer", nullable: false),
            JitSettings = table.Column<JitSettings>(type: "jsonb", nullable: false),
            IsActive = table.Column<bool>(type: "boolean", nullable: false),
            SupportedScopes = table.Column<string>(type: "jsonb", nullable: false),
            CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
            CreatedBy = table.Column<string>(type: "text", nullable: true),
            LastModifiedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
            LastModifiedBy = table.Column<string>(type: "text", nullable: true),
            xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
          },
          constraints: table => {
            table.PrimaryKey("PK_Privileges", x => x.Id);
          });

      migrationBuilder.CreateIndex(
          name: "IX_Privileges_Module",
          table: "Privileges",
          column: "Module");

      migrationBuilder.CreateIndex(
          name: "IX_Privileges_Name",
          table: "Privileges",
          column: "Name",
          unique: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder) {
      migrationBuilder.DropTable(
          name: "Privileges");
    }
  }
}
