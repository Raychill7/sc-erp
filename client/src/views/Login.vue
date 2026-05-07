<template>
  <div class="wrap">
    <el-card class="card" shadow="hover">
      <h2>采购链 P2P ERP</h2>
      <p class="sub">轻量化采购闭环 · 本地部署</p>
      <el-form :model="form" @submit.prevent="onSubmit">
        <el-form-item>
          <el-input v-model="form.username" placeholder="用户名" prefix-icon="User" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" type="password" placeholder="密码" show-password prefix-icon="Lock" />
        </el-form-item>
        <el-button type="primary" native-type="submit" style="width: 100%" :loading="loading">登录</el-button>
      </el-form>
      <p class="hint">默认管理员：admin / admin123（首次请执行数据库脚本与 npm run seed）</p>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { ElMessage } from 'element-plus';

const router = useRouter();
const auth = useAuthStore();
const loading = ref(false);
const form = reactive({ username: 'admin', password: 'admin123' });

async function onSubmit() {
  loading.value = true;
  try {
    await auth.login(form.username, form.password);
    ElMessage.success('登录成功');
    router.push('/dashboard');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.wrap {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1f2d3d, #409eff22);
}
.card {
  width: 380px;
  padding: 8px 8px 16px;
}
h2 {
  margin: 0 0 4px;
  text-align: center;
}
.sub {
  text-align: center;
  color: #909399;
  font-size: 13px;
  margin-bottom: 20px;
}
.hint {
  margin-top: 12px;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}
</style>
