namespace Tai.Portal.Core.Application.Interfaces;

public interface IPrivilegeNotificationService {
  Task NotifyPrivilegeChangedAsync(Guid id, string name, CancellationToken cancellationToken);
}
