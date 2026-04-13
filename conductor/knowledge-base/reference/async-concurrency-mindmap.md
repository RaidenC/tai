---
markmap:
  initialExpandLevel: 4
  colorFreezeLevel: 3
  spacingVertical: 12
---
# 1. Async, Concurrency & Threading

## **1.1 Async Fundamentals**
1. The Thread Pool & Why Async Exists
   - ThreadPool has finite threads (~ProcessorCount initially)
   - `await` returns thread to pool during I/O — zero threads consumed
   - Without async: 1000 concurrent requests = 1000 blocked threads = starvation
2. Task vs ValueTask vs void
   - `Task<T>`: heap-allocated, safe default for all async methods
   - `ValueTask<T>`: zero-alloc when sync, but can only await once
   - `async void`: crashes process on exception — only for event handlers
3. SynchronizationContext & ConfigureAwait
   - ASP.NET Core has NO SynchronizationContext — no deadlock risk
   - WPF/Blazor Server DO have one — `ConfigureAwait(false)` in library code
   - Application code in ASP.NET Core: don't bother with ConfigureAwait
4. CancellationToken — Cooperative Cancellation
   - Always accept as last parameter on async methods
   - ASP.NET Core auto-cancels via `HttpContext.RequestAborted`
   - Cooperative: callee must check/pass the token — not forced
5. IAsyncEnumerable — Streaming Async
   - Async version of `IEnumerable<T>` — lazy, per-item await
   - Keeps memory flat for large result sets (100k+ rows)
   - Cannot parallelize — sequential by design

## **1.2 Concurrency Primitives**
1. SemaphoreSlim — Async-Friendly Locking
   - `await WaitAsync()` yields thread — no blocking
   - `(1, 1)` = async mutex, `(N, N)` = throttle
   - tai-portal uses it for database reset serialization
2. lock & Monitor — CPU-Bound Mutual Exclusion
   - Spins then blocks — cannot use with `await` (C# 13+ compiler error)
   - Lower overhead (~20ns vs ~50ns for SemaphoreSlim)
   - Lock on private `object` field — never `this`, `typeof`, or strings
3. ConcurrentDictionary & Thread-Safe Collections
   - Striped locks over buckets — fine-grained concurrent access
   - `GetOrAdd` factory is NOT atomic — may execute multiple times
   - Regular `Dictionary` + concurrent access = infinite loop (hash table corruption)
4. Interlocked — Atomic Operations
   - CPU-level compare-and-swap — zero contention
   - Single-variable only: counters, flags, reference swaps
   - For multi-variable atomicity, use `lock` instead
5. Channel&lt;T&gt; — Producer-Consumer Pipeline
   - High-performance async queue with backpressure
   - Bounded channels prevent OOM from fast producers
   - In-memory only — data lost on crash (use Outbox for durability)

## **1.3 Parallelism Patterns**
1. Task.WhenAll — Concurrent I/O Fan-Out
   - Starts all tasks, waits for all to complete
   - tai-portal: ValidationPipelineBehavior runs validators concurrently
   - No concurrency limit — use SemaphoreSlim for bounded fan-out
2. Parallel.ForEachAsync — Bounded Parallelism
   - `MaxDegreeOfParallelism` controls concurrent operations
   - Built for async I/O over collections — .NET 6+
   - One exception cancels remaining items (AggregateException)
3. Task.Run — Offloading CPU Work
   - Moves CPU-bound work to ThreadPool thread
   - Use in application code only — never in library code
   - Don't bother for work under 1ms — scheduling overhead exceeds benefit

## **1.4 ASP.NET Core Threading Model**
1. One Request, One Thread (Until Await)
   - Thread returns to pool at each `await`
   - Continuation may resume on a different thread
   - No SynchronizationContext — any thread can continue any request
2. BackgroundService & IHostedService
   - Long-lived background work with lifecycle management
   - Must create scopes via IServiceScopeFactory for Scoped services
   - Unhandled exceptions: .NET 6+ crashes host by default
3. DbContext Is Not Thread-Safe
   - Cannot use Task.WhenAll with same DbContext
   - Each parallel query needs its own DbContext (separate scope)
   - Sequential queries on one DbContext are usually fast enough

## **1.5 Deadly Anti-Patterns**
1. Sync-over-Async (.Result / .Wait())
   - Blocks thread — causes thread pool starvation under load
   - Works in testing, fails in production (high concurrency)
   - #1 cause of unexplained production "hangs" in .NET
2. Async Void — Fire-and-Forget Disasters
   - Cannot be awaited — exceptions crash the process
   - Only valid for UI event handlers (button_Click)
   - Use `_ = DoWorkAsync()` for intentional fire-and-forget
3. Captured Variables in Closures
   - `for` loop variable captured by reference — all tasks see final value
   - `foreach` is safe since C# 5 (per-iteration capture)
   - Silent bug: no exception, just wrong data
