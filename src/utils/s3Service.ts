import { S3Client, CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import multer from "multer";
import multerS3 from "multer-s3";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

export const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "auto",
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || "",
        secretAccessKey: process.env.S3_SECRET_KEY || "",
    },
    forcePathStyle: true,
});

export const initializeBucket = async () => {
    const bucketName = process.env.S3_BUCKET || "astr-inventory";
    try {
        await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
        console.log(`Bucket "${bucketName}" already exists.`);
    } catch (error: any) {
        if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
            console.log(`Bucket "${bucketName}" does not exist. Creating...`);
            await s3.send(new CreateBucketCommand({ Bucket: bucketName }));
            
            // Set public read policy
            const policy = {
                Version: "2012-10-17",
                Statement: [
                    {
                        Sid: "PublicRead",
                        Effect: "Allow",
                        Principal: "*",
                        Action: ["s3:GetObject"],
                        Resource: [`arn:aws:s3:::${bucketName}/*`],
                    },
                ],
            };
            
            await s3.send(new PutBucketPolicyCommand({
                Bucket: bucketName,
                Policy: JSON.stringify(policy),
            }));
            
            console.log(`Bucket "${bucketName}" created and public policy applied.`);
        } else {
            console.error("Error checking/creating bucket:", error);
        }
    }
};

// Initialize bucket on module load (optional, or call from server startup)
initializeBucket();

export const productUpload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.S3_BUCKET || "astr-inventory",
        acl: "public-read",
        contentType: multerS3.AUTO_CONTENT_TYPE,
        metadata: function (req: any, file: any, cb: any) {
            cb(null, { fieldName: file.fieldname });
        },
        key: function (req: any, file: any, cb: any) {
            const extension = path.extname(file.originalname);
            const dir = process.env.S3_IMAGE_DIR ? `${process.env.S3_IMAGE_DIR}/` : "";
            const filename = `${dir}prod_${Date.now()}_${Math.round(Math.random() * 1e9)}${extension}`;
            cb(null, filename);
        },
    }),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req: any, file: any, cb: any) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Only images are allowed!"));
        }
    },
});

export const getImageUrl = (key: string) => {
    if (!key) return null;
    if (key.startsWith("http")) return key; // Already a full URL

    const baseUrl = (process.env.S3_PUBLIC_URL || `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}`).replace(/\/$/, "");
    
    // Normalize key: remove leading slash
    const normalizedKey = key.startsWith("/") ? key.substring(1) : key;
    
    // If the key already starts with the directory, don't add it again
    const dir = process.env.S3_IMAGE_DIR ? `${process.env.S3_IMAGE_DIR}/` : "";
    if (dir && normalizedKey.startsWith(dir)) {
        return `${baseUrl}/${normalizedKey}`;
    }

    return `${baseUrl}/${dir}${normalizedKey}`;
};

/**
 * Delete multiple images from S3
 * @param keys Array of S3 keys to delete
 */
export const deleteImagesFromS3 = async (keys: string[]) => {
    if (!keys || keys.length === 0) return;

    try {
        const bucketName = process.env.S3_BUCKET || "astr-inventory";
        const deleteParams = {
            Bucket: bucketName,
            Delete: {
                Objects: keys.map(key => ({ Key: key })),
            },
        };

        const result = await s3.send(new DeleteObjectsCommand(deleteParams));
        console.log(`Deleted ${keys.length} images from S3:`, result);
        return result;
    } catch (error) {
        console.error("Error deleting images from S3:", error);
        throw error;
    }
};
