namespace Tai.Portal.Core.Application.Models;

public record PaginatedList<T>(List<T> Items, int TotalCount, int PageNumber, int PageSize);
