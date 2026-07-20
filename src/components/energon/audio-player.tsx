import { useEffect, useRef, useState } from 'react'
import { AudioLines, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'

const compactWaveform = [
  34, 52, 76, 46, 68, 88, 58, 38, 72, 96, 62, 44, 82, 66, 42, 74, 90, 54,
  70, 36, 58, 84, 64, 48,
] as const

const detailWaveform = [
  ...compactWaveform,
  ...[...compactWaveform].reverse(),
]

type EnergonAudioPlayerProps = {
  src: string
  detailed?: boolean
  autoPlay?: boolean
  className?: string
}

export function EnergonAudioPlayer({
  src,
  detailed = false,
  autoPlay = false,
  className,
}: EnergonAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [unavailable, setUnavailable] = useState(!src)
  const progress = duration > 0 ? currentTime / duration : 0
  const waveform = detailed ? detailWaveform : compactWaveform

  useEffect(() => {
    const audio = audioRef.current
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setVolume(1)
    setMuted(false)
    setUnavailable(!src)
    if (audio) {
      audio.pause()
      audio.volume = 1
      audio.muted = false
    }
    return () => audio?.pause()
  }, [src])

  const togglePlayback = () => {
    const audio = audioRef.current
    if (!audio || unavailable) {
      return
    }
    if (!audio.paused) {
      audio.pause()
      return
    }
    if (audio.ended) {
      audio.currentTime = 0
    }
    void audio.play().catch(() => setPlaying(false))
  }

  const updateDuration = () => {
    const nextDuration = audioRef.current?.duration || 0
    setDuration(Number.isFinite(nextDuration) ? nextDuration : 0)
  }

  const seek = (nextTime: number) => {
    const audio = audioRef.current
    if (!audio || duration <= 0) {
      return
    }
    audio.currentTime = nextTime
    setCurrentTime(nextTime)
  }

  const toggleMute = () => {
    const audio = audioRef.current
    if (!audio) {
      return
    }
    audio.muted = !audio.muted
    setMuted(audio.muted)
  }

  const changeVolume = (nextVolume: number) => {
    const audio = audioRef.current
    if (!audio) {
      return
    }
    audio.volume = nextVolume
    audio.muted = nextVolume === 0
    setVolume(nextVolume)
    setMuted(audio.muted)
  }

  return (
    <div
      className={cn(
        'box-border flex w-full min-w-0 flex-col justify-end bg-muted/40 text-primary',
        detailed
          ? 'min-h-52 gap-6 rounded-lg border px-5 pb-6 pt-8 shadow-sm sm:px-8'
          : 'min-h-36 gap-4 rounded-lg border px-4 pb-4 pt-5',
        unavailable && 'items-center justify-center gap-2 text-muted-foreground',
        className
      )}
      data-state={unavailable ? 'unavailable' : playing ? 'playing' : 'paused'}
    >
      {unavailable ? (
        <>
          <AudioLines aria-hidden="true" className="size-7" />
          <span className="text-xs">音频暂不可播放</span>
        </>
      ) : (
        <>
          <div
            className={cn(
              'relative flex items-center rounded-md outline outline-1 outline-transparent focus-within:outline-primary/40 focus-within:outline-offset-4',
              detailed ? 'min-h-24' : 'min-h-14'
            )}
          >
            <div
              aria-hidden="true"
              className={cn(
                'flex w-full items-center',
                detailed ? 'h-[68px] gap-1' : 'h-11 gap-[3px]'
              )}
            >
              {waveform.map((height, index) => (
                <i
                  key={`${height}-${index}`}
                  className={cn(
                    'block min-w-0.5 flex-1 rounded-full bg-border transition-colors duration-100',
                    (index + 1) / waveform.length <= progress && 'bg-primary'
                  )}
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
            <input
              type="range"
              min="0"
              max={Math.max(duration, 0.01)}
              step="0.01"
              value={Math.min(currentTime, duration || 0)}
              disabled={duration <= 0}
              onChange={(event) => seek(Number(event.currentTarget.value))}
              className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-default"
              aria-label="音频播放进度"
              aria-valuetext={`${formatAudioTime(currentTime)} / ${formatAudioTime(duration)}`}
            />
          </div>
          <div className="flex min-h-9 items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
            <button
              type="button"
              onClick={togglePlayback}
              className={cn(
                'mr-1.5 inline-flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40',
                detailed ? 'size-10' : 'size-9'
              )}
              title={playing ? '暂停' : '播放'}
              aria-label={playing ? '暂停音频' : '播放音频'}
            >
              {playing ? (
                <Pause aria-hidden="true" className="size-4" />
              ) : (
                <Play aria-hidden="true" className="size-4 translate-x-px" />
              )}
            </button>
            <span>{formatAudioTime(currentTime)}</span>
            <span aria-hidden="true">/</span>
            <span>{duration > 0 ? formatAudioTime(duration) : '--:--'}</span>
            {detailed ? (
              <div className="ml-auto inline-flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="inline-flex size-9 items-center justify-center rounded-full bg-background/80 text-primary transition-colors hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40"
                  title={muted ? '恢复声音' : '静音'}
                  aria-label={muted ? '恢复声音' : '静音'}
                >
                  {muted ? (
                    <VolumeX aria-hidden="true" className="size-4" />
                  ) : (
                    <Volume2 aria-hidden="true" className="size-4" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={muted ? 0 : volume}
                  onChange={(event) => changeVolume(Number(event.currentTarget.value))}
                  className="w-16 cursor-pointer accent-primary sm:w-24"
                  aria-label="音量"
                />
              </div>
            ) : null}
          </div>
        </>
      )}
      <audio
        ref={audioRef}
        src={src || undefined}
        autoPlay={autoPlay}
        preload={autoPlay ? 'auto' : 'metadata'}
        className="hidden"
        onLoadedMetadata={updateDuration}
        onDurationChange={updateDuration}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setCurrentTime(duration)
        }}
        onVolumeChange={(event) => {
          setVolume(event.currentTarget.volume)
          setMuted(event.currentTarget.muted || event.currentTarget.volume === 0)
        }}
        onError={() => {
          setPlaying(false)
          setUnavailable(true)
        }}
      />
    </div>
  )
}

function formatAudioTime(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return '0:00'
  }
  const seconds = Math.floor(value)
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}
