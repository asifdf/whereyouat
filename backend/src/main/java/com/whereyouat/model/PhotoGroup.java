package com.whereyouat.model;

import java.util.ArrayList;
import java.util.List;

public class PhotoGroup {
    private double latitude;
    private double longitude;
    private List<PhotoItem> photos = new ArrayList<>();

    public PhotoGroup() {
    }

    public PhotoGroup(double latitude, double longitude) {
        this.latitude = latitude;
        this.longitude = longitude;
    }

    public double getLatitude() {
        return latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public List<PhotoItem> getPhotos() {
        return photos;
    }

    public void setLatitude(double latitude) {
        this.latitude = latitude;
    }

    public void setLongitude(double longitude) {
        this.longitude = longitude;
    }

    public void setPhotos(List<PhotoItem> photos) {
        this.photos = photos;
    }
}
