using Microsoft.AspNetCore.Identity;
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

builder.Services.AddMemoryCache();
builder.Services.AddScoped<ITenantService, TenantService>();
builder.Services.AddScoped<IIdentityService, IdentityService>();
builder.Services.AddScoped<IOtpService, OtpService>();

builder.Services.AddMediatR(cfg => {
  cfg.RegisterServicesFromAssembly(typeof(RegisterCustomerCommand).Assembly);
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
      // JUNIOR RATIONALE: We don't call SetIssuer() here because we want 
      // OpenIddict to be dynamic. When you visit 'acme.localhost', the 
      // discovery document and tokens should show 'acme.localhost'. 
      // This is essential for our multi-tenant setup.

      options.SetAuthorizationEndpointUris("connect/authorize")
          .SetLogoutEndpointUris("connect/logout")
          .SetTokenEndpointUris("connect/token")
          .SetUserinfoEndpointUris("connect/userinfo");

      // Enable the authorization code flow.
      options.AllowAuthorizationCodeFlow()
          .AllowRefreshTokenFlow();

      // Require PKCE (Proof Key for Code Exchange) for all authorization requests.
      // This is a security feature that prevents authorization code interception attacks.
      options.RequireProofKeyForCodeExchange();

      // Note on DPoP (Demonstrating Proof-of-Possession):
      // In modern versions of OpenIddict (3.0+), DPoP support is largely automatic.
      // There isn't an explicit .EnableDPoP() method. Instead, the server will
      // detect a 'DPoP' header from the client, validate it, and if valid,
      // issue a DPoP-bound access token. The validation handler will then
      // enforce that subsequent API calls using that token are accompanied by a valid DPoP proof.
      // So, no explicit server-side code is needed here to enable it, just client-side implementation.

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

builder.Services.AddAuthorization();
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

var app = builder.Build();

// JUNIOR RATIONALE: This tells the API that it's being served from 
// the '/identity' prefix. This is critical for generating correct 
// redirect URLs.
app.UsePathBase("/identity");

// JUNIOR RATIONALE: This MUST be the first thing in the pipeline. 
// It tells the API to look at the headers from the Gateway (like Host and IP) 
// and pretend it IS the Gateway.
app.UseForwardedHeaders();

// Seed the database with initial data in development.

// Seed the database with initial data in development.
if (app.Environment.IsDevelopment()) {
  SeedData.Initialize(app.Services);
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment()) {
  app.MapOpenApi();
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
