import { cx } from '../lib/cx'

type Props = {
  hasModel: boolean
  loading: boolean
  error: string | null
  dragging: boolean
  onBrowse: () => void
}

export function UploadOverlay({ hasModel, loading, error, dragging, onBrowse }: Props) {
  return (
    <>
      {error && (
        <div className="banner" role="alert">
          {error}
        </div>
      )}
      {loading && (
        <div className="overlay" role="status">
          <p className="overlay-title">Reading model…</p>
        </div>
      )}
      {!loading && !hasModel && (
        <div className={cx('overlay', dragging && 'is-dragging')}>
          <div className="dropzone">
            <p className="overlay-title">Drop an STL, OBJ, GLB or PLY file</p>
            <p className="overlay-sub">Up to 50 MB. Parsed in your browser, never uploaded.</p>
            <button type="button" className="btn btn-primary" onClick={onBrowse}>
              Browse files
            </button>
          </div>
        </div>
      )}
      {!loading && hasModel && dragging && (
        <div className="overlay is-dragging">
          <p className="overlay-title">Drop to replace the model</p>
        </div>
      )}
    </>
  )
}
