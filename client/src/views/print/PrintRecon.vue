<template>
  <div class="print-root">
    <div class="no-print toolbar">
      <el-button type="primary" @click="doPrint">打印 / 导出 PDF</el-button>
      <el-button @click="close">关闭</el-button>
    </div>
    <div v-if="data">
      <h2>对账单</h2>
      <table class="tb">
        <tr><td class="k">对账单号</td><td>{{ data.snapshot_no }}</td><td class="k">供应商</td><td>{{ data.supplier_name }}</td></tr>
        <tr><td class="k">账期</td><td colspan="3">{{ data.period_start }} ~ {{ data.period_end }}</td></tr>
        <tr>
          <td class="k">应付(已收货)</td><td>{{ data.total_payable }}</td>
          <td class="k">已付分摊</td><td>{{ data.total_paid }}</td>
        </tr>
        <tr><td class="k">待付</td><td colspan="3">{{ data.total_unpaid }}</td></tr>
      </table>
      <table class="tb mt">
        <thead>
          <tr><th>采购单</th><th>已收货金额</th><th>已付</th><th>待付</th></tr>
        </thead>
        <tbody>
          <tr v-for="(l, i) in data.lines" :key="i">
            <td>{{ l.orderNo }}</td>
            <td>{{ l.accruedAmount }}</td>
            <td>{{ l.paidAmount }}</td>
            <td>{{ l.unpaidAmount }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import http from '@/api/http';

const route = useRoute();
const data = ref(null);

onMounted(async () => {
  const no = route.params.no;
  data.value = await http.get(`/api/reconciliation/snapshots/${no}`);
});

function doPrint() {
  window.print();
}
function close() {
  window.close();
}
</script>

<style scoped>
.print-root {
  padding: 16px;
  max-width: 900px;
  margin: 0 auto;
}
.toolbar {
  margin-bottom: 12px;
}
.tb {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.tb th,
.tb td {
  border: 1px solid #333;
  padding: 6px 8px;
}
.tb .k {
  width: 120px;
  background: #f2f2f2;
}
.mt {
  margin-top: 12px;
}
@media print {
  .no-print {
    display: none !important;
  }
}
</style>
