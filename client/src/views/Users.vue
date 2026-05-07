<template>
  <div class="page">
    <el-button type="primary" @click="open()">新增用户</el-button>
    <el-table :data="list" border class="mt" v-loading="loading">
      <el-table-column prop="username" label="用户名" width="140" />
      <el-table-column prop="name" label="姓名" width="120" />
      <el-table-column label="角色" width="100">
        <template #default="{ row }">{{ roleText(row.role) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status ? 'success' : 'info'">{{ row.status ? '启用' : '禁用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button link type="primary" @click="open(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dlg.visible" :title="dlg.id ? '编辑用户' : '新增用户'" width="480px">
      <el-form :model="dlg.form" label-width="90px">
        <el-form-item label="用户名" required><el-input v-model="dlg.form.username" :disabled="!!dlg.id" /></el-form-item>
        <el-form-item :label="dlg.id ? '新密码' : '密码'" :required="!dlg.id">
          <el-input v-model="dlg.form.password" type="password" show-password placeholder="编辑时留空表示不改" />
        </el-form-item>
        <el-form-item label="姓名"><el-input v-model="dlg.form.name" /></el-form-item>
        <el-form-item label="角色">
          <el-select v-model="dlg.form.role" style="width: 100%">
            <el-option label="管理员" value="admin" />
            <el-option label="采购员" value="purchaser" />
            <el-option label="财务" value="finance" />
          </el-select>
        </el-form-item>
        <el-form-item label="启用" v-if="dlg.id"><el-switch v-model="dlg.form.status" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dlg.visible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import http from '@/api/http';
import { ElMessage } from 'element-plus';

const list = ref([]);
const loading = ref(false);
const dlg = reactive({
  visible: false,
  id: null,
  form: { username: '', password: '', name: '', role: 'purchaser', status: true },
});

function roleText(r) {
  const m = { admin: '管理员', purchaser: '采购员', finance: '财务' };
  return m[r] || r;
}

async function load() {
  loading.value = true;
  try {
    list.value = await http.get('/api/users');
  } finally {
    loading.value = false;
  }
}

function open(row) {
  dlg.id = row?.id || null;
  dlg.form = row
    ? { username: row.username, password: '', name: row.name, role: row.role, status: !!row.status }
    : { username: '', password: '', name: '', role: 'purchaser', status: true };
  dlg.visible = true;
}

async function save() {
  if (!dlg.form.username) return ElMessage.warning('用户名必填');
  if (!dlg.id && !dlg.form.password) return ElMessage.warning('请设置密码');
  if (dlg.id) {
    const body = { name: dlg.form.name, role: dlg.form.role, status: dlg.form.status };
    if (dlg.form.password) body.password = dlg.form.password;
    await http.put(`/api/users/${dlg.id}`, body);
  } else {
    await http.post('/api/users', dlg.form);
  }
  ElMessage.success('已保存');
  dlg.visible = false;
  load();
}

onMounted(load);
</script>

<style scoped>
.mt {
  margin-top: 12px;
}
</style>
