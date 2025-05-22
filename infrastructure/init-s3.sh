#!/bin/bash
set -e

# Set variables
BUCKET_NAME="sound-filter"
LOCALSTACK_HOST="localstack"
LOCALSTACK_PORT="4566"
ENDPOINT_URL="http://${LOCALSTACK_HOST}:${LOCALSTACK_PORT}"

echo "Starting S3 initialization script..."
echo "Endpoint URL: ${ENDPOINT_URL}"
echo "Bucket name: ${BUCKET_NAME}"

# Wait for LocalStack to be ready with better checking
echo "Waiting for LocalStack to be ready..."
max_retries=30
retry_count=0

while [ $retry_count -lt $max_retries ]; do
  echo "Attempt $((retry_count+1))/$max_retries: Checking if LocalStack is ready..."
  
  if aws --endpoint-url="${ENDPOINT_URL}" s3 ls 2>/dev/null; then
    echo "LocalStack S3 is ready!"
    break
  else
    echo "LocalStack S3 is not ready yet..."
    retry_count=$((retry_count+1))
    sleep 2
  fi
done

if [ $retry_count -eq $max_retries ]; then
  echo "Error: LocalStack did not become ready in time"
  exit 1
fi

# Try to create the bucket
echo "Creating bucket: ${BUCKET_NAME}"
if aws --endpoint-url="${ENDPOINT_URL}" s3 mb "s3://${BUCKET_NAME}" 2>/dev/null; then
  echo "Bucket created successfully"
else
  echo "Checking if bucket already exists..."
  if aws --endpoint-url="${ENDPOINT_URL}" s3 ls "s3://${BUCKET_NAME}" 2>/dev/null; then
    echo "Bucket already exists, continuing..."
  else
    echo "Failed to create bucket and bucket does not exist"
    exit 1
  fi
fi

# Create CORS configuration file
echo "Creating CORS configuration..."
cat > /tmp/cors.json << EOF
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "MaxAgeSeconds": 3000,
      "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"]
    }
  ]
}
EOF

# Apply CORS configuration
echo "Applying CORS configuration to bucket..."
aws --endpoint-url="${ENDPOINT_URL}" s3api put-bucket-cors --bucket "${BUCKET_NAME}" --cors-configuration file:///tmp/cors.json
echo "CORS configuration applied"

# Create bucket policy for public read access
echo "Creating bucket policy..."
cat > /tmp/policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/*"
    }
  ]
}
EOF

# Apply bucket policy
echo "Applying bucket policy..."
aws --endpoint-url="${ENDPOINT_URL}" s3api put-bucket-policy --bucket "${BUCKET_NAME}" --policy file:///tmp/policy.json
echo "Bucket policy applied"

# List buckets to verify
echo "Listing buckets:"
aws --endpoint-url="${ENDPOINT_URL}" s3 ls

echo "S3 bucket setup complete!"
exit 0