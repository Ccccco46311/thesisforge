<template>
  <router-view />
</template>

<script setup>
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
html, body, #app {
  height: 100%;
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', Arial, sans-serif;
}

/*
 * 顶部消息提示（ElMessage）不拦截鼠标点击：
 * 提示浮层经常盖住顶部菜单/按钮，改成穿透后可以直接点后面的内容。
 * 只保留关闭按钮可点击（如果显示了关闭按钮）。
 */
.el-message {
  pointer-events: none;
}

.el-message .el-message__closeBtn {
  pointer-events: auto;
}
</style>
