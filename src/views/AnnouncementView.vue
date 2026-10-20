<template>
  <PageWrapper title="公告列表">
    <n-grid cols="1 600:2" :x-gap="8" :y-gap="8">
      <n-grid-item v-for="announce in validAnnouncements" :key="announce.id">
        <n-card class="announcement-card" @click="edit(announce)">
          <n-thing :title="announce.title">
            {{ announce.brief }}
          </n-thing>
        </n-card>
      </n-grid-item>
    </n-grid>

    <template v-if="disabledAnnouncements.length > 0">
      <n-divider>已停用</n-divider>
      <n-grid cols="1 600:2" :x-gap="8" :y-gap="8">
        <n-grid-item v-for="announce in disabledAnnouncements" :key="announce.id">
          <n-card class="announcement-card disabled-card" @click="edit(announce)">
            <n-thing :title="announce.title">
              {{ announce.brief }}
            </n-thing>
          </n-card>
        </n-grid-item>
      </n-grid>
    </template>

    <n-float-button :right="16" :bottom="24" type="primary" :height="56" @click="() => create()"
      style="padding: 0 1.5rem; width: unset;">
      <div style="display: flex; gap: 8px; flex-direction: row; align-items: center; justify-content: center; ">
        <n-icon :size="24">
          <NotificationAddFilled />
        </n-icon>
        <span style="font-size: 0.8rem;">新建公告</span>
      </div>
    </n-float-button>
  </PageWrapper>
</template>

<script setup lang="ts">
import PageWrapper from '@/components/PageWrapper.vue';
import router from '@/router';
import { announcements } from '@/store';
import type API from '@/store/api';
import { computed, onMounted } from 'vue';

import NotificationAddFilled from "@vicons/material/NotificationAddFilled"

const todayStr = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
})()

// An announcement is inactive when it is disabled or expired.
const isActive = (a: API.IAnnouncement) =>
  a.enabled && a.expireDate >= todayStr

const validAnnouncements = computed(() =>
  announcements.list.filter(isActive)
)

const disabledAnnouncements = computed(() =>
  announcements.list.filter(a => !isActive(a))
)

onMounted(async () => {
  await announcements.ensureLoaded();
})

const edit = (target: API.IAnnouncement) => {
  router.push(`/announcement/edit/${target.id}`);
}

const create = () => {
  router.push('/announcement/edit/0');
}
</script>

<style scoped>
.announcement-card {
  cursor: pointer;
}

.disabled-card {
  opacity: 0.6;
}
</style>
