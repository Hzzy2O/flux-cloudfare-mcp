# Flux Cloudflare MCP

![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![TypeScript](https://img.shields.io/badge/TypeScript-4.9+-blue)
![Model Context Protocol](https://img.shields.io/badge/MCP-Enabled-purple)

A powerful Model Context Protocol (MCP) server that provides AI assistants with the ability to generate images using [Black Forest Labs' Flux model](https://developer.cloudflare.com/ai-gateway/models/flux-1/) via a Cloudflare Worker API.

[Installation](#installation) • [Features](#features) • [Usage](#usage) • [Documentation](#documentation) • [Contributing](#contributing)

---

## 🌟 Features

- **🖼️ High-Quality Image Generation**: Access to Flux, a state-of-the-art image generation model
- **🤖 Seamless AI Integration**: Enable AI assistants like Claude to generate images directly
- **🎛️ Customizable Parameters**: Control aspect ratio, inference steps, and more
- **🔌 MCP Compatible**: Works with any MCP client (Cursor, Claude Desktop, Cline, Zed, etc.)
- **🔒 Local Processing**: All requests are processed securely through the Cloudflare Worker
- **💬 Chat Completions**: Get text completions using the same API

## 📦 Installation

### Direct Usage with NPX

```bash
FLUX_API_TOKEN=your_token FLUX_API_URL=your_api_url npx -y flux-cloudflare-mcp
```

### From Source

```bash
# Clone the repository
git clone https://github.com/Hzzy2O/flux-cloudflare-mcp.git
cd flux-cloudflare-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

## 🚀 Setting Up Your Flux API

This MCP server requires a Flux API endpoint to function. You have two options for setting up the API:

### Option 1: Deploy using snakeying/flux-api-worker (Recommended)

[snakeying/flux-api-worker](https://github.com/snakeying/flux-api-worker) provides a simple and efficient Cloudflare Worker for accessing the Flux model:

1. Fork the [flux-api-worker repository](https://github.com/snakeying/flux-api-worker)
2. Deploy it to Cloudflare Workers:
   - Create a new Worker in your Cloudflare dashboard
   - Connect it to your forked repository
   - Set up the required environment variables:
     - `API_KEY`: Your chosen API key for authentication
     - `CF_ACCOUNT_ID`: Your Cloudflare account ID
     - `CF_API_TOKEN`: Your Cloudflare API token with Workers AI access
     - `FLUX_MODEL`: The Flux model to use (default: "@cf/black-forest-labs/flux-1-schnell")
3. Once deployed, your API will be available at `https://your-worker-name.your-subdomain.workers.dev`
4. Use this URL as your `FLUX_API_URL` and your chosen API key as `FLUX_API_TOKEN`

### Option 2: Deploy using aigem/cf-flux-remix

For a more feature-rich implementation with a web UI, you can use [aigem/cf-flux-remix](https://github.com/aigem/cf-flux-remix):

1. Follow the installation instructions in the [cf-flux-remix repository](https://github.com/aigem/cf-flux-remix)
2. Once deployed, your API will be available at your deployed URL
3. Use this URL as your `FLUX_API_URL` and your configured API key as `FLUX_API_TOKEN`

## 📚 Documentation

### Available Tools

#### `generate_image`

Generates an image based on a text prompt using the Flux model.

```typescript
{
  prompt: string;                // Required: Text description of the image to generate
  seed?: number;                 // Optional: Random seed for reproducible generation
  num_inference_steps?: number;  // Optional: Number of denoising steps (1-4) (default: 4)
  aspect_ratio?: string;         // Optional: Aspect ratio (e.g., "16:9", "4:3") (default: "1:1")
  disable_safety_checker?: boolean; // Optional: Disable safety filter (default: false)
}
```

#### `get_chat_completion`

Gets a text completion from the Flux API.

```typescript
{
  prompt: string;  // Required: Text prompt for completion
}
```

## 🔧 Usage

### Cursor Integration

#### Method 1: Using mcp.json

1. Create or edit the `.cursor/mcp.json` file in your project directory:

```json
{
  "mcpServers": {
    "flux-cloudflare-mcp": {
      "command": "env FLUX_API_TOKEN=YOUR_TOKEN FLUX_API_URL=YOUR_API_URL npx",
      "args": ["-y", "flux-cloudflare-mcp"]
    }
  }
}
```

2. Replace `YOUR_TOKEN` with your actual Flux API token and `YOUR_API_URL` with your API URL
3. Restart Cursor to apply the changes

#### Method 2: Using Cursor MCP Settings

1. Open Cursor and go to Settings
2. Navigate to the "MCP" or "Model Context Protocol" section
3. Click "Add Server" or equivalent
4. Enter the following command in the appropriate field:

```
env FLUX_API_TOKEN=YOUR_TOKEN FLUX_API_URL=YOUR_API_URL npx -y flux-cloudflare-mcp
```

5. Replace `YOUR_TOKEN` with your actual Flux API token and `YOUR_API_URL` with your API URL
6. Save the settings and restart Cursor if necessary

### Claude Desktop Integration
env FLUX_API_TOKEN=YOUR_TOKEN FLUX_API_URL=YOUR_API_URL npx -y flux-cloudflare-mcp

```json
{
  "mcpServers": {
    "flux-cloudflare-mcp": {
      "command": "npx",
      "args": ["-y", "flux-cloudflare-mcp"],
      "env": {
        "FLUX_API_TOKEN": "YOUR_TOKEN",
        "FLUX_API_URL": "YOUR_API_URL"
      }
    }
  }
}
```

## 💻 Local Development

1. Clone the repository:

```bash
git clone https://github.com/Hzzy2O/flux-cloudflare-mcp.git
cd flux-cloudflare-mcp
```

2. Install dependencies:

```bash
npm install
```

3. Build the project:

```bash
npm run build
```

## 🛠 Technical Stack

* Model Context Protocol SDK - Core MCP functionality
* Cloudflare Workers - Serverless API for image generation
* TypeScript - Type safety and modern JavaScript features
* Zod - Runtime type validation

## ⚙️ Configuration

The server requires the following environment variables:

- `FLUX_API_TOKEN`: Your API token for authentication with the Flux API
- `FLUX_API_URL`: The URL of your deployed Flux API (from snakeying/flux-api-worker or aigem/cf-flux-remix)

## 🔍 Troubleshooting

### Common Issues

#### Authentication Error
- Ensure your `FLUX_API_TOKEN` is correctly set in the environment
- Verify your token is valid by testing it with the Flux API directly

#### API Connection Issues
- Check that your Flux API (Cloudflare Worker) is running and accessible
- Ensure your network allows connections to Cloudflare Workers

#### Safety Filter Triggered
- The model has a built-in safety filter that may block certain prompts
- Try modifying your prompt to avoid potentially problematic content

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔗 Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Flux Model Documentation](https://developer.cloudflare.com/ai-gateway/models/flux-1/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [snakeying/flux-api-worker](https://github.com/snakeying/flux-api-worker) - Simple Flux API implementation
- [aigem/cf-flux-remix](https://github.com/aigem/cf-flux-remix) - Feature-rich Flux API with web UI
