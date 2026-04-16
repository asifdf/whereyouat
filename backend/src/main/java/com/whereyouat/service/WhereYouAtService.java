package com.whereyouat.service;

import com.whereyouat.model.*;
import com.whereyouat.repository.*;
import org.springframework.jdbc.core.JdbcTemplate;
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
    private final JdbcTemplate jdbcTemplate;
    private final Map<String, String> authTokens = new ConcurrentHashMap<>();

    private static final Pattern TAG_PATTERN = Pattern.compile("@([a-zA-Z0-9_-]+)");

    public WhereYouAtService(UserRepository userRepository,
                             PhotoRepository photoRepository,
                             MemoryRepository memoryRepository,
                             PinTagRepository pinTagRepository,
                             JdbcTemplate jdbcTemplate) {
        this.userRepository = userRepository;
        this.photoRepository = photoRepository;
        this.memoryRepository = memoryRepository;
        this.pinTagRepository = pinTagRepository;
        this.jdbcTemplate = jdbcTemplate;

        ensureSchemaCompatibility();
        cleanupLegacyDemoData();
    }

    private void ensureSchemaCompatibility() {
        runSafeAlter("ALTER TABLE users ALTER COLUMN id TYPE varchar(50)");
        runSafeAlter("ALTER TABLE photos ALTER COLUMN author_id TYPE varchar(50)");
        runSafeAlter("ALTER TABLE user_following ALTER COLUMN user_id TYPE varchar(50)");
        runSafeAlter("ALTER TABLE user_following ALTER COLUMN following_user_id TYPE varchar(50)");
    }

    private void runSafeAlter(String sql) {
        try {
            jdbcTemplate.execute(sql);
        } catch (Exception ignored) {
            // Ignore when table/column does not exist yet in fresh environments.
        }
    }

    private void cleanupLegacyDemoData() {
        runSafeUpdate("DELETE FROM pin_tagged_names WHERE pin_id IN ('pin-1', 'pin-2')");
        runSafeUpdate("DELETE FROM pins WHERE id IN ('pin-1', 'pin-2')");

        runSafeUpdate("DELETE FROM memory_tags WHERE memory_id IN ('memory-1', 'memory-2')");
        runSafeUpdate("DELETE FROM memories WHERE id IN ('memory-1', 'memory-2')");

        runSafeUpdate("DELETE FROM photos WHERE id IN ('photo-1', 'photo-2', 'photo-3')");
    }

    private void runSafeUpdate(String sql) {
        try {
            jdbcTemplate.update(sql);
        } catch (Exception ignored) {
            // Ignore when table does not exist yet in fresh environments.
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

    public List<PhotoGroup> getUserPhotoGroups(String userIdentifier) {
        UserEntity target = findUserByIdentifier(userIdentifier)
                .orElseThrow(() -> new NoSuchElementException("User not found"));

        Map<String, PhotoGroup> grouped = new HashMap<>();
        photoRepository.findByAuthorId(target.getId()).forEach(photo -> {
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

    public UserSummary getUserById(String userIdentifier) {
        return findUserByIdentifier(userIdentifier)
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
    public FollowerResponse followUser(String authorizationHeader, String userIdentifier) {
        UserEntity current = getUserFromAuthorization(authorizationHeader);
        UserEntity target = findUserByIdentifier(userIdentifier).orElse(null);
        if (current == null || target == null) {
            throw new NoSuchElementException("User not found");
        }
        current.getFollowing().add(target);
        target.getFollowers().add(current);
        userRepository.save(current);
        userRepository.save(target);
        return new FollowerResponse(target.getId(), true, current.getFollowing().size());
    }

    public List<UserSummary> getFollowing(String userIdentifier) {
        return findUserByIdentifier(userIdentifier)
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

    private Optional<UserEntity> findUserByIdentifier(String identifier) {
        if (identifier == null) {
            return Optional.empty();
        }

        String trimmed = identifier.trim();
        if (trimmed.isEmpty()) {
            return Optional.empty();
        }

        Optional<UserEntity> byId = userRepository.findById(trimmed);
        if (byId.isPresent()) {
            return byId;
        }

        return userRepository.findByUsername(trimmed.toLowerCase());
    }

    private UserSummary summaryFor(UserEntity user) {
        return new UserSummary(user.getId(), user.getUsername(), user.getName(), user.getAvatarUrl(), user.getFollowers().size(), user.getFollowing().size());
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

}
