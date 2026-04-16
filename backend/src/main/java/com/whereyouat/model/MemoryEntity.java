package com.whereyouat.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "memories")
public class MemoryEntity {
    @Id
    @Column(length = 36)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id")
    private UserEntity author;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

    @Column(nullable = false)
    private String photoUrl;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "memory_tags",
            joinColumns = @JoinColumn(name = "memory_id"),
            inverseJoinColumns = @JoinColumn(name = "tagged_user_id")
    )
    private Set<UserEntity> taggedUsers = new HashSet<>();

    public MemoryEntity() {
    }

    public MemoryEntity(String id, UserEntity author, String title, String body, String photoUrl, LocalDateTime createdAt) {
        this.id = id;
        this.author = author;
        this.title = title;
        this.body = body;
        this.photoUrl = photoUrl;
        this.createdAt = createdAt;
    }

    public String getId() {
        return id;
    }

    public UserEntity getAuthor() {
        return author;
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

    public Set<UserEntity> getTaggedUsers() {
        return taggedUsers;
    }

    public void setId(String id) {
        this.id = id;
    }

    public void setAuthor(UserEntity author) {
        this.author = author;
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

    public void setTaggedUsers(Set<UserEntity> taggedUsers) {
        this.taggedUsers = taggedUsers;
    }
}
