package com.whereyouat.api;

import com.whereyouat.model.*;
import com.whereyouat.service.WhereYouAtService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.NoSuchElementException;

import java.util.List;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class ApiController {
    private final WhereYouAtService service;

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
}
