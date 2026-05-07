import { createRouter, createWebHashHistory } from 'vue-router';
import { useAuthStore } from '@/store/auth';

const routes = [
  { path: '/login', component: () => import('@/views/Login.vue'), meta: { public: true } },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { roles: ['admin', 'purchaser', 'finance'] },
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', component: () => import('@/views/Dashboard.vue'), meta: { title: '数据看板' } },
      { path: 'suppliers', component: () => import('@/views/Suppliers.vue'), meta: { title: '供应商', roles: ['admin', 'purchaser'] } },
      { path: 'materials', component: () => import('@/views/Materials.vue'), meta: { title: '物料库', roles: ['admin', 'purchaser'] } },
      { path: 'purchase-requests', component: () => import('@/views/PurchaseRequests.vue'), meta: { title: '采购申请', roles: ['admin', 'purchaser'] } },
      { path: 'purchase-orders', component: () => import('@/views/PurchaseOrders.vue'), meta: { title: '采购下单', roles: ['admin', 'purchaser'] } },
      { path: 'receipts', component: () => import('@/views/Receipts.vue'), meta: { title: '收货验收', roles: ['admin', 'purchaser'] } },
      { path: 'stock-in', component: () => import('@/views/StockIn.vue'), meta: { title: '简易入库', roles: ['admin', 'purchaser', 'finance'] } },
      { path: 'reconciliation', component: () => import('@/views/Reconciliation.vue'), meta: { title: '对账', roles: ['admin', 'purchaser', 'finance'] } },
      { path: 'payments', component: () => import('@/views/Payments.vue'), meta: { title: '付款登记', roles: ['admin', 'finance'] } },
      { path: 'payables', component: () => import('@/views/Payables.vue'), meta: { title: '应付台账', roles: ['admin', 'finance', 'purchaser'] } },
      { path: 'users', component: () => import('@/views/Users.vue'), meta: { title: '用户管理', roles: ['admin'] } },
      { path: 'settings', component: () => import('@/views/Settings.vue'), meta: { title: '基础配置', roles: ['admin'] } },
      { path: 'logs', component: () => import('@/views/Logs.vue'), meta: { title: '操作日志', roles: ['admin'] } },
    ],
  },
  { path: '/print/po/:id', component: () => import('@/views/print/PrintPo.vue'), meta: { public: true } },
  { path: '/print/receipt/:id', component: () => import('@/views/print/PrintReceipt.vue'), meta: { public: true } },
  { path: '/print/recon/:no', component: () => import('@/views/print/PrintRecon.vue'), meta: { public: true } },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach(async (to, _from, next) => {
  if (to.meta.public) return next();
  const auth = useAuthStore();
  if (!auth.token) return next('/login');
  if (!auth.user) await auth.fetchMe();
  if (!auth.user) return next('/login');
  const chain = [...to.matched].reverse();
  const need = chain.find((r) => r.meta && r.meta.roles);
  if (need && need.meta.roles && !need.meta.roles.includes(auth.user.role)) {
    return next('/dashboard');
  }
  next();
});

export default router;
