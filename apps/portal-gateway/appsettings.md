# `appsettings.json` Configuration Documentation

This document explains the YARP (Yet Another Reverse Proxy) configuration found in `appsettings.json`.

## `ReverseProxy` Section

### `Routes`
Routes define how YARP matches incoming requests and which cluster to send them to.

-   **`IdentityRoute`**: This route handles all general requests for the Identity service.
    -   `"ClusterId": "IdentityCluster"`: Sends matching requests to the `IdentityCluster`.
    -   `"Match:Path": "/identity/{**catch-all}"`: Matches any request whose path starts with `/identity/`. The `{**catch-all}` part captures the rest of the URL path and appends it to the destination address.
    -   `"Transforms"`: This transform adds the standard `X-Forwarded-*` headers to the request before sending it to the destination service. This is crucial for telling the backend service about the original client's IP, protocol (`http` vs `https`), etc.

-   **`TokenRoute`**: This route specifically handles requests for the token endpoint, which requires stricter security.
    -   `"RateLimiterPolicy": "token-bucket"`: Applies the `"token-bucket"` rate limiting policy defined in `Program.cs`. This protects the sensitive login endpoint from brute-force attacks.
    -   `"Match:Path": "/connect/token"`: Matches only requests to the exact path `/connect/token`.

### `Clusters`
Clusters define a group of one or more destination servers that can handle a request for a given route.

-   **`IdentityCluster`**: This cluster represents our downstream Identity service.
    -   `"Destinations"`: Contains the list of servers for this cluster.
    -   `"Address": "http://localhost:5001/identity"`: The address of the backend Identity service. In a production environment, this would point to the internal address of the service.
