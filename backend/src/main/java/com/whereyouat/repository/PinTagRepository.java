package com.whereyouat.repository;

import com.whereyouat.model.PinTagEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PinTagRepository extends JpaRepository<PinTagEntity, String> {
}
