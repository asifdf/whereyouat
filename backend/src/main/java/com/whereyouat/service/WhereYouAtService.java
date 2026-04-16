package com.whereyouat.service;

import com.whereyouat.model.*;
import com.whereyouat.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.NoSuchElementException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class WhereYouAtService {
    private final UserRepository userRepository;
    private final PhotoRepository photoRepository;
    private final MemoryRepository memoryRepository;
    private final PinTagRepository pinTagRepository;
    private final Map<String, String> authTokens = new ConcurrentHashMap<>();

    private static final Pattern TAG_PATTERN = Pattern.compile("@([a-zA-Z0-9_-]+)");

    public WhereYouAtService(UserRepository userRepository,
                             PhotoRepository photoRepository,
                             MemoryRepository memoryRepository,
                             PinTagRepository pinTagRepository) {
        this.userRepository = userRepository;
        this.photoRepository = photoRepository;
        this.memoryRepository = memoryRepository;
        this.pinTagRepository = pinTagRepository;

        if (userRepository.count() == 0) {
            initializeDemoData();
        }
    }

    public List<PhotoGroup> getPhotoGroups() {
        Map<String, PhotoGroup> grouped = new HashMap<>();
        photoRepository.findAll().forEach(photo -> {
            String key = String.format("%.6f|%.6f", photo.getLatitude(), photo.getLongitude());
            grouped.computeIfAbsent(key, k -> new PhotoGroup(photo.getLatitude(), photo.getLongitude())).getPhotos().add(createPhotoItem(photo));
        });
        return new ArrayList<>(grouped.values());
    }

    public List<PhotoGroup> getUserPhotoGroups(String userId) {
        Map<String, PhotoGroup> grouped = new HashMap<>();
        photoRepository.findByAuthorId(userId).forEach(photo -> {
            String key = String.format("%.6f|%.6f", photo.getLatitude(), photo.getLongitude());
            grouped.computeIfAbsent(key, k -> new PhotoGroup(photo.getLatitude(), photo.getLongitude())).getPhotos().add(createPhotoItem(photo));
        });
        return new ArrayList<>(grouped.values());
    }

    public PhotoItem addPhoto(PhotoUpload upload, String authorizationHeader) {
        String id = UUID.randomUUID().toString();
        UserEntity author = getUserFromAuthorization(authorizationHeader);
        PhotoEntity entity = new PhotoEntity(id, upload.getTitle(), upload.getImageUrl(), upload.getLatitude(), upload.getLongitude(), upload.getDescription(), author);
        photoRepository.save(entity);
        return createPhotoItem(entity);
    }

    public List<UserSummary> searchUsers(String query) {
        return userRepository
                .findByUsernameContainingIgnoreCaseOrNameContainingIgnoreCaseOrIdContainingIgnoreCase(query, query, query)
                .stream()
                .map(this::summaryFor)
                .collect(Collectors.toList());
    }

    public UserSummary getUserById(String userId) {
        return userRepository.findById(userId)
                .map(this::summaryFor)
                .orElseThrow(() -> new NoSuchElementException("User not found"));
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String normalized = request.getUsername().trim().toLowerCase();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("Username is required");
        }
        if (userRepository.existsByUsername(normalized)) {
            throw new IllegalArgumentException("Username already taken");
        }
        String id = UUID.randomUUID().toString();
        String avatarUrl = "https://i.pravatar.cc/80?u=" + normalized;
        UserEntity user = new UserEntity(id, normalized, request.getName(), avatarUrl, hashPassword(request.getPassword()));
        userRepository.save(user);
        String token = createToken(id);
        return new AuthResponse(token, summaryFor(user));
    }

    public AuthResponse login(LoginRequest request) {
        String normalized = request.getUsername().trim().toLowerCase();
        UserEntity user = userRepository.findByUsername(normalized).orElse(null);
        if (user == null || !Objects.equals(user.getPasswordHash(), hashPassword(request.getPassword()))) {
            throw new IllegalArgumentException("Invalid username or password");
        }
        String token = createToken(user.getId());
        return new AuthResponse(token, summaryFor(user));
    }

    public UserSummary getMe(String authorizationHeader) {
        UserEntity user = getUserFromAuthorization(authorizationHeader);
        if (user == null) {
            throw new IllegalArgumentException("Invalid or missing auth token");
        }
        return summaryFor(user);
    }

    @Transactional
    public FollowerResponse followUser(String authorizationHeader, String userId) {
        UserEntity current = getUserFromAuthorization(authorizationHeader);
        UserEntity target = userRepository.findById(userId).orElse(null);
        if (current == null || target == null) {
            throw new NoSuchElementException("User not found");
        }
        current.getFollowing().add(target);
        target.getFollowers().add(current);
        userRepository.save(current);
        userRepository.save(target);
        return new FollowerResponse(userId, true, current.getFollowing().size());
    }

    public List<UserSummary> getFollowing(String userId) {
        return userRepository.findById(userId)
                .map(user -> user.getFollowing().stream().map(this::summaryFor).collect(Collectors.toList()))
                .orElse(Collections.emptyList());
    }

    public List<PinTag> getPins() {
        return pinTagRepository.findAll().stream().map(this::convertPinTag).collect(Collectors.toList());
    }

    public PinTag addPin(PinTagCreate payload) {
        String id = UUID.randomUUID().toString();
        PinTagEntity entity = new PinTagEntity(id, payload.getTitle(), payload.getDescription(), payload.getLatitude(), payload.getLongitude(), payload.getTaggedNames(), LocalDateTime.now());
        pinTagRepository.save(entity);
        return convertPinTag(entity);
    }

    public List<MemoryPost> getMemories() {
        return memoryRepository.findAllByOrderByCreatedAtDesc().stream().map(this::convertMemoryPost).collect(Collectors.toList());
    }

    public MemoryPost shareMemory(MemoryCreate payload, String authorizationHeader) {
        UserEntity author = getUserFromAuthorization(authorizationHeader);
        if (author == null) {
            author = userRepository.findById("user-1").orElseThrow(() -> new IllegalStateException("Author not found"));
        }
        String id = UUID.randomUUID().toString();
        MemoryEntity entity = new MemoryEntity(id, author, payload.getTitle(), payload.getBody(), payload.getPhotoUrl(), LocalDateTime.now());
        entity.setTaggedUsers(findTaggedUsers(payload.getBody()));
        memoryRepository.save(entity);
        return convertMemoryPost(entity);
    }

    private String hashPassword(String password) {
        return Integer.toHexString(Objects.requireNonNull(password).hashCode());
    }

    private String createToken(String userId) {
        String token = UUID.randomUUID().toString();
        authTokens.put(token, userId);
        return token;
    }

    private UserEntity getUserFromAuthorization(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            return null;
        }
        String token = authorizationHeader.substring("Bearer ".length()).trim();
        String userId = authTokens.get(token);
        return userId == null ? null : userRepository.findById(userId).orElse(null);
    }

    private UserSummary summaryFor(UserEntity user) {
        return new UserSummary(user.getId(), user.getName(), user.getAvatarUrl(), user.getFollowers().size(), user.getFollowing().size());
    }

    private PhotoItem createPhotoItem(PhotoEntity photo) {
        return new PhotoItem(photo.getId(), photo.getTitle(), photo.getImageUrl(), photo.getLatitude(), photo.getLongitude(), photo.getDescription());
    }

    private PinTag convertPinTag(PinTagEntity entity) {
        return new PinTag(entity.getId(), entity.getTitle(), entity.getDescription(), entity.getLatitude(), entity.getLongitude(), entity.getTaggedNames(), entity.getCreatedAt());
    }

    private MemoryPost convertMemoryPost(MemoryEntity entity) {
        return new MemoryPost(entity.getId(), entity.getAuthor().getId(), entity.getTitle(), entity.getBody(), entity.getPhotoUrl(), entity.getCreatedAt());
    }

    private Set<UserEntity> findTaggedUsers(String body) {
        Set<UserEntity> taggedUsers = new HashSet<>();
        Matcher matcher = TAG_PATTERN.matcher(body);
        while (matcher.find()) {
            String username = matcher.group(1).toLowerCase();
            userRepository.findByUsername(username).ifPresent(taggedUsers::add);
        }
        return taggedUsers;
    }

    private void initializeDemoData() {
        UserEntity me = new UserEntity("user-1", "jiwoo", "지우", "https://i.pravatar.cc/80?img=32", hashPassword("pass123"));
        UserEntity friend1 = new UserEntity("user-2", "minjun", "민준", "https://i.pravatar.cc/80?img=12", hashPassword("minjun"));
        UserEntity friend2 = new UserEntity("user-3", "haneul", "하늘", "https://i.pravatar.cc/80?img=16", hashPassword("haneul"));
        UserEntity friend3 = new UserEntity("user-4", "somin", "소민", "https://i.pravatar.cc/80?img=20", hashPassword("somin"));

        userRepository.saveAll(List.of(me, friend1, friend2, friend3));

        photoRepository.save(new PhotoEntity("photo-1", "강릉 바다", "https://images.unsplash.com/photo-1526772662000-3f88f10405ff?fit=crop&w=500&q=80", 37.7516, 129.1236, "여행 중에 찍은 바다 사진", me));
        photoRepository.save(new PhotoEntity("photo-2", "서울 한강", "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?fit=crop&w=500&q=80", 37.5194, 126.9390, "한강에서 피크닉", friend1));
        photoRepository.save(new PhotoEntity("photo-3", "제주 해변", "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?fit=crop&w=500&q=80", 33.4890, 126.4983, "제주도에서", friend2));

        pinTagRepository.save(new PinTagEntity("pin-1", "소풍 장소", "여기에 민준이랑 함께 왔어요", 37.5194, 126.9390, List.of("민준", "지우"), LocalDateTime.now()));
        pinTagRepository.save(new PinTagEntity("pin-2", "데이트 코스", "하늘이랑 함께한 추억", 33.4890, 126.4983, List.of("하늘"), LocalDateTime.now()));

        memoryRepository.save(new MemoryEntity("memory-1", me, "한강 벚꽃 드라이브", "봄바람과 함께한 하루입니다.", "https://images.unsplash.com/photo-1499346030926-9a72daac6c63?fit=crop&w=600&q=80", LocalDateTime.now().minusDays(1)));
        memoryRepository.save(new MemoryEntity("memory-2", me, "여름 바다", "함께한 여행이 정말 행복했어요.", "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?fit=crop&w=600&q=80", LocalDateTime.now().minusDays(5)));
    }
}
