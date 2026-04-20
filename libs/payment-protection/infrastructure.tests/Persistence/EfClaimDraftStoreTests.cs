using System;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Tai.PaymentProtection.Domain.Entities;
using Tai.PaymentProtection.Infrastructure.Persistence;
using Xunit;

namespace Tai.PaymentProtection.Infrastructure.Tests.Persistence;

public class EfClaimDraftStoreTests {
  private static PaymentProtectionDbContext NewInMemoryContext() {
    var options = new DbContextOptionsBuilder<PaymentProtectionDbContext>()
      .UseInMemoryDatabase(Guid.NewGuid().ToString())
      .Options;
    return new PaymentProtectionDbContext(options);
  }

  [Fact]
  public async Task SaveAsync_NewDraft_PersistsRow() {
    using var ctx = NewInMemoryContext();
    var store = new EfClaimDraftStore(ctx);
    var draft = new ClaimDraft("user-1", "claim-1", new byte[] { 1, 2 }, DateTimeOffset.UtcNow.AddHours(1));

    await store.SaveAsync(draft);

    var loaded = await ctx.ClaimDrafts.FindAsync("user-1", "claim-1");
    loaded.Should().NotBeNull();
    loaded!.EncryptedPayload.Should().BeEquivalentTo(new byte[] { 1, 2 });
  }

  [Fact]
  public async Task GetAsync_ReturnsExistingDraft() {
    using var ctx = NewInMemoryContext();
    var store = new EfClaimDraftStore(ctx);
    var draft = new ClaimDraft("user-1", "claim-1", new byte[] { 9 }, DateTimeOffset.UtcNow.AddHours(1));
    await store.SaveAsync(draft);

    var loaded = await store.GetAsync("user-1", "claim-1");

    loaded.Should().NotBeNull();
    loaded!.UserId.Should().Be("user-1");
  }

  [Fact]
  public async Task GetAsync_MissingDraft_ReturnsNull() {
    using var ctx = NewInMemoryContext();
    var store = new EfClaimDraftStore(ctx);

    var loaded = await store.GetAsync("user-1", "claim-1");

    loaded.Should().BeNull();
  }

  [Fact]
  public async Task DeleteAsync_RemovesDraft() {
    using var ctx = NewInMemoryContext();
    var store = new EfClaimDraftStore(ctx);
    var draft = new ClaimDraft("user-1", "claim-1", new byte[] { 1 }, DateTimeOffset.UtcNow.AddHours(1));
    await store.SaveAsync(draft);

    await store.DeleteAsync("user-1", "claim-1");

    var loaded = await ctx.ClaimDrafts.FindAsync("user-1", "claim-1");
    loaded.Should().BeNull();
  }

  [Fact]
  public async Task DeleteAsync_MissingDraft_DoesNotThrow() {
    using var ctx = NewInMemoryContext();
    var store = new EfClaimDraftStore(ctx);

    var act = async () => await store.DeleteAsync("user-1", "claim-1");

    await act.Should().NotThrowAsync();
  }

  [Fact]
  public async Task SaveAsync_ExistingKey_UpdatesPayload() {
    using var ctx = NewInMemoryContext();
    var store = new EfClaimDraftStore(ctx);
    var first = new ClaimDraft("user-1", "claim-1", new byte[] { 1 }, DateTimeOffset.UtcNow.AddHours(1));
    await store.SaveAsync(first);

    var loaded = await store.GetAsync("user-1", "claim-1");
    loaded!.Update(new byte[] { 2, 3 }, DateTimeOffset.UtcNow.AddHours(2));
    await store.SaveAsync(loaded);

    var reloaded = await store.GetAsync("user-1", "claim-1");
    reloaded!.EncryptedPayload.Should().BeEquivalentTo(new byte[] { 2, 3 });
  }
}
