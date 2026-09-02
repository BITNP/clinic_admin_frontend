<template>
  <PageWrapper title="人员管理">
    <n-space vertical :size="16">
      <n-space :align="'center'">
        <n-input
          v-model:value="searchName"
          placeholder="搜索用户名/姓名"
          clearable
          style="max-width: 240px;"
        />
        <n-button type="primary" @click="applyFilter">
          搜索
        </n-button>
        <n-button @click="resetFilter">
          重置
        </n-button>
      </n-space>
      <n-data-table
        :columns="columns"
        :data="displayData"
        :bordered="false"
        :single-line="false"
        :pagination="{ pageSize: 20 }"
      >
        <template #empty>
          <n-empty description="暂无人员" />
        </template>
      </n-data-table>
    </n-space>
  </PageWrapper>
</template>

<script setup lang="ts">
import PageWrapper from '@/components/PageWrapper.vue'
import Api from '@/utils/Api'
import type API from '@/store/api'
import { ref, computed, onMounted } from 'vue'
import type { DataTableColumn } from 'naive-ui'

interface StaffRow {
  id: number
  用户名: string
  姓名: string
  权限: string
  值班日: string
  处理单量: string
  年份: string
}

const rawData = ref<API.Staff[]>([])
const searchName = ref('')
const activeFilter = ref('')

const columns: DataTableColumn<StaffRow>[] = [
  {
    title: '用户名',
    key: '用户名',
    sorter: (a, b) => a.用户名.localeCompare(b.用户名),
    width: 150,
  },
  {
    title: '姓名',
    key: '姓名',
    sorter: (a, b) => a.姓名.localeCompare(b.姓名),
    width: 150,
  },
  {
    title: '权限',
    key: '权限',
    sorter: (a, b) => a.权限.localeCompare(b.权限),
    width: 100,
  },
  {
    title: '值班日',
    key: '值班日',
    sorter: (a, b) => a.值班日.localeCompare(b.值班日),
    width: 120,
  },
  {
    title: '处理单量',
    key: '处理单量',
    sorter: (a, b) => safeNum(a.处理单量) - safeNum(b.处理单量),
    width: 100,
  },
  {
    title: '年份',
    key: '年份',
    sorter: (a, b) => safeNum(a.年份) - safeNum(b.年份),
    width: 100,
  },
]

const displayData = computed<StaffRow[]>(() => {
  const filter = activeFilter.value.trim().toLowerCase()
  const list = filter
    ? rawData.value.filter(s => {
      const name = `${s.account_id} ${s.realname ?? ''}`.toLowerCase()
      return name.includes(filter)
    })
    : rawData.value
  return list.map(s => ({
    id: s.id,
    用户名: s.account_id,
    姓名: s.realname || '—',
    权限: s.role || '—',
    值班日: '—',
    处理单量: s.handled_count != null ? String(s.handled_count) : '—',
    年份: s.work_years?.length ? s.work_years.join(', ') : '—',
  }))
})

const safeNum = (v: string) => { const n = Number(v); return isNaN(n) ? -1 : n }

const applyFilter = () => {
  activeFilter.value = searchName.value
}

const resetFilter = () => {
  searchName.value = ''
  activeFilter.value = ''
}

onMounted(async () => {
  try {
    const res = await Api.get<{ items: API.Staff[] }>('/api/admin/staff')
    rawData.value = res.data.items
  } catch (e) {
    console.error('Failed to load staff list', e)
  }
})
</script>
