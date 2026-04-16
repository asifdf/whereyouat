export interface PhotoMarker {
  latitude: number;
  longitude: number;
  photos: {
    id: string;
    title: string;
    imageUrl: string;
    description?: string;
  }[];
}

export interface UserSummary {
  id: string;
  name: string;
  avatarUrl: string;
  followers: number;
  following: number;
}

export interface PinTag {
  id: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  taggedNames: string[];
}

export interface MemoryPost {
  id: string;
  authorId: string;
  title: string;
  body: string;
  photoUrl: string;
  createdAt: string;
}
