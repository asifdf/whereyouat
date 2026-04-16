import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import exifr from 'exifr';
import { AuthResponse, PhotoMarker, UserSummary, PinTag, MemoryPost } from './types';

const resolveApiBase = () => {
  const apiUrl = import.meta.env.VITE_API_URL;

  if (apiUrl) {
    const trimmed = apiUrl.trim().replace(/\/$/, '');
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;

    return withProtocol.endsWith('/api')
      ? withProtocol
      : `${withProtocol}/api`;
  }

  const base =
    import.meta.env.VITE_API_BASE ??
    'http://whereyouat-env.eba-7gf9xpfu.ap-northeast-2.elasticbeanstalk.com';

  const trimmedBase = base.trim().replace(/\/$/, '');

  return trimmedBase.endsWith('/api')
    ? trimmedBase
    : `${trimmedBase}/api`;
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
  const [newPin, setNewPin] = useState({
    title: '',
    description: '',
    latitude: '',
    longitude: '',
    taggedNames: '',
  });
  const [newMemory, setNewMemory] = useState({
    title: '',
    body: '',
    photoUrl: '',
  });
  const [friendMapId, setFriendMapId] = useState('');
  const [friendMapOwner, setFriendMapOwner] = useState<UserSummary | null>(null);
  const [friendMapMarkers, setFriendMapMarkers] = useState<PhotoMarker[]>([]);
  const [friendMapMessage, setFriendMapMessage] = useState('');
  const [uploadVisible, setUploadVisible] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserSummary | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({
    username: '',
    password: '',
    name: '',
  });
  const [authMessage, setAuthMessage] = useState('');

  const getAuthHeaders = () => {
    const headers: Record<string, string> = {};
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    return headers;
  };

  const fetchMarkers = async () => {
    try {
      const response = await fetch(`${API_BASE}/map`);
      if (!response.ok) throw new Error('Unable to fetch map markers');
      const data = await response.json();
      setMarkers(data);
    } catch (error) {
      console.error(error);
      setUploadStatus('Failed to load map markers.');
    }
  };

  const fetchFollowing = async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/following`, {
        headers: getAuthHeaders(),
      });

      if (res.ok) {
        setFollowing(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMarkers();

    fetch(`${API_BASE}/pins`)
      .then((res) => res.json())
      .then(setPins)
      .catch(console.error);

    fetch(`${API_BASE}/memories`)
      .then((res) => res.json())
      .then(setMemories)
      .catch(console.error);

    fetch(`${API_BASE}/users/search?query=jiwoo`)
      .then((res) => res.json())
      .then(setFriends)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchFollowing(currentUser.id);
    } else {
      setFollowing([]);
    }
  }, [currentUser]);

  const filteredFriends = useMemo(() => {
    const lower = search.toLowerCase();
    return friends.filter(
      (friend) =>
        friend.name.toLowerCase().includes(lower) ||
        friend.id.toLowerCase().includes(lower)
    );
  }, [friends, search]);

  const parseGpsFromFile = async (file: File) => {
    const gps = await exifr.gps(file);

    if (!gps?.latitude || !gps?.longitude) {
      return null;
    }

    return {
      latitude: gps.latitude,
      longitude: gps.longitude,
    };
  };

  const dataUrlFromFile = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

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
            return {
              status: 'failed',
              file: file.name,
              reason: 'No GPS metadata',
            };
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
            headers: {
              ...getAuthHeaders(),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const errorText = await response.text();

            return {
              status: 'failed',
              file: file.name,
              reason: errorText || 'Upload failed',
            };
          }

          return { status: 'ok', file: file.name };
        } catch (err) {
          console.error(err);

          return {
            status: 'failed',
            file: file.name,
            reason: 'Upload error',
          };
        }
      })
    );

    const failed = results.filter((item) => item.status === 'failed');

    if (failed.length) {
      setUploadStatus(
        `${failed.length} photos failed: ${failed
          .map((item) => `${item.file} (${item.reason})`)
          .join(', ')}`
      );
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
      taggedNames: newPin.taggedNames
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean),
    };

    const res = await fetch(`${API_BASE}/pins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const created = await res.json();

    setPins((prev) => [...prev, created]);

    setNewPin({
      title: '',
      description: '',
      latitude: '',
      longitude: '',
      taggedNames: '',
    });
  };

  const shareMemory = async () => {
    const payload = {
      title: newMemory.title,
      body: newMemory.body,
      photoUrl: newMemory.photoUrl,
    };

    const res = await fetch(`${API_BASE}/memories`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const created = await res.json();

    setMemories((prev) => [created, ...prev]);

    setNewMemory({
      title: '',
      body: '',
      photoUrl: '',
    });
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
      const userRes = await fetch(
        `${API_BASE}/users/${encodeURIComponent(friendMapId.trim())}`
      );

      if (!userRes.ok) {
        setFriendMapMessage('해당 친구를 찾을 수 없습니다.');
        return;
      }

      const user: UserSummary = await userRes.json();
      setFriendMapOwner(user);

      const res = await fetch(
        `${API_BASE}/users/${encodeURIComponent(friendMapId.trim())}/map`
      );

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

  const handleAuthSubmit = async () => {
    setAuthMessage('');

    const endpoint =
      authMode === 'login' ? '/auth/login' : '/auth/register';

    const payload =
      authMode === 'login'
        ? {
            username: authForm.username.trim(),
            password: authForm.password,
          }
        : {
            username: authForm.username.trim(),
            password: authForm.password,
            name: authForm.name.trim(),
          };

    try {
      const url = `${API_BASE}${endpoint}`;
      console.debug('Auth URL:', url);

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

      setAuthMessage(
        `${authMode === 'login' ? '로그인' : '회원가입'} 성공: ${data.user.name}`
      );

      setAuthForm({
        username: '',
        password: '',
        name: '',
      });
    } catch (err) {
      console.error(err);

      const errorMessage =
        err instanceof Error ? err.message : String(err);

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
    const res = await fetch(
      `${API_BASE}/users/search?query=${encodeURIComponent(search)}`
    );

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
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
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

  return <div>기존 JSX 그대로 유지</div>;
}

export default App;