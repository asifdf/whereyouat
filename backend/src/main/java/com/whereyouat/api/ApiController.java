package com.whereyouat.api;

import com.whereyouat.model.*;
import com.whereyouat.service.WhereYouAtService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.NoSuchElementException;
import java.util.concurrent.ConcurrentHashMap;

import java.util.List;

@RestController
@RequestMapping("/api")
public class ApiController {
    private final WhereYouAtService service;
    private final Map<String, ChunkUploadSession> chunkUploads = new ConcurrentHashMap<>();

    public ApiController(WhereYouAtService service) {
        this.service = service;
    }

    @GetMapping("/map")
    public ResponseEntity<List<PhotoGroup>> getMapMarkers() {
        return ResponseEntity.ok(service.getPhotoGroups());
    }

    @PostMapping("/photos")
    public ResponseEntity<PhotoItem> addPhoto(@RequestHeader(value = "Authorization", required = false) String authorization,
                                              @Valid @RequestBody PhotoUpload upload) {
        return ResponseEntity.ok(service.addPhoto(upload, authorization));
    }

    @PostMapping("/photos/chunk")
    public ResponseEntity<Map<String, Object>> addPhotoChunk(
            @Valid @RequestBody PhotoChunkUpload payload) {
        int chunkIndex = payload.getChunkIndex();
        int totalChunks = payload.getTotalChunks();
        if (totalChunks <= 0 || chunkIndex < 0 || chunkIndex >= totalChunks) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid chunk index or total chunks");
        }

        ChunkUploadSession session = chunkUploads.computeIfAbsent(payload.getUploadId(), ignored ->
                new ChunkUploadSession(payload.getTitle(), payload.getLatitude(), payload.getLongitude(), payload.getDescription(), totalChunks)
        );

        if (session.getTotalChunks() != totalChunks) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chunk count mismatch");
        }

        session.putChunk(chunkIndex, payload.getChunkData());
        return ResponseEntity.ok(Map.of(
                "uploadId", payload.getUploadId(),
                "receivedChunk", chunkIndex,
                "totalChunks", totalChunks
        ));
    }

    @PostMapping("/photos/chunk/complete")
    public ResponseEntity<PhotoItem> completePhotoUpload(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @Valid @RequestBody PhotoChunkCompleteRequest payload) {
        ChunkUploadSession session = chunkUploads.remove(payload.getUploadId());
        if (session == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Upload session not found");
        }

        PhotoUpload upload = new PhotoUpload();
        upload.setTitle(session.getTitle());
        upload.setLatitude(session.getLatitude());
        upload.setLongitude(session.getLongitude());
        upload.setDescription(session.getDescription());
        upload.setImageUrl(session.joinChunks());

        return ResponseEntity.ok(service.addPhoto(upload, authorization));
    }

    @PostMapping("/auth/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        try {
            return ResponseEntity.ok(service.register(request));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
        }
    }

    @PostMapping("/auth/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        try {
            return ResponseEntity.ok(service.login(request));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, ex.getMessage());
        }
    }

    @GetMapping("/auth/me")
    public ResponseEntity<UserSummary> me(@RequestHeader(value = "Authorization", required = false) String authorization) {
        try {
            return ResponseEntity.ok(service.getMe(authorization));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, ex.getMessage());
        }
    }

    @GetMapping("/users/search")
    public ResponseEntity<List<UserSummary>> findFriends(@RequestParam String query) {
        return ResponseEntity.ok(service.searchUsers(query));
    }

    @GetMapping("/users/{userId}")
    public ResponseEntity<UserSummary> getUser(@PathVariable String userId) {
        try {
            return ResponseEntity.ok(service.getUserById(userId));
        } catch (NoSuchElementException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, ex.getMessage());
        }
    }

    @PostMapping("/users/{userId}/follow")
    public ResponseEntity<FollowerResponse> followUser(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable String userId) {
        try {
            return ResponseEntity.ok(service.followUser(authorization, userId));
        } catch (NoSuchElementException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, ex.getMessage());
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, ex.getMessage());
        }
    }

    @GetMapping("/users/{userId}/following")
    public ResponseEntity<List<UserSummary>> getFollowing(@PathVariable String userId) {
        return ResponseEntity.ok(service.getFollowing(userId));
    }

    @GetMapping("/users/{userId}/map")
    public ResponseEntity<List<PhotoGroup>> getUserMap(@PathVariable String userId) {
        return ResponseEntity.ok(service.getUserPhotoGroups(userId));
    }

    @GetMapping("/pins")
    public ResponseEntity<List<PinTag>> getPins() {
        return ResponseEntity.ok(service.getPins());
    }

    @PostMapping("/pins")
    public ResponseEntity<PinTag> addPin(@Valid @RequestBody PinTagCreate payload) {
        return ResponseEntity.ok(service.addPin(payload));
    }

    @GetMapping("/memories")
    public ResponseEntity<List<MemoryPost>> getMemories() {
        return ResponseEntity.ok(service.getMemories());
    }

    @PostMapping("/memories")
    public ResponseEntity<MemoryPost> shareMemory(@RequestHeader(value = "Authorization", required = false) String authorization,
                                                   @Valid @RequestBody MemoryCreate payload) {
        return ResponseEntity.ok(service.shareMemory(payload, authorization));
    }

    private static class ChunkUploadSession {
        private final String title;
        private final Double latitude;
        private final Double longitude;
        private final String description;
        private final String[] chunks;

        private ChunkUploadSession(String title, Double latitude, Double longitude, String description, int totalChunks) {
            this.title = title;
            this.latitude = latitude;
            this.longitude = longitude;
            this.description = description;
            this.chunks = new String[totalChunks];
        }

        private int getTotalChunks() {
            return chunks.length;
        }

        private synchronized void putChunk(int index, String data) {
            chunks[index] = data;
        }

        private synchronized String joinChunks() {
            StringBuilder sb = new StringBuilder();
            for (String chunk : chunks) {
                if (chunk == null) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing chunk before completion");
                }
                sb.append(chunk);
            }
            return sb.toString();
        }

        private String getTitle() {
            return title;
        }

        private Double getLatitude() {
            return latitude;
        }

        private Double getLongitude() {
            return longitude;
        }

        private String getDescription() {
            return description;
        }
    }
}
