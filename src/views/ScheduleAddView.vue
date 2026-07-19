<template>
  <PageWrapper title="新建服务时间">
    <n-form :model="formValue" :rules="formRule" ref="formRef">
      <n-grid cols="18 800:22" :x-gap="22">
        <n-form-item-gi :span="8" label="服务描述" path="title">
          <n-input v-model:value="formValue.title" placeholder="描述" />
        </n-form-item-gi>
        <n-form-item-gi :span="8" label="选择校区" path="room_id">
          <n-select v-model:value="formValue.room_id" :options="campuses" placeholder="校区" />
        </n-form-item-gi>
        <n-form-item-gi :span="6" label="设置容量" path="capacity">
          <n-input-number v-model:value="formValue.capacity" placeholder="容量" />
        </n-form-item-gi>
        <n-form-item-gi span="12 500:0"></n-form-item-gi>
        <n-form-item-gi :span="6" label="开始时间" path="startTime">
          <n-time-picker v-model:value="formValue.startTime" placeholder="开始时间" style="width: 100%" />
        </n-form-item-gi>
        <n-form-item-gi :span="6" label="结束时间" path="endTime">
          <n-time-picker v-model:value="formValue.endTime" placeholder="结束时间" style="width: 100%" />
        </n-form-item-gi>
        <n-form-item-gi span="4 800:2" label="日期多选" path="dateMulti">
          <n-switch v-model:value="formValue.dateMulti"></n-switch>
        </n-form-item-gi>
        <n-form-item-gi span="12 800:8" label="日期">
          <n-date-picker v-if="!formValue.dateMulti" v-model:value="formValue.date.date" placeholder="日期"
            style="width: 100%" :is-date-disabled="isDateDisabled" />
          <n-date-picker v-else update-value-on-close bind-calendar-months :actions="['clear']"
            v-model:value="formValue.date.dateList" type="daterange" placeholder="日期" style="width: 100%"
            :is-date-disabled="isDateDisabled" />
        </n-form-item-gi>
      </n-grid>
      <n-form-item>
        <n-space>
          <n-button type="primary" @click="handleSubmit" style="width: 150px" :loading="loading">提交</n-button>
          <n-button @click="() => router.back()">返回</n-button>
        </n-space>
      </n-form-item>
    </n-form>
  </PageWrapper>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, reactive } from 'vue';
import store, { load } from "@/store";
import type { FormInst } from "naive-ui";
import { useRouter } from 'vue-router';
import Api from "@/utils/Api";
import { useMessage } from 'naive-ui';
import Auth from "@/utils/Auth";
import PageWrapper from '@/components/PageWrapper.vue';

const router = useRouter();
const message = useMessage();
const loading = ref<boolean>(false)

const formRef = ref<FormInst | null>();

const toRFC3339 = (dateMs: number, timeMs?: number) => {
  const d = new Date(dateMs)
  if (timeMs !== undefined) {
    const t = new Date(timeMs)
    d.setHours(t.getHours(), t.getMinutes(), t.getSeconds(), 0)
  }
  return d.toISOString()
}

const toDateStr = (dateMs: number) => {
  const d = new Date(dateMs)
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
}

const datesUnavailable = computed(() => store.dateList.reduce((acc, date) => {
  const key = date.room_id
  if (!acc.has(key)) {
    acc.set(key, [])
  }
  acc.get(key)?.push(date.date.slice(0, 10))
  return acc
}, new Map<number, string[]>()))

const isDateDisabled = (current: number) => {
  const key = toDateStr(current)
  return datesUnavailable.value.has(formValue.room_id!) &&
    datesUnavailable.value.get(formValue.room_id!)?.includes(key)
}

const campuses = computed(() => store.campusList.map((item) => {
  return {
    label: item.name,
    value: item.id
  }
}))

const defaultCampus = computed(() => {
  // no longer have user.campus; default to first campus or null
  return store.campusList[0]?.id ?? null
})

const formValue = reactive({
  title: "正常服务",
  room_id: defaultCampus.value as number | null,
  capacity: 15,
  startTime: (new Date()).setHours(18, 30, 0, 0),
  endTime: (new Date()).setHours(21, 0, 0, 0),
  dateMulti: false,
  date: {
    date: undefined as number | undefined,
    dateList: undefined as [number, number] | undefined,
  }
})

const formRule = {
  title: { required: true, message: "请输入服务描述", trigger: ["blur"] },
  room_id: { required: true, message: "请选择校区", trigger: ["change"], validator: (rule: any, value: any) => {
    return value !== null && value !== undefined && value !== ''
  } },
  capacity: {
    required: true, message: "请输入容量", trigger: ["blur"], validator: (rule: any, value: number) => {
      if (value < 1) {
        return "哎呀不对不对不对"
      }
      return true
    }
  },
  startTime: {
    required: true, message: "请选择开始时间", trigger: ["change"], validator: (rule: any, value: number) => {
      return value !== 0
    }
  },
  endTime: {
    required: true, message: "请选择结束时间", trigger: ["change"], validator: (rule: any, value: number) => {
      return value !== 0
    }
  }
}

onMounted(async () => {
  if (!store.campusList.length) {
    await load();
  }
  if (formValue.room_id === null) {
    formValue.room_id = defaultCampus.value
  }
  await Auth.auth();
})

const handleSubmit = async () => {
  try {
    await formRef.value?.validate()
  } catch (errors) {
    console.error('validation failed:', errors)
    return
  }

  const results: {
        room_id: number
        capacity: number
        date: string
        startTime: string
        endTime: string
        title: string
      }[] = []

  const base = {
    room_id: formValue.room_id!,
    capacity: formValue.capacity,
    title: formValue.title,
  }

  if (formValue.dateMulti) {
    if (!formValue.date.dateList) return message.error("日期不对喔")
    const [start, end] = formValue.date.dateList
    for (let i = start; i <= end; i += 24 * 60 * 60 * 1000) {
      const dateStr = toRFC3339(i)
      results.push({
        ...base,
        date: dateStr,
        startTime: toRFC3339(i, formValue.startTime),
        endTime: toRFC3339(i, formValue.endTime),
      })
    }
  } else {
    if (!formValue.date.date) return message.error("日期不对喔")
    const dateStr = toRFC3339(formValue.date.date)
    results.push({
      ...base,
      date: dateStr,
      startTime: toRFC3339(formValue.date.date, formValue.startTime),
      endTime: toRFC3339(formValue.date.date, formValue.endTime),
    })
  }

  try {
    loading.value = true
    await Promise.all(results.map((s) => {
      return Api.post('/api/admin/service-dates', s)
    }))
    message.success("提交成功啦")
  } catch (e) {
    message.error("提交失败")
  } finally {
    loading.value = false
  }
}
</script>
