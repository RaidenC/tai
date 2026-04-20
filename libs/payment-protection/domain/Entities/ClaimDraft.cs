using System;
using Tai.Portal.Core.Domain.Interfaces;

namespace Tai.PaymentProtection.Domain.Entities;

/// <summary>
/// A borrower's in-progress claim form. Stored as an opaque encrypted byte[]
/// (the frontend encrypts before send / decrypts after fetch). The server treats
/// the payload as opaque — no business logic on contents.
///
/// Composite key: (UserId, ClaimId). One borrower may have multiple draft claims.
/// TTL via ExpiresAt — queries filter expired rows, no background cleanup for POC.
/// </summary>
public class ClaimDraft : IAuditableEntity {
  public string UserId { get; private set; } = string.Empty;
  public string ClaimId { get; private set; } = string.Empty;
  public byte[] EncryptedPayload { get; private set; } = Array.Empty<byte>();
  public DateTimeOffset ExpiresAt { get; private set; }

  public DateTimeOffset CreatedAt { get; set; }
  public string? CreatedBy { get; set; }
  public DateTimeOffset? LastModifiedAt { get; set; }
  public string? LastModifiedBy { get; set; }

  // EF Core parameterless constructor
  private ClaimDraft() { }

  public ClaimDraft(string userId, string claimId, byte[] encryptedPayload, DateTimeOffset expiresAt) {
    if (string.IsNullOrWhiteSpace(userId)) {
      throw new ArgumentException("UserId cannot be empty.", nameof(userId));
    }
    if (string.IsNullOrWhiteSpace(claimId)) {
      throw new ArgumentException("ClaimId cannot be empty.", nameof(claimId));
    }
    if (encryptedPayload == null || encryptedPayload.Length == 0) {
      throw new ArgumentException("Payload cannot be empty.", nameof(encryptedPayload));
    }

    UserId = userId;
    ClaimId = claimId;
    EncryptedPayload = encryptedPayload;
    ExpiresAt = expiresAt;
    CreatedAt = DateTimeOffset.UtcNow;
  }

  public void Update(byte[] encryptedPayload, DateTimeOffset expiresAt) {
    if (encryptedPayload == null || encryptedPayload.Length == 0) {
      throw new ArgumentException("Payload cannot be empty.", nameof(encryptedPayload));
    }
    EncryptedPayload = encryptedPayload;
    ExpiresAt = expiresAt;
    LastModifiedAt = DateTimeOffset.UtcNow;
  }

  public bool IsExpired(DateTimeOffset now) => now >= ExpiresAt;
}
