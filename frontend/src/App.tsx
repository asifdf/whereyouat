import { useEffect, useMemo, useRef, useState } from 'react';
import exifr from 'exifr';
import { AuthResponse, MemoryPost, PhotoMarker, PinTag, UserSummary } from './types';

declare global {
  interface Window {
    initWhereYouAtMap?: () => void;
  }
}

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
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
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
const defaultPosition: [number, number] = [20, 0];
const MAX_UPLOAD_FILES = 20;
const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? 'AIzaSyAXIiweoh5AHCHbA_BRiiZyX5_jVe6c-b4';

function App() {
  const [markers, setMarkers] = useState<PhotoMarker[]>([]);
  const [friends, setFriends] = useState<UserSummary[]>([]);
  const [following, setFollowing] = useState<UserSummary[]>([]);
  const [pins, setPins] = useState<PinTag[]>([]);
  const [memories, setMemories] = useState<MemoryPost[]>([]);
  const [search, setSearch] = useState('');
  const [selectedMarker, setSelectedMarker] = useState<PhotoMarker | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadTagText, setUploadTagText] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [newPin, setNewPin] = useState({ title: '', description: '', latitude: '', longitude: '', taggedNames: '' });
  const [newMemory, setNewMemory] = useState({ title: '', body: '', photoUrl: '' });
  const [friendMapUsername, setFriendMapUsername] = useState('');
  const [friendMapOwner, setFriendMapOwner] = useState<UserSummary | null>(null);
  const [friendMapMarkers, setFriendMapMarkers] = useState<PhotoMarker[]>([]);
  const [friendMapMessage, setFriendMapMessage] = useState('');
  const [uploadVisible, setUploadVisible] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserSummary | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ username: '', password: '', name: '' });
  const [authMessage, setAuthMessage] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');

  const mapRef = useRef<HTMLDivElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const googleMapRef = useRef<any>(null);
  const infoWindowRef = useRef<any>(null);
  const photoMarkersRef = useRef<any[]>([]);
  const pinMarkersRef = useRef<any[]>([]);
  const nearbyMarkersRef = useRef<any[]>([]);

  const activeMarkers = friendMapOwner ? friendMapMarkers : markers;

  const getAuthHeaders = () => {
    const headers: Record<string, string> = {};
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    return headers;
  };

  const focusMapToGroups = (groups: PhotoMarker[]) => {
    const google = (window as any).google;
    const map = googleMapRef.current;
    if (!map || !google?.maps || !groups.length) {
      return;
    }

    if (groups.length === 1) {
      map.setCenter({ lat: groups[0].latitude, lng: groups[0].longitude });
      map.setZoom(12);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    groups.forEach((group) => bounds.extend({ lat: group.latitude, lng: group.longitude }));
    map.fitBounds(bounds);
  };

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

  useEffect(() => {
    fetchMarkers();
    fetch(`${API_BASE}/pins`).then((res) => res.json()).then(setPins);
    fetch(`${API_BASE}/memories`).then((res) => res.json()).then(setMemories);
  }, []);

  useEffect(() => {
    const initMap = () => {
      if (!mapRef.current || !(window as any).google?.maps) {
        return;
      }

      const google = (window as any).google;
      const map = new google.maps.Map(mapRef.current, {
        zoom: 2,
        center: { lat: defaultPosition[0], lng: defaultPosition[1] },
        gestureHandling: 'greedy',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      googleMapRef.current = map;
      infoWindowRef.current = new google.maps.InfoWindow();
      setMapReady(true);

      if (google.maps.places) {
        const service = new google.maps.places.PlacesService(map);
        service.nearbySearch(
          {
            location: { lat: 37.5665, lng: 126.9780 },
            radius: 1000,
            type: 'restaurant',
          },
          (results: any[] | null, status: string) => {
            if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
              return;
            }

            nearbyMarkersRef.current.forEach((m) => m.setMap(null));
            nearbyMarkersRef.current = [];

            results.slice(0, 12).forEach((place: any) => {
              if (!place.geometry?.location) {
                return;
              }
              const marker = new google.maps.Marker({
                map,
                position: place.geometry.location,
                icon: {
                  path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                  scale: 5,
                  fillColor: '#111111',
                  fillOpacity: 0.9,
                  strokeColor: '#ffffff',
                  strokeWeight: 1,
                },
              });

              marker.addListener('click', () => {
                infoWindowRef.current?.setContent(
                  `<div><strong>${place.name ?? 'Nearby place'}</strong><br/>${place.vicinity ?? ''}</div>`
                );
                infoWindowRef.current?.open({ map, anchor: marker });
              });

              nearbyMarkersRef.current.push(marker);
            });
          }
        );
      }
    };

    if ((window as any).google?.maps) {
      initMap();
      return;
    }

    const existing = document.getElementById('google-maps-script');
    if (existing) {
      (window as any).initWhereYouAtMap = initMap;
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=initWhereYouAtMap`;
    script.onerror = () => {
      setMapError('Google Maps를 불러오지 못했습니다. API key 설정을 확인하세요.');
    };
    (window as any).initWhereYouAtMap = initMap;
    document.head.appendChild(script);

    return () => {
      delete (window as any).initWhereYouAtMap;
    };
  }, []);

  useEffect(() => {
    const google = (window as any).google;
    const map = googleMapRef.current;
    if (!mapReady || !map || !google?.maps) {
      return;
    }

    photoMarkersRef.current.forEach((m) => m.setMap(null));
    pinMarkersRef.current.forEach((m) => m.setMap(null));
    photoMarkersRef.current = [];
    pinMarkersRef.current = [];

    activeMarkers.forEach((group) => {
      const marker = new google.maps.Marker({
        map,
        position: { lat: group.latitude, lng: group.longitude },
        title: group.photos[0]?.title ?? 'Photo',
        icon: group.photos[0]?.imageUrl
          ? {
              url: group.photos[0].imageUrl,
              scaledSize: new google.maps.Size(56, 84),
            }
          : undefined,
      });

      marker.addListener('click', () => {
        setSelectedMarker(group);
        const first = group.photos[0];
        infoWindowRef.current?.setContent(
          `<div><strong>${first?.title ?? 'Photo'}</strong><br/>${first?.description ?? ''}</div>`
        );
        infoWindowRef.current?.open({ map, anchor: marker });
      });

      photoMarkersRef.current.push(marker);
    });

    if (!friendMapOwner) {
      pins.forEach((pin) => {
        const marker = new google.maps.Marker({
          map,
          position: { lat: pin.latitude, lng: pin.longitude },
          title: pin.title,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#ef4444',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });

        marker.addListener('click', () => {
          infoWindowRef.current?.setContent(`<div><strong>${pin.title}</strong><br/>${pin.description}</div>`);
          infoWindowRef.current?.open({ map, anchor: marker });
        });

        pinMarkersRef.current.push(marker);
      });
    }
  }, [mapReady, activeMarkers, pins, friendMapOwner]);

  useEffect(() => {
    if (mapReady) {
      focusMapToGroups(activeMarkers);
    }
  }, [mapReady, friendMapOwner, activeMarkers.length]);

  useEffect(() => {
    const google = (window as any).google;
    const map = googleMapRef.current;
    if (!mapReady || !map || !google?.maps || !selectedMarker) {
      return;
    }
    map.panTo({ lat: selectedMarker.latitude, lng: selectedMarker.longitude });
  }, [mapReady, selectedMarker]);

  useEffect(() => {
    if (currentUser) {
      fetchFollowing(currentUser.username || currentUser.id);
    } else {
      setFollowing([]);
    }
  }, [currentUser]);

  const filteredFriends = useMemo(() => {
    const lower = search.toLowerCase();
    return friends.filter(
      (friend) => friend.name.toLowerCase().includes(lower) || friend.username.toLowerCase().includes(lower)
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
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const uploadPhotoInChunks = async (file: File, coords: { latitude: number; longitude: number }) => {
    const taggedUsers = Array.from(
      new Set(
        uploadTagText
          .split(/[\s,]+/)
          .map((item) => item.trim().replace(/^@/, '').toLowerCase())
          .filter(Boolean)
      )
    );
    const description = taggedUsers.length
      ? `함께한 친구: ${taggedUsers.map((u) => `@${u}`).join(' ')}`
      : 'Uploaded from map uploader';

    const imageUrl = await dataUrlFromFile(file);
    const chunkSize = 1024 * 1024;
    const totalChunks = Math.ceil(imageUrl.length / chunkSize);
    const uploadId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    for (let index = 0; index < totalChunks; index += 1) {
      const start = index * chunkSize;
      const end = start + chunkSize;
      const chunkData = imageUrl.slice(start, end);

      const chunkResponse = await fetch(`${API_BASE}/photos/chunk`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId,
          title: file.name,
          latitude: coords.latitude,
          longitude: coords.longitude,
          description,
          chunkIndex: index,
          totalChunks,
          chunkData,
        }),
      });

      if (!chunkResponse.ok) {
        const errorText = await chunkResponse.text();
        throw new Error(errorText || 'Chunk upload failed');
      }
    }

    const completeResponse = await fetch(`${API_BASE}/photos/chunk/complete`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId }),
    });

    if (!completeResponse.ok) {
      const errorText = await completeResponse.text();
      throw new Error(errorText || 'Failed to complete upload');
    }
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
          await uploadPhotoInChunks(file, coords);
          return { status: 'ok', file: file.name };
        } catch (err) {
          console.error(err);
          return {
            status: 'failed',
            file: file.name,
            reason: err instanceof Error ? err.message : 'Upload error',
          };
        }
      })
    );

    const failed = results.filter((item) => item.status === 'failed');
    if (failed.length) {
      setUploadStatus(
        `${failed.length} photos failed: ${failed.map((item) => `${item.file} (${item.reason})`).join(', ')}`
      );
    } else {
      setUploadStatus('Upload complete. Map updated.');
    }
    setUploadFiles([]);
    setUploadTagText('');
    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
    }
    await fetchMarkers();
  };

  const handleFileChange = (files: FileList | null) => {
    if (!files) return;
    const selected = Array.from(files).slice(0, MAX_UPLOAD_FILES);
    setUploadFiles(selected);
    if (files.length > MAX_UPLOAD_FILES) {
      setUploadStatus(`한 번에 최대 ${MAX_UPLOAD_FILES}장만 가능해요. 앞의 ${MAX_UPLOAD_FILES}장만 선택했어요.`);
      return;
    }
    setUploadStatus(`${selected.length} files selected`);
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

  const fetchFriendMap = async () => {
    setFriendMapMessage('');
    setFriendMapOwner(null);
    setFriendMapMarkers([]);
    if (!friendMapUsername.trim()) {
      setFriendMapMessage('친구 username을 입력하세요.');
      return;
    }

    try {
      const identifier = friendMapUsername.trim().toLowerCase();
      const userRes = await fetch(`${API_BASE}/users/${encodeURIComponent(identifier)}`);
      if (!userRes.ok) {
        setFriendMapMessage('해당 친구를 찾을 수 없습니다.');
        return;
      }
      const user: UserSummary = await userRes.json();
      setFriendMapOwner(user);

      const res = await fetch(`${API_BASE}/users/${encodeURIComponent(identifier)}/map`);
      if (!res.ok) {
        setFriendMapMessage('친구의 지도 사진을 불러올 수 없습니다.');
        return;
      }
      const data = await res.json();
      setFriendMapMarkers(data);
      if (!data.length) {
        setFriendMapMessage('친구의 지도에는 아직 사진이 없습니다.');
        setSelectedMarker(null);
        return;
      }
      setSelectedMarker(data[0]);
      focusMapToGroups(data);
    } catch (err) {
      console.error(err);
      setFriendMapMessage('서버에서 친구 데이터를 불러올 수 없습니다.');
    }
  };

  const clearFriendMap = () => {
    setFriendMapOwner(null);
    setFriendMapMarkers([]);
    setFriendMapMessage('전체 지도로 돌아왔습니다.');
    setSelectedMarker(null);
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
    const payload =
      authMode === 'login'
        ? { username: authForm.username.trim(), password: authForm.password }
        : { username: authForm.username.trim(), password: authForm.password, name: authForm.name.trim() };

    try {
      const url = `${API_BASE}${endpoint}`;
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
      fetchFollowing(currentUser?.username ?? currentUser?.id ?? '');
      setAuthMessage('팔로우 성공했습니다.');
    }
  };

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="panel-dock">
          <strong>Control Panel</strong>
          <button className="link-button" onClick={() => setSidebarCollapsed(true)}>패널 접기</button>
        </div>

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
              <p>Username: <strong>@{currentUser.username}</strong></p>
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
              <button onClick={handleAuthSubmit}>{authMode === 'login' ? '로그인' : '회원가입'}</button>
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
              <input ref={uploadInputRef} type="file" multiple accept="image/*" onChange={(e) => handleFileChange(e.target.files)} />
              <input
                placeholder="함께한 친구 태그 (@username, @username)"
                value={uploadTagText}
                onChange={(e) => setUploadTagText(e.target.value)}
              />
              <p className="section-subtitle">한 번에 최대 20장까지 업로드 가능. 업로드 후 다시 선택해 추가 업로드할 수 있어요.</p>
              <button className="upload-button" onClick={handleUpload} disabled={!uploadFiles.length}>Upload selected files</button>
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
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or username" />
            <button onClick={searchFriends}>Search</button>
          </div>
          <div className="friend-list">
            {filteredFriends.map((friend) => (
              <div key={friend.id} className="friend-card">
                <img src={friend.avatarUrl} alt={friend.name} />
                <div>
                  <p>{friend.name}</p>
                  <small>@{friend.username}</small>
                  <small>{friend.followers} followers</small>
                </div>
                <button onClick={() => follow(friend.username)} disabled={!authToken}>
                  {authToken ? 'Follow' : 'Login to follow'}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="section">
          <h2>Friend Map</h2>
          <p className="section-subtitle">친구 username을 입력하면 친구 전용 지도가 표시됩니다.</p>
          <div className="search-row">
            <input value={friendMapUsername} onChange={(e) => setFriendMapUsername(e.target.value)} placeholder="Enter friend username" />
            <button onClick={fetchFriendMap}>친구 지도 불러오기</button>
            {friendMapOwner && <button onClick={clearFriendMap}>전체 지도 보기</button>}
          </div>
          {friendMapMessage && <p className="status-text">{friendMapMessage}</p>}
          {friendMapOwner && (
            <div className="friend-map-summary">
              <p><strong>{friendMapOwner.name}</strong>님의 map</p>
              <p>Username: @{friendMapOwner.username}</p>
            </div>
          )}
          <div className="friend-list">
            {friendMapMarkers.length
              ? friendMapMarkers.map((group, index) => (
                  <div key={`${group.latitude}-${group.longitude}-${index}`} className="friend-card">
                    <div>
                      <p>{group.photos.length} Photos at {group.latitude.toFixed(3)}, {group.longitude.toFixed(3)}</p>
                      <small>Coordinates</small>
                    </div>
                    <button onClick={() => setSelectedMarker(group)}>View on map</button>
                  </div>
                ))
              : friendMapOwner
                ? <p className="section-subtitle">친구의 사진 그룹이 없습니다.</p>
                : null}
          </div>
        </div>

        <div className="section">
          <h2>Following</h2>
          {following.length
            ? following.map((user) => (
                <div key={user.id} className="friend-card">
                  <img src={user.avatarUrl} alt={user.name} />
                  <div>
                    <p>{user.name}</p>
                    <small>{user.followers} followers</small>
                  </div>
                </div>
              ))
            : <p>{authToken ? 'No following users yet.' : '로그인 후 팔로우를 시작하세요.'}</p>}
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
            <textarea placeholder="Story (tag with @username)" value={newMemory.body} onChange={(e) => setNewMemory({ ...newMemory, body: e.target.value })} />
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
            <p>{friendMapOwner ? `@${friendMapOwner.username}의 지도` : 'Global map loaded in Google Maps style.'}</p>
          </div>
          <button className="sidebar-toggle" onClick={() => setSidebarCollapsed((v) => !v)}>
            {sidebarCollapsed ? '패널 열기' : '패널 접기'}
          </button>
        </div>

        <div ref={mapRef} className="map-container" />
        {mapError && <p className="status-text" style={{ padding: '10px 20px' }}>{mapError}</p>}

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
            <button className="close-button" onClick={() => setSelectedMarker(null)}>Close</button>
          </section>
        )}
      </main>

      <button className="panel-fab" onClick={() => setSidebarCollapsed((v) => !v)}>
        {sidebarCollapsed ? '패널 열기' : '패널 접기'}
      </button>
    </div>
  );
}

export default App;
