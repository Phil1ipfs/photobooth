import React from 'react';
import Icon from '../common/Icon';
import Button from '../common/Button';

/** Live camera viewport with LIVE badge, framing corners, countdown and capture flash. */
export default function CameraPreview({ camera, aspect, mirror, countdown, shotLabel, flashing, recording = false, recordProgress = 0 }) {
  const { videoRef, status, error, retry } = camera;
  const ready = status === 'ready';

  return (
    <div className={`camera-view${ready ? ' is-live' : ''}${recording ? ' is-recording' : ''}`} style={{ '--aspect': aspect }}>
      <video
        ref={videoRef}
        className="camera-video"
        style={{ transform: mirror ? 'scaleX(-1)' : undefined }}
        autoPlay
        playsInline
        muted
        aria-label="Live camera preview"
      />

      {!ready && (
        <div className="camera-placeholder" role={status === 'loading' ? 'status' : 'alert'}>
          <span className={`camera-placeholder-icon${status === 'loading' ? ' pulsing' : ''}`}>
            <Icon name="camera" size={30} />
          </span>
          {status === 'loading' ? (
            <>
              <strong>Starting your camera…</strong>
              <p>Please allow camera access when your browser asks.</p>
            </>
          ) : (
            <>
              <strong>Camera unavailable</strong>
              <p>{error}</p>
              {status !== 'unsupported' && (
                <Button size="sm" variant="outline" icon="refresh" onClick={retry}>
                  Try Again
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {ready && countdown === 0 && !flashing && !recording && (
        <div className="camera-hint" aria-hidden="true">
          <span className="camera-hint-icon">
            <Icon name="camera" size={26} />
          </span>
          <strong>Your camera is ready!</strong>
          <span>Look at the camera and get ready for your next photo.</span>
        </div>
      )}

      <span className={`live-badge${ready ? '' : ' off'}`}>
        <i aria-hidden="true" />
        {ready ? 'LIVE' : 'OFF'}
      </span>
      <span className="corner tl" aria-hidden="true" />
      <span className="corner tr" aria-hidden="true" />
      <span className="corner bl" aria-hidden="true" />
      <span className="corner br" aria-hidden="true" />

      {countdown > 0 && (
        <div className="countdown" aria-live="assertive">
          <span key={countdown} className="countdown-num">
            {countdown}
          </span>
          <span className="countdown-label">{shotLabel}</span>
        </div>
      )}

      {recording && (
        <div className="rec-indicator" role="status">
          <span className="rec-pill">
            <i aria-hidden="true" /> REC · Live Strip
          </span>
          <span className="rec-bar" aria-hidden="true">
            <span style={{ transform: `scaleX(${recordProgress})` }} />
          </span>
        </div>
      )}

      {flashing && <div className="capture-flash" aria-hidden="true" />}
    </div>
  );
}
