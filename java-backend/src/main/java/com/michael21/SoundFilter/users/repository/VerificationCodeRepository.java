package com.michael21.SoundFilter.users.repository;

import java.util.Optional;
import com.michael21.SoundFilter.users.VerificationCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

@Repository
public interface VerificationCodeRepository extends JpaRepository<VerificationCode, Long> {
    @Query("SELECT vc FROM VerificationCode vc WHERE vc.code = :code")
    Optional<VerificationCode> findByCode(String code);
}