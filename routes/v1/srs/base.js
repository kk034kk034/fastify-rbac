// routes/v1/srs/base.js
// SRS HTTP Callback — 每次有人連線播放時，SRS 呼叫此端點驗證 Token
// SRS 設定範例: vhost __defaultVhost__ { http_hooks { enabled on; on_play http://backend/api/v1/srs/on_play; } }
import { StreamToken, Camera, AccessLog } from '../../../models/index.js'
import { Op } from 'sequelize'

export default async function (fastify) {
  // POST /api/v1/srs/on_play
  // SRS 送來的 body: { action, client_id, ip, vhost, app, stream, param }
  // param 格式: ?token=xxx&exp=1234567890
  fastify.post('/on_play', async (request, reply) => {
    try {
      const { stream, param } = request.body || {}

      // 從 param 解析 token
      const urlParams = new URLSearchParams(param || '')
      const tokenValue = urlParams.get('token')

      if (!tokenValue) {
        request.log.warn('SRS on_play: missing token')
        return reply.code(401).send({ code: 401, reason: 'Missing token' })
      }

      // 先查 Redis（最快）
      const cachedCameraId = await fastify.redis.get(`stream_token:${tokenValue}`)
      if (!cachedCameraId) {
        // Redis 不存在：可能 TTL 到期或被 disable
        request.log.warn(`SRS on_play: token not in Redis: ${tokenValue}`)
        return reply.code(401).send({ code: 401, reason: 'Token invalid or expired' })
      }

      // 再查 DB 確認 is_enabled
      const token = await StreamToken.findOne({
        where: {
          token: tokenValue,
          is_enabled: true,
          [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: new Date() } }]
        }
      })

      if (!token) {
        // DB 已停用或過期，清除 Redis 殘留
        await fastify.redis.del(`stream_token:${tokenValue}`)
        return reply.code(401).send({ code: 401, reason: 'Token disabled or expired' })
      }

      // 記錄播放事件
      AccessLog.create({
        camera_id: token.camera_id,
        token_id: token.id,
        action: 'stream_play',
        ip_addr: request.body?.ip || request.ip,
        description: `SRS stream play: ${stream}`
      }).catch(() => {})

      // SRS 要求回 200 + { code: 0 } 才允許連線
      return reply.code(200).send({ code: 0 })
    } catch (error) {
      request.log.error(error)
      return reply.code(500).send({ code: 500, reason: 'Internal Server Error' })
    }
  })

  // POST /api/v1/srs/on_publish — 攝影機推流驗證（可選）
  fastify.post('/on_publish', async (request, reply) => {
    try {
      const { stream } = request.body || {}
      // stream_key 即為 stream 名稱
      const camera = await Camera.findOne({ where: { stream_key: stream, is_active: true } })
      if (!camera) {
        return reply.code(401).send({ code: 401, reason: 'Unknown stream key' })
      }
      return reply.code(200).send({ code: 0 })
    } catch (error) {
      request.log.error(error)
      return reply.code(500).send({ code: 500, reason: 'Internal Server Error' })
    }
  })

  // POST /api/v1/srs/on_stop — 可選，記錄斷線
  fastify.post('/on_stop', async (request, reply) => {
    return reply.code(200).send({ code: 0 })
  })
}
