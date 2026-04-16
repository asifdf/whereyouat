package com.whereyouat.model;

import java.util.HashSet;
import java.util.Set;

public class User {
    private String id;
    private String name;
    private String avatarUrl;
    private Set<String> followers = new HashSet<>();
    private Set<String> following = new HashSet<>();

    public User() {
    }

    public User(String id, String name, String avatarUrl) {
        this.id = id;
        this.name = name;
        this.avatarUrl = avatarUrl;
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public Set<String> getFollowers() {
        return followers;
    }

    public Set<String> getFollowing() {
        return following;
    }

    public void setId(String id) {
        this.id = id;
    }

    public void setName(String name) {
        this.name = name;
    }

    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }

    public void setFollowers(Set<String> followers) {
        this.followers = followers;
    }

    public void setFollowing(Set<String> following) {
        this.following = following;
    }
}
