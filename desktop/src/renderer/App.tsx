import VideoPlayer from './VideoPlayer'
import SettingsPage from './SettingsPage'

export default function App() {
  if (window.location.hash === '#settings') {
    return <SettingsPage />
  }

  return <VideoPlayer />
}
