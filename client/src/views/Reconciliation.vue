<template>
  <div class="page">
    <el-form :inline="true" class="no-print">
      <el-form-item label="供应商" required>
        <el-select v-model="q.supplierId" filterable style="width: 240px">
          <el-option v-for="s in sups" :key="s.id" :label="s.full_name" :value="s.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="收货日期从"><el-date-picker v-model="q.from" value-format="YYYY-MM-DD" /></el-form-item>
      <el-form-item label="到"><el-date-picker v-model="q.to" value-format="YYYY-MM-DD" /></el-form-item>
      <el-button type="primary" @click="preview">预览对账</el-button>
      <el-button type="success" @click="snapshot">生成对账单</el-button>
      <el-button v-if="previewData" @click="printPreview">打印/导出PDF</el-button>
    </el-form>

    <el-descriptions v-if="previewData" border :column="3" class="mt">
      <el-descriptions-item label="应付(已收货部分)">{{ previewData.totalPayable }}</el-descriptions-item>
      <el-descriptions-item label="已分摊付款">{{ previewData.totalPaidAllocated }}</el-descriptions-item>
      <el-descriptions-item label="待付">{{ previewData.totalUnpaid }}</el-descriptions-item>
      <el-descriptions-item label="区间内付款发生额">{{ previewData.totalPaidInPeriod }}</el-descriptions-item>
    </el-descriptions>

    <el-table v-if="previewData" :data="previewData.lines" border class="mt" id="reconPrint">
      <el-table-column prop="orderNo" label="采购单" />
      <el-table-column prop="accruedAmount" label="已收货金额" />
      <el-table-column prop="paidAmount" label="已付分摊" />
      <el-table-column prop="unpaidAmount" label="待付" />
    </el-table>

    <el-divider class="no-print">历史对账单</el-divider>
    <el-table :data="snaps" border size="small" class="no-print">
      <el-table-column prop="snapshot_no" label="对账单号" width="140" />
      <el-table-column prop="supplier_name" label="供应商" />
      <el-table-column prop="period_start" label="开始" width="110" />
      <el-table-column prop="period_end" label="结束" width="110" />
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button link type="primary" @click="printSnap(row)">打印</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import http from '@/api/http';
import { ElMessage } from 'element-plus';

const sups = ref([]);
const q = reactive({
  supplierId: null,
  from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
  to: new Date().toISOString().slice(0, 10),
});
const previewData = ref(null);
const snaps = ref([]);

async function loadSnaps() {
  snaps.value = await http.get('/api/reconciliation/snapshots');
}

async function preview() {
  if (!q.supplierId || !q.from || !q.to) return ElMessage.warning('请完整选择条件');
  previewData.value = await http.get('/api/reconciliation/preview', { params: q });
}

async function snapshot() {
  if (!q.supplierId || !q.from || !q.to) return ElMessage.warning('请完整选择条件');
  const data = await http.post('/api/reconciliation/snapshot', q);
  ElMessage.success('已生成 ' + data.snapshotNo);
  previewData.value = data;
  loadSnaps();
}

function printPreview() {
  window.print();
}
function printSnap(row) {
  window.open(`/#/print/recon/${row.snapshot_no}`, '_blank');
}

onMounted(async () => {
  sups.value = await http.get('/api/suppliers', { params: { status: '1' } });
  loadSnaps();
});
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
