import { CloudflareEnv, OAuthTokenResponse, OAuthUserInfo } from './types';
import * as jose from 'jose';

export class OAuthHandler {
  private env: CloudflareEnv;
  private baseUrl: string;

  constructor(env: CloudflareEnv, baseUrl: string) {
    this.env = env;
    this.baseUrl = baseUrl;
  }

  /**
   * Handle OAuth discovery endpoint - required by Claude for MCP
   */
  async handleDiscovery(): Promise<Response> {
    const discoveryResponse = {
      issuer: this.baseUrl,
      authorization_endpoint: `${this.baseUrl}/oauth/authorize`,
      token_endpoint: `${this.baseUrl}/oauth/token`,
      registration_endpoint: `${this.baseUrl}/oauth/register`,
      jwks_uri: `${this.baseUrl}/.well-known/jwks.json`,
      scopes_supported: ["marvin:read", "marvin:write"],
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
      code_challenge_methods_supported: ["S256"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["HS256"],
      // Legacy format for backwards compatibility
      authorization_url: `${this.baseUrl}/oauth/authorize`,
      token_url: `${this.baseUrl}/oauth/token`,
      client_registration_url: `${this.baseUrl}/oauth/register`
    };

    return new Response(JSON.stringify(discoveryResponse), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }

  /**
   * Handle client registration (Dynamic Client Registration - RFC 7591)
   */
  async handleClientRegistration(request: Request): Promise<Response> {
    try {
      const registrationRequest = await request.json() as any;
      
      // Generate a client ID
      const clientId = crypto.randomUUID();
      const clientSecret = crypto.randomUUID();

      // Store client credentials (in production, use proper database)
      await this.env.TOKENS.put(`client:${clientId}`, JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uris: registrationRequest.redirect_uris || [],
        client_name: registrationRequest.client_name || 'Claude MCP Client',
        created_at: Date.now()
      }), { expirationTtl: 86400 * 30 }); // 30 days

      const registrationResponse = {
        client_id: clientId,
        client_secret: clientSecret,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_secret_expires_at: 0, // Never expires
        redirect_uris: registrationRequest.redirect_uris || [],
        token_endpoint_auth_method: "client_secret_post",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        client_name: registrationRequest.client_name || 'Claude MCP Client'
      };

      return new Response(JSON.stringify(registrationResponse), {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'invalid_request',
        error_description: 'Invalid client registration request'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Handle authorization endpoint
   */
  async handleAuthorization(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const clientId = url.searchParams.get('client_id');
    const redirectUri = url.searchParams.get('redirect_uri');
    const state = url.searchParams.get('state');
    const responseType = url.searchParams.get('response_type');
    const codeChallenge = url.searchParams.get('code_challenge');
    const codeChallengeMethod = url.searchParams.get('code_challenge_method');

    if (!clientId || !redirectUri || responseType !== 'code') {
      return new Response('Invalid authorization request', { status: 400 });
    }

    // For Claude's dynamic client registration, auto-register the client if not exists
    let clientData = await this.env.TOKENS.get(`client:${clientId}`);
    if (!clientData) {
      // Auto-register client for Claude
      const autoClient = {
        client_id: clientId,
        client_secret: crypto.randomUUID(),
        redirect_uris: [redirectUri],
        client_name: 'Claude MCP Auto-registered Client',
        created_at: Date.now()
      };
      
      await this.env.TOKENS.put(`client:${clientId}`, JSON.stringify(autoClient), { expirationTtl: 86400 * 30 });
      clientData = JSON.stringify(autoClient);
    }

    // In a real implementation, this would redirect to an authorization page
    // For this example, we'll show a simple form
    const authForm = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Amazing Marvin MCP Authorization</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 500px; margin: 50px auto; padding: 20px; }
            .form-group { margin-bottom: 15px; }
            label { display: block; margin-bottom: 5px; font-weight: bold; }
            input[type="password"], input[type="text"] { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
            button { background-color: #007cba; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
            button:hover { background-color: #005a87; }
            .info { background-color: #f0f8ff; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
        </style>
    </head>
    <body>
        <h2>Amazing Marvin MCP Authorization</h2>
        <div class="info">
            <p>Claude is requesting access to your Amazing Marvin account.</p>
            <p>Please enter your Amazing Marvin API key to authorize access.</p>
        </div>
        <form method="POST" action="/oauth/authorize">
            <input type="hidden" name="client_id" value="${clientId}">
            <input type="hidden" name="redirect_uri" value="${redirectUri}">
            <input type="hidden" name="state" value="${state || ''}">
            <input type="hidden" name="code_challenge" value="${codeChallenge || ''}">
            <input type="hidden" name="code_challenge_method" value="${codeChallengeMethod || ''}">
            
            <div class="form-group">
                <label for="api_key">Amazing Marvin API Key:</label>
                <input type="password" id="api_key" name="api_key" required 
                       placeholder="Enter your Amazing Marvin API key">
            </div>
            
            <div class="form-group">
                <button type="submit">Authorize Access</button>
            </div>
        </form>
        
        <p><small>
            You can find your API key in Amazing Marvin under Settings → API.
            This key will be securely stored and used only to access your Marvin data.
        </small></p>
    </body>
    </html>`;

    return new Response(authForm, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  }

  /**
   * Handle authorization form submission
   */
  async handleAuthorizationSubmit(request: Request): Promise<Response> {
    try {
      const formData = await request.formData();
      const clientId = formData.get('client_id') as string;
      const redirectUri = formData.get('redirect_uri') as string;
      const state = formData.get('state') as string;
      const apiKey = formData.get('api_key') as string;
      const codeChallenge = formData.get('code_challenge') as string;
      const codeChallengeMethod = formData.get('code_challenge_method') as string;

      if (!clientId || !redirectUri || !apiKey) {
        return new Response('Missing required parameters', { status: 400 });
      }

      // Verify API key by making a test request to Amazing Marvin
      const testResponse = await fetch('https://serv.amazingmarvin.com/api/me', {
        headers: {
          'X-API-Token': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!testResponse.ok) {
        return new Response(`
        <html><body>
            <h2>Authorization Failed</h2>
            <p>Invalid Amazing Marvin API key. Please go back and try again.</p>
            <button onclick="history.back()">Go Back</button>
        </body></html>`, {
          status: 400,
          headers: { 'Content-Type': 'text/html' }
        });
      }

      // Generate authorization code
      const authCode = crypto.randomUUID();
      
      // Store the authorization code with API key and PKCE info
      await this.env.TOKENS.put(`auth_code:${authCode}`, JSON.stringify({
        client_id: clientId,
        redirect_uri: redirectUri,
        api_key: apiKey,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
        created_at: Date.now()
      }), { expirationTtl: 600 }); // 10 minutes

      // Redirect back to client with authorization code
      const redirectUrl = new URL(redirectUri);
      redirectUrl.searchParams.set('code', authCode);
      if (state) {
        redirectUrl.searchParams.set('state', state);
      }

      return Response.redirect(redirectUrl.toString(), 302);
    } catch (error) {
      return new Response('Authorization failed', { status: 500 });
    }
  }

  /**
   * Handle token exchange
   */
  async handleTokenExchange(request: Request): Promise<Response> {
    try {
      const formData = await request.formData();
      const grantType = formData.get('grant_type') as string;
      const code = formData.get('code') as string;
      const refreshToken = formData.get('refresh_token') as string;
      const clientId = formData.get('client_id') as string;
      const clientSecret = formData.get('client_secret') as string;
      const redirectUri = formData.get('redirect_uri') as string;
      const codeVerifier = formData.get('code_verifier') as string;

      // Handle refresh token requests
      if (grantType === 'refresh_token') {
        return await this.handleRefreshToken(refreshToken, clientId, clientSecret);
      }

      if (grantType !== 'authorization_code' || !code || !clientId) {
        return new Response(JSON.stringify({
          error: 'invalid_request',
          error_description: 'Missing required parameters'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Verify client credentials
      const clientData = await this.env.TOKENS.get(`client:${clientId}`);
      if (!clientData) {
        return new Response(JSON.stringify({
          error: 'invalid_client'
        }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }

      const client = JSON.parse(clientData);
      
      // PKCE verification takes precedence over client secret
      const authData = JSON.parse(await this.env.TOKENS.get(`auth_code:${code}`) || '{}');
      
      if (authData.code_challenge && codeVerifier) {
        // Verify PKCE code challenge
        if (authData.code_challenge_method === 'S256') {
          const encoder = new TextEncoder();
          const data = encoder.encode(codeVerifier);
          const digest = await crypto.subtle.digest('SHA-256', data);
          const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
          
          if (base64 !== authData.code_challenge) {
            return new Response(JSON.stringify({
              error: 'invalid_grant',
              error_description: 'PKCE verification failed'
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
          }
        }
      } else if (clientSecret && client.client_secret !== clientSecret) {
        return new Response(JSON.stringify({
          error: 'invalid_client'
        }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }

      // Authorization code data already retrieved above for PKCE verification
      if (!authData.client_id) {
        return new Response(JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Authorization code expired or invalid'
        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      
      // Verify redirect URI matches
      if (authData.redirect_uri !== redirectUri) {
        return new Response(JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Redirect URI mismatch'
        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      // Generate access token (JWT) with longer expiration
      const accessToken = await this.generateJWT({
        sub: clientId,
        amazing_marvin_api_key: authData.api_key,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 3600) // 24 hours
      });

      // Generate refresh token
      const newRefreshToken = crypto.randomUUID();
      await this.env.TOKENS.put(`refresh_token:${newRefreshToken}`, JSON.stringify({
        client_id: clientId,
        api_key: authData.api_key,
        created_at: Date.now()
      }), { expirationTtl: 86400 * 30 }); // 30 days

      // Clean up authorization code
      await this.env.TOKENS.delete(`auth_code:${code}`);

      const tokenResponse: OAuthTokenResponse = {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 86400, // 24 hours in seconds
        refresh_token: newRefreshToken,
        scope: 'marvin:read marvin:write'
      };

      return new Response(JSON.stringify(tokenResponse), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'server_error',
        error_description: 'Token exchange failed'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Verify and decode JWT token
   */
  async verifyToken(token: string): Promise<OAuthUserInfo | null> {
    try {
      const secret = new TextEncoder().encode(this.env.JWT_SECRET);
      const { payload } = await jose.jwtVerify(token, secret);
      return payload as OAuthUserInfo;
    } catch (error) {
      return null;
    }
  }

  /**
   * Handle refresh token requests
   */
  async handleRefreshToken(refreshToken: string, clientId: string, clientSecret?: string): Promise<Response> {
    try {
      if (!refreshToken || !clientId) {
        return new Response(JSON.stringify({
          error: 'invalid_request',
          error_description: 'Missing refresh token or client ID'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Verify refresh token
      const refreshTokenData = await this.env.TOKENS.get(`refresh_token:${refreshToken}`);
      if (!refreshTokenData) {
        return new Response(JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Invalid or expired refresh token'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const tokenData = JSON.parse(refreshTokenData);
      if (tokenData.client_id !== clientId) {
        return new Response(JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Client ID mismatch'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Generate new access token
      const accessToken = await this.generateJWT({
        sub: clientId,
        amazing_marvin_api_key: tokenData.api_key,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 3600) // 24 hours
      });

      // Generate new refresh token
      const newRefreshToken = crypto.randomUUID();
      await this.env.TOKENS.put(`refresh_token:${newRefreshToken}`, JSON.stringify({
        client_id: clientId,
        api_key: tokenData.api_key,
        created_at: Date.now()
      }), { expirationTtl: 86400 * 30 }); // 30 days

      // Delete old refresh token
      await this.env.TOKENS.delete(`refresh_token:${refreshToken}`);

      const tokenResponse = {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 86400, // 24 hours
        refresh_token: newRefreshToken,
        scope: 'marvin:read marvin:write'
      };

      return new Response(JSON.stringify(tokenResponse), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'server_error',
        error_description: 'Failed to refresh token'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Generate JWT token
   */
  private async generateJWT(payload: any): Promise<string> {
    const secret = new TextEncoder().encode(this.env.JWT_SECRET);
    return await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h') // 24 hours
      .sign(secret);
  }

  /**
   * Handle JWKS endpoint (for JWT verification)
   */
  async handleJWKS(): Promise<Response> {
    // In a real implementation, you'd use RSA keys and provide the public key
    // For this example with HMAC, we don't expose the secret
    const jwks = {
      keys: []
    };

    return new Response(JSON.stringify(jwks), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}