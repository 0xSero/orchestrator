/**
 * RAG (Retrieval-Augmented Generation) engine
 */

export interface Document {
  id: string
  content: string
  metadata: Record<string, unknown>
  embedding?: number[]
}

export interface VectorStore {
  addDocuments(documents: Document[]): Promise<void>
  similaritySearch(query: string, k?: number): Promise<Document[]>
  delete(ids: string[]): Promise<void>
}

export interface RAGOptions {
  topK: number // Number of documents to retrieve
  minSimilarity?: number // Minimum similarity score
  rerank?: boolean // Re-rank results
}

/**
 * Simple in-memory vector store
 */
export class MemoryVectorStore implements VectorStore {
  private documents: Map<string, Document> = new Map()
  private embedder: (text: string) => Promise<number[]>

  constructor(embedder: (text: string) => Promise<number[]>) {
    this.embedder = embedder
  }

  async addDocuments(documents: Document[]): Promise<void> {
    for (const doc of documents) {
      if (!doc.embedding) {
        doc.embedding = await this.embedder(doc.content)
      }
      this.documents.set(doc.id, doc)
    }
  }

  async similaritySearch(query: string, k: number = 5): Promise<Document[]> {
    const queryEmbedding = await this.embedder(query)

    // Calculate cosine similarity for all documents
    const similarities: Array<{ doc: Document; score: number }> = []

    for (const doc of this.documents.values()) {
      if (!doc.embedding) continue

      const similarity = this.cosineSimilarity(
        queryEmbedding,
        doc.embedding
      )
      similarities.push({ doc, score: similarity })
    }

    // Sort by similarity and return top k
    similarities.sort((a, b) => b.score - a.score)
    return similarities.slice(0, k).map((s) => s.doc)
  }

  async delete(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.documents.delete(id)
    }
  }

  /**
   * Calculate cosine similarity
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }
}

/**
 * RAG engine for retrieval-augmented generation
 */
export class RAGEngine {
  private vectorStore: VectorStore
  private options: RAGOptions

  constructor(vectorStore: VectorStore, options: Partial<RAGOptions> = {}) {
    this.vectorStore = vectorStore
    this.options = {
      topK: options.topK || 5,
      minSimilarity: options.minSimilarity || 0.5,
      rerank: options.rerank !== false,
    }
  }

  /**
   * Add documents to knowledge base
   */
  async addDocuments(documents: Document[]): Promise<void> {
    await this.vectorStore.addDocuments(documents)
  }

  /**
   * Retrieve relevant documents for a query
   */
  async retrieve(query: string): Promise<Document[]> {
    const results = await this.vectorStore.similaritySearch(
      query,
      this.options.topK
    )

    // Filter by minimum similarity if needed
    if (this.options.minSimilarity !== undefined) {
      // This would require similarity scores from vector store
      // For now, just return results
      return results
    }

    return results
  }

  /**
   * Generate augmented prompt with retrieved context
   */
  async augmentPrompt(query: string, template?: string): Promise<string> {
    const documents = await this.retrieve(query)

    if (documents.length === 0) {
      return query
    }

    // Build context from retrieved documents
    const context = documents
      .map(
        (doc, i) => `[Document ${i + 1}]\n${doc.content}\n`
      )
      .join('\n')

    // Use template or default format
    const promptTemplate =
      template ||
      `Context:\n${context}\n\nQuery: ${query}\n\nAnswer based on the context above:`

    return promptTemplate.replace('{context}', context).replace('{query}', query)
  }

  /**
   * Query with RAG
   */
  async query(
    query: string,
    generator: (prompt: string) => Promise<string>,
    template?: string
  ): Promise<{
    answer: string
    sources: Document[]
  }> {
    const sources = await this.retrieve(query)
    const augmentedPrompt = await this.augmentPrompt(query, template)
    const answer = await generator(augmentedPrompt)

    return {
      answer,
      sources,
    }
  }

  /**
   * Chunk large documents
   */
  static chunkDocument(
    content: string,
    chunkSize: number = 500,
    overlap: number = 50
  ): string[] {
    const chunks: string[] = []
    let start = 0

    while (start < content.length) {
      const end = Math.min(start + chunkSize, content.length)
      chunks.push(content.substring(start, end))
      start = end - overlap
    }

    return chunks
  }
}
