package com.whereyouat.api;

import com.whereyouat.model.*;
import com.whereyouat.service.WhereYouAtService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
    public ResponseEntity<PhotoItem> addPhoto(@Valid @RequestBody PhotoUpload upload) {
        return ResponseEntity.ok(service.addPhoto(upload));
    }

    @GetMapping("/users/search")
    public ResponseEntity<List<UserSummary>> findFriends(@RequestParam String query) {
        return ResponseEntity.ok(service.searchUsers(query));
    }

    @PostMapping("/users/{userId}/follow")
    public ResponseEntity<FollowerResponse> followUser(@PathVariable String userId) {
        return ResponseEntity.ok(service.followUser(userId));
    }

    @GetMapping("/users/{userId}/following")
    public ResponseEntity<List<UserSummary>> getFollowing(@PathVariable String userId) {
        return ResponseEntity.ok(service.getFollowing(userId));
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
    public ResponseEntity<MemoryPost> shareMemory(@Valid @RequestBody MemoryCreate payload) {
        return ResponseEntity.ok(service.shareMemory(payload));
    }
}
