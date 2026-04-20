using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tai.PaymentProtection.Infrastructure.Persistence.Migrations {
  /// <inheritdoc />
  public partial class InitialPaymentProtection : Migration {
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder) {
      migrationBuilder.EnsureSchema(
          name: "payment_protection");

      migrationBuilder.CreateTable(
          name: "claim_drafts",
          schema: "payment_protection",
          columns: table => new {
            UserId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
            ClaimId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
            EncryptedPayload = table.Column<byte[]>(type: "bytea", nullable: false),
            ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
            CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
            CreatedBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
            LastModifiedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
            LastModifiedBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true)
          },
          constraints: table => {
            table.PrimaryKey("PK_claim_drafts", x => new { x.UserId, x.ClaimId });
          });

      migrationBuilder.CreateIndex(
          name: "IX_claim_drafts_ExpiresAt",
          schema: "payment_protection",
          table: "claim_drafts",
          column: "ExpiresAt");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder) {
      migrationBuilder.DropTable(
          name: "claim_drafts",
          schema: "payment_protection");
    }
  }
}
