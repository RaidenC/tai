  Here is a step-by-step guide to verify each feature:

  1. Feature 4.1: YARP Configuration


  This feature is fully verified by the automated integration tests.


   * Test File: apps/portal-gateway.integration-tests/GatewayRoutingTests.cs
   * What it Verifies:
       * That a request to /identity/test on the Gateway is successfully proxied.
       * That the X-Forwarded-For and X-Forwarded-Proto headers are correctly added to the request sent to the backend service.
   * How to Run:


   1     dotnet test apps/portal-gateway.integration-tests/Tai.Portal.Gateway.IntegrationTests.csproj --filter GatewayRoutingTests
      A passing result confirms this feature is working as expected.

  2. Feature 4.2: Rate Limiting Middleware

  This feature is also verified by automated integration tests.


   * Test File: apps/portal-gateway.integration-tests/RateLimitingTests.cs
   * What it Verifies:
       * That after 10 requests to the /connect/token endpoint, the 11th request is rejected with an HTTP 429 Too Many Requests status code.
   * How to Run:
   1     dotnet test apps/portal-gateway.integration-tests/Tai.Portal.Gateway.IntegrationTests.csproj --filter RateLimitingTests
      A passing result confirms the rate limiter is correctly protecting the token endpoint.


  3. Feature 4.3: DPoP Enforcement

  This feature requires manual verification using your browser, as it involves the browser's native Web Crypto API.

  Step 1: Run the Applications

  You will need three separate terminal windows:

   1. Run the API Gateway:


   1     nx serve portal-gateway
      (Note: This command assumes `nx-dotnet/core:serve` is configured for the gateway. If not, use `dotnet run --project apps/portal-gateway/Tai.Portal.Gateway.csproj`)


   2. Run the Identity API:
   1     nx serve portal-api

   3. Run the Angular Web App:
   1     nx serve portal-web

  Step 2: Use Browser Developer Tools


   1. Open your browser (e.g., Chrome, Firefox) and navigate to the Angular application (usually http://localhost:4200).
   2. Open the Developer Tools (usually by pressing F12) and go to the Network tab.
   3. Log in to the application.
   4. After logging in, the application will make requests to the backend API to fetch data. Click on one of these API requests in the Network tab (e.g., a request to /api/userinfo or
      similar).
   5. In the details for that request, go to the Headers section.


  Step 3: Verify the DPoP Header

  Under "Request Headers", you should see a new header:


   1 DPoP: eyJ0eXAiOiJkcG9wK2p3dCIsImFsZyI6IkVTMjU2IiwiandrIjp7Imt0eSI6IkVDIiwiY3J2IjoiUC0yNTYiLCJ4Ijoi...


  The presence of this DPoP header, containing a long JWT string, confirms that the Angular interceptor is successfully:
   * Generating the DPoP key pair.
   * Creating a signed DPoP proof for the request.
   * Attaching it to the outgoing request.


  If the API calls succeed and you see this header, it means the entire DPoP flow is working end-to-end. The backend is validating the proof, and the frontend is generating it correctly.