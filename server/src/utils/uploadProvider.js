import { v2 as cloudinary } from "cloudinary";

const hasCloudinary =
  !!process.env.CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET;

if (hasCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

export async function uploadFileAndGetUrl(file, localFallbackUrl) {
  if (!file) return "";
  if (!hasCloudinary) return localFallbackUrl;

  const resourceType = file.mimetype.startsWith("image/") ? "image" : "raw";
  const uploaded = await cloudinary.uploader.upload(file.path, {
    folder: "nanohire_uploads",
    resource_type: resourceType
  });
  return uploaded.secure_url;
}
