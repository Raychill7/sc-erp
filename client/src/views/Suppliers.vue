<template>
  <div class="page">
    <el-form :inline="true" class="toolbar">
      <el-form-item label="等级">
        <el-select v-model="q.level" clearable placeholder="全部" style="width: 120px">
          <el-option label="优质" value="premium" />
          <el-option label="合格" value="qualified" />
          <el-option label="待考核" value="pending" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="q.status" clearable placeholder="全部" style="width: 100px">
          <el-option label="启用" value="1" />
          <el-option label="禁用" value="0" />
        </el-select>
      </el-form-item>
      <el-form-item label="关键词">
        <el-input v-model="q.keyword" clearable placeholder="名称/主营/联系人" />
      </el-form-item>
      <el-button type="primary" @click="load">查询</el-button>
      <el-button type="success" @click="openEdit()">新增供应商</el-button>
    </el-form>

    <el-table :data="list" border stripe v-loading="loading">
      <el-table-column prop="full_name" label="全称" min-width="160" />
      <el-table-column prop="contact_name" label="联系人" width="100" />
      <el-table-column prop="contact_phone" label="电话" width="120" />
      <el-table-column prop="main_materials" label="主营物料" min-width="120" show-overflow-tooltip />
      <el-table-column label="等级" width="90">
        <template #default="{ row }">{{ levelText(row.coop_level) }}</template>
      </el-table-column>
      <el-table-column prop="payment_terms_days" label="账期(天)" width="90" />
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status ? 'success' : 'info'">{{ row.status ? '启用' : '禁用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openLedger(row)">台账</el-button>
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="remove(row)" v-if="isAdmin">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dlg.visible" :title="dlg.id ? '编辑供应商' : '新增供应商'" width="640px" destroy-on-close>
      <el-form :model="dlg.form" label-width="110px">
        <el-form-item label="全称" required><el-input v-model="dlg.form.fullName" /></el-form-item>
        <el-form-item label="联系人"><el-input v-model="dlg.form.contactName" /></el-form-item>
        <el-form-item label="电话"><el-input v-model="dlg.form.contactPhone" /></el-form-item>
        <el-form-item label="地址"><el-input v-model="dlg.form.address" type="textarea" rows="2" /></el-form-item>
        <el-form-item label="主营物料"><el-input v-model="dlg.form.mainMaterials" /></el-form-item>
        <el-form-item label="合作等级">
          <el-select v-model="dlg.form.coopLevel" style="width: 100%">
            <el-option label="优质" value="premium" />
            <el-option label="合格" value="qualified" />
            <el-option label="待考核" value="pending" />
          </el-select>
        </el-form-item>
        <el-form-item label="付款账期(天)"><el-input-number v-model="dlg.form.paymentTermsDays" :min="0" /></el-form-item>
        <el-form-item label="营业执照">
          <el-upload :http-request="doUpload" :show-file-list="false" accept=".pdf,.jpg,.jpeg,.png">
            <el-button>上传</el-button>
          </el-upload>
          <span class="filehint">{{ dlg.form.licenseFile }}</span>
        </el-form-item>
        <el-form-item label="开户许可证">
          <el-upload :http-request="doUploadBank" :show-file-list="false" accept=".pdf,.jpg,.jpeg,.png">
            <el-button>上传</el-button>
          </el-upload>
          <span class="filehint">{{ dlg.form.bankPermitFile }}</span>
        </el-form-item>
        <el-form-item label="启用"><el-switch v-model="dlg.form.status" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dlg.visible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="ledger.visible" title="合作台账" size="50%">
      <el-tabs>
        <el-tab-pane label="采购单" name="po">
          <el-table :data="ledger.orders" size="small">
            <el-table-column prop="order_no" label="单号" />
            <el-table-column prop="status" label="状态" />
            <el-table-column prop="total_amount" label="金额" />
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="收货" name="rc">
          <el-table :data="ledger.receipts" size="small">
            <el-table-column prop="receipt_no" label="收货单" />
            <el-table-column prop="receive_date" label="日期" />
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="付款" name="pay">
          <el-table :data="ledger.payments" size="small">
            <el-table-column prop="pay_date" label="日期" />
            <el-table-column prop="amount" label="金额" />
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, reactive, ref, onMounted } from 'vue';
import http from '@/api/http';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useAuthStore } from '@/store/auth';
import axios from 'axios';

const auth = useAuthStore();
const isAdmin = computed(() => auth.user?.role === 'admin');
const loading = ref(false);
const list = ref([]);
const q = reactive({ level: '', status: '', keyword: '' });

const dlg = reactive({
  visible: false,
  id: null,
  form: {
    fullName: '',
    contactName: '',
    contactPhone: '',
    address: '',
    mainMaterials: '',
    coopLevel: 'qualified',
    paymentTermsDays: 30,
    licenseFile: '',
    bankPermitFile: '',
    status: true,
  },
});

const ledger = reactive({ visible: false, orders: [], receipts: [], payments: [] });

function levelText(l) {
  const m = { premium: '优质', qualified: '合格', pending: '待考核' };
  return m[l] || l;
}

async function load() {
  loading.value = true;
  try {
    list.value = await http.get('/api/suppliers', { params: q });
  } finally {
    loading.value = false;
  }
}

function openEdit(row) {
  dlg.id = row?.id || null;
  dlg.form = row
    ? {
        fullName: row.full_name,
        contactName: row.contact_name,
        contactPhone: row.contact_phone,
        address: row.address,
        mainMaterials: row.main_materials,
        coopLevel: row.coop_level,
        paymentTermsDays: row.payment_terms_days,
        licenseFile: row.license_file,
        bankPermitFile: row.bank_permit_file,
        status: !!row.status,
      }
    : {
        fullName: '',
        contactName: '',
        contactPhone: '',
        address: '',
        mainMaterials: '',
        coopLevel: 'qualified',
        paymentTermsDays: 30,
        licenseFile: '',
        bankPermitFile: '',
        status: true,
      };
  dlg.visible = true;
}

async function save() {
  if (!dlg.form.fullName) return ElMessage.warning('请填写全称');
  const body = { ...dlg.form };
  if (dlg.id) await http.put(`/api/suppliers/${dlg.id}`, body);
  else await http.post('/api/suppliers', body);
  ElMessage.success('已保存');
  dlg.visible = false;
  load();
}

async function remove(row) {
  await ElMessageBox.confirm('确定删除该供应商？', '提示');
  await http.delete(`/api/suppliers/${row.id}`);
  ElMessage.success('已删除');
  load();
}

async function openLedger(row) {
  ledger.visible = true;
  const data = await http.get(`/api/suppliers/${row.id}/ledger`);
  ledger.orders = data.orders;
  ledger.receipts = data.receipts;
  ledger.payments = data.payments;
}

async function doUpload(opt) {
  const fd = new FormData();
  fd.append('file', opt.file);
  const res = await axios.post('/api/upload', fd, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  dlg.form.licenseFile = res.data.url;
  ElMessage.success('上传成功');
}
async function doUploadBank(opt) {
  const fd = new FormData();
  fd.append('file', opt.file);
  const res = await axios.post('/api/upload', fd, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  dlg.form.bankPermitFile = res.data.url;
  ElMessage.success('上传成功');
}

onMounted(load);
</script>

<style scoped>
.toolbar {
  margin-bottom: 12px;
}
.filehint {
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
}
</style>
