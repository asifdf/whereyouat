package com.whereyouat.model;

import java.time.LocalDateTime;

public class MemoryPost {
    private String id;
    private String authorId;
    private String title;
    private String body;
    private String photoUrl;
    private LocalDateTime createdAt;

    public MemoryPost() {
    }

    public MemoryPost(String id, String authorId, String title, String body, String photoUrl, LocalDateTime createdAt) {
        this.id = id;
        this.authorId = authorId;
        this.title = title;
        this.body = body;
        this.photoUrl = photoUrl;
        this.createdAt = createdAt;
    }

    public String getId() {
        return id;
    }

    public String getAuthorId() {
        return authorId;
    }

    public String getTitle() {
        return title;
    }

    public String getBody() {
        return body;
    }

    public String getPhotoUrl() {
        return photoUrl;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setId(String id) {
        this.id = id;
    }

    public void setAuthorId(String authorId) {
        this.authorId = authorId;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public void setBody(String body) {
        this.body = body;
    }

    public void setPhotoUrl(String photoUrl) {
        this.photoUrl = photoUrl;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
