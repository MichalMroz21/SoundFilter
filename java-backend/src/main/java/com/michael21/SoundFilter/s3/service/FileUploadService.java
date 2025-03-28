package com.michael21.SoundFilter.s3.service;

import com.michael21.SoundFilter.s3.config.S3Configuration;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.*;
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;
import software.amazon.awssdk.core.client.config.SdkAdvancedClientOption;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetUrlRequest;
import software.amazon.awssdk.services.s3.model.ObjectCannedACL;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.net.URI;

@Service
public class FileUploadService {
    private S3Client s3Client;
    private final S3Configuration s3Configuration;

    public FileUploadService(S3Configuration s3Configuration) {
        this.s3Configuration = s3Configuration;

        AwsCredentials credentials = AwsBasicCredentials.create(
                s3Configuration.getAccessKey(),
                s3Configuration.getSecretKey()
        );

        S3Client s3Client = S3Client.builder()
                .endpointOverride(URI.create(s3Configuration.getBaseUrl()))
                .region(Region.of(s3Configuration.getRegion()))
                .credentialsProvider(StaticCredentialsProvider.create(credentials))
                .serviceConfiguration(software.amazon.awssdk.services.s3.S3Configuration.builder().pathStyleAccessEnabled(true).build())
                .build();
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
}
