using System;
using System.IO;
using System.Linq;
using FluentAssertions;
using Xunit;

namespace Tai.Portal.Core.Infrastructure.Tests.Messaging;

/// <summary>
/// Static guard against future regressions of the Unit-of-Work invariant:
/// no INotificationHandler implementation may call _dbContext.SaveChangesAsync(...)
/// directly. PortalDbContext orchestrates its own commit. Handlers stage changes.
/// </summary>
public class HandlerInvariantTests {

  [Fact]
  public void NoHandler_CallsDbContextSaveChangesAsync() {
    var handlersDir = LocateHandlersDirectory();
    var offenders = Directory.GetFiles(handlersDir, "*.cs", SearchOption.AllDirectories)
      .Where(path => !path.EndsWith(".g.cs", StringComparison.Ordinal))
      .Select(path => new {
        File = Path.GetFileName(path),
        Lines = File.ReadAllLines(path)
          .Select((line, idx) => new { Line = line.Trim(), Number = idx + 1 })
          .Where(l => !l.Line.StartsWith("//", StringComparison.Ordinal)
                       && l.Line.Contains("_dbContext.SaveChangesAsync", StringComparison.OrdinalIgnoreCase))
          .ToList()
      })
      .Where(x => x.Lines.Count > 0)
      .ToList();

    offenders.Should().BeEmpty(
      "handlers must register changes via Add()/Update()/Remove() and " +
      "post-commit side effects via RegisterPostCommitAction(...). The " +
      "PortalDbContext UoW commits the transaction. Offending lines: " +
      string.Join("; ", offenders.SelectMany(o => o.Lines.Select(l =>
        $"{o.File}:{l.Number}"))));
  }

  private static string LocateHandlersDirectory() {
    // Start from the test assembly's location and traverse up to find the solution root
    var dir = new DirectoryInfo(AppContext.BaseDirectory);
    while (dir != null) {
      // Check for solution file (slnx is the solution file format)
      var solutionFiles = dir.GetFiles("*.slnx");
      if (solutionFiles.Length > 0) {
        // Found solution root - now navigate to the handlers directory
        var handlersPath = Path.Combine(dir.FullName, "libs", "core", "infrastructure",
          "Persistence", "Handlers");
        if (Directory.Exists(handlersPath)) {
          return handlersPath;
        }
      }
      dir = dir.Parent;
    }
    throw new InvalidOperationException("Solution root not found - cannot locate Handlers directory");
  }
}
