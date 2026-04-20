using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Moq;
using Tai.PaymentProtection.Application.Interfaces;
using Tai.PaymentProtection.Application.UseCases.Drafts;
using Tai.PaymentProtection.Domain.Entities;
using Xunit;

namespace Tai.PaymentProtection.Application.Tests.UseCases.Drafts;

public class GetClaimDraftQueryHandlerTests {
  private readonly Mock<IClaimDraftStore> _store = new();
  private readonly GetClaimDraftQueryHandler _handler;

  public GetClaimDraftQueryHandlerTests() {
    _handler = new GetClaimDraftQueryHandler(_store.Object);
  }

  [Fact]
  public async Task Handle_ExistingNonExpiredDraft_ReturnsResult() {
    var draft = new ClaimDraft("user-1", "claim-1", new byte[] { 1, 2 }, DateTimeOffset.UtcNow.AddHours(1));
    _store.Setup(s => s.GetAsync("user-1", "claim-1", It.IsAny<CancellationToken>())).ReturnsAsync(draft);

    var result = await _handler.Handle(new GetClaimDraftQuery("user-1", "claim-1"), CancellationToken.None);

    result.Should().NotBeNull();
    result!.EncryptedPayload.Should().BeEquivalentTo(new byte[] { 1, 2 });
  }

  [Fact]
  public async Task Handle_MissingDraft_ReturnsNull() {
    _store.Setup(s => s.GetAsync("user-1", "claim-1", It.IsAny<CancellationToken>())).ReturnsAsync((ClaimDraft?)null);

    var result = await _handler.Handle(new GetClaimDraftQuery("user-1", "claim-1"), CancellationToken.None);

    result.Should().BeNull();
  }

  [Fact]
  public async Task Handle_ExpiredDraft_ReturnsNull() {
    var expired = new ClaimDraft("user-1", "claim-1", new byte[] { 1 }, DateTimeOffset.UtcNow.AddSeconds(-1));
    _store.Setup(s => s.GetAsync("user-1", "claim-1", It.IsAny<CancellationToken>())).ReturnsAsync(expired);

    var result = await _handler.Handle(new GetClaimDraftQuery("user-1", "claim-1"), CancellationToken.None);

    result.Should().BeNull();
  }
}
