<template>
  <PageWrapper title="场地管理">
    <n-space vertical :size="16">
      <n-space justify="space-between" :align="'center'">
        <n-text strong>校区</n-text>
        <n-button type="primary" @click="showCampusCreateModal = true">新建校区</n-button>
      </n-space>
      <n-data-table
        :columns="campusColumns"
        :data="rooms.state.campuses"
        :bordered="false"
        :single-line="false"
        :loading="rooms.state.loading"
      >
        <template #empty>
          <n-empty description="暂无校区，请先新建校区" />
        </template>
      </n-data-table>

      <n-divider />

      <n-space justify="space-between" :align="'center'">
        <n-text strong>场地</n-text>
        <n-button type="primary" @click="showCreateModal = true">新建场地</n-button>
      </n-space>
      <n-data-table
        :columns="columns"
        :data="rooms.state.list"
        :bordered="false"
        :single-line="false"
        :loading="rooms.state.loading"
      >
        <template #empty>
          <n-empty description="暂无场地，请先新建校区后再添加场地" />
        </template>
      </n-data-table>
    </n-space>

    <n-modal v-model:show="showEditModal" title="编辑场地" preset="card" style="max-width: 480px;"
      @after-leave="resetEditForm">
      <n-form :model="editForm" ref="editFormRef" :rules="roomRules">
        <n-form-item label="名称" path="name">
          <n-input v-model:value="editForm.name" placeholder="例如: 中关村医务室" />
        </n-form-item>
        <n-form-item label="地址" path="address">
          <n-input v-model:value="editForm.address" placeholder="请输入场地的详细地址" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showEditModal = false">取消</n-button>
          <n-button type="primary" :loading="editLoading" @click="handleEditSubmit">保存</n-button>
        </n-space>
      </template>
    </n-modal>

    <n-modal v-model:show="showCreateModal" title="新建场地" preset="card" style="max-width: 480px;"
      @after-leave="resetCreateForm">
      <n-form :model="createForm" ref="createFormRef" :rules="roomRules">
        <n-form-item label="名称" path="name">
          <n-input v-model:value="createForm.name" placeholder="例如: 中关村医务室" />
        </n-form-item>
        <n-form-item label="地址" path="address">
          <n-input v-model:value="createForm.address" placeholder="请输入场地的详细地址" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showCreateModal = false">取消</n-button>
          <n-button type="primary" :loading="createLoading" @click="handleCreate">创建</n-button>
        </n-space>
      </template>
    </n-modal>

    <n-modal v-model:show="showCampusEditModal" title="编辑校区" preset="card" style="max-width: 480px;"
      @after-leave="resetCampusEditForm">
      <n-form :model="campusEditForm" ref="campusEditFormRef" :rules="campusRules">
        <n-form-item label="名称" path="name">
          <n-input v-model:value="campusEditForm.name" placeholder="例如: 中关村校区" :maxlength="64" show-count />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showCampusEditModal = false">取消</n-button>
          <n-button type="primary" :loading="campusEditLoading" @click="handleCampusEditSubmit">保存</n-button>
        </n-space>
      </template>
    </n-modal>

    <n-modal v-model:show="showCampusCreateModal" title="新建校区" preset="card" style="max-width: 480px;"
      @after-leave="resetCampusCreateForm">
      <n-form :model="campusCreateForm" ref="campusCreateFormRef" :rules="campusRules">
        <n-form-item label="名称" path="name">
          <n-input v-model:value="campusCreateForm.name" placeholder="例如: 中关村校区" :maxlength="64" show-count />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showCampusCreateModal = false">取消</n-button>
          <n-button type="primary" :loading="campusCreateLoading" @click="handleCampusCreate">创建</n-button>
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
import { NButton, NIcon, NSpace, NSwitch, useDialog, useMessage } from 'naive-ui'
import type { DataTableColumn, FormInst, FormRules } from 'naive-ui'
import EditFilled from '@vicons/material/EditFilled'
import DeleteFilled from '@vicons/material/DeleteFilled'
import { useRouter } from 'vue-router'

type RoomRow = API.Room

const message = useMessage()
const dialog = useDialog()
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

const showCreateModal = ref(false)
const createLoading = ref(false)
const createForm = reactive({
  name: '',
  address: '',
})
const createFormRef = ref<FormInst | null>(null)

const showCampusEditModal = ref(false)
const campusEditLoading = ref(false)
const editingCampusId = ref<number | null>(null)
const campusEditForm = reactive({
  name: '',
})
const campusEditFormRef = ref<FormInst | null>(null)

const showCampusCreateModal = ref(false)
const campusCreateLoading = ref(false)
const campusCreateForm = reactive({
  name: '',
})
const campusCreateFormRef = ref<FormInst | null>(null)

const roomRules: FormRules = {
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

const campusRules: FormRules = {
  name: [
    {
      required: true,
      message: '请输入校区名称',
      trigger: ['blur', 'input'],
    },
    {
      max: 64,
      message: '校区名称不能超过 64 个字符',
      trigger: ['blur', 'input'],
    },
  ],
}

const errorText = (e: any, fallback: string) => {
  if (e?.response?.status === 409) return '场地名称已存在'
  return e?.response?.data?.error || e?.message || fallback
}

const campusErrorText = (e: any, fallback: string) => {
  if (e?.response?.status === 409) return '校区名称已存在'
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
    width: 180,
    render: (row) =>
      h(NSpace, { size: 12 }, {
        default: () => [
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
          h(
            NButton,
            {
              text: true,
              type: 'error',
              onClick: () => confirmRemove(row),
            },
            {
              icon: () => h(NIcon, null, { default: () => h(DeleteFilled) }),
              default: () => '删除',
            },
          ),
        ],
      }),
  },
]

const campusColumns: DataTableColumn<API.Campus>[] = [
  {
    title: '名称',
    key: 'name',
    minWidth: 180,
  },
  {
    title: '操作',
    key: 'actions',
    width: 180,
    render: (row) =>
      h(NSpace, { size: 12 }, {
        default: () => [
          h(
            NButton,
            {
              text: true,
              type: 'primary',
              onClick: () => openCampusEdit(row),
            },
            {
              icon: () => h(NIcon, null, { default: () => h(EditFilled) }),
              default: () => '编辑',
            },
          ),
          h(
            NButton,
            {
              text: true,
              type: 'error',
              onClick: () => confirmCampusRemove(row),
            },
            {
              icon: () => h(NIcon, null, { default: () => h(DeleteFilled) }),
              default: () => '删除',
            },
          ),
        ],
      }),
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

const resetCreateForm = () => {
  Object.assign(createForm, { name: '', address: '' })
  createFormRef.value?.restoreValidation()
}

const handleCreate = async () => {
  try {
    await createFormRef.value?.validate()
  } catch {
    return
  }
  createLoading.value = true
  try {
    await rooms.create({ name: createForm.name, address: createForm.address })
    message.success('场地已创建')
    showCreateModal.value = false
  } catch (e: any) {
    message.error(errorText(e, '创建失败'))
  } finally {
    createLoading.value = false
  }
}

const confirmRemove = (room: API.Room) => {
  dialog.warning({
    title: '确认删除',
    content: `确定要删除场地「${room.name}」吗？此操作不可恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await rooms.remove(room.id)
        message.success('已删除')
      } catch (e: any) {
        if (e?.response?.status === 409) {
          message.error('该场地存在未完成的工单或关联记录，无法删除')
        } else {
          message.error(errorText(e, '删除失败'))
        }
        await rooms.refresh()
      }
    },
  })
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

const openCampusEdit = (campus: API.Campus) => {
  editingCampusId.value = campus.id
  campusEditForm.name = campus.name
  campusEditFormRef.value?.restoreValidation()
  showCampusEditModal.value = true
}

const resetCampusEditForm = () => {
  editingCampusId.value = null
  Object.assign(campusEditForm, { name: '' })
  campusEditFormRef.value?.restoreValidation()
}

const handleCampusEditSubmit = async () => {
  if (editingCampusId.value === null) return
  try {
    await campusEditFormRef.value?.validate()
  } catch {
    return
  }
  campusEditLoading.value = true
  try {
    await rooms.updateCampus(editingCampusId.value, {
      name: campusEditForm.name,
    })
    message.success('校区已更新')
    showCampusEditModal.value = false
  } catch (e: any) {
    message.error(campusErrorText(e, '更新失败'))
  } finally {
    campusEditLoading.value = false
  }
}

const resetCampusCreateForm = () => {
  Object.assign(campusCreateForm, { name: '' })
  campusCreateFormRef.value?.restoreValidation()
}

const handleCampusCreate = async () => {
  try {
    await campusCreateFormRef.value?.validate()
  } catch {
    return
  }
  campusCreateLoading.value = true
  try {
    await rooms.createCampus({ name: campusCreateForm.name })
    message.success('校区已创建')
    showCampusCreateModal.value = false
  } catch (e: any) {
    message.error(campusErrorText(e, '创建失败'))
  } finally {
    campusCreateLoading.value = false
  }
}

const confirmCampusRemove = (campus: API.Campus) => {
  dialog.warning({
    title: '确认删除',
    content: `确定要删除校区「${campus.name}」吗？此操作不可恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await rooms.removeCampus(campus.id)
        message.success('已删除')
      } catch (e: any) {
        if (e?.response?.status === 409) {
          message.error('该校区下仍有场地，无法删除')
        } else {
          message.error(e?.response?.data?.error || e?.message || '删除失败')
        }
        await rooms.refresh()
      }
    },
  })
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
    message.error('加载校区和场地列表失败')
  }
})
</script>
