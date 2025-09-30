#!/usr/bin/env node

/**
 * Amazing Marvin Remote MCP Test Script
 * 
 * This script tests the MCP server functionality by making HTTP requests
 * to simulate Claude's MCP client behavior.
 */

const https = require('https');
const readline = require('readline');

class MCPTester {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.accessToken = null;
  }

  /**
   * Make HTTP request
   */
  async makeRequest(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const method = options.method || 'GET';
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'MCP-Tester/1.0',
      ...options.headers
    };

    if (this.accessToken && !headers.Authorization) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    return new Promise((resolve, reject) => {
      const req = https.request(url, { method, headers }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = {
              status: res.statusCode,
              headers: res.headers,
              data: data ? JSON.parse(data) : null
            };
            resolve(result);
          } catch (error) {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: data,
              parseError: error.message
            });
          }
        });
      });

      req.on('error', reject);
      
      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      
      req.end();
    });
  }

  /**
   * Test server info endpoint
   */
  async testServerInfo() {
    console.log('🔍 Testing server info...');
    try {
      const response = await this.makeRequest('/');
      if (response.status === 200) {
        console.log('✅ Server info retrieved successfully');
        console.log('📊 Server Details:', JSON.stringify(response.data, null, 2));
        return true;
      } else {
        console.log('❌ Server info failed:', response.status);
        return false;
      }
    } catch (error) {
      console.log('❌ Server info error:', error.message);
      return false;
    }
  }

  /**
   * Test MCP discovery endpoint
   */
  async testDiscovery() {
    console.log('🔍 Testing MCP discovery...');
    try {
      const response = await this.makeRequest('/.well-known/mcp_discovery');
      if (response.status === 200) {
        console.log('✅ MCP discovery successful');
        console.log('🔗 Discovery Data:', JSON.stringify(response.data, null, 2));
        return true;
      } else {
        console.log('❌ MCP discovery failed:', response.status);
        return false;
      }
    } catch (error) {
      console.log('❌ MCP discovery error:', error.message);
      return false;
    }
  }

  /**
   * Test client registration
   */
  async testClientRegistration() {
    console.log('🔍 Testing client registration...');
    try {
      const registrationData = {
        redirect_uris: ['http://localhost:8080/callback'],
        client_name: 'MCP Test Client',
        grant_types: ['authorization_code'],
        response_types: ['code']
      };

      const response = await this.makeRequest('/register', {
        method: 'POST',
        body: registrationData
      });

      if (response.status === 201) {
        console.log('✅ Client registration successful');
        console.log('🔑 Client Credentials:', JSON.stringify({
          client_id: response.data.client_id,
          client_secret: response.data.client_secret ? '***hidden***' : 'missing'
        }, null, 2));
        this.clientId = response.data.client_id;
        this.clientSecret = response.data.client_secret;
        return true;
      } else {
        console.log('❌ Client registration failed:', response.status, response.data);
        return false;
      }
    } catch (error) {
      console.log('❌ Client registration error:', error.message);
      return false;
    }
  }

  /**
   * Test OAuth authorization flow (manual step required)
   */
  async testOAuthFlow() {
    if (!this.clientId || !this.clientSecret) {
      console.log('❌ Client registration required first');
      return false;
    }

    console.log('🔍 Testing OAuth authorization flow...');
    
    const authUrl = `${this.baseUrl}/auth?` + new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: 'http://localhost:8080/callback',
      response_type: 'code',
      state: 'test-state'
    }).toString();

    console.log('🌐 Please visit this URL to authorize:');
    console.log(`   ${authUrl}`);
    console.log('');
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question('📝 Enter the authorization code from the redirect URL: ', async (code) => {
        rl.close();
        
        if (!code.trim()) {
          console.log('❌ No authorization code provided');
          resolve(false);
          return;
        }

        try {
          // Exchange code for token
          const tokenResponse = await this.makeRequest('/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              code: code.trim(),
              client_id: this.clientId,
              client_secret: this.clientSecret,
              redirect_uri: 'http://localhost:8080/callback'
            }).toString()
          });

          if (tokenResponse.status === 200) {
            console.log('✅ OAuth token exchange successful');
            this.accessToken = tokenResponse.data.access_token;
            console.log('🎫 Access Token:', this.accessToken ? 'Received' : 'Missing');
            resolve(true);
          } else {
            console.log('❌ OAuth token exchange failed:', tokenResponse.status, tokenResponse.data);
            resolve(false);
          }
        } catch (error) {
          console.log('❌ OAuth token exchange error:', error.message);
          resolve(false);
        }
      });
    });
  }

  /**
   * Test MCP initialize
   */
  async testMCPInitialize() {
    if (!this.accessToken) {
      console.log('❌ OAuth flow required first');
      return false;
    }

    console.log('🔍 Testing MCP initialize...');
    try {
      const mcpRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'MCP Test Client',
            version: '1.0.0'
          }
        }
      };

      const response = await this.makeRequest('/mcp', {
        method: 'POST',
        body: mcpRequest
      });

      if (response.status === 200 && response.data.result) {
        console.log('✅ MCP initialize successful');
        console.log('🚀 MCP Capabilities:', JSON.stringify(response.data.result, null, 2));
        return true;
      } else {
        console.log('❌ MCP initialize failed:', response.status, response.data);
        return false;
      }
    } catch (error) {
      console.log('❌ MCP initialize error:', error.message);
      return false;
    }
  }

  /**
   * Test MCP tools list
   */
  async testMCPToolsList() {
    if (!this.accessToken) {
      console.log('❌ OAuth flow required first');
      return false;
    }

    console.log('🔍 Testing MCP tools list...');
    try {
      const mcpRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list'
      };

      const response = await this.makeRequest('/mcp', {
        method: 'POST',
        body: mcpRequest
      });

      if (response.status === 200 && response.data.result) {
        console.log('✅ MCP tools list successful');
        const tools = response.data.result.tools || [];
        console.log(`🛠️  Found ${tools.length} tools:`);
        tools.slice(0, 5).forEach((tool, idx) => {
          console.log(`   ${idx + 1}. ${tool.name} - ${tool.description}`);
        });
        if (tools.length > 5) {
          console.log(`   ... and ${tools.length - 5} more tools`);
        }
        return tools.length > 0;
      } else {
        console.log('❌ MCP tools list failed:', response.status, response.data);
        return false;
      }
    } catch (error) {
      console.log('❌ MCP tools list error:', error.message);
      return false;
    }
  }

  /**
   * Test MCP tool call
   */
  async testMCPToolCall() {
    if (!this.accessToken) {
      console.log('❌ OAuth flow required first');
      return false;
    }

    console.log('🔍 Testing MCP tool call (get_account_info)...');
    try {
      const mcpRequest = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'get_account_info',
          arguments: {}
        }
      };

      const response = await this.makeRequest('/mcp', {
        method: 'POST',
        body: mcpRequest
      });

      if (response.status === 200) {
        if (response.data.result) {
          console.log('✅ MCP tool call successful');
          console.log('📋 Tool Result:', JSON.stringify(response.data.result, null, 2));
          return true;
        } else if (response.data.error) {
          console.log('⚠️  MCP tool call returned error:', response.data.error.message);
          return false;
        }
      }
      
      console.log('❌ MCP tool call failed:', response.status, response.data);
      return false;
    } catch (error) {
      console.log('❌ MCP tool call error:', error.message);
      return false;
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🧪 Starting Amazing Marvin Remote MCP Tests');
    console.log('🎯 Testing server:', this.baseUrl);
    console.log('=' .repeat(60));

    const tests = [
      { name: 'Server Info', fn: () => this.testServerInfo() },
      { name: 'MCP Discovery', fn: () => this.testDiscovery() },
      { name: 'Client Registration', fn: () => this.testClientRegistration() },
      { name: 'OAuth Flow', fn: () => this.testOAuthFlow() },
      { name: 'MCP Initialize', fn: () => this.testMCPInitialize() },
      { name: 'MCP Tools List', fn: () => this.testMCPToolsList() },
      { name: 'MCP Tool Call', fn: () => this.testMCPToolCall() }
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      console.log('');
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
        console.log(`⚠️  ${test.name} test failed - continuing with remaining tests`);
      }
      console.log('-'.repeat(40));
    }

    console.log('');
    console.log('📊 Test Results:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
    
    if (failed === 0) {
      console.log('🎉 All tests passed! Your MCP server is ready for use.');
    } else {
      console.log('⚠️  Some tests failed. Check the error messages above.');
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const baseUrl = args[0] || 'https://your-worker.your-subdomain.workers.dev';
  
  if (args.length === 0) {
    console.log('Usage: node test-mcp.js <worker-url>');
    console.log('Example: node test-mcp.js https://amazing-marvin-mcp.your-subdomain.workers.dev');
    process.exit(1);
  }

  const tester = new MCPTester(baseUrl);
  await tester.runAllTests();
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('💥 Unhandled error:', error.message);
  process.exit(1);
});

if (require.main === module) {
  main().catch(console.error);
}

module.exports = MCPTester;