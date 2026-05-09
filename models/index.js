// models/index.js
import User from './user.js'
import UserRole from './user_role.js'
import Role from './role.js'
import Organization from './organization.js'
import RoleChangeLog from './role_change_log.js'
import UsersNotVerified from './users_not_verified.js'
import UserSession from './user_session.js'
import UserTouch from './user_touch.js'
import LoginLog from './login_log.js'
import Site from './site.js'
import DeviceCatalog from './device_catalog.js'
import DeviceBind from './device_bind.js'
import MqttLog from './mqtt_log.js'
import License from './license.js'
import DeviceLicense from './device_license.js'
import Pack from './pack.js'
import PackFeature from './pack_feature.js'
import Camera from './camera.js'
import CameraGroup from './camera_group.js'
import StreamToken from './stream_token.js'
import AccessLog from './access_log.js'
import AlertThreshold from './alert_threshold.js'

// UserRole 和 User / Role / Organization 的關聯
User.hasMany(UserRole, { foreignKey: 'user_id' })
UserRole.belongsTo(User, { foreignKey: 'user_id' })

Role.hasMany(UserRole, { foreignKey: 'role_id' })
UserRole.belongsTo(Role, { foreignKey: 'role_id' })

Organization.hasMany(UserRole, {
  foreignKey: 'organization_id',
  onDelete: 'CASCADE'
})
UserRole.belongsTo(Organization, { foreignKey: 'organization_id' })

// User & Organization 多對多關聯
User.belongsToMany(Organization, { through: UserRole, foreignKey: 'user_id' })
Organization.belongsToMany(User, {
  through: UserRole,
  foreignKey: 'organization_id'
})

// User 和 Organization 的關聯
User.hasMany(Organization, { foreignKey: 'user_id', onDelete: 'SET NULL' })
Organization.belongsTo(User, { foreignKey: 'user_id' })

// RoleChangeLog 關聯
RoleChangeLog.belongsTo(Organization, { foreignKey: 'organization_id' })

// user_sessions 關聯
User.hasMany(UserSession, { foreignKey: 'user_id', onDelete: 'CASCADE' })
UserSession.belongsTo(User, { foreignKey: 'user_id' })

// login_logs 關聯
User.hasMany(LoginLog, { foreignKey: 'user_id' })
LoginLog.belongsTo(User, { foreignKey: 'user_id' })

// user_touchs 關聯
User.hasMany(UserTouch, { foreignKey: 'user_id' })
UserTouch.belongsTo(User, { foreignKey: 'user_id' })

// Organization 與 Site 關聯
Organization.hasMany(Site, {
  foreignKey: 'organization_id',
  onDelete: 'CASCADE'
})
Site.belongsTo(Organization, { foreignKey: 'organization_id' })

// DeviceBind 與 Organization
Organization.hasMany(DeviceBind, {
  foreignKey: 'organization_id',
  onDelete: 'CASCADE'
})
DeviceBind.belongsTo(Organization, { foreignKey: 'organization_id' })

// DeviceBind 與 Site
Site.hasMany(DeviceBind, { foreignKey: 'site_id', onDelete: 'CASCADE' })
DeviceBind.belongsTo(Site, { foreignKey: 'site_id' })

// DeviceBind 與 User
User.hasMany(DeviceBind, { foreignKey: 'user_id', onDelete: 'CASCADE' })
DeviceBind.belongsTo(User, { foreignKey: 'user_id' })

// MQTT 相關表的關聯
User.hasMany(MqttLog, { foreignKey: 'user_id' })
MqttLog.belongsTo(User, { foreignKey: 'user_id' })

// License 與 User（購買者）
User.hasMany(License, { foreignKey: 'user_id', onDelete: 'CASCADE' })
License.belongsTo(User, { foreignKey: 'user_id' })

// License 與 Package（方案）
Pack.hasMany(License, { foreignKey: 'pack_id', onDelete: 'CASCADE' })
License.belongsTo(Pack, { foreignKey: 'pack_id' })

// Device License 與 License
License.hasMany(DeviceLicense, {
  foreignKey: 'license_id',
  onDelete: 'CASCADE'
})
DeviceLicense.belongsTo(License, { foreignKey: 'license_id' })

// Device License 與 Device_Bind
DeviceBind.hasMany(DeviceLicense, {
  foreignKey: 'device_id',
  onDelete: 'CASCADE'
})
DeviceLicense.belongsTo(DeviceBind, { foreignKey: 'device_id' })

// Package 與 Package Feature（方案與功能的關聯）
Pack.hasMany(PackFeature, {
  foreignKey: 'pack_id',
  onDelete: 'CASCADE'
})
PackFeature.belongsTo(Pack, { foreignKey: 'pack_id' })

// ── 串流相關 ──────────────────────────────────────────────

// CameraGroup 與 Organization
Organization.hasMany(CameraGroup, { foreignKey: 'organization_id', onDelete: 'CASCADE' })
CameraGroup.belongsTo(Organization, { foreignKey: 'organization_id' })

// Camera 與 CameraGroup
CameraGroup.hasMany(Camera, { foreignKey: 'camera_group_id', onDelete: 'SET NULL' })
Camera.belongsTo(CameraGroup, { foreignKey: 'camera_group_id' })

// Camera 與 Organization
Organization.hasMany(Camera, { foreignKey: 'organization_id', onDelete: 'CASCADE' })
Camera.belongsTo(Organization, { foreignKey: 'organization_id' })

// StreamToken 與 Camera
Camera.hasMany(StreamToken, { foreignKey: 'camera_id', onDelete: 'CASCADE' })
StreamToken.belongsTo(Camera, { foreignKey: 'camera_id' })

// StreamToken 與 User
User.hasMany(StreamToken, { foreignKey: 'user_id' })
StreamToken.belongsTo(User, { foreignKey: 'user_id' })

// AccessLog 與 User
User.hasMany(AccessLog, { foreignKey: 'user_id' })
AccessLog.belongsTo(User, { foreignKey: 'user_id' })

// AccessLog 與 Camera
Camera.hasMany(AccessLog, { foreignKey: 'camera_id' })
AccessLog.belongsTo(Camera, { foreignKey: 'camera_id' })

// AccessLog 與 CameraGroup
CameraGroup.hasMany(AccessLog, { foreignKey: 'camera_group_id' })
AccessLog.belongsTo(CameraGroup, { foreignKey: 'camera_group_id' })

// AccessLog 與 StreamToken
StreamToken.hasMany(AccessLog, { foreignKey: 'token_id' })
AccessLog.belongsTo(StreamToken, { foreignKey: 'token_id' })

export {
  User,
  UserRole,
  Role,
  Organization,
  RoleChangeLog,
  UsersNotVerified,
  UserSession,
  UserTouch,
  LoginLog,
  Site,
  DeviceCatalog,
  DeviceBind,
  MqttLog,
  License,
  DeviceLicense,
  Pack,
  PackFeature,
  Camera,
  CameraGroup,
  StreamToken,
  AccessLog,
  AlertThreshold
}
