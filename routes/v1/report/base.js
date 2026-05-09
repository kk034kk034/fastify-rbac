// routes/v1/report/base.js
// 操作日誌查詢 + Excel/CSV 匯出
import { AccessLog, User, Camera, CameraGroup, StreamToken } from '../../../models/index.js'
import { Op } from 'sequelize'
import ExcelJS from 'exceljs'

export default async function (fastify) {
  // GET /api/v1/report/logs — 查詢日誌（支援篩選）
  fastify.get(
    '/logs',
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const {
          start_date,
          end_date,
          camera_id,
          camera_group_id,
          action,
          page = 1,
          limit = 50
        } = request.query

        const where = {}
        if (start_date || end_date) {
          where.created_at = {}
          if (start_date) where.created_at[Op.gte] = new Date(start_date)
          if (end_date) {
            const end = new Date(end_date)
            end.setHours(23, 59, 59, 999)
            where.created_at[Op.lte] = end
          }
        }
        if (camera_id) where.camera_id = camera_id
        if (camera_group_id) where.camera_group_id = camera_group_id
        if (action) where.action = action

        const { count, rows } = await AccessLog.findAndCountAll({
          where,
          include: [
            { model: User, attributes: ['id', 'username', 'email'] },
            { model: Camera, attributes: ['id', 'name'] },
            { model: CameraGroup, attributes: ['id', 'name'] },
            { model: StreamToken, attributes: ['id', 'protocol'] }
          ],
          order: [['created_at', 'DESC']],
          limit: Number(limit),
          offset: (Number(page) - 1) * Number(limit)
        })

        return reply.send({ total: count, page: Number(page), logs: rows })
      } catch (error) {
        request.log.error(error)
        return reply.code(500).send({ message: 'Internal Server Error' })
      }
    }
  )

  // GET /api/v1/report/export?format=xlsx|csv — 匯出報表
  fastify.get(
    '/export',
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const { format = 'xlsx', start_date, end_date, camera_id, camera_group_id, action } = request.query

        const where = {}
        if (start_date || end_date) {
          where.created_at = {}
          if (start_date) where.created_at[Op.gte] = new Date(start_date)
          if (end_date) {
            const end = new Date(end_date)
            end.setHours(23, 59, 59, 999)
            where.created_at[Op.lte] = end
          }
        }
        if (camera_id) where.camera_id = camera_id
        if (camera_group_id) where.camera_group_id = camera_group_id
        if (action) where.action = action

        const rows = await AccessLog.findAll({
          where,
          include: [
            { model: User, attributes: ['id', 'username', 'email'] },
            { model: Camera, attributes: ['id', 'name'] },
            { model: CameraGroup, attributes: ['id', 'name'] }
          ],
          order: [['created_at', 'DESC']],
          limit: 10000
        })

        const data = rows.map((r) => ({
          id: r.id,
          time: r.created_at ? new Date(r.created_at).toISOString() : '',
          action: r.action,
          user: r.user ? `${r.user.username} (${r.user.email})` : '',
          camera: r.camera ? r.camera.name : '',
          camera_group: r.camera_group ? r.camera_group.name : '',
          ip_addr: r.ip_addr || '',
          description: r.description || ''
        }))

        if (format === 'csv') {
          const header = 'ID,時間,操作,使用者,攝影機,攝影機群組,IP,說明\n'
          const csv = data
            .map((r) =>
              [r.id, r.time, r.action, r.user, r.camera, r.camera_group, r.ip_addr, `"${r.description}"`].join(',')
            )
            .join('\n')
          reply.header('Content-Type', 'text/csv; charset=utf-8')
          reply.header('Content-Disposition', 'attachment; filename="access_log.csv"')
          return reply.send('﻿' + header + csv)
        }

        // Default: xlsx
        const workbook = new ExcelJS.Workbook()
        const sheet = workbook.addWorksheet('存取日誌')
        sheet.columns = [
          { header: 'ID', key: 'id', width: 8 },
          { header: '時間', key: 'time', width: 22 },
          { header: '操作', key: 'action', width: 18 },
          { header: '使用者', key: 'user', width: 28 },
          { header: '攝影機', key: 'camera', width: 20 },
          { header: '攝影機群組', key: 'camera_group', width: 18 },
          { header: 'IP', key: 'ip_addr', width: 16 },
          { header: '說明', key: 'description', width: 40 }
        ]
        sheet.getRow(1).font = { bold: true }
        data.forEach((r) => sheet.addRow(r))

        reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        reply.header('Content-Disposition', 'attachment; filename="access_log.xlsx"')
        const buffer = await workbook.xlsx.writeBuffer()
        return reply.send(buffer)
      } catch (error) {
        request.log.error(error)
        return reply.code(500).send({ message: 'Internal Server Error' })
      }
    }
  )
}
