// routes/v1/monitor/base.js
// 系統監控：從 SRS HTTP API 取得即時數據 + 告警門檻管理
import { AlertThreshold } from '../../../models/index.js'
import process from 'node:process'

const SRS_API = `http://${process.env.SRS_HOST || 'localhost'}:${process.env.SRS_API_PORT || '1985'}`

async function fetchSRS(path) {
  const res = await fetch(`${SRS_API}${path}`)
  if (!res.ok) throw new Error(`SRS API error: ${res.status}`)
  return res.json()
}

export default async function (fastify) {
  // GET /api/v1/monitor/stats — 伺服器整體指標
  fastify.get(
    '/stats',
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const [summaries, streams] = await Promise.all([
          fetchSRS('/api/v1/summaries').catch(() => null),
          fetchSRS('/api/v1/streams').catch(() => null)
        ])

        const serverStats = summaries?.data || {}
        const streamList = streams?.streams || []

        const totalViewers = streamList.reduce((sum, s) => sum + (s.clients || 0), 0)
        const totalBitrate = streamList.reduce((sum, s) => sum + (s.kbps?.recv_30s || 0), 0)

        const result = {
          cpu_percent: serverStats.self?.cpu_percent ?? null,
          memory_percent: serverStats.self?.mem_percent ?? null,
          concurrent_viewers: totalViewers,
          total_bitrate_kbps: totalBitrate,
          stream_count: streamList.length,
          streams: streamList.map((s) => ({
            stream_key: s.name,
            viewers: s.clients || 0,
            recv_kbps: s.kbps?.recv_30s || 0,
            send_kbps: s.kbps?.send_30s || 0,
            alive_seconds: s.live_seconds || 0
          }))
        }

        // 門檻檢查
        const thresholds = await AlertThreshold.findAll({ where: { is_active: true } })
        const alerts = []
        for (const th of thresholds) {
          let currentValue = null
          if (th.metric_name === 'cpu_percent') currentValue = result.cpu_percent
          else if (th.metric_name === 'memory_percent') currentValue = result.memory_percent
          else if (th.metric_name === 'concurrent_viewers') currentValue = result.concurrent_viewers
          else if (th.metric_name === 'bitrate_kbps') currentValue = result.total_bitrate_kbps

          if (currentValue !== null && currentValue >= th.threshold_value) {
            alerts.push({
              metric: th.metric_name,
              value: currentValue,
              threshold: th.threshold_value
            })
          }
        }

        return reply.send({ ...result, alerts })
      } catch (error) {
        request.log.error(error)
        return reply.code(500).send({ message: 'Failed to fetch SRS stats', error: error.message })
      }
    }
  )

  // GET /api/v1/monitor/streams — 每路串流詳情
  fastify.get(
    '/streams',
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const data = await fetchSRS('/api/v1/streams')
        return reply.send({ streams: data.streams || [] })
      } catch (error) {
        request.log.error(error)
        return reply.code(500).send({ message: 'Failed to fetch SRS streams', error: error.message })
      }
    }
  )

  // GET /api/v1/monitor/thresholds — 查詢告警門檻
  fastify.get(
    '/thresholds',
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const thresholds = await AlertThreshold.findAll({ order: [['metric_name', 'ASC']] })
        return reply.send({ thresholds })
      } catch (error) {
        request.log.error(error)
        return reply.code(500).send({ message: 'Internal Server Error' })
      }
    }
  )

  // POST /api/v1/monitor/thresholds — 新增或更新門檻
  fastify.post(
    '/thresholds',
    {
      preValidation: [fastify.authenticate],
      preHandler: [fastify.authorize('updateAny', 'alertThreshold')]
    },
    async (request, reply) => {
      try {
        const { metric_name, threshold_value, organization_id, is_active = true } = request.body

        if (!metric_name || threshold_value === undefined) {
          return reply.code(400).send({ error: 'metric_name and threshold_value are required' })
        }

        const [threshold, created] = await AlertThreshold.findOrCreate({
          where: { metric_name, organization_id: organization_id || null },
          defaults: { threshold_value, is_active }
        })

        if (!created) {
          await threshold.update({ threshold_value, is_active })
        }

        return reply.code(created ? 201 : 200).send({ message: created ? 'Created' : 'Updated', threshold })
      } catch (error) {
        request.log.error(error)
        return reply.code(500).send({ message: 'Internal Server Error' })
      }
    }
  )
}
