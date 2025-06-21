// src/App.jsx
import React, { useState, useCallback } from 'react';
import CameraBox from './components/CameraBox';
import Thumbnail from './components/Thumbnail';
import './App.css';

const App = () => {
  const [photos, setPhotos] = useState([]);

  // Reset function to clear all photos
  const handleReset = useCallback(() => {
    console.log("RESET CALLED - Clearing all photos");
    setPhotos([]);
    console.log("RESET COMPLETED - Photos array cleared");
  }, []);

  // Use useCallback to prevent unnecessary re-renders
  const handleCapture = useCallback((imageSrc) => {
    // Use functional update to ensure we're working with the latest state
    setPhotos(currentPhotos => {
      console.log("handleCapture called - Current count:", currentPhotos.length, "New photo:", imageSrc.substring(0, 50) + "...");
      
      // Check if this exact image already exists (prevent duplicates)
      if (currentPhotos.includes(imageSrc)) {
        console.log("Duplicate photo detected, ignoring");
        return currentPhotos;
      }
      
      // Create a new array with the new photo added at the end
      const updatedPhotos = [...currentPhotos, imageSrc];
      console.log("Photos array updated, new length:", updatedPhotos.length);
      // Keep only the first 4 photos
      return updatedPhotos.slice(0, 4);
    });
  }, []);

  const handleDownload = () => {
    if (photos.length === 0) {
      alert('No photos to download! Take some photos first.');
      return;
    }

    // Create canvas for photo strip
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas dimensions to match the vertical strip format
    const stripWidth = 360;
    const photoWidth = 320;
    const photoHeight = 240;
    const padding = 20;
    const photoSpacing = 15;
    const footerHeight = 60;
    const totalHeight = (photoHeight * 4) + (photoSpacing * 3) + (padding * 2) + footerHeight;
    
    canvas.width = stripWidth;
    canvas.height = totalHeight;
    
    // Fill background with light gray/white
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(0, 0, stripWidth, totalHeight);
    
    const downloadStrip = () => {
      // Add date/time at bottom
      ctx.fillStyle = '#666';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      const dateTime = `${new Date().toLocaleDateString()} • ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
      ctx.fillText(dateTime, stripWidth / 2, totalHeight - 20);
      
      // Download the strip
      const link = document.createElement('a');
      link.download = `photo-booth-strip-${new Date().getTime()}.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    
    // Load images using Promise.all to avoid loop issues
    const imagePromises = photos.slice(0, 4).map((photoSrc, index) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ img, index });
        img.onerror = () => resolve({ img: null, index });
        img.src = photoSrc;
      });
    });
    
    Promise.all(imagePromises).then((results) => {
      // Draw all 4 photo slots
      for (let i = 0; i < 4; i++) {
        const y = padding + (i * (photoHeight + photoSpacing));
        const x = (stripWidth - photoWidth) / 2;
        
        // Draw photo background
        ctx.fillStyle = '#fdf6e3';
        ctx.fillRect(x, y, photoWidth, photoHeight);
        
        const result = results.find(r => r.index === i);
        if (result && result.img) {
          // Draw actual photo (mirrored to match UI)
          ctx.save();
          ctx.scale(-1, 1);
          ctx.drawImage(result.img, -x - photoWidth, y, photoWidth, photoHeight);
          ctx.restore();
        } else if (i >= photos.length) {
          // Draw placeholder for empty slots
          ctx.fillStyle = '#e0e0e0';
          ctx.fillRect(x, y, photoWidth, photoHeight);
          
          // Draw camera placeholder icon
          ctx.fillStyle = '#ccc';
          ctx.font = '40px serif';
          ctx.textAlign = 'center';
          ctx.fillText('📷', stripWidth / 2, y + photoHeight / 2 + 15);
        }
      }
      
      downloadStrip();
    });
    
    // If no photos, just create empty strip
    if (photos.length === 0) {
      for (let i = 0; i < 4; i++) {
        const y = padding + (i * (photoHeight + photoSpacing));
        const x = (stripWidth - photoWidth) / 2;
        
        ctx.fillStyle = '#e0e0e0';
        ctx.fillRect(x, y, photoWidth, photoHeight);
        
        ctx.fillStyle = '#ccc';
        ctx.font = '40px serif';
        ctx.textAlign = 'center';
        ctx.fillText('📷', stripWidth / 2, y + photoHeight / 2 + 15);
      }
      downloadStrip();
    }
  };

  // Create array of 4 slots, filling with photos or empty slots
  const photoSlots = Array.from({ length: 4 }, (_, index) => photos[index] || null);

  // For debugging
  console.log("Current photos array:", photos);

  return (
    <div className="app-wrapper">
      <div className="app-container">
        <div className="camera-section">
          {/* Pass the current photo count and reset function to CameraBox */}
          <CameraBox onCapture={handleCapture} photoCount={photos.length} onReset={handleReset} />
        </div>
        
        <div className="photo-strip">
          <div className="thumbnail-container">
            {photoSlots.map((src, index) => (
              <Thumbnail key={`thumbnail-${index}`} src={src} index={index} />
            ))}
          </div>
          <div className="date-time">
            {new Date().toLocaleDateString()} • {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </div>
          <button className="share-button" onClick={handleDownload}>
            <span>💾</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;