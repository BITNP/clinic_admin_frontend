<template>
  <PageWrapper title="编辑公告">
    <n-form-item label="标题" required>
      <n-input v-model:value="form.title" placeholder="标题" />
    </n-form-item>
    <n-form-item label="简介" required>
      <n-input v-model:value="form.brief" placeholder="简介" />
    </n-form-item>
    <n-grid cols="1 600:2" :x-gap="8" :y-gap="8">
      <n-grid-item>
        <n-form-item label="标签" requried>
          <n-select v-model:value="form.tag" :options="selections" placeholder="类型" />
        </n-form-item>
      </n-grid-item>
      <n-grid-item>
        <n-form-item label="优先级" requried>
          <n-input-number v-model:value="form.priority" placeholder="类型" />
        </n-form-item>
      </n-grid-item>
      <n-grid-item>
        <n-form-item label="过期日期" required>
          <n-date-picker v-model:value="expireDateTimestamp" type="date" style="width: 100%"
            :is-date-disabled="isDateDisabled" />
        </n-form-item>
      </n-grid-item>
    </n-grid>

    <n-form-item label="公告正文">
      <n-card content-style="padding: 1rem">
        <MilkdownProvider v-if="ready">
          <MilkdownEditor v-model:value="txt" :ctx="form.content"
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
import { computed, onMounted, reactive, ref } from 'vue';

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

const formatDate = (date: Date): API.DateString => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const defaultAnnouncement: API.IAnnouncement = {
  id: 0,
  title: "",
  brief: "",
  content: "",
  tag: "normal",
  priority: 0,
  createdTime: "",
  lastEditedTime: "",
  expireDate: (() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return formatDate(d)
  })()
};

const ctx = computed<API.IAnnouncement>(() =>
  store.announcementList.find((item) => item.id === parseInt(props.announcementId))
    ?? defaultAnnouncement
);

const ctxIdx = computed(() => store.announcementList.findIndex((item) => item.id === parseInt(props.announcementId)))

const form = reactive<API.IAnnouncement>({ ...defaultAnnouncement });
const txt = ref<string>('');
const unsaved = ref<boolean>(false);
const ready = ref<boolean>(false);

const expireDateTimestamp = computed({
  get: () => {
    if (!form.expireDate) return null
    const d = new Date(form.expireDate)
    return d.getTime()
  },
  set: (val: number | null) => {
    if (val === null) {
      form.expireDate = ''
      return
    }
    const d = new Date(val)
    form.expireDate = formatDate(d)
  }
})

const isDateDisabled = (timestamp: number) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return timestamp < today.getTime()
}

const tags: [string, API.AnnouncementTags][] = [
  ["普通公告", "normal"],
  ["置顶公告", "pinned"],
  ["免责声明", "tos"]
];

const selections = tags.map(([label, value]) => { return { label, value } });

const loading = ref<"loading" | "success" | "error">("loading");

const handleSave = async () => {
  const data: API.IAnnouncement = {
    ...form,
    content: txt.value
  };
  console.debug(data);

  if (!data.title || !data.brief || !data.content) {
    message.error("请填写完整");
    return;
  }

  try {
    const saved = await commit(data);
    message.success("保存成功");
    if (isCreate.value) {
      store.announcementList.push(saved ?? data);
    } else {
      store.announcementList[ctxIdx.value] = saved ?? data;
    }
    router.back()
  }
  catch (e) {
    console.error(e);
    message.error("保存失败");
  }
}

const commit = async (data: API.IAnnouncement) => {
  const payload: Partial<API.IAnnouncement> = { ...data }
  delete (payload as any).id
  delete payload.createdTime
  delete payload.lastEditedTime

  if (isCreate.value) {
    const res = await Api.post<API.IAnnouncement>('/api/admin/announcements', payload)
    return res.data
  }
  else {
    const res = await Api.put<API.IAnnouncement>(`/api/admin/announcements/${props.announcementId}`, payload)
    return res.data
  }
}

onMounted(async () => {
  if (!store.announcementList.length) {
    await load();
  }
  loading.value = "success";
  Object.assign(form, ctx.value);
  txt.value = ctx.value.content;
  ready.value = true;
})
</script>
