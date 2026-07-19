<template>
  <PageWrapper title="编辑服务时间">
    <n-form :model="formValue" :rules="formRule" ref="formRef">
      <n-grid cols="18 800:22" :x-gap="22">
        <n-form-item-gi :span="8" label="服务描述" path="title">
          <n-input v-model:value="formValue.title" placeholder="描述" />
        </n-form-item-gi>
        <n-form-item-gi :span="8" label="选择校区" path="room_id">
          <n-select v-model:value="formValue.room_id" :options="campuses" placeholder="校区" />
        </n-form-item-gi>
        <n-form-item-gi :span="6" label="设置容量" path="capacity">
          <n-input-number v-model:value="formValue.capacity" placeholder="容量" :min="currentCount" />
        </n-form-item-gi>
        <n-form-item-gi span="12 500:0"></n-form-item-gi>
        <n-form-item-gi :span="6" label="开始时间" path="startTime">
          <n-time-picker v-model:value="formValue.startTime" placeholder="开始时间" style="width: 100%" />
        </n-form-item-gi>
        <n-form-item-gi :span="6" label="结束时间" path="endTime">
          <n-time-picker v-model:value="formValue.endTime" placeholder="结束时间" style="width: 100%" />
        </n-form-item-gi>
        <n-form-item-gi span="12 800:8" label="日期">
          <n-date-picker v-model:value="formValue.date" placeholder="日期" style="width: 100%"
            :is-date-disabled="isDateDisabled" />
        </n-form-item-gi>
      </n-grid>
      <n-form-item>
        <n-button type="primary" @click="handleSubmit" style="width: 150px" :loading="loading">提交</n-button>
      </n-form-item>
    </n-form>
  </PageWrapper>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, reactive } from 'vue';
import store, { load } from "@/store";
import type API from "@/store/api";
import type { FormInst } from "naive-ui";
import Api from "@/utils/Api";
import { useMessage } from 'naive-ui';
import Auth from "@/utils/Auth";

const props = defineProps({
  dateId: {
    type: String,
    required: true
  }
})

const message = useMessage();
const loading = ref<boolean>(false)
const currentCount = ref<number>(0)

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
  acc.get(key)?.push(toDateStr(new Date(date.date).getTime()))
  return acc
}, new Map<number, string[]>()))

const isDateDisabled = (current: number) => {
  if (!formValue) return false
  const key = toDateStr(current)
  return key !== toDateStr(originalValue.date) &&
    datesUnavailable.value.has(formValue.room_id!) &&
    datesUnavailable.value.get(formValue.room_id!)?.includes(key)
}

const campuses = computed(() => store.campusList.map((item) => {
  return {
    label: item.name,
    value: item.id
  }
}))

interface EditForm {
  title: string
  room_id: number | null
  capacity: number
  startTime: number
  endTime: number
  date: number
}

let originalValue: EditForm = {
  title: "",
  room_id: null,
  capacity: 0,
  startTime: 0,
  endTime: 0,
  date: 0,
}
const formValue = reactive<EditForm>(originalValue);

const formRule = {
  title: { required: true, message: "请输入服务描述", trigger: ["blur"] },
  room_id: { required: true, message: "请选择校区", trigger: ["change"], validator: (rule: any, value: any) => {
    return value !== null && value !== undefined && value !== ''
  } },
  capacity: {
    required: true, message: "请输入容量", trigger: ["blur"], validator: (rule: any, value: number) => {
      if (value < currentCount.value) {
        return `容量不能小于当前已预约数 ${currentCount.value}`
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
  await Auth.auth();

  let target = store.dateList.find(d => d.id === parseInt(props.dateId))
  if (!target) {
    const res = await Api.get<API.ServiceDate>(`/api/admin/service-dates/${props.dateId}`)
    target = res.data
  }

  if (target) {
    currentCount.value = target.count
    Object.assign(formValue, {
      title: target.title,
      room_id: target.room_id,
      capacity: target.capacity,
      startTime: new Date(target.startTime).getTime(),
      endTime: new Date(target.endTime).getTime(),
      date: new Date(target.date).getTime(),
    })
    originalValue = { ...formValue }
  }
})

const handleSubmit = async () => {
  try {
    await formRef.value?.validate()
  } catch (errors) {
    console.error('validation failed:', errors)
    return
  }

  if (!formValue.date) return message.error("日期不对喔")

  const payload = {
    title: formValue.title,
    room_id: formValue.room_id,
    capacity: formValue.capacity,
    date: toRFC3339(formValue.date),
    startTime: toRFC3339(formValue.date, formValue.startTime),
    endTime: toRFC3339(formValue.date, formValue.endTime),
  }

  try {
    loading.value = true
    await Api.put(`/api/admin/service-dates/${props.dateId}`, payload)
    message.success("提交成功啦")
  } catch (e: any) {
    console.error('submit failed:', e)
    message.error(e.response?.data?.error || "提交失败")
  } finally {
    loading.value = false
  }
}
</script>
