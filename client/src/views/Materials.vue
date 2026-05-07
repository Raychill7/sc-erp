<template>
  <div class="page">
    <el-form :inline="true" class="toolbar">
      <el-form-item label="分类">
        <el-select v-model="q.categoryId" clearable placeholder="全部" style="width: 160px">
          <el-option v-for="c in cats" :key="c.id" :label="c.name" :value="c.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="关键词"><el-input v-model="q.keyword" clearable /></el-form-item>
      <el-button type="primary" @click="load">查询</el-button>
      <el-button type="success" @click="open()">新增物料</el-button>
    </el-form>
    <el-table :data="list" border stripe v-loading="loading">
      <el-table-column prop="code" label="编码" width="120" />
      <el-table-column prop="name" label="名称" min-width="140" />
      <el-table-column prop="spec" label="规格" min-width="120" show-overflow-tooltip />
      <el-table-column prop="unit" label="单位" width="70" />
      <el-table-column prop="category_name" label="分类" width="100" />
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button link type="primary" @click="open(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dlg.visible" :title="dlg.id ? '编辑物料' : '新增物料'" width="520px">
      <el-form :model="dlg.form" label-width="90px">
        <el-form-item label="分类">
          <el-select v-model="dlg.form.categoryId" clearable style="width: 100%">
            <el-option v-for="c in cats" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="编码"><el-input v-model="dlg.form.code" /></el-form-item>
        <el-form-item label="名称" required><el-input v-model="dlg.form.name" /></el-form-item>
        <el-form-item label="规格"><el-input v-model="dlg.form.spec" /></el-form-item>
        <el-form-item label="单位"><el-input v-model="dlg.form.unit" /></el-form-item>
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

const loading = ref(false);
const list = ref([]);
const cats = ref([]);
const q = reactive({ keyword: '', categoryId: '' });
const dlg = reactive({
  visible: false,
  id: null,
  form: { categoryId: null, code: '', name: '', spec: '', unit: '件', status: true },
});

async function loadCats() {
  cats.value = await http.get('/api/material-categories');
}
async function load() {
  loading.value = true;
  try {
    list.value = await http.get('/api/materials', { params: q });
  } finally {
    loading.value = false;
  }
}
function open(row) {
  dlg.id = row?.id || null;
  dlg.form = row
    ? {
        categoryId: row.category_id,
        code: row.code,
        name: row.name,
        spec: row.spec,
        unit: row.unit,
        status: !!row.status,
      }
    : { categoryId: null, code: '', name: '', spec: '', unit: '件', status: true };
  dlg.visible = true;
}
async function save() {
  if (!dlg.form.name) return ElMessage.warning('请填写名称');
  if (dlg.id) await http.put(`/api/materials/${dlg.id}`, dlg.form);
  else await http.post('/api/materials', dlg.form);
  ElMessage.success('已保存');
  dlg.visible = false;
  load();
}
onMounted(async () => {
  await loadCats();
  load();
});
</script>

<style scoped>
.toolbar {
  margin-bottom: 12px;
}
</style>
