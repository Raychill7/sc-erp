<template>
  <div class="page">
    <el-table :data="list" border v-loading="loading">
      <el-table-column prop="supplierName" label="供应商" min-width="180" />
      <el-table-column prop="accrued" label="已收货应付" width="130" />
      <el-table-column prop="paid" label="已付(分摊)" width="130" />
      <el-table-column prop="unpaid" label="欠款" width="130" />
    </el-table>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import http from '@/api/http';

const list = ref([]);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    list.value = await http.get('/api/stats/payables');
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>
