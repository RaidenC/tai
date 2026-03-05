using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tai.Portal.Core.Infrastructure.Persistence.Migrations {
  /// <inheritdoc />
  public partial class AddUserStatus : Migration {
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder) {
      migrationBuilder.AddColumn<int>(
          name: "Status",
          table: "AspNetUsers",
          type: "integer",
          nullable: false,
          defaultValue: 0);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder) {
      migrationBuilder.DropColumn(
          name: "Status",
          table: "AspNetUsers");
    }
  }
}
