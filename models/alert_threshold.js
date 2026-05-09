// models/alert_threshold.js
import { DataTypes } from 'sequelize'
import { sequelize } from '../plugins/sequelize.js'

const AlertThreshold = sequelize.define(
  'alert_threshold',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    organization_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'NULL 表示全域設定'
    },
    metric_name: {
      type: DataTypes.ENUM('cpu_percent', 'memory_percent', 'concurrent_viewers', 'bitrate_kbps'),
      allowNull: false
    },
    threshold_value: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  },
  {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
)

export default AlertThreshold
