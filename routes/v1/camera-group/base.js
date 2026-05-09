// routes/v1/camera-group/base.js
import { CameraGroup, Camera, AccessLog } from '../../../models/index.js'

export default async function (fastify) {
  // GET /api/v1/camera-group
  fastify.get(
    '/',
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const { organization_id } = request.query
        const where = {}
        if (organization_id) where.organization_id = organization_id

        const groups = await CameraGroup.findAll({
          where,
          include: [{ model: Camera, attributes: ['id', 'name', 'is_active'] }],
          order: [['created_at', 'DESC']]
        })
        return reply.send({ groups })
      } catch (error) {
        request.log.error(error)
        return reply.code(500).send({ message: 'Internal Server Error' })
      }
    }
  )

  // POST /api/v1/camera-group
  fastify.post(
    '/',
    {
      preValidation: [fastify.authenticate],
      preHandler: [fastify.authorize('createAny', 'cameraGroup')]
    },
    async (request, reply) => {
      try {
        const { name, organization_id, description } = request.body
        if (!name || !organization_id) {
          return reply.code(400).send({ error: 'name and organization_id are required' })
        }

        const group = await CameraGroup.create({ name, organization_id, description })

        await AccessLog.create({
          user_id: request.user.id,
          camera_group_id: group.id,
          action: 'group_create',
          ip_addr: request.headers['x-forwarded-for'] || request.ip,
          description: `Created camera group: ${name}`
        })

        return reply.code(201).send({ message: 'Camera group created', group })
      } catch (error) {
        request.log.error(error)
        return reply.code(500).send({ message: 'Internal Server Error' })
      }
    }
  )

  // PUT /api/v1/camera-group/:id
  fastify.put(
    '/:id',
    {
      preValidation: [fastify.authenticate],
      preHandler: [fastify.authorize('updateAny', 'cameraGroup')]
    },
    async (request, reply) => {
      try {
        const group = await CameraGroup.findByPk(request.params.id)
        if (!group) return reply.code(404).send({ error: 'Camera group not found' })

        const { name, description } = request.body
        await group.update({
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description })
        })

        await AccessLog.create({
          user_id: request.user.id,
          camera_group_id: group.id,
          action: 'group_update',
          ip_addr: request.headers['x-forwarded-for'] || request.ip,
          description: `Updated camera group: ${group.name}`
        })

        return reply.send({ message: 'Camera group updated', group })
      } catch (error) {
        request.log.error(error)
        return reply.code(500).send({ message: 'Internal Server Error' })
      }
    }
  )

  // DELETE /api/v1/camera-group/:id
  fastify.delete(
    '/:id',
    {
      preValidation: [fastify.authenticate],
      preHandler: [fastify.authorize('deleteAny', 'cameraGroup')]
    },
    async (request, reply) => {
      try {
        const group = await CameraGroup.findByPk(request.params.id)
        if (!group) return reply.code(404).send({ error: 'Camera group not found' })

        const groupName = group.name
        await group.destroy()

        await AccessLog.create({
          user_id: request.user.id,
          action: 'group_delete',
          ip_addr: request.headers['x-forwarded-for'] || request.ip,
          description: `Deleted camera group: ${groupName}`
        })

        return reply.send({ message: 'Camera group deleted' })
      } catch (error) {
        request.log.error(error)
        return reply.code(500).send({ message: 'Internal Server Error' })
      }
    }
  )
}
