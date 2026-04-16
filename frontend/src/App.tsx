import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import exifr from 'exifr';
import { AuthResponse, PhotoMarker, UserSummary, PinTag, MemoryPost } from './types';

const resolveApiBase = () => {
  const forceHttpsIfNeeded = (url: string) => {
    if (typeof window === 'undefined') return url;
    if (window.location.protocol !== 'https:') return url;

    try {
      const parsed = new URL(url);
      const isLocalHost = ['localhost', '127.0.0.1'].includes(parsed.hostname);
      if (parsed.protocol === 'http:' && !isLocalHost) {
        parsed.protocol = 'https:';
      }
      return parsed.toString().replace(/\/$/, '');
    } catch {
      return url;
    }
  };

  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    const trimmed = apiUrl.trim().replace(/\/$/, '');
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const normalized = forceHttpsIfNeeded(withProtocol);
    return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
  }

  const base =
    import.meta.env.VITE_API_BASE ??
    'https://whereyouat-env.eba-7gf9xpfu.ap-northeast-2.elasticbeanstalk.com/api';
  const trimmedBase = base.trim().replace(/\/$/, '');
  const normalizedBase = forceHttpsIfNeeded(trimmedBase);
  return normalizedBase.endsWith('/api') ? normalizedBase : `${normalizedBase}/api`;
};

const API_BASE = resolveApiBase();
console.debug('whereyouat API_BASE =', API_BASE);
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
  const [selectedMarker, setSelectedMarker] = useState<PhotoMarker | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState('');
  const [newPin, setNewPin] = useState({ title: '', description: '', latitude: '', longitude: '', taggedNames: '' });
  const [newMemory, setNewMemory] = useState({ title: '', body: '', photoUrl: '' });
  const [friendMapId, setFriendMapId] = useState('');
  const [friendMapOwner, setFriendMapOwner] = useState<UserSummary | null>(null);
  const [friendMapMarkers, setFriendMapMarkers] = useState<PhotoMarker[]>([]);
  const [friendMapMessage, setFriendMapMessage] = useState('');
  const [uploadVisible, setUploadVisible] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserSummary | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ username: '', password: '', name: '' });
  const [authMessage, setAuthMessage] = useState('');

  useEffect(() => {
    fetchMarkers();
    fetch(`${API_BASE}/pins`).then((res) => res.json()).then(setPins);
    fetch(`${API_BASE}/memories`).then((res) => res.json()).then(setMemories);
    fetch(`${API_BASE}/users/search?query=jiwoo`).then((res) => res.json()).then(setFriends);
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchFollowing(currentUser.id);
    } else {
      setFollowing([]);
    }
  }, [currentUser]);

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
    const lower = search.toLowerCase();
    return friends.filter((friend) =>
      friend.name.toLowerCase().includes(lower) || friend.id.toLowerCase().includes(lower)
    );
  }, [friends, search]);

  const parseGpsFromFile = async (file: File) => {
    const gps = await exifr.gps(file);
    if (!gps?.latitude || !gps?.longitude) {
      return null;
    }
    return { latitude: gps.latitude, longitude: gps.longitude };
  };

  const dataUrlFromFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const MAX = 800;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
      img.src = objectUrl;
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
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
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
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const created = await res.json();
    setMemories((prev) => [created, ...prev]);
    setNewMemory({ title: '', body: '', photoUrl: '' });
  };

  const getAuthHeaders = () => {
    const headers: Record<string, string> = {};
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    return headers;
  };

  const fetchFriendMap = async () => {
    setFriendMapMessage('');
    setFriendMapOwner(null);
    setFriendMapMarkers([]);
    if (!friendMapId.trim()) {
      setFriendMapMessage('친구 ID를 입력하세요.');
      return;
    }

    try {
      const userRes = await fetch(`${API_BASE}/users/${encodeURIComponent(friendMapId.trim())}`);
      if (!userRes.ok) {
        setFriendMapMessage('해당 친구를 찾을 수 없습니다.');
        return;
      }
      const user: UserSummary = await userRes.json();
      setFriendMapOwner(user);

      const res = await fetch(`${API_BASE}/users/${encodeURIComponent(friendMapId.trim())}/map`);
      if (!res.ok) {
        setFriendMapMessage('친구의 지도 사진을 불러올 수 없습니다.');
        return;
      }
      const data = await res.json();
      setFriendMapMarkers(data);
      if (!data.length) {
        setFriendMapMessage('친구의 지도에는 아직 사진이 없습니다.');
      }
    } catch (err) {
      console.error(err);
      setFriendMapMessage('서버에서 친구 데이터를 불러올 수 없습니다.');
    }
  };

  const fetchFollowing = async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/following`, { headers: getAuthHeaders() });
      if (res.ok) {
        setFollowing(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAuthSubmit = async () => {
    setAuthMessage('');
    const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
    const payload = authMode === 'login'
      ? { username: authForm.username.trim(), password: authForm.password }
      : { username: authForm.username.trim(), password: authForm.password, name: authForm.name.trim() };

    try {
      const url = `${API_BASE}${endpoint}`;
      console.debug('login/register request URL =', url);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        setAuthMessage(errorText || 'Login/Register failed');
        return;
      }

      const data: AuthResponse = await res.json();
      setAuthToken(data.token);
      setCurrentUser(data.user);
      setAuthMessage(`${authMode === 'login' ? '로그인' : '회원가입'} 성공: ${data.user.name}`);
      setAuthForm({ username: '', password: '', name: '' });
    } catch (err) {
      console.error('Auth request failed', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setAuthMessage(`서버 연결 실패: ${errorMessage}`);
    }
  };

  const logout = () => {
    setAuthToken(null);
    setCurrentUser(null);
    setFollowing([]);
    setAuthMessage('로그아웃되었습니다.');
  };

  const searchFriends = async () => {
    const res = await fetch(`${API_BASE}/users/search?query=${encodeURIComponent(search)}`);
    if (res.ok) {
      setFriends(await res.json());
    }
  };

  const follow = async (userId: string) => {
    if (!authToken) {
      setAuthMessage('팔로우하려면 먼저 로그인하세요.');
      return;
    }

    const res = await fetch(`${API_BASE}/users/${userId}/follow`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const errorText = await res.text();
      setAuthMessage(errorText || '팔로우에 실패했습니다.');
      return;
    }

    const body = await res.json();
    if (body.followed) {
      fetchFollowing(currentUser?.id ?? '');
      setAuthMessage('팔로우 성공했습니다.');
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="section auth-section">
          <div className="section-header">
            <h2>{currentUser ? '내 계정' : authMode === 'login' ? '로그인' : '회원가입'}</h2>
            {currentUser ? (
              <button className="link-button" onClick={logout}>로그아웃</button>
            ) : (
              <button className="link-button" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
                {authMode === 'login' ? '회원가입' : '로그인'} 전환
              </button>
            )}
          </div>
          {currentUser ? (
            <div className="auth-summary">
              <p>안녕하세요, <strong>{currentUser.name}</strong>님</p>
              <p>ID: <code>{currentUser.id}</code></p>
              <p>팔로잉: {currentUser.following}명</p>
            </div>
          ) : (
            <div className="auth-form">
              <input
                placeholder="Username"
                value={authForm.username}
                onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
              />
              {authMode === 'register' && (
                <input
                  placeholder="Display name"
                  value={authForm.name}
                  onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                />
              )}
              <input
                type="password"
                placeholder="Password"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
              />
              <button onClick={handleAuthSubmit}>
                {authMode === 'login' ? '로그인' : '회원가입'}
              </button>
              {authMessage && <p className="status-text">{authMessage}</p>}
            </div>
          )}
        </div>

        <div className="section">
          <div className="section-header">
            <h2>Upload Photos</h2>
            <button className="link-button" onClick={() => setUploadVisible((visible) => !visible)}>
              {uploadVisible ? '숨기기' : '보이기'}
            </button>
          </div>
          {uploadVisible ? (
            <>
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
            </>
          ) : (
            <p className="section-subtitle">업로드 패널이 숨겨져 있습니다. 다시 보이게 하려면 버튼을 누르세요.</p>
          )}
        </div>

        <div className="section">
          <h2>Find Friends</h2>
          <p className="section-subtitle">Search people and follow them to see their activity.</p>
          <div className="search-row">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or ID" />
            <button onClick={searchFriends}>Search</button>
          </div>
          <div className="friend-list">
            {filteredFriends.map((friend) => (
              <div key={friend.id} className="friend-card">
                <img src={friend.avatarUrl} alt={friend.name} />
                <div>
                  <p>{friend.name}</p>
                  <small>ID: {friend.id}</small>
                  <small>{friend.followers} followers</small>
                </div>
                <button onClick={() => follow(friend.id)} disabled={!authToken}>
                  {authToken ? 'Follow' : 'Login to follow'}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="section">
          <h2>Friend Map</h2>
          <p className="section-subtitle">친구 ID를 입력하면 친구의 map 사진을 볼 수 있습니다.</p>
          <div className="search-row">
            <input value={friendMapId} onChange={(e) => setFriendMapId(e.target.value)} placeholder="Enter friend ID" />
            <button onClick={fetchFriendMap}>Load map</button>
          </div>
          {friendMapMessage && <p className="status-text">{friendMapMessage}</p>}
          {friendMapOwner && (
            <div className="friend-map-summary">
              <p><strong>{friendMapOwner.name}</strong>님의 map</p>
              <p>ID: {friendMapOwner.id}</p>
            </div>
          )}
          <div className="friend-list">
            {friendMapMarkers.length ? friendMapMarkers.map((group, index) => (
              <div key={`${group.latitude}-${group.longitude}-${index}`} className="friend-card">
                <div>
                  <p>{group.photos.length} Photos at {group.latitude.toFixed(3)}, {group.longitude.toFixed(3)}</p>
                  <small>Coordinates</small>
                </div>
                <button onClick={() => setSelectedMarker(group)}>View on map</button>
              </div>
            )) : (friendMapOwner ? <p className="section-subtitle">친구의 사진 그룹이 없습니다.</p> : null)}
          </div>
        </div>

        <div className="section">
          <h2>Following</h2>
          {following.length ? following.map((user) => (
            <div key={user.id} className="friend-card">
              <img src={user.avatarUrl} alt={user.name} />
              <div>
                <p>{user.name}</p>
                <small>{user.followers} followers</small>
              </div>
            </div>
          )) : <p>{authToken ? 'No following users yet.' : '로그인 후 팔로우를 시작하세요.'}</p>}
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
            <textarea placeholder="Story (tag with @friendid)" value={newMemory.body} onChange={(e) => setNewMemory({ ...newMemory, body: e.target.value })} />
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
