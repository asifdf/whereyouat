package com.whereyouat.model;

import jakarta.validation.constraints.NotBlank;

public class PhotoChunkCompleteRequest {
    @NotBlank
    private String uploadId;

    public String getUploadId() {
        return uploadId;
    }

    public void setUploadId(String uploadId) {
        this.uploadId = uploadId;
    }
}
