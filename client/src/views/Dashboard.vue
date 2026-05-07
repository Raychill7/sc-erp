<template>
  <div class="page">
    <el-row :gutter="16" class="mb">
      <el-col :span="8">
        <el-card shadow="never"><div class="k">采购单完成率</div><div class="v">{{ stats.completionRate }}%</div></el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never"><div class="k">周期内采购单数</div><div class="v">{{ stats.totalOrders }}</div></el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never">
          <div class="k">统计周期</div>
          <el-radio-group v-model="range" size="small" @change="load">
            <el-radio-button label="day">近30日</el-radio-button>
            <el-radio-button label="month">近12月</el-radio-button>
            <el-radio-button label="quarter">季度视角</el-radio-button>
          </el-radio-group>
        </el-card>
      </el-col>
    </el-row>
    <el-row :gutter="16">
      <el-col :span="14">
        <el-card header="采购金额趋势"><div ref="lineRef" class="chart"></div></el-card>
      </el-col>
      <el-col :span="10">
        <el-card header="供应商采购占比（TOP10）"><div ref="pieRef" class="chart"></div></el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, reactive, ref, watch, nextTick } from 'vue';
import * as echarts from 'echarts';
import http from '@/api/http';

const range = ref('month');
const stats = reactive({ completionRate: 0, totalOrders: 0, completedOrders: 0 });
const lineRef = ref();
const pieRef = ref();
let lineChart;
let pieChart;

async function load() {
  const data = await http.get('/api/stats/dashboard', { params: { range: range.value } });
  stats.completionRate = data.completionRate;
  stats.totalOrders = data.totalOrders;
  stats.completedOrders = data.completedOrders;

  const lineData = (data.amountTrend || []).map((d) => [d.d, Number(d.amt)]);
  if (!lineChart && lineRef.value) lineChart = echarts.init(lineRef.value);
  lineChart?.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: lineData.map((x) => x[0]) },
    yAxis: { type: 'value' },
    series: [{ type: 'line', smooth: true, data: lineData.map((x) => x[1]), areaStyle: {} }],
  });

  const pieData = (data.supplierShare || []).map((d) => ({ name: d.name, value: Number(d.value) }));
  if (!pieChart && pieRef.value) pieChart = echarts.init(pieRef.value);
  pieChart?.setOption({
    tooltip: { trigger: 'item' },
    series: [{ type: 'pie', radius: '65%', data: pieData }],
  });
}

onMounted(() => nextTick(load));
watch(range, load);
onUnmounted(() => {
  lineChart?.dispose();
  pieChart?.dispose();
});
</script>

<style scoped>
.page {
  padding: 0;
}
.mb {
  margin-bottom: 16px;
}
.chart {
  height: 320px;
}
.k {
  color: #909399;
  font-size: 13px;
}
.v {
  font-size: 26px;
  font-weight: 600;
  margin-top: 8px;
}
</style>
