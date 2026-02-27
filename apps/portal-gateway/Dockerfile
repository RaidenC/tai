# JUNIOR RATIONALE: Multi-stage build for efficient production images.
# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy project files
COPY tai-portal.slnx .
COPY apps/portal-gateway/Tai.Portal.Gateway.csproj apps/portal-gateway/

# Restore
RUN dotnet restore apps/portal-gateway/Tai.Portal.Gateway.csproj

# Copy source
COPY . .

# Publish
RUN dotnet publish apps/portal-gateway/Tai.Portal.Gateway.csproj -c Release -o /app/publish

# Stage 2: Run
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

# Expose port (matching YARP config)
EXPOSE 5217

ENTRYPOINT ["dotnet", "Tai.Portal.Gateway.dll"]
