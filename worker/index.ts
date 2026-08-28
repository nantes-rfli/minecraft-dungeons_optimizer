import {
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
  handleImageOptimization,
} from 'vinext/server/image-optimization'
import handler from 'vinext/server/app-router-entry'

interface SitesEnvironment {
  readonly ASSETS: Fetcher
  readonly IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>
      }
    }
  }
}

interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
}

const worker = {
  async fetch(request: Request, environment: SitesEnvironment, context: WorkerContext) {
    const url = new URL(request.url)
    if (url.pathname === '/_vinext/image') {
      return handleImageOptimization(
        request,
        {
          fetchAsset: (path) => environment.ASSETS.fetch(new Request(new URL(path, request.url))),
          transformImage: async (body, { width, format, quality }) => {
            const result = await environment.IMAGES.input(body)
              .transform(width > 0 ? { width } : {})
              .output({ format, quality })
            return result.response()
          },
        },
        [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES],
      )
    }
    return handler.fetch(request, environment, context)
  },
}

export default worker
