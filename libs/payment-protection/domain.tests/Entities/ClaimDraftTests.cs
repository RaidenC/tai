using System;
using FluentAssertions;
using Tai.PaymentProtection.Domain.Entities;
using Xunit;

namespace Tai.PaymentProtection.Domain.Tests;

public class ClaimDraftTests {
  [Fact]
  public void Constructor_ValidInput_CreatesInstance() {
    var payload = new byte[] { 1, 2, 3 };
    var expiresAt = DateTimeOffset.UtcNow.AddHours(1);

    var draft = new ClaimDraft("user-1", "claim-1", payload, expiresAt);

    draft.UserId.Should().Be("user-1");
    draft.ClaimId.Should().Be("claim-1");
    draft.EncryptedPayload.Should().BeEquivalentTo(payload);
    draft.ExpiresAt.Should().Be(expiresAt);
  }

  [Theory]
  [InlineData(null)]
  [InlineData("")]
  [InlineData("   ")]
  public void Constructor_InvalidUserId_ThrowsArgumentException(string? userId) {
    var payload = new byte[] { 1 };
    var expiresAt = DateTimeOffset.UtcNow.AddHours(1);

    var act = () => new ClaimDraft(userId!, "claim-1", payload, expiresAt);

    act.Should().Throw<ArgumentException>().WithMessage("*UserId*");
  }

  [Theory]
  [InlineData(null)]
  [InlineData("")]
  [InlineData("   ")]
  public void Constructor_InvalidClaimId_ThrowsArgumentException(string? claimId) {
    var payload = new byte[] { 1 };
    var expiresAt = DateTimeOffset.UtcNow.AddHours(1);

    var act = () => new ClaimDraft("user-1", claimId!, payload, expiresAt);

    act.Should().Throw<ArgumentException>().WithMessage("*ClaimId*");
  }

  [Theory]
  [InlineData(null)]
  [InlineData(new byte[0])]
  public void Constructor_InvalidPayload_ThrowsArgumentException(byte[]? payload) {
    var expiresAt = DateTimeOffset.UtcNow.AddHours(1);

    var act = () => new ClaimDraft("user-1", "claim-1", payload!, expiresAt);

    act.Should().Throw<ArgumentException>().WithMessage("*Payload*");
  }

  [Fact]
  public void Update_ValidPayload_UpdatesSuccessfully() {
    var draft = new ClaimDraft("user-1", "claim-1", new byte[] { 1 }, DateTimeOffset.UtcNow.AddHours(1));
    var newPayload = new byte[] { 4, 5, 6 };
    var newExpiresAt = DateTimeOffset.UtcNow.AddHours(2);

    draft.Update(newPayload, newExpiresAt);

    draft.EncryptedPayload.Should().BeEquivalentTo(newPayload);
    draft.ExpiresAt.Should().Be(newExpiresAt);
  }

  [Theory]
  [InlineData(null)]
  [InlineData(new byte[0])]
  public void Update_InvalidPayload_ThrowsArgumentException(byte[]? payload) {
    var draft = new ClaimDraft("user-1", "claim-1", new byte[] { 1 }, DateTimeOffset.UtcNow.AddHours(1));

    var act = () => draft.Update(payload!, DateTimeOffset.UtcNow.AddHours(1));

    act.Should().Throw<ArgumentException>().WithMessage("*Payload*");
  }

  [Fact]
  public void IsExpired_NotYetExpired_ReturnsFalse() {
    var draft = new ClaimDraft("user-1", "claim-1", new byte[] { 1 }, DateTimeOffset.UtcNow.AddHours(1));

    draft.IsExpired(DateTimeOffset.UtcNow).Should().BeFalse();
  }

  [Fact]
  public void IsExpired_AlreadyExpired_ReturnsTrue() {
    var draft = new ClaimDraft("user-1", "claim-1", new byte[] { 1 }, DateTimeOffset.UtcNow.AddSeconds(-1));

    draft.IsExpired(DateTimeOffset.UtcNow).Should().BeTrue();
  }

  [Fact]
  public void IsExpired_ExactlyAtExpiry_ReturnsTrue() {
    var expiresAt = DateTimeOffset.UtcNow;
    var draft = new ClaimDraft("user-1", "claim-1", new byte[] { 1 }, expiresAt);

    draft.IsExpired(expiresAt).Should().BeTrue();
  }

  [Fact]
  public void Constructor_SetsAuditFields() {
    var expiresAt = DateTimeOffset.UtcNow.AddHours(1);

    var draft = new ClaimDraft("user-1", "claim-1", new byte[] { 1 }, expiresAt);

    draft.CreatedAt.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(5));
    draft.CreatedBy.Should().BeNull(); // Not set by constructor
  }

  [Fact]
  public void Update_UpdatesAuditFields() {
    var draft = new ClaimDraft("user-1", "claim-1", new byte[] { 1 }, DateTimeOffset.UtcNow.AddHours(1));

    draft.Update(new byte[] { 2 }, DateTimeOffset.UtcNow.AddHours(2));

    draft.LastModifiedAt.Should().NotBeNull();
    draft.LastModifiedBy.Should().BeNull();
  }
}
