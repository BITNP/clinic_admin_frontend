<template>
  <PageWrapper title="排班管理">
    <n-space vertical :size="16">
      <n-space :align="'center'" wrap>
        <n-select
          v-model:value="selectedId"
          :options="scheduleOptions"
          placeholder="选择排班"
          clearable
          style="min-width: 240px;"
          @update:value="onSelect"
        />
        <n-button @click="showCreateModal = true">
          新建
        </n-button>
        <n-button type="error" :disabled="!selectedId" @click="handleDelete">
          删除
        </n-button>
        <n-button
          type="primary"
          :disabled="!selectedId || selectedSchedule?.enabled"
          :loading="applying"
          @click="handleApply"
        >
          应用
        </n-button>
      </n-space>

      <template v-if="selectedSchedule">
        <n-space vertical :size="4">
          <n-space align="center" :size="8">
            <n-text depth="text">
              <strong>排班名称:</strong> {{ selectedSchedule.name }}
            </n-text>
            <n-button text size="small" @click="openEditModal" title="编辑排班信息">
              <template #icon>
                <n-icon><EditFilled /></n-icon>
              </template>
            </n-button>
          </n-space>
          <n-text depth="text">
            <strong>有效期:</strong> {{ formatDate(selectedSchedule.start_date) }} ~ {{ formatDate(selectedSchedule.end_date) }}
          </n-text>
          <n-tag v-if="selectedSchedule.enabled" type="success" size="small">
            当前启用
          </n-tag>
        </n-space>

        <n-space vertical :size="20">
          <n-card v-for="room in roomsWithData" :key="room.id" :title="room.name" embedded>
            <n-table :bordered="false" :single-line="false">
              <thead>
                <tr>
                  <th v-for="(day, dayIdx) in weekdayLabels" :key="day.key" style="text-align: center;">
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                      <div style="display: flex; justify-content: center; align-items: center; gap: 4px;">
                        <span>{{ day.label }}</span>
                        <n-button text size="tiny" title="编辑工作时间" @click="openEditTimeModal(room.id, day.key)">
                          <template #icon>
                            <n-icon><EditFilled /></n-icon>
                          </template>
                        </n-button>
                      </div>
                      <span style="font-size: 12px; color: var(--text-color-3);">{{ room.weekdayTimeLabels[dayIdx] }}</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="rowIdx in room.maxRows" :key="rowIdx">
                  <td v-for="(day, dayIdx) in weekdayLabels" :key="day.key" style="text-align: center; vertical-align: middle;">
                    <template v-if="room.columns[dayIdx]?.[rowIdx - 1]">
                      <n-space justify="center" align="center" :size="8">
                        <span>{{ room.columns[dayIdx][rowIdx - 1].staffName }}</span>
                        <n-button text type="error" size="tiny" @click="confirmRemove(room.columns[dayIdx][rowIdx - 1].staffId, room.weekdayIds[dayIdx]!)">
                          删除
                        </n-button>
                      </n-space>
                    </template>
                    <span v-else style="color: var(--text-color-3);">&mdash;</span>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                    <td v-for="day in weekdayLabels" :key="day.key" style="text-align: center;">
                    <n-button size="small" @click="openAddModal(room.id, day.key)">
                      添加
                    </n-button>
                  </td>
                </tr>
              </tfoot>
            </n-table>
          </n-card>
        </n-space>
      </template>

      <n-empty v-else-if="!loading" description="请选择一个排班" />
    </n-space>

    <n-modal v-model:show="showCreateModal" title="新建排班" preset="card" style="max-width: 480px;"
      @after-leave="resetCreateForm">
      <n-form :model="createForm" ref="createFormRef" :rules="createRules">
        <n-form-item label="排班名称" path="name">
          <n-input v-model:value="createForm.name" placeholder="例如: 2026 秋季" />
        </n-form-item>
        <n-form-item label="开始日期" path="startDate">
          <n-date-picker
            :formatted-value="createForm.startDate"
            @update:formatted-value="(v: any) => {
              createForm.startDate = v as string | null
            }"
            value-format="yyyy-MM-dd"
            type="date"
            style="width: 100%;"
          />
        </n-form-item>
        <n-form-item label="结束日期" path="endDate">
          <n-date-picker
            :formatted-value="createForm.endDate"
            @update:formatted-value="(v: any) => {
              createForm.endDate = v as string | null
            }"
            value-format="yyyy-MM-dd"
            type="date"
            style="width: 100%;"
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showCreateModal = false">取消</n-button>
          <n-button type="primary" :loading="creating" @click="handleCreate">创建</n-button>
        </n-space>
      </template>
    </n-modal>

    <n-modal v-model:show="showEditModal" title="编辑排班" preset="card" style="max-width: 480px;">
      <n-form :model="editForm" ref="editFormRef" :rules="editRules">
        <n-form-item label="排班名称" path="name">
          <n-input v-model:value="editForm.name" placeholder="例如: 2026 秋季" />
        </n-form-item>
        <n-form-item label="开始日期" path="startDate">
          <n-date-picker
            :formatted-value="editForm.startDate"
            @update:formatted-value="(v: any) => { editForm.startDate = v as string | null }"
            value-format="yyyy-MM-dd"
            type="date"
            style="width: 100%;"
          />
        </n-form-item>
        <n-form-item label="结束日期" path="endDate">
          <n-date-picker
            :formatted-value="editForm.endDate"
            @update:formatted-value="(v: any) => { editForm.endDate = v as string | null }"
            value-format="yyyy-MM-dd"
            type="date"
            style="width: 100%;"
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showEditModal = false">取消</n-button>
          <n-button type="primary" :loading="editLoading" @click="handleEditSubmit">保存</n-button>
        </n-space>
      </template>
    </n-modal>

    <n-modal v-model:show="showAddModal" title="添加人员" preset="card" style="max-width: 400px;">
      <n-space vertical :size="8">
        <n-button
          v-for="staff in validStaffList"
          :key="staff.id"
          :disabled="isStaffInTargetColumn(staff.id)"
          block
          @click="handleAddStaff(staff.id)"
        >
          {{ staff.realname || staff.account_id }}
        </n-button>
        <n-empty v-if="validStaffList.length === 0" description="无可用人员" />
      </n-space>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showAddModal = false">取消</n-button>
        </n-space>
      </template>
    </n-modal>

    <n-modal v-model:show="showEditTimeModal" :title="`编辑工作时间 — ${editTimeDayLabel}`" preset="card" style="max-width: 400px;">
      <n-form>
        <n-form-item label="开始时间">
          <n-time-picker
            v-model:formatted-value="editTimeStart"
            format="HH:mm"
            placeholder="开始时间"
            style="width: 100%;"
          />
        </n-form-item>
        <n-form-item label="结束时间">
          <n-time-picker
            v-model:formatted-value="editTimeEnd"
            format="HH:mm"
            placeholder="结束时间"
            style="width: 100%;"
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showEditTimeModal = false">取消</n-button>
          <n-button type="primary" :loading="editTimeLoading" @click="handleEditTime">确定</n-button>
        </n-space>
      </template>
    </n-modal>
  </PageWrapper>
</template>

<script setup lang="ts">
import PageWrapper from '@/components/PageWrapper.vue'
import Api from '@/utils/Api'
import type API from '@/store/api'
import store, { load as storeLoad } from '@/store'
import { ref, reactive, computed, onMounted } from 'vue'
import { useMessage, useDialog } from 'naive-ui'
import type { FormInst } from 'naive-ui'
import EditFilled from "@vicons/material/EditFilled"

interface CellEntry {
  staffId: number
  staffName: string
  isAdmin: boolean
}

interface RoomData {
  id: number
  name: string
  columns: CellEntry[][]
  weekdayIds: (number | null)[]
  weekdayTimeLabels: string[]
  maxRows: number
}

const weekdayLabels = [
  { key: 1, label: '周一' },
  { key: 2, label: '周二' },
  { key: 3, label: '周三' },
  { key: 4, label: '周四' },
  { key: 5, label: '周五' },
  { key: 6, label: '周六' },
  { key: 0, label: '周日' },
]

const message = useMessage()
const dialog = useDialog()

const scheduleList = ref<API.WorkSchedule[]>([])
const selectedId = ref<number | null>(null)
const selectedSchedule = ref<API.WorkSchedule | null>(null)
const loading = ref(false)
const applying = ref(false)
const creating = ref(false)
const showCreateModal = ref(false)
const validStaffList = ref<API.Staff[]>([])
const showAddModal = ref(false)
const addTargetRoomId = ref(0)
const addTargetWeekday = ref(0)

const createForm = reactive({
  name: '',
  startDate: null as string | null,
  endDate: null as string | null,
})
const createFormRef = ref<FormInst | null>(null)
const showEditModal = ref(false)
const editLoading = ref(false)
const editForm = reactive({
  name: '',
  startDate: null as string | null,
  endDate: null as string | null,
})
const editFormRef = ref<FormInst | null>(null)

const editRules = {
  name: {
    required: true,
    message: '请输入排班名称',
    trigger: ['blur'],
  },
  startDate: {
    trigger: ['change'],
    validator: (rule: any, value: any) => {
      if (!value) return new Error('请选择开始日期')
      return true
    },
  },
  endDate: {
    trigger: ['change'],
    validator: (rule: any, value: any) => {
      if (!value) return new Error('请选择结束日期')
      return true
    },
  },
}

const createRules = {
  name: {
    required: true,
    message: '请输入排班名称',
    trigger: ['blur'],
  },
  startDate: {
    trigger: ['change'],
    validator: (rule: any, value: any) => {
      if (!value) return new Error('请选择开始日期')
      return true
    },
  },
  endDate: {
    trigger: ['change'],
    validator: (rule: any, value: any) => {
      if (!value) return new Error('请选择结束日期')
      return true
    },
  },
}

const scheduleOptions = computed(() =>
  scheduleList.value.map(s => ({
    label: s.name,
    value: s.id,
  }))
)

const roomsWithData = computed<RoomData[]>(() => {
  if (!selectedSchedule.value) return []

  const weekdays = selectedSchedule.value.weekdays ?? []

  const roomMap = new Map<number, { name: string; wds: API.WorkScheduleWeekday[] }>()
  for (const wd of weekdays) {
    const rid = wd.room_id
    if (!roomMap.has(rid)) {
      roomMap.set(rid, { name: wd.room?.name ?? `校区#${rid}`, wds: [] })
    }
    roomMap.get(rid)!.wds.push(wd)
  }

  const result: RoomData[] = []
  for (const [rid, { name, wds }] of roomMap) {
    const columns: CellEntry[][] = weekdayLabels.map(() => [])
    const weekdayIds: (number | null)[] = weekdayLabels.map(() => null)
    const weekdayTimeLabels: string[] = weekdayLabels.map((wl) => {
      const wd = wds.find(w => w.weekday === wl.key)
      if (!wd) return '--'
      return formatTimeRange(wd.start_time, wd.end_time)
    })
    const seen = new Set<string>()

    for (const wd of wds) {
      const dayIdx = weekdayLabels.findIndex(wl => wl.key === wd.weekday)
      if (dayIdx === -1) continue
      if (weekdayIds[dayIdx] === null) {
        weekdayIds[dayIdx] = wd.id
      }
      for (const s of wd.staff ?? []) {
        if (!s.staff) continue
        const key = `${dayIdx}-${s.staff_id}`
        if (seen.has(key)) continue
        seen.add(key)
        columns[dayIdx].push({
          staffId: s.staff_id,
          staffName: s.staff.realname || s.staff.account_id,
          isAdmin: s.staff.role === 'admin',
        })
      }
    }

    for (const col of columns) {
      col.sort((a, b) => {
        if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1
        return a.staffName.localeCompare(b.staffName)
      })
    }

    const maxRows = Math.max(...columns.map(c => c.length), 0)

    result.push({ id: rid, name, columns, weekdayIds, weekdayTimeLabels, maxRows })
  }

  const knownIds = new Set(roomMap.keys())
  const emptyColumns = weekdayLabels.map(() => [] as CellEntry[])
  const emptyWeekdayIds = weekdayLabels.map(() => null)
  const emptyLabels = weekdayLabels.map(() => '--' as string)
  for (const room of store.campusList) {
    if (!knownIds.has(room.id)) {
      result.push({ id: room.id, name: room.name, columns: emptyColumns, weekdayIds: emptyWeekdayIds, weekdayTimeLabels: emptyLabels, maxRows: 0 })
    }
  }

  result.sort((a, b) => a.name.localeCompare(b.name))

  return result
})

const formatDate = (iso: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
}

const formatTimeFromISO = (iso: string): string => {
  const m = iso.match(/T(\d{2}):(\d{2})/)
  return m ? `${m[1]}:${m[2]}` : ''
}

const formatTimeRange = (start: string, end: string): string => {
  return `${formatTimeFromISO(start)}-${formatTimeFromISO(end)}`
}

const showEditTimeModal = ref(false)
const editTimeRoomId = ref(0)
const editTimeWeekday = ref(0)
const editTimeDayLabel = ref('')
const editTimeStart = ref<string | null>(null)
const editTimeEnd = ref<string | null>(null)
const editTimeLoading = ref(false)

const onSelect = (val: number | null) => {
  if (val) fetchDetail(val)
  else {
    selectedSchedule.value = null
    validStaffList.value = []
  }
}

const fetchList = async () => {
  loading.value = true
  try {
    const res = await Api.get<{ items: API.WorkSchedule[] }>('/api/admin/work-schedules/all')
    scheduleList.value = res.data.items
  } catch (e: any) {
    console.error('Failed to load schedule list', e)
    message.error(`加载排班列表失败: ${e.response?.status === 404 ? '后端接口不存在，请重启后端' : e.response?.data?.error || e.message}`)
  } finally {
    loading.value = false
  }
}

const fetchDetail = async (id: number) => {
  try {
    const [detailRes, validRes] = await Promise.all([
      Api.get<API.WorkSchedule>(`/api/admin/work-schedules/${id}`),
      Api.get<{ items: API.Staff[] }>(`/api/admin/work-schedules/${id}/valid-staff`),
    ])
    selectedSchedule.value = detailRes.data
    validStaffList.value = validRes.data.items
  } catch (e) {
    console.error('Failed to load schedule detail', e)
    message.error('加载排班详情失败')
  }
}
const resetCreateForm = () => {
  Object.assign(createForm, { name: '', startDate: null, endDate: null })
  createFormRef.value?.restoreValidation()
}

const handleCreate = async () => {
  try {
    await createFormRef.value?.validate()
  } catch {
    return
  }
  if (!createForm.startDate || !createForm.endDate) return
  creating.value = true
  try {
    const payload = {
      name: createForm.name,
      start_date: createForm.startDate,
      end_date: createForm.endDate,
      weekdays: [] as any[],
    }
    await Api.post('/api/admin/work-schedules', payload)
    message.success('排班创建成功')
    showCreateModal.value = false
    Object.assign(createForm, { name: '', startDate: null, endDate: null })
    await fetchList()
  } catch (e: any) {
    const errMsg = e.response?.status === 404
      ? '后端接口不存在，请重启后端'
      : e.response?.data?.error || e.message || '创建失败'
    message.error(errMsg)
  } finally {
    creating.value = false
  }
}

const handleDelete = () => {
  if (!selectedId.value) return
  dialog.warning({
    title: '确认删除',
    content: `确定要删除排班「${selectedSchedule.value?.name}」吗？`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await Api.delete(`/api/admin/work-schedules/${selectedId.value}`)
        message.success('已删除')
        selectedId.value = null
        selectedSchedule.value = null
        await fetchList()
      } catch (e: any) {
        const errMsg = e.response?.status === 404
          ? '后端接口不存在，请重启后端'
          : e.response?.data?.error || e.message || '删除失败'
        message.error(errMsg)
      }
    },
  })
}

const openEditModal = () => {
  if (!selectedSchedule.value) return
  editForm.name = selectedSchedule.value.name
  editForm.startDate = formatDate(selectedSchedule.value.start_date)
  editForm.endDate = formatDate(selectedSchedule.value.end_date)
  editFormRef.value?.restoreValidation()
  showEditModal.value = true
}

const handleEditSubmit = async () => {
  try {
    await editFormRef.value?.validate()
  } catch {
    return
  }
  if (!editForm.startDate || !editForm.endDate) return
  if (editForm.startDate > editForm.endDate) {
    message.error('开始日期不能晚于结束日期')
    return
  }
  editLoading.value = true
  try {
    await Api.put(`/api/admin/work-schedules/${selectedId.value}`, {
      name: editForm.name,
      start_date: editForm.startDate,
      end_date: editForm.endDate,
    })
    message.success('排班已更新')
    showEditModal.value = false
    await fetchList()
    if (selectedId.value) await fetchDetail(selectedId.value)
  } catch (e: any) {
    const errMsg = e.response?.status === 404
      ? '后端接口不存在，请重启后端'
      : e.response?.data?.error || e.message || '更新失败'
    message.error(errMsg)
  } finally {
    editLoading.value = false
  }
}

const handleApply = async () => {
  if (!selectedId.value) return
  const currentEnabled = scheduleList.value.find(
    s => s.enabled && s.id !== selectedId.value
  )

  const doApply = async () => {
    applying.value = true
    let disabledPrevious = false
    const previousId = currentEnabled?.id ?? null
    try {
      if (currentEnabled) {
        await Api.put(`/api/admin/work-schedules/${currentEnabled.id}`, { enabled: false })
        disabledPrevious = true
      }
      await Api.put(`/api/admin/work-schedules/${selectedId.value}`, { enabled: true })
      message.success('已启用该排班')
      await fetchList()
      await fetchDetail(selectedId.value!)
    } catch (e: any) {
      if (e.response?.status === 404) {
        message.error('后端接口不存在，请重启后端')
        return
      }
      if (disabledPrevious && previousId) {
        try {
          await Api.put(`/api/admin/work-schedules/${previousId}`, { enabled: true })
          await fetchList()
          message.info('已恢复之前的排班')
        } catch {
          message.error('切换失败，且无法自动恢复之前的排班，请手动检查')
        }
      } else {
        message.error(e.response?.data?.error || e.message || '启用失败')
      }
    } finally {
      applying.value = false
    }
  }

  if (currentEnabled) {
    dialog.warning({
      title: '确认切换排班',
      content: `启用排班「${selectedSchedule.value?.name}」将关闭当前排班「${currentEnabled.name}」，是否继续？`,
      positiveText: '确定',
      negativeText: '取消',
      onPositiveClick: doApply,
    })
  } else {
    await doApply()
  }
}

const confirmRemove = (staffId: number, weekdayId: number) => {
  if (!selectedId.value) return
  dialog.warning({
    title: '确认删除',
    content: '确定要移除该人员吗？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await Api.delete(`/api/admin/work-schedules/${selectedId.value}/staff`, {
          data: { weekday_id: weekdayId, staff_id: staffId },
        })
        message.success('已移除')
        await fetchDetail(selectedId.value!)
      } catch (e: any) {
        message.error(e.response?.data?.error || '移除失败')
      }
    },
  })
}

const openAddModal = (roomId: number, weekday: number) => {
  addTargetRoomId.value = roomId
  addTargetWeekday.value = weekday
  showAddModal.value = true
}

const handleAddStaff = async (staffId: number) => {
  try {
    await Api.post(`/api/admin/work-schedules/${selectedId.value}/staff`, {
      room_id: addTargetRoomId.value,
      weekday: addTargetWeekday.value,
      staff_id: staffId,
    })
    message.success('已添加')
    showAddModal.value = false
    await fetchDetail(selectedId.value!)
  } catch (e: any) {
    message.error(e.response?.data?.error || '添加失败')
  }
}

const isStaffInTargetColumn = (staffId: number): boolean => {
  if (!selectedSchedule.value || !addTargetRoomId.value) return false
  const room = roomsWithData.value.find(r => r.id === addTargetRoomId.value)
  if (!room) return false
  const dayIdx = weekdayLabels.findIndex(wl => wl.key === addTargetWeekday.value)
  if (dayIdx === -1) return false
  return room.columns[dayIdx]?.some(e => e.staffId === staffId) ?? false
}

const openEditTimeModal = (roomId: number, weekday: number) => {
  editTimeRoomId.value = roomId
  editTimeWeekday.value = weekday
  const day = weekdayLabels.find(wl => wl.key === weekday)
  editTimeDayLabel.value = day?.label ?? ''
  const wd = selectedSchedule.value?.weekdays?.find(
    w => w.room_id === roomId && w.weekday === weekday
  )
  editTimeStart.value = wd ? formatTimeFromISO(wd.start_time) : null
  editTimeEnd.value = wd ? formatTimeFromISO(wd.end_time) : null
  showEditTimeModal.value = true
}

const handleEditTime = async () => {
  if (!editTimeStart.value || !editTimeEnd.value) {
    message.error('请选择开始和结束时间')
    return
  }
  if (editTimeStart.value >= editTimeEnd.value) {
    message.error('开始时间必须早于结束时间')
    return
  }
  editTimeLoading.value = true
  try {
    await Api.put(`/api/admin/work-schedules/${selectedId.value}/weekdays`, {
      room_id: editTimeRoomId.value,
      weekday: editTimeWeekday.value,
      start_time: editTimeStart.value,
      end_time: editTimeEnd.value,
    })
    message.success('工作时间已更新')
    showEditTimeModal.value = false
    await fetchDetail(selectedId.value!)
  } catch (e: any) {
    message.error(e.response?.data?.error || '更新失败')
  } finally {
    editTimeLoading.value = false
  }
}

onMounted(async () => {
  if (store.campusList.length === 0) {
    await storeLoad()
  }
  await fetchList()
  if (scheduleList.value.length > 0) {
    const enabled = scheduleList.value.find(s => s.enabled)
    if (enabled) {
      selectedId.value = enabled.id
      await fetchDetail(enabled.id)
    }
  }
})
</script>
