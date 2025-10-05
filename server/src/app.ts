import express from "express";
import bodyParser from "body-parser";
import db from "./db";
import { pipeline } from "@xenova/transformers";

const app = express();
const PORT = 4000;

// Constants
const EXPECTED_DIM = 384; // all-MiniLM-L6-v2 dimension
const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";
const MAX_FALLBACK_ROWS = 10000; // Prevent OOM in fallback mode
const DISTANCE_RANGE = { min: 0, max: 2 }; // Cosine distance range

app.use(bodyParser.json());

// Cache embedder instance with proper typing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embedderPromise: Promise<any> | null = null;

async function getEmbedder() {
  if (!embedderPromise) {
    embedderPromise = pipeline("feature-extraction", MODEL_NAME);
  }
  return await embedderPromise;
}

// Initialize database with optimal settings
function initializeDatabase() {
  try {
    // Enable WAL mode for better concurrency
    db.exec("PRAGMA journal_mode = WAL");
    // Optimize for performance with good durability
    db.exec("PRAGMA synchronous = NORMAL");
    // Check database integrity on startup
    const integrityCheck = db.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
    if (integrityCheck.integrity_check !== "ok") {
      console.warn("Database integrity check warning:", integrityCheck);
    }

    // Store model metadata
    db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);

    const modelCheck = db.prepare("SELECT value FROM metadata WHERE key = 'model'").get() as { value: string } | undefined;
    if (modelCheck && modelCheck.value !== MODEL_NAME) {
      console.warn(`Model mismatch: DB has ${modelCheck.value}, using ${MODEL_NAME}`);
    } else if (!modelCheck) {
      db.prepare("INSERT INTO metadata (key, value) VALUES ('model', ?)").run(MODEL_NAME);
    }

    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Database initialization error:", error);
    throw error;
  }
}

// Enhanced embedding function with dimension validation
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

    if (dim !== EXPECTED_DIM) {
      throw new Error(`Unexpected embedding dimension: expected ${EXPECTED_DIM}, got ${dim}`);
    }

    // Extract first embedding from batch (always at offset 0)
    const embedding = output.data.slice(0, dim);

    // Validate embedding data
    if (embedding.length !== dim) {
      throw new Error(`Embedding dimension mismatch: expected ${dim}, got ${embedding.length}`);
    }

    return new Float32Array(embedding);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Embedding generation failed:", error);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

// Function-specific vector extension detection
async function getDistanceFunction(): Promise<string | null> {
  const tests = [
    { func: 'vec_distance_cosine', versionQuery: 'SELECT vec_version()', name: 'vec0' },
    { func: 'vector_distance_cosine', versionQuery: 'SELECT vector_version()', name: 'sqlite-vss' },
    { func: 'vss_distance_cosine', versionQuery: 'SELECT vss_version()', name: 'vss' }
  ];

  for (const test of tests) {
    try {
      db.exec(test.versionQuery);
      console.log(`Vector extension detected: ${test.name}`);
      // Verify the function exists by attempting a minimal query
      try {
        db.prepare(`SELECT ${test.func}(?, ?) AS test`).get(
          Buffer.from(new Float32Array(EXPECTED_DIM).buffer),
          Buffer.from(new Float32Array(EXPECTED_DIM).buffer)
        );
        return test.func;
      } catch {
        console.warn(`Extension ${test.name} found but function ${test.func} not available`);
      }
    } catch {
      // Continue to next test
    }
  }
  return null;
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

// Batch insert endpoint
app.post("/insert-batch", async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: "Invalid input",
        details: "'items' must be a non-empty array"
      });
    }

    if (items.length > 100) {
      return res.status(400).json({
        error: "Batch too large",
        details: "Maximum 100 items per batch"
      });
    }

    // Validate all items first
    for (const item of items) {
      if (!item.id || !item.text) {
        return res.status(400).json({
          error: "Invalid item",
          details: "Each item must have 'id' and 'text' fields"
        });
      }
    }

    // Generate all embeddings
    const embeddings = await Promise.all(
      items.map(item => embedText(item.text))
    );

    // Insert all in a single transaction
    const results = withTransaction(() => {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO embeddings (id, content, embedding)
        VALUES (?, ?, ?)
      `);

      return items.map((item, index) =>
        stmt.run(item.id, item.text, Buffer.from(embeddings[index].buffer))
      );
    });

    res.json({
      success: true,
      inserted: results.length,
      changes: results.reduce((sum, r) => sum + r.changes, 0)
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error("Batch insert error:", err);
    res.status(500).json({
      error: "Batch insert operation failed",
      details: err.message
    });
  }
});

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    // Validate threshold range
    if (threshold < DISTANCE_RANGE.min || threshold > DISTANCE_RANGE.max) {
      return res.status(400).json({
        error: "Invalid threshold value",
        details: `Threshold must be between ${DISTANCE_RANGE.min} and ${DISTANCE_RANGE.max}`
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

      if (embeddingArray.length !== EXPECTED_DIM) {
        return res.status(400).json({
          error: "Invalid embedding dimension",
          details: `Query embedding must have exactly ${EXPECTED_DIM} dimensions`
        });
      }

      embeddingToUse = new Float32Array(embeddingArray);
    } else {
      embeddingToUse = await embedText(queryText as string);
    }

    const distanceFunc = await getDistanceFunction();
    let rows: { id: string; content: string; distance: number }[];

    if (distanceFunc) {
      console.log(`Using vector extension with function: ${distanceFunc}`);

      // Optimized query using subquery to compute distance only once
      const stmt = db.prepare(`
        SELECT id, content, distance
        FROM (
          SELECT id, content, ${distanceFunc}(embedding, ?) AS distance
          FROM embeddings
        )
        WHERE distance <= ?
        ORDER BY distance ASC
        LIMIT ?
      `);

      const embeddingBuffer = Buffer.from(embeddingToUse.buffer);
      rows = stmt.all(embeddingBuffer, threshold, topK) as
        { id: string; content: string; distance: number }[];

    } else {
      console.log("Using fallback similarity calculation");

      // Check row count first to prevent OOM
      const countResult = db.prepare("SELECT COUNT(*) as count FROM embeddings").get() as { count: number };

      if (countResult.count > MAX_FALLBACK_ROWS) {
        return res.status(400).json({
          error: "Database too large for fallback mode",
          details: `Fallback mode supports up to ${MAX_FALLBACK_ROWS} rows. Please install a vector extension.`
        });
      }

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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (error: any) {
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
        queryMethod: distanceFunc || 'fallback',
        resultCount: rows.length,
        topK,
        threshold,
        distanceRange: `${DISTANCE_RANGE.min} (identical) to ${DISTANCE_RANGE.max} (opposite)`,
        embeddingModel: MODEL_NAME,
        embeddingDimension: EXPECTED_DIM
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error("Search error:", err);
    res.status(500).json({
      error: "Search operation failed",
      details: err.message
    });
  }
});

// Database statistics endpoint
app.get("/stats", (_req, res) => {
  try {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_embeddings,
        AVG(LENGTH(embedding)) as avg_embedding_size,
        SUM(LENGTH(embedding)) as total_storage_bytes
      FROM embeddings
    `).get() as { total_embeddings: number; avg_embedding_size: number; total_storage_bytes: number };

    const dbSize = db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get() as { size: number };

    res.json({
      embeddings: {
        count: stats.total_embeddings,
        avgSize: Math.round(stats.avg_embedding_size),
        totalSize: stats.total_storage_bytes,
        dimension: EXPECTED_DIM
      },
      database: {
        totalSize: dbSize.size,
        model: MODEL_NAME
      },
      limits: {
        maxFallbackRows: MAX_FALLBACK_ROWS,
        maxTopK: 100,
        distanceRange: DISTANCE_RANGE
      }
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to retrieve statistics",
      details: error.message
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

    const distanceFunc = await getDistanceFunction();

    res.json({
      status: "healthy",
      database: "connected",
      embedder: "available",
      vectorFunction: distanceFunc || "fallback_mode",
      model: MODEL_NAME,
      timestamp: new Date().toISOString()
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    res.status(503).json({
      status: "unhealthy",
      error: error.message
    });
  }
});

app.get("/", (_req, res) => {
  res.status(200).json({
    message: "Vector Database API",
    version: "2.0.0",
    endpoints: {
      insert: "POST /insert",
      insertBatch: "POST /insert-batch",
      search: "POST /search",
      stats: "GET /stats",
      health: "GET /health"
    },
    configuration: {
      model: MODEL_NAME,
      dimension: EXPECTED_DIM,
      distanceMetric: "cosine",
      distanceRange: DISTANCE_RANGE
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Closing database connection...');
  try {
    db.close();
    console.log('Database connection closed.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error closing database:', error);
  }
  process.exit(0);
});

// Initialize database on startup
initializeDatabase();

app.listen(PORT, () => {
  console.log(`🚀 Vector DB server v2.0 running on http://localhost:${PORT}`);
  console.log(`📊 Model: ${MODEL_NAME} (${EXPECTED_DIM}D)`);
});