package com.whereyouat.service;

import com.whereyouat.model.*;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class WhereYouAtService {
    private final Map<String, User> users = new ConcurrentHashMap<>();
    private final Map<String, PhotoItem> photos = new ConcurrentHashMap<>();
    private final Map<String, PinTag> pins = new ConcurrentHashMap<>();
    private final Map<String, MemoryPost> memories = new ConcurrentHashMap<>();

    private final String currentUserId = "user-1";

    public WhereYouAtService() {
        initializeDemoData();
    }

    public List<PhotoGroup> getPhotoGroups() {
        Map<String, PhotoGroup> grouped = new HashMap<>();
        photos.values().forEach(photo -> {
            String key = String.format("%.6f|%.6f", photo.getLatitude(), photo.getLongitude());
            grouped.computeIfAbsent(key, k -> new PhotoGroup(photo.getLatitude(), photo.getLongitude())).getPhotos().add(photo);
        });
        return new ArrayList<>(grouped.values());
    }

    public PhotoItem addPhoto(PhotoUpload upload) {
        String id = UUID.randomUUID().toString();
        PhotoItem item = new PhotoItem(id, upload.getTitle(), upload.getImageUrl(), upload.getLatitude(), upload.getLongitude(), upload.getDescription());
        photos.put(id, item);
        return item;
    }

    public List<UserSummary> searchUsers(String query) {
        return users.values().stream()
                .filter(user -> user.getName().toLowerCase().contains(query.toLowerCase()))
                .map(this::summaryFor)
                .collect(Collectors.toList());
    }

    public FollowerResponse followUser(String userId) {
        User current = users.get(currentUserId);
        User target = users.get(userId);
        if (current == null || target == null) {
            throw new NoSuchElementException("User not found");
        }
        current.getFollowing().add(userId);
        target.getFollowers().add(currentUserId);
        return new FollowerResponse(userId, true, current.getFollowing().size());
    }

    public List<UserSummary> getFollowing(String userId) {
        User user = users.get(userId);
        if (user == null) {
            return Collections.emptyList();
        }
        return user.getFollowing().stream()
                .map(users::get)
                .filter(Objects::nonNull)
                .map(this::summaryFor)
                .collect(Collectors.toList());
    }

    public List<PinTag> getPins() {
        return new ArrayList<>(pins.values());
    }

    public PinTag addPin(PinTagCreate payload) {
        String id = UUID.randomUUID().toString();
        PinTag pin = new PinTag(id, payload.getTitle(), payload.getDescription(), payload.getLatitude(), payload.getLongitude(), payload.getTaggedNames(), LocalDateTime.now());
        pins.put(id, pin);
        return pin;
    }

    public List<MemoryPost> getMemories() {
        return memories.values().stream()
                .sorted(Comparator.comparing(MemoryPost::getCreatedAt).reversed())
                .collect(Collectors.toList());
    }

    public MemoryPost shareMemory(MemoryCreate payload) {
        String id = UUID.randomUUID().toString();
        MemoryPost memory = new MemoryPost(id, currentUserId, payload.getTitle(), payload.getBody(), payload.getPhotoUrl(), LocalDateTime.now());
        memories.put(id, memory);
        return memory;
    }

    private UserSummary summaryFor(User user) {
        return new UserSummary(user.getId(), user.getName(), user.getAvatarUrl(), user.getFollowers().size(), user.getFollowing().size());
    }

    private void initializeDemoData() {
        User me = new User("user-1", "지우", "https://i.pravatar.cc/80?img=32");
        User friend1 = new User("user-2", "민준", "https://i.pravatar.cc/80?img=12");
        User friend2 = new User("user-3", "하늘", "https://i.pravatar.cc/80?img=16");
        User friend3 = new User("user-4", "소민", "https://i.pravatar.cc/80?img=20");

        users.put(me.getId(), me);
        users.put(friend1.getId(), friend1);
        users.put(friend2.getId(), friend2);
        users.put(friend3.getId(), friend3);

        photos.put("photo-1", new PhotoItem("photo-1", "강릉 바다", "https://images.unsplash.com/photo-1526772662000-3f88f10405ff?fit=crop&w=500&q=80", 37.7516, 129.1236, "여행 중에 찍은 바다 사진"));
        photos.put("photo-2", new PhotoItem("photo-2", "서울 한강", "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?fit=crop&w=500&q=80", 37.5194, 126.9390, "한강에서 피크닉"));
        photos.put("photo-3", new PhotoItem("photo-3", "제주 해변", "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?fit=crop&w=500&q=80", 33.4890, 126.4983, "제주도에서"));

        pins.put("pin-1", new PinTag("pin-1", "소풍 장소", "여기에 민준이랑 함께 왔어요", 37.5194, 126.9390, List.of("민준", "지우"), LocalDateTime.now()));
        pins.put("pin-2", new PinTag("pin-2", "데이트 코스", "하늘이랑 함께한 추억", 33.4890, 126.4983, List.of("하늘"), LocalDateTime.now()));

        memories.put("memory-1", new MemoryPost("memory-1", me.getId(), "한강 벚꽃 드라이브", "봄바람과 함께한 하루입니다.", "https://images.unsplash.com/photo-1499346030926-9a72daac6c63?fit=crop&w=600&q=80", LocalDateTime.now().minusDays(1)));
        memories.put("memory-2", new MemoryPost("memory-2", me.getId(), "여름 바다", "함께한 여행이 정말 행복했어요.", "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?fit=crop&w=600&q=80", LocalDateTime.now().minusDays(5)));
    }
}
