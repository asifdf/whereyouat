package com.whereyouat.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "pins")
public class PinTagEntity {
    @Id
    @Column(length = 36)
    private String id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String description;

    @Column(nullable = false)
    private double latitude;

    @Column(nullable = false)
    private double longitude;

    @ElementCollection
    @CollectionTable(name = "pin_tagged_names", joinColumns = @JoinColumn(name = "pin_id"))
    @Column(name = "tagged_name")
    private List<String> taggedNames;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    public PinTagEntity() {
    }

    public PinTagEntity(String id, String title, String description, double latitude, double longitude, List<String> taggedNames, LocalDateTime createdAt) {
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
