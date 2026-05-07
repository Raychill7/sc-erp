<template>
  <div class="page">
    <el-button type="primary" @click="openCreate">收货登记</el-button>
    <el-table :data="list" border stripe class="mt" v-loading="loading">
      <el-table-column prop="receipt_no" label="收货单号" width="140" />
      <el-table-column prop="order_no" label="采购单" width="140" />
      <el-table-column prop="receive_date" label="收货日" width="110" />
      <el-table-column prop="abnormal_note" label="异常备注" min-width="140" show-overflow-tooltip />
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button link type="primary" @click="print(row)">打印</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dlg.visible" title="收货登记" width="900px" destroy-on-close>
      <el-form :inline="true">
        <el-form-item label="采购单" required>
          <el-select v-model="dlg.orderId" filterable style="width: 260px" @change="onOrder">
            <el-option v-for="o in orders" :key="o.id" :label="o.order_no + ' / ' + o.supplier_name" :value="o.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="实收日期">
          <el-date-picker v-model="dlg.receiveDate" value-format="YYYY-MM-DD" />
        </el-form-item>
      </el-form>
      <el-input v-model="dlg.abnormalNote" type="textarea" rows="2" placeholder="少货、次品、延期等异常说明" class="mb" />
      <el-table :data="dlg.lines" border size="small" v-if="dlg.lines.length">
        <el-table-column prop="material_name" label="物料" />
        <el-table-column prop="spec" label="规格" />
        <el-table-column label="采购数量" width="100"><template #default="{ row }">{{ row.qty }}</template></el-table-column>
        <el-table-column label="已收" width="80"><template #default="{ row }">{{ row.received_qty }}</template></el-table-column>
        <el-table-column label="本次实收" width="120">
          <template #default="{ row }"><el-input-number v-model="row._recv" :min="0" :max="maxRecv(row)" /></template>
        </el-table-column>
        <el-table-column label="验收" width="130">
          <template #default="{ row }">
            <el-select v-model="row._inspection" style="width: 120px">
              <el-option label="合格" value="qualified" />
              <el-option label="不合格" value="unqualified" />
              <el-option label="次品" value="defective" />
            </el-select>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="dlg.visible = false">取消</el-button>
        <el-button type="primary" @click="submit">提交</el-button>
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
const orders = ref([]);
const dlg = reactive({
  visible: false,
  orderId: null,
  receiveDate: new Date().toISOString().slice(0, 10),
  abnormalNote: '',
  lines: [],
});

function maxRecv(row) {
  return Math.max(0, Number(row.qty) - Number(row.received_qty));
}

async function load() {
  loading.value = true;
  try {
    list.value = await http.get('/api/receipts');
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  dlg.visible = true;
  dlg.orderId = null;
  dlg.receiveDate = new Date().toISOString().slice(0, 10);
  dlg.abnormalNote = '';
  dlg.lines = [];
}

async function onOrder() {
  if (!dlg.orderId) return;
  const po = await http.get(`/api/purchase-orders/${dlg.orderId}`);
  dlg.lines = (po.lines || []).map((l) => ({
    ...l,
    _recv: 0,
    _inspection: 'qualified',
  }));
}

async function submit() {
  if (!dlg.orderId) return ElMessage.warning('请选择采购单');
  const lines = dlg.lines
    .filter((l) => l._recv > 0)
    .map((l) => ({
      orderLineId: l.id,
      qtyReceived: l._recv,
      inspection: l._inspection,
    }));
  if (!lines.length) return ElMessage.warning('请填写至少一行的本次实收数量');
  const res = await http.post('/api/receipts', {
    orderId: dlg.orderId,
    receiveDate: dlg.receiveDate,
    abnormalNote: dlg.abnormalNote,
    lines,
  });
  ElMessage.success('收货成功 ' + res.receiptNo);
  dlg.visible = false;
  load();
}

function print(row) {
  window.open(`/#/print/receipt/${row.id}`, '_blank');
}

onMounted(async () => {
  orders.value = await http.get('/api/purchase-orders', { params: { status: '' } });
  orders.value = orders.value.filter((o) => o.status !== 'void');
  load();
});
</script>

<style scoped>
.mt {
  margin-top: 12px;
}
.mb {
  margin-bottom: 10px;
}
</style>
