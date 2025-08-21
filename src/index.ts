import fastify from 'fastify'
import { config } from 'dotenv'

// Load environment variables
config()

const server = fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
})

const start = async () => {
  try {
    // Register CORS
    await server.register(import('@fastify/cors'), {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true,
    })

    // Health check endpoint
    server.get('/ping', async (request, reply) => {
      return { status: 'ok', message: 'devoter-api is running' }
    })

    // API routes will be registered here
    server.register(async function (fastify) {
      // Future routes: /register, /api-keys
      fastify.get('/health', async () => {
        return { 
          status: 'healthy', 
          timestamp: new Date().toISOString(),
          service: 'devoter-api'
        }
      })
    })

    const port = parseInt(process.env.PORT || '3000')
    const host = process.env.HOST || 'localhost'
    
    await server.listen({ port, host })
    server.log.info(`🚀 Server listening at http://${host}:${port}`)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()