<template>
  <PageWrapper title="公告列表">
    <n-grid cols="1 600:2" :x-gap="8" :y-gap="8">
      <n-grid-item v-for="announce in store.announcementList" :key="announce.id">
        <n-card @click="() => edit(announce)">
          <n-thing :title="announce.title">
            {{ announce.brief }}
          </n-thing>
        </n-card>
      </n-grid-item>
    </n-grid>

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
import store, { load } from '@/store';
import type API from '@/store/api';
import { onMounted } from 'vue';

import NotificationAddFilled from "@vicons/material/NotificationAddFilled"

onMounted(async () => {
  if (!store.announcementList.length) {
    await load();
  }
})

const edit = (target: API.IAnnouncement) => {
  router.push(`/announcement/edit/${target.id}`);
}

const create = () => {
  router.push('/announcement/edit/0');
}
</script>
