package com.whereyouat.model;

public class AuthResponse {
    private String token;
    private UserSummary user;

    public AuthResponse() {
    }

    public AuthResponse(String token, UserSummary user) {
        this.token = token;
        this.user = user;
    }

    public String getToken() {
        return token;
    }

    public UserSummary getUser() {
        return user;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public void setUser(UserSummary user) {
        this.user = user;
    }
}
