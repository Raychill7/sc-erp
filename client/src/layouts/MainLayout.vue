<template>
  <el-container class="layout">
    <el-aside width="220px" class="aside">
      <div class="brand">采购 P2P ERP</div>
      <el-menu :default-active="active" router background-color="#1f2d3d" text-color="#bfcbd9" active-text-color="#409eff">
        <el-menu-item index="/dashboard"><el-icon><Odometer /></el-icon>数据看板</el-menu-item>
        <el-menu-item v-if="show(['admin','purchaser'])" index="/suppliers"><el-icon><OfficeBuilding /></el-icon>供应商</el-menu-item>
        <el-menu-item v-if="show(['admin','purchaser'])" index="/materials"><el-icon><Goods /></el-icon>物料库</el-menu-item>
        <el-menu-item v-if="show(['admin','purchaser'])" index="/purchase-requests"><el-icon><Document /></el-icon>采购申请</el-menu-item>
        <el-menu-item v-if="show(['admin','purchaser'])" index="/purchase-orders"><el-icon><ShoppingCart /></el-icon>采购下单</el-menu-item>
        <el-menu-item v-if="show(['admin','purchaser'])" index="/receipts"><el-icon><Box /></el-icon>收货验收</el-menu-item>
        <el-menu-item v-if="show(['admin','purchaser','finance'])" index="/stock-in"><el-icon><Files /></el-icon>简易入库</el-menu-item>
        <el-menu-item v-if="show(['admin','purchaser','finance'])" index="/reconciliation"><el-icon><Notebook /></el-icon>对账</el-menu-item>
        <el-menu-item v-if="show(['admin','finance'])" index="/payments"><el-icon><Wallet /></el-icon>付款登记</el-menu-item>
        <el-menu-item v-if="show(['admin','finance','purchaser'])" index="/payables"><el-icon><Coin /></el-icon>应付台账</el-menu-item>
        <el-menu-item v-if="show(['admin'])" index="/users"><el-icon><User /></el-icon>用户管理</el-menu-item>
        <el-menu-item v-if="show(['admin'])" index="/settings"><el-icon><Setting /></el-icon>基础配置</el-menu-item>
        <el-menu-item v-if="show(['admin'])" index="/logs"><el-icon><Memo /></el-icon>操作日志</el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <span>{{ title }}</span>
        <div class="right">
          <span class="uname">{{ user?.name }}（{{ roleLabel(user?.role) }}）</span>
          <el-button type="primary" link @click="onLogout">退出</el-button>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const user = computed(() => auth.user);
const active = computed(() => route.path);
const title = computed(() => route.meta.title || '');

function show(roles) {
  return roles.includes(auth.user?.role);
}
function roleLabel(r) {
  if (r === 'admin') return '管理员';
  if (r === 'purchaser') return '采购员';
  if (r === 'finance') return '财务';
  return r || '';
}
function onLogout() {
  auth.logout();
  router.push('/login');
}
</script>

<style scoped>
.layout {
  height: 100%;
}
.aside {
  background: #1f2d3d;
  color: #fff;
}
.brand {
  padding: 16px;
  font-weight: 600;
  font-size: 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #ebeef5;
  background: #fff;
}
.main {
  background: #f5f7fa;
}
.right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.uname {
  color: #606266;
  font-size: 13px;
}
</style>
