<template>
  <PageWrapper title="编辑公告">
    <n-form-item label="标题" required>
      <n-input v-model:value="ctx!.title" placeholder="标题" />
    </n-form-item>
    <n-form-item label="简介" required>
      <n-input v-model:value="ctx!.brief" placeholder="简介" />
    </n-form-item>
    <n-grid cols="1 600:2" :x-gap="8" :y-gap="8">
      <n-grid-item>
        <n-form-item label="标签" requried>
          <n-select v-model:value="ctx!.tag" :options="selections" placeholder="类型" />
        </n-form-item>
      </n-grid-item>
      <n-grid-item>
        <n-form-item label="优先级" requried>
          <n-input-number v-model:value="ctx!.priority" placeholder="类型" />
        </n-form-item>
      </n-grid-item>
    </n-grid>

    <n-form-item label="公告正文">
      <n-card content-style="padding: 1rem">
        <MilkdownProvider>
          <MilkdownEditor v-model:value="txt" :ctx="ctx?.content ?? ''"
            @update="() => { console.debug('changed'); unsaved = true }" />
        </MilkdownProvider>
      </n-card>
    </n-form-item>
    <n-float-button :right="16" :bottom="24" type="primary" :height="56" @click="() => handleSave()"
      style="padding: 0 1.5rem; width: unset;">
      <div style="display: flex; gap: 8px; flex-direction: row; align-items: center; justify-content: center; ">
        <n-icon :size="24">
          <SaveFilled />
        </n-icon>
        <span style="font-size: 0.8rem;">保存</span>
      </div>
    </n-float-button>
  </PageWrapper>
</template>

<script setup lang="ts">
import MilkdownEditor from '@/components/MilkdownEditor.vue';
import store, { load } from '@/store';
import type API from '@/store/api';
import { MilkdownProvider } from '@milkdown/vue';
import { computed, onMounted, ref } from 'vue';

import SaveFilled from '@vicons/material/SaveFilled';
import PageWrapper from '@/components/PageWrapper.vue';
import Api from '@/utils/Api';
import { useMessage } from 'naive-ui';
import { useRouter } from 'vue-router';

const router = useRouter();
const message = useMessage()

const props = defineProps({
  announcementId: {
    type: String,
    required: true
  }
})

const isCreate = computed(() => props.announcementId === "0");

const ctx = computed<API.IAnnouncement>(() => {
  const date = new Date();
  return store.announcementList.find((item) => item.id === parseInt(props.announcementId))
    ?? {
      id: 0,
      title: "",
      brief: "",
      content: "",
      tag: "normal",
      priority: 0,
      createdTime: "",
      lastEditedTime: "",
      expireDate: `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}` as API.DateString
    };
})

const ctxIdx = computed(() => store.announcementList.findIndex((item) => item.id === parseInt(props.announcementId)))

const txt = ref<string>('');
const unsaved = ref<boolean>(false);

const tags: [string, API.AnnouncementTags][] = [
  ["普通公告", "normal"],
  ["置顶公告", "pinned"],
  ["免责声明", "tos"]
];

const selections = tags.map(([label, value]) => { return { label, value } });

const loading = ref<"loading" | "success" | "error">("loading");

const handleSave = async () => {
  const data: API.IAnnouncement = {
    ...ctx.value!,
    content: txt.value
  };
  console.debug(data);

  if (!data.title || !data.brief || !data.content) {
    message.error("请填写完整");
    return;
  }

  try {
    await commit(data);
    message.success("保存成功");
    store.announcementList[ctxIdx.value] = data;
    router.back()
  }
  catch (e) {
    console.error(e);
    message.error("保存失败");
  }
}

const commit = async (data: API.IAnnouncement) => {
  if (isCreate.value) {
    const payload: Partial<API.IAnnouncement> = { ...data }
    delete (payload as any).id
    delete payload.createdTime
    delete payload.lastEditedTime
    await Api.post<API.IAnnouncement>('/api/admin/announcements', payload)
  }
  else {
    const payload: Partial<API.IAnnouncement> = { ...data }
    delete (payload as any).id
    delete payload.createdTime
    delete payload.lastEditedTime
    await Api.put<API.IAnnouncement>(`/api/admin/announcements/${props.announcementId}`, payload)
  }
}

onMounted(async () => {
  if (!store.announcementList.length) {
    await load();
  }
  loading.value = "success";
  txt.value = ctx.value!.content;
})
</script>
