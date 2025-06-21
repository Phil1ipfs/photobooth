// src/components/CameraBox.jsx
import React, { useRef, useState, useEffect, useCallback } from 'react';

const CameraBox = ({ onCapture, photoCount = 0, onReset }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  // Add a ref to track the latest photo count
  const photoCountRef = useRef(photoCount);
  // Add a ref to prevent rapid captures  
  const isCapturingRef = useRef(false);
  const [hasCamera, setHasCamera] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoCapturing, setIsAutoCapturing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  // Visual feedback state
  const [flashEffect, setFlashEffect] = useState(false);

  // Update the ref whenever photoCount changes from props
  useEffect(() => {
    photoCountRef.current = photoCount;
    console.log("Photo count updated to:", photoCount);
  }, [photoCount]);

  const startCamera = async () => {
    setIsLoading(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 800 },
          height: { ideal: 600 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        streamRef.current = mediaStream;
        
        // Force video to play
        videoRef.current.play().catch(console.error);
        
        // Set camera as available immediately
        setHasCamera(true);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setHasCamera(false);
      setIsLoading(false);
    }
  };

  const capture = useCallback(() => {
    // Prevent rapid multiple captures
    if (isCapturingRef.current) {
      console.log("Capture already in progress, ignoring");
      return;
    }
    
    if (videoRef.current) {
      console.log("Starting capture process...");
      isCapturingRef.current = true;
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      
      context.drawImage(videoRef.current, 0, 0);
      
      // Add timestamp to make each image unique
      const timestamp = Date.now();
      const imageSrc = canvas.toDataURL('image/png') + `#t${timestamp}`;
      
      console.log('Photo captured at:', timestamp, 'Current photo count:', photoCountRef.current);
      
      // Add flash effect
      setFlashEffect(true);
      setTimeout(() => setFlashEffect(false), 300);
      
      // Call the parent's onCapture to update thumbnails immediately
      onCapture(imageSrc);
      
      // Reset capture flag after a short delay
      setTimeout(() => {
        isCapturingRef.current = false;
        console.log("Capture process completed");
      }, 500);
    }
  }, [onCapture]);

  const handleResetClick = () => {
    console.log("Reset button clicked, current photo count:", photoCount);
    if (onReset) {
      onReset();
      // Also stop any ongoing auto capture
      if (isAutoCapturing) {
        stopAutoCapture();
      }
    } else {
      console.error("onReset function not provided");
    }
  };

  const handleSnapClick = () => {
    if (photoCount >= 4) {
      console.log("Taking another photo - resetting first, then taking photo");
      handleResetClick();
      // Take a photo after a short delay to ensure reset completes
      setTimeout(() => {
        capture();
      }, 100);
    } else {
      console.log("Taking regular photo");
      capture();
    }
  };

  const handleAutoClick = () => {
    if (photoCount >= 4) {
      console.log("Auto capture reset clicked - just resetting");
      handleResetClick();
    } else {
      console.log("Starting auto capture");
      startAutoCapture();
    }
  };

  const stopAutoCapture = useCallback(() => {
    console.log('Stopping auto capture, final photo count:', photoCountRef.current);
    setIsAutoCapturing(false);
    setCountdown(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startAutoCapture = () => {
    if (isAutoCapturing) {
      // Stop auto capture if already running
      stopAutoCapture();
      return;
    }

    // Don't start if we already have 4 photos
    if (photoCount >= 4) {
      console.log('Already have 4 photos, not starting auto capture');
      return;
    }

    console.log('Starting auto capture sequence, current photos:', photoCountRef.current);
    setIsAutoCapturing(true);
    setCountdown(3); // Start at 3 for quicker first photo
    
    // Function to handle countdown and capture
    const countdownAndCapture = () => {
      setCountdown(prevCountdown => {
        // If we already have 4 photos, stop the sequence
        if (photoCountRef.current >= 4) {
          stopAutoCapture();
          return 0;
        }

        const newCountdown = prevCountdown - 1;
        
        // When countdown reaches zero, take a photo
        if (newCountdown <= 0) {
          if (photoCountRef.current < 4 && !isCapturingRef.current) {
            console.log('Auto taking photo, current count:', photoCountRef.current);
            capture();
          }
          
          // If we now have 4 photos after the capture, stop
          if (photoCountRef.current + 1 >= 4) {
            setTimeout(() => stopAutoCapture(), 1000);
            return 0;
          }
          
          // Reset countdown for next photo
          return 3;
        }
        
        return newCountdown;
      });
    };
    
    // Do first countdown immediately
    countdownAndCapture();
    
    // Then set interval for remaining countdowns
    intervalRef.current = setInterval(countdownAndCapture, 1000);
  };

  // Stop auto capture when we reach 4 photos
  useEffect(() => {
    if (photoCount >= 4 && isAutoCapturing) {
      console.log('4 photos reached, stopping auto capture');
      stopAutoCapture();
    }
  }, [photoCount, isAutoCapturing, stopAutoCapture]);

  useEffect(() => {
    startCamera();
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <div className="camera-box">
      <div className="camera-viewport">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="camera-video"
          style={{ display: hasCamera ? 'block' : 'none' }}
        />
        {(!hasCamera || isLoading) && (
          <div className="camera-placeholder">
            <div className="camera-icon">📷</div>
            <p>{isLoading ? 'Loading camera...' : 'Click "Allow" to enable camera access'}</p>
            <button onClick={startCamera} className="retry-button">
              Try Again
            </button>
          </div>
        )}
        
        {/* Countdown Overlay */}
        {isAutoCapturing && countdown > 0 && (
          <div className="countdown-overlay">
            <div className="countdown-number">{countdown}</div>
            <div className="countdown-text">
              Get Ready! ({photoCount}/4)
            </div>
          </div>
        )}
        
        {/* Flash effect */}
        {flashEffect && (
          <div 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'white',
              opacity: 0.7,
              animation: 'flash 0.3s ease-out',
              pointerEvents: 'none',
              borderRadius: '1rem',
              zIndex: 200
            }}
          />
        )}
      </div>
      
      {/* Button Container with both buttons */}
      <div className="button-container">
        <button 
          className="snap-button" 
          onClick={handleSnapClick} 
          disabled={isAutoCapturing}
        >
          {photoCount >= 4 ? 'TAKE PHOTO' : 'TAKE A PHOTO'}
        </button>
        <button 
          className={`auto-capture-button ${isAutoCapturing ? 'active' : ''}`}
          onClick={handleAutoClick}
          disabled={false}
        >
          {photoCount >= 4 
            ? 'CLEAR ALL PHOTOS' 
            : isAutoCapturing 
              ? `STOP AUTO (${photoCount}/4)` 
              : 'AUTO CAPTURE'}
        </button>
      </div>
    </div>
  );
};

export default CameraBox;