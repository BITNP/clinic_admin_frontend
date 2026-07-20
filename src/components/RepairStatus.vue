<template>
  <n-space vertical>
    <!-- pending: waiting for confirmation -->
    <n-space vertical v-if="record?.status === 'pending'">
      <n-radio-group v-model:value="action">
        <n-space>
          <n-radio key="confirm" value="confirm">确认受理</n-radio>
          <n-radio key="reject" value="reject">驳回预约</n-radio>
          <n-radio key="refer" value="refer">建议返厂</n-radio>
        </n-space>
      </n-radio-group>

      <n-collapse-transition :show="action === 'confirm'">
        <div style="margin: 0.5em 0;">调整场地</div>
        <n-select :options="campusList" v-model:value="campusSelect" />
      </n-collapse-transition>

      <n-collapse-transition :show="action === 'reject'">
        <n-input type="textarea" placeholder="拒绝的理由是?" v-model:value="reasonInput" />
      </n-collapse-transition>

      <n-collapse-transition :show="action === 'refer'">
        <n-input type="textarea" placeholder="返厂建议" v-model:value="reasonInput" />
      </n-collapse-transition>

      <n-button :type="action === 'reject' ? 'error' : 'success'" style="width: 150px"
        @click="handleSubmit">
        提交
      </n-button>
    </n-space>

    <!-- confirmed: waiting for arrival -->
    <n-space v-if="record?.status === 'confirmed'">
      <n-button type="primary" style="width: 150px" :disabled="loading"
        @click="handleArrive">
        <template #icon>
          <DoneFilled />
        </template>
        已到诊所
      </n-button>
      <n-button style="width: 150px" :disabled="loading"
        @click="handleNoShow">
        <template #icon>
          <PersonOffFilled />
        </template>
        未到诊所
      </n-button>
    </n-space>

    <!-- arrived: ready to start work -->
    <n-space v-if="record?.status === 'arrived'">
      <n-button type="primary" style="width: 150px" :disabled="loading"
        @click="handleInProgress">
        <template #icon>
          <DoneFilled />
        </template>
        开始处理
      </n-button>
    </n-space>

    <!-- in_progress: working on it -->
    <n-space vertical v-if="record?.status === 'in_progress'">
      <RepairComment v-model:value="probDescs" label="问题描述" :options="store.probDescs" />
      <RepairComment v-model:value="repairComment" label="处理方式" :options="store.repairMethods" />
      <n-space>
        <n-button type="primary" style="width: 150px" :disabled="loading || !repairComment.validate"
          @click="handleComplete">
          <template #icon>
            <DoneFilled />
          </template>
          已解决
        </n-button>

        <n-button style="width: 150px" :disabled="loading"
          @click="handleReferred">
          <template #icon>
            <FactoryFilled />
          </template>
          建议返厂
        </n-button>
      </n-space>
    </n-space>

    <!-- revert button -->
    <n-space>
      <n-collapse-transition :show="(store.history.get(record?.id!)?.length ?? 0) !== 0">
        <n-button style="width: 150px" @click="handleRevert">
          <template #icon>
            <HistoryFilled />
          </template>
          后悔药
        </n-button>
      </n-collapse-transition>
    </n-space>
  </n-space>
</template>

<script setup lang="tsx">
import store from '@/store';
import type API from '@/store/api';
import { revertRecord as revertStoreRecord, updateStatus, markConfirmed, markArrived, markInProgress, markCompleted, markRejected, markReferred, markNoShow } from '@/store/record';
import DoneFilled from "@vicons/material/DoneFilled";
import PersonOffFilled from "@vicons/material/PersonOffFilled";
import HistoryFilled from "@vicons/material/HistoryFilled";
import FactoryFilled from "@vicons/material/FactoryFilled";
import { useMessage } from 'naive-ui';
import { computed, ref, toRaw } from 'vue';

const props = defineProps<{
  record: API.Record | null,
  worker: API.IUsers | null
}>()

const message = useMessage()

const action = ref<"confirm" | "reject" | "refer">("confirm")
const reasonInput = ref("")
const loading = ref(false)
const repairComment = ref({
  validate: false,
  value: "",
  display: ""
})
const probDescs = ref({
  validate: false,
  value: "",
  display: ""
})

const campusList = computed(() => store.campusList.map((campus) => ({
  label: campus.name,
  value: campus.id
})))
const campusSelect = ref<number | null>(null)

const handleSubmit = async () => {
  if (!props.record) return
  const record = toRaw(props.record)

  if (action.value === "reject") {
    if (!reasonInput.value) {
      message.error('请填写拒绝理由')
      return
    }
    loading.value = true
    try {
      await markRejected(record.id, reasonInput.value)
      message.success('驳回成功')
    } catch {
      message.error('驳回失败')
    } finally {
      loading.value = false
    }
  } else if (action.value === "refer") {
    loading.value = true
    try {
      await markReferred(record.id, reasonInput.value || undefined)
      message.success('已建议返厂')
    } catch {
      message.error('提交失败')
    } finally {
      loading.value = false
    }
  } else {
    loading.value = true
    try {
      await markConfirmed(record.id)
      if (campusSelect.value !== null) {
        console.log('campus change requested', campusSelect.value)
      }
      message.success('已确认受理')
    } catch {
      message.error('提交失败')
    } finally {
      loading.value = false
    }
  }
}

const handleArrive = async () => {
  if (!props.record) return
  loading.value = true
  try {
    await markArrived(props.record.id)
    message.success('已到诊所')
  } catch {
    message.error('操作失败')
  } finally {
    loading.value = false
  }
}

const handleNoShow = async () => {
  if (!props.record) return
  loading.value = true
  try {
    await markNoShow(props.record.id)
    message.success('已标记未到')
  } catch {
    message.error('操作失败')
  } finally {
    loading.value = false
  }
}

const handleInProgress = async () => {
  if (!props.record) return
  loading.value = true
  try {
    await markInProgress(props.record.id)
    message.success('开始处理')
  } catch {
    message.error('操作失败')
  } finally {
    loading.value = false
  }
}

const handleComplete = async () => {
  if (!props.record) return
  loading.value = true
  try {
    await markCompleted(props.record.id)
    const workerDesc = probDescs.value.display
    if (workerDesc) {
      await updateStatus(props.record.id, "completed", workerDesc)
    }
    message.success('处理完成')
  } catch {
    message.error('提交失败')
  } finally {
    loading.value = false
  }
}

const handleReferred = async () => {
  if (!props.record) return
  loading.value = true
  try {
    await markReferred(props.record.id)
    message.success('已建议返厂')
  } catch {
    message.error('提交失败')
  } finally {
    loading.value = false
  }
}

const handleRevert = async () => {
  if (!props.record) return
  const prev = await revertStoreRecord(props.record.id)
  if (prev) {
    try {
      await updateStatus(prev.id, prev.status, prev.worker_desc)
      message.success('Back to Future')
    } catch {
      message.error('时间机器坏了qwq')
    }
  } else {
    message.error('时间不能倒流')
  }
}
</script>
