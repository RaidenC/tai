using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Moq;
using Tai.PaymentProtection.Application.Interfaces;
using Tai.PaymentProtection.Application.UseCases.Drafts;
using Xunit;

namespace Tai.PaymentProtection.Application.Tests.UseCases.Drafts;

public class DeleteClaimDraftCommandHandlerTests {
  private readonly Mock<IClaimDraftStore> _store = new();
  private readonly DeleteClaimDraftCommandHandler _handler;
  private readonly DeleteClaimDraftCommandValidator _validator = new();

  public DeleteClaimDraftCommandHandlerTests() {
    _handler = new DeleteClaimDraftCommandHandler(_store.Object);
  }

  [Fact]
  public async Task Handle_DelegatesToStore() {
    await _handler.Handle(new DeleteClaimDraftCommand("user-1", "claim-1"), CancellationToken.None);

    _store.Verify(s => s.DeleteAsync("user-1", "claim-1", It.IsAny<CancellationToken>()), Times.Once);
  }

  [Theory]
  [InlineData("", "claim-1", "UserId")]
  [InlineData("user-1", "", "ClaimId")]
  public void Validator_RejectsMissingIds(string userId, string claimId, string field) {
    var result = _validator.Validate(new DeleteClaimDraftCommand(userId, claimId));
    result.IsValid.Should().BeFalse();
    result.Errors.Should().Contain(e => e.PropertyName == field);
  }

  [Fact]
  public async Task Handle_StoreThrows_Throws() {
    _store.Setup(s => s.DeleteAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
          .ThrowsAsync(new InvalidOperationException("Database error"));

    var act = () => _handler.Handle(new DeleteClaimDraftCommand("user-1", "claim-1"), CancellationToken.None);

    await act.Should().ThrowAsync<InvalidOperationException>();
  }

  [Fact]
  public async Task Handle_WhitespaceIds_Validates() {
    // Whitespace-only IDs should be handled by validator
    var result = _validator.Validate(new DeleteClaimDraftCommand("   ", "claim-1"));
    result.IsValid.Should().BeFalse();

    result = _validator.Validate(new DeleteClaimDraftCommand("user-1", "   "));
    result.IsValid.Should().BeFalse();
  }

  [Fact]
  public void Validator_AcceptsValidInput() {
    var result = _validator.Validate(new DeleteClaimDraftCommand("user-123", "claim-456"));
    result.IsValid.Should().BeTrue();
  }

  [Theory]
  [InlineData("user-id")]
  [InlineData("claim-id")]
  [InlineData("a")]
  [InlineData("special-chars-123_abc")]
  public void Validator_AcceptsVariousIdFormats(string claimId) {
    var result = _validator.Validate(new DeleteClaimDraftCommand("user-1", claimId));
    result.IsValid.Should().BeTrue();
  }
}
