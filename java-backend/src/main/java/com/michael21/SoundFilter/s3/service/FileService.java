package com.michael21.SoundFilter.s3.service;

import com.michael21.SoundFilter.s3.config.S3Configuration;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.*;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

import java.io.IOException;
import java.net.URI;

@Service
public class FileService {
    private S3Client s3Client;
    private final S3Configuration s3Configuration;

    public FileService(S3Configuration s3Configuration) {
        try {
            if (s3Configuration == null) {
                throw new IllegalArgumentException("S3Configuration cannot be null");
            }

            this.s3Configuration = s3Configuration;

            System.out.println("Access Key: " + (s3Configuration.getAccessKey() != null ? "Present" : "NULL"));
            System.out.println("Secret Key: " + (s3Configuration.getSecretKey() != null ? "Present" : "NULL"));
            System.out.println("Base URL: " + s3Configuration.getBaseUrl());
            System.out.println("Region: " + s3Configuration.getRegion());

            if (s3Configuration.getAccessKey() == null || s3Configuration.getSecretKey() == null) {
                throw new IllegalArgumentException("AWS credentials cannot be null");
            }

            if (s3Configuration.getBaseUrl() == null) {
                throw new IllegalArgumentException("Base URL cannot be null");
            }

            if (s3Configuration.getRegion() == null) {
                throw new IllegalArgumentException("Region cannot be null");
            }

            AwsCredentials credentials = AwsBasicCredentials.create(
                    s3Configuration.getAccessKey(),
                    s3Configuration.getSecretKey()
            );

            S3Client s3Client = S3Client.builder()
                    .endpointOverride(URI.create(s3Configuration.getBaseUrl()))
                    .region(Region.of(s3Configuration.getRegion()))
                    .credentialsProvider(StaticCredentialsProvider.create(credentials))
                    .serviceConfiguration(software.amazon.awssdk.services.s3.S3Configuration.builder()
                            .pathStyleAccessEnabled(true)
                            .build())
                    .build();

            try {
                s3Client.listBuckets();
                System.out.println("S3 client successfully initialized and connected");
            } catch (S3Exception e) {
                System.err.println("Error connecting to S3: " + e.getMessage());
                throw e;
            }

            this.s3Client = s3Client;

        } catch (Exception e) {
            System.err.println("Error initializing S3 client: " + e.getMessage());
            e.printStackTrace();
            throw e;
        }
    }

    public String uploadFile(String filePath, byte[] file){
        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(s3Configuration.getBucketName())
                .storageClass(s3Configuration.getStorageClass())
                .key(filePath)
                .acl(ObjectCannedACL.PUBLIC_READ)
                .build();

        s3Client.putObject(request, RequestBody.fromBytes(file));

        try {
            GetUrlRequest getUrlRequest = GetUrlRequest.builder().bucket(s3Configuration.getBucketName()).key(filePath).build();
            return s3Client.utilities().getUrl(getUrlRequest).toURI().toString();
        } catch (Exception e) {
            throw new RuntimeException("Failed to get URL of uploaded File", e);
        }
    }

    public void deleteFile(String filePath) {
        DeleteObjectRequest request = DeleteObjectRequest.builder()
                .bucket(s3Configuration.getBucketName())
                .key(filePath)
                .build();

        try {
            s3Client.deleteObject(request);
        } catch (S3Exception e) {
            throw new RuntimeException("Failed to delete file from S3", e);
        }
    }
}
