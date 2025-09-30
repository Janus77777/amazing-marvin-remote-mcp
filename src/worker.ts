import { CloudflareEnv, MCPRequest, MCPResponse } from './types';
import { OAuthHandler } from './oauth';
import { MarvinAPIClient } from './marvin-api';
import { MCPToolHandler } from './mcp-tools';
import { MCP_TOOLS } from './config';

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // Add CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      const oauthHandler = new OAuthHandler(env, `https://${url.host}`);

      // ========== OAuth 2.1 DISCOVERY ENDPOINT ==========
      if (pathname === '/.well-known/oauth-authorization-server') {
        return await oauthHandler.handleDiscovery();
      }

      // Legacy MCP discovery endpoints for backwards compatibility
      if (pathname === '/.well-known/mcp_discovery' || pathname === '/.well-known/mcp-discovery') {
        return await oauthHandler.handleDiscovery();
      }

      // OAuth protected resource endpoint
      if (pathname === '/.well-known/oauth-protected-resource') {
        const protectedResourceResponse = {
          resource_server: this.baseUrl || `https://${url.host}`,
          authorization_servers: [`https://${url.host}`],
          scopes_supported: ["marvin:read", "marvin:write"],
          bearer_methods_supported: ["header"],
          resource_documentation: `https://${url.host}`,
          resource_server_name: "Amazing Marvin Remote MCP"
        };
        
        return new Response(JSON.stringify(protectedResourceResponse), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        });
      }

      // ========== OAUTH ENDPOINTS ==========
      if (pathname === '/oauth/register' || pathname === '/register') {
        if (request.method === 'POST') {
          return await oauthHandler.handleClientRegistration(request);
        }
        return new Response('Method not allowed', { status: 405 });
      }

      if (pathname === '/oauth/authorize' || pathname === '/auth' || pathname === '/authorize') {
        if (request.method === 'GET') {
          return await oauthHandler.handleAuthorization(request);
        } else if (request.method === 'POST') {
          return await oauthHandler.handleAuthorizationSubmit(request);
        }
        return new Response('Method not allowed', { status: 405 });
      }

      if (pathname === '/oauth/token' || pathname === '/token') {
        if (request.method === 'POST') {
          return await oauthHandler.handleTokenExchange(request);
        }
        return new Response('Method not allowed', { status: 405 });
      }

      if (pathname === '/.well-known/jwks.json') {
        return await oauthHandler.handleJWKS();
      }

      // ========== INFO ENDPOINT ==========
      if (pathname === '/info') {
        // Handle GET requests for info
        if (request.method === 'GET') {
          const info = {
            name: 'Amazing Marvin Remote MCP',
            version: '1.0.0',
            description: 'Remote MCP server for Amazing Marvin productivity system',
            tools: MCP_TOOLS.length,
            endpoints: {
              mcp_discovery: '/.well-known/oauth-authorization-server',
              oauth_register: '/oauth/register', 
              oauth_auth: '/oauth/authorize',
              oauth_token: '/oauth/token',
              mcp: '/'
            },
            docs: 'https://github.com/your-repo/amazing-marvin-remote-mcp'
          };

          return new Response(JSON.stringify(info, null, 2), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        return new Response('Method not allowed', { status: 405, headers: corsHeaders });
      }

      // ========== MCP ENDPOINT (ROOT) ==========
      if (pathname === '/') {
        // Handle GET requests for info (Claude needs this for verification)
        if (request.method === 'GET') {
          const info = {
            name: 'Amazing Marvin Remote MCP',
            version: '1.0.0',
            description: 'Remote MCP server for Amazing Marvin productivity system',
            tools: MCP_TOOLS.length,
            endpoints: {
              mcp_discovery: '/.well-known/oauth-authorization-server',
              oauth_register: '/oauth/register', 
              oauth_auth: '/oauth/authorize',
              oauth_token: '/oauth/token',
              mcp: '/'
            },
            docs: 'https://github.com/your-repo/amazing-marvin-remote-mcp'
          };

          return new Response(JSON.stringify(info, null, 2), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Handle POST requests for MCP (Streamable HTTP)
        if (request.method !== 'POST') {
          return new Response('Method not allowed', { status: 405, headers: corsHeaders });
        }

        // Check if client supports SSE (Streamable HTTP requirement)
        const acceptHeader = request.headers.get('Accept') || '';
        const supportsSSE = acceptHeader.includes('text/event-stream');
        
        console.log('🔍 Accept header:', acceptHeader);
        console.log('📡 Supports SSE:', supportsSSE);

        // Parse MCP request first
        let mcpRequest: MCPRequest;
        try {
          mcpRequest = await request.json();
          console.log('📥 MCP Request:', JSON.stringify(mcpRequest, null, 2));
        } catch (error) {
          console.error('❌ Parse error:', error);
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32700,
              message: 'Parse error'
            }
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check if this is an unauthenticated method
        const unauthenticatedMethods = ['initialize', 'tools/list', 'prompts/list', 'resources/list', 'ping', 'notifications/initialized'];
        const unauthenticatedTools = ['test_connection', 'marvin_test_connection'];
        
        const isToolCall = mcpRequest.method === 'tools/call';
        const toolName = isToolCall ? mcpRequest.params?.name : null;
        const isUnauthenticatedTool = isToolCall && (toolName === 'test_connection' || toolName === 'marvin_test_connection');
        
        const requiresAuth = false; // Disable all auth checks since API key is hardcoded

        // Hardcoded user info with API Token (try original one)
        let userInfo = {
          amazing_marvin_api_key: '7jRRMJUcqfAxQTFABtEMytsAf4I='
        };

        // Handle MCP methods with Streamable HTTP
        return await this.handleMCPRequest(mcpRequest, userInfo, env, corsHeaders, supportsSSE);
      }

      // ========== 404 ==========
      return new Response('Not found', { 
        status: 404, 
        headers: corsHeaders 
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  },

  async handleMCPRequest(
    mcpRequest: MCPRequest, 
    userInfo: any, 
    env: CloudflareEnv, 
    corsHeaders: Record<string, string>,
    supportsSSE: boolean = false
  ): Promise<Response> {
    const { method, params, id } = mcpRequest;

    try {
      let result: any = null;

      switch (method) {
        case 'initialize':
          // Support the protocol version that Claude requests
          const requestedVersion = params.protocolVersion || '2024-11-05';
          result = {
            protocolVersion: requestedVersion,
            capabilities: {
              tools: {
                listChanged: true
              }
            },
            serverInfo: {
              name: 'Amazing Marvin Remote MCP',
              version: '1.0.0'
            }
          };
          console.log('🤝 Negotiated protocol version:', requestedVersion);
          break;

        case 'tools/list':
          // Always return full tool list so Claude knows what tools are available
          // Authentication will be required when actually calling tools
          result = {
            tools: MCP_TOOLS
          };
          console.log('🔧 Returned', MCP_TOOLS.length, 'tools to Claude');
          break;

        case 'ping':
          result = { status: 'pong' };
          break;

        case 'prompts/list':
          result = { prompts: [] }; // No prompts supported
          break;

        case 'resources/list':
          result = { resources: [] }; // No resources supported
          break;

        case 'notifications/initialized':
          // This is a notification, no response needed
          console.log('📣 Client initialized');
          
          // Send tools/list_changed notification to force Claude to refetch tools
          console.log('📢 Sending tools/list_changed notification');
          
          // For notifications, return empty response (no content)
          if (supportsSSE) {
            // Empty SSE stream for notifications
            const stream = new ReadableStream({
              start(controller) {
                controller.close();
              }
            });
            return new Response(stream, {
              status: 200,
              headers: { 
                ...corsHeaders, 
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
              }
            });
          } else {
            return new Response(null, { status: 204, headers: corsHeaders });
          }
          break;

        case 'tools/call':
          if (!params?.name) {
            throw new Error('Tool name is required');
          }
          
          // Handle test tools
          if (params.name === 'test_connection' || params.name === 'marvin_test_connection') {
            if (params.name === 'test_connection') {
              // Basic MCP server connection test
              result = {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      status: 'success',
                      message: 'MCP server connection test successful',
                      server: 'Amazing Marvin Remote MCP',
                      version: '1.0.0',
                      timestamp: new Date().toISOString()
                    }, null, 2)
                  }
                ]
              };
            } else if (params.name === 'marvin_test_connection') {
              // Test actual Amazing Marvin API connection
              try {
                if (!userInfo || !userInfo.amazing_marvin_api_key) {
                  result = {
                    content: [
                      {
                        type: 'text',
                        text: JSON.stringify({
                          status: 'auth_required',
                          message: 'MCP server connection successful, but Amazing Marvin API key is required',
                          instructions: 'Please authorize this connector to access your Amazing Marvin account by clicking the authorization button in Claude',
                          server: 'Amazing Marvin Remote MCP',
                          version: '1.0.0',
                          timestamp: new Date().toISOString()
                        }, null, 2)
                      }
                    ]
                  };
                } else {
                  const apiClient = new MarvinAPIClient(userInfo.amazing_marvin_api_key, env.CACHE, env);
                  const accountInfo = await apiClient.getAccountInfo();
                  
                  result = {
                    content: [
                      {
                        type: 'text',
                        text: JSON.stringify({
                          status: 'success',
                          message: 'Successfully connected to Amazing Marvin API',
                          account: {
                            email: accountInfo.result?.email || 'Unknown',
                            subscriptionType: accountInfo.result?.subscriptionType || 'Unknown'
                          },
                          timestamp: new Date().toISOString()
                        }, null, 2)
                      }
                    ]
                  };
                }
              } catch (error) {
                result = {
                  content: [
                    {
                      type: 'text',
                      text: JSON.stringify({
                        status: 'error',
                        message: 'Failed to connect to Amazing Marvin API',
                        error: error instanceof Error ? error.message : 'Unknown error',
                        instructions: 'Please check your Amazing Marvin API key and try again',
                        timestamp: new Date().toISOString()
                      }, null, 2)
                    }
                  ]
                };
              }
            } else {
              // Other unauthenticated tools - return auth required message
              result = {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      status: 'auth_required',
                      message: `Tool "${params.name}" requires authorization to access Amazing Marvin API`,
                      instructions: 'Please authorize this connector to access your Amazing Marvin account by clicking the authorization button in Claude',
                      tool: params.name,
                      server: 'Amazing Marvin Remote MCP',
                      version: '1.0.0',
                      timestamp: new Date().toISOString()
                    }, null, 2)
                  }
                ]
              };
            }
            break;
          }
          
          if (!userInfo) {
            throw new Error('Authentication required for tool calls');
          }
          
          // Initialize API client for authenticated methods
          const apiClient = new MarvinAPIClient(userInfo.amazing_marvin_api_key, env.CACHE, env);
          const toolHandler = new MCPToolHandler(apiClient);
          
          // Call the tool
          const toolResult = await toolHandler.handleToolCall(params.name, params.arguments || {});
          
          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify(toolResult, null, 2)
              }
            ]
          };
          break;

        default:
          throw new Error(`Unknown method: ${method}`);
      }

      const response: MCPResponse = {
        jsonrpc: '2.0',
        id,
        result
      };

      console.log('📤 MCP Response:', JSON.stringify(response, null, 2));
      
      // Use SSE streaming if client supports it (Streamable HTTP)
      if (supportsSSE) {
        console.log('🌊 Using SSE streaming response');
        
        // Create SSE stream
        const stream = new ReadableStream({
          start(controller) {
            // Send the response as SSE event
            const eventData = `data: ${JSON.stringify(response)}\n\n`;
            controller.enqueue(new TextEncoder().encode(eventData));
            controller.close();
          }
        });

        return new Response(stream, {
          status: 200,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          }
        });
      } else {
        // Fallback to regular JSON response
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

    } catch (error) {
      console.error('❌ MCP Error:', error);
      const errorResponse: MCPResponse = {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
          data: {
            stack: error instanceof Error ? error.stack : undefined
          }
        }
      };

      console.log('📤 MCP Error Response:', JSON.stringify(errorResponse, null, 2));
      
      // Use SSE streaming for errors too if client supports it
      if (supportsSSE) {
        console.log('🌊 Using SSE streaming for error response');
        
        const stream = new ReadableStream({
          start(controller) {
            const eventData = `data: ${JSON.stringify(errorResponse)}\n\n`;
            controller.enqueue(new TextEncoder().encode(eventData));
            controller.close();
          }
        });

        return new Response(stream, {
          status: 200,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          }
        });
      } else {
        return new Response(JSON.stringify(errorResponse), {
          status: 200, // MCP errors are still HTTP 200
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
  }
} satisfies ExportedHandler<CloudflareEnv>;