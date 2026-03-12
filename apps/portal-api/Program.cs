using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authorization;
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
using FluentValidation;
using MediatR;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

builder.Services.Configure<ForwardedHeadersOptions>(options => {
  options.ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor |
                             Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto;
});

// Configure EF Core & Identity
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<PortalDbContext>(options => {
  options.UseNpgsql(connectionString, b => b.MigrationsAssembly("Tai.Portal.Core.Infrastructure"));
  // Use the OpenIddict entity models.
  options.UseOpenIddict();
});

builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options => {
  options.Password.RequireDigit = true;
  options.Password.RequireLowercase = true;
  options.Password.RequireNonAlphanumeric = true;
  options.Password.RequireUppercase = true;
  options.Password.RequiredLength = 8;
  options.User.RequireUniqueEmail = true;
})
.AddEntityFrameworkStores<PortalDbContext>()
.AddDefaultTokenProviders();

// Core Application Services
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ITenantService, TenantService>();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddScoped<IIdentityService, IdentityService>();
builder.Services.AddScoped<IOtpService, MockOtpService>();

// Configure MediatR & FluentValidation
builder.Services.AddValidatorsFromAssembly(typeof(RegisterStaffCommand).Assembly);
builder.Services.AddMediatR(cfg => {
  cfg.RegisterServicesFromAssembly(typeof(RegisterStaffCommand).Assembly);
  cfg.AddOpenBehavior(typeof(ValidationPipelineBehavior<,>));
});

builder.Services.AddOpenIddict()
    // Register the OpenIddict core components.
    .AddCore(options => {
      // Configure OpenIddict to use the Entity Framework Core stores and models.
      // Note: the default entities used by OpenIddict are specialized for EF Core.
      options.UseEntityFrameworkCore()
             .UseDbContext<PortalDbContext>();
    })
    // Register the OpenIddict server components.
    .AddServer(options => {
      // Enable the authorization, logout, token and userinfo endpoints.
      options.SetAuthorizationEndpointUris("connect/authorize")
             .SetLogoutEndpointUris("connect/logout")
             .SetTokenEndpointUris("connect/token")
             .SetUserinfoEndpointUris("connect/userinfo");

      // Mark the "authorization_code" and "refresh_token" flow as being supported.
      options.AllowAuthorizationCodeFlow()
             .AllowRefreshTokenFlow();

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

builder.Services.AddAuthorization();
builder.Services.AddControllers(options => {
  options.Filters.Add<Tai.Portal.Api.Filters.ValidationExceptionFilter>();
});

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

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment()) {
  app.UseDeveloperExceptionPage();
}

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
/// A mock OTP service for development and testing.
/// </summary>
public class MockOtpService : IOtpService {
  public Task<string> GenerateAndStoreOtpAsync(string userId, CancellationToken cancellationToken = default) => Task.FromResult("123456");
  public Task<bool> ValidateOtpAsync(string userId, string code, CancellationToken cancellationToken = default) => Task.FromResult(code == "123456");
}
