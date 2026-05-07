<template>
  <div class="print-root">
    <div class="no-print toolbar">
      <el-button type="primary" @click="doPrint">打印 / 导出 PDF</el-button>
      <el-button @click="close">关闭</el-button>
    </div>
    <div v-if="data">
      <h2>收货验收单</h2>
      <table class="tb">
        <tr><td class="k">收货单号</td><td>{{ data.receipt_no }}</td><td class="k">采购单</td><td>{{ data.order_no }}</td></tr>
        <tr><td class="k">收货日</td><td>{{ data.receive_date }}</td><td class="k">异常说明</td><td>{{ data.abnormal_note }}</td></tr>
      </table>
      <table class="tb mt">
        <thead>
          <tr><th>物料</th><th>规格</th><th>采购数</th><th>本次实收</th><th>验收</th></tr>
        </thead>
        <tbody>
          <tr v-for="l in data.lines" :key="l.id">
            <td>{{ l.material_name }}</td>
            <td>{{ l.spec }}</td>
            <td>{{ l.order_qty }}</td>
            <td>{{ l.qty_received }}</td>
            <td>{{ ins(l.inspection) }}</td>
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

function ins(v) {
  const m = { qualified: '合格', unqualified: '不合格', defective: '次品' };
  return m[v] || v;
}

onMounted(async () => {
  const id = route.params.id;
  data.value = await http.get(`/api/receipts/${id}`);
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
  width: 100px;
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
