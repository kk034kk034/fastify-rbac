// models/stream_token.js
import { DataTypes } from 'sequelize'
import { sequelize } from '../plugins/sequelize.js'

const StreamToken = sequelize.define(
  'stream_token',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    camera_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    token: {
      type: DataTypes.STRING(128),
      allowNull: false,
      unique: true
    },
    protocol: {
      type: DataTypes.ENUM('rtmp', 'hls', 'mjpeg', 'all'),
      allowNull: false,
      defaultValue: 'all'
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'NULL 表示永不過期'
    },
    is_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    note: {
      type: DataTypes.STRING,
      allowNull: true
    }
  },
  {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
)

export default StreamToken
