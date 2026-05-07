<template>
  <div class="page">
    <el-form :inline="true" class="toolbar">
      <el-form-item label="状态">
        <el-select v-model="q.status" clearable placeholder="全部" style="width: 140px">
          <el-option label="待发货" value="pending_ship" />
          <el-option label="部分发货" value="partial_shipped" />
          <el-option label="全部发货" value="fully_shipped" />
          <el-option label="已完成" value="completed" />
          <el-option label="已作废" value="void" />
        </el-select>
      </el-form-item>
      <el-form-item label="供应商">
        <el-select v-model="q.supplierId" clearable filterable style="width: 200px">
          <el-option v-for="s in sups" :key="s.id" :label="s.full_name" :value="s.id" />
        </el-select>
      </el-form-item>
      <el-button type="primary" @click="load">查询</el-button>
    </el-form>

    <el-table :data="list" border stripe v-loading="loading">
      <el-table-column prop="order_no" label="采购单号" width="140" />
      <el-table-column prop="supplier_name" label="供应商" min-width="140" />
      <el-table-column prop="total_amount" label="金额" width="110" />
      <el-table-column prop="delivery_date" label="交货日" width="110" />
      <el-table-column prop="pay_method" label="付款方式" width="100" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">{{ poSt(row.status) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="view(row)">详情</el-button>
          <el-button link type="primary" @click="print(row)" v-if="row.status !== 'void'">打印</el-button>
          <el-button link type="warning" @click="openEdit(row)" v-if="canEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="voidPo(row)" v-if="canEdit(row)">作废</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dlg.visible" title="采购单详情" width="860px">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="单号">{{ detail.order_no }}</el-descriptions-item>
        <el-descriptions-item label="供应商">{{ detail.supplier_name }}</el-descriptions-item>
        <el-descriptions-item label="交货日">{{ detail.delivery_date }}</el-descriptions-item>
        <el-descriptions-item label="付款方式">{{ detail.pay_method }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ poSt(detail.status) }}</el-descriptions-item>
        <el-descriptions-item label="合计">{{ detail.total_amount }}</el-descriptions-item>
      </el-descriptions>
      <el-table :data="detail.lines || []" border size="small" class="mt">
        <el-table-column prop="material_name" label="物料" />
        <el-table-column prop="spec" label="规格" />
        <el-table-column prop="qty" label="数量" width="90" />
        <el-table-column prop="unit_price" label="单价" width="90" />
        <el-table-column prop="received_qty" label="已收" width="80" />
        <el-table-column prop="line_amount" label="金额" width="100" />
      </el-table>
    </el-dialog>

    <el-dialog v-model="editDlg.visible" title="编辑采购单(未收货前)" width="900px">
      <el-form :inline="true">
        <el-form-item label="供应商">
          <el-select v-model="editDlg.form.supplierId" filterable style="width: 220px">
            <el-option v-for="s in sups" :key="s.id" :label="s.full_name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="交货日"><el-date-picker v-model="editDlg.form.deliveryDate" value-format="YYYY-MM-DD" /></el-form-item>
        <el-form-item label="付款方式">
          <el-select v-model="editDlg.form.payMethod" style="width: 120px">
            <el-option v-for="p in payMethods" :key="p" :label="p" :value="p" />
          </el-select>
        </el-form-item>
      </el-form>
      <el-table :data="editDlg.form.lines" border size="small">
        <el-table-column prop="material_name" label="物料" />
        <el-table-column label="数量" width="120">
          <template #default="{ row }"><el-input-number v-model="row.qty" :min="0.0001" /></template>
        </el-table-column>
        <el-table-column label="单价" width="120">
          <template #default="{ row }"><el-input-number v-model="row.unit_price" :min="0.01" :step="0.01" /></template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="editDlg.visible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import http from '@/api/http';
import { ElMessage, ElMessageBox } from 'element-plus';

const loading = ref(false);
const list = ref([]);
const sups = ref([]);
const payMethods = ref(['现结', '月结', '批结']);
const q = reactive({ status: '', supplierId: '' });
const dlg = reactive({ visible: false });
const detail = ref({});

const editDlg = reactive({
  visible: false,
  id: null,
  form: { supplierId: null, deliveryDate: '', payMethod: '', lines: [] },
});

function poSt(s) {
  const m = {
    pending_ship: '待发货',
    partial_shipped: '部分发货',
    fully_shipped: '全部发货',
    completed: '已完成',
    void: '已作废',
  };
  return m[s] || s;
}
function canEdit(row) {
  return row.status !== 'void' && !row.shipped_flag;
}

async function load() {
  loading.value = true;
  try {
    list.value = await http.get('/api/purchase-orders', { params: q });
  } finally {
    loading.value = false;
  }
}
function view(row) {
  http.get(`/api/purchase-orders/${row.id}`).then((data) => {
    detail.value = data;
    dlg.visible = true;
  });
}
function print(row) {
  window.open(`/#/print/po/${row.id}`, '_blank');
}
function openEdit(row) {
  http.get(`/api/purchase-orders/${row.id}`).then((data) => {
    editDlg.id = data.id;
    editDlg.form = {
      supplierId: data.supplier_id,
      deliveryDate: data.delivery_date,
      payMethod: data.pay_method,
      lines: (data.lines || []).map((l) => ({
        id: l.id,
        material_name: l.material_name,
        qty: Number(l.qty),
        unit_price: Number(l.unit_price),
      })),
    };
    editDlg.visible = true;
  });
}
async function saveEdit() {
  await http.put(`/api/purchase-orders/${editDlg.id}`, {
    supplierId: editDlg.form.supplierId,
    deliveryDate: editDlg.form.deliveryDate,
    payMethod: editDlg.form.payMethod,
    lines: editDlg.form.lines.map((l) => ({ id: l.id, qty: l.qty, unitPrice: l.unit_price })),
  });
  ElMessage.success('已保存');
  editDlg.visible = false;
  load();
}
async function voidPo(row) {
  await ElMessageBox.confirm('确定作废？', '提示');
  await http.post(`/api/purchase-orders/${row.id}/void`);
  ElMessage.success('已作废');
  load();
}

onMounted(async () => {
  sups.value = await http.get('/api/suppliers', { params: { status: '1' } });
  const cfg = await http.get('/api/config');
  if (cfg.pay_methods) payMethods.value = cfg.pay_methods;
  load();
});
</script>

<style scoped>
.toolbar {
  margin-bottom: 12px;
}
.mt {
  margin-top: 12px;
}
</style>
