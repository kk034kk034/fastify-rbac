// swagger/index.js
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const swagger = {}

// 遞迴讀取 `swagger/` 內的所有 `.js` 檔案
const loadSchemas = async (dir) => {
  const files = fs.readdirSync(dir)

  await Promise.all(
    files.map(async (file) => {
      const fullPath = path.join(dir, file)
      if (fs.statSync(fullPath).isDirectory()) {
        await loadSchemas(fullPath) // ✅ 遞迴讀取子資料夾
      } else if (file.endsWith('.js')) {
        const schemaModule = await import(pathToFileURL(fullPath).href)
        Object.assign(swagger, schemaModule)
      }
    })
  )
}

// ✅ 提供 `initSwagger()` 來手動初始化
export const initSwagger = async () => {
  await loadSchemas(path.dirname(fileURLToPath(import.meta.url)))
}

export default swagger
