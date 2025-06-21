// src/components/Thumbnail.jsx
import React from 'react';

const Thumbnail = ({ src }) => {
  return (
    <div className="thumbnail">
      {src && <img src={src} alt="Snapshot" />}
    </div>
  );
};

export default Thumbnail;
