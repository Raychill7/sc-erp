<template>
  <div class="page">
    <el-card header="付款登记" class="no-print mb">
      <el-form :model="form" label-width="100px" style="max-width: 640px">
        <el-form-item label="供应商" required>
          <el-select v-model="form.supplierId" filterable style="width: 100%">
            <el-option v-for="s in sups" :key="s.id" :label="s.full_name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="付款日期"><el-date-picker v-model="form.payDate" value-format="YYYY-MM-DD" style="width: 100%" /></el-form-item>
        <el-form-item label="付款金额" required><el-input-number v-model="form.amount" :min="0.01" :step="0.01" style="width: 100%" /></el-form-item>
        <el-form-item label="付款方式"><el-input v-model="form.payMethod" /></el-form-item>
        <el-form-item label="凭证号"><el-input v-model="form.voucherNo" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" /></el-form-item>
        <el-form-item label="分摊到采购单">
          <el-button size="small" @click="addAlloc">添加一行</el-button>
          <div v-for="(a, i) in form.allocations" :key="i" class="row">
            <el-select v-model="a.orderId" filterable placeholder="采购单" style="width: 220px">
              <el-option v-for="o in ordersFiltered" :key="o.id" :label="o.order_no" :value="o.id" />
            </el-select>
            <el-input-number v-model="a.amount" :min="0.01" :step="0.01" style="width: 160px; margin-left: 8px" />
            <el-button link type="danger" @click="form.allocations.splice(i, 1)">删除</el-button>
          </div>
          <div class="hint">若不分摊，可留空；分摊时合计须等于付款金额</div>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="submit">提交</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-table :data="list" border v-loading="loading">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="supplier_name" label="供应商" min-width="140" />
      <el-table-column prop="pay_date" label="日期" width="110" />
      <el-table-column prop="amount" label="金额" width="110" />
      <el-table-column prop="pay_method" label="方式" width="100" />
      <el-table-column prop="voucher_no" label="凭证号" width="140" />
    </el-table>
  </div>
</template>

<script setup>
import { computed, reactive, ref, onMounted, watch } from 'vue';
import http from '@/api/http';
import { ElMessage } from 'element-plus';

const sups = ref([]);
const orders = ref([]);
const list = ref([]);
const loading = ref(false);

const form = reactive({
  supplierId: null,
  payDate: new Date().toISOString().slice(0, 10),
  amount: null,
  payMethod: '银行转账',
  voucherNo: '',
  remark: '',
  allocations: [],
});

const ordersFiltered = computed(() => orders.value.filter((o) => o.supplier_id === form.supplierId && o.status !== 'void'));

function addAlloc() {
  form.allocations.push({ orderId: null, amount: null });
}

async function submit() {
  if (!form.supplierId || !form.amount) return ElMessage.warning('请填写供应商与金额');
  await http.post('/api/payments', {
    ...form,
    allocations: form.allocations.filter((a) => a.orderId && a.amount),
  });
  ElMessage.success('已登记');
  form.allocations = [];
  load();
}

async function load() {
  loading.value = true;
  try {
    list.value = await http.get('/api/payments');
  } finally {
    loading.value = false;
  }
}

watch(
  () => form.supplierId,
  async (sid) => {
    if (!sid) {
      orders.value = [];
      return;
    }
    orders.value = await http.get('/api/purchase-orders', { params: { supplierId: sid } });
  }
);

onMounted(async () => {
  sups.value = await http.get('/api/suppliers', { params: { status: '1' } });
  load();
});
</script>

<style scoped>
.mb {
  margin-bottom: 16px;
}
.row {
  margin-top: 6px;
}
.hint {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>
