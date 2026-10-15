<template>
  <el-card>
    <template #header>
      <div class="card-header">
        <span>进度计划</span>
        <el-button type="primary" size="small" @click="dialogVisible = true">新建进度计划</el-button>
      </div>
    </template>

    <el-empty
      v-if="!plan"
      description="还没有进度计划。让 AI 给出开发方案后，在这里创建计划并跟踪每个功能的完成情况。"
    />

    <template v-else>
      <div class="plan-title">
        <h3>{{ plan.title }}</h3>
        <el-tag :type="planStatusType" size="small">{{ planStatusText }}</el-tag>
      </div>
      <p class="plan-desc">{{ plan.description }}</p>

      <!-- 步骤列表 -->
      <div class="item-list">
        <div v-for="(item, idx) in plan.items" :key="item.id" class="plan-item">
          <el-steps :active="idx" align-center class="hidden-steps">
            <el-step />
          </el-steps>
          <div class="item-row" :class="{ done: item.status === 'done' }">
            <div class="item-index">{{ idx + 1 }}</div>
            <div class="item-body">
              <div class="item-title">
                {{ item.title }}
                <el-tag v-if="item.status === 'done'" type="success" size="small">已认定节点</el-tag>
                <el-tag v-else-if="item.status === 'doing'" type="warning" size="small">开发中</el-tag>
                <el-tag v-else type="info" size="small">待开发</el-tag>
              </div>
              <div v-if="item.description" class="item-desc">{{ item.description }}</div>
            </div>
            <el-button
              v-if="item.status !== 'done'"
              type="success"
              size="small"
              @click="complete(item)"
            >
              ✓ 完成
            </el-button>
          </div>
        </div>
      </div>
    </template>
  </el-card>

  <!-- 新建计划弹窗 -->
  <el-dialog v-model="dialogVisible" title="新建进度计划" width="560px">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
      <el-form-item label="标题" prop="title">
        <el-input v-model="form.title" placeholder="如：图书租赁系统改造" />
      </el-form-item>
      <el-form-item label="描述" prop="description">
        <el-input v-model="form.description" type="textarea" :rows="3" />
      </el-form-item>
      <el-form-item label="开发方案">
        <el-input
          v-model="form.itemsText"
          type="textarea"
          :rows="6"
          placeholder="每行一个子功能，如：&#10;1. 卖家创建商铺&#10;2. 添加商品（需审核）&#10;3. 商品上架"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="savePlan">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getPlan, createPlan, createPlanItem, completePlanItem } from '@/api/ai'

const plan = ref(null)
const dialogVisible = ref(false)
const formRef = ref()
const form = reactive({ title: '', description: '', itemsText: '' })

const rules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
}

const planStatusText = computed(() => {
  if (!plan.value) return ''
  const doneCount = plan.value.items.filter((i) => i.status === 'done').length
  if (doneCount === plan.value.items.length) return '已完成'
  if (doneCount > 0) return '进行中'
  return '待开发'
})

const planStatusType = computed(() => {
  if (!plan.value) return 'info'
  const doneCount = plan.value.items.filter((i) => i.status === 'done').length
  if (doneCount === plan.value.items.length) return 'success'
  if (doneCount > 0) return 'warning'
  return 'info'
})

async function load() {
  const data = await getPlan()
  plan.value = data
}

async function savePlan() {
  await formRef.value.validate()
  const items = form.itemsText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^\d+[.、]\s*/, ''))
    .map((title) => ({ title, description: '' }))

  const data = await createPlan({
    title: form.title,
    description: form.description,
    items,
  })
  plan.value = data
  dialogVisible.value = false
  ElMessage.success('进度计划已创建')
}

async function complete(item) {
  await completePlanItem(item.id)
  ElMessage.success('已认定节点')
  load()
}

onMounted(load)
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.plan-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.plan-desc {
  color: #6b7280;
  margin-bottom: 20px;
}
.item-list {
  border-top: 1px solid #f3f4f6;
}
.plan-item {
  position: relative;
  padding: 16px 0;
  border-bottom: 1px solid #f3f4f6;
}
.item-row {
  display: flex;
  align-items: center;
  gap: 14px;
}
.item-index {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #4f46e5;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}
.item-row.done .item-index {
  background: #10b981;
}
.item-body {
  flex: 1;
}
.item-title {
  font-weight: 600;
  color: #111827;
  display: flex;
  align-items: center;
  gap: 8px;
}
.item-desc {
  margin-top: 4px;
  color: #6b7280;
  font-size: 13px;
}
.hidden-steps {
  display: none;
}
</style>
