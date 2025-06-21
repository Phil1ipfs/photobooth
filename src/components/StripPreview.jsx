// src/components/StripPreview.jsx
import React, { useEffect, useRef } from 'react';

const StripPreview = ({ photos, selectedTemplate }) => {
  const canvasRef = useRef(null);
  
  // Draw the preview whenever photos or template changes
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (photos.length === 0) {
      // Show placeholder if no photos
      drawPlaceholder(ctx, canvas.width, canvas.height);
      return;
    }
    
    // Load images first
    const imagePromises = photos.map((photoSrc, index) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ img, index });
        img.onerror = () => resolve({ img: null, index });
        img.src = photoSrc;
      });
    });
    
    Promise.all(imagePromises).then((results) => {
      if (selectedTemplate === 'default') {
        drawClassicPreview(ctx, results, canvas.width, canvas.height);
      } else if (selectedTemplate === 'hearts') {
        drawHeartsPreview(ctx, results, canvas.width, canvas.height);
      }
    });
  }, [photos, selectedTemplate]);
  
  // Function to draw placeholder
  const drawPlaceholder = (ctx, width, height) => {
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, width, height);
    
    ctx.fillStyle = '#ccc';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Take photos to see preview', width / 2, height / 2);
  };
  
  // Function to draw classic strip preview
  const drawClassicPreview = (ctx, results, width, height) => {
    // Draw white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    const photoHeight = height / 5; // Leave space for date at bottom
    const photoWidth = width * 0.9;
    const xOffset = (width - photoWidth) / 2;
    const spacing = 10;
    
    // Draw photos
    for (let i = 0; i < 4; i++) {
      const y = 20 + (i * (photoHeight + spacing));
      
      // Draw photo background
      ctx.fillStyle = '#fdf6e3';
      ctx.fillRect(xOffset, y, photoWidth, photoHeight);
      
      // Add subtle border
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;
      ctx.strokeRect(xOffset, y, photoWidth, photoHeight);
      
      const result = results.find(r => r.index === i);
      if (result && result.img) {
        // Draw actual photo (mirrored)
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(
          result.img, 
          -xOffset - photoWidth, 
          y, 
          photoWidth, 
          photoHeight
        );
        ctx.restore();
      }
    }
    
    // Add date at bottom
    ctx.fillStyle = '#666';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    const dateTime = new Date().toLocaleDateString();
    ctx.fillText(dateTime, width / 2, height - 20);
  };
  
  // Function to draw hearts preview
  const drawHeartsPreview = (ctx, results, width, height) => {
    // Draw red background
    ctx.fillStyle = '#d10014';
    ctx.fillRect(0, 0, width, height);
    
    // Add header
    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("Making Memories", width / 2, 30);
    
    const heartSize = width * 0.8;
    const spacing = 20;
    
    // Draw hearts and photos
    for (let i = 0; i < 3; i++) {
      const centerY = 80 + (i * (heartSize + spacing));
      const centerX = width / 2;
      
      // Draw photos inside heart-shaped clipping paths
      const result = results.find(r => r.index === i);
      if (result && result.img) {
        ctx.save();
        
        // Create heart-shaped clipping path
        const halfSize = heartSize / 2;
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
        
        // Draw photo (scaled and centered)
        const scale = Math.min(
          heartSize * 0.95 / result.img.width,
          heartSize * 0.95 / result.img.height
        );
        
        const width = result.img.width * scale;
        const height = result.img.height * scale;
        const x = centerX - width / 2;
        const y = centerY - height / 2;
        
        // Mirror the image
        ctx.scale(-1, 1);
        ctx.drawImage(result.img, -x - width, y, width, height);
        
        ctx.restore();
      }
      
      // Draw heart outline over the photo
      drawHeartOutline(ctx, centerX, centerY, heartSize);
    }
    
    // Add footer text
    ctx.fillStyle = 'white';
    ctx.font = 'italic 14px serif';
    ctx.textAlign = 'center';
    ctx.fillText("Forever in our Hearts", width / 2, height - 25);
  };
  
  // Helper function to draw just the heart outline
  const drawHeartOutline = (ctx, centerX, centerY, size) => {
    const halfSize = size / 2;
    
    ctx.save();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 2]);
    
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
  
  return (
    <div className="strip-preview">
      <canvas 
        ref={canvasRef} 
        width={180} 
        height={550} 
        className="preview-canvas"
      />
    </div>
  );
};

export default StripPreview;