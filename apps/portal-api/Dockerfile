# JUNIOR RATIONALE: We use a multi-stage build to keep the final image small.
# Stage 1: Build the application
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy solution and project files first to leverage Docker caching
COPY tai-portal.slnx .
COPY apps/portal-api/portal-api.csproj apps/portal-api/
COPY libs/core/domain/Tai.Portal.Core.Domain.csproj libs/core/domain/
COPY libs/core/application/Tai.Portal.Core.Application.csproj libs/core/application/
COPY libs/core/infrastructure/Tai.Portal.Core.Infrastructure.csproj libs/core/infrastructure/

# Restore dependencies
RUN dotnet restore apps/portal-api/portal-api.csproj

# Copy the remaining source code
COPY . .

# Build and publish
# NOTE: NativeAOT is strictly prohibited as per project guidelines.
RUN dotnet publish apps/portal-api/portal-api.csproj -c Release -o /app/publish /p:PublishAot=false

# Stage 2: Run the application
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

# Expose ports (matching launchSettings.json)
EXPOSE 5031
EXPOSE 7104

ENTRYPOINT ["dotnet", "portal-api.dll"]
