# LLM Optimization Features

Orchestrator includes comprehensive LLM performance optimization features that can reduce costs by 60-90% and improve latency by up to 85%.

## Features Overview

### 1. Prompt Caching

**Reduces costs by 60-90% and latency by 80-85%**

Automatically caches LLM responses with intelligent eviction strategies:

```typescript
import { PromptCache } from '@orchestrator/core'

const cache = new PromptCache({
  maxSize: 1000,
  ttl: 5 * 60 * 1000, // 5 minutes
  strategy: 'lru', // or 'lfu', 'fifo'
})

// Cache is automatically used by OptimizedProvider
```

**Key Benefits:**
- Cached tokens cost ~10% of regular tokens
- Dramatic latency reduction for repeated queries
- Smart eviction strategies (LRU, LFU, FIFO)
- Automatic TTL management

**Best Practices:**
- Place static content at the beginning of prompts
- Use consistent prompt structures
- Monitor cache hit rates

### 2. Token Tracking & Budget Management

Track token usage and enforce budgets:

```typescript
import { TokenTracker } from '@orchestrator/core'

const tracker = new TokenTracker({
  maxTokensPerRequest: 100000,
  maxTokensPerHour: 1000000,
  maxTokensPerDay: 10000000,
  maxCostPerDay: 100,
  alertThreshold: 80, // Alert at 80% usage
})

// Automatic tracking with OptimizedProvider
const usage = tracker.exportUsage()
console.log(usage.summary.day) // Daily usage stats
console.log(usage.recommendations) // Cost optimization tips
```

**Features:**
- Real-time token tracking
- Budget enforcement with alerts
- Per-model cost calculation
- Usage analytics and recommendations

### 3. Intelligent Model Routing

Automatically route requests to the optimal model:

```typescript
import { ModelRouter } from '@orchestrator/core'

const router = new ModelRouter()

const decision = router.route('Complex reasoning task', {
  priority: 'quality', // or 'cost', 'speed'
  complexity: 'high',
  specialty: 'reasoning',
})

console.log(decision)
// {
//   model: 'claude-sonnet-4-5',
//   reason: 'high quality, suitable for complex tasks',
//   estimatedCost: 0.009,
//   estimatedTime: 20
// }
```

**Routing Strategies:**
- **Cost Priority**: Use cheaper models (e.g., Claude Haiku, GPT-4o-mini) for simple tasks
- **Speed Priority**: Route to fastest models
- **Quality Priority**: Use best models for complex reasoning
- **Specialty Matching**: Match task type to model strengths

**Model Capabilities:**
```
claude-sonnet-4-5: Quality 10/10, Cost $9/1M, Specialties: reasoning, code
claude-3-5-haiku: Quality 7/10, Cost $3/1M, Specialties: speed, simple tasks
gpt-4o-mini:      Quality 6/10, Cost $0.38/1M, Specialties: cost, speed
gpt-4-turbo:      Quality 10/10, Cost $20/1M, Specialties: complex tasks
```

### 4. Smart Retry with Exponential Backoff

Handles transient failures automatically:

```typescript
import { RetryHandler } from '@orchestrator/core'

const retry = new RetryHandler({
  maxRetries: 3,
  initialDelay: 1000,
  backoffMultiplier: 2,
  onRetry: (attempt, error) => {
    console.log(`Retry ${attempt}: ${error.message}`)
  },
})

await retry.execute(async () => {
  return await provider.generateText(prompt)
})
```

**Features:**
- Exponential backoff with jitter
- Automatic retry for rate limits, timeouts, server errors
- Configurable retry conditions
- Callback hooks for monitoring

### 5. Rate Limiting

Prevent hitting API rate limits:

```typescript
import { RateLimiter } from '@orchestrator/core'

const limiter = new RateLimiter(
  10, // requests per second
  20  // burst size
)

await limiter.acquire() // Wait for token
// Make request
```

**Features:**
- Token bucket algorithm
- Configurable burst size
- Automatic refill
- No dropped requests

### 6. Context Optimization

Intelligent context window management:

```typescript
import { ContextOptimizer } from '@orchestrator/core'

const optimizer = new ContextOptimizer(100000) // max tokens

const segments = [
  { type: 'system', content: '...', priority: 10 },
  { type: 'static', content: '...', priority: 8 },
  { type: 'dynamic', content: '...', priority: 5 },
]

const window = optimizer.createWindow(segments)
// Optimized, prioritized, and structured for caching
```

**Features:**
- Priority-based inclusion
- Automatic compression for large contexts
- Structured for cache efficiency (static first)
- Token estimation

### 7. Performance Monitoring

Track and analyze performance:

```typescript
import { PerformanceMonitor } from '@orchestrator/core'

const monitor = new PerformanceMonitor()

await monitor.measure('generate', async () => {
  return await provider.generateText(prompt)
})

const stats = monitor.getStats()
// {
//   totalRequests: 100,
//   successRate: 98,
//   avgDuration: 1250,
//   p95Duration: 3500,
//   totalCost: 2.45,
//   cachedTokensRate: 45
// }
```

**Metrics:**
- Request duration (avg, p50, p95, p99)
- Success/failure rates
- Token usage and costs
- Cache efficiency
- Slow operation detection

## OptimizedProvider

Combine all optimizations with `OptimizedProvider`:

```typescript
import { AnthropicProvider, OptimizedProvider } from '@orchestrator/core'

const base = new AnthropicProvider(apiKey)

const optimized = new OptimizedProvider(base, {
  enableCache: true,
  enableRetry: true,
  enableRateLimiting: true,
  enableMonitoring: true,
  enableModelRouting: true,
  cacheOptions: {
    maxSize: 1000,
    ttl: 300000,
    strategy: 'lru',
  },
  tokenBudget: {
    maxCostPerDay: 100,
  },
})

// Use like any provider
const result = await optimized.generateText('Hello!')

// Get optimization stats
const stats = optimized.getStats()
console.log('Cache hit rate:', stats.cache.hitRate)
console.log('Recommendations:', optimized.getRecommendations())
```

## Memory Systems

Manage conversational context efficiently:

### Buffer Window Memory
```typescript
import { BufferWindowMemory } from '@orchestrator/core'

const memory = new BufferWindowMemory(10) // Keep last 10 messages

await memory.add({
  role: 'user',
  content: 'Hello',
  timestamp: new Date(),
})

const messages = await memory.get() // Get all messages
```

### Summary Memory
```typescript
import { SummaryMemory } from '@orchestrator/core'

const memory = new SummaryMemory(10, async (messages) => {
  // Summarize old messages
  return await provider.generateText('Summarize: ' + messages)
})

// Automatically summarizes when limit exceeded
```

### Token Memory
```typescript
import { TokenMemory } from '@orchestrator/core'

const memory = new TokenMemory(
  10000, // max tokens
  (text) => Math.ceil(text.length / 4) // estimator
)

// Automatically removes old messages to stay within budget
```

## LangChain Integration

Use LangChain models with Orchestrator:

```typescript
import { ChatAnthropic } from '@langchain/anthropic'
import { LangChainProviderFactory } from '@orchestrator/core'

const chatModel = new ChatAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-5',
})

const provider = LangChainProviderFactory.fromChatAnthropic(chatModel)

// Use with Orchestrator
const orchestrator = new Orchestrator(config, provider)
```

## RAG (Retrieval-Augmented Generation)

Add knowledge retrieval:

```typescript
import { RAGEngine, MemoryVectorStore } from '@orchestrator/core'

// Create vector store
const vectorStore = new MemoryVectorStore(async (text) => {
  // Generate embeddings (use your preferred service)
  return await getEmbedding(text)
})

// Create RAG engine
const rag = new RAGEngine(vectorStore, {
  topK: 5,
  minSimilarity: 0.5,
})

// Add documents
await rag.addDocuments([
  {
    id: 'doc1',
    content: 'Document content...',
    metadata: { source: 'manual.pdf' },
  },
])

// Query with RAG
const { answer, sources } = await rag.query(
  'What is the process?',
  async (prompt) => await provider.generateText(prompt)
)
```

## Configuration

Enable optimizations in your config:

```yaml
provider:
  name: anthropic
  apiKey: ${ANTHROPIC_API_KEY}
  model: claude-sonnet-4-5
  optimization:
    enableCache: true
    enableRetry: true
    enableMonitoring: true
    enableModelRouting: true
    cacheStrategy: lru
    tokenBudget:
      maxCostPerDay: 100
      alertThreshold: 80

agents:
  planner:
    model: claude-sonnet-4-5 # Complex reasoning
  executor:
    model: claude-3-5-haiku-20241022 # Fast implementation
  reviewer:
    model: claude-sonnet-4-5 # Thorough review
  debugger:
    model: gpt-4o # Alternative for variety
```

## Best Practices

### 1. Prompt Structure for Caching
```
[System Instructions] <- Static, cached
[Project Context]     <- Static, cached
[Task Description]    <- Static, cached
[Dynamic Input]       <- Changes per request
```

### 2. Cost Optimization
- Use model routing to select cheaper models for simple tasks
- Enable prompt caching for repeated context
- Set token budgets to prevent overuse
- Monitor recommendations regularly

### 3. Performance Optimization
- Enable rate limiting to prevent throttling
- Use retry logic for transient failures
- Monitor p95/p99 latencies
- Identify and optimize slow operations

### 4. Memory Management
- Use TokenMemory for strict token limits
- Use SummaryMemory for long conversations
- Use HybridMemory for best of both worlds

## Monitoring & Analytics

### View Current Stats
```typescript
const stats = optimized.getStats()

console.log('Cache Stats:', stats.cache)
// { size: 450, hits: 892, misses: 203, hitRate: 81.5% }

console.log('Token Usage:', stats.tokens.summary.day)
// { totalTokens: 2.3M, totalCost: $12.45, requests: 1240 }

console.log('Performance:', stats.performance.overall)
// { avgDuration: 1250ms, p95: 3200ms, successRate: 98.5% }
```

### Get Recommendations
```typescript
const recommendations = optimized.getRecommendations()
// [
//   'Low cache hit rate. Consider structuring prompts consistently.',
//   'Using expensive models. Consider model routing for simple tasks.',
//   'High output/input ratio. Use more specific prompts.'
// ]
```

### Export Data
```typescript
const data = monitor.export()
// {
//   metrics: [...],
//   summary: {...},
//   slowOps: [...],
//   failures: [...]
// }

// Export for analysis
fs.writeFileSync('metrics.json', JSON.stringify(data))
```

## Real-World Example

Complete setup with all optimizations:

```typescript
import {
  AnthropicProvider,
  OptimizedProvider,
  Orchestrator,
  ConfigLoader,
} from '@orchestrator/core'

// Load config
const config = ConfigLoader.getInstance().load('./config.yml')

// Create optimized provider
const base = new AnthropicProvider(
  config.provider.apiKey,
  config.provider.model
)

const provider = new OptimizedProvider(base, {
  enableCache: true,
  enableRetry: true,
  enableRateLimiting: true,
  enableMonitoring: true,
  enableModelRouting: true,
  tokenBudget: {
    maxCostPerDay: 50,
    alertThreshold: 80,
  },
})

// Create orchestrator
const orchestrator = new Orchestrator(config)

// Run task
await orchestrator.start(
  'Build a REST API',
  'my-api'
)

// Review performance
const stats = provider.getStats()
console.log('✅ Task complete!')
console.log(`💰 Cost: $${stats.tokens.summary.day.totalCost.toFixed(2)}`)
console.log(`⚡ Cache hit rate: ${stats.cache.hitRate.toFixed(1)}%`)
console.log(`📊 Avg latency: ${stats.performance.overall.avgDuration}ms`)

// Get recommendations
const tips = provider.getRecommendations()
if (tips.length > 0) {
  console.log('\n💡 Optimization tips:')
  tips.forEach((tip) => console.log(`  - ${tip}`))
}
```

## Migration Guide

### Existing Code
```typescript
const provider = new AnthropicProvider(apiKey)
const result = await provider.generateText(prompt)
```

### With Optimizations
```typescript
const base = new AnthropicProvider(apiKey)
const provider = new OptimizedProvider(base) // Just wrap it!
const result = await provider.generateText(prompt) // Same API
```

That's it! All optimizations are automatic and transparent.
