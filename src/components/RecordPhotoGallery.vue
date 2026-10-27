<template>
  <n-image-group v-if="photos.length">
    <n-space :size="8" :wrap="true" class="record-photo-gallery">
      <n-image
        v-for="photo in photos"
        :key="photo.id"
        :src="photo.url"
        :alt="`处理照片 ${photo.position}`"
        :width="96"
        :height="96"
        object-fit="cover"
        class="record-photo-thumb"
      />
    </n-space>
  </n-image-group>
</template>

<script setup lang="ts">
import type API from '@/store/api'

defineProps<{
  photos: API.RecordPhoto[]
}>()
</script>

<style scoped>
.record-photo-gallery {
  margin-top: 10px;
}

.record-photo-thumb {
  overflow: hidden;
  border-radius: 6px;
  border: 1px solid var(--n-border-color, #eee);
}
</style>
