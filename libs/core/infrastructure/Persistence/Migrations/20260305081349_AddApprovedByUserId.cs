using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tai.Portal.Core.Infrastructure.Persistence.Migrations {
  /// <inheritdoc />
  public partial class AddApprovedByUserId : Migration {
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder) {
      migrationBuilder.AddColumn<string>(
          name: "ApprovedByUserId",
          table: "AspNetUsers",
          type: "text",
          nullable: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder) {
      migrationBuilder.DropColumn(
          name: "ApprovedByUserId",
          table: "AspNetUsers");
    }
  }
}
