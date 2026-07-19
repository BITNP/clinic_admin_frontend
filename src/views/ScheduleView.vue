<template>
  <PageWrapper title="服务时间管理">
    <div v-if="Object.keys(dateGroup.groups).length > 0">
      <n-tabs animated>
        <n-tab-pane v-for="(items, date) in dateGroup.groups" :name="date" :tab="date" :key="date">
          <n-grid cols="1 600:2" :x-gap="8" :y-gap="8">
            <n-grid-item v-for="item in items" :key="item.id">
              <n-card>
                <n-thing :title="roomName(item.room_id)" :title-extra="item.title"
                  :description="`${formatTime(item.startTime)} - ${formatTime(item.endTime)}`">
                  <n-space justify="space-between">
                    <n-space>
                      <n-button size="small" secondary>
                        {{ `容量 ${item.capacity}` }}
                      </n-button>
                    </n-space>
                    <n-dropdown trigger="hover" :options="options" @select="(key: string) => handleSelect(key, item)">
                      <n-button size="small">
                        操作
                      </n-button>
                    </n-dropdown>
                  </n-space>
                </n-thing>
              </n-card>
            </n-grid-item>
          </n-grid>
        </n-tab-pane>
      </n-tabs>
    </div>
    <n-empty v-else />
  </PageWrapper>
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
import type API from "@/store/api";
import store, { load } from "@/store";
import { onMounted, reactive, h } from 'vue';
import type { Component } from 'vue';
import { NIcon, useDialog, useMessage } from 'naive-ui';
import PlaylistAddFilled from '@vicons/material/PlaylistAddFilled';
import { useRouter } from 'vue-router';
import EditFilled from '@vicons/material/EditFilled';
import DeleteFilled from '@vicons/material/DeleteFilled';
import PageWrapper from '@/components/PageWrapper.vue';

const router = useRouter();

const dateGroup = reactive({
  groups: {} as { [k: string]: API.ServiceDate[] }
});

const formatTime = (iso: string) => {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

const formatDate = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
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
})

const renderIcon = (icon: Component) => {
  return () => {
    return h(NIcon, null, {
      default: () => h(icon)
    })
  }
}

const options = [
  {
    label: "编辑",
    key: "edit",
    icon: renderIcon(EditFilled)
  },
  {
    label: "删除",
    key: "delete",
    icon: renderIcon(DeleteFilled)
  }
]

const dialog = useDialog();
const message = useMessage();

const handleSelect = (key: string, item: API.ServiceDate) => {
  if (key === "delete") {
    dialog.warning({
      title: '警告',
      content: '确定删除吗？',
      positiveText: '确定',
      negativeText: '不确定',
      onPositiveClick: async () => {
        await Api.delete(`/api/admin/service-dates/${item.id}`);
        message.success('已删除')
      },
      onNegativeClick: () => { }
    })
  }
  if (key === "edit") {
    router.push(`/schedule/${item.id}`);
  }
}
</script>
