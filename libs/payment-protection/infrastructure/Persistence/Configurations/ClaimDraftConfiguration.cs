using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Tai.PaymentProtection.Domain.Entities;

namespace Tai.PaymentProtection.Infrastructure.Persistence.Configurations;

public class ClaimDraftConfiguration : IEntityTypeConfiguration<ClaimDraft> {
  public void Configure(EntityTypeBuilder<ClaimDraft> builder) {
    builder.ToTable("claim_drafts");

    builder.HasKey(d => new { d.UserId, d.ClaimId });

    builder.Property(d => d.UserId).HasMaxLength(64).IsRequired();
    builder.Property(d => d.ClaimId).HasMaxLength(64).IsRequired();
    builder.Property(d => d.EncryptedPayload).HasColumnType("bytea").IsRequired();
    builder.Property(d => d.ExpiresAt).IsRequired();

    builder.Property(d => d.CreatedAt).IsRequired();
    builder.Property(d => d.CreatedBy).HasMaxLength(64);
    builder.Property(d => d.LastModifiedAt);
    builder.Property(d => d.LastModifiedBy).HasMaxLength(64);

    builder.HasIndex(d => d.ExpiresAt);
  }
}
