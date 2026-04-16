package com.whereyouat.model;

import jakarta.persistence.*;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "users")
public class UserEntity {
    @Id
    @Column(length = 50)
    private String id;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(nullable = false)
    private String name;

    private String avatarUrl;

    @Column(nullable = false)
    private String passwordHash;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "user_following",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "following_user_id")
    )
    private Set<UserEntity> following = new HashSet<>();

    @ManyToMany(mappedBy = "following", fetch = FetchType.LAZY)
    private Set<UserEntity> followers = new HashSet<>();

    public UserEntity() {
    }

    public UserEntity(String id, String username, String name, String avatarUrl, String passwordHash) {
        this.id = id;
        this.username = username;
        this.name = name;
        this.avatarUrl = avatarUrl;
        this.passwordHash = passwordHash;
    }

    public String getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getName() {
        return name;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public Set<UserEntity> getFollowers() {
        return followers;
    }

    public Set<UserEntity> getFollowing() {
        return following;
    }

    public void setId(String id) {
        this.id = id;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public void setName(String name) {
        this.name = name;
    }

    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public void setFollowers(Set<UserEntity> followers) {
        this.followers = followers;
    }

    public void setFollowing(Set<UserEntity> following) {
        this.following = following;
    }
}
