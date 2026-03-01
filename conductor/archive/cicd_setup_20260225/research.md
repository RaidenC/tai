# Research: CI/CD Setup for TAI Portal

## 1. CI Platform Selection: GitHub Actions
GitHub Actions is the preferred choice given the project's likely hosting on GitHub. It integrates seamlessly with the development workflow.

## 2. Orchestration: Nx Affected
Since this is an Nx monorepo, we MUST use `nx affected` to keep the CI fast. 
- `nx affected -t lint`: Only lints changed projects.
- `nx affected -t build`: Only builds changed projects and their dependencies.
- `nx affected -t test`: Only runs unit tests for changed projects.

### SHA Tracking
To use `affected`, GitHub Actions needs to know the "base" and "head" SHAs. The `nrwl/nx-set-shas` action is standard for this.

## 3. Technology Integration

### .NET (Backend)
- **Setup:** `actions/setup-dotnet`.
- **Restoration:** `dotnet restore`.
- **Testing:** `dotnet test`.
- **Caching:** Cache `~/.nuget/packages`.

### Angular (Frontend)
- **Setup:** `actions/setup-node`.
- **Restoration:** `npm ci`.
- **Testing:** `npx nx test [project]`.
- **Caching:** Cache `node_modules`.

## 4. Pipeline Structure (`main.yml`)

### Jobs:
1.  **Initialize:** Install dependencies and set Nx SHAs.
2.  **Lint & Build:** Parallelizable check for syntax and compilation.
3.  **Test:** Parallelizable check for logic (xUnit, Vitest).
4.  **E2E (Phase 3):** Run Playwright.
5.  **Docker (Phase 2):** Build and push images.

## 5. Security & Secrets
- **Gateway Secret:** Must be stored in GitHub Secrets (`GATEWAY_SECRET`).
- **Postgres Service Container:** 
    - Use GitHub Actions `services` field to spin up a `postgres:17` image.
    - Configure environment variables (`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`).
    - Health check: Mandate a `pg_isready` check before dependent jobs start to ensure the database is fully initialized for integration tests.
    - Connection String: The API will use `Host=postgres` (or `localhost` depending on networking) to connect.

## 6. Infrastructure Compatibility
- **Zoneless/Signal-based Angular:** Requires standard Node.js environment.
- **.NET 10:** Requires latest .NET SDK setup.
- **No NativeAOT:** Standard `dotnet build/publish` is sufficient.

## 7. Next Steps
- Define the `main.yml` scaffolding.
- Implement caching for npm and NuGet.
