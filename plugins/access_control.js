// plugins/access_control.js
import FastifyPlugin from 'fastify-plugin'
import { AccessControl } from 'accesscontrol'
import { Op } from 'sequelize'
import UserRole from '../models/user_role.js'
import Role from '../models/role.js'

const ac = new AccessControl()

// Group Viewer
ac.grant('groupViewer')
  .readAny('device')
  .readAny('site')
  .readAny('organization')
  .readAny('userRole')
  .readAny('roleChangeLog')
  .readAny('camera')
  .readAny('cameraGroup')
  .readAny('streamToken')
  .readAny('report')
  .readAny('monitor')

// Group Manager
ac.grant('groupManager')
  .extend('groupViewer')
  .updateAny('organization')
  .createAny('userRole')
  .updateAny('userRole')
  .deleteAny('userRole')
  .readAny('userRole')
  .createAny('site')
  .updateAny('site')
  .deleteAny('site')
  .createAny('device')
  .updateAny('device')
  .deleteAny('device')
  .createAny('camera')
  .updateAny('camera')
  .deleteAny('camera')
  .createAny('cameraGroup')
  .updateAny('cameraGroup')
  .deleteAny('cameraGroup')
  .createAny('streamToken')
  .updateAny('streamToken')
  .deleteAny('streamToken')

// Account Admin
ac.grant('groupAdmin')
  .extend('groupManager')
  .createAny('organization')
  .deleteAny('organization')
  .updateAny('alertThreshold')

async function rbacPlugin(fastify) {
  fastify.decorate('authorize', (action, resource, getOrgSiteId = null) => {
    return async (request, reply) => {
      if (!request.user || !request.user.id) {
        return reply.code(401).send({ error: 'Unauthorized User' })
      }

      let organization_id = null
      let site_id = null

      // If API requires `organization_id` or `site_id`, execute query
      if (typeof getOrgSiteId === 'function') {
        const orgSite = (await getOrgSiteId(request, reply)) || {}
        organization_id = orgSite.organization_id ?? null
        site_id = orgSite.site_id ?? null

        if (!organization_id && !site_id) {
          return reply.code(400).send({ error: 'Missing organization_id or site_id' })
        }
      }

      // Query `UserRole`
      const userRoles = await UserRole.findAll({
        where: {
          user_id: request.user.id,
          ...(organization_id && { organization_id }),
          ...(site_id && {
            [Op.or]: [{ site_id }, { site_id: { [Op.is]: null } }]
          })
        },
        include: [Role]
      })

      if (!userRoles.length) {
        return reply.code(403).send({ error: 'No Permissions in RBAC' })
      }

      // Ensure `site_id` has corresponding role, otherwise use organization's role
      let foundRole = userRoles.find((ur) => ur.site_id === site_id)?.role.name
      if (!foundRole) {
        foundRole = userRoles.find((ur) => ur.site_id === null)?.role.name
      }

      request.user.role = foundRole
      console.log(`✅ RBAC: ${foundRole}`)

      const permission = ac.can(foundRole)[action](resource)
      if (!permission.granted) {
        return reply.code(403).send({ error: 'Unauthorized Permission' })
      }
    }
  })
}

export default FastifyPlugin(rbacPlugin)
