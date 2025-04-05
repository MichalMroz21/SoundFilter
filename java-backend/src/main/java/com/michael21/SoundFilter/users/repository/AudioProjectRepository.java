package com.michael21.SoundFilter.users.repository;

import com.michael21.SoundFilter.users.AudioProject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AudioProjectRepository extends JpaRepository<AudioProject, Long> {

}
