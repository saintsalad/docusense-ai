import express from "express";
import bodyParser from "body-parser";
import db from "./db";
import { pipeline } from "@xenova/transformers";

const app = express();
const PORT = 4000;

app.use(bodyParser.json());

// Cache embedder instance with proper typing
let embedderPromise: Promise<any> | null = null;

async function getEmbedder() {
  if (!embedderPromise) {
    embedderPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return await embedderPromise;
}

// Enhanced embedding function with better error handling
async function embedText(text: string): Promise<Float32Array> {
  if (!text || typeof text !== 'string') {
    throw new Error("Text input must be a non-empty string");
  }

  try {
    const embedder = await getEmbedder();
    const output = await embedder(text, { pooling: "mean", normalize: true });

    // Validate output structure
    if (!output?.data || !output?.dims || !Array.isArray(output.dims)) {
      throw new Error("Invalid embedding output: missing or malformed data/dims");
    }

    const [batchSize, dim] = output.dims;

    // Validate dimensions
    if (batchSize <= 0 || dim <= 0) {
      throw new Error(`Invalid dimensions: batchSize=${batchSize}, dim=${dim}`);
    }

    // Extract first embedding from batch (always at offset 0)
    const embedding = output.data.slice(0, dim);

    // Validate embedding data
    if (embedding.length !== dim) {
      throw new Error(`Embedding dimension mismatch: expected ${dim}, got ${embedding.length}`);
    }

    return new Float32Array(embedding);
  } catch (error) {
    console.error("Embedding generation failed:", error);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

// Improved vector extension detection
async function checkVectorExtension(): Promise<boolean> {
  try {
    // Try multiple detection methods for different vector extensions
    const testQueries = [
      "SELECT vec_version()",           // vec0
      "SELECT vector_version()",        // sqlite-vss
      "SELECT vss_version()"           // alternative
    ];

    for (const query of testQueries) {
      try {
        db.exec(query);
        return true;
      } catch {
        // Continue to next query
      }
    }
    return false;
  } catch {
    return false;
  }
}

// Enhanced similarity calculation fallback
function calculateCosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error("Vector dimensions must match for similarity calculation");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  // Return distance (1 - similarity) for consistency with vector extensions
  return 1 - (dotProduct / magnitude);
}

// Database transaction wrapper
function withTransaction<T>(callback: () => T): T {
  const transaction = db.transaction(() => callback());
  return transaction();
}

app.post("/insert", async (req, res) => {
  try {
    const { id, text } = req.body;

    // Enhanced input validation
    if (!id || !text) {
      return res.status(400).json({
        error: "Missing required fields",
        details: "Both 'id' and 'text' are required"
      });
    }

    if (typeof id !== 'string' || typeof text !== 'string') {
      return res.status(400).json({
        error: "Invalid input types",
        details: "Both 'id' and 'text' must be strings"
      });
    }

    if (text.trim().length === 0) {
      return res.status(400).json({
        error: "Empty text",
        details: "Text content cannot be empty"
      });
    }

    const embedding = await embedText(text);

    // Use transaction for data consistency
    const result = withTransaction(() => {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO embeddings (id, content, embedding)
        VALUES (?, ?, ?)
      `);
      return stmt.run(id, text, Buffer.from(embedding.buffer));
    });

    res.json({
      success: true,
      id,
      embeddingDimension: embedding.length,
      changes: result.changes
    });

  } catch (err: any) {
    console.error("Insert error:", err);
    res.status(500).json({
      error: "Insert operation failed",
      details: err.message
    });
  }
});

app.post("/search", async (req, res) => {
  try {
    const { queryText, queryEmbedding, topK = 5, threshold = 1.0 } = req.body;

    // Input validation
    if (!queryText && !queryEmbedding) {
      return res.status(400).json({
        error: "Missing query input",
        details: "Either 'queryText' or 'queryEmbedding' must be provided"
      });
    }

    if (topK <= 0 || topK > 100) {
      return res.status(400).json({
        error: "Invalid topK value",
        details: "topK must be between 1 and 100"
      });
    }

    let embeddingToUse: Float32Array;

    if (queryEmbedding) {
      // Validate embedding input
      if (!Array.isArray(queryEmbedding) && !(queryEmbedding instanceof Float32Array)) {
        return res.status(400).json({
          error: "Invalid queryEmbedding format",
          details: "queryEmbedding must be an array of numbers"
        });
      }

      // Validate embedding values
      const embeddingArray = Array.from(queryEmbedding as number[]);
      if (embeddingArray.some(val => typeof val !== 'number' || isNaN(val))) {
        return res.status(400).json({
          error: "Invalid embedding values",
          details: "All embedding values must be valid numbers"
        });
      }

      embeddingToUse = new Float32Array(embeddingArray);
    } else {
      embeddingToUse = await embedText(queryText as string);
    }

    const vec0Available = await checkVectorExtension();
    let rows: { id: string; content: string; distance: number }[];

    if (vec0Available) {
      console.log("Using vector extension for similarity search");

      const stmt = db.prepare(`
        SELECT id, content, vec_distance_cosine(embedding, ?) AS distance
        FROM embeddings
        WHERE vec_distance_cosine(embedding, ?) <= ?
        ORDER BY distance ASC
        LIMIT ?
      `);

      const embeddingBuffer = Buffer.from(embeddingToUse.buffer);
      rows = stmt.all(embeddingBuffer, embeddingBuffer, threshold, topK) as
        { id: string; content: string; distance: number }[];

    } else {
      console.log("Using fallback similarity calculation");

      // Fallback: calculate similarity manually
      const allEmbeddings = db.prepare(`
        SELECT id, content, embedding FROM embeddings
      `).all() as { id: string; content: string; embedding: Buffer }[];

      const similarities = allEmbeddings
        .map(row => {
          try {
            const storedEmbedding = new Float32Array(row.embedding.buffer);
            const distance = calculateCosineSimilarity(embeddingToUse, storedEmbedding);
            return { id: row.id, content: row.content, distance };
          } catch (error) {
            console.warn(`Skipping invalid embedding for id ${row.id}:`, error.message);
            return null;
          }
        })
        .filter((item): item is { id: string; content: string; distance: number } =>
          item !== null && item.distance <= threshold
        )
        .sort((a, b) => a.distance - b.distance)
        .slice(0, topK);

      rows = similarities;
    }

    res.json({
      results: rows,
      metadata: {
        queryMethod: vec0Available ? 'vector_extension' : 'fallback',
        resultCount: rows.length,
        topK,
        threshold
      }
    });

  } catch (err: any) {
    console.error("Search error:", err);
    res.status(500).json({
      error: "Search operation failed",
      details: err.message
    });
  }
});

// Health check endpoint
app.get("/health", async (_req, res) => {
  try {
    // Check database connection
    db.exec("SELECT 1");

    // Check embedder availability
    await getEmbedder();

    const vec0Available = await checkVectorExtension();

    res.json({
      status: "healthy",
      database: "connected",
      embedder: "available",
      vectorExtension: vec0Available ? "available" : "fallback_mode",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      error: error.message
    });
  }
});

app.get("/", (_req, res) => {
  res.status(200).json({
    message: "Vector Database API",
    version: "1.0.0",
    endpoints: {
      insert: "POST /insert",
      search: "POST /search",
      health: "GET /health"
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Closing database connection...');
  try {
    db.close();
    console.log('Database connection closed.');
  } catch (error) {
    console.error('Error closing database:', error);
  }
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Vector DB server running on http://localhost:${PORT}`);
});