package com.whereyouat.repository;

import com.whereyouat.model.PhotoEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PhotoRepository extends JpaRepository<PhotoEntity, String> {
    List<PhotoEntity> findByAuthorId(String authorId);
}
