// src/components/MusicPlayer.jsx
import React, { useState, useRef, useEffect } from 'react';
// Import the audio file from assets folder
import backgroundMusic from '../assets/loose.mp3';


const MusicPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [showControls, setShowControls] = useState(false);
  const audioRef = useRef(null);

  // Song information
  const defaultSong = {
    title: "Loose",
    artist: "Daniel Caesar",
    // Use the imported audio file
    url: backgroundMusic
  };

  useEffect(() => {
    // Apply volume setting whenever it changes
    
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(error => {
          console.error("Error playing audio:", error);
          alert("Couldn't play the music. Please check if the audio file exists in your assets folder uwu.");
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
  };

  return (
    <div className="music-player">
      {/* Hidden audio element */}
      <audio 
        ref={audioRef}
        src={defaultSong.url}
        loop
        onEnded={() => setIsPlaying(false)}
      />

      {/* Floating music button */}
      <div 
        className="music-toggle"
        onClick={() => setShowControls(!showControls)}
      >
        <span className="music-icon">🎵</span>
      </div>

      {/* Expanded music controls */}
      {showControls && (
        <div className="music-controls">
          <div className="song-info">
            <div className="song-title">{defaultSong.title}</div>
            <div className="song-artist">{defaultSong.artist}</div>
          </div>
          
          <div className="player-controls">
            <button 
              className={`play-button ${isPlaying ? 'playing' : ''}`}
              onClick={togglePlay}
            >
              {isPlaying ? '❚❚' : '▶'}
            </button>
            
            <div className="volume-control">
              <span className="volume-icon">🔊</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="volume-slider"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MusicPlayer;