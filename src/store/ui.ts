import { reactive } from 'vue'

// Pure UI shell state. No network, so it is not part of the refresh registry.
const ui = reactive({
  isDrawerOpen: false,
  drawerScroll: 0,
})

export default ui
