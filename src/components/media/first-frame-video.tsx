import {
  useRef,
  type Ref,
  type SyntheticEvent,
  type VideoHTMLAttributes,
} from 'react'

const FIRST_FRAME_OFFSET_SECONDS = 0.01

type FirstFrameVideoProps = VideoHTMLAttributes<HTMLVideoElement> & {
  videoRef?: Ref<HTMLVideoElement>
  onFirstFrameReady?: (video: HTMLVideoElement) => void
}

function seekToFirstFrame(video: HTMLVideoElement) {
  if (
    video.readyState < HTMLMediaElement.HAVE_METADATA ||
    video.seeking ||
    !Number.isFinite(video.duration)
  ) {
    return
  }

  const duration = video.duration
  const target =
    Number.isFinite(duration) && duration > 0
      ? Math.min(FIRST_FRAME_OFFSET_SECONDS, duration / 2)
      : FIRST_FRAME_OFFSET_SECONDS

  if (video.currentTime >= target) return

  try {
    video.currentTime = target
  } catch {
    // Some streaming sources are not seekable until more data is available.
  }
}

export function FirstFrameVideo({
  src,
  videoRef,
  poster,
  preload = 'metadata',
  onLoadedMetadata,
  onLoadedData,
  onSeeked,
  onFirstFrameReady,
  ...props
}: FirstFrameVideoProps) {
  const readySrcRef = useRef('')
  const hasPoster = Boolean(poster?.trim())

  function notifyFirstFrameReady(video: HTMLVideoElement) {
    if (
      video.seeking ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0
    ) {
      return
    }
    const currentSrc = src || video.currentSrc
    if (readySrcRef.current === currentSrc) return
    readySrcRef.current = currentSrc
    onFirstFrameReady?.(video)
  }

  function handleLoadedMetadata(event: SyntheticEvent<HTMLVideoElement>) {
    onLoadedMetadata?.(event)
    if (!hasPoster) {
      seekToFirstFrame(event.currentTarget)
    }
  }

  function handleLoadedData(event: SyntheticEvent<HTMLVideoElement>) {
    onLoadedData?.(event)
    const video = event.currentTarget
    if (!hasPoster) {
      seekToFirstFrame(video)
    }
    notifyFirstFrameReady(video)
  }

  function handleSeeked(event: SyntheticEvent<HTMLVideoElement>) {
    onSeeked?.(event)
    notifyFirstFrameReady(event.currentTarget)
  }

  return (
    <video
      {...props}
      ref={videoRef}
      src={src}
      poster={poster}
      preload={preload}
      onLoadedMetadata={handleLoadedMetadata}
      onLoadedData={handleLoadedData}
      onSeeked={handleSeeked}
    />
  )
}
