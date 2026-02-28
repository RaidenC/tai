# Project Workflow

## Guiding Principles

1. **The Plan is the Source of Truth:** All work must be tracked in `plan.md`
2. **The Tech Stack is Deliberate:** Changes to the tech stack must be documented in `tech-stack.md` *before* implementation
3. **Test-Driven Development:** Write unit tests before implementing functionality
4. **High Code Coverage:** Aim for **90% code coverage** for all modules
5. **User Experience First:** Every decision should prioritize user experience
6. **Non-Interactive & CI-Aware:** Prefer non-interactive commands. Use `CI=true` for watch-mode tools (tests, linters) to ensure single execution.

## Task Workflow

All tasks follow a strict lifecycle:

### Track Initialization (Mandatory)

Before any task implementation begins, a new Feature Track must be initialized:

1.  **Research Phase:** Perform a read-only analysis of existing code and dependencies. Output findings to `research.md` within the track directory.
2.  **Planning Phase:** Draft a complete implementation strategy in `plan.md`, including a TDD checklist.
3.  **Human Approval:** The implementation phase ONLY begins once the human has reviewed and annotated the `plan.md` and provided a "Proceed" signal.

### Collaboration & Pull Requests (PR Workflow)

To ensure the integrity of the **Zero-Trust** architecture and maintain a high-quality audit trail, all implementation work must follow a strict branching and Pull Request strategy.

1.  **Phase Isolation:** Never work directly on the `main` branch. Every new phase of a track must be implemented in a dedicated feature branch.
2.  **Branch Naming:** Use the pattern `feature/<track-id>/phase-<number>`.
    *   *Example:* `git checkout -b feature/cicd-setup/phase-2`
3.  **Agent Automation:** When the agent is tasked with implementing a phase (e.g., via `conductor:implement`), the agent will **automatically** perform the following steps:
    *   Create the feature branch.
    *   Execute the TDD cycle and implement the tasks.
    *   Push the branch to the remote repository.
    *   Notify the user that the branch is ready for a Pull Request.
4.  **The Pull Request Gate:**
    *   Open a Pull Request on GitHub from the feature branch to `main`.
    *   The **TAI Portal CI** pipeline will automatically run.
    *   **The PR must stay open until the CI turns Green ✅.**
    *   If the CI fails, the agent will fix the issues on the same branch and push again.
5.  **Merge & Cleanup:**
    *   Once the PR is approved and CI is green, merge the PR into `main`.
    *   Delete the feature branch locally and remotely to keep the workspace clean.

### Standard Task Workflow

1. **Select Task:** Choose the next available task from `plan.md` in sequential order

2. **Mark In Progress:** Before beginning work, edit `plan.md` and change the task from `[ ]` to `[~]`

3. **Write Failing Tests (Red Phase):**
   - Create a new test file for the feature or bug fix.
   - Write one or more unit tests that clearly define the expected behavior and acceptance criteria for the task.
   - **Robustness:** Include **Negative Testing** (invalid inputs, boundary violations) and consider **Property-Based Testing** (PBT) for complex logic to ensure invariants hold true.
   - **CRITICAL:** Run the tests and confirm that they fail as expected. This is the "Red" phase of TDD. Do not proceed until you have failing tests.

4. **Implement to Pass Tests (Green Phase):**
   - Write the minimum amount of application code necessary to make the failing tests pass.
   - Run the test suite again and confirm that all tests now pass. This is the "Green" phase.

5. **Refactor (Optional but Recommended):**
   - With the safety of passing tests, refactor the implementation code and the test code to improve clarity, remove duplication, and enhance performance without changing the external behavior.
   - Rerun tests to ensure they still pass after refactoring.

6. **Glue Layer Smoke Test (Fintech Integration Gate):**
   - **Verification:** Spin up all related services (Web, Gateway, API, Identity-UI, Database).
   - **Verification:** Ensure all traffic flows through the Gateway (5217).
   - **Verification:** Confirm no internal ports (5031, 4300) leak into browser redirects or OIDC metadata.
   - **Verification:** Verify that CORS preflight (OPTIONS) requests pass through the Gateway to the API.

7. **Verify Coverage:** Run coverage reports using the project's chosen tools. For example, in a Python project, this might look like:
   ```bash
   pytest --cov=app --cov-report=html
   ```
   Target: **90% coverage** for new code. The specific tools and commands will vary by language and framework.

7. **Document Deviations:** If implementation differs from tech stack:
   - **STOP** implementation
   - Update `tech-stack.md` with new design
   - Add dated note explaining the change
   - Resume implementation

8. **Commit Code Changes & Summary:**
   - Stage all code changes related to the task.
   - Draft a commit message following the format: `<type>(<scope>): <description>`.
   - **Include a Task Summary** in the commit message body, detailing:
     - Task Name
     - Summary of changes
     - Created/Modified files
     - The "Why" behind the implementation.
   - Perform the commit.

9. **Record Task Commit SHA:**
    - **Step 9.1: Update Plan:** Read `plan.md`, find the line for the completed task, update its status from `[~]` to `[x]`, and append the first 7 characters of the *just-completed commit's* commit hash.
    - **Step 9.2: Write Plan:** Write the updated content back to `plan.md`.

10. **Commit Plan Update:**
    - **Action:** Stage the modified `plan.md` file.
    - **Action:** Commit this change with a descriptive message (e.g., `conductor(plan): Mark task 'Create user model' as complete`).

### Phase Completion Verification and Checkpointing Protocol

**Trigger:** This protocol is executed immediately after a task is completed that also concludes a phase in `plan.md`.

1.  **Announce Protocol Start:** Inform the user that the phase is complete and the verification and checkpointing protocol has begun.

2.  **Enforce Deterministic Gates:**
    -   **Step 2.1: Static Analysis:** Before running dynamic tests, execute the project's linter and formatter (e.g., `dotnet format`, `npx nx run-many -t lint`).
    -   **Step 2.2: Fix Violations:** If syntax or style checks fail, fix them immediately. Do not proceed to test execution until static analysis passes.

3.  **Ensure Test Coverage for Phase Changes:**
    -   **Step 3.1: Determine Phase Scope:** To identify the files changed in this phase, you must first find the starting point. Read `plan.md` to find the Git commit SHA of the *previous* phase's checkpoint. If no previous checkpoint exists, the scope is all changes since the first commit.
    -   **Step 3.2: List Changed Files:** Execute `git diff --name-only <previous_checkpoint_sha> HEAD` to get a precise list of all files modified during this phase.
    -   **Step 3.3: Verify and Create Tests:** For each file in the list:
        -   **CRITICAL:** First, check its extension. Exclude non-code files (e.g., `.json`, `.md`, `.yaml`).
        -   For each remaining code file, verify a corresponding test file exists.
        -   If a test file is missing, you **must** create one. Before writing the test, **first, analyze other test files in the repository to determine the correct naming convention and testing style.** The new tests **must** validate the functionality described in this phase's tasks (`plan.md`).
        -   **Advanced Testing Patterns:**
            -   **Negative Testing:** Explicitly write scenarios for contradictory information, malicious data, or boundary violations.
            -   **Property-Based Testing:** For logic-heavy components, define high-level mathematical or logical properties that must always be true regardless of input.

4.  **Execute Automated Tests with Proactive Debugging:**
    -   Before execution, you **must** announce the exact shell command you will use to run the tests.
    -   **Example Announcement:** "I will now run the automated test suite to verify the phase. **Command:** `dotnet test` or `CI=true npx nx test <project>`"
    -   Execute the announced command.
    -   If tests fail, you **must** inform the user and begin debugging. You may attempt to propose a fix a **maximum of two times**. If the tests still fail after your second proposed fix, you **must stop**, report the persistent failure, and ask the user for guidance.

5.  **Enforce Mutation Testing (Test the Tests):**
    -   **Step 5.1: Run Mutation Suite:** If available (e.g., Stryker for .NET/JS), run mutation testing on the new feature.
    -   **Step 5.2: Analyze Score:** If the mutation score is below 80%, analyze surviving mutants.
    -   **Step 5.3: Kill Mutants:** Write new test cases to cover the gaps exposed by the mutation tool.

6.  **Propose a Detailed, Actionable Manual Verification Plan:**
    -   **CRITICAL:** To generate the plan, first analyze `product.md`, `product-guidelines.md`, and `plan.md` to determine the user-facing goals of the completed phase.
    -   You **must** generate a step-by-step plan that walks the user through the verification process, including any necessary commands and specific, expected outcomes.
    -   The plan you present to the user **must** follow this format:

        **For a Frontend Change:**
        ```
        The automated tests have passed. For manual verification, please follow these steps:

        **Manual Verification Steps:**
        1.  **Start the development server with the command:** `npm run dev`
        2.  **Open your browser to:** `http://localhost:3000`
        3.  **Confirm that you see:** The new user profile page, with the user's name and email displayed correctly.
        ```

        **For a Backend Change:**
        ```
        The automated tests have passed. For manual verification, please follow these steps:

        **Manual Verification Steps:**
        1.  **Ensure the server is running.**
        2.  **Execute the following command in your terminal:** `curl -X POST http://localhost:8080/api/v1/users -d '{"name": "test"}'`
        3.  **Confirm that you receive:** A JSON response with a status of `201 Created`.
        ```

7. **Await Explicit User Feedback:**
    -   After presenting the detailed plan, ask the user for confirmation: "**Does this meet your expectations? Please confirm with yes or provide feedback on what needs to be changed.**"
    -   **PAUSE** and await the user's response. Do not proceed without an explicit yes or confirmation.

8. **Generate Tech Interview & Knowledge Note (Comprehensive Multi-Level Standard):**
   - **Objective:** Deconstruct the implementation into a structured learning and interview-prep artifact that serves as a permanent knowledge asset.
   - **Action:** Generate a new file in `Resources/Knowledge_Notes/` titled `Track_<ID>_Phase_<N>_Knowledge.md`.
   - **Required Content Structure:**
     - **The Enterprise Challenge:** Define the high-stakes problem (security, scale, or compliance) solved in this phase.
     - **Knowledge Hierarchy:**
       - **Junior Level (The "What"):** Explain the fundamental tools, syntax, and basic logic used (e.g., "What is a Middleware?", "Basic EF Core configuration"). Focus on the "Building Blocks."
       - **Mid Level (The "How"):** Detail the design patterns (e.g., Interceptors, Marker Interfaces), implementation logic, testing strategies (Red-Green-Refactor), and error handling. Focus on "Professional Craftsmanship."
       - **Senior/Principal Level (The "Why"):** Deep-dive into architectural trade-offs (e.g., Portability vs. Hardening), security implications (Zero-Trust, Information Leakage), and system-wide impacts. Focus on "Strategic Decision Making."
     - **Deep-Dive Mechanics:** Granular technical explanation of how the different components (Gateway, API, Web, Database) were synchronized and why specific orderings matter.
     - **Interview Talking Points (Tiered):**
       - **Junior/Mid responses:** Focus on clean code, unit testing, and reliable implementation.
       - **Senior/Lead responses:** Focus on security posture, compliance (SOC 2/PCI), scalability, and long-term maintainability.
     - **March 2026 Market Context:** Explain why the patterns used (e.g., BFF, DPoP, Signals, Clean Architecture) represent the current enterprise "Gold Standard," regardless of the specific framework version.

9. **Create Checkpoint Commit & Report:**
    - Stage all changes. If no changes occurred in this step, proceed with an empty commit.
    - **Include a Verification Report** in the commit message body, detailing:
      - The automated test command used.
      - The manual verification steps performed.
      - The user's confirmation/feedback.
    - Perform the commit with a clear and concise message (e.g., `conductor(checkpoint): Checkpoint end of Phase X`).

10.  **Get and Record Phase Checkpoint SHA:**
    -   **Step 8.1: Get Commit Hash:** Obtain the hash of the *just-created checkpoint commit* (`git log -1 --format="%H"`).
    -   **Step 10.2: Update Plan:** Read `plan.md`, find the heading for the completed phase, and append the first 7 characters of the commit hash in the format `[checkpoint: <sha>]`.
    -   **Step 10.3: Write Plan:** Write the updated content back to `plan.md`.

11. **Commit Plan Update:**
    - **Action:** Stage the modified `plan.md` file.
    - **Action:** Commit this change with a descriptive message following the format `conductor(plan): Mark phase '<PHASE NAME>' as complete`.

12.  **Announce Completion:** Inform the user that the phase is complete and the checkpoint has been created, with the detailed verification report included in the commit message body.

### Quality Gates

Before marking any task complete, verify:

- [ ] All tests pass
- [ ] Code coverage meets requirements (90%)
- [ ] Code follows project's code style guidelines (as defined in `code_styleguides/`)
- [ ] All public functions/methods are documented (e.g., docstrings, JSDoc, GoDoc)
- [ ] Type safety is enforced (e.g., type hints, TypeScript types, Go types)
- [ ] No linting or static analysis errors (using the project's configured tools)
- [ ] Works correctly on mobile (if applicable)
- [ ] Documentation updated if needed
- [ ] **No NativeAOT:** Verify `.csproj` does not contain `<PublishAot>true</PublishAot>`.
- [ ] **Zero-Violation CSP:** Verify no `[style]` bindings or `<style>` tags are used in HTML templates.
- [ ] **DPoP Binding:** Ensure new API calls include the DPoP proof generation logic.
- [ ] **Verifiable UI:** New components MUST have a Storybook story with a passing `play` function (Interaction Test).
- [ ] **Multi-tenant Isolation:** Backend changes must verify that Global Query Filters are applied to any new `IMultiTenant` entities.

## Development Commands

### Setup
```bash
npm install
dotnet restore tai-portal.slnx
```

### Frontend Development
```bash
# Start development servers
npx nx serve portal-web
npx nx serve identity-ui

# Run unit tests (Vitest)
npx nx test portal-web
npx nx test identity-ui

# Start Storybook for UI development
npx nx storybook portal-web
```

### Backend Development
```bash
# Start API development server
npx nx serve portal-api

# Run unit tests (xUnit)
npx nx test core-domain

# Run integration tests
npx nx test portal-api-integration-tests
```

### Verification (Pre-Commit)
```bash
# Lint all projects
npx nx run-many -t lint

# Verify no compilation errors
npx nx run-many -t build
```

## Testing Requirements

### Unit Testing
- **Logic Verification:** Use **Vitest** for Angular logic and **xUnit** for .NET logic.
- Every module must have corresponding tests.
- Use appropriate test setup/teardown mechanisms (e.g., fixtures, beforeEach/afterEach).
- Mock external dependencies.
- Test both success and failure cases.

### Integration Testing
- **Backend Flow:** Use `WebApplicationFactory` + `Respawn` / `TestContainers` to verify the Identity Handshake and Persistence.
- **UI Logic:** Use **Storybook** Interaction Tests (`play` functions) to verify security and accessibility invariants.
- Test complete user flows
- Verify database transactions
- Test authentication and authorization
- Check form submissions

### End-to-End (E2E) Testing
- **Steel Thread:** Use **Playwright** for critical cross-platform workflows (Login, Context Switching).

### Mobile Testing
- Test on actual iPhone when possible
- Use Safari developer tools
- Test touch interactions
- Verify responsive layouts
- Check performance on 3G/4G

## Code Review Process

### Self-Review Checklist
Before requesting review:

1. **Functionality**
   - Feature works as specified
   - Edge cases handled
   - Error messages are user-friendly

2. **Code Quality**
   - Follows style guide
   - DRY principle applied
   - Clear variable/function names
   - Appropriate comments

3. **Testing**
   - Unit tests comprehensive
   - Integration tests pass
   - Coverage adequate (90%)

4. **Security**
   - No hardcoded secrets
   - Input validation present
   - SQL injection prevented
   - XSS protection in place

5. **Performance**
   - Database queries optimized
   - Images optimized
   - Caching implemented where needed

6. **Mobile Experience**
   - Touch targets adequate (44x44px)
   - Text readable without zooming
   - Performance acceptable on mobile
   - Interactions feel native

## Commit Guidelines

### Message Format
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding missing tests
- `chore`: Maintenance tasks

### Examples
```bash
git commit -m "feat(auth): Add remember me functionality"
git commit -m "fix(posts): Correct excerpt generation for short posts"
git commit -m "test(comments): Add tests for emoji reaction limits"
git commit -m "style(mobile): Improve button touch targets"
```

## Definition of Done

A task is complete when:

1. All code implemented to specification
2. Unit tests written and passing
3. Code coverage meets project requirements (90%)
4. Documentation complete (if applicable)
5. **Knowledge Note Generated:** Phase completion results in a 'March 2026 Standard' interview prep document in `Resources/Knowledge_Notes/`.
6. Code passes all configured linting and static analysis checks
6. Works beautifully on mobile (if applicable)
7. Implementation notes added to `plan.md`
8. Changes committed with proper message
9. Task summary included in the commit message body
10. Plan updated with commit SHA

## Emergency Procedures

### Critical Bug in Production
1. Create hotfix branch from main
2. Write failing test for bug
3. Implement minimal fix
4. Test thoroughly including mobile
5. Deploy immediately
6. Document in plan.md

### Data Loss
1. Stop all write operations
2. Restore from latest backup
3. Verify data integrity
4. Document incident
5. Update backup procedures

### Security Breach
1. Rotate all secrets immediately
2. Review access logs
3. Patch vulnerability
4. Notify affected users (if any)
5. Document and update security procedures

## Deployment Workflow

### Pre-Deployment Checklist
- [ ] All tests passing
- [ ] Coverage 90%
- [ ] No linting errors
- [ ] Mobile testing complete
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] Backup created

### Deployment Steps
1. Merge feature branch to main
2. Tag release with version
3. Push to deployment service
4. Run database migrations
5. Verify deployment
6. Test critical paths
7. Monitor for errors

### Post-Deployment
1. Monitor analytics
2. Check error logs
3. Gather user feedback
4. Plan next iteration

## Continuous Improvement

- Review workflow weekly
- Update based on pain points
- Document lessons learned
- Optimize for user happiness
- Keep things simple and maintainable
