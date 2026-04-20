var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment()) {
    app.MapOpenApi();
}

app.MapGet("/", () => "Borrower Portal API is running");

app.Run();

public partial class Program { }
