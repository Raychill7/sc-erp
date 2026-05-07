<template>
  <div class="page">
    <el-form :inline="true">
      <el-form-item label="关键词"><el-input v-model="q.keyword" clearable /></el-form-item>
      <el-button type="primary" @click="load">查询</el-button>
    </el-form>
    <el-table :data="list" border class="mt" v-loading="loading">
      <el-table-column prop="created_at" label="时间" width="170" />
      <el-table-column prop="username" label="用户" width="120" />
      <el-table-column prop="action" label="动作" width="140" />
      <el-table-column prop="entity_type" label="对象" width="120" />
      <el-table-column prop="detail" label="详情" min-width="200" show-overflow-tooltip />
    </el-table>
    <el-pagination
      class="mt"
      background
      layout="prev, pager, next, total"
      :total="total"
      v-model:current-page="page"
      :page-size="pageSize"
      @current-change="load"
    />
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import http from '@/api/http';

const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);
const q = reactive({ keyword: '' });

async function load() {
  loading.value = true;
  try {
    const data = await http.get('/api/logs', { params: { page: page.value, pageSize, keyword: q.keyword } });
    list.value = data.list;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.mt {
  margin-top: 12px;
}
</style>
