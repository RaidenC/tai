using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using MediatR;
using Moq;
using Tai.PaymentProtection.Application.Events;
using Tai.PaymentProtection.Application.Interfaces;
using Tai.PaymentProtection.Application.UseCases.Drafts;
using Tai.PaymentProtection.Domain.Entities;
using Xunit;

namespace Tai.PaymentProtection.Application.Tests.UseCases.Drafts;

public class SaveClaimDraftCommandHandlerTests {
  private readonly Mock<IClaimDraftStore> _store = new();
  private readonly Mock<IPublisher> _publisher = new();
  private readonly SaveClaimDraftCommandHandler _handler;
  private readonly SaveClaimDraftCommandValidator _validator = new();

  public SaveClaimDraftCommandHandlerTests() {
    _handler = new SaveClaimDraftCommandHandler(_store.Object, _publisher.Object);
  }

  [Fact]
  public async Task Handle_NewDraft_PersistsAndPublishesEvent() {
    var payload = new byte[] { 1, 2, 3 };
    var command = new SaveClaimDraftCommand("user-1", "claim-1", payload, TimeSpan.FromHours(24));

    _store.Setup(s => s.GetAsync("user-1", "claim-1", It.IsAny<CancellationToken>()))
          .ReturnsAsync((ClaimDraft?)null);

    await _handler.Handle(command, CancellationToken.None);

    _store.Verify(s => s.SaveAsync(
      It.Is<ClaimDraft>(d => d.UserId == "user-1" && d.ClaimId == "claim-1" && d.EncryptedPayload.Length == 3),
      It.IsAny<CancellationToken>()), Times.Once);
    _publisher.Verify(p => p.Publish(
      It.Is<ClaimDraftSavedEvent>(e => e.UserId == "user-1" && e.ClaimId == "claim-1"),
      It.IsAny<CancellationToken>()), Times.Once);
  }

  [Fact]
  public async Task Handle_ExistingDraft_UpdatesInPlace() {
    var existing = new ClaimDraft("user-1", "claim-1", new byte[] { 9 }, DateTimeOffset.UtcNow.AddHours(1));
    _store.Setup(s => s.GetAsync("user-1", "claim-1", It.IsAny<CancellationToken>()))
          .ReturnsAsync(existing);

    var newPayload = new byte[] { 1, 2, 3 };
    var command = new SaveClaimDraftCommand("user-1", "claim-1", newPayload, TimeSpan.FromHours(24));

    await _handler.Handle(command, CancellationToken.None);

    existing.EncryptedPayload.Should().BeEquivalentTo(newPayload);
    _store.Verify(s => s.SaveAsync(existing, It.IsAny<CancellationToken>()), Times.Once);
  }

  [Theory]
  [InlineData("", "claim-1", "UserId")]
  [InlineData("user-1", "", "ClaimId")]
  public void Validator_RejectsMissingIds(string userId, string claimId, string field) {
    var cmd = new SaveClaimDraftCommand(userId, claimId, new byte[] { 1 }, TimeSpan.FromHours(1));
    var result = _validator.Validate(cmd);
    result.IsValid.Should().BeFalse();
    result.Errors.Should().Contain(e => e.PropertyName == field);
  }

  [Fact]
  public void Validator_RejectsEmptyPayload() {
    var cmd = new SaveClaimDraftCommand("user-1", "claim-1", Array.Empty<byte>(), TimeSpan.FromHours(1));
    var result = _validator.Validate(cmd);
    result.IsValid.Should().BeFalse();
    result.Errors.Should().Contain(e => e.PropertyName == "EncryptedPayload");
  }
}
