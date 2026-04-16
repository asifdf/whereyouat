package com.whereyouat.repository;

import com.whereyouat.model.MemoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MemoryRepository extends JpaRepository<MemoryEntity, String> {
    List<MemoryEntity> findAllByOrderByCreatedAtDesc();
}
