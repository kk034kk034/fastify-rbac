// routes/v1/device/base.js
/**
 * sysUser / sysTester / sysCircle
 * create  device (bind)---------------> groupAdmin, groupManager
 * edit  device -----------------------> groupAdmin, groupManager
 * delete device ----------------------> groupAdmin, groupManager
 * Get all devices under the user -----> groupAdmin, groupManager, groupViewer
 */
import { User, UserRole, Role, DeviceCatalog, DeviceBind } from '../../../models/index.js'
import swagger from '../../../swagger/index.js'
import crypto from 'node:crypto'
import { getOrgOrSiteId } from '../../../utils/permissions.js'
import { convertSNMPTypeToCloudType } from '../../../utils/others.js'

export default async function (fastify) {
  // ✅ Get a list of devices (query only the current user's device)
  fastify.get(
    '/',
    {
      schema: swagger.getDeviceList,
      preValidation: [fastify.authenticate]
    },
    async (request, reply) => {
      try {
        const { user } = request

        const devices = await DeviceBind.findAll({
          where: { user_id: user.id }
        })

        const formattedDevices = devices.map((device) => device.get())

        return reply.send({ message: 'ok', devices: formattedDevices })
      } catch (error) {
        request.log.error(`❌ 取得設備清單錯誤: ${error.stack || error}`)
        return reply.code(500).send({ message: 'Internal Server Error' })
      }
    }
  )

  // ✅ Dynamic Inquiry Device Binding
  fastify.post(
    '/check',
    {
      schema: swagger.checkOneDevice,
      preHandler: [fastify.authenticate]
    },
    async (request, reply) => {
      try {
        const { macaddr, serial_number } = request.body

        const foundDevice = await DeviceCatalog.findOne({
          where: { macaddr, serial_number }
        })

        if (!foundDevice) {
          return reply.code(404).send({ error: 'Device not found in system' })
        }

        const bound = await DeviceBind.findOne({
          where: { macaddr, serial_number }
        })

        if (bound) {
          return reply.code(400).send({ error: 'This device has already been bound' })
        }

        return reply.send({
          message: 'Device is valid and available',
          macaddr,
          serial_number,
          modelname: foundDevice.modelname
        })
      } catch (err) {
        request.log.error('❌ 裝置檢查失敗:', err)
        return reply.code(500).send({ message: 'Internal Server Error' })
      }
    }
  )

  // ✅ Additional Device (Json)
  fastify.post(
    '/addnew',
    {
      schema: swagger.addDevice,
      onRequest: [fastify.authenticate],
      preHandler: [fastify.authorize('createAny', 'device')]
    },
    async (request, reply) => {
      try {
        const { pincode, organization_id, site_id, macaddr, serial_number, name } = request.body

        const user_id = request.user.id

        // TODO: The request.body version of the org2role is not yet written in the preHandler.
        const userOrgRole = await UserRole.findOne({
          where: { user_id: user_id, organization_id },
          include: [{ model: Role, attributes: ['name'] }]
        })
        console.log('✅ 取得使用者角色:', userOrgRole.role.name)
        if (!userOrgRole.role.name) {
          console.log('❌ 該使用者不屬於該 organization_id:', organization_id)
          return reply.code(403).send({ error: 'Not belong this Org' })
        }
        if (userOrgRole.role.name === 'groupViewer') {
          console.log('❌ 使用者為 groupViewer，無法新增設備')
          return reply.code(403).send({ error: 'No permission to add devices' })
        }

        // Confirm that `macaddr` exists in `DeviceCatalog`.
        const foundDevice = await DeviceCatalog.findOne({
          where: { macaddr, serial_number }
        })
        if (!foundDevice) {
          return reply.code(404).send({ error: 'Device not found in system' })
        }

        // The device can't be bound repeatedly, it can either be unbound or transferred.
        const alreadyBound = await DeviceBind.findOne({
          where: { macaddr, serial_number }
        })
        if (alreadyBound) {
          console.log('❌ 該設備已被綁定:', { macaddr, serial_number })
          return reply.code(400).send({ error: 'This device has already been bound' })
        }

        // MQTT CMD << Get it back from Redis: deviceID, version, type, modelname
        const mac = macaddr.replace(/:/g, '')
        const redisPayload = await fastify.redis.hgetall(`addnew:${mac}`)
        const deviceID = redisPayload.deviceID
        if (!deviceID) {
          console.warn("⚠️ Redis can't find the deviceID of the device and skips the MQTT send.")
          return reply.code(404).send({ error: 'Device not found in system.' })
        }

        // const clientId = crypto.randomUUID().replace(/-/g, '') // 得到 32 字元
        const client_id = crypto.randomUUID() // 36 字元

        // DB device_bind
        let finalType = 0
        let finalSNMPType = 0
        if (redisPayload.version === '2') {
          finalType = convertSNMPTypeToCloudType(Number(redisPayload.type))
          finalSNMPType = Number(redisPayload.type)
        } else {
          // other version, v1 api 不會在這
          // finalType = Number(redisPayload.type)
          // finalSNMPType = convertCloudTypeToSNMPType(finalType)
        }

        const deviceName = !name || name.length === 0 ? macaddr.toUpperCase() : name
        const newDevice = await DeviceBind.create({
          user_id: user_id,
          organization_id,
          site_id,
          client_id: client_id,
          type: finalType,
          snmp_type: finalSNMPType,
          macaddr,
          serial_number,
          modelname: redisPayload.modelname,
          api: redisPayload.version,
          name: deviceName
        })

        return reply.send({
          message: 'Device added successfully',
          device: newDevice
        })
      } catch (error) {
        console.error('❌ 新增裝置失敗:', error)
        return reply.code(500).send({ message: error.message })
      }
    }
  )

  // ✅ Update Device Settings
  fastify.put(
    '/:device_id/config',
    {
      schema: swagger.updateDeviceConfig,
      preValidation: [fastify.authenticate],
      preHandler: [fastify.authorize('updateAny', 'device', getOrgOrSiteId)]
    },
    async (request, reply) => {
      try {
        const { device_id } = request.params
        const { new_site_id, new_organization_id } = request.body
        const userRole = request.user.role

        if (!new_site_id) {
          return reply.code(400).send({ error: 'new_site_id is required' })
        }

        const deviceRecord = await DeviceBind.findByPk(device_id)
        if (!deviceRecord) {
          return reply.code(404).send({ error: 'Device not found' })
        }

        // If `device` is to be changed to another `organization_id`, it can only be changed by `groupAdmin`.
        console.log('✅ 取得使用者角色:', userRole)
        if (new_organization_id && new_organization_id !== deviceRecord.organization_id && userRole !== 'groupAdmin') {
          console.log('❌ Only `groupAdmin` can change `organization_id`')
          return reply.code(403).send({ error: 'Only groupAdmin can change organization_id' })
        }

        // Update Device Information
        await deviceRecord.update({
          site_id: new_site_id,
          organization_id: new_organization_id || deviceRecord.organization_id
        })

        return reply.send({
          message: 'Device configuration updated successfully',
          device: {
            id: deviceRecord.id,
            site_id: deviceRecord.site_id,
            organization_id: deviceRecord.organization_id
          }
        })
      } catch (error) {
        return reply.code(500).send({ message: error.message })
      }
    }
  )

  // ✅ delete device
  fastify.delete(
    '/:device_id',
    {
      schema: swagger.deleteDevice,
      preValidation: [fastify.authenticate],
      preHandler: [fastify.authorize('deleteAny', 'device', getOrgOrSiteId)]
    },
    async (request, reply) => {
      try {
        const { device_id } = request.params
        const { user } = request
        const isGroupViewer = request.user.role === 'groupViewer'

        if (isGroupViewer) {
          return reply.code(403).send({ error: 'Permission denied' })
        }

        const deviceRecord = await DeviceBind.findByPk(device_id)
        if (!deviceRecord) {
          return reply.code(404).send({ error: 'Device not found' })
        }
        // TODO: 需要集中到一個 function, 可能還有其他資料要一併刪除
        deviceRecord.destroy()

        return reply.send({ message: 'Device deleted successfully' })
      } catch (error) {
        return reply.code(500).send({ message: error.message })
      }
    }
  )
}
