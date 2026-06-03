// Lazy singleton — model (~23 MB) is downloaded once and cached per process.
// Uses Xenova/all-MiniLM-L6-v2 (384-dim, quantized) via @xenova/transformers.

type FeatureExtractionPipeline = (
  text: string,
  options?: { pooling?: string; normalize?: boolean }
) => Promise<{ data: Float32Array }>

let _pipeline: FeatureExtractionPipeline | null = null

async function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (_pipeline) return _pipeline

  // Dynamic import keeps this module tree-shakeable from browser bundles
  const { pipeline, env } = await import('@xenova/transformers')

  // In serverless / container environments keep the model cache inside /tmp
  if (process.env.TRANSFORMERS_CACHE) {
    env.cacheDir = process.env.TRANSFORMERS_CACHE
  }

  _pipeline = (await pipeline(
    'feature-extraction',
    'Xenova/all-MiniLM-L6-v2',
    { quantized: true },
  )) as unknown as FeatureExtractionPipeline

  return _pipeline!
}

export async function embed(text: string): Promise<number[]> {
  const pipe = await getPipeline()
  const output = await pipe(text, { pooling: 'mean', normalize: true })
  return Array.from(output.data)
}

// Sequential batch — simpler than managing Tensor indexing across versions
export async function embedBatch(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map(embed))
}
