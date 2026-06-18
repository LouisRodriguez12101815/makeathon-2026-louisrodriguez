export type FigmaColor = { r: number; g: number; b: number };
export type FigmaFill = { type?: string; color?: FigmaColor };

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  fills?: FigmaFill[];
  characters?: string;
  children?: FigmaNode[];
}

export interface FigmaTokens {
  brandColor: string;
  activePayments: string[];
  checkoutTitle: string;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function fetchFigmaCanvas(): Promise<unknown | null> {
  const token = process.env.FIGMA_ACCESS_TOKEN;
  const fileKey = process.env.FIGMA_FILE_KEY;

  if (!token || !fileKey || fileKey.includes("YOUR_FIGMA_FILE_KEY")) {
    console.warn("Figma credentials not fully configured in .env.local");
    return null;
  }

  // Add a strict 5-second timeout so the serverless function never hangs or gets stuck
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
      headers: {
        "X-Figma-Token": token,
      },
      signal: controller.signal,
      next: { revalidate: 0 }, // Live fetching
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Figma API returned status ${res.status}`);
    }

    const data: unknown = await res.json();
    return data;
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    console.error("Error fetching Figma file:", getErrorMessage(error));
    return null; // Graceful fallback
  }
}

// Parses Figma design nodes to extract style tokens (like colors, button names)
export function parseFigmaTokens(figmaData: unknown): FigmaTokens | null {
  if (!figmaData || typeof figmaData !== 'object') return null;
  if (!('document' in figmaData)) return null;

  const root = (figmaData as { document: FigmaNode }).document;

  const tokens: FigmaTokens = {
    brandColor: "#2563eb", // Fallback blue
    activePayments: ["Credit Card"],
    checkoutTitle: "FeeShield Audit Panel",
  };

  // Depth-first search to find custom branding frames or components on the canvas
  function dfs(node: FigmaNode) {
    if (!node) return;

    // Look for text layers starting with "Payment:" or "Color:"
    if (node.type === "TEXT" && node.characters) {
      const text = node.characters.trim();
      if (text.startsWith("Title:")) {
        tokens.checkoutTitle = text.replace("Title:", "").trim();
      }
      if (text.startsWith("Payment:")) {
        const method = text.replace("Payment:", "").trim();
        if (!tokens.activePayments.includes(method)) {
          tokens.activePayments.push(method);
        }
      }
    }

    // Look for color fills from a frame named "Branding" or "Primary"
    if (node.name && node.name.toLowerCase().includes("branding") && node.fills && node.fills.length > 0) {
      const solidFill = node.fills.find((f) => f.type === "SOLID");
      if (solidFill?.color) {
        const { r, g, b } = solidFill.color;
        // Convert Figma RGB decimal (0-1) to HEX
        const toHex = (c: number) => Math.round(c * 255).toString(16).padStart(2, "0");
        tokens.brandColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
      }
    }

    if (node.children) {
      node.children.forEach(dfs);
    }
  }

  dfs(root);
  return tokens;
}
