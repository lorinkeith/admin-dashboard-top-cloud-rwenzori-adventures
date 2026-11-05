import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import react from '@vitejs/plugin-react'

async function readRequestBody(request: IncomingMessage) {
  const chunks: Buffer[] = []

  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }

  return Buffer.concat(chunks)
}

async function sendWebResponse(response: ServerResponse, webResponse: Response) {
  response.statusCode = webResponse.status
  webResponse.headers.forEach((value, name) => {
    response.setHeader(name, value)
  })
  response.end(Buffer.from(await webResponse.arrayBuffer()))
}

function localReviewImporterPlugin(): Plugin {
  return {
    name: 'top-cloud-rwenzori-adventures-local-review-importer',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/fetch-tripadvisor-reviews', async (request: IncomingMessage, response: ServerResponse) => {
        const { onRequest, onRequestOptions, onRequestPost } = await import(
          new URL('./functions/api/fetch-tripadvisor-reviews.js', import.meta.url).href
        )
        const method = request.method || 'GET'
        const body = method === 'GET' || method === 'HEAD' ? undefined : await readRequestBody(request)
        const headers = new Headers()

        Object.entries(request.headers).forEach(([name, value]) => {
          if (Array.isArray(value)) {
            value.forEach((item) => headers.append(name, item))
          } else if (value !== undefined) {
            headers.set(name, value)
          }
        })

        const webRequest = new Request(`http://localhost${request.url || '/api/fetch-tripadvisor-reviews'}`, {
          method,
          headers,
          body,
        })

        if (method === 'OPTIONS') {
          await sendWebResponse(response, await onRequestOptions())
          return
        }

        if (method === 'POST') {
          await sendWebResponse(response, await onRequestPost({ request: webRequest, env: process.env }))
          return
        }

        await sendWebResponse(response, onRequest())
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
    plugins: [localReviewImporterPlugin(), react()],
  }
})
