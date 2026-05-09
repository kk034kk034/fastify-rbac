// models/camera.js
import { DataTypes } from 'sequelize'
import { sequelize } from '../plugins/sequelize.js'
import crypto from 'node:crypto'

const Camera = sequelize.define(
  'camera',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    rtsp_url: {
      type: DataTypes.STRING(512),
      allowNull: false,
      comment: 'rtsp://user:pass@ip:554/stream'
    },
    stream_key: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      defaultValue: () => crypto.randomBytes(16).toString('hex')
    },
    camera_group_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    organization_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  },
  {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
)

export default Camera
