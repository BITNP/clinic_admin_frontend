<template>
  <PageWrapper title="场地管理">
    <n-space vertical :size="16">
      <n-data-table
        :columns="columns"
        :data="rooms.state.list"
        :bordered="false"
        :single-line="false"
        :loading="rooms.state.loading"
      >
        <template #empty>
          <n-empty description="暂无场地" />
        </template>
      </n-data-table>
    </n-space>

    <n-modal v-model:show="showEditModal" title="编辑场地" preset="card" style="max-width: 480px;"
      @after-leave="resetEditForm">
      <n-form :model="editForm" ref="editFormRef" :rules="editRules">
        <n-form-item label="名称" path="name">
          <n-input v-model:value="editForm.name" placeholder="例如: 主楼 101" />
        </n-form-item>
        <n-form-item label="地址" path="address">
          <n-input v-model:value="editForm.address" placeholder="请输入场地地址" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showEditModal = false">取消</n-button>
          <n-button type="primary" :loading="editLoading" @click="handleEditSubmit">保存</n-button>
        </n-space>
      </template>
    </n-modal>
  </PageWrapper>
</template>

<script setup lang="ts">
import PageWrapper from '@/components/PageWrapper.vue'
import { rooms } from '@/store'
import type API from '@/store/api'
import Auth from '@/utils/Auth'
import { ref, reactive, onMounted, h } from 'vue'
import { NButton, NIcon, NSwitch, useMessage } from 'naive-ui'
import type { DataTableColumn, FormInst, FormRules } from 'naive-ui'
import EditFilled from '@vicons/material/EditFilled'
import { useRouter } from 'vue-router'

type RoomRow = API.Room

const message = useMessage()
const router = useRouter()

const showEditModal = ref(false)
const editLoading = ref(false)
const editingId = ref<number | null>(null)
const savingId = ref<number | null>(null)
const editForm = reactive({
  name: '',
  address: '',
})
const editFormRef = ref<FormInst | null>(null)

const editRules: FormRules = {
  name: {
    required: true,
    message: '请输入场地名称',
    trigger: ['blur'],
  },
  address: {
    required: true,
    message: '请输入场地地址',
    trigger: ['blur'],
  },
}

const errorText = (e: any, fallback: string) => {
  if (e?.response?.status === 409) return '场地名称已存在'
  return e?.response?.data?.error || e?.message || fallback
}

const columns: DataTableColumn<RoomRow>[] = [
  {
    title: '名称',
    key: 'name',
    minWidth: 180,
  },
  {
    title: '地址',
    key: 'address',
    minWidth: 240,
  },
  {
    title: '启用状态',
    key: 'enabled',
    width: 140,
    render: (row) =>
      h('div', { style: 'display: flex; align-items: center; gap: 8px;' }, [
        h(NSwitch, {
          value: row.enabled,
          loading: savingId.value === row.id,
          'onUpdate:value': (value: boolean) => handleToggleEnabled(row, value),
        }),
        h('span', { style: 'color: var(--text-color-3);' }, row.enabled ? '启用' : '停用'),
      ]),
  },
  {
    title: '操作',
    key: 'actions',
    width: 120,
    render: (row) =>
      h(
        NButton,
        {
          text: true,
          type: 'primary',
          onClick: () => openEdit(row),
        },
        {
          icon: () => h(NIcon, null, { default: () => h(EditFilled) }),
          default: () => '编辑',
        },
      ),
  },
]

const openEdit = (room: API.Room) => {
  editingId.value = room.id
  editForm.name = room.name
  editForm.address = room.address
  editFormRef.value?.restoreValidation()
  showEditModal.value = true
}

const resetEditForm = () => {
  editingId.value = null
  Object.assign(editForm, { name: '', address: '' })
  editFormRef.value?.restoreValidation()
}

const handleEditSubmit = async () => {
  if (editingId.value === null) return
  try {
    await editFormRef.value?.validate()
  } catch {
    return
  }
  editLoading.value = true
  try {
    await rooms.update(editingId.value, {
      name: editForm.name,
      address: editForm.address,
    })
    message.success('场地已更新')
    showEditModal.value = false
  } catch (e: any) {
    message.error(errorText(e, '更新失败'))
  } finally {
    editLoading.value = false
  }
}

const handleToggleEnabled = async (room: API.Room, value: boolean) => {
  savingId.value = room.id
  try {
    await rooms.update(room.id, { enabled: value })
    message.success(value ? '已启用' : '已停用')
  } catch (e: any) {
    if (e?.response?.status === 409) {
      message.error('该场地存在未完成的工单，无法停用')
    } else {
      message.error(errorText(e, '更新失败'))
    }
    await rooms.refresh()
  } finally {
    savingId.value = null
  }
}

onMounted(async () => {
  await Auth.ready()
  // Auth.ready() resolves once login succeeds; the user object may lag behind.
  while (!Auth.user.value) {
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  if (Auth.user.value.role !== 'admin') {
    message.error('无权限访问场地管理')
    router.replace('/')
    return
  }
  try {
    await rooms.refresh()
  } catch (e) {
    console.error('Failed to load room list', e)
    message.error('加载场地列表失败')
  }
})
</script>
