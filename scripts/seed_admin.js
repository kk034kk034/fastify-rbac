// scripts/seed_admin.js
// 建立預設 admin 帳號，不需要 email 驗證
// 用法：node scripts/seed_admin.js
import { sequelize } from '../plugins/sequelize.js'
import User from '../models/user.js'
import { createPassword } from '../plugins/password.js'

const ADMIN_EMAIL = 'admin@lnheo.local'
const ADMIN_PASSWORD = 'Admin1234!'
const ADMIN_USERNAME = 'admin'

async function seedAdmin() {
  await sequelize.authenticate()

  const hashed = await createPassword(ADMIN_PASSWORD)

  const [user, created] = await User.findOrCreate({
    where: { email: ADMIN_EMAIL },
    defaults: {
      username: ADMIN_USERNAME,
      password: hashed,
      email: ADMIN_EMAIL,
      system_role: 'sysAdmin',
    },
  })

  if (created) {
    console.log(`✅ Admin 帳號已建立：${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
  } else {
    console.log(`ℹ️  Admin 帳號已存在 (id=${user.id})，跳過建立`)
  }

  await sequelize.close()
}

seedAdmin().catch((err) => {
  console.error('❌ 建立失敗:', err.message)
  process.exit(1)
})
