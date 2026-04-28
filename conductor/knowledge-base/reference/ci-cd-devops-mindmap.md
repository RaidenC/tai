# CI/CD & DevOps — Mindmap

## 1. Containerization
### 1.1 Docker Fundamentals & Image Layers
- Image: read-only template (like a class)
- Container: running instance of an image (like an object)
- Layer: each Dockerfile instruction creates cached layer
- Registry: stores images (Docker Hub, GitHub ECR, AWS ECR)
- Key: Image = template, Container = running instance

### 1.2 Multi-Stage Builds for .NET & Angular
- Multiple FROM instructions in one Dockerfile
- Build stage: full SDK (700MB+) for compilation
- Runtime stage: minimal image (~80MB for .NET, ~20MB for Angular)
- Result: 90% size reduction
- Base images: Alpine (musl), Distroless (no shell)

### 1.3 Docker Compose for Local Development
- `docker compose up` starts all services
- Services: PostgreSQL, RabbitMQ, Redis, app services
- `depends_on` with `service_healthy` for startup order
- Volumes persist data between runs
- Use `-v` to reset state

---

## 2. CI Pipeline
### 2.1 Pipeline Stages
1. **Build** — compile code
2. **Test** — unit + integration tests
3. **Lint** — code style + static analysis
4. **Security Scan** — dependency vulnerabilities, secrets
5. **Artifact** — push Docker image / NuGet package

### 2.2 Nx Affected for Monorepo CI
- `nx affected` analyzes git diff to find impacted projects
- Only runs build/test/lint for affected projects
- Reduces CI time by 60-80%
- Example: change button.ts → builds: design-system, portal-web
- Use `nx run-many --all` for nightly full builds

### 2.3 Branch Strategy & Trunk-Based Development
- Single long-lived branch: `main`
- Short-lived feature branches: 1-3 days max
- All developers integrate to main frequently
- Squash merge to main (clean history)
- Incomplete features behind feature flags
- Alternative: GitFlow (for multiple production versions)

---

## 3. Deployment Strategies
### 3.1 Blue-Green & Canary Deployments

| Strategy | How | Rollback | Cost | Best For |
|----------|-----|----------|------|----------|
| **Blue-Green** | Switch LB between two environments | Seconds | 2x | Critical changes, schema |
| **Canary** | Gradual traffic shift 1%→100% | Minutes | 1.1x | Feature rollouts |
| **Rolling** | Replace instances one at a time | Minutes | 1x | Routine updates |

### 3.2 Database Migration Safety
- **Expand-Contract Pattern**:
  1. EXPAND: Add new nullable column
  2. MIGRATE: Backfill data in batches
  3. DEPLOY: New code reads/writes new column
  4. CONTRACT: Drop old column
- Rules:
  - Always add nullable columns
  - Never rename columns in one step
  - Never add NOT NULL without DEFAULT
  - Run migrations as separate CI step (not from app startup)

### 3.3 Feature Flags & Progressive Rollout
- Decouple deployment from release
- Gradual rollout: 1% → 10% → 50% → 100%
- A/B testing capability
- Kill switches for risky features
- **Remove flags after full rollout** (stale flags = tech debt)

---

## 4. Infrastructure
### 4.1 Infrastructure as Code (IaC)
- Define infrastructure in versioned config files
- Tools: Terraform (multi-cloud), AWS CDK (TypeScript/C#), Pulumi
- Benefits: version history, code review, automated provisioning
- **Critical**: Terraform state in S3 + DynamoDB locking

### 4.2 Environment Parity & Secrets Management
- Same software versions across: local → CI → staging → production
- Local: Docker Compose (PostgreSQL 17, RabbitMQ 4, Redis 7)
- Staging/Prod: AWS RDS, AmazonMQ, ElastiCache

**Secrets Management:**
- Local: .env files (git-ignored) or dotnet user-secrets
- CI: GitHub Actions secrets → environment variables
- AWS: AWS Secrets Manager → injected by ECS task definition
- **Never**: hardcoded in code, committed .env files

---

## 5. Architecture & Data Flow
```
Developer → Git Push → CI Pipeline
                          ↓
                    Build → Test → Lint → Scan → Artifact
                          ↓
                    Deployment (Blue-Green/Canary/Rolling)
                          ↓
                    Run Migrations → Switch Traffic → Monitor
```

---

## 6. Real-World Examples
### 6.1 Multi-Stage Dockerfile
```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runtime
COPY --from=build /app .
ENTRYPOINT ["dotnet", "portal-api.dll"]
# Result: ~80MB (vs ~700MB)
```

### 6.2 Docker Compose
- PostgreSQL 17-alpine
- RabbitMQ 4-management-alpine
- Redis 7-alpine
- Health checks for startup ordering

### 6.3 GitHub Actions CI
- Checkout → Setup → Restore → Build → Test → Scan → Artifact
- Nx affected for frontend
- Parallel backend/frontend jobs

---

## 7. Interview Q&A Summary
- **L1**: What is Docker? Why use it?
- **L2**: Multi-stage builds for image optimization
- **L3**: Safe database migrations (expand-contract pattern)
- **Staff**: Monorepo CI optimization (nx affected, parallel, cache)
