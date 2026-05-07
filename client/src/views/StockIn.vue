<template>
  <div class="page">
    <el-form :inline="true">
      <el-form-item label="物料ID"><el-input v-model="q.materialId" clearable style="width: 120px" /></el-form-item>
      <el-form-item label="从"><el-date-picker v-model="q.from" value-format="YYYY-MM-DD" /></el-form-item>
      <el-form-item label="到"><el-date-picker v-model="q.to" value-format="YYYY-MM-DD" /></el-form-item>
      <el-button type="primary" @click="load">查询</el-button>
      <el-button @click="printList">打印列表(PDF)</el-button>
    </el-form>
    <el-table :data="list" border stripe class="mt" v-loading="loading" id="stockPrintArea">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="material_name" label="物料" min-width="160" />
      <el-table-column prop="qty" label="入库数量" width="110" />
      <el-table-column prop="in_date" label="入库日" width="110" />
      <el-table-column prop="created_at" label="记录时间" width="170" />
    </el-table>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import http from '@/api/http';

const loading = ref(false);
const list = ref([]);
const q = reactive({ materialId: '', from: '', to: '' });

async function load() {
  loading.value = true;
  try {
    list.value = await http.get('/api/receipts/stock-in/list', { params: q });
  } finally {
    loading.value = false;
  }
}

function printList() {
  window.print();
}

onMounted(load);
</script>

<style scoped>
.mt {
  margin-top: 12px;
}
@media print {
  .no-print {
    display: none !important;
  }
}
</style>
