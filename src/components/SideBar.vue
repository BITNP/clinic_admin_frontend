<template>
  <n-drawer v-model:show="ui.isDrawerOpen" placement="left" :show-mask="isShrink" :trap-focus="false"
    :mask-closable="isShrink" :z-index="100" width="320px" display-directive="show">
    <SideBarContent />
  </n-drawer>
</template>

<script setup lang="ts">
import SideBarContent from "./SideBarContent.vue"
import { lt800px as isShrink } from "@/utils/Responsive"
import { ui } from '@/store';
import { watch, onMounted } from "vue";

onMounted(() => { ui.isDrawerOpen = !isShrink.value })
watch(isShrink, () => {
  ui.isDrawerOpen = !isShrink.value
  console.debug(ui.isDrawerOpen)
})
</script>