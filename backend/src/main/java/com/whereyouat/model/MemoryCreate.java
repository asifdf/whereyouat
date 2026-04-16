package com.whereyouat.model;

import jakarta.validation.constraints.NotBlank;

public class MemoryCreate {
    @NotBlank
    private String title;

    @NotBlank
    private String body;

    @NotBlank
    private String photoUrl;

    public MemoryCreate() {
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

    public void setTitle(String title) {
        this.title = title;
    }

    public void setBody(String body) {
        this.body = body;
    }

    public void setPhotoUrl(String photoUrl) {
        this.photoUrl = photoUrl;
    }
}
