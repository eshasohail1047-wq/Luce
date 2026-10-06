import { useEffect, useRef, useState } from 'react'

export default function DemoVideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onTime = () => {
      if (!video.duration) return
      setProgress(video.currentTime / video.duration)
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)

    video.addEventListener('timeupdate', onTime)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    return () => {
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
    }
  }, [])

  const toggle = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) void video.play()
    else video.pause()
  }

  return (
    <div className="demo-player">
      <div className="demo-player-stage">
        <video
          ref={videoRef}
          className="demo-player-video"
          src="/videos/demo.mp4"
          poster="/images/demo-poster.jpg"
          playsInline
          preload="metadata"
          onClick={toggle}
        />
        {!playing && (
          <button type="button" className="demo-player-overlay" onClick={toggle} aria-label="Play demo">
            <span className="demo-player-play">▶</span>
            <span>Watch how LUCE works</span>
          </button>
        )}
      </div>

      <div className="demo-walk-controls">
        <button
          type="button"
          className="control-play"
          onClick={toggle}
          aria-label={playing ? 'Pause demo' : 'Play demo'}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <div className="control-track" aria-hidden="true">
          <span style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="demo-walk-caption">Product demo</span>
      </div>
    </div>
  )
}
