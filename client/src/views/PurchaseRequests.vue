<template>
  <div class="page">
    <el-form :inline="true" class="toolbar">
      <el-form-item label="状态">
        <el-select v-model="q.status" clearable placeholder="全部" style="width: 140px">
          <el-option label="草稿" value="draft" />
          <el-option label="待审核" value="pending_approval" />
          <el-option label="已通过" value="approved" />
          <el-option label="已驳回" value="rejected" />
        </el-select>
      </el-form-item>
      <el-button type="primary" @click="load">查询</el-button>
      <el-button type="success" @click="open()">新建申请</el-button>
    </el-form>

    <el-table :data="list" border stripe v-loading="loading">
      <el-table-column prop="request_no" label="单号" width="130" />
      <el-table-column prop="dept_name" label="部门" width="120" />
      <el-table-column prop="need_date" label="需求日期" width="110" />
      <el-table-column prop="applicant_name" label="申请人" width="100" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">{{ stText(row.status) }}</template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="170" />
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="view(row)">详情</el-button>
          <el-button link v-if="row.status === 'draft'" type="primary" @click="open(row)">编辑</el-button>
          <el-button link v-if="row.status === 'draft'" type="warning" @click="submit(row)">提交审核</el-button>
          <el-button link v-if="row.status === 'pending_approval'" type="success" @click="approve(row)">通过</el-button>
          <el-button link v-if="row.status === 'pending_approval'" type="danger" @click="reject(row)">驳回</el-button>
          <el-button link type="info" @click="copy(row)">复制新增</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dlg.visible" :title="dlg.id ? '编辑申请(草稿)' : '新建申请'" width="900px" destroy-on-close>
      <el-form :inline="true">
        <el-form-item label="申请部门"><el-input v-model="dlg.form.deptName" /></el-form-item>
        <el-form-item label="需求日期"><el-date-picker v-model="dlg.form.needDate" value-format="YYYY-MM-DD" /></el-form-item>
      </el-form>
      <el-table :data="dlg.form.lines" border size="small">
        <el-table-column label="物料" min-width="200">
          <template #default="{ row }">
            <el-select v-model="row._matId" filterable clearable placeholder="从物料库选择" style="width: 100%" @change="onPickMat(row)">
              <el-option v-for="m in mats" :key="m.id" :label="m.name + (m.spec ? ' / ' + m.spec : '')" :value="m.id" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="名称" width="140"><template #default="{ row }"><el-input v-model="row.materialName" /></template></el-table-column>
        <el-table-column label="规格" width="120"><template #default="{ row }"><el-input v-model="row.spec" /></template></el-table-column>
        <el-table-column label="数量" width="110"><template #default="{ row }"><el-input-number v-model="row.qty" :min="0.0001" :step="1" /></template></el-table-column>
        <el-table-column label="预估单价" width="120"><template #default="{ row }"><el-input-number v-model="row.estUnitPrice" :min="0" :step="0.01" /></template></el-table-column>
        <el-table-column label="用途备注" min-width="120"><template #default="{ row }"><el-input v-model="row.purposeRemark" /></template></el-table-column>
        <el-table-column width="70" fixed="right">
          <template #default="{ $index }">
            <el-button link type="danger" @click="dlg.form.lines.splice($index, 1)">删</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top: 8px">
        <el-button @click="addLine">添加行</el-button>
      </div>
      <template #footer>
        <el-button @click="dlg.visible = false">取消</el-button>
        <el-button type="primary" @click="saveDraft">保存草稿</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="viewDlg.visible" title="申请单详情" width="800px">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="单号">{{ viewDlg.data?.request_no }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ stText(viewDlg.data?.status) }}</el-descriptions-item>
        <el-descriptions-item label="部门">{{ viewDlg.data?.dept_name }}</el-descriptions-item>
        <el-descriptions-item label="需求日">{{ viewDlg.data?.need_date }}</el-descriptions-item>
        <el-descriptions-item label="审核意见" :span="2">{{ viewDlg.data?.review_note }}</el-descriptions-item>
      </el-descriptions>
      <el-table :data="viewDlg.data?.lines || []" border size="small" class="mt">
        <el-table-column prop="material_name" label="物料" />
        <el-table-column prop="spec" label="规格" />
        <el-table-column prop="qty" label="数量" width="100" />
        <el-table-column prop="est_unit_price" label="预估单价" width="110" />
        <el-table-column prop="purpose_remark" label="备注" />
      </el-table>
      <template #footer>
        <el-button type="primary" v-if="viewDlg.data?.status === 'approved'" @click="openPoFrom(viewDlg.data)">生成采购单</el-button>
        <el-button @click="viewDlg.visible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="poDlg.visible" title="生成采购单" width="640px">
      <el-form label-width="100px">
        <el-form-item label="供应商" required>
          <el-select v-model="poDlg.supplierId" filterable style="width: 100%">
            <el-option v-for="s in sups" :key="s.id" :label="s.full_name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="交货日期"><el-date-picker v-model="poDlg.deliveryDate" value-format="YYYY-MM-DD" /></el-form-item>
        <el-form-item label="付款方式">
          <el-select v-model="poDlg.payMethod" style="width: 100%">
            <el-option v-for="p in payMethods" :key="p" :label="p" :value="p" />
          </el-select>
        </el-form-item>
      </el-form>
      <el-table :data="poDlg.lines" size="small" border>
        <el-table-column prop="material_name" label="物料" />
        <el-table-column label="采购单价" width="140">
          <template #default="{ row }"><el-input-number v-model="row.unitPrice" :min="0.01" :step="0.01" /></template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="poDlg.visible = false">取消</el-button>
        <el-button type="primary" @click="createPo">确定</el-button>
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
const mats = ref([]);
const sups = ref([]);
const payMethods = ref(['现结', '月结', '批结']);
const q = reactive({ status: '' });

const dlg = reactive({
  visible: false,
  id: null,
  form: { deptName: '', needDate: '', lines: [] },
});
const viewDlg = reactive({ visible: false, data: null });
const poDlg = reactive({
  visible: false,
  requestId: null,
  supplierId: null,
  deliveryDate: '',
  payMethod: '月结',
  lines: [],
});

function stText(s) {
  const m = { draft: '草稿', pending_approval: '待审核', approved: '已通过', rejected: '已驳回' };
  return m[s] || s;
}

async function load() {
  loading.value = true;
  try {
    list.value = await http.get('/api/purchase-requests', { params: q });
  } finally {
    loading.value = false;
  }
}

function addLine() {
  dlg.form.lines.push({
    _matId: null,
    materialId: null,
    materialName: '',
    spec: '',
    qty: 1,
    estUnitPrice: 0,
    purposeRemark: '',
  });
}
function onPickMat(row) {
  const m = mats.value.find((x) => x.id === row._matId);
  if (m) {
    row.materialId = m.id;
    row.materialName = m.name;
    row.spec = m.spec;
  }
}

function open(row) {
  dlg.id = row?.id || null;
  if (row) {
    http.get(`/api/purchase-requests/${row.id}`).then((d) => {
      dlg.form = {
        deptName: d.dept_name,
        needDate: d.need_date,
        lines: (d.lines || []).map((l) => ({
          _matId: l.material_id,
          materialId: l.material_id,
          materialName: l.material_name,
          spec: l.spec,
          qty: Number(l.qty),
          estUnitPrice: Number(l.est_unit_price),
          purposeRemark: l.purpose_remark,
        })),
      };
      dlg.visible = true;
    });
  } else {
    dlg.form = { deptName: '', needDate: '', lines: [] };
    addLine();
    dlg.visible = true;
  }
}

async function saveDraft() {
  if (!dlg.form.lines.length) return ElMessage.warning('请添加明细');
  const lines = dlg.form.lines.map((l) => ({
    materialId: l.materialId,
    materialName: l.materialName,
    spec: l.spec,
    qty: l.qty,
    estUnitPrice: l.estUnitPrice,
    purposeRemark: l.purposeRemark,
  }));
  const body = { deptName: dlg.form.deptName, needDate: dlg.form.needDate, lines };
  if (dlg.id) await http.put(`/api/purchase-requests/${dlg.id}`, body);
  else await http.post('/api/purchase-requests', body);
  ElMessage.success('已保存草稿');
  dlg.visible = false;
  load();
}

async function submit(row) {
  await http.post(`/api/purchase-requests/${row.id}/submit`);
  ElMessage.success('已提交审核');
  load();
}
async function approve(row) {
  await ElMessageBox.prompt('审核备注（可空）', '通过', { inputValue: '' }).then(async ({ value }) => {
    await http.post(`/api/purchase-requests/${row.id}/approve`, { note: value || '' });
    ElMessage.success('已通过');
    load();
  });
}
async function reject(row) {
  try {
    const { value } = await ElMessageBox.prompt('驳回理由', '驳回');
    if (!value || !String(value).trim()) {
      ElMessage.warning('请填写驳回理由');
      return;
    }
    await http.post(`/api/purchase-requests/${row.id}/reject`, { note: value });
    ElMessage.success('已驳回');
    load();
  } catch {
    /* 取消 */
  }
}
async function copy(row) {
  const d = await http.post(`/api/purchase-requests/${row.id}/copy`);
  ElMessage.success('已复制，单号 ' + d.requestNo);
  load();
}

function view(row) {
  http.get(`/api/purchase-requests/${row.id}`).then((d) => {
    viewDlg.data = d;
    viewDlg.visible = true;
  });
}

async function openPoFrom(data) {
  viewDlg.visible = false;
  poDlg.requestId = data.id;
  poDlg.supplierId = null;
  poDlg.deliveryDate = '';
  poDlg.payMethod = payMethods.value[1] || '月结';
  poDlg.lines = (data.lines || []).map((l) => ({
    requestLineId: l.id,
    material_name: l.material_name,
    unitPrice: Number(l.est_unit_price) || 1,
  }));
  poDlg.visible = true;
}

async function createPo() {
  if (!poDlg.supplierId) return ElMessage.warning('请选择供应商');
  await http.post('/api/purchase-orders/from-request', {
    requestId: poDlg.requestId,
    supplierId: poDlg.supplierId,
    deliveryDate: poDlg.deliveryDate || null,
    payMethod: poDlg.payMethod,
    lines: poDlg.lines.map((l) => ({ requestLineId: l.requestLineId, unitPrice: l.unitPrice })),
  });
  ElMessage.success('采购单已生成');
  poDlg.visible = false;
  load();
}

onMounted(async () => {
  mats.value = await http.get('/api/materials');
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
