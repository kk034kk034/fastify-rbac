// server.js
import Fastify from 'fastify'
import path from 'node:path'
import process from 'node:process'
import AutoLoad from '@fastify/autoload'
import dotenv from 'dotenv'
import fastifyStatic from '@fastify/static'
import { execSync } from 'child_process'
import { initSwagger } from './swagger/index.js'
import { v1Instance } from './plugins/swagger_public.js'
import { internalInstance } from './plugins/swagger_internal.js'
import { cleanSwaggerTrailingSlash } from './utils/others.js'

dotenv.config()

const fastify = Fastify({
  logger: true,
  pluginTimeout: 60000
})

// Check if database migration should be executed
const shouldMigrate = process.env.DB_MIGRATE === 'true'
const migrateDatabase = async () => {
  if (shouldMigrate) {
    console.log('🔄 正在執行資料庫遷移...')
    try {
      execSync('node scripts/migrate_all_data.js', { stdio: 'inherit' })
      console.log('✅ 資料庫遷移完成')
    } catch (error) {
      console.error('❌ 資料庫遷移失敗:', error)
      process.exit(1) // If the migration fails, the server will not start.
    }
  }
}

// Automatically load all plugins in `plugins/` directory
fastify.register(AutoLoad, {
  dir: path.join(import.meta.dirname, 'plugins'),
  ignorePattern: /mqtt/
})

const start = async () => {
  try {
    // Execute database migration first (if environment variable is set to true)
    await migrateDatabase()
    // Fastify 啟動前先載入 Swagger Schema
    await initSwagger()
    console.log('✅ Swagger Schema 已載入')
    // Fastify 啟動
    await fastify.listen({ port: 9090, host: '0.0.0.0' })
    console.log('🚀 Server is running on port 9090')
    // Ensure Fastify is ready before modifying Swagger UI
    await fastify.ready()
    if (v1Instance) cleanSwaggerTrailingSlash(v1Instance)
    if (internalInstance) cleanSwaggerTrailingSlash(internalInstance)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()

// Allow tests to import fastify
export default fastify
