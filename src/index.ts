#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import fetch from "node-fetch";
import { Buffer } from 'buffer';
import * as process from 'process';

// Configuration
const CONFIG = {
  serverName: "flux-cloudflare-mcp",
  serverVersion: "0.0.1",
  pollingAttempts: 5,
  pollingInterval: 2000, // ms
};

// Initialize MCP server
const server = new McpServer({
  name: CONFIG.serverName,
  version: CONFIG.serverVersion,
});

// Environment validation
function getFluxApiToken(): string {
  const token = process.env.FLUX_API_TOKEN;
  if (!token) {
    console.error(
      "Error: FLUX_API_TOKEN environment variable is required"
    );
    process.exit(1);
  }
  return token;
}

function getFluxApiUrl(): string {
  const url = process.env.FLUX_API_URL;
  if (!url) {
    console.error(
      "Error: FLUX_API_URL environment variable is required"
    );
    process.exit(1);
  }
  return url;
}

// Schema definitions
const imageGenerationSchema = {
  prompt: z.string().min(1).describe("Prompt for generated image"),
  seed: z
    .number()
    .int()
    .optional()
    .describe("Random seed. Set for reproducible generation"),
  num_inference_steps: z
    .number()
    .int()
    .min(1)
    .max(4)
    .default(4)
    .describe(
      "Number of denoising steps. 4 is recommended, and lower number of steps produce lower quality outputs, faster."
    ),
  aspect_ratio: z
    .enum([
      "1:1",
      "16:9",
      "21:9",
      "3:2",
      "2:3",
      "4:5",
      "5:4",
      "3:4",
      "4:3",
      "9:16",
      "9:21",
    ])
    .default("1:1")
    .describe("Aspect ratio for the generated image"),
  disable_safety_checker: z
    .boolean()
    .default(false)
    .describe("Disable safety checker for generated images."),
};

// Helper functions
function handleError(error: unknown): never {
  if (error instanceof Error) {
    throw new McpError(ErrorCode.InternalError, error.message);
  }
  throw new McpError(ErrorCode.InternalError, String(error));
}

// Register tools
server.tool(
  "generate_image",
  "Generate an image from a text prompt using Flux model",
  imageGenerationSchema,
  async (input) => {
    try {
      const token = getFluxApiToken();
      const apiUrl = getFluxApiUrl();
      
      // Construct message for chat completions
      const messages = [
        {
          role: "user",
          content: input.prompt,
        },
      ];

      // Prepare request to Cloudflare Worker
      const response = await fetch(`${apiUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages,
          // Pass seed if provided
          ...(input.seed !== undefined && { seed: input.seed }),
          // Map inference steps to num_steps
          ...(input.num_inference_steps !== undefined && { num_steps: input.num_inference_steps }),
          aspect_ratio: input.aspect_ratio || "1:1",
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`API request failed: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      
      // Extract image URL from response
      let imageUrl = "";
      if (data.url) {
        imageUrl = data.url;
      } else if (data.choices && data.choices[0]?.message?.content) {
        // Try to extract URL from message content (contains markdown image)
        const content = data.choices[0].message.content;
        const urlMatch = content.match(/!\[.*?\]\((.*?)\)/);
        if (urlMatch && urlMatch[1]) {
          imageUrl = urlMatch[1];
        }
      }

      if (!imageUrl) {
        throw new Error("Could not extract image URL from response");
      }

      // Fetch the actual image to get it as base64
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString('base64');
      
      // Determine MIME type (assuming PNG for now, could be improved with content type detection)
      const mimeType = "image/png";

      return {
        content: [
          {
            type: "text",
            text: `Generated image with prompt: ${input.prompt}`,
          },
          {
            type: "image",
            data: base64Image,
            mimeType: mimeType,
          },
        ],
      };
    } catch (error) {
      handleError(error);
    }
  }
);

// Define a type for the chat completion input
type ChatCompletionInput = {
  prompt: string;
};

server.tool(
  "get_chat_completion",
  "Get text completion using Flux API",
  {
    prompt: z.string().min(1).describe("Prompt for text completion"),
  },
  async (input) => {
    try {
      const token = getFluxApiToken();
      const apiUrl = getFluxApiUrl();
      
      // Construct message for chat completions
      const messages = [
        {
          role: "user",
          content: input.prompt,
        },
      ];

      // Prepare request to Cloudflare Worker
      const response = await fetch(`${apiUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`API request failed: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      
      // Extract content from response
      let content = "";
      if (data.choices && data.choices[0]?.message?.content) {
        content = data.choices[0].message.content;
      } else {
        content = JSON.stringify(data);
      }

      return {
        content: [
          {
            type: "text",
            text: content,
          },
        ],
      };
    } catch (error) {
      handleError(error);
    }
  }
);

// Server initialization
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(
      `${CONFIG.serverName} v${CONFIG.serverVersion} running on stdio`
    );
  } catch (error) {
    console.error(
      "Server initialization error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(
    "Unhandled server error:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
