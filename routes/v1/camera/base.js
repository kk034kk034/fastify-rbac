// routes/v1/camera/base.js
import { Camera, CameraGroup, AccessLog } from '../../../models/index.js'
import crypto from 'node:crypto'

export default async function (fastify) {
  // GET /api/v1/camera — 取得攝影機列表（依 organization）
  fastify.get(
    '/',
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const { organization_id } = request.query
        const where = {}
        if (organization_id) where.organization_id = organization_id

        const cameras = await Camera.findAll({
          where,
          include: [{ model: CameraGroup, attributes: ['id', 'name'] }],
          order: [['created_at', 'DESC']]
        })
        return reply.send({ cameras })
      } catch (error) {
        request.log.error(error)
        return reply.code(500).send({ message: 'Internal Server Error' })
      }
    }
  )

  // GET /api/v1/camera/:id
  fastify.get(
    '/:id',
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const camera = await Camera.findByPk(request.params.id, {
          include: [{ model: CameraGroup, attributes: ['id', 'name'] }]
        })
        if (!camera) return reply.code(404).send({ error: 'Camera not found' })
        return reply.send({ camera })
      } catch (error) {
        request.log.error(error)
        return reply.code(500).send({ message: 'Internal Server Error' })
      }
    }
  )

  // POST /api/v1/camera — 新增攝影機
  fastify.post(
    '/',
    {
      preValidation: [fastify.authenticate],
      preHandler: [fastify.authorize('createAny', 'camera')]
    },
    async (request, reply) => {
      try {
        const { name, rtsp_url, camera_group_id, location, organization_id } = request.body

        if (!name || !rtsp_url || !organization_id) {
          return reply.code(400).send({ error: 'name, rtsp_url, organization_id are required' })
        }

        const stream_key = crypto.randomBytes(16).toString('hex')
        const camera = await Camera.create({
          name,
          rtsp_url,
          stream_key,
          camera_group_id: camera_group_id || null,
          location: location || null,
          organization_id
        })

        await AccessLog.create({
          user_id: request.user.id,
          camera_id: camera.id,
          action: 'camera_create',
          ip_addr: request.headers['x-forwarded-for'] || request.ip,
          description: `Created camera: ${name}`
        })

        return reply.code(201).send({ message: 'Camera created', camera })
      } catch (error) {
        request.log.error(error)
        return reply.code(500).send({ message: 'Internal Server Error' })
      }
    }
  )

  // PUT /api/v1/camera/:id — 更新攝影機
  fastify.put(
    '/:id',
    {
      preValidation: [fastify.authenticate],
      preHandler: [fastify.authorize('updateAny', 'camera')]
    },
    async (request, reply) => {
      try {
        const camera = await Camera.findByPk(request.params.id)
        if (!camera) return reply.code(404).send({ error: 'Camera not found' })

        const { name, rtsp_url, camera_group_id, location, is_active } = request.body
        await camera.update({
          ...(name !== undefined && { name }),
          ...(rtsp_url !== undefined && { rtsp_url }),
          ...(camera_group_id !== undefined && { camera_group_id }),
          ...(location !== undefined && { location }),
          ...(is_active !== undefined && { is_active })
        })

        await AccessLog.create({
          user_id: request.user.id,
          camera_id: camera.id,
          action: 'camera_update',
          ip_addr: request.headers['x-forwarded-for'] || request.ip,
          description: `Updated camera: ${camera.name}`
        })

        return reply.send({ message: 'Camera updated', camera })
      } catch (error) {
        request.log.error(error)
        return reply.code(500).send({ message: 'Internal Server Error' })
      }
    }
  )

  // DELETE /api/v1/camera/:id
  fastify.delete(
    '/:id',
    {
      preValidation: [fastify.authenticate],
      preHandler: [fastify.authorize('deleteAny', 'camera')]
    },
    async (request, reply) => {
      try {
        const camera = await Camera.findByPk(request.params.id)
        if (!camera) return reply.code(404).send({ error: 'Camera not found' })

        const cameraName = camera.name
        await camera.destroy()

        await AccessLog.create({
          user_id: request.user.id,
          camera_id: null,
          action: 'camera_delete',
          ip_addr: request.headers['x-forwarded-for'] || request.ip,
          description: `Deleted camera: ${cameraName}`
        })

        return reply.send({ message: 'Camera deleted' })
      } catch (error) {
        request.log.error(error)
        return reply.code(500).send({ message: 'Internal Server Error' })
      }
    }
  )
}
