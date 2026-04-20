using System;
using MediatR;

namespace Tai.PaymentProtection.Application.Events;

/// <summary>
/// Raised after a claim draft is persisted. Used for cross-cutting fan-out:
/// audit logging today, outbox-to-RabbitMQ in the future.
/// </summary>
public record ClaimDraftSavedEvent(string UserId, string ClaimId, DateTimeOffset SavedAt) : INotification;
