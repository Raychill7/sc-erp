<template>
  <div class="page">
    <el-form label-width="120px" style="max-width: 640px">
      <el-form-item label="企业名称">
        <el-input v-model="form.company_name" />
      </el-form-item>
      <el-form-item label="付款方式">
        <div v-for="(p, i) in form.pay_methods" :key="i" class="row">
          <el-input v-model="form.pay_methods[i]" style="width: 220px" />
          <el-button link type="danger" @click="form.pay_methods.splice(i, 1)">删</el-button>
        </div>
        <el-button size="small" @click="form.pay_methods.push('')">添加</el-button>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="save">保存</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup>
import { reactive, onMounted } from 'vue';
import http from '@/api/http';
import { ElMessage } from 'element-plus';

const form = reactive({
  company_name: '',
  pay_methods: ['现结', '月结', '批结'],
});

async function load() {
  const cfg = await http.get('/api/config');
  if (cfg.company_name != null) form.company_name = cfg.company_name;
  if (Array.isArray(cfg.pay_methods)) form.pay_methods = [...cfg.pay_methods];
}

async function save() {
  await http.put('/api/config', {
    company_name: form.company_name,
    pay_methods: form.pay_methods.filter((x) => x && x.trim()),
  });
  ElMessage.success('已保存');
}

onMounted(load);
</script>

<style scoped>
.row {
  margin-bottom: 6px;
}
</style>
