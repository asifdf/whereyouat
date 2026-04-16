package com.whereyouat.repository;

import com.whereyouat.model.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<UserEntity, String> {
    Optional<UserEntity> findByUsername(String username);
    boolean existsByUsername(String username);
    List<UserEntity> findByUsernameContainingIgnoreCaseOrNameContainingIgnoreCaseOrIdContainingIgnoreCase(String username, String name, String id);
}
