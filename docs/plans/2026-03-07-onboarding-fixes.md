# Onboarding Fixes Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address bugs and missing features in Onboarding Phase 5, including registration navigation, error handling, redirection to passkey, dashboard titles, user list, address configs, and activation endpoint.

**Architecture:** Frontend updates in Angular (routing, state, new pages), Backend updates in .NET API (Endpoints, IdentityService, Exception mapping).

**Tech Stack:** Angular 21, .NET 10, C# 14, SCSS.

---

### Task 1: Add Register Button and Public Routing

**Files:**
- Modify: `apps/portal-web/src/app/app.html`
- Modify: `apps/portal-web/src/app/app.ts`

**Step 1: Write the minimal implementation in app.ts**

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './auth.service';
import { AppShellComponent, MenuItem } from '@tai/ui-design-system';

@Component({
    imports: [RouterModule, CommonModule, AppShellComponent],
    selector: 'app-root',
    templateUrl: './app.html',
    styleUrl: './app.scss',
})
export class App implements OnInit {
    private readonly authService = inject(AuthService);
    public readonly router = inject(Router);
    
    protected title = 'portal-web';
    protected user$ = this.authService.user$;
    protected isAuthenticated$ = this.authService.isAuthenticated$;

    protected menuItems: MenuItem[] = [
        { label: 'Collections', link: '/collections', icon: '📥' },
        { label: 'Payments', link: '/payments', icon: '💰' },
        { label: 'Insurance', link: '/insurance', icon: '🛡️' },
        { label: 'Reports', link: '/reports', icon: '📊' },
        { label: 'Settings', link: '/settings', icon: '⚙️' },
        { label: 'Users', link: '/users', icon: '👥' },
    ];

    ngOnInit() {
        this.authService.checkAuth().subscribe();
    }

    login() {
        this.authService.login();
    }

    logout() {
        this.authService.logout();
    }
}
```

**Step 2: Update app.html for public routing and register button**

```html
@if (isAuthenticated$ | async) {
  <tai-app-shell 
    [user]="user$ | async" 
    [menuItems]="menuItems" 
    (logout)="logout()">
    
    <router-outlet></router-outlet>
    
    @if (router.url === '/') {
      <div class="welcome-content p-8">
          <h1 class="text-4xl font-extrabold text-gray-900 mb-4">Welcome to Portal</h1>
          <p class="text-lg text-gray-600">Your centralized financial risk management dashboard.</p>
          <div class="mt-8">
            <h2 class="text-2xl font-bold text-gray-800 mb-4">Pending Approvals</h2>
            <p class="text-gray-500">View and manage pending user registrations in the Admin section.</p>
            <button routerLink="/admin/approvals" class="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-md transition-colors hover:bg-indigo-700">View Pending Approvals</button>
          </div>
      </div>
    }
  </tai-app-shell>
} @else {
  @if (router.url !== '/') {
    <router-outlet></router-outlet>
  } @else {
    <div class="login-container flex justify-center items-center h-screen bg-gray-100 font-['Inter',_sans-serif]">
      <div class="login-card bg-white p-10 rounded-xl shadow-2xl text-center w-full max-w-[400px]">
        <h1 class="text-gray-800 mb-2 text-3xl font-bold">Portal</h1>
        <p class="text-gray-500 mb-8">Secure Enterprise Gateway</p>
        <button (click)="login()" class="login-btn w-full bg-blue-500 text-white px-6 py-3 rounded-md font-semibold border-none cursor-pointer transition-colors duration-200 hover:bg-blue-600 focus:outline-2 focus:outline-blue-500 focus:outline-offset-2 mb-4">Sign In with TAI Identity</button>
        <button routerLink="/register" class="register-btn w-full bg-transparent text-blue-500 border border-blue-500 px-6 py-3 rounded-md font-semibold cursor-pointer transition-colors duration-200 hover:bg-blue-50 focus:outline-2 focus:outline-blue-500 focus:outline-offset-2">Create New Account</button>
      </div>
    </div>
  }
}
```

**Step 3: Commit**

```bash
git add apps/portal-web/src/app/app.html apps/portal-web/src/app/app.ts
git commit -m "feat: add register button and allow public routing"
```

### Task 2: Friendly Error Message for Registration

**Files:**
- Modify: `libs/core/application/Interfaces/IIdentityService.cs`
- Modify: `libs/core/infrastructure/Identity/IdentityService.cs`
- Modify: `libs/core/application/UseCases/Onboarding/RegisterCustomerCommand.cs`
- Modify: `apps/portal-api/Program.cs`

**Step 1: Update IIdentityService**

```csharp
// In IIdentityService.cs
Task<(bool Success, string[] Errors)> CreateUserAsync(ApplicationUser user, string password, CancellationToken cancellationToken = default);
```

**Step 2: Update IdentityService**

```csharp
// In IdentityService.cs
  public async Task<(bool Success, string[] Errors)> CreateUserAsync(ApplicationUser user, string password, CancellationToken cancellationToken = default) {
    var result = await _userManager.CreateAsync(user, password);
    return (result.Succeeded, result.Errors.Select(e => e.Description).ToArray());
  }
```

**Step 3: Update RegisterCustomerCommandHandler**

```csharp
// In RegisterCustomerCommandHandler.cs
    var (success, errors) = await _identityService.CreateUserAsync(user, request.Password, cancellationToken);

    if (!success) {
      throw new IdentityValidationException(string.Join(", ", errors));
    }
```

**Step 4: Update Program.cs Exception Middleware**

```csharp
// In Program.cs inside app.Use(async (context, next)
  try {
    await next(context);
  } catch (FluentValidation.ValidationException ex) {
    // existing...
  } catch (Tai.Portal.Core.Application.Exceptions.IdentityValidationException ex) {
    context.Response.StatusCode = 400;
    var problemDetails = new Microsoft.AspNetCore.Mvc.ProblemDetails {
      Title = "Identity Validation Failed",
      Status = 400,
      Detail = ex.Message
    };
    await context.Response.WriteAsJsonAsync(problemDetails);
  }
```

**Step 5: Run tests to verify**

```bash
dotnet test libs/core/application.tests/
```

**Step 6: Commit**

```bash
git add libs/core/application/Interfaces/IIdentityService.cs libs/core/infrastructure/Identity/IdentityService.cs libs/core/application/UseCases/Onboarding/RegisterCustomerCommand.cs apps/portal-api/Program.cs
git commit -m "feat: return friendly error messages on registration failure"
```

### Task 3: Redirect to Create Passkey Page

**Files:**
- Create: `apps/portal-web/src/app/features/onboarding/pages/create-passkey.page.ts`
- Modify: `apps/portal-web/src/app/app.routes.ts`
- Modify: `apps/portal-web/src/app/features/onboarding/pages/register.page.ts`
- Modify: `apps/portal-web/src/app/features/onboarding/pages/verify.page.ts`

**Step 1: Create Passkey Page Component**

```typescript
// Create apps/portal-web/src/app/features/onboarding/pages/create-passkey.page.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-create-passkey-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-center justify-center min-h-[calc(100vh-64px)] bg-gray-50 px-4">
      <div class="w-full max-w-md bg-white p-8 rounded-xl shadow-md text-center">
        <h2 class="text-2xl font-bold mb-4">Create Your Passkey</h2>
        <p class="text-gray-600 mb-6">Set up a passkey for fast, secure sign-in.</p>
        <button class="w-full bg-indigo-600 text-white px-4 py-2 rounded-md font-medium hover:bg-indigo-700">Setup Passkey</button>
      </div>
    </div>
  `
})
export class CreatePasskeyPage {}
```

**Step 2: Update Routes**

```typescript
// Add to apps/portal-web/src/app/app.routes.ts
    { 
        path: 'create-passkey', 
        loadComponent: () => import('./features/onboarding/pages/create-passkey.page').then(m => m.CreatePasskeyPage) 
    },
```

**Step 3: Update Redirects in register.page.ts and verify.page.ts**

```typescript
// In register.page.ts constructor effect:
this.router.navigate(['/create-passkey']); 
// In verify.page.ts constructor effect:
this.router.navigate(['/create-passkey']);
```

**Step 4: Commit**

```bash
git add apps/portal-web/src/app/
git commit -m "feat: add create passkey page and update registration redirects"
```

### Task 4: Add Users Sidebar Menu and Page

**Files:**
- Create: `apps/portal-web/src/app/features/users/users.page.ts`
- Modify: `apps/portal-web/src/app/app.routes.ts`

**Step 1: Create Users Page**

```typescript
// Create apps/portal-web/src/app/features/users/users.page.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-8">
      <h1 class="text-2xl font-bold mb-6">Users Directory</h1>
      <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name/Email</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr>
              <td class="px-6 py-4 whitespace-nowrap">Admin User</td>
              <td class="px-6 py-4 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Active</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class UsersPage {}
```

**Step 2: Update app.routes.ts**

```typescript
// Add to apps/portal-web/src/app/app.routes.ts
    { 
        path: 'users', 
        loadComponent: () => import('./features/users/users.page').then(m => m.UsersPage) 
    },
```

**Step 3: Commit**

```bash
git add apps/portal-web/src/app/
git commit -m "feat: add users page and sidebar menu item"
```

### Task 5: Correct Addresses in Config

**Files:**
- Modify: `apps/portal-api/Properties/launchSettings.json`
- Modify: `apps/portal-gateway/appsettings.json`

**Step 1: Verify and Update Gateway routes**

Ensure the Gateway proxy config maps API and Identity routes correctly according to local ports. Review CORS origins in API `Program.cs` if needed.

**Step 2: Commit**

```bash
git add apps/portal-gateway/appsettings.json apps/portal-api/Properties/launchSettings.json
git commit -m "fix: update gateway and api address configs"
```

### Task 6: Fix Activation Code Endpoint

**Files:**
- Modify: `apps/portal-api/Controllers/OnboardingController.cs`

**Step 1: Implement the Activate Endpoint**

```csharp
// Add to apps/portal-api/Controllers/OnboardingController.cs
  [HttpPost("activate")]
  [AllowAnonymous]
  public async Task<IActionResult> Activate([FromBody] ActivateUserCommand command) {
    try {
      await _mediator.Send(command);
      return Ok();
    } catch (System.Exception ex) {
      return BadRequest(new { error = ex.Message });
    }
  }
```

**Step 2: Run tests**

```bash
dotnet test apps/portal-api.integration-tests/
```

**Step 3: Commit**

```bash
git add apps/portal-api/Controllers/OnboardingController.cs
git commit -m "fix: add activation endpoint to onboarding controller"
```
