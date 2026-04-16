import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import exifr from 'exifr';
import { PhotoMarker, UserSummary, PinTag, MemoryPost } from './types';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'WherEYOUAT-env-1.eba-9r3y67qk.ap-northeast-2.elasticbeanstalk.com/api';
const defaultPosition: [number, number] = [20, 0];

const createIcon = (photoUrl: string, count: number) => {
  return L.divIcon({
    className: 'photo-marker',
    html: `
      <div class="photo-marker-inner">
        <img src="${photoUrl}" alt="photo" />
        ${count > 1 ? `<div class="badge">${count}</div>` : ''}
      </div>
    `,
    iconSize: [60, 60],
    iconAnchor: [30, 60],
    popupAnchor: [0, -60],
  });
};

function App() {
  const [markers, setMarkers] = useState<PhotoMarker[]>([]);
  const [friends, setFriends] = useState<UserSummary[]>([]);
  const [following, setFollowing] = useState<UserSummary[]>([]);
  const [pins, setPins] = useState<PinTag[]>([]);
  const [memories, setMemories] = useState<MemoryPost[]>([]);
  const [search, setSearch] = useState('');
  const [friendQuery, setFriendQuery] = useState('');
  const [selectedMarker, setSelectedMarker] = useState<PhotoMarker | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState('');
  const [newPin, setNewPin] = useState({ title: '', description: '', latitude: '', longitude: '', taggedNames: '' });
  const [newMemory, setNewMemory] = useState({ title: '', body: '', photoUrl: '' });

  useEffect(() => {
    fetchMarkers();
    fetch(`${API_BASE}/pins`).then((res) => res.json()).then(setPins);
    fetch(`${API_BASE}/memories`).then((res) => res.json()).then(setMemories);
    fetch(`${API_BASE}/users/search?query=jiwoo`).then((res) => res.json()).then(setFriends);
  }, []);

  const fetchMarkers = async () => {
    try {
      const response = await fetch(`${API_BASE}/map`);
      if (!response.ok) {
        throw new Error('Unable to fetch map markers');
      }
      const data = await response.json();
      setMarkers(data);
    } catch (error) {
      console.error(error);
      setUploadStatus('Failed to load map markers.');
    }
  };

  const filteredFriends = useMemo(() => {
    return friends.filter((friend) => friend.name.toLowerCase().includes(friendQuery.toLowerCase()));
  }, [friends, friendQuery]);

  const parseGpsFromFile = async (file: File) => {
    const gps = await exifr.gps(file);
    if (!gps?.latitude || !gps?.longitude) {
      return null;
    }
    return { latitude: gps.latitude, longitude: gps.longitude };
  };

  const dataUrlFromFile = (file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleUpload = async () => {
    if (!uploadFiles.length) {
      setUploadStatus('Please select one or more photos first.');
      return;
    }

    setUploadStatus('Uploading images...');
    const results = await Promise.all(
      uploadFiles.map(async (file) => {
        try {
          const coords = await parseGpsFromFile(file);
          if (!coords) {
            return { status: 'failed', file: file.name, reason: 'No GPS metadata' };
          }
          const imageUrl = await dataUrlFromFile(file);
          const payload = {
            title: file.name,
            imageUrl,
            latitude: coords.latitude,
            longitude: coords.longitude,
            description: 'Uploaded from map uploader',
          };
          const response = await fetch(`${API_BASE}/photos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const errorText = await response.text();
            return { status: 'failed', file: file.name, reason: errorText || 'Upload failed' };
          }
          return { status: 'ok', file: file.name };
        } catch (err) {
          console.error(err);
          return { status: 'failed', file: file.name, reason: 'Upload error' };
        }
      })
    );

    const failed = results.filter((item) => item.status === 'failed');
    if (failed.length) {
      setUploadStatus(`${failed.length} photos failed: ${failed.map((item) => `${item.file} (${item.reason})`).join(', ')}`);
    } else {
      setUploadStatus('Upload complete. Map updated.');
    }
    setUploadFiles([]);
    await fetchMarkers();
  };

  const handleFileChange = (files: FileList | null) => {
    if (!files) return;
    setUploadFiles(Array.from(files));
    setUploadStatus(`${files.length} files selected`);
  };

  const addPin = async () => {
    const payload = {
      title: newPin.title,
      description: newPin.description,
      latitude: Number(newPin.latitude),
      longitude: Number(newPin.longitude),
      taggedNames: newPin.taggedNames.split(',').map((name) => name.trim()).filter(Boolean),
    };
    const res = await fetch(`${API_BASE}/pins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const created = await res.json();
    setPins((prev) => [...prev, created]);
    setNewPin({ title: '', description: '', latitude: '', longitude: '', taggedNames: '' });
  };

  const shareMemory = async () => {
    const payload = {
      title: newMemory.title,
      body: newMemory.body,
      photoUrl: newMemory.photoUrl,
    };
    const res = await fetch(`${API_BASE}/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const created = await res.json();
    setMemories((prev) => [created, ...prev]);
    setNewMemory({ title: '', body: '', photoUrl: '' });
  };

  const searchFriends = async () => {
    const res = await fetch(`${API_BASE}/users/search?query=${encodeURIComponent(search)}`);
    setFriends(await res.json());
  };

  const follow = async (userId: string) => {
    const res = await fetch(`${API_BASE}/users/${userId}/follow`, { method: 'POST' });
    const body = await res.json();
    if (body.followed) {
      const updated = friends.map((user) => user.id === userId ? { ...user, following: user.following + 1 } : user);
      setFriends(updated);
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="section">
          <h2>Upload Photos</h2>
          <p className="section-subtitle">Select images with GPS metadata to place them on the map.</p>
          <input type="file" multiple accept="image/*" onChange={(e) => handleFileChange(e.target.files)} />
          <button className="upload-button" onClick={handleUpload} disabled={!uploadFiles.length}>
            Upload selected files
          </button>
          {uploadFiles.length > 0 && (
            <div className="selected-files">
              {uploadFiles.map((file) => (
                <span key={file.name}>{file.name}</span>
              ))}
            </div>
          )}
          <p className="status-text">{uploadStatus}</p>
        </div>

        <div className="section">
          <h2>Find Friends</h2>
          <p className="section-subtitle">Search people and follow them to see their activity.</p>
          <div className="search-row">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name" />
            <button onClick={searchFriends}>Search</button>
          </div>
          <div className="friend-list">
            {filteredFriends.map((friend) => (
              <div key={friend.id} className="friend-card">
                <img src={friend.avatarUrl} alt={friend.name} />
                <div>
                  <p>{friend.name}</p>
                  <small>{friend.followers} followers</small>
                </div>
                <button onClick={() => follow(friend.id)}>Follow</button>
              </div>
            ))}
          </div>
        </div>

        <div className="section">
          <h2>Following</h2>
          <div className="friend-list">
            {following.length ? following.map((user) => (
              <div key={user.id} className="friend-card">
                <img src={user.avatarUrl} alt={user.name} />
                <div>
                  <p>{user.name}</p>
                  <small>{user.followers} followers</small>
                </div>
              </div>
            )) : <p>No following users yet.</p>}
          </div>
        </div>

        <div className="section">
          <h2>Pin Tags</h2>
          <p className="section-subtitle">Tag friends on the map and save your favorite places.</p>
          <div className="pin-form">
            <input placeholder="Title" value={newPin.title} onChange={(e) => setNewPin({ ...newPin, title: e.target.value })} />
            <textarea placeholder="Description" value={newPin.description} onChange={(e) => setNewPin({ ...newPin, description: e.target.value })} />
            <input placeholder="Latitude" value={newPin.latitude} onChange={(e) => setNewPin({ ...newPin, latitude: e.target.value })} />
            <input placeholder="Longitude" value={newPin.longitude} onChange={(e) => setNewPin({ ...newPin, longitude: e.target.value })} />
            <input placeholder="Tagged friends (comma separated)" value={newPin.taggedNames} onChange={(e) => setNewPin({ ...newPin, taggedNames: e.target.value })} />
            <button onClick={addPin}>Add Pin</button>
          </div>
          <div className="pin-list">
            {pins.map((pin) => (
              <div key={pin.id} className="pin-card">
                <strong>{pin.title}</strong>
                <p>{pin.description}</p>
                <small>Tagged: {pin.taggedNames.join(', ')}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="section">
          <h2>Memories</h2>
          <p className="section-subtitle">Share your memories with friends and keep the moments alive.</p>
          <div className="memory-form">
            <input placeholder="Title" value={newMemory.title} onChange={(e) => setNewMemory({ ...newMemory, title: e.target.value })} />
            <textarea placeholder="Story" value={newMemory.body} onChange={(e) => setNewMemory({ ...newMemory, body: e.target.value })} />
            <input placeholder="Photo URL" value={newMemory.photoUrl} onChange={(e) => setNewMemory({ ...newMemory, photoUrl: e.target.value })} />
            <button onClick={shareMemory}>Share memory</button>
          </div>
          <div className="memory-list">
            {memories.map((memory) => (
              <div key={memory.id} className="memory-card">
                <img src={memory.photoUrl} alt={memory.title} />
                <div>
                  <h3>{memory.title}</h3>
                  <p>{memory.body}</p>
                  <small>{new Date(memory.createdAt).toLocaleDateString()}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="map-area">
        <div className="map-topbar">
          <div>
            <h1>WhereYouAt</h1>
            <p>Global map loaded in English style. Upload photos and pin favorite moments.</p>
          </div>
        </div>
        <MapContainer center={defaultPosition} zoom={2} scrollWheelZoom className="map-container">
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution="&copy; OpenStreetMap contributors &copy; CARTO"
          />
          {markers.map((marker) => (
            <Marker
              key={`${marker.latitude}-${marker.longitude}`}
              position={[marker.latitude, marker.longitude]}
              icon={createIcon(marker.photos[0].imageUrl, marker.photos.length)}
              eventHandlers={{ click: () => setSelectedMarker(marker) }}
            >
              <Popup>
                <div className="popup-card">
                  <strong>{marker.photos[0].title}</strong>
                  <p>{marker.photos[0].description}</p>
                  <div className="popup-images">
                    {marker.photos.map((photo) => (
                      <img key={photo.id} src={photo.imageUrl} alt={photo.title} />
                    ))}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
          {pins.map((pin) => (
            <CircleMarker key={pin.id} center={[pin.latitude, pin.longitude]} radius={12} pathOptions={{ color: '#ff5722' }}>
              <Popup>
                <strong>{pin.title}</strong>
                <p>{pin.description}</p>
                <small>Tagged: {pin.taggedNames.join(', ')}</small>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        {selectedMarker && (
          <section className="marker-details">
            <h2>Photo Cluster</h2>
            <div className="photo-grid">
              {selectedMarker.photos.map((photo) => (
                <div key={photo.id} className="photo-card">
                  <img src={photo.imageUrl} alt={photo.title} />
                  <p>{photo.title}</p>
                </div>
              ))}
            </div>
            <button className="close-button" onClick={() => setSelectedMarker(null)}>
              Close
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
