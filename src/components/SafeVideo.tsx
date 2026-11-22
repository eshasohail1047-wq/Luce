import { useEffect, useState, type VideoHTMLAttributes } from 'react'

type SafeVideoProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, 'onError'> & {
  /** Seconds before we treat a stuck buffer as a hard failure */
  loadTimeoutSec?: number
  onFatalError?: (message: string) => void
}

/**
 * <video> that stops the eternal buffering spinner and surfaces a clear error.
 */
export default function SafeVideo({
  src,
  poster,
  loadTimeoutSec = 45,
  onFatalError,
  className,
  ...rest
}: SafeVideoProps) {
  const [failed, setFailed] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setFailed(false)
    setMessage(null)
  }, [src])

  useEffect(() => {
    if (!src || failed) return
    const timer = window.setTimeout(() => {
      setFailed(true)
      const msg =
        'Video is taking too long to load. Tap Recreate, or Export if the file is ready.'
      setMessage(msg)
      onFatalError?.(msg)
    }, Math.max(8, loadTimeoutSec) * 1000)
    return () => window.clearTimeout(timer)
  }, [src, failed, loadTimeoutSec, onFatalError])

  if (!src) return null

  if (failed) {
    return (
      <div className={`safe-video-fail${className ? ` ${className}` : ''}`} role="alert">
        {poster ? <img src={poster} alt="" /> : null}
        <p>{message || 'Could not play this video.'}</p>
      </div>
    )
  }

  return (
    <video
      {...rest}
      className={className}
      src={src}
      poster={poster}
      onLoadedData={(e) => {
        setFailed(false)
        setMessage(null)
        rest.onLoadedData?.(e)
      }}
      onCanPlay={(e) => {
        setFailed(false)
        setMessage(null)
        rest.onCanPlay?.(e)
      }}
      onError={() => {
        const msg =
          'This clip could not be played (link expired or file missing). Tap Recreate to generate again.'
        setFailed(true)
        setMessage(msg)
        onFatalError?.(msg)
      }}
    />
  )
}
