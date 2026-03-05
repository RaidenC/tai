# Track User & Identity Management - Onboarding: Phase 2 Knowledge Note

## The Enterprise Challenge
In a high-security multi-tenant application, business orchestration must be strictly decoupled from the underlying infrastructure (like identity providers, databases, or cache systems). If a command handler directly interacts with `UserManager` or EF Core, it becomes brittle, difficult to test, and violates the Zero-Trust mandate of keeping infrastructure boundaries impenetrable from the core logic.

## Knowledge Hierarchy

### Junior Level (The "What")
- **CQRS (Command Query Responsibility Segregation):** We separated operations that change state (Commands like `RegisterCustomerCommand`) from operations that just read data (Queries like `GetPendingApprovalsQuery`). We used the `MediatR` library to dispatch these.
- **Fail-Fast Validation:** We used `FluentValidation` to ensure that required fields (like Email and Passwords) are valid *before* any backend logic executes.
- **Dependency Injection (DI):** We registered our new services (`IIdentityService`, `IOtpService`, and `MediatR`) in the `Program.cs` file. This tells the .NET runtime how to construct our Handlers when an API request comes in.

### Mid Level (The "How")
- **Clean Architecture Refactoring:** Initially, our Handlers depended on the ASP.NET Core `UserManager`. We refactored this by defining an `IIdentityService` interface in the Application layer, and creating a concrete `IdentityService` class in the Infrastructure layer. The Application layer now only depends on its own interface.
- **Robust Mocking:** Because we isolated the Infrastructure behind interfaces (`IIdentityService`, `IOtpService`), our unit tests using `Moq` became incredibly clean. We were able to precisely simulate success, failure, and edge cases without needing an in-memory database.
- **OTP Implementation:** We built an `IOtpService` using `IMemoryCache` and `RandomNumberGenerator`. This securely generates a 6-digit code with a 10-minute Time-To-Live (TTL), validating the `ActivateUserCommand` against replay or brute-force attacks.

### Senior/Principal Level (The "Why")
- **Enforcing the "Four-Eyes Principle":** In the `ApproveStaffCommandValidator`, we explicitly enforced `TargetUserId != ApprovedByAdminId`. By placing this constraint in the Application boundary, we mathematically prove that self-elevation is impossible before the command even reaches the Domain or Database.
- **Strict Tenant Isolation:** In `GetPendingApprovalsQuery`, the `TenantId` is an absolute requirement for the query, and it is strictly evaluated in the LINQ projection. This ensures no data leakage can occur between institutions (Bank A cannot see Bank B's pending staff).
- **Strongly-Typed Exceptions:** Rather than throwing generic `InvalidOperationException`s, we introduced domain-specific exceptions (`UserNotFoundException`, `IdentityValidationException`). This allows the outer Presentation/API layer to catch these specifically and map them to semantically correct HTTP Status Codes (404, 400), rather than returning a generic 500 Server Error.

## Deep-Dive Mechanics
The decision to group the `Command`, `Validator`, and `Handler` into a single file represents the "Vertical Slice" approach to CQRS. While it violates the traditional "One Class per File" rule, it vastly increases *cohesion*. A developer modifying the Onboarding flow can see the inputs, the constraints, and the execution logic on a single screen, reducing cognitive load and preventing fragmented updates in large enterprise solutions.

## Interview Talking Points (Tiered)
- **Junior/Mid:** "I implemented the CQRS pattern using MediatR and FluentValidation. I ensured that all commands were thoroughly unit-tested using Moq to verify they correctly triggered the Domain state machine."
- **Senior/Lead:** "To adhere to Clean Architecture, I abstracted away the concrete Identity framework (`UserManager`) behind an `IIdentityService` interface. This not only stopped infrastructure leakage into the Application layer but allowed us to strictly enforce Zero-Trust invariants—like Tenant Isolation and the Four-Eyes principle—in pure, highly-testable orchestration logic."

## March 2026 Market Context
In 2026, enterprise architectures are increasingly hostile to "vendor lock-in." By placing an anti-corruption layer (`IIdentityService`) between the Application logic and ASP.NET Core Identity, the system is primed for future migrations. If TAI Portal needs to switch to Auth0, Entra ID, or a federated microservice in the future, the Application Layer and its hundreds of unit tests will not require a single line of code to change.