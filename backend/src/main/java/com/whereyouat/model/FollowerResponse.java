package com.whereyouat.model;

public class FollowerResponse {
    private String userId;
    private boolean followed;
    private int followingCount;

    public FollowerResponse() {
    }

    public FollowerResponse(String userId, boolean followed, int followingCount) {
        this.userId = userId;
        this.followed = followed;
        this.followingCount = followingCount;
    }

    public String getUserId() {
        return userId;
    }

    public boolean isFollowed() {
        return followed;
    }

    public int getFollowingCount() {
        return followingCount;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public void setFollowed(boolean followed) {
        this.followed = followed;
    }

    public void setFollowingCount(int followingCount) {
        this.followingCount = followingCount;
    }
}
