<template>
  <PageWrapper title="服务时间管理">
    <n-space v-if="Object.keys(groups).length > 0" vertical :size="16">
      <n-card
        v-for="date in sortedDateKeys"
        :key="date"
        size="small"
        embedded
        :bordered="false"
      >
        <template #header>
          <div class="date-header">
            <span>{{ date }}</span>
            <n-text depth="3" class="weekday">{{ formatWeekday(date) }}</n-text>
          </div>
        </template>
        <div class="schedule-list">
          <div v-for="item in groups[date]" :key="item.id" class="schedule-row">
            <span class="room-name">{{ roomName(item.room_id) }}</span>
            <span class="service-info">
              {{ item.title }}
              <n-text depth="3" class="time">{{ formatTime(item.startTime) }} - {{ formatTime(item.endTime) }}</n-text>
            </span>
            <span class="count">{{ item.count }}/{{ item.capacity }}</span>
            <span class="actions">
              <n-button size="small" @click="handleEdit(item)">编辑服务</n-button>
              <n-button size="small" @click="handleDelete(item)">删除</n-button>
            </span>
          </div>
        </div>
      </n-card>
    </n-space>
    <n-empty v-else />
  </PageWrapper>
  <n-float-button :right="16" :bottom="96" :width="144" :height="56" type="primary"
    @click="() => router.push('/schedule/next-week')">
    <div class="float-action-inner">
      <n-icon :size="24">
        <PlaylistAddFilled />
      </n-icon>
      <span>生成下周时间</span>
    </div>
  </n-float-button>
  <n-float-button :right="16" :bottom="24" :width="144" :height="56" type="primary"
    @click="() => router.push('/schedule/add')">
    <div class="float-action-inner">
      <n-icon :size="24">
        <PlaylistAddFilled />
      </n-icon>
      <span>新建服务时间</span>
    </div>
  </n-float-button>
</template>

<script lang="ts" setup>
import { AxiosError } from 'axios';
import type API from "@/store/api";
import { rooms, schedule } from "@/store";
import { onMounted, computed } from 'vue';
import { useDialog, useMessage } from 'naive-ui';
import PlaylistAddFilled from '@vicons/material/PlaylistAddFilled';
import { useRouter } from 'vue-router';
import PageWrapper from '@/components/PageWrapper.vue';

const router = useRouter();

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

const groups = computed(() => {
  const result: { [k: string]: API.ServiceDate[] } = {}
  for (const item of schedule.state.list) {
    const date = formatDate(item.date)
    if (!result[date]) {
      result[date] = []
    }
    result[date].push(item)
  }
  Object.values(result).forEach(items => {
    items.sort((a, b) => a.startTime.localeCompare(b.startTime))
  })
  return result
})

const sortedDateKeys = computed(() => {
  return Object.keys(groups.value).sort()
})

const roomName = (roomId: number) => {
  const room = rooms.state.list.find(r => r.id === roomId)
  return room?.name ?? `校区#${roomId}`
}

onMounted(async () => {
  await rooms.ensureLoaded()
  await schedule.ensureLoaded()
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
        await schedule.remove(item.id);
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
.date-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 1.05rem;
  font-weight: 600;
}
.weekday {
  font-weight: 400;
  font-size: 0.95rem;
}
.schedule-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.schedule-row {
  display: grid;
  grid-template-columns: minmax(120px, 180px) minmax(0, 1fr) auto auto;
  align-items: center;
  padding: 8px 12px;
  gap: 8px 16px;
  border-radius: 4px;
  background-color: var(--n-color, rgba(255, 255, 255, 0.04));
}
.room-name {
  font-weight: 500;
}
.service-info {
  min-width: 0;
  overflow-wrap: anywhere;
}
.time {
  font-size: 0.9em;
  margin-left: 8px;
  font-variant-numeric: tabular-nums;
}
.count {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}
.float-action-inner {
  display: flex;
  gap: 8px;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}
.float-action-inner span {
  font-size: 0.8rem;
}
@media screen and (max-width: 600px) {
  .schedule-row {
    grid-template-columns: 1fr auto;
  }
  .room-name {
    grid-column: 1 / -1;
  }
  .actions {
    grid-column: 1 / -1;
    justify-content: flex-end;
  }
  .float-action-inner span {
    font-size: 0.75rem;
  }
}
</style>
