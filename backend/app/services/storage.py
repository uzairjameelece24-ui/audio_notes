import os
import logging
from typing import Optional, Dict, Any
from urllib.parse import urlparse, urlunparse
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from app.config import settings

logger = logging.getLogger(__name__)


class StorageService:
    def __init__(self):
        # Configure standard S3 client with signature version s3v4
        session = boto3.session.Session()
        self.s3_client = session.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT_URL if settings.S3_ENDPOINT_URL else None,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"})
        )
        self.bucket_name = settings.S3_BUCKET_NAME
        self._ensure_bucket_ready()

    def _ensure_bucket_ready(self):
        """
        Auto-creates the bucket and applies CORS rules if running with local S3 (LocalStack / MinIO).
        """
        try:
            try:
                self.s3_client.head_bucket(Bucket=self.bucket_name)
            except ClientError as e:
                error_code = e.response.get("Error", {}).get("Code")
                if error_code in ["404", "NoSuchBucket"]:
                    logger.info(f"Creating S3 bucket: {self.bucket_name}")
                    if settings.AWS_REGION == "us-east-1":
                        self.s3_client.create_bucket(Bucket=self.bucket_name)
                    else:
                        self.s3_client.create_bucket(
                            Bucket=self.bucket_name,
                            CreateBucketConfiguration={"LocationConstraint": settings.AWS_REGION}
                        )

            # Apply CORS configuration for direct browser PUT uploads
            cors_configuration = {
                "CORSRules": [
                    {
                        "AllowedHeaders": ["*"],
                        "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
                        "AllowedOrigins": ["*"],
                        "ExposeHeaders": ["ETag"],
                        "MaxAgeSeconds": 3000
                    }
                ]
            }
            self.s3_client.put_bucket_cors(
                Bucket=self.bucket_name,
                CORSConfiguration=cors_configuration
            )
            logger.info(f"S3 Bucket '{self.bucket_name}' is initialized with CORS.")
        except Exception as e:
            logger.warning(f"Could not auto-configure bucket '{self.bucket_name}' (expected in production if IAM is restricted): {e}")

    def generate_presigned_upload_url(self, key: str, content_type: str) -> str:
        """
        Generate a presigned PUT URL for direct browser uploads.
        """
        url = self.s3_client.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": self.bucket_name,
                "Key": key,
                "ContentType": content_type
            },
            ExpiresIn=settings.PRESIGNED_URL_EXPIRES_IN,
            HttpMethod="PUT"
        )
        
        # If running in Docker where S3 host differs from browser host (e.g., s3:4566 vs localhost:4566)
        if settings.S3_PUBLIC_ENDPOINT_URL:
            parsed_url = urlparse(url)
            parsed_pub = urlparse(settings.S3_PUBLIC_ENDPOINT_URL)
            new_url = parsed_url._replace(
                scheme=parsed_pub.scheme or parsed_url.scheme,
                netloc=parsed_pub.netloc or parsed_pub.path
            )
            url = urlunparse(new_url)

        return url

    def head_object(self, key: str) -> Optional[Dict[str, Any]]:
        """
        Check if object exists and get metadata (e.g. ContentLength).
        """
        try:
            return self.s3_client.head_object(Bucket=self.bucket_name, Key=key)
        except ClientError as e:
            logger.warning(f"HEAD object error for key {key}: {e}")
            return None

    def download_file(self, key: str, local_path: str) -> bool:
        """
        Download object from bucket to local disk path.
        """
        try:
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            self.s3_client.download_file(self.bucket_name, key, local_path)
            return True
        except Exception as e:
            logger.error(f"Failed to download object {key} to {local_path}: {e}")
            return False

    def delete_object(self, key: str) -> bool:
        """
        Delete object from bucket.
        """
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=key)
            return True
        except Exception as e:
            logger.warning(f"Failed to delete object {key}: {e}")
            return False


# Global singleton instance
storage_service = StorageService()
