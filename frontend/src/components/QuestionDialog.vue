<template>
  <el-dialog
    :model-value="modelValue"
    :title="question?.title || 'AI 需要你选择'"
    width="560px"
    :close-on-click-modal="false"
    :show-close="false"
    append-to-body
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <div class="question-content">
      <p class="question-lead">AI 在关键决策点上等你确认，选择后它将继续执行：</p>

      <div v-for="field in question?.fields || []" :key="field.key" class="question-field">
        <div class="question-field-title">
          {{ field.description || field.title }}
        </div>

        <!-- 多选 -->
        <el-checkbox-group
          v-if="field.type === 'multiselect'"
          v-model="selectedMap[field.key]"
          class="question-options"
        >
          <el-checkbox
            v-for="opt in field.options"
            :key="opt.value"
            :value="opt.value"
            class="question-option"
          >
            <span class="question-option-label">{{ opt.label }}</span>
            <span v-if="opt.description" class="question-option-desc">{{ opt.description }}</span>
          </el-checkbox>
        </el-checkbox-group>

        <!-- 单选 -->
        <el-radio-group v-else v-model="selectedMap[field.key]" class="question-options">
          <el-radio
            v-for="opt in field.options"
            :key="opt.value"
            :value="opt.value"
            class="question-option"
          >
            <span class="question-option-label">{{ opt.label }}</span>
            <span v-if="opt.description" class="question-option-desc">{{ opt.description }}</span>
          </el-radio>
        </el-radio-group>

        <div v-if="field.custom && field.type !== 'multiselect'" class="question-custom">
          <el-input
            v-model="customMap[field.key]"
            :placeholder="field.options.length ? '或输入自定义答案（留空则用上面的选择）' : '请输入你的答案'"
            clearable
          />
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="emit('close')">稍后再说</el-button>
      <el-button type="primary" @click="submit">确认选择</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  question: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'confirm', 'close'])

const selectedMap = ref({})
const customMap = ref({})

function init() {
  const map = {}
  const custom = {}
  for (const f of props.question?.fields || []) {
    if (f.type === 'multiselect') {
      map[f.key] = []
      custom[f.key] = ''
    } else {
      // 默认选中第一个选项，方便直接确认
      map[f.key] = f.options?.length ? f.options[0].value : ''
      custom[f.key] = ''
    }
  }
  selectedMap.value = map
  customMap.value = custom
}

watch(
  () => props.modelValue,
  (v) => {
    if (v) init()
  },
)

function submit() {
  const answers = {}
  for (const f of props.question?.fields || []) {
    if (f.type === 'multiselect') {
      const arr = selectedMap.value[f.key] || []
      if (!arr.length) {
        ElMessage.warning(`请选择「${f.description || f.title}」的答案`)
        return
      }
      answers[f.key] = arr
      continue
    }
    const custom = (customMap.value[f.key] || '').trim()
    if (f.custom && custom) {
      answers[f.key] = custom
      continue
    }
    const val = selectedMap.value[f.key]
    if (val === undefined || val === '') {
      ElMessage.warning(`请选择「${f.description || f.title}」的答案`)
      return
    }
    answers[f.key] = val
  }
  emit('confirm', answers)
}
</script>

<style scoped>
.question-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.question-lead {
  margin: 0;
  color: #606266;
  font-size: 13px;
}

.question-field-title {
  margin-bottom: 8px;
  font-size: 15px;
  color: #303133;
  font-weight: 500;
  line-height: 1.5;
}

.question-options {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.question-option {
  display: flex;
  align-items: flex-start;
  height: auto;
  margin-right: 0;
  white-space: normal;
}

.question-option :deep(.el-radio__label) {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.question-option-label {
  font-size: 14px;
  color: #303133;
}

.question-option-desc {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

.question-custom {
  margin-top: 8px;
}
</style>
