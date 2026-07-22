<template>
  <n-element class="headerBar">
    <FlexAside>
      <template #left>
        <n-space horizantal style="display: flex; align-items: center;">
          <n-button circle quaternary @click="openDrawer"
            style="--n-width: 48px; --n-height: 48px; --n-icon-size: 24px;" :disabled="props.disabled">
            <template #icon>
              <n-icon>
                <menu-filled />
              </n-icon>
            </template>
          </n-button>
          <h2 style="color: var(--text-color-base); height: 100%">
            {{ props.title }}
          </h2>
        </n-space>
      </template>
      <template #right v-if="!props.disabled">
        <n-space :align="'center'" v-if="!lt600px">
          <n-popover trigger="hover">
            <template #trigger>
              <n-button circle quaternary style="--n-width: 48px; --n-height: 48px; --n-icon-size: 24px;"
                @click="router.push('/schedule')">
                <template #icon>
                  <n-icon>
                    <EditCalendarFilled />
                  </n-icon>
                </template>
              </n-button>
            </template>
            <span>编辑时间</span>
          </n-popover>
          <n-popover trigger="hover">
            <template #trigger>
              <n-button circle quaternary style="--n-width: 48px; --n-height: 48px; --n-icon-size: 24px;"
                @click="router.push('/staff')">
                <template #icon>
                  <n-icon>
                    <BadgeFilled />
                  </n-icon>
                </template>
              </n-button>
            </template>
            <span>人员管理</span>
          </n-popover>
          <n-popover trigger="hover">
            <template #trigger>
              <n-button circle quaternary style="--n-width: 48px; --n-height: 48px; --n-icon-size: 24px;"
                @click="router.push('/announcement')">
                <template #icon>
                  <n-icon>
                    <EditNotificationsFilled />
                  </n-icon>
                </template>
              </n-button>
            </template>
            <span>编辑公告</span>
          </n-popover>
          <n-popover trigger="hover">
            <template #trigger>
              <n-button circle quaternary style="--n-width: 48px; --n-height: 48px; --n-icon-size: 24px;"
                @click="router.push('/work-schedule')">
                <template #icon>
                  <n-icon>
                    <CalendarMonthFilled />
                  </n-icon>
                </template>
              </n-button>
            </template>
            <span>排班管理</span>
          </n-popover>
          <n-popover trigger="hover">
            <template #trigger>
              <n-popconfirm>
                <template #trigger>
                  <n-button>
                    {{ Auth.user.value?.account_id || "Who Are You?" }}
                  </n-button>
                </template>
                真的要退出登录吗?
                <template #action>
                  <n-button size="small" @click="logout" type="primary">
                    确认
                  </n-button>
                </template>
              </n-popconfirm>
            </template>
            <span>退出登录</span>
          </n-popover>
        </n-space>

        <n-dropdown v-else trigger="click" :options="menu" show-arrow @select="handleMenuClick" size="large">
          <n-button circle quaternary style="--n-width: 48px; --n-height: 48px; --n-icon-size: 24px;">
            <template #icon>
              <n-icon>
                <MoreVertFilled />
              </n-icon>
            </template>
          </n-button>
        </n-dropdown>
      </template>
    </FlexAside>
  </n-element>

  <div style="position: relative; height: calc(100vh - 64px)">
    <slot></slot>
  </div>
</template>

<style scoped>
.headerBar {
  background-color: var(--base-color);
  padding: 8px 32px;
  height: 64px;

  width: 100vw;
  z-index: 1000;
  position: relative;

  box-shadow: var(--box-shadow-1);
}

@media screen and (max-width: 600px) {
  .headerBar {
    padding: 8px 16px;
  }
}

.headerBar>div {
  display: flex;
  align-items: center;
}

@media (prefers-color-scheme: light) {
  .headerBar {
    background-color: var(--primary-color-hover);
  }

  .headerBar * {
    color: #fff !important;
  }
}
</style>

<script setup lang="ts">
import MenuFilled from "@vicons/material/MenuFilled"
import store from '@/store';
import Auth from "@/utils/Auth"
import FlexAside from "@/components/FlexAside.vue"
import { useRouter } from "vue-router"
import EditCalendarFilled from "@vicons/material/EditCalendarFilled"
import EditNotificationsFilled from "@vicons/material/EditNotificationsFilled"
import BadgeFilled from "@vicons/material/BadgeFilled"
import CalendarMonthFilled from "@vicons/material/CalendarMonthFilled"
import MoreVertFilled from "@vicons/material/MoreVertFilled"
import LogOutFilled from "@vicons/material/LogOutFilled"
import { lt600px } from "@/utils/Responsive";
import { h, type Component } from "vue";
import { NIcon, useMessage } from "naive-ui";

const router = useRouter()
const message = useMessage()

const renderIcon = (icon: Component) => {
  return () => h(NIcon, null, { default: () => h(icon) })
}

const menu = [
  {
    title: "编辑时间",
    key: "schedule",
    icon: renderIcon(EditCalendarFilled),
    onClick: () => router.push("/schedule")
  },
  {
    title: "人员管理",
    key: "staff",
    icon: renderIcon(BadgeFilled),
    onClick: () => router.push("/staff")
  },
  {
    title: "编辑公告",
    key: "announcement",
    icon: renderIcon(EditNotificationsFilled),
    onClick: () => router.push("/announcement")
  },
  {
    title: "排班管理",
    key: "workSchedule",
    icon: renderIcon(CalendarMonthFilled),
    onClick: () => router.push("/work-schedule")
  },
  {
    title: "退出登录",
    key: "logout",
    icon: renderIcon(LogOutFilled),
    onClick: () => { Auth.logout(); router.push("/login") }
  }
]

const handleMenuClick = (key: string) => {
  console.debug(key)
  const item = menu.find(item => item.key === key)
  if (item) {
    item.onClick()
  }
}

const openDrawer = () => {
  store.isDrawerOpen = !store.isDrawerOpen
  console.debug(store.isDrawerOpen)
}

const props = defineProps({
  title: String,
  disabled: {
    type: Boolean,
    default: false
  }
})

const logout = () => {
  Auth.logout()
  router.push("/login")
}
</script>