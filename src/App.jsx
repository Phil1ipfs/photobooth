// src/App.jsx
import React, { useState, useCallback } from 'react';
import CameraBox from './components/CameraBox';
import Thumbnail from './components/Thumbnail';
import StripCustomizer from './components/StripCustomizer';
import StripPreview from './components/StripPreview';
import MusicPlayer from './components/MusicPlayer';
import './App.css';

const App = () => {
  const [photos, setPhotos] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('default');

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

  const handleTemplateChange = (templateId) => {
    setSelectedTemplate(templateId);
    console.log("Template changed to:", templateId);
  };

  const handleDownload = () => {
    if (photos.length === 0) {
      alert('No photos to download! Take some photos first.');
      return;
    }

    // Create canvas for photo strip
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (selectedTemplate === 'default') {
      // Default vertical strip layout
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
        
        // Add date/time at bottom
        ctx.fillStyle = '#666';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        const dateTime = `${new Date().toLocaleDateString()} • ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        ctx.fillText(dateTime, stripWidth / 2, totalHeight - 20);
        
        downloadStrip(canvas);
      });
    } else if (selectedTemplate === 'hearts') {
      // Hearts template (based on the provided image)
      const stripWidth = 400;
      const stripHeight = 800;
      const heartSize = 220;
      const heartSpacing = 25;  // Slightly increased spacing
      
      canvas.width = stripWidth;
      canvas.height = stripHeight;
      
      // Load background image first
      const bgImg = new Image();
      bgImg.onload = () => {
        // Draw the red background
        ctx.fillStyle = '#d10014';
        ctx.fillRect(0, 0, stripWidth, stripHeight);
        
        // Add header text "Making Memories"
        ctx.fillStyle = 'white';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("Making Memories", stripWidth / 2, 40);
        
        // Load and position the photos inside hearts
        const imagePromises = photos.slice(0, 3).map((photoSrc, index) => {
          return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ img, index });
            img.onerror = () => resolve({ img: null, index });
            img.src = photoSrc;
          });
        });
        
        Promise.all(imagePromises).then((results) => {
          // Draw heart frames and photos
          for (let i = 0; i < 3; i++) {
            const centerY = 130 + (i * (heartSize + heartSpacing));
            const centerX = stripWidth / 2;
            
            // Draw white heart frame
            drawHeartFrame(ctx, centerX, centerY, heartSize);
            
          // Find the corresponding image
            const result = results.find(r => r.index === i);
            if (result && result.img) {
              // Clip in heart shape and draw the photo
              clipHeart(ctx, centerX, centerY, heartSize - 5);
              
              // Scale and center the image to fit within the heart
              const scale = Math.min(
                (heartSize - 10) / result.img.width,
                (heartSize - 10) / result.img.height
              );
              
              const width = result.img.width * scale;
              const height = result.img.height * scale;
              const x = centerX - width / 2;
              const y = centerY - height / 2;
              
              // Draw the image (mirrored)
              ctx.save();
              ctx.scale(-1, 1);
              ctx.drawImage(result.img, -x - width, y, width, height);
              ctx.restore();
              
              ctx.restore(); // Restore after clipping
              
              // Draw the heart border on top
              drawHeartFrame(ctx, centerX, centerY, heartSize);
            }
          }
          
          // Add "Capture the Memories" text at bottom
          ctx.fillStyle = 'white';
          ctx.font = 'italic 24px serif';
          ctx.textAlign = 'center';
          ctx.fillText("Forever in our Hearts", stripWidth / 2, stripHeight - 40);
          
          // Add small date at bottom
          ctx.font = '14px sans-serif';
          ctx.fillText(new Date().toLocaleDateString(), stripWidth / 2, stripHeight - 20);
          
          downloadStrip(canvas);
        });
      };
      
      // Use a red background or load a custom background
      bgImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
    }
  };
  
  // Helper function to download the strip
  const downloadStrip = (canvas) => {
    const link = document.createElement('a');
    link.download = `photo-booth-strip-${selectedTemplate}-${new Date().getTime()}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Helper function to draw a heart frame
  const drawHeartFrame = (ctx, centerX, centerY, size) => {
    const halfSize = size / 2;
    
    // Draw only the white lace heart border without filling the background
    ctx.save();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 10;
    ctx.setLineDash([5, 3]);
    
    // Heart shape path
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - halfSize * 0.3);
    // Left curve
    ctx.bezierCurveTo(
      centerX - halfSize, centerY - halfSize, 
      centerX - halfSize, centerY + halfSize * 0.3, 
      centerX, centerY + halfSize
    );
    // Right curve
    ctx.bezierCurveTo(
      centerX + halfSize, centerY + halfSize * 0.3, 
      centerX + halfSize, centerY - halfSize, 
      centerX, centerY - halfSize * 0.3
    );
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  };
  
  // Helper function to clip in heart shape
  const clipHeart = (ctx, centerX, centerY, size) => {
    const halfSize = size / 2;
    
    ctx.save();
    // Heart shape clipping path - use full size
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - halfSize * 0.3);
    // Left curve
    ctx.bezierCurveTo(
      centerX - halfSize, centerY - halfSize, 
      centerX - halfSize, centerY + halfSize * 0.3, 
      centerX, centerY + halfSize
    );
    // Right curve
    ctx.bezierCurveTo(
      centerX + halfSize, centerY + halfSize * 0.3, 
      centerX + halfSize, centerY - halfSize, 
      centerX, centerY - halfSize * 0.3
    );
    ctx.closePath();
    ctx.clip();
  };

  // Create array of 4 slots, filling with photos or empty slots
  const photoSlots = Array.from({ length: 4 }, (_, index) => photos[index] || null);

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
          
          {/* Show template customizer when photos are available */}
          {photos.length > 0 && (
            <div className="strip-customizer">
              <h3>Choose a Template</h3>
              <div className="template-options">
                {[
                  { id: 'default', name: 'Classic Strip', icon: '📑' },
                  { id: 'hearts', name: 'Love Hearts', icon: '💖' }
                ].map(template => (
                  <button
                    key={template.id}
                    className={`template-option ${selectedTemplate === template.id ? 'selected' : ''}`}
                    onClick={() => handleTemplateChange(template.id)}
                  >
                    <span className="template-icon">{template.icon}</span>
                    <span className="template-name">{template.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <div className="date-time">
            {new Date().toLocaleDateString()} • {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </div>
          <button className="share-button" onClick={handleDownload}>
            <span>💾</span>
          </button>
        </div>
        
        {/* Preview section - always show when photos exist */}
        {photos.length > 0 && (
          <div className="preview-section">
            <h4>Preview</h4>
            <StripPreview 
              photos={photos}
              selectedTemplate={selectedTemplate}
            />
          </div>
        )}
      </div>
      
      {/* Background Music Player */}
      <MusicPlayer />
    </div>
  );
};

export default App;