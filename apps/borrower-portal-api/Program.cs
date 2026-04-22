using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Tai.BorrowerPortal.Api.Middleware;
using Tai.PaymentProtection.Application;
using Tai.PaymentProtection.Application.Interfaces;
using Tai.PaymentProtection.Infrastructure.Messaging;
using Tai.PaymentProtection.Infrastructure.Persistence;
using Tai.Portal.Core.Application.Behaviors;
using Tai.Portal.Core.Application.Interfaces;
using Tai.Portal.Core.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddControllers();
builder.Services.AddHttpContextAccessor();

// MediatR — scan both this app's payment-protection.application assembly AND
// the infrastructure assembly (for ClaimDraftSavedAuditHandler).
builder.Services.AddMediatR(cfg => {
  cfg.RegisterServicesFromAssembly(typeof(IApplicationAssemblyMarker).Assembly);
  cfg.RegisterServicesFromAssembly(typeof(PaymentProtectionDbContext).Assembly);
  cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationPipelineBehavior<,>));
});

builder.Services.AddValidatorsFromAssembly(typeof(IApplicationAssemblyMarker).Assembly);

// EF Core — PaymentProtectionDbContext on Postgres
var connectionString = builder.Configuration.GetConnectionString("PaymentProtection");
builder.Services.AddDbContext<PaymentProtectionDbContext>(options => {
  options.UseNpgsql(connectionString, o => {
    o.MigrationsAssembly("Tai.PaymentProtection.Infrastructure");
    o.MigrationsHistoryTable("__EFMigrationsHistory", PaymentProtectionDbContext.SchemaName);
  });
});

// Adapters
builder.Services.AddScoped<IClaimDraftStore, EfClaimDraftStore>();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddScoped<IMessageBus, PaymentProtectionMessageBus>();

// CORS — allow the Angular dev server (4200) to call us from a browser
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

// Validation exception → 400 ValidationProblemDetails
app.Use(async (context, next) => {
  try {
    await next(context);
  } catch (FluentValidation.ValidationException ex) {
    context.Response.StatusCode = 400;
    var problemDetails = new Microsoft.AspNetCore.Mvc.ValidationProblemDetails {
      Title = "Validation Failed",
      Status = 400
    };
    foreach (var error in ex.Errors) {
      if (!problemDetails.Errors.ContainsKey(error.PropertyName)) {
        problemDetails.Errors[error.PropertyName] = new[] { error.ErrorMessage };
      } else {
        var existing = problemDetails.Errors[error.PropertyName];
        problemDetails.Errors[error.PropertyName] = existing.Concat(new[] { error.ErrorMessage }).ToArray();
      }
    }
    await context.Response.WriteAsJsonAsync(problemDetails);
  }
});

if (app.Environment.IsDevelopment()) {
  app.MapOpenApi();
}

app.UseRouting();
app.UseCors();
app.UseMiddleware<XUserIdMiddleware>();

app.MapGet("/", () => "Borrower Portal API is running");
app.MapControllers();

app.Run();
public partial class Program { }
