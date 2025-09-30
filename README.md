# Amazing Marvin Remote MCP Server

A remote MCP (Model Context Protocol) server for Amazing Marvin productivity system, compatible with Claude mobile and desktop apps.

## ✨ Features

- **28 Productivity Tools** - All original Amazing Marvin MCP tools ported to remote version
- **Mobile Compatible** - Works with Claude mobile apps (iOS/Android) 
- **OAuth 2.0 Authentication** - Secure authentication with Dynamic Client Registration
- **Cloudflare Workers** - Serverless deployment with global edge network
- **Caching** - Intelligent caching for improved performance
- **Full API Coverage** - Read/write operations, analytics, time tracking

## 🚀 Quick Start

### 1. Prerequisites

- Cloudflare account
- Amazing Marvin API key
- Node.js 18+ and npm/yarn

### 2. Installation

```bash
# Clone and install dependencies
git clone <your-repo-url>
cd amazing-marvin-remote-mcp
npm install
```

### 3. Configuration

```bash
# Set up Wrangler CLI
npm install -g wrangler
wrangler login

# Create KV namespaces
wrangler kv:namespace create "CACHE"
wrangler kv:namespace create "TOKENS"
wrangler kv:namespace create "CACHE" --preview
wrangler kv:namespace create "TOKENS" --preview

# Update wrangler.toml with the namespace IDs
# Set secrets
wrangler secret put AMAZING_MARVIN_API_KEY
wrangler secret put OAUTH_CLIENT_SECRET  # Generate a random string
wrangler secret put JWT_SECRET           # Generate a random string
```

### 4. Deploy

```bash
# Development
npm run dev

# Production
npm run deploy
```

### 5. Connect to Claude

1. Go to Claude.ai → Settings → Connectors
2. Add Custom Connector
3. Enter your worker URL: `https://your-worker.your-subdomain.workers.dev`
4. Authorize with your Amazing Marvin API key

## 🛠️ Available Tools

### Read Operations (12 tools)
- `get_daily_productivity_overview` - Comprehensive daily view
- `get_tasks` - Today's scheduled items
- `get_projects` - All projects
- `get_categories` - All categories  
- `get_due_items` - Overdue/due items
- `get_child_tasks` - Subtasks (with recursive option)
- `get_all_tasks` - All tasks (with label filtering)
- `get_labels` - Task labels
- `get_goals` - Goals and objectives
- `get_account_info` - Account details
- `get_completed_tasks` - Completed items
- `get_completed_tasks_for_date` - Completed items for specific date

### Write Operations (10 tools)
- `create_task` - Create new tasks
- `mark_task_done` - Complete tasks
- `create_project` - Create projects
- `start_time_tracking` - Start time tracking
- `stop_time_tracking` - Stop time tracking
- `batch_mark_done` - Complete multiple tasks
- `batch_create_tasks` - Create multiple tasks
- `create_project_with_tasks` - Create project with tasks
- `quick_daily_planning` - Generate daily planning overview
- `get_daily_focus` - Get categorized daily tasks

### Analytics Operations (6 tools)
- `get_productivity_summary` - Current productivity overview
- `get_productivity_summary_for_time_range` - Time-range analytics
- `get_project_overview` - Project completion metrics
- `get_time_tracking_summary` - Time tracking data
- `get_done_items` - Alternative completed items retrieval
- `get_time_tracks` - Time tracking records

## 📱 Mobile Setup Guide

### iOS/Android Claude App

1. **Configure on Web First**
   - Open Claude.ai in your browser
   - Go to Settings → Connectors → Add Custom Connector
   - Name: "Amazing Marvin"  
   - URL: `https://your-worker.your-subdomain.workers.dev`

2. **Authorize Access**
   - Click "Connect" 
   - Enter your Amazing Marvin API key when prompted
   - Complete OAuth flow

3. **Use on Mobile**
   - Settings automatically sync to mobile apps
   - Start using Marvin tools in conversations

### Example Usage

```
Claude, what's my daily productivity overview?

Claude, create a task "Review project proposal" scheduled for tomorrow

Claude, show me my project completion metrics
```

## 🔧 Development

### Project Structure

```
src/
├── worker.ts          # Main Cloudflare Worker
├── oauth.ts           # OAuth 2.0 implementation
├── marvin-api.ts      # Amazing Marvin API client
├── mcp-tools.ts       # MCP tool implementations
├── types.ts           # TypeScript types
└── config.ts          # Tool definitions & config
```

### Local Development

```bash
# Start development server
npm run dev

# Type checking
npm run type-check

# Deploy to staging
wrangler deploy --env staging
```

### Environment Variables

Set these secrets via Wrangler:

- `AMAZING_MARVIN_API_KEY` - Your Amazing Marvin API key
- `OAUTH_CLIENT_SECRET` - Random secret for OAuth (generate with crypto.randomUUID())
- `JWT_SECRET` - Random secret for JWT signing (generate with crypto.randomUUID())

## 🔐 Security

- **OAuth 2.0** - Industry standard authentication
- **JWT Tokens** - Secure, stateless authentication
- **API Key Encryption** - User API keys stored securely
- **CORS Protection** - Proper cross-origin controls
- **Rate Limiting** - Built-in Cloudflare protection

## 🚨 Troubleshooting

### Common Issues

1. **"Invalid API key"** - Check your Amazing Marvin API key in Amazing Marvin → Settings → API

2. **"Tool not found"** - Ensure you're using exact tool names from the list above

3. **"Authentication failed"** - Re-authorize the connector in Claude settings

4. **KV namespace errors** - Verify namespace IDs in wrangler.toml match your created namespaces

### Debug Mode

Enable debug mode by setting environment variable:
```bash
wrangler secret put DEBUG_MODE
# Enter: true
```

## 📊 Performance

- **Global Edge Network** - Deployed to 200+ Cloudflare locations
- **Intelligent Caching** - 10-minute cache for frequently accessed data
- **Sub-second Response** - Optimized for mobile usage
- **99.9% Uptime** - Cloudflare's reliability guarantee

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Original [Amazing Marvin MCP](https://github.com/bgheneti/Amazing-Marvin-MCP) by bgheneti
- [Model Context Protocol](https://modelcontextprotocol.io/) by Anthropic
- [Amazing Marvin](https://amazingmarvin.com/) productivity system

---

**Made with ❤️ for the Amazing Marvin and Claude community**