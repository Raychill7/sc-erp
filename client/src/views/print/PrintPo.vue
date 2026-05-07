<template>
  <div class="print-root">
    <div class="no-print toolbar">
      <el-button type="primary" @click="doPrint">打印 / 导出 PDF</el-button>
      <el-button @click="close">关闭</el-button>
    </div>
    <div id="printArea" v-if="data">
      <h2>采购订单</h2>
      <table class="tb">
        <tr><td class="k">单号</td><td>{{ data.order_no }}</td><td class="k">供应商</td><td>{{ data.supplier_name }}</td></tr>
        <tr><td class="k">交货日</td><td>{{ data.delivery_date }}</td><td class="k">付款方式</td><td>{{ data.pay_method }}</td></tr>
        <tr><td class="k">状态</td><td colspan="3">{{ data.status }}</td></tr>
      </table>
      <table class="tb mt">
        <thead>
          <tr><th>物料</th><th>规格</th><th>数量</th><th>单价</th><th>金额</th><th>已收</th></tr>
        </thead>
        <tbody>
          <tr v-for="l in data.lines" :key="l.id">
            <td>{{ l.material_name }}</td>
            <td>{{ l.spec }}</td>
            <td>{{ l.qty }}</td>
            <td>{{ l.unit_price }}</td>
            <td>{{ l.line_amount }}</td>
            <td>{{ l.received_qty }}</td>
          </tr>
        </tbody>
      </table>
      <p class="sum">合计金额：{{ data.total_amount }}</p>
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
  const id = route.params.id;
  const d = await http.get(`/api/purchase-orders/${id}`);
  const stMap = {
    pending_ship: '待发货',
    partial_shipped: '部分发货',
    fully_shipped: '全部发货',
    completed: '已完成',
    void: '已作废',
  };
  d.status = stMap[d.status] || d.status;
  data.value = d;
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
  width: 90px;
  background: #f2f2f2;
}
.mt {
  margin-top: 12px;
}
.sum {
  margin-top: 12px;
  font-weight: 600;
}
@media print {
  .no-print {
    display: none !important;
  }
  .print-root {
    padding: 0;
  }
}
</style>
