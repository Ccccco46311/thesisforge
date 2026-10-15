<template>
  <div>
    <el-card class="welcome-card">
      <h2>欢迎使用 ThesisForge 🔨</h2>
      <p class="desc">
        这是一个可以让 AI 定制自身源代码的后台管理系统。在左侧「AI定制」中，
        配置好 AI 供应商后，你可以让 AI 帮你把系统改造成你的毕设项目。
      </p>
    </el-card>

    <el-row :gutter="16" class="stat-row">
      <el-col :span="6" v-for="item in stats" :key="item.title">
        <el-card>
          <div class="stat">
            <div class="stat-title">{{ item.title }}</div>
            <div class="stat-value">{{ item.value }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card>
      <template #header>快速上手</template>
      <el-steps :active="4" align-center>
        <el-step title="配置 AI 供应商" description="填 API Key 与模型" />
        <el-step title="打开 AI 开发" description="和 AI 对话改造系统" />
        <el-step title="确认开发方案" description="生成进度计划" />
        <el-step title="完成节点" description="每步留痕，可查看" />
      </el-steps>
    </el-card>
  </div>
</template>

<script setup>
const stats = [
  { title: '系统模块', value: '5+' },
  { title: 'AI 能力', value: '前端/后端/数据库' },
  { title: '开源协议', value: 'MIT' },
  { title: '默认账号', value: 'admin' },
]
</script>

<style scoped>
.welcome-card {
  margin-bottom: 16px;
}
.welcome-card h2 {
  color: #111827;
}
.desc {
  margin-top: 8px;
  color: #6b7280;
  line-height: 1.7;
}
.stat-row {
  margin-bottom: 16px;
}
.stat-title {
  color: #9ca3af;
  font-size: 13px;
}
.stat-value {
  margin-top: 6px;
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
}
</style>
