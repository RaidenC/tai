using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tai.Portal.Core.Infrastructure.Persistence.Migrations {
  /// <inheritdoc />
  public partial class AddUserPrivileges : Migration {
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder) {
      migrationBuilder.CreateTable(
          name: "UserPrivileges",
          columns: table => new {
            UserId = table.Column<string>(type: "text", nullable: false),
            PrivilegeId = table.Column<Guid>(type: "uuid", nullable: false),
            CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
            CreatedBy = table.Column<string>(type: "text", nullable: true),
            LastModifiedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
            LastModifiedBy = table.Column<string>(type: "text", nullable: true)
          },
          constraints: table => {
            table.PrimaryKey("PK_UserPrivileges", x => new { x.UserId, x.PrivilegeId });
            table.ForeignKey(
                      name: "FK_UserPrivileges_AspNetUsers_UserId",
                      column: x => x.UserId,
                      principalTable: "AspNetUsers",
                      principalColumn: "Id",
                      onDelete: ReferentialAction.Cascade);
            table.ForeignKey(
                      name: "FK_UserPrivileges_Privileges_PrivilegeId",
                      column: x => x.PrivilegeId,
                      principalTable: "Privileges",
                      principalColumn: "Id",
                      onDelete: ReferentialAction.Cascade);
          });

      migrationBuilder.CreateIndex(
          name: "IX_UserPrivileges_PrivilegeId",
          table: "UserPrivileges",
          column: "PrivilegeId");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder) {
      migrationBuilder.DropTable(
          name: "UserPrivileges");
    }
  }
}
