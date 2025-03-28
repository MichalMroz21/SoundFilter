package com.michael21.SoundFilter.s3.repository;

import com.michael21.SoundFilter.s3.UploadedFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UploadedFileRepository extends JpaRepository<UploadedFile, Long> {
}
