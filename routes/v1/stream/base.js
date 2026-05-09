// routes/v1/stream/base.js
// 串流 Token 管理：生成帶簽名 URL、enable/disable、查詢
import { Camera, StreamToken, AccessLog } from '../../../models/index.js'
import crypto from 'node:crypto'
import process from 'node:process'

const SRS_HOST = process.env.SRS_HOST || 'localhost'
const SRS_HTTP_PORT = process.env.SRS_HTTP_PORT || '8080'
const SRS_RTMP_PORT = process.env.SRS_RTMP_PORT || '1935'

function buildStreamUrls(streamKey, token) {
  const exp = token.expires_at ? Math.floor(new Date(token.expires_at).getTime() / 1000) : ''
  const expParam = exp ? `&exp=${exp}` : ''
  const q = `?token=${token.token}${expParam}`
  return {
    rtmp: `rtmp://${SRS_HOST}:${SRS_RTMP_PORT}/live/${streamKey}${q}`,
    hls: `http://${SRS_HOST}:${SRS_HTTP_PORT}/live/${streamKey}.m3u8${q}`,
    mjpeg: `http://${SRS_HOST}:${SRS_HTTP_PORT}/live/${streamKey}.jpg${q}`
  }
}

export default async function (fastify) {
  // GET /api/v1/stream/tokens?camera_id=&page=&limit=
  fastify.get(
    '/tokens',
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const { camera_id, page = 1, limit = 20 } = request.query
        const where = {}
        if (camera_id) where.camera_id = camera_id

        const { count, rows } = await StreamToken.findAndCountAll({
          where,
          include: [{ model: Camera, attributes: ['id', 'name', 'stream_key'] }],
          order: [['created_at', 'DESC']],
          limit: Number(limit),
          offset: (Number(page) - 1) * Number(limit)
        })

        const tokens = rows.map((t) => {
          const plain = t.toJSON()
          if (t.camera) {
            plain.urls = buildStreamUrls(t.camera.stream_key, t)
          }
          return plain
        })

        return reply.send({ total: count, page: Number(page), tokens })
      } catch (error) {
        request.log.error(error)
        return reply.code(500).send({ message: 'Internal Server Error' })
      }
    }
  )

  // POST /api/v1/stream/tokens — 為某攝影機生成 Token + URL
  fastify.post(
    '/tokens',
    {
      preValidation: [fastify.authenticate],
      preHandler: [fastify.authorize('createAny', 'streamToken')]
    },
    async (request, reply) => {
      try {
        const { camera_id, protocol = 'all', expires_in_hours, note } = request.body

        if (!camera_id) {
          return reply.code(400).send({ error: 'camera_id is required' })
        }

        const camera = await Camera.findByPk(camera_id)
        if (!camera) return reply.code(404).send({ error: 'Camera not found' })
        if (!camera.is_active) return reply.code(400).send({ error: 'Camera is inactive' })

        const tokenValue = crypto.randomBytes(32).toString('hex')
        const expires_at = expires_in_hours
          ? new Date(Date.now() + Number(expires_in_hours) * 3600 * 1000)
          : null

        const streamToken = await StreamToken.create({
          camera_id,
          user_id: request.user.id,
          token: tokenValue,
          protocol,
          expires_at,
          note: note || null
        })

        // 寫入 Redis：key = stream_token:<token>  value = camera_id  TTL = expires_in 秒
        if (expires_at) {
          const ttl = Math.floor((expires_at.getTime() - Date.now()) / 1000)
          await fastify.redis.set(`stream_token:${tokenValue}`, camera_id, 'EX', ttl)
        } else {
          await fastify.redis.set(`stream_token:${tokenValue}`, camera_id)
        }

        const urls = buildStreamUrls(camera.stream_key, streamToken)

        await AccessLog.create({
          user_id: request.user.id,
          camera_id,
          token_id: streamToken.id,
          action: 'token_create',
          ip_addr: request.headers['x-forwarded-for'] || request.ip,
          description: `Token created for camera: ${camera.name}`
        })

        return reply.code(201).send({ message: 'Token created', token: streamToken, urls })
      } catch (error) {
        request.log.error(error)
        return reply.code(500).send({ message: 'Internal Server Error' })
      }
    }
  )

  // PATCH /api/v1/stream/tokens/:id/enable
  fastify.patch(
    '/tokens/:id/enable',
    {
      preValidation: [fastify.authenticate],
      preHandler: [fastify.authorize('updateAny', 'streamToken')]
    },
    async (request, reply) => {
      try {
        const token = await StreamToken.findByPk(request.params.id)
        if (!token) return reply.code(404).send({ error: 'Token not found' })

        await token.update({ is_enabled: true })

        // 重新寫入 Redis
        const camera = await Camera.findByPk(token.camera_id)
        if (token.expires_at) {
          const ttl = Math.floor((new Date(token.expires_at).getTime() - Date.now()) / 1000)
          if (ttl > 0) {
            await fastify.redis.set(`stream_token:${token.token}`, token.camera_id, 'EX', ttl)
          }
        } else {
          await fastify.redis.set(`stream_token:${token.token}`, token.camera_id)
        }

        await AccessLog.create({
          user_id: request.user.id,
          camera_id: token.camera_id,
          token_id: token.id,
          action: 'token_enable',
          ip_addr: request.headers['x-forwarded-for'] || request.ip,
          description: `Token enabled for camera_id: ${token.camera_id}`
        })

        const urls = camera ? buildStreamUrls(camera.stream_key, token) : null
        return reply.send({ message: 'Token enabled', token, urls })
      } catch (error) {
        request.log.error(error)
        return reply.code(500).send({ message: 'Internal Server Error' })
      }
    }
  )

  // PATCH /api/v1/stream/tokens/:id/disable
  fastify.patch(
    '/tokens/:id/disable',
    {
      preValidation: [fastify.authenticate],
      preHandler: [fastify.authorize('updateAny', 'streamToken')]
    },
    async (request, reply) => {
      try {
        const token = await StreamToken.findByPk(request.params.id)
        if (!token) return reply.code(404).send({ error: 'Token not found' })

        await token.update({ is_enabled: false })
        // 從 Redis 刪除 → 立即失效
        await fastify.redis.del(`stream_token:${token.token}`)

        await AccessLog.create({
          user_id: request.user.id,
          camera_id: token.camera_id,
          token_id: token.id,
          action: 'token_disable',
          ip_addr: request.headers['x-forwarded-for'] || request.ip,
          description: `Token disabled for camera_id: ${token.camera_id}`
        })

        return reply.send({ message: 'Token disabled' })
      } catch (error) {
        request.log.error(error)
        return reply.code(500).send({ message: 'Internal Server Error' })
      }
    }
  )

  // DELETE /api/v1/stream/tokens/:id
  fastify.delete(
    '/tokens/:id',
    {
      preValidation: [fastify.authenticate],
      preHandler: [fastify.authorize('deleteAny', 'streamToken')]
    },
    async (request, reply) => {
      try {
        const token = await StreamToken.findByPk(request.params.id)
        if (!token) return reply.code(404).send({ error: 'Token not found' })

        await fastify.redis.del(`stream_token:${token.token}`)
        await token.destroy()

        await AccessLog.create({
          user_id: request.user.id,
          camera_id: token.camera_id,
          action: 'token_delete',
          ip_addr: request.headers['x-forwarded-for'] || request.ip,
          description: `Token deleted`
        })

        return reply.send({ message: 'Token deleted' })
      } catch (error) {
        request.log.error(error)
        return reply.code(500).send({ message: 'Internal Server Error' })
      }
    }
  )
}
