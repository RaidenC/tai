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
}
