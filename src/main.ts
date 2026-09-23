import { createApp } from 'vue'
import "./assets/base.css"
import App from './App.vue'
import router from './router'
import Auth from './utils/Auth'
import Sync from './utils/Sync'
import { rooms } from './store'

const app = createApp(App)

app.use(router)

// Preload the room list before mounting so FilterPanel's onMounted sees a
// populated rooms.state.list (child mounted hooks run before the app mounts).
const bootstrap = async () => {
  try {
    await Auth.ready()
    await rooms.load()
  } catch (e) {
    // Still mount on failure; the filter falls back to "全部".
    console.error('room preload failed', e)
  }
  // Poll backend change counters in the background now that we are logged in.
  Sync.start()
  app.mount('#app')
}

bootstrap()
