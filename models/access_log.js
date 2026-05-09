// models/access_log.js
import { DataTypes } from 'sequelize'
import { sequelize } from '../plugins/sequelize.js'

const AccessLog = sequelize.define(
  'access_log',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    camera_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    camera_group_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    token_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    action: {
      type: DataTypes.ENUM(
        'token_create',
        'token_enable',
        'token_disable',
        'token_delete',
        'stream_play',
        'camera_create',
        'camera_update',
        'camera_delete',
        'group_create',
        'group_update',
        'group_delete',
        'permission_change'
      ),
      allowNull: false
    },
    ip_addr: {
      type: DataTypes.STRING(64),
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  },
  { timestamps: false }
)

export default AccessLog
