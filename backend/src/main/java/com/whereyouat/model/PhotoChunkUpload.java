package com.whereyouat.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class PhotoChunkUpload {
    @NotBlank
    private String uploadId;

    @NotBlank
    private String title;

    @NotNull
    private Double latitude;

    @NotNull
    private Double longitude;

    private String description;

    @NotNull
    private Integer chunkIndex;

    @NotNull
    private Integer totalChunks;

    @NotBlank
    private String chunkData;

    public String getUploadId() {
        return uploadId;
    }

    public void setUploadId(String uploadId) {
        this.uploadId = uploadId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Integer getChunkIndex() {
        return chunkIndex;
    }

    public void setChunkIndex(Integer chunkIndex) {
        this.chunkIndex = chunkIndex;
    }

    public Integer getTotalChunks() {
        return totalChunks;
    }

    public void setTotalChunks(Integer totalChunks) {
        this.totalChunks = totalChunks;
    }

    public String getChunkData() {
        return chunkData;
    }

    public void setChunkData(String chunkData) {
        this.chunkData = chunkData;
    }
}
