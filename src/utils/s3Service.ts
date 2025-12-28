import { S3Client } from "@aws-sdk/client-s3";
import multer from "multer";
import multerS3 from "multer-s3";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "auto",
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || "",
        secretAccessKey: process.env.S3_SECRET_KEY || "",
    },
    forcePathStyle: true, // Often needed for S3-compatible storage like MinIO or DigitalOcean
});

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
            const filename = `prod_${Date.now()}_${Math.round(Math.random() * 1e9)}${extension}`;
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

export const getImageUrl = (filename: string) => {
    if (!filename) return null;
    if (filename.startsWith("http")) return filename; // Already a full URL

    const baseUrl = process.env.S3_PUBLIC_URL || `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}`;
    const additionalDir = process.env.S3_IMAGE_DIR ? `${process.env.S3_IMAGE_DIR}/` : "";

    return `${baseUrl}/${additionalDir}${filename}`;
};
