<template>
  <PageWrapper title="服务时间管理">
    <div v-if="Object.keys(dateGroup.groups).length > 0">
      <div v-for="date in sortedDateKeys" :key="date" class="date-section">
        <div class="date-header">
          {{ date }}<span class="weekday">{{ formatWeekday(date) }}</span>
        </div>
        <div class="schedule-list">
          <div v-for="item in dateGroup.groups[date]" :key="item.id" class="schedule-row">
            <span class="room-name">{{ roomName(item.room_id) }}</span>
            <span class="service-info">{{ item.title }}<span class="time">{{ formatTime(item.startTime) }} - {{ formatTime(item.endTime) }}</span></span>
            <span class="count">{{ item.count }}/{{ item.capacity }}</span>
            <span class="actions">
              <n-button size="small" @click="handleEdit(item)">编辑服务</n-button>
              <n-button size="small" @click="handleDelete(item)">删除</n-button>
            </span>
          </div>
        </div>
      </div>
    </div>
    <n-empty v-else />
  </PageWrapper>
  <n-float-button :right="16" :bottom="96" type="primary" :width="144" :height="56"
    @click="() => router.push('/schedule/next-week')">
    <div style="display: flex; gap: 8px; flex-direction: row; align-items: center; justify-content: center; ">
      <n-icon :size="24">
        <PlaylistAddFilled />
      </n-icon>
      <span style="font-size: 0.8rem;">生成下周时间</span>
    </div>
  </n-float-button>
  <n-float-button :right="16" :bottom="24" type="primary" :width="144" :height="56"
    @click="() => router.push('/schedule/add')">
    <div style="display: flex; gap: 8px; flex-direction: row; align-items: center; justify-content: center; ">
      <n-icon :size="24">
        <PlaylistAddFilled />
      </n-icon>
      <span style="font-size: 0.8rem;">新建服务时间</span>
    </div>
  </n-float-button>
</template>

<script lang="ts" setup>
import Api from '@/utils/Api';
import { AxiosError } from 'axios';
import type API from "@/store/api";
import store, { load } from "@/store";
import { onMounted, reactive, computed } from 'vue';
import { useDialog, useMessage } from 'naive-ui';
import PlaylistAddFilled from '@vicons/material/PlaylistAddFilled';
import { useRouter } from 'vue-router';
import PageWrapper from '@/components/PageWrapper.vue';

const router = useRouter();

const dateGroup = reactive({
  groups: {} as { [k: string]: API.ServiceDate[] }
});

const sortedDateKeys = computed(() => {
  return Object.keys(dateGroup.groups).sort()
})

const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const formatTime = (iso: string) => {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

const formatDate = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
}

const formatWeekday = (iso: string) => {
  const d = new Date(iso)
  return weekdays[d.getDay()]
}

const roomName = (roomId: number) => {
  const room = store.campusList.find(r => r.id === roomId)
  return room?.name ?? `校区#${roomId}`
}

onMounted(async () => {
  if (!store.campusList.length) {
    await load();
  }

  const res = await Api.get<{ items: API.ServiceDate[]; total: number; page: number; pageSize: number }>('/api/admin/service-dates');
  store.dateList = res.data.items;

  res.data.items.forEach((item) => {
    const date = formatDate(item.date);
    if (!dateGroup.groups[date]) {
      dateGroup.groups[date] = [];
    }
    dateGroup.groups[date].push(item);
  });

  Object.values(dateGroup.groups).forEach(items => {
    items.sort((a, b) => a.startTime.localeCompare(b.startTime))
  })
})

const dialog = useDialog();
const message = useMessage();

const handleEdit = (item: API.ServiceDate) => {
  router.push(`/schedule/${item.id}`)
}

const handleDelete = (item: API.ServiceDate) => {
  dialog.warning({
    title: '警告',
    content: '确定删除吗？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await Api.delete(`/api/admin/service-dates/${item.id}`);
        message.success('已删除')
      } catch (err) {
        const axiosErr = err as AxiosError
        const data = axiosErr.response?.data as any
        const errorMsg =
          typeof data === 'string'
            ? data
            : (data?.message || data?.error || axiosErr.message || '删除失败')
        message.error(errorMsg)
      }
    },
    onNegativeClick: () => { }
  })
}
</script>

<style scoped>
.date-section {
  margin-bottom: 24px;
}
.date-header {
  font-size: 1.1rem;
  font-weight: 600;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
  margin-bottom: 8px;
}
.weekday {
  font-weight: 400;
  color: #888;
  margin-left: 6px;
}
.schedule-row {
  position: relative;
  display: flex;
  align-items: center;
  padding: 10px 16px;
  gap: 16px;
}
.schedule-row::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 16px;
  right: 16px;
  height: 1px;
  background: #e0e0e0;
}
.schedule-row:last-child::after {
  display: none;
}
.room-name {
  flex: 0 0 120px;
  font-weight: 500;
}
.service-info {
  flex: 1;
}
.time {
  color: #888;
  font-size: 0.9em;
  margin-left: 8px;
}
.count {
  flex: 0 0 auto;
  white-space: nowrap;
}
.actions {
  flex: 0 0 auto;
  display: flex;
  gap: 8px;
}
</style>
