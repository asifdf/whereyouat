package com.whereyouat.model;

import java.time.LocalDateTime;
import java.util.List;

public class PinTag {
    private String id;
    private String title;
    private String description;
    private double latitude;
    private double longitude;
    private List<String> taggedNames;
    private LocalDateTime createdAt;

    public PinTag() {
    }

    public PinTag(String id, String title, String description, double latitude, double longitude, List<String> taggedNames, LocalDateTime createdAt) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.latitude = latitude;
        this.longitude = longitude;
        this.taggedNames = taggedNames;
        this.createdAt = createdAt;
    }

    public String getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public double getLatitude() {
        return latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public List<String> getTaggedNames() {
        return taggedNames;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setId(String id) {
        this.id = id;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public void setLatitude(double latitude) {
        this.latitude = latitude;
    }

    public void setLongitude(double longitude) {
        this.longitude = longitude;
    }

    public void setTaggedNames(List<String> taggedNames) {
        this.taggedNames = taggedNames;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
