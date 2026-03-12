using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using System.Text.Encodings.Web;
using Microsoft.Extensions.Logging;
using OpenIddict.Validation.AspNetCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using OpenIddict.Abstractions;
using OpenIddict.Server.AspNetCore;
using Tai.Portal.Core.Domain.Entities;
using Tai.Portal.Core.Infrastructure.Persistence;
using Tai.Portal.Api;

using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Application.Services;
using Tai.Portal.Core.Application.UseCases.Onboarding;
using Tai.Portal.Core.Infrastructure.Identity;
using Tai.Portal.Core.Infrastructure.Middleware;
using Tai.Portal.Core.Infrastructure.Services;

using Tai.Portal.Core.Application.Behaviors;
using Tai.Portal.Core.Application.Constants;
using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Diagnostics;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

builder.Services.Configure<ForwardedHeadersOptions>(options => {
  options.ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor |
                             Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto |
                             Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedHost;
  // JUNIOR RATIONALE: We clear these and set ForwardLimit to null so the API 
  // trusts all headers from the Gateway.
  options.KnownProxies.Clear();
  options.KnownIPNetworks.Clear();
  options.ForwardLimit = null;
});

builder.Services.AddHttpContextAccessor();
builder.Services.AddMemoryCache();
builder.Services.AddScoped<ITenantService, TenantService>();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddScoped<IIdentityService, IdentityService>();
builder.Services.AddScoped<IOtpService, OtpService>();

builder.Services.AddValidatorsFromAssembly(typeof(RegisterCustomerCommand).Assembly);

builder.Services.AddMediatR(cfg => {
  cfg.RegisterServicesFromAssembly(typeof(RegisterCustomerCommand).Assembly);
  cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationPipelineBehavior<,>));
});

builder.Services.AddDbContext<PortalDbContext>(options => {
  // Configure the context to use PostgreSQL.
  options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"),
      o => o.MigrationsAssembly("Tai.Portal.Core.Infrastructure"));
  // Register the entity sets needed by OpenIddict.
  options.UseOpenIddict();
});

// Register the Identity services.
builder.Services.AddIdentity<ApplicationUser, IdentityRole>()
    .AddEntityFrameworkStores<PortalDbContext>()
    .AddDefaultTokenProviders();

builder.Services.ConfigureApplicationCookie(options => {
  options.LoginPath = "/Account/Login";
  options.LogoutPath = "/Account/Logout";
});

// Register the OpenIddict services.
builder.Services.AddOpenIddict()
    // Register the OpenIddict core components.
    .AddCore(options => {
      // Configure OpenIddict to use the Entity Framework Core stores and models.
      options.UseEntityFrameworkCore()
          .UseDbContext<PortalDbContext>();
    })
    // Register the OpenIddict server components.
    .AddServer(options => {
      // JUNIOR RATIONALE: We use explicit 'identity/' prefixes for all endpoints. 
      // This allows us to remove UsePathBase, which was causing issuer 
      // mismatches when validating tokens on non-prefixed routes like /api/users.
      options.SetAuthorizationEndpointUris("connect/authorize")
          .SetLogoutEndpointUris("connect/logout")
          .SetTokenEndpointUris("connect/token")
          .SetUserinfoEndpointUris("connect/userinfo")
          .SetConfigurationEndpointUris(".well-known/openid-configuration")
          .SetCryptographyEndpointUris(".well-known/jwks");

      // Enable the authorization code flow.
      options.AllowAuthorizationCodeFlow()
          .AllowRefreshTokenFlow();

      // Require PKCE (Proof Key for Code Exchange) for all authorization requests.
      // This is a security feature that prevents authorization code interception attacks.
      options.RequireProofKeyForCodeExchange();

      // Register the scopes (permissions) that clients can request.
      options.RegisterScopes(
          OpenIddictConstants.Scopes.Email,
          OpenIddictConstants.Scopes.Profile,
          OpenIddictConstants.Scopes.Roles,
          OpenIddictConstants.Scopes.OpenId);

      // Register the signing and encryption credentials.
      options.AddDevelopmentEncryptionCertificate()
          .AddDevelopmentSigningCertificate();

      // Register the ASP.NET Core host and configure the ASP.NET Core-specific options.
      options.UseAspNetCore()
             .EnableAuthorizationEndpointPassthrough()
             .EnableLogoutEndpointPassthrough()
             .EnableTokenEndpointPassthrough()
             .DisableTransportSecurityRequirement()
             .EnableStatusCodePagesIntegration();
    })
    // Register the OpenIddict validation components.
    .AddValidation(options => {
      // Import the configuration from the local OpenIddict server instance.
      options.UseLocalServer();

      // Register the ASP.NET Core host.
      options.UseAspNetCore();
    });

builder.Services.AddAuthentication(options => {
  options.DefaultScheme = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme;
});

// Configure Authorization Policies
builder.Services.AddAuthorization(options => {
  options.AddPolicy(AuthorizationPolicies.ApiPolicy, policy => {
    policy.AddAuthenticationSchemes(
        OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme,
        IdentityConstants.ApplicationScheme);
    policy.RequireAuthenticatedUser();
  });
});

builder.Services.AddControllers();

builder.Services.AddCors(options => {
  options.AddDefaultPolicy(policy => {
    policy.SetIsOriginAllowed(origin => {
      var host = new Uri(origin).Host;
      return host == "localhost" || host.EndsWith(".localhost");
    })
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials();
  });
});

builder.Services.ConfigureApplicationCookie(options => {
  options.LoginPath = "/Account/Login";
  options.LogoutPath = "/Account/Logout";
});

var app = builder.Build();

// This MUST be the first thing in the pipeline. 
app.UseForwardedHeaders();

// We use a custom exception handler to map Domain 
// and Application exceptions to specific HTTP status codes (e.g., 404, 412). 
app.UseExceptionHandler(exceptionHandlerApp => {
  exceptionHandlerApp.Run(async context => {
    var contextFeature = context.Features.Get<IExceptionHandlerFeature>();
    if (contextFeature != null) {
      var ex = contextFeature.Error;

      if (ex is FluentValidation.ValidationException valEx) {
        context.Response.StatusCode = 400;
        var problemDetails = new Microsoft.AspNetCore.Mvc.ValidationProblemDetails {
          Title = "Validation Failed",
          Status = 400,
          Detail = "One or more validation errors occurred."
        };
        foreach (var error in valEx.Errors) {
          if (!problemDetails.Errors.ContainsKey(error.PropertyName)) {
            problemDetails.Errors[error.PropertyName] = new string[] { error.ErrorMessage };
          } else {
            var existing = problemDetails.Errors[error.PropertyName];
            problemDetails.Errors[error.PropertyName] = existing.Concat(new[] { error.ErrorMessage }).ToArray();
          }
        }
        await context.Response.WriteAsJsonAsync(problemDetails);
      } else if (ex is Tai.Portal.Core.Application.Exceptions.IdentityValidationException idEx) {
        context.Response.StatusCode = 400;
        await context.Response.WriteAsJsonAsync(new Microsoft.AspNetCore.Mvc.ProblemDetails {
          Title = "Identity Validation Failed",
          Status = 400,
          Detail = idEx.Message
        });
      } else if (ex is Tai.Portal.Core.Application.Exceptions.UserNotFoundException nfEx) {
        context.Response.StatusCode = 404;
        await context.Response.WriteAsJsonAsync(new Microsoft.AspNetCore.Mvc.ProblemDetails {
          Title = "Resource Not Found",
          Status = 404,
          Detail = nfEx.Message
        });
      } else if (ex is Tai.Portal.Core.Application.Exceptions.ConcurrencyException conEx) {
        context.Response.StatusCode = 412;
        await context.Response.WriteAsJsonAsync(new Microsoft.AspNetCore.Mvc.ProblemDetails {
          Title = "Concurrency Conflict",
          Status = 412,
          Detail = conEx.Message
        });
      } else {
        // Fallback for other exceptions
        context.Response.StatusCode = 500;
        await context.Response.WriteAsJsonAsync(new { error = "An unexpected error occurred." });
      }
    }
  });
});

// Seed the database with initial data in development.
if (app.Environment.IsDevelopment()) {
  SeedData.Initialize(app.Services);
}

app.UseRouting();

app.UseCors();

// JUNIOR RATIONALE: We place the Trust check AFTER CORS so browser 'OPTIONS' 
// requests don't get blocked. 
app.UseMiddleware<GatewayTrustMiddleware>();

app.UseAuthentication();
app.UseAuthorization();

app.UseMiddleware<TenantResolutionMiddleware>();

// app.UseHttpsRedirection();

app.MapGet("/", () => "Portal API is running");

app.MapControllers();

app.Run();

public partial class Program { }

/// <summary>
/// A stub authentication handler used solely to register the "TestAuth" scheme
/// name so that it can be referenced in [Authorize] attributes without causing runtime errors.
/// In actual integration tests, this is replaced by a mock handler.
/// </summary>
public class IntegrationTestStubHandler : AuthenticationHandler<AuthenticationSchemeOptions> {
  public IntegrationTestStubHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
      : base(options, logger, encoder) { }
  protected override Task<AuthenticateResult> HandleAuthenticateAsync() => Task.FromResult(AuthenticateResult.NoResult());
}
