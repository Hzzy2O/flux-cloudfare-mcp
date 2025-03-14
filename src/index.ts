#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import fetch from "node-fetch";
import { Buffer } from 'buffer';
import * as process from 'process';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const CONFIG = {
  serverName: "flux-cloudflare-mcp",
  serverVersion: "0.0.1",
  pollingAttempts: 5,
  pollingInterval: 2000, // ms
  output: {
    baseFolder: "./output",
    allowedExtensions: [".png", ".jpg", ".jpeg"],
    defaultExtension: ".png"
  },
  image: {
    defaultWidth: 512,
    defaultHeight: 512,
    maxWidth: 1024,
    maxHeight: 1024
  }
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
  file_name: z.string().min(1).optional().describe("Name of the file to save the image"),
  save_folder: z.string().default(CONFIG.output.baseFolder).optional().describe("Folder path to save the image"),
  width: z.number().int().positive().max(CONFIG.image.maxWidth).optional().describe("Width of the generated image"),
  height: z.number().int().positive().max(CONFIG.image.maxHeight).optional().describe("Height of the generated image"),
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
      "1:2",
      "3:2",
      "3:4",
      "16:9",
      "9:16"
    ])
    .default("1:1")
    .describe("Aspect ratio for the generated image"),
};

// Helper functions
function handleError(error: unknown): never {
  if (error instanceof Error) {
    throw new McpError(ErrorCode.InternalError, error.message);
  }
  throw new McpError(ErrorCode.InternalError, String(error));
}

// Validate and create save path
function validateSavePath(folderPath: string): { isValid: boolean; errorMsg: string; savePath: string } {
  try {
    // Create absolute path
    const absolutePath = path.resolve(folderPath);
    
    // Check if directory exists, create if it doesn't
    if (!fs.existsSync(absolutePath)) {
      fs.mkdirSync(absolutePath, { recursive: true });
    }
    
    // Check if we have write permissions
    try {
      fs.accessSync(absolutePath, fs.constants.W_OK);
    } catch (error) {
      return { 
        isValid: false, 
        errorMsg: `No write permission for directory: ${absolutePath}`, 
        savePath: absolutePath 
      };
    }
    
    return { isValid: true, errorMsg: "", savePath: absolutePath };
  } catch (error) {
    return { 
      isValid: false, 
      errorMsg: `Invalid save path: ${error instanceof Error ? error.message : String(error)}`, 
      savePath: "" 
    };
  }
}

// Register tools
server.tool(
  "generate_image",
  "Generate an image from a text prompt using Flux model",
  imageGenerationSchema,
  async (input) => {
    try {
      console.log(`Received generation request: ${input.prompt}`);
      
      // Parameter validation
      if (!input.prompt) {
        throw new Error("Prompt cannot be empty");
      }
      
      // Set default dimensions if not provided
      const width = input.width || CONFIG.image.defaultWidth;
      const height = input.height || CONFIG.image.defaultHeight;
      
      // Validate dimensions
      if (width <= 0 || height <= 0 || width > CONFIG.image.maxWidth || height > CONFIG.image.maxHeight) {
        throw new Error(
          `Width and height must be greater than 0 and not exceed ${CONFIG.image.maxWidth}. ` +
          `Current values: width=${width}, height=${height}`
        );
      }
      
      const token = getFluxApiToken();
      const apiUrl = getFluxApiUrl();
      
      // Format prompt with aspect ratio included in the prompt string
      const formattedPrompt = `${input.aspect_ratio} ${input.prompt}`;
      
      // Construct message for chat completions
      const messages = [
        {
          role: "user",
          content: formattedPrompt,
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
          ...(input.num_inference_steps !== undefined && { num_steps: input.num_inference_steps }),
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`API request failed: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      
      // Extract image URL directly from the response
      const imageUrl = data.url;
      
      if (!imageUrl) {
        throw new Error("Could not extract image URL from response");
      }

      // If file_name is not provided, just return the URL
      if (!input.file_name) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                error: null,
                url: imageUrl,
                images: []
              }, null, 2),
            },
          ],
        };
      }

      // Fetch the actual image to get it as base64
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString('base64');
      const imageData = Buffer.from(imageBuffer);
      
      // Validate save path
      const { isValid, errorMsg, savePath } = validateSavePath(input.save_folder || CONFIG.output.baseFolder);
      if (!isValid) {
        throw new Error(errorMsg);
      }
      
      // Ensure file name has correct extension
      let fileName = input.file_name;
      const fileExt = path.extname(fileName).toLowerCase();
      if (!fileExt || !CONFIG.output.allowedExtensions.includes(fileExt)) {
        fileName = `${path.basename(fileName, path.extname(fileName))}${CONFIG.output.defaultExtension}`;
      }
      
      // Save the image to file
      const savedImages = [];
      try {
        const filePath = path.join(savePath, fileName);
        fs.writeFileSync(filePath, imageData);
        savedImages.push(filePath);
        console.log(`Image saved: ${filePath}`);
      } catch (error) {
        if (error instanceof Error && error.message.includes('permission')) {
          console.error(`No permission to save image to: ${savePath}`);
        } else {
          console.error(`Failed to save image: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      if (savedImages.length === 0) {
        throw new Error(
          "All image saves failed. Please ensure:\n" +
          "1. Using absolute path (e.g., /Users/username/Documents/images)\n" +
          "2. Directory has write permissions\n" +
          "3. Sufficient disk space"
        );
      }
      
      // Determine MIME type (assuming PNG for now, could be improved with content type detection)
      const mimeType = "image/png";

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              error: null,
              url: imageUrl,
              images: savedImages
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error(`Failed to generate image: ${error instanceof Error ? error.message : String(error)}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
              images: []
            }, null, 2),
          },
        ],
      };
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
