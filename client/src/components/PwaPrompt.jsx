import { useRegisterSW } from 'virtual:pwa-register/react'
import { GlassButton, GlassSurface } from './ui/Glass'

export default function PwaPrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <GlassSurface className="journal-update-prompt fixed left-4 right-4 sm:left-auto sm:right-4 sm:w-80 p-4 z-[100]">
      <p className="text-sm mb-3">有新版本可用</p>
      <div className="flex gap-2">
        <GlassButton
          onClick={() => updateServiceWorker(true)}
          variant="primary"
        >
          立即更新
        </GlassButton>
      </div>
    </GlassSurface>
  )
}
